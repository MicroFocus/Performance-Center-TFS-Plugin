/**
 * LreTestRunner — orchestrates the full run lifecycle for one LRE test execution.
 *
 * The caller is responsible for:
 *   1. Calling client.authenticate() before execute()
 *   2. Calling client.logout() after execute() (typically in a finally block)
 *
 * This class mirrors the logic in PC.Plugins.Automation/PCClient/PCClient.cs:
 *   - GetCorrectTestInstanceID  → resolveTestInstanceId()
 *   - SetCorrectTrendReportID   → resolveAssociatedTrendReport()
 *   - StartRun (with retry)     → startRunWithRetry()
 *   - WaitForRunState (polling) → pollUntilTerminalState()
 *   - Cancellation handling     → trySendStopCommand()
 *   - GetRunEventLog (streaming)→ streamNewEventLogs()
 */

import { LreClient } from './LreClient';
import { Logger } from '../utils/Logger';
import {
    LreRunEventLogRecord,
    LreRunResponse,
    LreTestExecutionConfig,
    RunState
} from '../models';

export interface LreRunnerOptions {
    /** Milliseconds between run-state polls. Default 5000. */
    pollIntervalMs?: number;
    /**
     * Maximum total time (ms) the runner will wait for a terminal state
     * before aborting with an error. Default: 12 hours (43 200 000 ms).
     * Set to 0 to disable the guard entirely.
     */
    maxPollDurationMs?: number;
    /** Called for each new event log record streamed during the run. */
    onEventLogRecord?: (record: LreRunEventLogRecord) => void;
    /**
     * If provided and returns true, the runner sends a stop command on the next
     * poll cycle and waits for the run to reach a terminal state.
     */
    shouldCancel?: () => boolean;
    /** Called after a run is successfully started. */
    onRunStarted?: (runId: number) => void;
    /** Called whenever run-state data is observed during polling. */
    onRunState?: (runId: number, state: RunState) => void;
}

export interface LreExecutionResult {
    runId: number;
    finalState: RunState;
    runSlaStatus?: string;
    /** Resolved trend report ID (populated when trending = AssociatedTrend). */
    resolvedTrendReportId?: number;
    success: boolean;
    message: string;
}

export class LreTestRunner {
    private readonly pollIntervalMs: number;
    private readonly maxPollDurationMs: number;

    private static readonly TERMINAL_STATES = new Set<RunState>([
        'Finished',
        'Run Failure',
        'Canceled',
        'Failed Collating Results',
        'Failed Creating Analysis Data'
    ]);

    private static readonly FAILURE_STATES = new Set<RunState>([
        'Run Failure',
        'Canceled',
        'Failed Collating Results',
        'Failed Creating Analysis Data'
    ]);

    /** States in which a stop command can meaningfully be sent. */
    public static readonly CANCELLABLE_STATES = new Set<RunState>([
        'Initializing',
        'Running'
    ]);

