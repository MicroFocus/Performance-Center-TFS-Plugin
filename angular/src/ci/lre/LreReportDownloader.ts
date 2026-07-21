/**
 * LreReportDownloader — wraps LreClient download calls with logging and
 * extraction via ArtifactManager.
 * Mirrors PublishRunReport() and DownloadTrendReportAsPdf() from PCClient.cs.
 */

import * as path from 'path';
import { LreClient } from './LreClient';
import { ArtifactManager } from '../utils/ArtifactManager';
import { Logger } from '../../shared/utils/Logger';

export interface DownloadRunResultsOptions {
    /** Whether to extract each downloaded ZIP. Default true. */
    extractZips?: boolean;
    /** Whether to keep the original ZIP after extraction. Default true. */
    keepZipFiles?: boolean;
    /** Number of retry attempts if no results found initially. Default 0 (no retry). */
    retryAttempts?: number;
    /** Delay between retry attempts in milliseconds. Default 2000. */
    retryDelayMs?: number;
}

export interface RunResultDownload {
    resultId: number;
    name: string;
    filePath: string;
    /** Path to extracted directory (only set when extractZips is true and download succeeded). */
    extractedPath?: string;
    downloaded: boolean;
}

export class LreReportDownloader {
    constructor(
        private readonly client: LreClient,
        private readonly logger: Logger
    ) {}

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Downloads report artifacts for the given runId into artifactsDir:
     * - Analysis HTML report archive (Reports.zip)
     * - Optional NV report artifact (if present)
     * Supports retries if results are not yet available.
     */
    async downloadRunResults(
        runId: number,
        artifactsDir: string,
        options: DownloadRunResultsOptions = {}
    ): Promise<RunResultDownload[]> {
        const extractZips    = options.extractZips  ?? true;
        const keepZipFiles   = options.keepZipFiles ?? true;
        const retryAttempts  = options.retryAttempts ?? 0;
        const retryDelayMs   = options.retryDelayMs ?? 2000;

        ArtifactManager.ensureDirectory(artifactsDir);

        let runResults = await this.client.getRunResults(runId);
        const list = runResults?.ResultsList ?? [];

        // If no results found and retries are configured, wait and retry
        if (!list.length && retryAttempts > 0) {
            for (let attempt = 1; attempt <= retryAttempts; attempt++) {
                this.logger.info(
                    `No run results found yet (attempt ${attempt}/${retryAttempts}). ` +
                    `Retrying in ${retryDelayMs}ms...`
                );
                await this.sleep(retryDelayMs);
                runResults = await this.client.getRunResults(runId);
                const retryList = runResults?.ResultsList ?? [];
                if (retryList.length > 0) {
                    this.logger.info(`Found results on retry attempt ${attempt}.`);
                    // Continue with the newly found results
                    runResults = { ResultsList: retryList };
                    break;
                }
            }
        }

        const finalList = runResults?.ResultsList ?? [];

        if (!finalList.length) {
            this.logger.warn(`No run results found for run ${runId}.`);
            return [];
        }

        // Mirror legacy .NET behavior for analysis report naming (Reports.zip),
        // and include NV report artifact when present.
        const reportResults = finalList.filter(r => this.shouldDownloadResult(r.Name));

        if (!reportResults.length) {
            this.logger.warn(
                `No matching report artifacts found for run ${runId} ` +
                `(expected Reports.zip and optional NV report).`
            );
            return [];
        }

        const downloads: RunResultDownload[] = [];

        for (const result of reportResults) {
            const safeName = this.sanitizeFileName(result.Name ?? `result_${result.ID}`);
            const hasZipExtension = path.extname(safeName).toLowerCase() === '.zip';
            const outputFileName = hasZipExtension
                ? `run${runId}_${result.ID}_${this.stripExistingExtension(safeName)}.zip`
                : `run${runId}_${result.ID}_${safeName}`;
            const outputPath = path.join(artifactsDir, outputFileName);

            this.logger.info(
                `Downloading result ${result.ID} "${result.Name}" for run ${runId}...`
            );

            const downloaded = await this.client.downloadRunResultData(
                runId,
                result.ID,
                outputPath
            );

            const item: RunResultDownload = {
                resultId: result.ID,
                name: result.Name,
                filePath: outputPath,
                downloaded
            };

            if (downloaded) {
                this.logger.info(`Downloaded to ${outputPath}`);

                if (extractZips && hasZipExtension) {
                    const extractDir = path.join(
                        artifactsDir,
                        `run${runId}_${result.ID}_${this.stripExistingExtension(safeName)}`
                    );
                    try {
                        ArtifactManager.extractZip(outputPath, extractDir);
                        item.extractedPath = extractDir;
                        this.logger.info(`Extracted to ${extractDir}`);
                    } catch (e) {
                        this.logger.warn(
                            `Failed to extract ${outputPath}: ` +
                            `${e instanceof Error ? e.message : String(e)}`
                        );
                    }

                    if (!keepZipFiles) {
                        ArtifactManager.deleteFileIfExists(outputPath);
                        this.logger.info(`Deleted zip: ${outputPath}`);
                    }
                }
            } else {
                this.logger.warn(
                    `Failed to download result ${result.ID} "${result.Name}".`
                );
            }

            downloads.push(item);
        }

        return downloads;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Downloads the trend report PDF for the given report/run combination.
     * Returns the local file path on success, undefined on failure.
     * Supports retries if PDF is not yet available.
     */
    async downloadTrendPdf(
        trendReportId: number,
        runId: number,
        artifactsDir: string,
        retryAttempts: number = 2,
        retryDelayMs: number = 3000
    ): Promise<string | undefined> {
        ArtifactManager.ensureDirectory(artifactsDir);

        const pdfPath = path.join(
            artifactsDir,
            `trendReport_${trendReportId}_run${runId}.pdf`
        );

        this.logger.info(
            `Downloading trend report ${trendReportId} PDF for run ${runId}...`
        );

        let ok = await this.client.downloadTrendReportPDF(
            trendReportId,
            runId,
            pdfPath
        );

        // If download failed and retries are configured, wait and retry
        if (!ok && retryAttempts > 0) {
            for (let attempt = 1; attempt <= retryAttempts; attempt++) {
                this.logger.info(
                    `Trend PDF not ready yet (attempt ${attempt}/${retryAttempts}). ` +
                    `Retrying in ${retryDelayMs}ms...`
                );
                await this.sleep(retryDelayMs);
                ok = await this.client.downloadTrendReportPDF(
                    trendReportId,
                    runId,
                    pdfPath
                );
                if (ok) {
                    this.logger.info(`Trend PDF downloaded on retry attempt ${attempt}.`);
                    break;
                }
            }
        }

        if (!ok) {
            this.logger.warn(
                `Failed to download trend PDF for report ${trendReportId}.`
            );
            return undefined;
        }

        this.logger.info(`Trend PDF downloaded to ${pdfPath}`);
        return pdfPath;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private sanitizeFileName(name: string): string {
        const sanitized = Array.from(name, (character) => {
            const codePoint = character.charCodeAt(0);
            const isReservedCharacter = '<>:"/\\|?*'.includes(character);
            const isControlCharacter = codePoint >= 0 && codePoint <= 31;

            return isReservedCharacter || isControlCharacter ? '_' : character;
        }).join('');

        return sanitized.replace(/\s+/g, '_');
    }

    private shouldDownloadResult(name: string | undefined): boolean {
        const raw = (name ?? '').trim();
        if (!raw) return false;

        const lower = raw.toLowerCase();

        // Legacy .NET code downloads only "Reports.zip" for analysis HTML.
        if (lower === 'reports.zip') {
            return true;
        }

        // Optional NV artifacts are not always generated; keep when present.
        // Match common naming variants while avoiding unrelated files.
        return lower.includes('network virtualization') ||
            lower.includes('network_virtualization') ||
            lower.includes('network-virtualization') ||
            lower.includes('nv report') ||
            lower.startsWith('nv_') ||
            lower.startsWith('nv-') ||
            lower.startsWith('nv.');
    }

    private stripExistingExtension(name: string): string {
        const parsed = path.parse(name);
        return parsed.ext ? parsed.name : name;
    }
}
