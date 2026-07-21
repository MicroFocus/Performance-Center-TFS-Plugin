/**
 * Logger — shared utility used by both LreCiTask and LreWorkspaceSyncTask.
 *
 * Accepts two constructor forms for backward compatibility:
 *   new Logger(artifactsDir)          — sync-task style (timestamped filename)
 *   new Logger({ logDirectory, ... }) — CI-task style   (named filename)
 *
 * Public API (superset of both original loggers):
 *   log() / info()       — informational message
 *   warn() / warning()   — warning (forwarded to tl.warning)
 *   error()              — error   (forwarded to tl.error)
 *   debug()              — debug   (forwarded to tl.debug)
 *   close()              — no-op; kept for backward compat (was a WriteStream close)
 *   getLogFilePath()     — returns the log-file path if one was opened
 */

import * as fs   from 'fs';
import * as path from 'path';
import * as tl   from 'azure-pipelines-task-lib/task';

export interface LoggerOptions {
    /** Directory to write the log file into. */
    logDirectory?: string;
    /** File name inside logDirectory. Defaults to 'LreCiTask.log'. */
    logFileName?: string;
    /** Whether to echo to the ADO console. Default true. */
    echoToConsole?: boolean;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
    private readonly logFilePath?: string;
    private readonly echoToConsole: boolean;

    /**
     * @param dirOrOptions  string → artifact dir (sync-task style, timestamped log filename)
     *                      LoggerOptions → options object (CI-task style, named log filename)
     *                      undefined → console-only, no file
     */
    constructor(dirOrOptions?: string | LoggerOptions) {
        if (typeof dirOrOptions === 'string') {
            // LreWorkspaceSyncTask compat: bare string = artifacts directory
            this.echoToConsole = true;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName   = `lre_workspace_sync_${timestamp}.log`;
            this.logFilePath = this.openLog(dirOrOptions, fileName);
        } else {
            this.echoToConsole = dirOrOptions?.echoToConsole ?? true;
            if (dirOrOptions?.logDirectory) {
                const fileName   = dirOrOptions.logFileName ?? 'LreCiTask.log';
                this.logFilePath = this.openLog(dirOrOptions.logDirectory, fileName);
            }
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Informational message (alias used by LreWorkspaceSyncTask). */
    log(message: string): void     { this.write('info',  message); }
    info(message: string): void    { this.write('info',  message); }
    debug(message: string): void   { this.write('debug', message); }
    warn(message: string): void    { this.write('warn',  message); }
    /** Warning alias used by LreWorkspaceSyncTask. */
    warning(message: string): void { this.write('warn',  message); }
    error(message: string): void   { this.write('error', message); }

    /** No-op — kept for backward compatibility (previously closed a WriteStream). */
    close(): void {}

    getLogFilePath(): string | undefined { return this.logFilePath; }

    // ── Private helpers ───────────────────────────────────────────────────────

    private write(level: LogLevel, message: string): void {
        const ts   = new Date().toISOString();
        const line = `[${ts}] ${message}`;

        if (this.echoToConsole) {
            switch (level) {
                case 'debug': tl.debug(message);              break;
                case 'info':  console.log(line);              break;
                case 'warn':  tl.warning(message);            break;
                case 'error': tl.error(message);              break;
            }
        }

        if (this.logFilePath) {
            const fileLine = level === 'error' ? `[${ts}] ERROR: ${message}`
                           : level === 'warn'  ? `[${ts}] WARNING: ${message}`
                           : line;
            try {
                fs.appendFileSync(this.logFilePath, fileLine + '\n', { encoding: 'utf8' });
            } catch {
                // Never let a logging failure crash the task.
            }
        }
    }

    private openLog(dir: string, fileName: string): string | undefined {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            return path.join(dir, fileName);
        } catch (e) {
            tl.warning(`Logger: could not create log file in "${dir}": ${e instanceof Error ? e.message : String(e)}`);
            return undefined;
        }
    }
}