    constructor(
        private readonly client: LreClient,
        private readonly logger: Logger,
        private readonly options: LreRunnerOptions = {}
    ) {
        this.pollIntervalMs    = options.pollIntervalMs    ?? 5000;
        this.maxPollDurationMs = options.maxPollDurationMs ?? (12 * 60 * 60 * 1000); // 12 h
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Runs the full test lifecycle.
     * Precondition: client.authenticate() has already been called.
     */
    async execute(config: LreTestExecutionConfig): Promise<LreExecutionResult> {
        // 1. Resolve (or create) the correct test instance
        const testInstanceId = await this.resolveTestInstanceId(config);
        this.logger.info(`Using test instance ID: ${testInstanceId}`);

        // 2. Resolve trend report ID if "AssociatedTrend" is selected
        const { updatedConfig, resolvedTrendReportId } =
            await this.resolveAssociatedTrendReport(config);

        // 3. Start the run (with configurable retry on timeslot failure)
        const runResponse = await this.startRunWithRetry(updatedConfig, testInstanceId);
        if (!runResponse?.ID) {
            throw new Error('Failed to start the LRE run after all configured attempts.');
        }

        const runId = runResponse.ID;
        this.options.onRunStarted?.(runId);
        this.logger.info(
            `Run started — Run ID: ${runId}, Timeslot ID: ${runResponse.TimeslotID}`
        );

        // 4. Poll until terminal state
        return this.pollUntilTerminalState(runId, updatedConfig.useSLAStatus, resolvedTrendReportId);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Polls the LRE server at regular intervals until the run reaches a terminal
     * state, then returns a structured result.
     *
     * Responsibilities:
     *   - Timeout guard (maxPollDurationMs)
     *   - State-change logging and onRunState callback
     *   - Cancellation: sends a stop command once when shouldCancel() becomes true
     *   - Best-effort event-log streaming between polls
     */
    private async pollUntilTerminalState(
        runId: number,
        useSLAStatus: boolean,
        resolvedTrendReportId?: number
    ): Promise<LreExecutionResult> {
        let lastState: RunState | undefined;
        let stopSent       = false;
        let lastEventLogId = 0;
        const pollStart    = Date.now();

        while (true) {
            // Guard against stuck runs — LRE may return a non-terminal state
            // indefinitely if something goes wrong on the server side.
            if (this.maxPollDurationMs > 0) {
                const elapsed = Date.now() - pollStart;
                if (elapsed > this.maxPollDurationMs) {
                    throw new Error(
                        `Run ${runId} timed out after ` +
                        `${Math.round(elapsed / 60000)} minutes ` +
                        `in state "${lastState ?? 'unknown'}". ` +
                        `Increase maxPollDurationMs if the test is expected to run longer.`
                    );
                }
            }

            const runData = await this.client.getRunData(runId);
            if (!runData) {
                this.logger.warn(
                    `Could not retrieve run data for run ${runId}. Retrying in ${this.pollIntervalMs}ms...`
                );
                await this.sleep(this.pollIntervalMs);
                continue;
            }

            if (runData.RunState !== lastState) {
                lastState = runData.RunState;
                this.logger.info(`Run ${runId} → state: ${runData.RunState}`);
            }
            this.options.onRunState?.(runId, runData.RunState);

            if (!stopSent && this.options.shouldCancel?.()) {
                stopSent = true;
                await this.trySendStopCommand(runId, runData.RunState);
            }

            lastEventLogId = await this.streamNewEventLogs(runId, lastEventLogId);

            if (LreTestRunner.TERMINAL_STATES.has(runData.RunState)) {
                this.logger.info(`Run ${runId} reached terminal state: ${runData.RunState}`);
                return this.buildResult(runId, runData, useSLAStatus, resolvedTrendReportId);
            }

            await this.sleep(this.pollIntervalMs);
        }
    }

    /**
     * Sends a stop command if the run is still in a cancellable state.
     * Called at most once per run (stopSent guard lives in pollUntilTerminalState).
     */
    private async trySendStopCommand(runId: number, currentState: RunState): Promise<void> {
        if (!LreTestRunner.CANCELLABLE_STATES.has(currentState)) {
            this.logger.warn(
                `Cancellation requested but run ${runId} is ${currentState}; no stop command needed.`
            );
            return;
        }

        this.logger.warn(
            `Cancellation requested while run ${runId} is ${currentState} — sending stop command...`
        );
        const stopped = await this.client.stopRun(runId, 'Do Not Collate');
        if (stopped) {
            this.logger.warn(`Stop command sent for run ${runId}. Waiting for terminal state...`);
        } else {
            this.logger.warn(`Failed to send stop command for run ${runId}. Will keep polling state.`);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Returns the test instance ID to use for this run.
     * Mirrors GetCorrectTestInstanceID() from PCClient.cs:
     *   - Manual: use the configured testInstanceId directly
     *   - Auto:   pick last existing instance, or create one in the last test set
     */
    private async resolveTestInstanceId(config: LreTestExecutionConfig): Promise<number> {
        if (!config.autoTestInstance && config.testInstanceId && config.testInstanceId > 0) {
            this.logger.info(
                `Manual test instance selected: ${config.testInstanceId}`
            );
            return config.testInstanceId;
        }

        this.logger.info(
            `Auto-resolving test instance for test ${config.testId}...`
        );

        const instances = await this.client.getTestInstances(config.testId);
        const list = instances?.TestInstancesList ?? [];

        if (list.length > 0) {
            const chosen = list[list.length - 1];
            this.logger.info(
                `Found existing test instance ID: ${chosen.TestInstanceID}`
            );
            return chosen.TestInstanceID;
        }

        // No instances exist — look for an available test set
        this.logger.info(
            'No test instances found — searching for an available test set...'
        );
        const testSets = await this.client.getTestSets();
        const sets = testSets?.TestSetsList ?? [];

        let targetSetId: number;

        if (sets.length > 0) {
            targetSetId = sets[sets.length - 1].TestSetID;
            this.logger.info(`Using existing test set ID: ${targetSetId}`);
        } else {
            // No test sets exist — auto-create a folder + test set.
            this.logger.info(
                'No test sets found — attempting to create a test set automatically...'
            );
            targetSetId = await this.provisionTestSet(config.testId);
        }

        this.logger.info(
            `Creating test instance for test ${config.testId} ` +
            `in test set ${targetSetId}...`
        );

        const newId = await this.client.createTestInstance(
            config.testId,
            targetSetId
        );

        if (!newId) {
            throw new Error(
                `Failed to create a test instance for test ${config.testId} ` +
                `in test set ${targetSetId}.`
            );
        }

        this.logger.info(`Created test instance ID: ${newId}`);
        return newId;
    }

    /**
     * Creates a test set folder (if none exist) and a test set inside it.
     * Returns the ID of the newly created test set.
     *
     * Folder name: "CI Test Sets"
     * Test set name: "CI Test Set <testId>"
     *
     * NOTE: The LRE API forbids creating a test set directly under the
     * built-in "Root" or "Unattached" folders — a user-created folder is
     * required.  We therefore:
     *   a) strip those two system folders from the list before searching,
     *   b) reuse the "CI Test Sets" folder if it already exists, and
     *   c) create it only when no matching user folder is found.
     */
    private async provisionTestSet(testId: number): Promise<number> {
        const DEFAULT_FOLDER_NAME = 'CI Test Sets';
        const DEFAULT_TESTSET_NAME = `CI Test Set ${testId}`;

        // System folders that cannot host test sets (case-insensitive guard).
        // Note: test set FOLDERS can be created under Root, but test SETS cannot.
        const SYSTEM_FOLDER_NAMES = new Set(['root', 'unattached']);

        // 1. Resolve test set folder ─────────────────────────────────────────
        let folderId: number | undefined;

        const folders = await this.client.getTestSetFolders();
        const allFolders = folders?.TestSetFoldersList ?? [];

        // Find the Root folder — we need its ID as the parent when creating a new folder.
        // Root folder has TestSetFolderId = 0 (which is falsy!), so use null-check not truthy-check.
        const rootFolder = allFolders.find(
            f => (f.TestSetFolderName ?? '').toLowerCase() === 'root'
        );
        const rootFolderId: number = rootFolder?.TestSetFolderId != null ? rootFolder.TestSetFolderId : 0;
        this.logger.info(`Root test set folder ID: ${rootFolderId}`);

        // Exclude system folders — the API rejects test SET creation under them,
        // but we can create test set FOLDERS under Root.
        const userFolders = allFolders.filter(
            f => !SYSTEM_FOLDER_NAMES.has((f.TestSetFolderName ?? '').toLowerCase())
        );

        // Prefer a folder that already carries our well-known name.
        const existingCiFolder = userFolders.find(
            f => f.TestSetFolderName === DEFAULT_FOLDER_NAME
        );

        if (existingCiFolder) {
            // TestSetFolderId can be 0 (Root), so check for null/undefined not falsy
            const id = existingCiFolder.TestSetFolderId;
            if (id != null) {
                folderId = id;
                this.logger.info(
                    `Reusing existing test set folder "${DEFAULT_FOLDER_NAME}" (ID: ${folderId})`
                );
            } else {
                this.logger.info(
                    `Folder "${DEFAULT_FOLDER_NAME}" found but ID could not be parsed — ` +
                    `will create a new folder. Check ##[debug] logs for raw XML.`
                );
            }
        }

        if (folderId == null) {
            // Create folder under Root (parentFolderId = rootFolderId).
            this.logger.info(
                `Creating test set folder "${DEFAULT_FOLDER_NAME}" under Root (ID: ${rootFolderId})` +
                (userFolders.length > 0 ? ` — ${userFolders.length} other user folder(s) exist` : '') + '...'
            );
            folderId = await this.client.createTestSetFolder(DEFAULT_FOLDER_NAME, rootFolderId) ?? undefined;
            // createTestSetFolder returns null on failure, and a number (possibly 0) on success.
            if (folderId == null) {
                throw new Error(
                    `Failed to create test set folder "${DEFAULT_FOLDER_NAME}". ` +
                    'Please create a test set folder manually in the LRE UI and re-run the task.'
                );
            }
            this.logger.info(`Created test set folder "${DEFAULT_FOLDER_NAME}" (ID: ${folderId})`);
        }

        // 2. Create test set ──────────────────────────────────────────────────
        this.logger.info(
            `Creating test set "${DEFAULT_TESTSET_NAME}" ` +
            `in folder ${folderId}...`
        );
        const testSetId = await this.client.createTestSet(DEFAULT_TESTSET_NAME, folderId!);
        if (testSetId == null) {
            throw new Error(
                `Failed to create test set "${DEFAULT_TESTSET_NAME}" in folder ${folderId}. ` +
                'Please create a test set manually in the LRE UI and re-run the task.'
            );
        }

        this.logger.info(`Created test set ID: ${testSetId}`);
        return testSetId;
    }

    /**
     * If trending === 'AssociatedTrend', fetches the test data and overwrites
     * trendReportId with the test's configured automatic trending report ID.
     * Mirrors SetCorrectTrendReportID() from PCClient.cs.
     */
    private async resolveAssociatedTrendReport(config: LreTestExecutionConfig): Promise<{
        updatedConfig: LreTestExecutionConfig;
        resolvedTrendReportId: number | undefined;
    }> {
        if (config.trending !== 'AssociatedTrend') {
            return {
                updatedConfig: config,
                resolvedTrendReportId:
                    config.trending === 'UseTrendReportID' ? config.trendReportId : undefined
            };
        }

        this.logger.info(
            'Resolving associated trend report from test configuration...'
        );
        const lreTest = await this.client.getTest(config.testId);

        if (!lreTest?.ReportId || lreTest.ReportId <= 0) {
            this.logger.warn(
                'No trend report is associated with this test. ' +
                'Enable Automatic Trending in the LRE UI, or use ' +
                '"Add run to trend report with ID" instead. Trending disabled for this run.'
            );
            return {
                updatedConfig: { ...config, trending: 'DoNotTrend', trendReportId: undefined },
                resolvedTrendReportId: undefined
            };
        }

        this.logger.info(`Associated trend report ID: ${lreTest.ReportId}`);
        return {
            updatedConfig: { ...config, trendReportId: lreTest.ReportId },
            resolvedTrendReportId: lreTest.ReportId
        };
    }

    /**
     * Starts the run, retrying if configured and the initial attempt fails.
     * Mirrors the retry loop in PCClient.cs StartRun().
     */
    private async startRunWithRetry(
        config: LreTestExecutionConfig,
        testInstanceId: number
    ): Promise<LreRunResponse | null> {
        const maxAttempts =
            config.timeslotRepeat === 'RepeatWithParameters'
                ? Math.max(2, config.timeslotRepeatAttempts ?? 2)
                : 1;
        const delayMinutes = Math.max(1, config.timeslotRepeatDelay ?? 1);
        const delayMs      = delayMinutes * 60 * 1000;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            this.logger.info(
                `Starting run for test ${config.testId}, ` +
                `instance ${testInstanceId} ` +
                `(attempt ${attempt}/${maxAttempts})...`
            );

            const response = await this.client.startRun(
                config.testId,
                testInstanceId,
                { Minutes: config.timeslotDurationMinutes },
                config.postRunAction,
                config.useVuds
            );

            if (response) {
                return response;
            }

            if (attempt < maxAttempts) {
                this.logger.warn(
                    `Timeslot creation failed. ` +
                    `Waiting ${delayMinutes} minute(s) before attempt ${attempt + 1}...`
                );
                await this.sleep(delayMs);
            } else {
                this.logger.error(
                    `All ${maxAttempts} timeslot creation attempt(s) failed.`
                );
            }
        }

        return null;
    }

    /** Fetches the event log and emits any records newer than lastSeenId. */
    private async streamNewEventLogs(
        runId: number,
        lastSeenId: number
    ): Promise<number> {
        try {
            const eventLog = await this.client.getRunEventLog(runId);
            const records  = eventLog?.RecordsList ?? [];
            let maxSeen    = lastSeenId;

            for (const record of records) {
                if (record.ID > lastSeenId) {
                    this.logger.info(
                        `[EventLog] [${record.Time}] ${record.Type}: ${record.Description}`
                    );
                    this.options.onEventLogRecord?.(record);
                    if (record.ID > maxSeen) maxSeen = record.ID;
                }
            }

            return maxSeen;
        } catch (e) {
            // Event-log streaming is best-effort; never fail the run because of it.
            this.logger.warn(`Event-log streaming error (ignored): ${e instanceof Error ? e.message : String(e)}`);
            return lastSeenId;
        }
    }

    private buildResult(
        runId: number,
        finalRun: LreRunResponse,
        useSlaStatus: boolean,
        resolvedTrendReportId?: number
    ): LreExecutionResult {
        const base = { runId, finalState: finalRun.RunState, runSlaStatus: finalRun.RunSLAStatus, resolvedTrendReportId };

        if (LreTestRunner.FAILURE_STATES.has(finalRun.RunState)) {
            return {
                ...base,
                success: false,
                message: `Run ended in failure state: ${finalRun.RunState}`
            };
        }

        if (useSlaStatus && finalRun.RunSLAStatus && finalRun.RunSLAStatus !== 'Passed') {
            return {
                ...base,
                success: false,
                message: `Run completed but SLA check did not pass: ${finalRun.RunSLAStatus}`
            };
        }

        return {
            ...base,
            success: true,
            message: `Run ${runId} completed successfully (state: ${finalRun.RunState})`
        };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
    }
}
