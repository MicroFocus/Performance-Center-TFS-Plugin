import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '../../../shared/utils/Logger';
import { WorkspaceScriptFolderScanner } from '../WorkspaceScriptFolderScanner';

jest.mock('azure-pipelines-task-lib/task', () => ({
    debug: jest.fn(), warning: jest.fn(), error: jest.fn(),
}));

describe('WorkspaceScriptFolderScanner', () => {
    let workspace: string;
    let logger: Logger;
    let scanner: WorkspaceScriptFolderScanner;

    function file(relativePath: string): void {
        const absolute = path.join(workspace, relativePath);
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, 'test');
    }

    beforeEach(() => {
        workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'lre-scan-test-'));
        logger = new Logger({ echoToConsole: false });
        scanner = new WorkspaceScriptFolderScanner(logger);
    });

    afterEach(() => {
        fs.rmSync(workspace, { recursive: true, force: true });
    });

    test('detects supported extensions case-insensitively with correct subject paths', () => {
        file('Load/test.USR');
        file('scripts/Group/jmeter/plan.JMX');
        file('scripts/Group/gatling/test.scala');
        file('scripts/Group/java/Test.JAVA');
        file('scripts/Group/ignored/note.txt');

        const folders = scanner.findScriptFolders(workspace);
        expect(folders).toHaveLength(4);
        expect(folders).toEqual(expect.arrayContaining([
            {
                fullPath: path.join(workspace, 'Load'),
                relativePath: 'Load',
                folderName: 'Load',
                zipFileName: 'Load.zip',
                subjectPath: 'Subject\\Load',
            },
            expect.objectContaining({
                folderName: 'jmeter',
                relativePath: path.join('scripts', 'Group'),
                subjectPath: 'Subject\\scripts\\Group',
                zipFileName: 'jmeter.zip',
            }),
            expect.objectContaining({ folderName: 'gatling' }),
            expect.objectContaining({ folderName: 'java' }),
        ]));
    });

    test('requires both DevWeb files and prunes nested scripts', () => {
        file('DevWeb/MAIN.JS');
        file('DevWeb/RTS.YML');
        file('DevWeb/nested/another.usr');
        file('Incomplete/main.js');
        file('Other/rts.yml');

        expect(scanner.findScriptFolders(workspace).map(folder => folder.folderName)).toEqual(['DevWeb']);
    });

    test('returns an empty result and logs an error for a missing or non-directory workspace', () => {
        const error = jest.spyOn(logger, 'error');
        file('ordinary.txt');
        expect(scanner.findScriptFolders(path.join(workspace, 'missing'))).toEqual([]);
        expect(scanner.findScriptFolders(path.join(workspace, 'ordinary.txt'))).toEqual([]);
        expect(error).toHaveBeenCalledTimes(2);
    });
});
