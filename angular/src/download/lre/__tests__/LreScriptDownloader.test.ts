/**
 * Unit tests for LreScriptDownloader
 *
 * The internal httpClient is replaced after construction so no real HTTP
 * calls are made.  All XML strings use the real fast-xml-parser so the
 * parsing behaviour is tested authentically.
 */

import { LreScriptDownloader, ILogSink } from '../LreScriptDownloader';
import type { LreDownloadConfig, RemoteScript } from '../../models';

// ── Module mocks ──────────────────────────────────────────────────────────────

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
        get:  jest.fn(),
        post: jest.fn(),
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

const BASE_CONFIG: LreDownloadConfig = {
    serverUrl:    'http://lre.example.com',
    domain:       'DOMAIN',
    project:      'PROJECT',
    useToken:     false,
    username:     'user',
    password:     'pass',
    workspaceDir: '/tmp/workspace',
    artifactsDir: '/tmp/artifacts',
};

interface MockHttp {
    get:  jest.Mock;
    post: jest.Mock;
    defaults: { headers: { common: Record<string, string> } };
}

function makeClient(): { client: LreScriptDownloader; http: MockHttp } {
    // Logger stub — suppress output in tests
    const logger = {
        log:     jest.fn(),
        info:    jest.fn(),
        warning: jest.fn(),
        warn:    jest.fn(),
        error:   jest.fn(),
        debug:   jest.fn(),
        close:   jest.fn(),
        getLogFilePath: jest.fn(),
    } as unknown as import('../../../../shared/utils/Logger').Logger;

    const client = new LreScriptDownloader(BASE_CONFIG, logger);
    const http: MockHttp = {
        get:  jest.fn(),
        post: jest.fn(),
        defaults: { headers: { common: {} } },
    };
    (client as unknown as { httpClient: MockHttp }).httpClient = http;
    return { client, http };
}

/** Successful AxiosResponse. */
function ok(data: string | object | Buffer, status = 200, headers: Record<string, string | string[]> = {}) {
    return { status, data, headers };
}

/** Failure AxiosResponse. */
function fail(data: string | object, status = 500) {
    return { status, data, headers: {} };
}

