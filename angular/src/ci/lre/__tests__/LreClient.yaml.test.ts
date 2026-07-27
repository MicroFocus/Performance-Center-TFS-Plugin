/**
 * Unit tests for the YAML-related LreClient methods added in Phase 2:
 *   getScripts(), createTest(), updateTest(),
 *   ensureTestPlanFolderExists() / createTestPlanFolder()
 *
 * The internal httpClient is replaced after construction so no real HTTP
 * calls are made.  All XML strings use the real fast-xml-parser so the
 * parsing behaviour is tested authentically.
 */

import { LreClient } from '../LreClient';
import type { LreConfig } from '../../models';

// ── Module mocks (constructor dependencies) ───────────────────────────────────

jest.mock('azure-pipelines-task-lib/task', () => ({
    debug: jest.fn(), warning: jest.fn(), error: jest.fn(),
}));
jest.mock('axios-cookiejar-support', () => ({
    wrapper: jest.fn().mockImplementation((inst: unknown) => inst),
}));
jest.mock('tough-cookie', () => ({
    CookieJar: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('axios', () => {
    const mockCreate = jest.fn().mockReturnValue({
        get: jest.fn(), post: jest.fn(), put: jest.fn(),
        defaults: { headers: { common: {} } },
    });
    return {
        __esModule: true,
        default:      { create: mockCreate, isAxiosError: jest.fn().mockReturnValue(false) },
        create:       mockCreate,
        isAxiosError: jest.fn().mockReturnValue(false),
    };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_CONFIG: LreConfig = {
    serverUrl: 'http://lre.example.com',
    domain:    'DOMAIN',
    project:   'PROJECT',
    useToken:  false,
    username:  'user',
    password:  'pass',
};

interface MockHttp {
    get:  jest.Mock;
    post: jest.Mock;
    put:  jest.Mock;
    defaults: { headers: { common: Record<string, string> } };
}

function makeClient(): { client: LreClient; http: MockHttp } {
    const client = new LreClient(BASE_CONFIG);
    const http: MockHttp = {
        get:  jest.fn(),
        post: jest.fn(),
        put:  jest.fn(),
        defaults: { headers: { common: {} } },
    };
    // Replace the private httpClient with our controlled mock
    (client as unknown as { httpClient: MockHttp }).httpClient = http;
    return { client, http };
}

/** Build a successful AxiosResponse shape. */
function ok(data: string | object, status = 200) {
    return { status, data, headers: {} };
}

/** Build a failure AxiosResponse shape. */
function fail(data: string | object, status = 500) {
    return { status, data, headers: {} };
}

// ── XML helpers ───────────────────────────────────────────────────────────────

// ── XML helpers (still used for createTest, updateTest, error responses) ─────
const XML = {
    /** Real LRE format: <Scripts xmlns="..."><Script>...</Script></Scripts> (no ScriptList wrapper) */
    scriptsReal: (items: { id: number; name: string; folder: string }[]) =>
        `<Scripts xmlns="http://www.hp.com/PC/REST/API">${items.map(s =>
            `<Script><ID>${s.id}</ID><Name>${s.name}</Name><TestFolderPath>${s.folder}</TestFolderPath></Script>`
        ).join('')}</Scripts>`,

    /** Legacy format: <Scripts><ScriptList><Script>...</Script></ScriptList></Scripts> */
    scripts: (items: { id: number; name: string; folder: string }[]) =>
        `<Scripts><ScriptList>${items.map(s =>
            `<Script><ID>${s.id}</ID><Name>${s.name}</Name><TestFolderPath>${s.folder}</TestFolderPath></Script>`
        ).join('')}</ScriptList></Scripts>`,

    scriptsEmpty: '<Scripts><ScriptList/></Scripts>',

    testCreated: (id: number, name = 'My Test') =>
        `<Test><ID>${id}</ID><Name>${name}</Name><TestFolderPath>Subject/ci-tests</TestFolderPath></Test>`,

    error: (message: string, code = 500) =>
        `<ExceptionData><ExceptionMessage>${message}</ExceptionMessage><ErrorCode>${code}</ErrorCode></ExceptionData>`,
};

// ── JSON helpers (the real /Scripts endpoint format) ──────────────────────────
const JSON_DATA = {
    /** { ScriptList: [ {ID, Name, TestFolderPath}, ... ] } — flat array under ScriptList */
    scriptsFlat: (items: { id: number; name: string; folder: string }[]) =>
        ({ ScriptList: items.map(s => ({ ID: s.id, Name: s.name, TestFolderPath: s.folder })) }),

    /** { ScriptList: { Script: [{...}] } } — XML-mirrored nested object */
    scriptsNested: (items: { id: number; name: string; folder: string }[]) =>
        ({ ScriptList: { Script: items.map(s => ({ ID: s.id, Name: s.name, TestFolderPath: s.folder })) } }),

    /** root array */
    scriptsArray: (items: { id: number; name: string; folder: string }[]) =>
        items.map(s => ({ ID: s.id, Name: s.name, TestFolderPath: s.folder })),
};

beforeEach(() => jest.clearAllMocks());

// =============================================================================
// getScripts()
// =============================================================================

describe('getScripts()', () => {

    // ── JSON shapes (the real /Scripts endpoint format) ───────────────────────

    it('JSON { ScriptList: [...] } — returns array of scripts', async () => {
        const { client, http } = makeClient();
        http.get.mockResolvedValue(ok(JSON_DATA.scriptsFlat([
            { id: 1, name: 'script_a', folder: 'Subject/scripts/a' },
            { id: 2, name: 'script_b', folder: 'Subject/scripts/b' },
        ])));

        const scripts = await client.getScripts();
        expect(scripts).toHaveLength(2);
        expect(scripts[0]?.ID).toBe(1);
        expect(scripts[0]?.Name).toBe('script_a');
        expect(scripts[1]?.ID).toBe(2);
    });

    it('JSON { ScriptList: { Script: [...] } } — nested format', async () => {
        const { client, http } = makeClient();
        http.get.mockResolvedValue(ok(JSON_DATA.scriptsNested([
            { id: 42, name: 'solo', folder: 'Subject/scripts' },
        ])));

        const scripts = await client.getScripts();
        expect(scripts).toHaveLength(1);
        expect(scripts[0]?.ID).toBe(42);
    });

    it('JSON root array [...] — returns scripts', async () => {
        const { client, http } = makeClient();
        http.get.mockResolvedValue(ok(JSON_DATA.scriptsArray([
            { id: 7, name: 'root_script', folder: 'Subject/scripts' },
        ])));

        const scripts = await client.getScripts();
        expect(scripts).toHaveLength(1);
        expect(scripts[0]?.ID).toBe(7);
    });

    // ── XML fallback ──────────────────────────────────────────────────────────

    it('XML <Scripts><Script> — real LRE format (Script directly under Scripts)', async () => {
        const { client, http } = makeClient();
        // This is the actual format returned by the real LRE server
        http.get.mockResolvedValue(ok(XML.scriptsReal([
            { id: 175, name: 'Parameters', folder: 'Subject/ScriptFolder' },
            { id: 176, name: 'another_script', folder: 'Subject/ScriptFolder' },
        ])));

        const scripts = await client.getScripts();
        expect(scripts).toHaveLength(2);
        expect(scripts[0]?.ID).toBe(175);
        expect(scripts[0]?.Name).toBe('Parameters');
        expect(scripts[1]?.ID).toBe(176);
    });

    it('XML <Scripts><ScriptList><Script> — legacy nested format still works', async () => {
        const { client, http } = makeClient();
        http.get.mockResolvedValue(ok(XML.scripts([
            { id: 99, name: 'xml_script', folder: 'Subject/scripts' },
        ])));

        const scripts = await client.getScripts();
        expect(scripts).toHaveLength(1);
        expect(scripts[0]?.ID).toBe(99);
    });

    // ── Edge cases ────────────────────────────────────────────────────────────

    it('returns an empty array when ScriptList is an empty array', async () => {
        const { client, http } = makeClient();
        http.get.mockResolvedValue(ok({ ScriptList: [] }));

        const scripts = await client.getScripts();
        expect(scripts).toHaveLength(0);
    });

    it('throws with response snippet when response is non-empty but unrecognised', async () => {
        const { client, http } = makeClient();
        // Something completely unexpected that's non-trivially non-empty
        http.get.mockResolvedValue(ok({ unexpectedKey: 'unexpected value here' }));

        await expect(client.getScripts()).rejects.toThrow(/Raw response/i);
    });

    it('JSON { ScriptList: singleObject } — single-script without array wrapper', async () => {
        const { client, http } = makeClient();
        // LRE sometimes serialises 1-element lists as plain objects (Java quirk)
        http.get.mockResolvedValue(ok({ ScriptList: { ID: 55, Name: 'only_script', TestFolderPath: 'Subject/scripts' } }));

        const scripts = await client.getScripts();
        expect(scripts).toHaveLength(1);
        expect(scripts[0]?.ID).toBe(55);
        expect(scripts[0]?.Name).toBe('only_script');
    });

    it('calls the correct URL', async () => {
        const { client, http } = makeClient();
        http.get.mockResolvedValue(ok({ ScriptList: [] }));

        await client.getScripts();
        expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/Scripts'));
    });

    it('throws on HTTP error response', async () => {
        const { client, http } = makeClient();
        http.get.mockResolvedValue(fail(XML.error('Forbidden', 403), 403));

        await expect(client.getScripts()).rejects.toThrow(/getScripts failed/i);
    });
});

// =============================================================================
// createTest()
// =============================================================================

describe('createTest()', () => {

    const DUMMY_XML = '<Test xmlns="http://www.hp.com/PC/REST/API"><Name>T</Name></Test>';

    it('returns {testId, existed: false} on 201 Created', async () => {
        const { client, http } = makeClient();
        http.post.mockResolvedValue(ok(XML.testCreated(123), 201));

        const result = await client.createTest(DUMMY_XML);

        expect(result).toEqual({ testId: 123, existed: false });
    });

    it('calls POST /tests with the provided XML', async () => {
        const { client, http } = makeClient();
        http.post.mockResolvedValue(ok(XML.testCreated(1), 201));

        await client.createTest(DUMMY_XML);

        expect(http.post).toHaveBeenCalledWith(
            expect.stringContaining('/tests'),
            DUMMY_XML
        );
    });

    it('409: extracts ID from "ID: <n>" pattern and returns existed=true', async () => {
        const { client, http } = makeClient();
        http.post.mockResolvedValue(
            fail(XML.error('Test already exists. ID: 456'), 409)
        );

        const result = await client.createTest(DUMMY_XML);

        expect(result).toEqual({ testId: 456, existed: true });
    });

    it('409: extracts ID from "test id: <n>" pattern', async () => {
        const { client, http } = makeClient();
        http.post.mockResolvedValue(
            fail(XML.error('Conflict — test id: 789'), 409)
        );

        const result = await client.createTest(DUMMY_XML);
        expect(result.testId).toBe(789);
        expect(result.existed).toBe(true);
    });

    it('409: falls back to largest number in message (avoids script-name digits)', async () => {
        const { client, http } = makeClient();
        // 'mb1255' contains digits 1255, but the test ID 3814 is larger → must pick 3814
        http.post.mockResolvedValue(
            fail(XML.error("A performance test (ID:'3814') named 'mb1255' already exists"), 409)
        );

        const result = await client.createTest(DUMMY_XML);
        expect(result.testId).toBe(3814);
        expect(result.existed).toBe(true);
    });

    it('400 + "already exists" message: extracts (ID:\'nnn\') pattern and returns existed=true', async () => {
        const { client, http } = makeClient();
        // Real LRE 400 error format observed in live testing
        http.post.mockResolvedValue(
            fail(
                XML.error(
                    "Invalid design performance test request. A performance test (ID:'3814') named 'mb1255' in folder 'Subject\\Tests\\yaml' already exists."
                ),
                400
            )
        );

        const result = await client.createTest(DUMMY_XML);
        expect(result).toEqual({ testId: 3814, existed: true });
    });

    it('400 without "already exists" → throws createTest failed', async () => {
        const { client, http } = makeClient();
        http.post.mockResolvedValue(fail(XML.error('Bad request — missing field'), 400));

        await expect(client.createTest(DUMMY_XML)).rejects.toThrow(/createTest failed/i);
    });

    it('409: throws when no number found in conflict message', async () => {
        const { client, http } = makeClient();
        http.post.mockResolvedValue(
            fail(XML.error('Conflict — no id here'), 409)
        );

        await expect(client.createTest(DUMMY_XML)).rejects.toThrow(/could not extract test ID/i);
    });

    it('throws on non-201/409 error responses', async () => {
        const { client, http } = makeClient();
        http.post.mockResolvedValue(fail(XML.error('Internal error'), 500));

        await expect(client.createTest(DUMMY_XML)).rejects.toThrow(/createTest failed/i);
    });

    it('throws when 201 response body has no ID', async () => {
        const { client, http } = makeClient();
        http.post.mockResolvedValue(ok('<Test><Name>NoId</Name></Test>', 201));

        await expect(client.createTest(DUMMY_XML)).rejects.toThrow(/no ID/i);
    });
});

// =============================================================================
// updateTest()
// =============================================================================

describe('updateTest()', () => {

    const CONTENT_XML = '<Content xmlns="http://www.hp.com/PC/REST/API"></Content>';

    it('returns true on 200 OK', async () => {
        const { client, http } = makeClient();
        http.put.mockResolvedValue(ok('', 200));

        const result = await client.updateTest(55, CONTENT_XML);
        expect(result).toBe(true);
    });

    it('calls PUT /tests/{id} with the content XML', async () => {
        const { client, http } = makeClient();
        http.put.mockResolvedValue(ok('', 200));

        await client.updateTest(55, CONTENT_XML);

        expect(http.put).toHaveBeenCalledWith(
            expect.stringContaining('/tests/55'),
            CONTENT_XML
        );
    });

    it('returns false on server error', async () => {
        const { client, http } = makeClient();
        http.put.mockResolvedValue(fail(XML.error('Not found'), 404));

        const result = await client.updateTest(55, CONTENT_XML);
        expect(result).toBe(false);
    });
});

// =============================================================================
// ensureTestPlanFolderExists() / createTestPlanFolder()
// =============================================================================

describe('ensureTestPlanFolderExists()', () => {

    it('creates one POST per folder level (excluding Subject root)', async () => {
        const { client, http } = makeClient();
        http.post.mockResolvedValue(ok('<TestPlanFolder/>', 201));

        await client.ensureTestPlanFolderExists('Subject\\ci-tests\\api');

        // Expects two POST /testplan calls: "ci-tests" under Subject, "api" under Subject\ci-tests
        expect(http.post).toHaveBeenCalledTimes(2);
    });

    it('sends correct Path and Name in the request body', async () => {
        const { client, http } = makeClient();
        http.post.mockResolvedValue(ok('<TestPlanFolder/>', 201));

        await client.ensureTestPlanFolderExists('Subject\\ci-tests\\api');

        const calls = http.post.mock.calls as [string, string][];
        // First call: create "ci-tests" under "Subject"
        expect(calls[0]?.[1]).toContain('<Path>Subject</Path>');
        expect(calls[0]?.[1]).toContain('<Name>ci-tests</Name>');
        // Second call: create "api" under "Subject\ci-tests"
        expect(calls[1]?.[1]).toContain('<Path>Subject\\ci-tests</Path>');
        expect(calls[1]?.[1]).toContain('<Name>api</Name>');
    });

    it('silently ignores 409 (folder already exists)', async () => {
        const { client, http } = makeClient();
        http.post.mockResolvedValue(fail(XML.error('Already exists'), 409));

        // Should not throw even though every folder returns 409
        await expect(
            client.ensureTestPlanFolderExists('Subject\\existing\\folder')
        ).resolves.toBeUndefined();
    });

    it('silently ignores 400 with "already exists" message (LRE variant)', async () => {
        const { client, http } = makeClient();
        // Some LRE builds return 400 instead of 409 for duplicate folders
        http.post.mockResolvedValue(fail(
            XML.error("Failed to create folder with the name 'Tests'. A folder with the same name already exists in 'Subject'."),
            400
        ));

        await expect(
            client.ensureTestPlanFolderExists('Subject\\Tests')
        ).resolves.toBeUndefined();
    });

    it('throws on non-409 server error', async () => {
        const { client, http } = makeClient();
        http.post.mockResolvedValue(fail(XML.error('Permission denied'), 403));

        await expect(
            client.ensureTestPlanFolderExists('Subject\\ci-tests')
        ).rejects.toThrow(/createTestPlanFolder failed/i);
    });

    it('does nothing for a path with only the Subject root', async () => {
        const { client, http } = makeClient();

        await client.ensureTestPlanFolderExists('Subject');

        expect(http.post).not.toHaveBeenCalled();
    });

    it('handles forward-slash separators', async () => {
        const { client, http } = makeClient();
        http.post.mockResolvedValue(ok('<TestPlanFolder/>', 201));

        await client.ensureTestPlanFolderExists('Subject/ci-tests/api');

        // Same two calls as the backslash variant
        expect(http.post).toHaveBeenCalledTimes(2);
    });
});

