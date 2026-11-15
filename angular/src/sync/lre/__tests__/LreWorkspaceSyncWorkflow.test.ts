import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { Logger } from '../../../shared/utils/Logger';
import { LreSyncConfig } from '../../models';
import { LreWorkspaceSyncRunner } from '../LreWorkspaceSyncRunner';

const mockAuthenticate = jest.fn();
const mockEnsure = jest.fn();
const mockUpload = jest.fn();
const mockLogout = jest.fn();

jest.mock('azure-pipelines-task-lib/task', () => ({
    debug: jest.fn(), warning: jest.fn(), error: jest.fn(),
}));
jest.mock('../LreScriptUploader', () => ({
    LreScriptUploader: jest.fn().mockImplementation(() => ({
        authenticate: mockAuthenticate,
        ensureTestPlanFolderExists: mockEnsure,
        uploadScript: mockUpload,
        logout: mockLogout,
    })),
}));

test('scans a workspace, archives each script, uploads it and cleans up', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'lre-workflow-test-'));
    const logger = new Logger({ echoToConsole: false });
    const config: LreSyncConfig = {
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
    const uploaded: Array<{ zip: string; subject: string; name: string; entries: string[] }> = [];
    mockAuthenticate.mockResolvedValue(true);
    mockEnsure.mockResolvedValue(undefined);
    mockLogout.mockResolvedValue(undefined);
    mockUpload.mockImplementation(async (zip: string, subject: string, runtimeOnly: boolean, name: string) => {
        expect(runtimeOnly).toBe(true);
        const archive = new AdmZip(zip);
        uploaded.push({ zip, subject, name, entries: archive.getEntries().map(entry => entry.entryName).sort() });
        return uploaded.length;
    });

    try {
        fs.mkdirSync(path.join(workspace, 'scripts', 'checkout', 'data'), { recursive: true });
        fs.writeFileSync(path.join(workspace, 'scripts', 'checkout', 'checkout.usr'), 'script');
        fs.writeFileSync(path.join(workspace, 'scripts', 'checkout', 'data', 'input.csv'), 'input');
        fs.mkdirSync(path.join(workspace, 'web'));
        fs.writeFileSync(path.join(workspace, 'web', 'main.js'), 'main');
        fs.writeFileSync(path.join(workspace, 'web', 'rts.yml'), 'rts');
        fs.writeFileSync(path.join(workspace, 'ignore.txt'), 'not a script');

        expect(await new LreWorkspaceSyncRunner(config, logger).run()).toBe(true);
        expect(mockEnsure.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining(['Subject\\scripts', 'Subject\\web']));
        expect(uploaded).toHaveLength(2);
        expect(uploaded).toEqual(expect.arrayContaining([
            expect.objectContaining({ subject: 'Subject\\scripts', name: 'checkout.zip', entries: ['checkout.usr', 'data/input.csv'] }),
            expect.objectContaining({ subject: 'Subject\\web', name: 'web.zip', entries: ['main.js', 'rts.yml'] }),
        ]));
        for (const upload of uploaded) {
            expect(fs.existsSync(upload.zip)).toBe(false);
            expect(fs.existsSync(path.dirname(upload.zip))).toBe(false);
        }
        expect(mockLogout).toHaveBeenCalledTimes(1);
    } finally {
        fs.rmSync(workspace, { recursive: true, force: true });
    }
});
