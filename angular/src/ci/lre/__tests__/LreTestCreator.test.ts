/**
 * Unit tests for LreTestCreator
 *
 * The LreClient is fully mocked so no HTTP calls are made.
 * The `fs` module is mocked for createOrUpdateFromFile tests.
 */

import * as fs from 'fs';
import { LreTestCreator } from '../LreTestCreator';
import type { LreClient } from '../LreClient';
import type { ParsedYamlTest, SimplifiedContent } from '../../yaml/SimplifiedModels';
import type { LreScript } from '../../models';

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('azure-pipelines-task-lib/task', () => ({
    debug:   jest.fn(),
    warning: jest.fn(),
    error:   jest.fn(),
}));

jest.mock('fs');

// ── Factories ─────────────────────────────────────────────────────────────────

function makeContent(overrides: Partial<SimplifiedContent> = {}): SimplifiedContent {
    return {
        group: [{ group_name: 'G1', vusers: 5, script_id: 42 }],
        ...overrides,
    };
}

function makeParsed(overrides: Partial<ParsedYamlTest> = {}): ParsedYamlTest {
    return {
        testName: 'My Test',
        testFolderPath: 'ci-tests\\api',
        testFolderPathWithSubject: 'Subject\\ci-tests\\api',
        content: makeContent(),
        ...overrides,
    };
}

function makeScript(id: number, name: string, folderPath = 'Subject\\scripts'): LreScript {
    return { ID: id, Name: name, TestFolderPath: folderPath };
}

function makeMockClient(opts: {
    scripts?:              LreScript[];
    existingTestId?:       number | null;   // null = test not found (default), number = found → update path
    createResult?:         { testId: number; existed: boolean };
    updateResult?:         boolean;
} = {}): LreClient {
    return {
        getScripts:                 jest.fn().mockResolvedValue(opts.scripts ?? []),
        findTestByNameAndFolder:    jest.fn().mockResolvedValue(opts.existingTestId ?? null),
        createTest:                 jest.fn().mockResolvedValue(
            opts.createResult ?? { testId: 100, existed: false }
        ),
        updateTest:                 jest.fn().mockResolvedValue(opts.updateResult ?? true),
        ensureTestPlanFolderExists: jest.fn().mockResolvedValue(undefined),
    } as unknown as LreClient;
}

beforeEach(() => jest.clearAllMocks());

// =============================================================================
// isYamlFilePath
// =============================================================================

describe('isYamlFilePath', () => {
    it.each([
        ['/path/to/test.yaml',  true],
        ['/path/to/test.yml',   true],
        ['/path/to/test.YAML',  true],
        ['/path/to/test.YML',   true],
        ['test.yaml',           true],
        ['test.yml',            true],
        ['180',                 false],
        ['test.json',           false],
        ['test.yamlx',          false],
        ['',                    false],
    ])('"%s" → %s', (input, expected) => {
        expect(LreTestCreator.isYamlFilePath(input)).toBe(expected);
    });
});

// =============================================================================
// createOrUpdate — all groups already have script_id (no resolution)
// =============================================================================

describe('createOrUpdate – groups already have script_id', () => {

    it('calls ensureTestPlanFolderExists with testFolderPathWithSubject', async () => {
        const client = makeMockClient();
        const creator = new LreTestCreator(client);
        const parsed = makeParsed();

        await creator.createOrUpdate(parsed);

        expect(client.ensureTestPlanFolderExists).toHaveBeenCalledWith(
            'Subject\\ci-tests\\api'
        );
    });

    it('does NOT call getScripts when every group has a script_id', async () => {
        const client = makeMockClient();
        const creator = new LreTestCreator(client);

        await creator.createOrUpdate(makeParsed());

        expect(client.getScripts).not.toHaveBeenCalled();
    });

    it('returns the new testId when POST /tests succeeds (201)', async () => {
        const client = makeMockClient({ createResult: { testId: 77, existed: false } });
        const creator = new LreTestCreator(client);

        const id = await creator.createOrUpdate(makeParsed());

        expect(id).toBe(77);
        expect(client.createTest).toHaveBeenCalledTimes(1);
        expect(client.updateTest).not.toHaveBeenCalled();
    });

    it('calls updateTest with <Content> XML when POST returns 409 (existed=true)', async () => {
        const client = makeMockClient({ createResult: { testId: 55, existed: true } });
        const creator = new LreTestCreator(client);

        const id = await creator.createOrUpdate(makeParsed());

        expect(id).toBe(55);
        expect(client.updateTest).toHaveBeenCalledWith(55, expect.stringContaining('<Content xmlns='));
    });

    it('throws when 409 and updateTest returns false', async () => {
        const client = makeMockClient({
            createResult: { testId: 55, existed: true },
            updateResult: false,
        });
        const creator = new LreTestCreator(client);

        await expect(creator.createOrUpdate(makeParsed())).rejects.toThrow(/update failed/i);
    });

    it('passes full <Test> XML to createTest', async () => {
        const client = makeMockClient();
        const creator = new LreTestCreator(client);

        await creator.createOrUpdate(makeParsed({ testName: 'XmlCheck Test' }));

        const [xml] = (client.createTest as jest.Mock).mock.calls[0] as [string];
        expect(xml).toContain('<Test xmlns=');
        expect(xml).toContain('<Name>XmlCheck Test</Name>');
    });
});

