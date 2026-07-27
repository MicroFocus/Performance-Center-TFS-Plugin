/**
 * YamlTestParser — reads a YAML file from disk and returns a ParsedYamlTest.
 *
 * Supports two YAML shapes:
 *   1. Full-test YAML  — contains test_name, test_folder_path, test_content
 *   2. Content-only YAML — contains group[], scheduler, etc. at root level
 *      In this case test_name is derived from the file name (without extension)
 *      and test_folder_path from the directory path relative to workspaceRoot.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
    ParsedYamlTest,
    SimplifiedContent,
    SimplifiedTest
} from './SimplifiedModels';

export class YamlTestParser {

    /**
     * Parse a YAML test file.
     *
     * @param yamlFilePath  Absolute or relative path to the .yaml / .yml file.
     * @param workspaceRoot Optional root to derive the test folder path when the YAML
     *                      is content-only (no test_name / test_folder_path).
     *                      Defaults to the directory containing the YAML file.
     */
    static parseFile(yamlFilePath: string, workspaceRoot?: string): ParsedYamlTest {
        const absolutePath = path.resolve(yamlFilePath);

        if (!fs.existsSync(absolutePath)) {
            throw new Error(`YAML test file not found: ${absolutePath}`);
        }

        const raw = fs.readFileSync(absolutePath, 'utf-8');
        // Strip the sentinel comment lines (## ... ##) used in the GH action examples
        const stripped = raw.replace(/^#{2,}[^#\n]*#{2,}$/gm, '').trim();

        return this.parseString(stripped, absolutePath, workspaceRoot);
    }

    /**
     * Parse YAML content from a string.
     *
     * @param yamlContent   Raw YAML string (may be full-test or content-only format).
     * @param sourceFilePath The original file path, used to derive test name/folder
     *                       when the YAML is content-only. Optional.
     * @param workspaceRoot  Root used to compute the relative folder path.
     */
    static parseString(
        yamlContent: string,
        sourceFilePath?: string,
        workspaceRoot?: string
    ): ParsedYamlTest {
        const parsed = yaml.load(yamlContent);

        if (!parsed || typeof parsed !== 'object') {
            throw new Error('YAML content is empty or not an object');
        }

        const doc = parsed as Record<string, unknown>;

        // ── Shape 1: Full-test YAML (has test_name at root) ──────────────────
        if (this.isSimplifiedTest(doc)) {
            return this.fromSimplifiedTest(doc as unknown as SimplifiedTest);
        }

        // ── Shape 2: Content-only YAML ────────────────────────────────────────
        if (this.isSimplifiedContent(doc)) {
            const content = doc as unknown as SimplifiedContent;
            const { testName, testFolderPath } = this.deriveNameAndFolder(
                sourceFilePath,
                workspaceRoot
            );
            return this.buildResult(testName, testFolderPath, content);
        }

        throw new Error(
            'Invalid YAML structure: expected either a full-test (with test_name, test_folder_path, test_content) ' +
            'or a content-only YAML (with at least a "group" array at root level)'
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static isSimplifiedTest(doc: Record<string, unknown>): boolean {
        return (
            typeof doc['test_name'] === 'string' &&
            typeof doc['test_folder_path'] === 'string' &&
            typeof doc['test_content'] === 'object' &&
            doc['test_content'] !== null
        );
    }

    private static isSimplifiedContent(doc: Record<string, unknown>): boolean {
        return Array.isArray(doc['group']) && doc['group'].length > 0;
    }

    private static fromSimplifiedTest(st: SimplifiedTest): ParsedYamlTest {
        if (!st.test_name?.trim()) {
            throw new Error('test_name must be a non-empty string');
        }
        if (!st.test_folder_path?.trim()) {
            throw new Error('test_folder_path must be a non-empty string');
        }
        if (!st.test_content?.group?.length) {
            throw new Error('test_content.group must contain at least one group');
        }
        return this.buildResult(st.test_name.trim(), st.test_folder_path.trim(), st.test_content);
    }

    private static buildResult(
        testName: string,
        testFolderPath: string,
        content: SimplifiedContent
    ): ParsedYamlTest {
        this.validateContent(content);

        // Normalise folder separators to backslash (users may use forward slashes)
        const normalized = testFolderPath
            .replace(/\//g, '\\')
            .replace(/^Subject\\*/i, ''); // strip any leading 'Subject\' the user added

        const testFolderPathWithSubject = `Subject\\${normalized}`;

        return { testName, testFolderPath: normalized, testFolderPathWithSubject, content };
    }

    private static validateContent(content: SimplifiedContent): void {
        if (!content.group || !Array.isArray(content.group) || content.group.length === 0) {
            throw new Error('YAML content must contain at least one group');
        }

        content.group.forEach((g, idx) => {
            const label = g.group_name ? `"${g.group_name}"` : `#${idx + 1}`;
            if (!g.script_id && !g.script_path) {
                throw new Error(
                    `Group ${label}: either script_id or script_path must be provided`
                );
            }
        });
    }

    private static deriveNameAndFolder(
        sourceFilePath?: string,
        workspaceRoot?: string
    ): { testName: string; testFolderPath: string } {
        if (!sourceFilePath) {
            return { testName: 'LreTest', testFolderPath: 'Subject' };
        }

        const absoluteFile = path.resolve(sourceFilePath);
        const testName = path.basename(absoluteFile, path.extname(absoluteFile));

        const root = workspaceRoot ? path.resolve(workspaceRoot) : path.dirname(absoluteFile);
        const relDir = path.relative(root, path.dirname(absoluteFile));

        // relDir may be empty (file is directly at root), may have dots, etc.
        const parts = relDir
            .split(/[/\\]/)
            .filter(p => p && p !== '.' && p !== '..');

        const testFolderPath = parts.length > 0 ? parts.join('\\') : path.basename(path.dirname(absoluteFile));

        return { testName, testFolderPath };
    }
}

