/**
 * ArtifactManager — file-system helpers for the LRE task.
 * Mirrors the directory/zip/cleanup logic from lreLocalTask.ps1 and Configurator.cs.
 */

import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

export class ArtifactManager {

    /**
     * Creates the directory (and any parents) if it does not already exist.
     * Returns the directory path for chaining.
     */
    static ensureDirectory(dir: string): string {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    /**
     * Creates a sub-directory whose name follows the legacy suffix pattern:
     *   <baseDir>/<prefix>_dd.MM.yyyy_HH.mm.ss
     * (mirrors the timestamp suffix used by lreLocalTask.ps1)
     */
    static createTimestampedDirectory(baseDir: string, prefix = 'LreTest'): string {
        const now  = new Date();
        const dd   = String(now.getDate()).padStart(2, '0');
        const mm   = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const hh   = String(now.getHours()).padStart(2, '0');
        const min  = String(now.getMinutes()).padStart(2, '0');
        const ss   = String(now.getSeconds()).padStart(2, '0');
        const dir  = path.join(baseDir, `${prefix}_${dd}.${mm}.${yyyy}_${hh}.${min}.${ss}`);
        return this.ensureDirectory(dir);
    }

    /** Extracts a ZIP archive into destinationDir (creates it if needed).
     *  Validates all entry paths to prevent ZipSlip / path-traversal attacks. */
    static extractZip(zipPath: string, destinationDir: string): void {
        this.ensureDirectory(destinationDir);
        const zip = new AdmZip(zipPath);
        const resolvedDest = path.resolve(destinationDir) + path.sep;

        // Guard against ZipSlip: every entry must resolve inside destinationDir
        for (const entry of zip.getEntries()) {
            const entryResolved = path.resolve(path.join(resolvedDest, entry.entryName));
            if (!entryResolved.startsWith(resolvedDest)) {
                throw new Error(
                    `ZipSlip detected: entry "${entry.entryName}" would extract outside the destination directory.`
                );
            }
        }

        zip.extractAllTo(destinationDir, /* overwrite */ true);
    }

    /** Deletes a single file if it exists. Silently ignores errors. */
    static deleteFileIfExists(filePath: string): void {
        try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            // best-effort — log but do not propagate
            console.warn(`ArtifactManager: could not delete "${filePath}": ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    /**
     * Removes the temp ".previouslyRead" and ".duplicated" files created by
     * Configurator.cs — mirrors DeleteUnusedFilesFromArtifact().
     */
    static deleteUnusedArtifactFiles(logFullFileName: string): void {
        if (!logFullFileName) return;
        this.deleteFileIfExists(`${logFullFileName}previouslyRead`);
        this.deleteFileIfExists(`${logFullFileName}duplicated`);
    }
}