// =============================================================================
// createOrUpdate — pre-flight test lookup (findTestByNameAndFolder)
// =============================================================================

describe('createOrUpdate – pre-flight test lookup', () => {

    it('skips POST and calls updateTest directly when test already exists (avoids 500)', async () => {
        const client = makeMockClient({ existingTestId: 42 });
        const creator = new LreTestCreator(client);

        const id = await creator.createOrUpdate(makeParsed());

        expect(id).toBe(42);
        expect(client.findTestByNameAndFolder).toHaveBeenCalledWith(
            'My Test',
            'Subject\\ci-tests\\api'
        );
        expect(client.createTest).not.toHaveBeenCalled();
        expect(client.updateTest).toHaveBeenCalledWith(42, expect.stringContaining('<Content xmlns='));
    });

    it('calls POST createTest when test does not exist (findTestByNameAndFolder returns null)', async () => {
        const client = makeMockClient({ existingTestId: null });
        const creator = new LreTestCreator(client);

        const id = await creator.createOrUpdate(makeParsed());

        expect(id).toBe(100);
        expect(client.createTest).toHaveBeenCalledTimes(1);
        expect(client.updateTest).not.toHaveBeenCalled();
    });

    it('throws when pre-flight finds test but updateTest returns false', async () => {
        const client = makeMockClient({ existingTestId: 99, updateResult: false });
        const creator = new LreTestCreator(client);

        await expect(creator.createOrUpdate(makeParsed())).rejects.toThrow(/update failed/i);
    });
});

// =============================================================================
// createOrUpdate — script path resolution
// =============================================================================

describe('createOrUpdate – script path resolution', () => {

    it('resolves script_path to script_id via full folder\\name match', async () => {
        const script = makeScript(99, 'my_script', 'Subject\\scripts\\api');
        const client = makeMockClient({ scripts: [script] });
        const creator = new LreTestCreator(client);

        const parsed = makeParsed({
            content: makeContent({
                group: [{ group_name: 'G1', vusers: 1, script_path: 'scripts\\api\\my_script' }],
            }),
        });

        const id = await creator.createOrUpdate(parsed);
        expect(id).toBe(100);

        // The XML sent to createTest must contain script ID 99
        const [xml] = (client.createTest as jest.Mock).mock.calls[0] as [string];
        expect(xml).toContain('<ID>99</ID>');
    });

    it('matching is case-insensitive', async () => {
        const script = makeScript(11, 'MyScript', 'Subject\\Scripts\\Api');
        const client = makeMockClient({ scripts: [script] });
        const creator = new LreTestCreator(client);

        const parsed = makeParsed({
            content: makeContent({
                group: [{ script_path: 'scripts\\api\\myscript' }],
            }),
        });

        const id = await creator.createOrUpdate(parsed);
        expect(id).toBe(100);
        const [xml] = (client.createTest as jest.Mock).mock.calls[0] as [string];
        expect(xml).toContain('<ID>11</ID>');
    });

    it('falls back to name-only match when full path does not match', async () => {
        const script = makeScript(22, 'login_flow', 'Subject\\scripts\\other');
        const client = makeMockClient({ scripts: [script] });
        const creator = new LreTestCreator(client);

        const parsed = makeParsed({
            content: makeContent({
                // Only the name — no folder prefix
                group: [{ script_path: 'login_flow' }],
            }),
        });

        await creator.createOrUpdate(parsed);
        const [xml] = (client.createTest as jest.Mock).mock.calls[0] as [string];
        expect(xml).toContain('<ID>22</ID>');
    });

    it('throws with a descriptive error when script_path is not found', async () => {
        const client = makeMockClient({ scripts: [makeScript(1, 'other_script')] });
        const creator = new LreTestCreator(client);

        const parsed = makeParsed({
            content: makeContent({
                group: [{ script_path: 'missing\\script' }],
            }),
        });

        await expect(creator.createOrUpdate(parsed)).rejects.toThrow(/not found/i);
    });

    it('error message includes list of available scripts', async () => {
        const client = makeMockClient({
            scripts: [makeScript(1, 'alpha', 'Subject\\s'), makeScript(2, 'beta', 'Subject\\s')],
        });
        const creator = new LreTestCreator(client);

        const parsed = makeParsed({
            content: makeContent({ group: [{ script_path: 'nonexistent' }] }),
        });

        await expect(creator.createOrUpdate(parsed)).rejects.toThrow(/alpha|beta/);
    });

    it('does not overwrite an explicit script_id with resolution', async () => {
        // group has both script_id AND script_path — script_id must win
        const client = makeMockClient({ scripts: [makeScript(99, 'my_script')] });
        const creator = new LreTestCreator(client);

        const parsed = makeParsed({
            content: makeContent({
                group: [{ script_id: 7, script_path: 'scripts\\my_script' }],
            }),
        });

        await creator.createOrUpdate(parsed);
        expect(client.getScripts).not.toHaveBeenCalled();
        const [xml] = (client.createTest as jest.Mock).mock.calls[0] as [string];
        // script_id=7 should be used, NOT 99
        expect(xml).toContain('<ID>7</ID>');
    });

    it('calls getScripts exactly once even when multiple groups need resolution', async () => {
        const client = makeMockClient({
            scripts: [
                makeScript(1, 'script_a', 'Subject\\s'),
                makeScript(2, 'script_b', 'Subject\\s'),
            ],
        });
        const creator = new LreTestCreator(client);

        const parsed = makeParsed({
            content: makeContent({
                group: [
                    { script_path: 's\\script_a' },
                    { script_path: 's\\script_b' },
                ],
            }),
        });

        await creator.createOrUpdate(parsed);
        expect(client.getScripts).toHaveBeenCalledTimes(1);
    });

    it('strips leading Subject\\ from TestFolderPath when matching', async () => {
        // API returns TestFolderPath as "Subject\scripts\api"
        const script = makeScript(33, 'demo', 'Subject\\scripts\\api');
        const client = makeMockClient({ scripts: [script] });
        const creator = new LreTestCreator(client);

        const parsed = makeParsed({
            content: makeContent({
                // User provides path without Subject\ prefix
                group: [{ script_path: 'scripts\\api\\demo' }],
            }),
        });

        await creator.createOrUpdate(parsed);
        const [xml] = (client.createTest as jest.Mock).mock.calls[0] as [string];
        expect(xml).toContain('<ID>33</ID>');
    });
});

