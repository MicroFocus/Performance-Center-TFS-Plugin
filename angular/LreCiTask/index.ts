/**
 * Azure DevOps task entrypoint — pure TypeScript / Node.js implementation.
 *
 * Replaces the previous PowerShell bridge (ExecutePcLocalTask → lreLocalTask.ps1).
 * Runs cross-platform on any Azure DevOps agent with Node 16+.
 *
 * Input names MUST match task.json exactly (note: varPassWord, vartimeslotRepeat).
 */

import * as tl from 'azure-pipelines-task-lib/task';
import { LreClient } from '../src/ci/lre/LreClient';
import { LreTestRunner } from '../src/ci/lre/LreTestRunner';
import { LreReportDownloader } from '../src/ci/lre/LreReportDownloader';
import { ArtifactManager } from '../src/ci/utils/ArtifactManager';
import { Logger } from '../src/shared/utils/Logger';
import { parseServerInput } from '../src/shared/utils/serverUtils';
import { LreConfig, LreTestExecutionConfig, PostRunAction, RunState } from '../src/ci/models';

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseBool(value: string, defaultValue = false): boolean {
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true';
}

function parsePositiveInt(value: string, fallback: number): number {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function mapPostRunAction(raw: string): PostRunAction {
    switch (raw) {
        case 'CollateResults':    return 'Collate Results';
        case 'DoNotCollate':      return 'Do Not Collate';
        case 'CollateAndAnalyze':
        default:                  return 'Collate And Analyze';
    }
}


/**
 * If the artifacts path still contains an unresolved $(...) variable token,
 * fall back to the pipeline workspace (legacy behaviour from old index.ts).
 */
function resolveArtifactsPath(raw: string): string {
    if (/\$\([^)]+\)/.test(raw)) {
        const ws = process.env['PIPELINE_WORKSPACE'];
        return ws ? `${ws}\\LreTest` : 'LreTest';
    }
    return raw || 'LreTest';
}

// ── Signal handlers so shouldCancel() works ───────────────────────────────────
let cancellationRequested = false;
// CANCELLABLE_STATES is the single source of truth in LreTestRunner.

