/**
 * Unit tests for LreScriptDownloadRunner
 *
 * The downloader, fs, os, and adm-zip modules are mocked so no real HTTP
 * calls, file I/O, or zip extraction occurs.
 */

import * as path from 'path';

// ── Module mocks (must come before the module under test is imported) ─────────

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
        get: jest.fn(), post: jest.fn(), defaults: { headers: { common: {} } },
    });
    return { __esModule: true, default: { create: mockCreate }, create: mockCreate };
});

// adm-zip mock — extractAllTo records the call so we can assert the path
const mockExtractAllTo = jest.fn();
const mockGetEntries   = jest.fn().mockReturnValue([{}, {}]); // 2 entries
jest.mock('adm-zip', () => {
    return jest.fn().mockImplementation(() => ({
        extractAllTo: mockExtractAllTo,
        getEntries:   mockGetEntries,
    }));
});

// fs mock
const mockExistsSync    = jest.fn().mockReturnValue(false);
const mockMkdirSync     = jest.fn();
const mockWriteFileSync = jest.fn();
const mockUnlinkSync    = jest.fn();
jest.mock('fs', () => ({
    existsSync:    mockExistsSync,
    mkdirSync:     mockMkdirSync,
    writeFileSync: mockWriteFileSync,
    unlinkSync:    mockUnlinkSync,
}));

// os mock — always returns a fixed tmp dir
jest.mock('os', () => ({ tmpdir: () => '/tmp' }));

// LreScriptDownloader mock — injected via the constructor of the runner
const mockAuthenticate          = jest.fn().mockResolvedValue(true);
const mockFetchScriptList       = jest.fn();
const mockDownloadScriptContent = jest.fn();
const mockLogout                = jest.fn().mockResolvedValue(undefined);

