/**
 * Logger — thin wrapper around azure-pipelines-task-lib console methods
 * that also writes every line to a log file when a directory is provided.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
    /** Directory to write the log file into. */
    logDirectory?: string;
    /** File name inside logDirectory. Defaults to 'LreCiTask.log'. */
    logFileName?: string;
    /** Whether to echo to the ADO console. Default true. */
    echoToConsole?: boolean;
}

export class Logger {
    private readonly logFilePath?: string;
    private readonly echoToConsole: boolean;

    constructor(options?: LoggerOptions) {
        this.echoToConsole = options?.echoToConsole ?? true;

        if (options?.logDirectory) {
            const fileName = options.logFileName ?? 'LreCiTask.log';
            this.logFilePath = path.join(options.logDirectory, fileName);
            this.ensureDirectory(options.logDirectory);
        }
    }

    getLogFilePath(): string | undefined { return this.logFilePath; }

    debug(message: string): void { this.write('debug', message); }
    info(message: string): void  { this.write('info',  message); }
    warn(message: string): void  { this.write('warn',  message); }
    error(message: string): void { this.write('error', message); }

    private write(level: LogLevel, message: string): void {
        const ts   = this.friendlyTimestamp();
        const tag  = level.toUpperCase().padEnd(5);
        const line = `${ts} [${tag}] ${message}`;

        if (this.echoToConsole) {
            switch (level) {
                case 'debug': tl.debug(`${ts} - ${message}`);    break;
                case 'info':  console.log(`${ts} - ${message}`); break;
                case 'warn':  tl.warning(`${ts} - ${message}`);  break;
                case 'error': tl.error(`${ts} - ${message}`);    break;
            }
        }

        if (this.logFilePath) {
            try {
                fs.appendFileSync(this.logFilePath, line + '\n', { encoding: 'utf8' });
            } catch (e) {
                // Never let a logging failure crash the task, but surface the error.
                console.error(`Logger: failed to write to log file "${this.logFilePath}": ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }

    /**
     * Returns a human-readable local timestamp with millisecond precision,
     * e.g. "2026-06-30 14:05:23.456"
     */
    private friendlyTimestamp(): string {
        const d   = new Date();
        const pad = (n: number, w = 2) => String(n).padStart(w, '0');
        return (
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
            `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
        );
    }

    private ensureDirectory(dir: string): void {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
