/**
 * LreWorkspaceSyncRunner
 *
 * Orchestrates the full workspace sync workflow:
 *  1. Authenticate with the Enterprise Performance Engineering server
 *  2. Scan workspace directory for script folders
 *  3. Upload script folders in parallel (configurable concurrency, default 1)
 *  4. Report summary and logout
 *
 * Parallel safety:
 *  - A single shared LreScriptUploader (one HTTP session / CookieJar) is used.
 *    Node.js is single-threaded so concurrent async requests through one axios
 *    instance are inherently safe.
 *  - Each upload task buffers its own log lines and flushes them atomically
 *    when the upload completes, so console output never interleaves.
 *  - ZipFolderCompressor is stateless per call — safe to use concurrently.
 *
 * Resilience:
 *  - Fails early if MAX_CONSECUTIVE_FAILURES (5) is reached.
 *  - Succeeds overall if the success rate meets or exceeds successThreshold%.
 *    Default threshold is 50%.  0 = pass even with zero successes (auth failure
 *    still aborts).  100 = fail if even one script fails.
 */

import { LreSyncConfig, ScriptFolder, UploadResult } from '../models';
import { Logger } from '../../shared/utils/Logger';
import { WorkspaceScriptFolderScanner } from '../scanner/WorkspaceScriptFolderScanner';
import { ZipFolderCompressor } from './ZipFolderCompressor';
import { ILogSink, LreScriptUploader } from './LreScriptUploader';
import * as fs from 'fs';

const DEFAULT_CONCURRENCY        = 1;
const DEFAULT_SUCCESS_THRESHOLD  = 50; // percent
const MAX_CONSECUTIVE_FAILURES   = 5;

/**
 * Collects log lines for one upload and flushes them atomically.
 * Implements ILogSink so it can be passed directly to uploadScript() —
 * this ensures all retry messages appear inside the script's own log block
 * rather than scattered among concurrent uploads in the surrounding output.
 */
class UploadBuffer implements ILogSink {
    private lines: string[] = [];
    log(msg: string): void     { this.lines.push(msg); }
    warning(msg: string): void { this.lines.push(`WARN: ${msg}`); }
    error(msg: string): void   { this.lines.push(`ERROR: ${msg}`); }
    debug(msg: string): void   { this.lines.push(`DEBUG: ${msg}`); }
    flush(logger: Logger): void {
        for (const line of this.lines) {
            if (line.startsWith('ERROR: ')) {
                logger.error(line.slice(7));
            } else if (line.startsWith('WARN: ')) {
                logger.warning(line.slice(6));
            } else if (line.startsWith('DEBUG: ')) {
                logger.debug(line.slice(7));
            } else {
                logger.log(line);
            }
        }
    }
}

export class LreWorkspaceSyncRunner {
    private scanner: WorkspaceScriptFolderScanner;
    private compressor: ZipFolderCompressor;
    private uploader: LreScriptUploader;

    constructor(
        private config: LreSyncConfig,
        private logger: Logger,
        private concurrency: number = DEFAULT_CONCURRENCY,
        private successThreshold: number = DEFAULT_SUCCESS_THRESHOLD
    ) {
        this.scanner   = new WorkspaceScriptFolderScanner(logger);
        this.compressor = new ZipFolderCompressor(logger);
        this.uploader  = new LreScriptUploader(config, logger);
    }

    async run(): Promise<boolean> {
        this.logger.log(`Starting workspace sync from: ${this.config.workspaceDir}`);
        this.logger.log(`Target: ${this.config.serverUrl} | Domain: ${this.config.domain} | Project: ${this.config.project}`);
        this.logger.log(`Runtime only: ${this.config.runtimeOnly}`);
        this.logger.log(`Parallel uploads: ${this.concurrency}`);
        this.logger.log(`Success threshold: ${this.successThreshold}%`);

        const loggedIn = await this.uploader.authenticate();
        if (!loggedIn) {
            this.logger.error('Authentication failed. Aborting workspace sync.');
            return false;
        }

        try {
            const scriptFolders = this.scanner.findScriptFolders(this.config.workspaceDir);

            if (scriptFolders.length === 0) {
                this.logger.log('No script folders found in workspace. Nothing to upload.');
                return true;
            }

            this.logger.log(`Found ${scriptFolders.length} script folder(s) to upload (concurrency: ${this.concurrency}).`);

            // Ensure all unique subject paths exist in the test plan BEFORE
            // starting parallel uploads. This is done sequentially to avoid races
            // when multiple workers would try to create the same folder.
            const uniquePaths = [...new Set(scriptFolders.map(f => f.subjectPath))];
            this.logger.log(`Ensuring ${uniquePaths.length} test plan folder path(s) exist...`);
            for (const subjectPath of uniquePaths) {
                await this.uploader.ensureTestPlanFolderExists(subjectPath);
            }
            this.logger.log(`Folder check complete. Starting uploads...`);

            return await this.processUploads(scriptFolders);
        } finally {
            await this.uploader.logout();
        }
    }