jest.mock('../LreScriptDownloader', () => ({
    LreScriptDownloader: jest.fn().mockImplementation(() => ({
        authenticate:          mockAuthenticate,
        fetchScriptList:       mockFetchScriptList,
        downloadScriptContent: mockDownloadScriptContent,
        logout:                mockLogout,
    })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { LreScriptDownloadRunner } from '../LreScriptDownloadRunner';
import type { LreDownloadConfig, RemoteScript } from '../../models';

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_CONFIG: LreDownloadConfig = {
    serverUrl:    'http://lre.example.com',
    domain:       'DOMAIN',
    project:      'PROJECT',
    useToken:     false,
    username:     'user',
    password:     'pass',
    workspaceDir: '/workspace',
    artifactsDir: '/artifacts',
};

const LOGGER = {
    log:     jest.fn(),
    info:    jest.fn(),
    warning: jest.fn(),
    warn:    jest.fn(),
    error:   jest.fn(),
    debug:   jest.fn(),
    close:   jest.fn(),
    getLogFilePath: jest.fn(),
} as unknown as import('../../../../shared/utils/Logger').Logger;

function makeRunner(concurrency = 1, threshold = 50): LreScriptDownloadRunner {
    return new LreScriptDownloadRunner(BASE_CONFIG, LOGGER, concurrency, threshold);
}

function script(id: number, name: string, folderPath = 'Subject\\scripts'): RemoteScript {
    return { id, name, testFolderPath: folderPath };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockGetEntries.mockReturnValue([{}, {}]);
});

// ── run() — auth failures ─────────────────────────────────────────────────────

describe('LreScriptDownloadRunner.run() — authentication', () => {
    test('returns false immediately when authentication fails', async () => {
        mockAuthenticate.mockResolvedValueOnce(false);
        const runner = makeRunner();

        const result = await runner.run();

        expect(result).toBe(false);
        expect(mockFetchScriptList).not.toHaveBeenCalled();
        expect(mockLogout).not.toHaveBeenCalled();
    });
});

// ── run() — empty project ─────────────────────────────────────────────────────

describe('LreScriptDownloadRunner.run() — empty project', () => {
    test('returns true when no scripts exist in the project', async () => {
        mockFetchScriptList.mockResolvedValueOnce([]);
        const runner = makeRunner();

        const result = await runner.run();

        expect(result).toBe(true);
        expect(mockLogout).toHaveBeenCalled();
    });
});

// ── run() — successful downloads ──────────────────────────────────────────────

describe('LreScriptDownloadRunner.run() — successful downloads', () => {
    const zipBuf = Buffer.from('PK\x03\x04fake');

    test('downloads all scripts and returns true', async () => {
        const scripts = [script(1, 'Alpha'), script(2, 'Beta')];
        mockFetchScriptList.mockResolvedValueOnce(scripts);
        mockDownloadScriptContent.mockResolvedValue(zipBuf);
        const runner = makeRunner();

        const result = await runner.run();

        expect(result).toBe(true);
        expect(mockDownloadScriptContent).toHaveBeenCalledTimes(2);
        expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
        expect(mockExtractAllTo).toHaveBeenCalledTimes(2);
        expect(mockUnlinkSync).toHaveBeenCalledTimes(2); // temp .usz deleted each time
        expect(mockLogout).toHaveBeenCalled();
    });

    test('creates the extraction directory if it does not exist', async () => {
        mockFetchScriptList.mockResolvedValueOnce([script(1, 'NewScript', 'Subject\\folder1\\sub')]);
        mockDownloadScriptContent.mockResolvedValueOnce(zipBuf);
        mockExistsSync.mockReturnValue(false);
        const runner = makeRunner();

        await runner.run();

        const expectedDir = path.join('/workspace', 'folder1', 'sub', 'NewScript');
        expect(mockMkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true });
    });

    test('passes correct extraction directory to AdmZip.extractAllTo', async () => {
        mockFetchScriptList.mockResolvedValueOnce([script(7, 'Script7', 'Subject\\a\\b')]);
        mockDownloadScriptContent.mockResolvedValueOnce(zipBuf);
        const runner = makeRunner();

        await runner.run();

        const expectedDir = path.join('/workspace', 'a', 'b', 'Script7');
        expect(mockExtractAllTo).toHaveBeenCalledWith(expectedDir, true);
    });

    test('always deletes temp .usz even after extraction', async () => {
        mockFetchScriptList.mockResolvedValueOnce([script(3, 'S3')]);
        mockDownloadScriptContent.mockResolvedValueOnce(zipBuf);
        const runner = makeRunner();

        await runner.run();

        expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
        const calledPath: string = mockUnlinkSync.mock.calls[0][0] as string;
        expect(calledPath).toContain('.usz');
        expect(calledPath).toContain('lre_download_3_');
    });
});

// ── run() — partial failures & threshold ─────────────────────────────────────

describe('LreScriptDownloadRunner.run() — failure handling', () => {
    const zipBuf = Buffer.from('PK\x03\x04ok');

    test('passes when success rate meets the threshold', async () => {
        // 3 scripts, 1 fails → 66 % > 50 % threshold
        const scripts = [script(1, 'A'), script(2, 'B'), script(3, 'C')];
        mockFetchScriptList.mockResolvedValueOnce(scripts);
        mockDownloadScriptContent
            .mockResolvedValueOnce(zipBuf)
            .mockResolvedValueOnce(null)      // fail
            .mockResolvedValueOnce(zipBuf);
        const runner = makeRunner(1, 50);

        const result = await runner.run();

        expect(result).toBe(true);
    });

    test('fails when success rate is below the threshold', async () => {
        // 3 scripts, 2 fail → 33 % < 50 % threshold
        const scripts = [script(1, 'A'), script(2, 'B'), script(3, 'C')];
        mockFetchScriptList.mockResolvedValueOnce(scripts);
        mockDownloadScriptContent
            .mockResolvedValueOnce(zipBuf)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        const runner = makeRunner(1, 50);

        const result = await runner.run();

        expect(result).toBe(false);
    });

    test('aborts after 5 consecutive failures regardless of threshold', async () => {
        const scripts = Array.from({ length: 10 }, (_, i) => script(i + 1, `S${i + 1}`));
        mockFetchScriptList.mockResolvedValueOnce(scripts);
        mockDownloadScriptContent.mockResolvedValue(null); // all fail
        const runner = makeRunner(1, 0); // threshold 0 — would otherwise pass

        const result = await runner.run();

        expect(result).toBe(false);
        // Should stop after 5 consecutive failures, not download all 10
        expect(mockDownloadScriptContent).toHaveBeenCalledTimes(5);
    });

    test('temp .usz is deleted even when extraction throws', async () => {
        mockFetchScriptList.mockResolvedValueOnce([script(1, 'Bad')]);
        mockDownloadScriptContent.mockResolvedValueOnce(zipBuf);
        mockExtractAllTo.mockImplementationOnce(() => { throw new Error('corrupt zip'); });
        const runner = makeRunner();

        await runner.run(); // must not throw

        expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
    });
});

// ── path mapping ──────────────────────────────────────────────────────────────

describe('LreScriptDownloadRunner — path resolution', () => {
    const zipBuf = Buffer.from('PK\x03\x04x');

    test('strips Subject and appends script name as final directory', async () => {
        mockFetchScriptList.mockResolvedValueOnce([
            script(1, 'MyScript', 'Subject\\folder1\\SubFolder1'),
        ]);
        mockDownloadScriptContent.mockResolvedValueOnce(zipBuf);
        const runner = makeRunner();

        await runner.run();

        const expected = path.join('/workspace', 'folder1', 'SubFolder1', 'MyScript');
        expect(mockExtractAllTo).toHaveBeenCalledWith(expected, true);
    });

    test('handles root-level script (Subject only)', async () => {
        mockFetchScriptList.mockResolvedValueOnce([
            script(2, 'RootScript', 'Subject'),
        ]);
        mockDownloadScriptContent.mockResolvedValueOnce(zipBuf);
        const runner = makeRunner();

        await runner.run();

        const expected = path.join('/workspace', 'RootScript');
        expect(mockExtractAllTo).toHaveBeenCalledWith(expected, true);
    });

    test('handles path without Subject prefix gracefully', async () => {
        mockFetchScriptList.mockResolvedValueOnce([
            script(3, 'S3', 'scripts\\subdir'),
        ]);
        mockDownloadScriptContent.mockResolvedValueOnce(zipBuf);
        const runner = makeRunner();

        await runner.run();

        // No Subject to strip → full path kept
        const expected = path.join('/workspace', 'scripts', 'subdir', 'S3');
        expect(mockExtractAllTo).toHaveBeenCalledWith(expected, true);
    });

    test('normalises forward-slashes to OS separator', async () => {
        mockFetchScriptList.mockResolvedValueOnce([
            script(4, 'FwdSlash', 'Subject/folder/sub'),
        ]);
        mockDownloadScriptContent.mockResolvedValueOnce(zipBuf);
        const runner = makeRunner();

        await runner.run();

        const expected = path.join('/workspace', 'folder', 'sub', 'FwdSlash');
        expect(mockExtractAllTo).toHaveBeenCalledWith(expected, true);
    });
});

// ── concurrency ───────────────────────────────────────────────────────────────

describe('LreScriptDownloadRunner.run() — concurrency', () => {
    test('all scripts are downloaded with concurrency > 1', async () => {
        const zipBuf = Buffer.from('PK\x03\x04c');
        const scripts = Array.from({ length: 6 }, (_, i) => script(i + 1, `Script${i + 1}`));
        mockFetchScriptList.mockResolvedValueOnce(scripts);
        mockDownloadScriptContent.mockResolvedValue(zipBuf);
        const runner = makeRunner(3, 100);

        const result = await runner.run();

        expect(result).toBe(true);
        expect(mockDownloadScriptContent).toHaveBeenCalledTimes(6);
    });
});

