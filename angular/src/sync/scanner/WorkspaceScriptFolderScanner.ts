/**
 * WorkspaceScriptFolderScanner
 *
 * Walks a git workspace directory and identifies folders that are Enterprise Performance Engineering scripts.
 * Detection rules (port of the Java WorkspaceScriptFolderScanner):
 *  - A folder containing at least one file ending in .usr, .jmx, .scala, or .java
 *    is treated as a script folder.
 *  - A folder containing both main.js AND rts.yml (case-insensitive) is a DevWeb script.
 *  - Once a script folder is identified, its subtree is pruned (not recursed into).
 *
 * Subject path logic (matches Java LreSubjectPathBuilder + ScriptFolder):
 *  - Scripts directly under workspace root:
 *      relativePath = folderName, subjectPath = Subject\folderName
 *  - Scripts in subdirectory:
 *      relativePath = relative path from root to script's parent folder
 *      subjectPath  = Subject\<relativePath>
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../shared/utils/Logger';
import { ScriptFolder } from '../models';

const SCRIPT_EXTENSIONS = new Set(['.usr', '.jmx', '.scala', '.java']);
const DEVWEB_MAIN_FILE = 'main.js';
const DEVWEB_RTS_FILE = 'rts.yml';

export class WorkspaceScriptFolderScanner {
    constructor(private logger: Logger) {}

    /**
     * Recursively scans workspaceRoot and returns all identified script folders.
     */
    findScriptFolders(workspaceRoot: string): ScriptFolder[] {
        const absRoot = path.resolve(workspaceRoot);
        if (!fs.existsSync(absRoot) || !fs.statSync(absRoot).isDirectory()) {
            this.logger.error(`Workspace directory does not exist or is not a directory: ${absRoot}`);
            return [];
        }
        const results: ScriptFolder[] = [];
        this.scanFolder(absRoot, absRoot, results);
        return results;
    }

    private scanFolder(folder: string, workspaceRoot: string, results: ScriptFolder[]): void {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(folder, { withFileTypes: true });
        } catch (e) {
            this.logger.warning(`Cannot read directory ${folder}: ${e}`);
            return;
        }

        let containsExtensionScript = false;
        let hasDevWebMain = false;
        let hasDevWebRts = false;
        const subFolders: string[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                subFolders.push(path.join(folder, entry.name));
                continue;
            }
            if (entry.isFile()) {
                const lower = entry.name.toLowerCase();
                const ext = path.extname(lower);

                if (SCRIPT_EXTENSIONS.has(ext)) {
                    containsExtensionScript = true;
                }
                if (lower === DEVWEB_MAIN_FILE) {
                    hasDevWebMain = true;
                }
                if (lower === DEVWEB_RTS_FILE) {
                    hasDevWebRts = true;
                }
            }
        }

        const isDevWebScript = hasDevWebMain && hasDevWebRts;

        if (containsExtensionScript || isDevWebScript) {
            results.push(this.buildScriptFolder(folder, workspaceRoot));
            return; // prune subtree — do not recurse into script folders
        }

        // Recurse into subdirectories
        for (const sub of subFolders) {
            this.scanFolder(sub, workspaceRoot, results);
        }
    }

    private buildScriptFolder(fullPath: string, workspaceRoot: string): ScriptFolder {
        const folderName = path.basename(fullPath);
        const parentDir = path.dirname(fullPath);
        const normalizedRoot = path.resolve(workspaceRoot);
        const normalizedParent = path.resolve(parentDir);

        // Java parity:
        //   script directly in root → relativePath = folderName
        //   script nested           → relativePath = path from root to parent folder
        let relativePath: string;
        if (normalizedParent === normalizedRoot) {
            relativePath = folderName;
        } else {
            relativePath = path.relative(workspaceRoot, parentDir);
        }

        // Build subject path (always uses backslashes per server convention)
        const subjectPath = buildSubjectPath(relativePath);

        return {
            fullPath,
            relativePath,
            folderName,
            zipFileName: `${folderName}.zip`,
            subjectPath
        };
    }
}

/**
 * Converts a relative path string to a "Subject\..." path for the test plan.
 * Empty/dot path → "Subject"
 * "MyScript"     → "Subject\MyScript"
 * "scripts"      → "Subject\scripts"
 * "a/b"          → "Subject\a\b"
 */
function buildSubjectPath(relativePath: string): string {
    const SUBJECT_ROOT = 'Subject';
    if (!relativePath || relativePath === '.') {
        return SUBJECT_ROOT;
    }
    // Normalize forward slashes to backslashes (server path convention)
    const normalized = relativePath.replace(/\//g, '\\');
    return `${SUBJECT_ROOT}\\${normalized}`;
}