    // ── Parallel worker pool ──────────────────────────────────────────────────

    private async processUploads(scriptFolders: ScriptFolder[]): Promise<boolean> {
        const total    = scriptFolders.length;
        const results: UploadResult[] = new Array(total);

        // Shared mutable state — safe because Node.js is single-threaded
        let nextIndex = 0;
        let consecutiveFailures = 0;
        let aborted = false;
        let abortMessagePrinted = false;

        // Spin up `concurrency` workers; each pulls from the shared queue
        const workers = Array.from(
            { length: Math.min(this.concurrency, total) },
            async () => {
                while (true) {
                    if (aborted) break;

                    const i = nextIndex++;
                    if (i >= total) break;

                    const folder = scriptFolders[i]!;
                    const buf    = new UploadBuffer();

                    buf.log(`\n--- Script ${i + 1} of ${total}: ${folder.folderName} ---`);
                    buf.log(`  Full path:    ${folder.fullPath}`);
                    buf.log(`  Subject path: ${folder.subjectPath}`);

                    const result = await this.uploadOneScript(folder, buf);
                    results[i]   = result;

                    // Flush this upload's log atomically — no interleaving
                    buf.flush(this.logger);

                    if (!result.success) {
                        consecutiveFailures++;
                        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !abortMessagePrinted) {
                            const uploaded = results.filter(r => r?.success).length;
                            this.logger.error(
                                `Upload terminated: ${MAX_CONSECUTIVE_FAILURES} consecutive failures. ` +
                                `${uploaded} of ${total} scripts uploaded so far.`
                            );
                            abortMessagePrinted = true;
                            aborted = true;
                            break;
                        }
                    } else {
                        consecutiveFailures = 0;
                    }
                }
            }
        );

        await Promise.all(workers);

        // Consecutive-failure abort always fails regardless of threshold
        if (aborted) return false;

        const totalFailures     = results.filter(r => !r?.success).length;
        const successfulUploads = total - totalFailures;
        const successRate       = successfulUploads / total;         // 0..1
        const thresholdRate     = this.successThreshold / 100;       // 0..1

        if (successRate >= thresholdRate) {
            this.logger.log(
                `\nWorkspace sync completed: ${successfulUploads} of ${total} scripts uploaded successfully` +
                ` (threshold: ${this.successThreshold}%).`
            );
            return true;
        } else {
            this.logger.error(
                `Workspace sync failed: Only ${successfulUploads} of ${total} scripts ` +
                `uploaded successfully (${Math.round(successRate * 100)}% < threshold ${this.successThreshold}%).`
            );
            return false;
        }
    }

    private async uploadOneScript(folder: ScriptFolder, buf: UploadBuffer): Promise<UploadResult> {
        let zipPath: string | null = null;
        try {
            buf.log(`  Compressing folder...`);
            zipPath = this.compressor.compressFolder(folder);
            buf.log(`  Zip size: ${getFileSizeKb(zipPath)} KB`);

            buf.log(`  Uploading to ${folder.subjectPath}...`);
            const scriptId = await this.uploader.uploadScript(
                zipPath,
                folder.subjectPath,
                this.config.runtimeOnly,
                buf   // ← all per-attempt retry messages are captured in the buffer
                      //   and flushed atomically below, keeping them in context
            );

            if (scriptId === 0) {
                buf.error(`  ✗ Upload failed — all retry attempts exhausted`);
                return { scriptFolder: folder, success: false, error: 'Upload failed after all retries' };
            }

            buf.log(`  \u2713 Script ID: ${scriptId}`);
            return { scriptFolder: folder, success: true, scriptId };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            buf.error(`  Upload failed for ${folder.folderName}: ${msg}`);
            return { scriptFolder: folder, success: false, error: msg };
        } finally {
            if (zipPath) {
                this.compressor.deleteTempZip(zipPath);
            }
        }
    }
}

function getFileSizeKb(filePath: string): string {
    try {
        return (fs.statSync(filePath).size / 1024).toFixed(1);
    } catch {
        return '?';
    }
}
