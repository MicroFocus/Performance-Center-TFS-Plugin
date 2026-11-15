/**
 * Offline unit tests for LreScriptUploader.
 *
 * The uploader keeps its real XML parser and multipart builder, while its HTTP
 * factory supplies an Axios instance with mocked request methods.
 */

import axios from 'axios';
import * as fs from 'fs';
import type { Readable } from 'stream';
import { CookieJar } from 'tough-cookie';
import { LreScriptUploader } from '../LreScriptUploader';
import type { LreSyncConfig } from '../../models';
import { Logger } from '../../../shared/utils/Logger';
import * as httpUtils from '../../../shared/utils/LreHttpUtils';

jest.mock('azure-pipelines-task-lib/task', () => ({
    debug: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
}));

const BASE_CONFIG: LreSyncConfig = {
    serverUrl: 'https://lre.example.test',
    tenant: 'tenant-a',
    useToken: false,
    username: 'test-user',
    password: 'test-password',
    domain: 'DOMAIN',
    project: 'PROJECT',
    workspaceDir: '.',
    runtimeOnly: false,
    artifactsDir: '.',
};

function makeUploader(config: LreSyncConfig = BASE_CONFIG) {
    const logger = new Logger({ echoToConsole: false });
    jest.spyOn(logger, 'log');
    jest.spyOn(logger, 'warning');
    jest.spyOn(logger, 'error');
    jest.spyOn(logger, 'debug');
    const client = axios.create();
    const get = jest.fn();
    const post = jest.fn();
    client.get = get;
    client.post = post;
    jest.spyOn(httpUtils, 'createLreAxiosInstance').mockReturnValue({
        httpClient: client,
        cookieJar: new CookieJar(),
    });
    const uploader = new LreScriptUploader(config, logger);
    const http = { get, post, defaults: client.defaults };
    return { uploader, http, logger };
}

function response(data: unknown = '', status = 200, headers: Record<string, string | string[]> = {}) {
    return { data, status, headers };
}

const sink = {
    log: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

function multipartParts(form: unknown): Array<string | Readable | (() => void)> {
    return (form as { _streams: Array<string | Readable | (() => void)> })._streams;
}

async function drainFileStream(form: unknown): Promise<void> {
    const stream = multipartParts(form).find(part => part instanceof fs.ReadStream);
    if (stream instanceof fs.ReadStream) {
        await new Promise<void>((resolve, reject) => {
            stream.once('end', resolve);
            stream.once('error', reject);
            stream.resume();
        });
    }
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('LreScriptUploader authentication and session', () => {
    test('authenticates with Basic credentials, pins cookies, and clears them on logout', async () => {
        const { uploader, http } = makeUploader();
        http.get
            .mockResolvedValueOnce(response('', 200, {
                'set-cookie': ['SESSION=abc; Path=/', 'OTHER=xyz; HttpOnly'],
            }))
            .mockResolvedValueOnce(response());

        expect(await uploader.authenticate()).toBe(true);

        expect(http.get).toHaveBeenNthCalledWith(
            1,
            'https://lre.example.test/LoadTest/rest/authentication-point/authenticate/?tenant=tenant-a',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: `Basic ${Buffer.from('test-user:test-password').toString('base64')}`,
                    'Content-Type': 'application/xml',
                }),
            }),
        );
        expect(http.defaults.headers.common.Cookie).toBe('SESSION=abc; OTHER=xyz');

        await uploader.logout();

        expect(http.get).toHaveBeenNthCalledWith(
            2,
            'https://lre.example.test/LoadTest/rest/authentication-point/logout/?tenant=tenant-a',
        );
        expect(http.defaults.headers.common.Cookie).toBeUndefined();
        expect(await uploader.logout()).toBeUndefined();
        expect(http.get).toHaveBeenCalledTimes(2);
    });

    test('uses the token endpoint and XML credentials; a 4xx response is not retried', async () => {
        const { uploader, http } = makeUploader({
            ...BASE_CONFIG,
            useToken: true,
            clientId: 'id<&',
            clientSecret: 'secret&>',
        });
        http.post.mockResolvedValueOnce(response('Forbidden', 403));

        expect(await uploader.authenticate()).toBe(false);

        expect(http.post).toHaveBeenCalledTimes(1);
        expect(http.post).toHaveBeenCalledWith(
            'https://lre.example.test/LoadTest/rest/authentication-point/authenticateclient/?tenant=tenant-a',
            expect.stringContaining('<ClientIdKey>id&lt;&amp;</ClientIdKey>'),
            { headers: { 'Content-Type': 'application/xml' } },
        );
        expect(http.post.mock.calls[0][1]).toContain('<ClientSecretKey>secret&amp;&gt;</ClientSecretKey>');
    });

    test('retries a transient server response and succeeds on the next attempt', async () => {
        jest.useFakeTimers();
        const { uploader, http } = makeUploader();
        http.get
            .mockResolvedValueOnce(response('', 503))
            .mockResolvedValueOnce(response('', 200));

        const auth = uploader.authenticate();
        await jest.runAllTimersAsync();

        expect(await auth).toBe(true);
        expect(http.get).toHaveBeenCalledTimes(2);
    });

    test('stops after the configured transient-authentication retries', async () => {
        jest.useFakeTimers();
        const { uploader, http } = makeUploader();
        http.get.mockRejectedValue(new Error('ECONNRESET'));

        const auth = uploader.authenticate();
        await jest.runAllTimersAsync();

        expect(await auth).toBe(false);
        expect(http.get).toHaveBeenCalledTimes(5);
    });
});