// ── Main ──────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
    let logger: Logger | undefined;
    let client: LreClient | undefined;
    let activeRunId: number | undefined;
    let activeRunState: RunState | undefined;
    let stopPromise: Promise<void> | null = null;

    const requestStopIfNeeded = (source: string): void => {
        if (!client || !activeRunId || !activeRunState || stopPromise) return;
        if (!LreTestRunner.CANCELLABLE_STATES.has(activeRunState)) return;

        stopPromise = (async () => {
            logger?.warn(
                `Cancellation signal (${source}) received while run ${activeRunId} is ${activeRunState} — sending stop command...`
            );
            const stopped = await client!.stopRun(activeRunId!, 'Do Not Collate');
            if (stopped) {
                logger?.warn(`Stop command sent for run ${activeRunId} (triggered by ${source}).`);
            } else {
                logger?.warn(`Failed to send stop command for run ${activeRunId} (triggered by ${source}).`);
            }
        })().catch((e) => {
            logger?.warn(`Cancellation stop attempt failed: ${e instanceof Error ? e.message : String(e)}`);
        });
    };

    const onSigInt = (): void => {
        cancellationRequested = true;
        requestStopIfNeeded('SIGINT');
    };

    const onSigTerm = (): void => {
        cancellationRequested = true;
        requestStopIfNeeded('SIGTERM');
    };

    process.on('SIGINT', onSigInt);
    process.on('SIGTERM', onSigTerm);

    try {
        // ── 1. Read task inputs (exact names from task.json) ─────────────────
        const varPCServer                  = tl.getInput('varPCServer',                  true)  ?? '';
        const varUseTokenForAuthentication = tl.getInput('varUseTokenForAuthentication', false) ?? 'false';
        const varUserName                  = tl.getInput('varUserName',                  true)  ?? '';
        const varPassWord                  = tl.getInput('varPassWord',                  false) ?? '';   // capital W — matches task.json
        const varDomain                    = tl.getInput('varDomain',                    true)  ?? '';
        const varProject                   = tl.getInput('varProject',                   true)  ?? '';
        const varTestID                    = tl.getInput('varTestID',                    true)  ?? '';
        const varAutoTestInstance          = tl.getInput('varAutoTestInstance',           false) ?? 'true';
        const varTestInstID                = tl.getInput('varTestInstID',                 false) ?? '';
        const varPostRunAction             = tl.getInput('varPostRunAction',              false) ?? 'CollateAndAnalyze';
        const varProxyUrl                  = tl.getInput('varProxyUrl',                  false) ?? '';
        const varProxyUser                 = tl.getInput('varProxyUser',                 false) ?? '';
        const varProxyPassword             = tl.getInput('varProxyPassword',             false) ?? '';
        const varTrending                  = tl.getInput('varTrending',                  false) ?? 'DoNotTrend';
        const varTrendReportID             = tl.getInput('varTrendReportID',              false) ?? '';
        const varTimeslotDuration          = tl.getInput('varTimeslotDuration',           false) ?? '30';
        const varUseVUDs                   = tl.getInput('varUseVUDs',                   false) ?? 'false';
        const varUseSLAInStatus            = tl.getInput('varUseSLAInStatus',             false) ?? 'false';
        const varArtifactsDir              = tl.getInput('varArtifactsDir',               false) ?? '';
        const vartimeslotRepeat            = tl.getInput('vartimeslotRepeat',             false) ?? 'DoNotRepeat'; // lowercase t — matches task.json
        const varTimeslotRepeatDelay       = tl.getInput('varTimeslotRepeatDelay',        false) ?? '1';
        const varTimeslotRepeatAttempts    = tl.getInput('varTimeslotRepeatAttempts',     false) ?? '2';

        // ── 2. Mask secrets & validate ────────────────────────────────────────
        // Register sensitive values with the task runner immediately so the
        // ADO log engine masks them (replaces with ***) in all subsequent output,
        // including stack traces and debug lines from third-party libraries.
        if (varPassWord)      tl.setSecret(varPassWord);
        if (varProxyPassword) tl.setSecret(varProxyPassword);

        const testId = parsePositiveInt(varTestID, 0);
        if (testId <= 0) {
            throw new Error('Invalid Test ID — must be a positive integer.');
        }

        const useToken = parseBool(varUseTokenForAuthentication);
        const { serverUrl, tenant } = parseServerInput(varPCServer);
        const artifactsBase = resolveArtifactsPath(varArtifactsDir);
        const artifactsDir  = ArtifactManager.createTimestampedDirectory(artifactsBase, 'LreTest');

        // ── 3. Logger (writes to artifacts dir for the duration of the run) ──
        logger = new Logger({ logDirectory: artifactsDir, logFileName: 'LreCiTask.log' });
        logger.info('=== OpenText Enterprise Performance Engineering CI Task starting ===');
        logger.info(`Node runtime : ${process.version}`);
        logger.info(
            `Runtime path : ${process.env['LRE_TASK_RUNTIME_FLAVOR'] || 'direct'}${
                process.env['LRE_TASK_RUNTIME_BUNDLE'] ? ` (${process.env['LRE_TASK_RUNTIME_BUNDLE']})` : ''
            }`
        );
        logger.info(`Server  : ${serverUrl}`);
        logger.info(`Project : ${varDomain}/${varProject}`);
        logger.info(`Test ID : ${testId}`);
        logger.info(`Auth    : ${useToken ? 'API token' : 'username/password'}`);

        // ── 4. Build config objects ───────────────────────────────────────────

        // Proxy: honour the agent's system-wide proxy when no explicit proxy
        // input is provided. tl.getHttpProxyConfiguration() reads the
        // AGENT_PROXYURL / AGENT_PROXYUSERNAME / AGENT_PROXYPASSWORD env vars
        // set by the ADO agent from its own proxy configuration.
        // Explicit task inputs always take precedence over agent proxy.
        let resolvedProxyUrl      = varProxyUrl      || undefined;
        let resolvedProxyUser     = varProxyUser     || undefined;
        let resolvedProxyPassword = varProxyPassword || undefined;

        if (!resolvedProxyUrl) {
            const agentProxy = tl.getHttpProxyConfiguration();
            if (agentProxy?.proxyUrl) {
                resolvedProxyUrl      = agentProxy.proxyUrl;
                resolvedProxyUser     = agentProxy.proxyUsername ?? undefined;
                resolvedProxyPassword = agentProxy.proxyPassword ?? undefined;
                // Mask the agent proxy password the same way as the task input
                if (resolvedProxyPassword) tl.setSecret(resolvedProxyPassword);
            }
        }

        const lreConfig: LreConfig = {
            serverUrl,
            domain:         varDomain,
            project:        varProject,
            tenant,
            useToken,
            // For token auth, username = clientId, password = clientSecret
            username:       useToken ? undefined : varUserName,
            password:       useToken ? undefined : varPassWord,
            clientId:       useToken ? varUserName : undefined,
            clientSecret:   useToken ? varPassWord : undefined,
            proxyUrl:       resolvedProxyUrl,
            proxyUser:      resolvedProxyUser,
            proxyPassword:  resolvedProxyPassword
        };

        const trending = varTrending as LreTestExecutionConfig['trending'];

        const execConfig: LreTestExecutionConfig = {
            testId,
            testInstanceId:          varTestInstID ? parsePositiveInt(varTestInstID, 0) : undefined,
            autoTestInstance:        parseBool(varAutoTestInstance, true),
            timeslotDurationMinutes: parsePositiveInt(varTimeslotDuration, 30),
            postRunAction:           mapPostRunAction(varPostRunAction),
            useVuds:                 parseBool(varUseVUDs),
            useSLAStatus:            parseBool(varUseSLAInStatus),
            trending,
            trendReportId:           varTrendReportID ? parsePositiveInt(varTrendReportID, 0) : undefined,
            timeslotRepeat:          vartimeslotRepeat === 'RepeatWithParameters'
                                         ? 'RepeatWithParameters'
                                         : 'DoNotRepeat',
            timeslotRepeatDelay:     parsePositiveInt(varTimeslotRepeatDelay,    1),
            timeslotRepeatAttempts:  parsePositiveInt(varTimeslotRepeatAttempts, 2)
        };

        // ── 5. Build service objects ──────────────────────────────────────────
        client = new LreClient(lreConfig);
        const runner     = new LreTestRunner(client, logger, {
            shouldCancel: () => cancellationRequested,
            onRunStarted: (runId) => {
                activeRunId = runId;
            },
            onRunState: (_runId, state) => {
                activeRunState = state;
            }
        });
        const downloader = new LreReportDownloader(client, logger);

        // ── 6. Authenticate ───────────────────────────────────────────────────
        logger.info('Authenticating...');
        const authenticated = await client.authenticate();
        if (!authenticated) {
            throw new Error('Authentication failed. Check credentials and server URL.');
        }
        logger.info('Authentication succeeded.');

        try {
            // ── 7. Execute run ────────────────────────────────────────────────
            const runResult = await runner.execute(execConfig);
            logger.info(runResult.message);

            // ── 8. Download artifacts ─────────────────────────────────────────
            if (execConfig.postRunAction !== 'Do Not Collate') {
                logger.info('Downloading run results...');
                await downloader.downloadRunResults(runResult.runId, artifactsDir, {
                    extractZips:   true,
                    keepZipFiles:  true,
                    retryAttempts: 3,  // Retry up to 3 times if results not ready
                    retryDelayMs:  3000 // Wait 3 seconds between retries
                });
            }

            // Trend PDF — use whatever report ID the runner resolved
            const trendId = runResult.resolvedTrendReportId ?? execConfig.trendReportId;
            if (trendId && trendId > 0 && execConfig.trending !== 'DoNotTrend') {
                await downloader.downloadTrendPdf(
                    trendId,
                    runResult.runId,
                    artifactsDir,
                    3,    // Retry up to 3 times
                    3000  // Wait 3 seconds between retries
                );
            }

            // ── 9. Set task outcome ───────────────────────────────────────────
            if (!runResult.success) {
                tl.setResult(tl.TaskResult.Failed, runResult.message);
                return;
            }

            tl.setResult(tl.TaskResult.Succeeded, runResult.message);

        } finally {
            if (stopPromise) {
                // On cancellation, wait briefly so stop command can leave the process before logout/exit.
                await Promise.race([
                    stopPromise,
                    new Promise<void>(resolve => setTimeout(resolve, 4000))
                ]);
            }
            await client.logout();
            logger.info('Logged out.');
            logger.info('=== OpenText Enterprise Performance Engineering CI Task finished ===');
        }

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (logger) { logger.error(msg); } else { console.error(msg); }
        tl.setResult(tl.TaskResult.Failed, msg);
    } finally {
        process.removeListener('SIGINT', onSigInt);
        process.removeListener('SIGTERM', onSigTerm);
    }
}

function shutdownProcess(exitCode: number): void {

    // Give the console/log sink one turn of the event loop to flush, then exit.
    setImmediate(() => process.exit(exitCode));
}

export function runEntrypoint(): Promise<void> {
    return main()
        .then(() => shutdownProcess(Number(process.exitCode ?? 0)))
        .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('Unhandled task error:', msg);
            tl.setResult(tl.TaskResult.Failed, msg);
            shutdownProcess(1);
        });
}

if (require.main === module) {
    void runEntrypoint();
}

process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    console.error('Unhandled rejection:', msg);
    tl.setResult(tl.TaskResult.Failed, 'Task interrupted: ' + msg);
});

