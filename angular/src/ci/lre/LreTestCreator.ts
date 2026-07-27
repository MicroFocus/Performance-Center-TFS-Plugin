/**
 * LreTestCreator — orchestrates the full "YAML file → LRE test ID" pipeline:
 *
 *  1. Parse the YAML file into a ParsedYamlTest.
 *  2. Resolve every group's script_path to a numeric script_id via GET /Scripts.
 *  3. Ensure the target test-plan folder hierarchy exists (POST /testplan).
 *  4. POST /tests with the full <Test> XML.
 *     • 201  → new test created; return its ID.
 *     • 409  → existing test found; PUT /tests/{id} with <Content> XML; return ID.
 *  5. Return the test ID so the caller can run it with LreTestRunner.
 */

import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { LreClient } from './LreClient';
import { YamlTestParser } from '../yaml/YamlTestParser';
import { TestContentXmlBuilder } from '../yaml/TestContentXmlBuilder';
import type { ParsedYamlTest, SimplifiedGroup } from '../yaml/SimplifiedModels';
import type { LreScript } from '../models';

export class LreTestCreator {

    constructor(private readonly client: LreClient) {}

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Full pipeline: YAML file → resolved → created/updated → test ID.
     *
     * @param yamlFilePath   Absolute or relative path to the .yaml / .yml file.
     * @param workspaceRoot  Optional workspace root used to derive the test folder path
     *                       when the YAML is content-only (no test_name / test_folder_path).
     * @returns The numeric LRE test ID, ready to be run.
     */
    async createOrUpdateFromFile(yamlFilePath: string, workspaceRoot?: string): Promise<number> {
        tl.debug(`LreTestCreator: parsing YAML file "${yamlFilePath}"`);
        const parsed = YamlTestParser.parseFile(yamlFilePath, workspaceRoot);
        return this.createOrUpdate(parsed);
    }

    /**
     * Pipeline starting from an already-parsed test (e.g. used in tests or when
     * the caller has already validated the YAML string).
     */
    async createOrUpdate(parsed: ParsedYamlTest): Promise<number> {
        // Step 1 — Resolve script paths → IDs
        const resolved = await this.resolveScriptIds(parsed);

        // Step 2 — Ensure test-plan folder exists
        tl.debug(`LreTestCreator: ensuring test plan folder "${resolved.testFolderPathWithSubject}"`);
        await this.client.ensureTestPlanFolderExists(resolved.testFolderPathWithSubject);

        // Step 3 — Check if the test already exists (avoids relying on 409 from POST
        //           since some LRE server versions return 500 for duplicate test names)
        tl.debug(`LreTestCreator: looking up existing test "${resolved.testName}" in "${resolved.testFolderPathWithSubject}"`);
        const existingId = await this.client.findTestByNameAndFolder(
            resolved.testName,
            resolved.testFolderPathWithSubject
        );

        if (existingId !== null) {
            // Test already exists — update content only
            tl.debug(`LreTestCreator: test already exists (ID=${existingId}), updating content`);
            const contentXml = TestContentXmlBuilder.buildContentXml(resolved.content);
            const updated = await this.client.updateTest(existingId, contentXml);
            if (!updated) {
                throw new Error(
                    `LreTestCreator: test ID ${existingId} already exists but content update failed`
                );
            }
            tl.debug(`LreTestCreator: test ${existingId} updated successfully`);
            return existingId;
        }

        // Step 4 — Build full XML and POST /tests to create a new test
        const testXml = TestContentXmlBuilder.buildTestXml(resolved);
        tl.debug(`LreTestCreator: POSTing test "${resolved.testName}" to folder "${resolved.testFolderPathWithSubject}"`);
        const { testId, existed } = await this.client.createTest(testXml);

        if (!existed) {
            tl.debug(`LreTestCreator: test created — ID = ${testId}`);
            return testId;
        }

        // Step 5 — 409 fallback (server returned conflict): update the existing test's content
        tl.debug(`LreTestCreator: test already exists (ID=${testId}), updating content (409 path)`);
        const contentXml = TestContentXmlBuilder.buildContentXml(resolved.content);
        const updated = await this.client.updateTest(testId, contentXml);

        if (!updated) {
            throw new Error(
                `LreTestCreator: test ID ${testId} already exists but content update failed`
            );
        }

        tl.debug(`LreTestCreator: test ${testId} updated successfully`);
        return testId;
    }

