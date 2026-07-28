/**
 * Azure DevOps task entrypoint for Enterprise Performance Engineering Download Scripts.
 *
 * Reads task inputs from task.json, builds config, and runs the script download.
 * Input names MUST match task.json exactly.
 */

import * as tl from 'azure-pipelines-task-lib/task';
import { LreDownloadConfig } from '../src/download/models';
import { LreScriptDownloadRunner } from '../src/download/lre/LreScriptDownloadRunner';
import { Logger } from '../src/shared/utils/Logger';
import { parseServerInput } from '../src/shared/utils/serverUtils';

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseBool(value: string | undefined, defaultValue = false): boolean {
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true';
}

function parseSuccessThreshold(raw: string): number {
    const trimmed = raw.trim();
    if (trimmed === '') return 50;
    const n = parseInt(trimmed, 10);
    if (isNaN(n) || n < 0 || n > 100) return 50;
    return n;
}

// ── Main entrypoint ───────────────────────────────────────────────────────────

export async function runEntrypoint(): Promise<void> {
    let logger: Logger | undefined;
    try {
        // Read inputs — names must exactly match task.json
        const rawServer       = tl.getInput('varPCServer', true) ?? '';
        const useToken        = parseBool(tl.getInput('varUseTokenForAuthentication', false));
        const username        = tl.getInput('varUserName', true) ?? '';
        const password        = tl.getInput('varPassWord', false) ?? '';
        const domain          = tl.getInput('varDomain', true) ?? '';
        const project         = tl.getInput('varProject', true) ?? '';
        const workspaceDir    = tl.getInput('varWorkspaceDir', true)
                                ?? tl.getVariable('Build.SourcesDirectory')
                                ?? process.cwd();
        const parallelDownloads = Math.min(20, Math.max(1,
                                parseInt(tl.getInput('varParallelDownloads', false) ?? '1', 10) || 1));
        const successThreshold = parseSuccessThreshold(tl.getInput('varSuccessThreshold', false) ?? '');
        const proxyUrl        = tl.getInput('varProxyUrl', false) ?? '';
        const proxyUser       = tl.getInput('varProxyUser', false) ?? '';
        const proxyPassword   = tl.getInput('varProxyPassword', false) ?? '';
        const artifactsDir    = tl.getInput('varArtifactsDir', false)
                                ?? tl.getVariable('Build.ArtifactStagingDirectory')
                                ?? '';
        const description     = tl.getInput('descriptionString', false)
                                ?? 'Enterprise Performance Engineering Download Scripts';

        const { serverUrl, tenant } = parseServerInput(rawServer);

        const config: LreDownloadConfig = {
            serverUrl,
            tenant,
            useToken,
            username,
            password,
            clientId:     useToken ? username : undefined,
            clientSecret: useToken ? password : undefined,
            domain,
            project,
            proxyUrl:     proxyUrl || undefined,
            proxyUser:    proxyUser || undefined,
            proxyPassword: proxyPassword || undefined,
            workspaceDir,
            artifactsDir
        };

        const timestamp   = new Date().toISOString().replace(/[:.]/g, '-');
        logger = new Logger(
            artifactsDir
                ? { logDirectory: artifactsDir, logFileName: `lre_download_scripts_${timestamp}.log` }
                : undefined
        );
        logger.log(`Task: ${description}`);
        logger.log(`Server: ${serverUrl}${tenant ? ` (tenant: ${tenant})` : ''}`);
        logger.log(`Domain: ${domain} | Project: ${project}`);
        logger.log(`Download directory: ${workspaceDir}`);
        logger.log(`Parallel downloads: ${parallelDownloads}`);
        logger.log(`Success threshold: ${successThreshold}%`);

        const runner  = new LreScriptDownloadRunner(config, logger, parallelDownloads, successThreshold);
        const success = await runner.run();

        if (success) {
            tl.setResult(tl.TaskResult.Succeeded, 'Script download completed successfully.');
        } else {
            tl.setResult(tl.TaskResult.Failed, 'Script download failed. See logs for details.');
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (logger) {
            logger.error(`Unexpected error: ${msg}`);
        } else {
            tl.error(`Unexpected error: ${msg}`);
        }
        tl.setResult(tl.TaskResult.Failed, `Unexpected error: ${msg}`);
    } finally {
        if (logger) {
            logger.close();
        }
    }
}

// Only call directly when run as the main module.
if (require.main === module) {
    void runEntrypoint();
}

process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    console.error('Unhandled rejection:', msg);
    tl.setResult(tl.TaskResult.Failed, 'Task interrupted: ' + msg);
});

