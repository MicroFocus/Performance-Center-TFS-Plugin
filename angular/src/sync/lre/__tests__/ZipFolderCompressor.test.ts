import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { Logger } from '../../../shared/utils/Logger';
import { ScriptFolder } from '../../models';
import { ZipFolderCompressor } from '../ZipFolderCompressor';

jest.mock('azure-pipelines-task-lib/task', () => ({
    debug: jest.fn(), warning: jest.fn(), error: jest.fn(),
}));

describe('ZipFolderCompressor', () => {
    let workspace: string;
    let compressor: ZipFolderCompressor;
    let zipPath: string | undefined;

    beforeEach(() => {
        workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'lre-zip-test-'));
        compressor = new ZipFolderCompressor(new Logger({ echoToConsole: false }));
        zipPath = undefined;
    });

    afterEach(() => {
        if (zipPath) compressor.deleteTempZip(zipPath);
        fs.rmSync(workspace, { recursive: true, force: true });
    });

    test('archives nested files with the original script filename and cleans up', () => {
        fs.mkdirSync(path.join(workspace, 'nested'));
        fs.writeFileSync(path.join(workspace, 'scenario.usr'), 'scenario');
        fs.writeFileSync(path.join(workspace, 'nested', 'data.txt'), 'payload');
        const folder: ScriptFolder = {
            fullPath: workspace,
            folderName: 'Script',
            relativePath: 'Script',
            zipFileName: 'Script.zip',
            subjectPath: 'Subject\\Script',
        };

        zipPath = compressor.compressFolder(folder);
        expect(path.basename(zipPath)).toBe('Script.zip');
        const zip = new AdmZip(zipPath);
        expect(zip.getEntries().map(entry => entry.entryName).sort()).toEqual(['nested/data.txt', 'scenario.usr']);
        expect(zip.readAsText('nested/data.txt')).toBe('payload');

        const tempDirectory = path.dirname(zipPath);
        compressor.deleteTempZip(zipPath);
        expect(fs.existsSync(zipPath)).toBe(false);
        expect(fs.existsSync(tempDirectory)).toBe(false);
        zipPath = undefined;
    });

    test('surfaces a missing source directory', () => {
        const folder: ScriptFolder = {
            fullPath: path.join(workspace, 'missing'),
            folderName: 'missing',
            relativePath: 'missing',
            zipFileName: 'missing.zip',
            subjectPath: 'Subject\\missing',
        };
        expect(() => compressor.compressFolder(folder)).toThrow();
    });
});