    // =========================================================================
    // Script resolution
    // =========================================================================

    /**
     * Fetches all scripts from LRE once, then resolves every group's
     * `script_path` to a `script_id`.  Groups that already have a numeric
     * `script_id` are left untouched.
     *
     * Returns a new `ParsedYamlTest` with `script_id` populated on every group.
     * Throws if any `script_path` cannot be matched.
     */
    private async resolveScriptIds(parsed: ParsedYamlTest): Promise<ParsedYamlTest> {
        const groupsNeedingResolution = parsed.content.group.filter(
            g => !g.script_id && g.script_path
        );

        if (groupsNeedingResolution.length === 0) {
            tl.debug('LreTestCreator: all groups already have script_id — skipping resolution');
            return parsed;
        }

        tl.debug(`LreTestCreator: resolving script paths for ${groupsNeedingResolution.length} group(s)`);
        const allScripts = await this.client.getScripts();

        const resolvedGroups = parsed.content.group.map(g => {
            if (g.script_id || !g.script_path) return g;

            const resolved = this.findScript(allScripts, g.script_path);
            if (!resolved) {
                throw new Error(
                    `LreTestCreator: script path "${g.script_path}" not found in project. ` +
                    `Available scripts: ${allScripts.map(s => LreTestCreator.scriptFullPath(s)).join(', ')}`
                );
            }

            tl.debug(
                `LreTestCreator: resolved "${g.script_path}" → script ID ${resolved.ID} ("${resolved.Name}")`
            );

            return { ...g, script_id: resolved.ID, protocol: resolved.Protocol } as SimplifiedGroup;
        });

        return {
            ...parsed,
            content: { ...parsed.content, group: resolvedGroups },
        };
    }

    /**
     * Finds a script in `allScripts` whose combined path matches `scriptPath`.
     *
     * Matching rules (all case-insensitive, both separators normalised):
     *   - `<TestFolderPath>\<Name>` exact match
     *   - `<TestFolderPath>\<Name>` with or without leading "Subject\"
     *   - `<Name>` alone (when user provides only the script name)
     */
    private findScript(allScripts: LreScript[], scriptPath: string): LreScript | undefined {
        const normalise = (s: string) =>
            s.replace(/\//g, '\\').replace(/^Subject\\/i, '').toLowerCase().trim();

        const needle = normalise(scriptPath);

        // Try full path match first (most specific)
        let found = allScripts.find(s => {
            const full = normalise(`${s.TestFolderPath}\\${s.Name}`);
            return full === needle;
        });

        if (!found) {
            // Try matching only by script name (least specific — useful for flat structures)
            found = allScripts.find(s => s.Name.toLowerCase().trim() === needle);
        }

        return found;
    }

    /**
     * Returns the canonical "folder\name" display path for a script.
     * Used only in error messages.
     */
    private static scriptFullPath(script: LreScript): string {
        const folder = script.TestFolderPath.replace(/^Subject\\/i, '');
        return `${folder}\\${script.Name}`;
    }

    // =========================================================================
    // Static helper
    // =========================================================================

    /**
     * Returns true when `value` looks like a path to a YAML/YML file.
     * Used by the task entry-point (index.ts) to detect the YAML branch.
     */
    static isYamlFilePath(value: string): boolean {
        const ext = path.extname(value).toLowerCase();
        return ext === '.yaml' || ext === '.yml';
    }
}