// =============================================================================
// createOrUpdate — multiple groups mixed (some have ID, some have path)
// =============================================================================

describe('createOrUpdate – mixed groups', () => {
    it('resolves only groups without script_id', async () => {
        const script = makeScript(88, 'load_script', 'Subject\\scripts');
        const client = makeMockClient({ scripts: [script] });
        const creator = new LreTestCreator(client);

        const parsed = makeParsed({
            content: makeContent({
                group: [
                    { group_name: 'WithId',   script_id: 7 },       // already has ID
                    { group_name: 'NeedsPath', script_path: 'scripts\\load_script' }, // needs resolution
                ],
            }),
        });

        await creator.createOrUpdate(parsed);
        expect(client.getScripts).toHaveBeenCalledTimes(1);
        const [xml] = (client.createTest as jest.Mock).mock.calls[0] as [string];
        expect(xml).toContain('<ID>7</ID>');
        expect(xml).toContain('<ID>88</ID>');
    });
});

// =============================================================================
// createOrUpdateFromFile
// =============================================================================

describe('createOrUpdateFromFile', () => {
    beforeEach(() => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    it('parses the YAML file and delegates to createOrUpdate', async () => {
        const yaml = `
test_name: "File Test"
test_folder_path: "ci-tests"
test_content:
  group:
    - script_id: 5
`;
        (fs.readFileSync as jest.Mock).mockReturnValue(yaml);

        const client = makeMockClient({ createResult: { testId: 42, existed: false } });
        const creator = new LreTestCreator(client);

        const id = await creator.createOrUpdateFromFile('/fake/test.yaml');
        expect(id).toBe(42);
        expect(client.createTest).toHaveBeenCalledTimes(1);
    });

    it('throws when the YAML file does not exist', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        const client = makeMockClient();
        const creator = new LreTestCreator(client);

        await expect(creator.createOrUpdateFromFile('/missing/test.yaml')).rejects.toThrow(/not found/i);
    });

    it('uses workspaceRoot for folder derivation in content-only YAML', async () => {
        const yaml = `
group:
  - script_id: 3
    vusers: 1
`;
        (fs.readFileSync as jest.Mock).mockReturnValue(yaml);

        const client = makeMockClient({ createResult: { testId: 9, existed: false } });
        const creator = new LreTestCreator(client);

        const id = await creator.createOrUpdateFromFile('/workspace/tests/my-load.yaml', '/workspace');
        expect(id).toBe(9);

        const [xml] = (client.createTest as jest.Mock).mock.calls[0] as [string];
        // test name should be derived from filename "my-load"
        expect(xml).toContain('<Name>my-load</Name>');
        // folder path derived from relative directory "tests"
        expect(xml).toContain('<TestFolderPath>Subject\\tests</TestFolderPath>');
    });
});

