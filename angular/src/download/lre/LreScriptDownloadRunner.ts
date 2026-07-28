/**
 * LreScriptDownloadRunner
 *
 * Orchestrates the full script-download workflow:
 *  1. Authenticate with the Enterprise Performance Engineering server
 *  2. Fetch the list of all scripts in the domain/project
 *  3. Download all scripts in parallel (configurable concurrency, default 1)
 *     Each script is saved as <name>.usz inside a local directory that mirrors
 *     the server-side test-plan path, minus the root "Subject" segment.
 *  4. Report summary and logout
 *
 * Parallel safety:
 *  - A single shared LreScriptDownloader (one HTTP session / CookieJar) is used.
 *    Node.js is single-threaded so concurrent async requests are inherently safe.
 *  - Each download task buffers its own log lines and flushes them atomically
 *    when the download completes, preventing interleaved output.
 *
 * Resilience:
 *  - Fails early if MAX_CONSECUTIVE_FAILURES (5) consecutive downloads fail.
 *  - Succeeds overall if the success rate meets or exceeds successThreshold%.
 *    Default threshold is 50%.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import AdmZip from 'adm-zip';
import { LreDownloadConfig, RemoteScript, DownloadResult } from '../models';
import { Logger } from '../../shared/utils/Logger';
import { ILogSink, LreScriptDownloader } from './LreScriptDownloader';

const DEFAULT_CONCURRENCY       = 1;
const DEFAULT_SUCCESS_THRESHOLD = 50;   // percent
const MAX_CONSECUTIVE_FAILURES  = 5;

/**
 * Collects log lines for one download and flushes them atomically to the
 * shared logger, preventing interleaved output from concurrent downloads.
 */
class DownloadBuffer implements ILogSink {
    private lines: string[] = [];
    log(msg: string): void     { this.lines.push(msg); }
    warning(msg: string): void { this.lines.push(`WARN: ${msg}`); }
    error(msg: string): void   { this.lines.push(`ERROR: ${msg}`); }
    debug(msg: string): void   { this.lines.push(`DEBUG: ${msg}`); }
    flush(logger: Logger): void {
        for (const line of this.lines) {
            if (line.startsWith('ERROR: '))       logger.error(line.slice(7));
            else if (line.startsWith('WARN: '))   logger.warning(line.slice(6));
            else if (line.startsWith('DEBUG: '))  logger.debug(line.slice(7));
            else                                   logger.log(line);
        }
    }
}

export class LreScriptDownloadRunner {
    private downloader: LreScriptDownloader;

    constructor(
        private config: LreDownloadConfig,
        private logger: Logger,
        private concurrency: number = DEFAULT_CONCURRENCY,
        private successThreshold: number = DEFAULT_SUCCESS_THRESHOLD
    ) {
        this.downloader = new LreScriptDownloader(config, logger);
    }

    async run(): Promise<boolean> {
        this.logger.log(`Starting script download to: ${this.config.workspaceDir}`);
        this.logger.log(
            `Target: ${this.config.serverUrl} | Domain: ${this.config.domain} | Project: ${this.config.project}`
        );
        this.logger.log(`Parallel downloads: ${this.concurrency}`);
        this.logger.log(`Success threshold: ${this.successThreshold}%`);

        const loggedIn = await this.downloader.authenticate();
        if (!loggedIn) {
            this.logger.error('Authentication failed. Aborting script download.');
            return false;
        }

        try {
            this.logger.log(`Fetching list of scripts from server...`);
            const scripts = await this.downloader.fetchScriptList();

            if (scripts.length === 0) {
                this.logger.log('No scripts found in the project. Nothing to download.');
                return true;
            }

            this.logger.log(
                `Found ${scripts.length} script(s) to download (concurrency: ${this.concurrency}).`
            );

            return await this.processDownloads(scripts);
        } finally {
            await this.downloader.logout();
        }
    }

    // ── Parallel worker pool ──────────────────────────────────────────────────