describe('LreScriptUploader test plan folders', () => {
    test('creates missing path segments and caches the fetched folder list', async () => {
        const { uploader, http } = makeUploader();
        http.get.mockResolvedValueOnce(response(
            '<TestPlanFolders><TestPlanFolder><FullPath>Subject</FullPath></TestPlanFolder>' +
            '<TestPlanFolder><FullPath>Subject\\Existing</FullPath></TestPlanFolder></TestPlanFolders>',
        ));
        http.post.mockResolvedValue(response('', 201));

        await uploader.ensureTestPlanFolderExists('Subject\\existing\\New & <Folder>');
        await uploader.ensureTestPlanFolderExists('Subject\\existing\\New & <Folder>\\Child');

        expect(http.get).toHaveBeenCalledTimes(1);
        expect(http.get).toHaveBeenCalledWith(
            'https://lre.example.test/LoadTest/rest/domains/DOMAIN/projects/PROJECT/testplan',
        );
        expect(http.post).toHaveBeenCalledTimes(2);
        expect(http.post).toHaveBeenNthCalledWith(
            1,
            'https://lre.example.test/LoadTest/rest/domains/DOMAIN/projects/PROJECT/testplan',
            expect.stringContaining('<Path>Subject\\existing</Path><Name>New &amp; &lt;Folder&gt;</Name>'),
            { headers: { 'Content-Type': 'application/xml' } },
        );
        expect(http.post).toHaveBeenNthCalledWith(
            2,
            'https://lre.example.test/LoadTest/rest/domains/DOMAIN/projects/PROJECT/testplan',
            expect.stringContaining('<Path>Subject\\existing\\New &amp; &lt;Folder&gt;</Path><Name>Child</Name>'),
            { headers: { 'Content-Type': 'application/xml' } },
        );
    });

    test('stops creating descendants when a missing parent folder cannot be created', async () => {
        const { uploader, http, logger } = makeUploader();
        http.get.mockResolvedValueOnce(response('<TestPlanFolders><TestPlanFolder><FullPath>Subject</FullPath></TestPlanFolder></TestPlanFolders>'));
        http.post.mockResolvedValueOnce(response('forbidden', 403));

        await uploader.ensureTestPlanFolderExists('Subject\\parent\\child');

        expect(http.post).toHaveBeenCalledTimes(1);
        expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining("Could not create folder 'Subject\\parent'"));
    });
});

describe('LreScriptUploader multipart upload', () => {
    test('uploads a real multipart form with script metadata and returns a JSON script ID', async () => {
        const { uploader, http } = makeUploader();
        let capturedForm: unknown;
        http.post.mockImplementation(async (_url: string, form: unknown, options: { headers: Record<string, string>; timeout: number }) => {
            capturedForm = form;
            expect(options.timeout).toBe(300_000);
            expect(options.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
            await drainFileStream(form);
            return response({ ID: 123 }, 201);
        });

        const id = await uploader.uploadScript(
            __filename,
            'Subject\\scripts\\A&B',
            true,
            'A&B.zip',
            sink,
        );

        expect(id).toBe(123);
        expect(http.post).toHaveBeenCalledTimes(1);
        expect(http.post.mock.calls[0][0]).toBe(
            'https://lre.example.test/LoadTest/rest/domains/DOMAIN/projects/PROJECT/Scripts',
        );
        const parts = multipartParts(capturedForm);
        expect(parts.some(part => typeof part === 'string' && part.includes('filename="A&B.zip"'))).toBe(true);
        expect(parts.some(part => typeof part === 'string' && part.includes(
            '<TestFolderPath>Subject\\scripts\\A&amp;B</TestFolderPath><Overwrite>true</Overwrite>' +
            '<RuntimeOnly>true</RuntimeOnly><KeepCheckedOut>false</KeepCheckedOut>',
        ))).toBe(true);
    });

    test('retries an HTTP 5xx upload response and parses an XML script ID', async () => {
        jest.useFakeTimers();
        const { uploader, http } = makeUploader();
        http.post.mockImplementation(async (_url: string, form: unknown) => {
            await drainFileStream(form);
            return http.post.mock.calls.length === 1
                ? response('unavailable', 503)
                : response('<Script><ID>456</ID></Script>', 200);
        });

        const upload = uploader.uploadScript(__filename, 'Subject\\scripts', false, 'Script.zip', sink);
        await jest.runAllTimersAsync();

        expect(await upload).toBe(456);
        expect(http.post).toHaveBeenCalledTimes(2);
    });

    test('re-authenticates immediately when a successful upload has no ID', async () => {
        const { uploader, http } = makeUploader();
        http.post.mockImplementation(async (_url: string, form: unknown) => {
            await drainFileStream(form);
            return http.post.mock.calls.length === 1
                ? response('<Script/>', 200)
                : response({ ID: 789 }, 201);
        });
        http.get.mockResolvedValueOnce(response('', 200, { 'set-cookie': ['SESSION=fresh; Path=/'] }));

        expect(await uploader.uploadScript(__filename, 'Subject\\scripts', false, 'Script.zip', sink)).toBe(789);

        expect(http.get).toHaveBeenCalledTimes(1);
        expect(http.get.mock.calls[0][0]).toContain('/authentication-point/authenticate');
        expect(http.post).toHaveBeenCalledTimes(2);
        expect(http.defaults.headers.common.Cookie).toBe('SESSION=fresh');
    });
});
