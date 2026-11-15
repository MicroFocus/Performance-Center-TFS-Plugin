import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '../../../shared/utils/Logger';
import { LreSyncConfig, ScriptFolder } from '../../models';
import { LreWorkspaceSyncRunner } from '../LreWorkspaceSyncRunner';

const mockFind = jest.fn();
const mockCompress = jest.fn();
const mockDelete = jest.fn();
const mockAuthenticate = jest.fn();
const mockEnsure = jest.fn();
const mockUpload = jest.fn();
const mockLogout = jest.fn();
const mockExecSync = jest.fn();

jest.mock('azure-pipelines-task-lib/task', () => ({
    debug: jest.fn(), warning: jest.fn(), error: jest.fn(),
}));
jest.mock('../../scanner/WorkspaceScriptFolderScanner', () => ({
    WorkspaceScriptFolderScanner: jest.fn().mockImplementation(() => ({ findScriptFolders: mockFind })),
}));
jest.mock('../ZipFolderCompressor', () => ({
    ZipFolderCompressor: jest.fn().mockImplementation(() => ({
        compressFolder: mockCompress,
        deleteTempZip: mockDelete,
    })),
}));
jest.mock('../LreScriptUploader', () => ({
    LreScriptUploader: jest.fn().mockImplementation(() => ({
        authenticate: mockAuthenticate,
        ensureTestPlanFolderExists: mockEnsure,
        uploadScript: mockUpload,
        logout: mockLogout,
    })),
}));
jest.mock('child_process', () => ({
    ...jest.requireActual('child_process'),
    execSync: (...args: unknown[]) => mockExecSync(...args),
}));