    private async processDownloads(scripts: RemoteScript[]): Promise<boolean> {
        const total   = scripts.length;
        const results: DownloadResult[] = new Array(total);

        let nextIndex           = 0;
        let consecutiveFailures = 0;
        let aborted             = false;
        let abortMessagePrinted = false;

        const workers = Array.from(
            { length: Math.min(this.concurrency, total) },
            async () => {
                while (true) {
                    if (aborted) break;

                    const i = nextIndex++;
                    if (i >= total) break;

                    const script = scripts[i]!;
                    const buf    = new DownloadBuffer();

                    buf.log(`\n--- Script ${i + 1} of ${total}: ${script.name} (ID: ${script.id}) ---`);
                    buf.log(`  Server path: ${script.testFolderPath}`);

                    const extractDir = this.resolveExtractDir(script);
                    buf.log(`  Extract to:  ${extractDir}`);

                    const result = await this.downloadOneScript(script, extractDir, buf);
                    results[i]   = result;

                    // Flush atomically — no interleaving with other workers
                    buf.flush(this.logger);

                    if (!result.success) {
                        consecutiveFailures++;
                        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !abortMessagePrinted) {
                            const downloaded = results.filter(r => r?.success).length;
                            this.logger.error(
                                `Download terminated: ${MAX_CONSECUTIVE_FAILURES} consecutive failures. ` +
                                `${downloaded} of ${total} scripts downloaded so far.`
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

        if (aborted) return false;

        const totalFailures       = results.filter(r => !r?.success).length;
        const successfulDownloads = total - totalFailures;
        const successRate         = successfulDownloads / total;
        const thresholdRate       = this.successThreshold / 100;

        if (successRate >= thresholdRate) {
            this.logger.log(
                `\nScript download completed: ${successfulDownloads} of ${total} scripts downloaded successfully` +
                ` (threshold: ${this.successThreshold}%).`
            );
            return true;
        } else {
            this.logger.error(
                `Script download failed: only ${successfulDownloads} of ${total} scripts downloaded` +
                ` (${Math.round(successRate * 100)}% < threshold ${this.successThreshold}%).`
            );
            return false;
        }
    }

    /**
     * Downloads a single script, extracts its content into `extractDir`,
     * and removes the temporary .usz file.
     *
     * Flow:
     *  1. Call downloader → receive raw zip Buffer
     *  2. Write Buffer to a temp .usz file in the OS temp directory
     *  3. Extract the zip into `extractDir` (created if absent)
     *  4. Delete the temp .usz file
     */
    private async downloadOneScript(
        script: RemoteScript,
        extractDir: string,
        buf: DownloadBuffer
    ): Promise<DownloadResult> {
        let tempUszPath: string | undefined;
        try {
            const data = await this.downloader.downloadScriptContent(script, buf);

            if (!data) {
                buf.error(`  ✗ Download failed — all retry attempts exhausted`);
                return { script, success: false, error: 'Download failed after all retries' };
            }

            // ── Write to temp .usz ────────────────────────────────────────────
            const tempDir = os.tmpdir();
            tempUszPath   = path.join(tempDir, `lre_download_${script.id}_${Date.now()}.usz`);
            fs.writeFileSync(tempUszPath, data);
            buf.log(`  Temp archive: ${tempUszPath} (${(data.byteLength / 1024).toFixed(1)} KB)`);

            // ── Extract to target directory ───────────────────────────────────
            if (!fs.existsSync(extractDir)) {
                fs.mkdirSync(extractDir, { recursive: true });
            }
            const zip = new AdmZip(tempUszPath);
            zip.extractAllTo(extractDir, /* overwrite */ true);

            const fileCount = zip.getEntries().length;
            buf.log(`  ✓ Extracted ${fileCount} file(s) → ${extractDir}`);

            return { script, success: true, localPath: extractDir };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            buf.error(`  Download/extract failed for ${script.name}: ${msg}`);
            return { script, success: false, error: msg };
        } finally {
            // Always remove the temp .usz file
            if (tempUszPath) {
                try { fs.unlinkSync(tempUszPath); } catch { /* ignore */ }
            }
        }
    }

    // ── Path helpers ──────────────────────────────────────────────────────────

    /**
     * Resolves the local extraction directory for a script.
     *
     * The server path always begins with "Subject\"; that root segment is
     * stripped.  A folder named after the script is created at the end of the
     * remaining sub-path under workspaceDir.
     *
     * Examples
     * ────────
     *   TestFolderPath = "Subject\folder1\SubFolder1"   name = "MyScript"
     *   → {workspaceDir}\folder1\SubFolder1\MyScript\
     *
     *   TestFolderPath = "Subject"   name = "RootScript"
     *   → {workspaceDir}\RootScript\
     */
    private resolveExtractDir(script: RemoteScript): string {
        // Normalise separators to the local OS separator
        const serverPath = script.testFolderPath.replace(/\//g, path.sep);

        // Strip the leading "Subject" segment (case-insensitive)
        const segments = serverPath.split(path.sep).filter(s => s.length > 0);
        const withoutSubject =
            segments.length > 0 && segments[0]!.toLowerCase() === 'subject'
                ? segments.slice(1)
                : segments;

        // The script's own folder is named after the script
        return path.join(this.config.workspaceDir, ...withoutSubject, script.name);
    }
}