/** Silent ILogSink for use during tests. */
const sink: ILogSink = {
    log:     jest.fn(),
    warning: jest.fn(),
    error:   jest.fn(),
    debug:   jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

// ── Authentication ────────────────────────────────────────────────────────────

describe('LreScriptDownloader — authenticate()', () => {
    test('succeeds with username/password (200 + Set-Cookie)', async () => {
        const { client, http } = makeClient();
        http.get.mockResolvedValueOnce(ok('', 200, { 'set-cookie': ['SESSION=abc; Path=/'] }));

        const result = await client.authenticate();

        expect(result).toBe(true);
        expect(http.get).toHaveBeenCalledTimes(1);
        expect(http.get.mock.calls[0][0]).toContain('/authentication-point/authenticate');
        expect(http.defaults.headers.common['Cookie']).toBe('SESSION=abc');
    });

    test('succeeds with API token', async () => {
        const tokenConfig: LreDownloadConfig = {
            ...BASE_CONFIG,
            useToken:     true,
            clientId:     'I_KEY_123',
            clientSecret: 'S_KEY_456',
        };
        const logger = {
            log: jest.fn(), info: jest.fn(), warning: jest.fn(), warn: jest.fn(),
            error: jest.fn(), debug: jest.fn(), close: jest.fn(), getLogFilePath: jest.fn(),
        } as unknown as import('../../../../shared/utils/Logger').Logger;
        const client = new LreScriptDownloader(tokenConfig, logger);
        const http: MockHttp = { get: jest.fn(), post: jest.fn(), defaults: { headers: { common: {} } } };
        (client as unknown as { httpClient: MockHttp }).httpClient = http;

        http.post.mockResolvedValueOnce(ok('', 200, { 'set-cookie': ['SESSION=tok; Path=/'] }));

        const result = await client.authenticate();

        expect(result).toBe(true);
        expect(http.post.mock.calls[0][0]).toContain('/authentication-point/authenticateclient');
        expect(http.defaults.headers.common['Cookie']).toBe('SESSION=tok');
    });

    test('returns false when server responds with 401', async () => {
        jest.useFakeTimers();
        const { client, http } = makeClient();
        http.get.mockResolvedValue(fail('Unauthorized', 401));

        const authPromise = client.authenticate();
        await jest.runAllTimersAsync();
        const result = await authPromise;

        expect(result).toBe(false);
        jest.useRealTimers();
    }, 10_000);

    test('retries up to 5 times on 5xx then returns false', async () => {
        jest.useFakeTimers();
        const { client, http } = makeClient();
        http.get.mockRejectedValue(new Error('network'));

        const authPromise = client.authenticate();
        await jest.runAllTimersAsync();
        const result = await authPromise;

        expect(result).toBe(false);
        expect(http.get.mock.calls.length).toBe(5);
        jest.useRealTimers();
    }, 10_000);

    test('logout clears session cookies', async () => {
        const { client, http } = makeClient();
        http.get
            .mockResolvedValueOnce(ok('', 200, { 'set-cookie': ['SESSION=xyz; Path=/'] }))
            .mockResolvedValueOnce(ok(''));  // logout call

        await client.authenticate();
        await client.logout();

        expect(http.defaults.headers.common['Cookie']).toBeUndefined();
    });
});

// ── Script listing ────────────────────────────────────────────────────────────

describe('LreScriptDownloader — fetchScriptList()', () => {
    const SCRIPTS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Scripts>
  <Script>
    <ID>1</ID>
    <Name>MyScript</Name>
    <TestFolderPath>Subject\\scripts\\DevWeb</TestFolderPath>
  </Script>
  <Script>
    <ID>2</ID>
    <Name>AnotherScript</Name>
    <TestFolderPath>Subject\\scripts</TestFolderPath>
  </Script>
</Scripts>`;

    test('parses a multi-script XML response', async () => {
        const { client, http } = makeClient();
        http.get.mockResolvedValueOnce(ok(SCRIPTS_XML));

        const scripts = await client.fetchScriptList();

        expect(scripts).toHaveLength(2);
        expect(scripts[0]).toMatchObject({ id: 1, name: 'MyScript', testFolderPath: 'Subject\\scripts\\DevWeb' });
        expect(scripts[1]).toMatchObject({ id: 2, name: 'AnotherScript', testFolderPath: 'Subject\\scripts' });
    });

    test('parses a single-script XML response (non-array wrapping)', async () => {
        const singleXml = `<Scripts><Script><ID>42</ID><Name>Solo</Name><TestFolderPath>Subject</TestFolderPath></Script></Scripts>`;
        const { client, http } = makeClient();
        http.get.mockResolvedValueOnce(ok(singleXml));

        const scripts = await client.fetchScriptList();

        expect(scripts).toHaveLength(1);
        expect(scripts[0]).toMatchObject({ id: 42, name: 'Solo' });
    });

    test('returns [] when server responds with non-2xx', async () => {
        const { client, http } = makeClient();
        http.get.mockResolvedValueOnce(fail('error', 403));

        const scripts = await client.fetchScriptList();

        expect(scripts).toHaveLength(0);
    });

    test('returns [] when response body is empty', async () => {
        const { client, http } = makeClient();
        http.get.mockResolvedValueOnce(ok(''));

        const scripts = await client.fetchScriptList();

        expect(scripts).toHaveLength(0);
    });

    test('returns [] and does not throw on network error', async () => {
        const { client, http } = makeClient();
        http.get.mockRejectedValueOnce(new Error('ECONNRESET'));

        const scripts = await client.fetchScriptList();

        expect(scripts).toHaveLength(0);
    });
});

// ── Script content download ───────────────────────────────────────────────────

describe('LreScriptDownloader — downloadScriptContent()', () => {
    const SCRIPT: RemoteScript = { id: 5, name: 'TestScript', testFolderPath: 'Subject\\scripts' };

    test('returns Buffer on successful download', async () => {
        const { client, http } = makeClient();
        const zipBytes = Buffer.from('PK\x03\x04fake zip content');
        const ab = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength);
        http.get.mockResolvedValueOnce(ok(ab));

        const result = await client.downloadScriptContent(SCRIPT, sink);

        expect(result).not.toBeNull();
        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result?.byteLength).toBeGreaterThan(0);
        // Verify the correct REST endpoint is called
        expect(http.get.mock.calls[0][0]).toContain('/scripts/5/zip');
    });

    test('returns null after 3 retries on 5xx', async () => {
        jest.useFakeTimers();
        const { client, http } = makeClient();
        http.get.mockResolvedValue(fail('Server Error', 503));

        const dlPromise = client.downloadScriptContent(SCRIPT, sink);
        await jest.runAllTimersAsync();
        const result = await dlPromise;

        expect(result).toBeNull();
        expect(http.get.mock.calls.length).toBe(3);
        jest.useRealTimers();
    }, 10_000);

    test('re-authenticates on 200 with empty body then retries', async () => {
        const { client, http } = makeClient();
        // First attempt: 200 but empty body → session expiry
        const emptyAb = new ArrayBuffer(0);
        // Re-auth call
        const zipBytes = Buffer.from('PK\x03\x04real content');
        const realAb = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength);

        http.get
            .mockResolvedValueOnce(ok(emptyAb, 200))          // download → empty
            .mockResolvedValueOnce(ok('', 200, { 'set-cookie': ['SESSION=new; Path=/'] })) // re-auth
            .mockResolvedValueOnce(ok(realAb, 200));            // download → success

        const result = await client.downloadScriptContent(SCRIPT, sink);

        expect(result).not.toBeNull();
        // 3 GET calls: initial download + re-auth + retry download
        expect(http.get.mock.calls.length).toBe(3);
    });

    test('returns null on network error exhausting all retries', async () => {
        jest.useFakeTimers();
        const { client, http } = makeClient();
        http.get.mockRejectedValue(new Error('ETIMEDOUT'));

        const dlPromise = client.downloadScriptContent(SCRIPT, sink);
        await jest.runAllTimersAsync();
        const result = await dlPromise;

        expect(result).toBeNull();
        expect(http.get.mock.calls.length).toBe(3);
        jest.useRealTimers();
    }, 10_000);
});