describe('LreWorkspaceSyncRunner', () => {
    let workspace: string;
    let zipPath: string;
    let logger: Logger;
    let config: LreSyncConfig;

    function script(relativePath: string, subjectPath = 'Subject\\scripts'): ScriptFolder {
        const folderName = path.basename(relativePath);
        return {
            fullPath: path.join(workspace, relativePath),
            relativePath,
            folderName,
            zipFileName: `${folderName}.zip`,
            subjectPath,
        };
    }

    beforeEach(() => {
        [mockFind, mockCompress, mockDelete, mockAuthenticate, mockEnsure, mockUpload, mockLogout, mockExecSync]
            .forEach(mock => mock.mockReset());
        workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'lre-runner-test-'));
        zipPath = path.join(workspace, 'test.zip');
        fs.writeFileSync(zipPath, 'zip payload');
        logger = new Logger({ echoToConsole: false });
        config = {
            serverUrl: 'https://lre.example.test',
            domain: 'domain',
            project: 'project',
            username: 'user',
            password: 'password',
            useToken: false,
            runtimeOnly: true,
            workspaceDir: workspace,
            artifactsDir: workspace,
        };
        mockAuthenticate.mockResolvedValue(true);
        mockFind.mockReturnValue([]);
        mockCompress.mockReturnValue(zipPath);
        mockEnsure.mockResolvedValue(undefined);
        mockUpload.mockResolvedValue(123);
        mockLogout.mockResolvedValue(undefined);
    });

    afterEach(() => {
        fs.rmSync(workspace, { recursive: true, force: true });
    });

    test('aborts on authentication failure without scanning or logging out', async () => {
        mockAuthenticate.mockResolvedValue(false);
        const error = jest.spyOn(logger, 'error');
        expect(await new LreWorkspaceSyncRunner(config, logger).run()).toBe(false);
        expect(error).toHaveBeenCalledWith(expect.stringContaining('Authentication failed'));
        expect(mockFind).not.toHaveBeenCalled();
        expect(mockLogout).not.toHaveBeenCalled();
    });

    test('logs out after an empty workspace and does not upload', async () => {
        expect(await new LreWorkspaceSyncRunner(config, logger).run()).toBe(true);
        expect(mockEnsure).not.toHaveBeenCalled();
        expect(mockUpload).not.toHaveBeenCalled();
        expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    test('ensures unique folder paths before uploads and passes metadata and cleans each zip', async () => {
        const folders = [script('scripts/first'), script('scripts/second'), script('elsewhere/third', 'Subject\\other')];
        mockFind.mockReturnValue(folders);
        expect(await new LreWorkspaceSyncRunner(config, logger, 2).run()).toBe(true);
        expect(mockEnsure.mock.calls.map(call => call[0])).toEqual(['Subject\\scripts', 'Subject\\other']);
        expect(mockEnsure.mock.invocationCallOrder[1]).toBeLessThan(mockUpload.mock.invocationCallOrder[0]);
        expect(mockUpload).toHaveBeenCalledTimes(3);
        expect(mockUpload).toHaveBeenCalledWith(zipPath, 'Subject\\scripts', true, 'first.zip', expect.any(Object));
        expect(mockDelete).toHaveBeenCalledTimes(3);
        expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    test.each([
        [50, true],
        [51, false],
        [0, true],
    ])('enforces the %i%% success threshold', async (threshold, expected) => {
        mockFind.mockReturnValue([script('one'), script('two')]);
        mockUpload.mockResolvedValueOnce(7).mockResolvedValueOnce(0);
        expect(await new LreWorkspaceSyncRunner(config, logger, 1, threshold).run()).toBe(expected);
        expect(mockDelete).toHaveBeenCalledTimes(2);
    });

    test.each([
        [1, true],
        [2, false],
    ])('enforces a 99%% threshold with %i failure(s) out of 100 uploads', async (failures, expected) => {
        mockFind.mockReturnValue(Array.from({ length: 100 }, (_, index) => script(`script${index}`)));
        mockUpload.mockImplementation(async () => mockUpload.mock.calls.length <= failures ? 0 : 7);
        expect(await new LreWorkspaceSyncRunner(config, logger, 1, 99).run()).toBe(expected);
        expect(mockUpload).toHaveBeenCalledTimes(100);
    });

    test('handles compression and upload exceptions, cleaning only created zips', async () => {
        mockFind.mockReturnValue([script('one'), script('two')]);
        mockCompress.mockImplementationOnce(() => { throw new Error('compression failure'); });
        mockUpload.mockRejectedValueOnce(new Error('upload failure'));
        const error = jest.spyOn(logger, 'error');
        expect(await new LreWorkspaceSyncRunner(config, logger, 1, 100).run()).toBe(false);
        expect(mockDelete).toHaveBeenCalledTimes(1);
        expect(error).toHaveBeenCalledWith(expect.stringContaining('compression failure'));
        expect(error).toHaveBeenCalledWith(expect.stringContaining('upload failure'));
        expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    test('aborts after five consecutive failures even when threshold is zero', async () => {
        mockFind.mockReturnValue(Array.from({ length: 7 }, (_, index) => script(`script${index}`)));
        mockUpload.mockResolvedValue(0);
        expect(await new LreWorkspaceSyncRunner(config, logger, 1, 0).run()).toBe(false);
        expect(mockUpload).toHaveBeenCalledTimes(5);
        expect(mockDelete).toHaveBeenCalledTimes(5);
    });

    test('applies differential sync to nested script paths without matching sibling prefixes', async () => {
        config.baseCommitSha = '0123456789abcdef';
        mockFind.mockReturnValue([script('scripts/app'), script('scripts/application'), script('scripts/other')]);
        mockExecSync.mockReturnValue('scripts/app/file.usr\nscripts/other/data.txt\n');
        expect(await new LreWorkspaceSyncRunner(config, logger).run()).toBe(true);
        expect(mockExecSync).toHaveBeenCalledWith(
            'git diff --name-only 0123456789abcdef HEAD',
            expect.objectContaining({ cwd: workspace, encoding: 'utf8' }),
        );
        expect(mockCompress.mock.calls.map(call => call[0].folderName)).toEqual(['app', 'other']);
    });

    test('skips uploads when differential sync finds no changed scripts', async () => {
        config.baseCommitSha = '0123456789abcdef';
        mockFind.mockReturnValue([script('scripts/app')]);
        mockExecSync.mockReturnValue('readme.md\n');
        expect(await new LreWorkspaceSyncRunner(config, logger).run()).toBe(true);
        expect(mockEnsure).not.toHaveBeenCalled();
        expect(mockUpload).not.toHaveBeenCalled();
        expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    test('falls back to full sync when git diff fails', async () => {
        config.baseCommitSha = 'invalid-sha';
        mockFind.mockReturnValue([script('one'), script('two')]);
        mockExecSync.mockImplementation(() => { throw new Error('git failed'); });
        const warning = jest.spyOn(logger, 'warning');
        expect(await new LreWorkspaceSyncRunner(config, logger).run()).toBe(true);
        expect(mockUpload).toHaveBeenCalledTimes(2);
        expect(warning).toHaveBeenCalledWith('Falling back to full sync.');
    });

    test('logs out if preparing the remote folder fails', async () => {
        mockFind.mockReturnValue([script('one')]);
        mockEnsure.mockRejectedValue(new Error('folder failure'));
        await expect(new LreWorkspaceSyncRunner(config, logger).run()).rejects.toThrow('folder failure');
        expect(mockUpload).not.toHaveBeenCalled();
        expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    test('does not exceed configured upload concurrency', async () => {
        mockFind.mockReturnValue(Array.from({ length: 5 }, (_, index) => script(`script${index}`)));
        let active = 0;
        let maxActive = 0;
        mockUpload.mockImplementation(async () => {
            active++;
            maxActive = Math.max(maxActive, active);
            await new Promise<void>(resolve => setImmediate(resolve));
            active--;
            return 1;
        });
        expect(await new LreWorkspaceSyncRunner(config, logger, 2).run()).toBe(true);
        expect(maxActive).toBe(2);
        expect(mockUpload).toHaveBeenCalledTimes(5);
    });
});
