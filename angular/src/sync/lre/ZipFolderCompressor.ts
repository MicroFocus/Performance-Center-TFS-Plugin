/**
 * ZipFolderCompressor
 *
 * Compresses a script folder into a zip file using adm-zip.
 * The zip contains all files/subdirectories from the script folder root.
 * Zip is written to the system temp directory with a unique name.
 *
 * Port of the Java ZipFolderCompressor.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import { Logger } from '../../shared/utils/Logger';
import { ScriptFolder } from '../models';

export class ZipFolderCompressor {
    constructor(private logger: Logger) {}

    /**
     * Compresses the given script folder into a zip file.
     * @returns absolute path to the created zip file
     */
    compressFolder(scriptFolder: ScriptFolder): string {
        const zip = new AdmZip();
        this.addFolderContents(zip, scriptFolder.fullPath, '');

        // Use a uniquely-named subdirectory so the zip filename is exactly the
        // script name (e.g. VsCodeTemplate.zip) and the LRE server names the
        // script correctly.  Without this, form-data would derive the filename
        // from the temp file path (lre_sync_<ts>_VsCodeTemplate.zip) and the
        // server would use that mangled string as the script name.
        const tempSubDir = path.join(os.tmpdir(), `lre_sync_${Date.now()}`);
        fs.mkdirSync(tempSubDir, { recursive: true });
        const zipPath = path.join(tempSubDir, scriptFolder.zipFileName);
        zip.writeZip(zipPath);

        const stats = fs.statSync(zipPath);
        this.logger.debug(`Created zip: ${zipPath} (${stats.size} bytes)`);
        return zipPath;
    }

    private addFolderContents(zip: AdmZip, folderPath: string, zipPrefix: string): void {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullEntryPath = path.join(folderPath, entry.name);
            if (entry.isDirectory()) {
                const newPrefix = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
                this.addFolderContents(zip, fullEntryPath, newPrefix);
            } else if (entry.isFile()) {
                const zipEntryName = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
                zip.addFile(zipEntryName, fs.readFileSync(fullEntryPath));
            }
        }
    }

    /**
     * Safely deletes a temporary zip file.
     */
    deleteTempZip(zipPath: string): void {
        try {
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
                this.logger.debug(`Deleted temp zip: ${zipPath}`);
            }
            // Remove the unique subdirectory created by compressFolder
            const subDir = path.dirname(zipPath);
            if (subDir !== os.tmpdir() && fs.existsSync(subDir)) {
                fs.rmdirSync(subDir);
                this.logger.debug(`Deleted temp dir: ${subDir}`);
            }
        } catch (e) {
            this.logger.warning(`Failed to delete temp zip ${zipPath}: ${e}`);
        }
    }
}

