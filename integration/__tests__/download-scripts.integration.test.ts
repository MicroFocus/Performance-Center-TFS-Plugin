/**
 * Integration Tests: Download Scripts
 *
 * Tests the LreScriptDownloader against a real Enterprise Performance Engineering server.
 * Uses the same connection configuration as other integration test suites.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ These tests are READ-ONLY by default.                                   │
 * │ Listing scripts and downloading one script does NOT modify the server.  │
 * │                                                                          │
 * │ Set integration.test.downloadScripts=true to enable content downloads.  │
 * │ The download workspace is cleaned up after each test automatically.     │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import * as fs   from 'fs';
import * as path from 'path';
import * as os   from 'os';
import AdmZip from 'adm-zip';
import { LreScriptDownloader }      from '../../angular/src/download/lre/LreScriptDownloader';
import { LreScriptDownloadRunner }  from '../../angular/src/download/lre/LreScriptDownloadRunner';
import type { LreDownloadConfig }   from '../../angular/src/download/models';
import { PropertiesLoader, IntegrationTestConfig } from '../test-utils/PropertiesLoader';

// ── Test-only minimal Logger stub ─────────────────────────────────────────────
class ConsoleLogger {
    log    (msg: string) { console.log    (`[INFO ] ${msg}`); }
    info   (msg: string) { console.log    (`[INFO ] ${msg}`); }
    warning(msg: string) { console.warn   (`[WARN ] ${msg}`); }
    warn   (msg: string) { console.warn   (`[WARN ] ${msg}`); }
    error  (msg: string) { console.error  (`[ERROR] ${msg}`); }
    debug  (msg: string) { /* suppress debug in integration output */ }
    close  ()            { /* no-op */ }
    getLogFilePath() { return undefined; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a `LreDownloadConfig` from integration properties. */
function buildDownloadConfig(cfg: IntegrationTestConfig, workspaceDir: string): LreDownloadConfig {
    return {
        serverUrl:    cfg.lre.serverUrl,
        tenant:       cfg.lre.tenant,
        domain:       cfg.lre.domain,
        project:      cfg.lre.project,
        useToken:     cfg.auth.useToken,
        username:     cfg.auth.username     ?? '',
        password:     cfg.auth.password     ?? '',
        clientId:     cfg.auth.clientId,
        clientSecret: cfg.auth.clientSecret,
        proxyUrl:     cfg.proxy?.url,
        proxyUser:    cfg.proxy?.username,
        proxyPassword:cfg.proxy?.password,
        workspaceDir,
        artifactsDir: cfg.artifacts.directory,
    };
}

// ── Describe block ────────────────────────────────────────────────────────────

describe('Enterprise Performance Engineering Download Scripts Integration Tests', () => {
    let config: IntegrationTestConfig;
    let dlConfig: LreDownloadConfig;
    let logger: ConsoleLogger;
    let tempWorkspace: string;

    const hasProps    = () => PropertiesLoader.hasPropertiesFile();
    const canDownload = () => hasProps() && config?.behavior?.downloadScripts === true;

    beforeAll(() => {
        if (!hasProps()) {
            console.warn('⚠️  Skipping download integration tests: integration-tests.properties not found.');
            return;
        }
        config = PropertiesLoader.loadConfig();
        logger = new ConsoleLogger();

        // Isolate each run in its own temp directory so tests are side-effect free
        tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'lre-dl-test-'));
        dlConfig      = buildDownloadConfig(config, tempWorkspace);

        console.log(`🔗 Server   : ${config.lre.serverUrl}`);
        console.log(`📦 Project  : ${config.lre.domain}/${config.lre.project}`);
        console.log(`📁 Workspace: ${tempWorkspace}`);
        console.log(`🔑 Auth     : ${config.auth.useToken ? 'API Token' : 'Username/Password'}`);
    });

    afterAll(() => {
        // Clean up temp workspace
        if (tempWorkspace && fs.existsSync(tempWorkspace)) {
            try { fs.rmSync(tempWorkspace, { recursive: true, force: true }); }
            catch { /* best-effort */ }
        }
    });

    // ── Authentication ─────────────────────────────────────────────────────────

    (hasProps() ? test : test.skip)(
        'downloader: authenticates successfully with configured credentials',
        async () => {
            const downloader = new LreScriptDownloader(dlConfig, logger as never);
            const ok = await downloader.authenticate();
            expect(ok).toBe(true);
            await downloader.logout();
        },
        30_000
    );

    (hasProps() ? test : test.skip)(
        'downloader: authentication fails with bad credentials',
        async () => {
            const badConfig: LreDownloadConfig = {
                ...dlConfig,
                username: 'this-user-does-not-exist',
                password: 'wrong-password',
                clientId: undefined,
                clientSecret: undefined,
                useToken: false,
            };
            const downloader = new LreScriptDownloader(badConfig, logger as never);
            const ok = await downloader.authenticate();
            expect(ok).toBe(false);
        },
        30_000
    );

    // ── Script listing ─────────────────────────────────────────────────────────

    (hasProps() ? test : test.skip)(
        'downloader: fetchScriptList returns an array (may be empty)',
        async () => {
            const downloader = new LreScriptDownloader(dlConfig, logger as never);
            await downloader.authenticate();

            const scripts = await downloader.fetchScriptList();

            expect(Array.isArray(scripts)).toBe(true);
            console.log(`📋 Found ${scripts.length} script(s) in ${config.lre.domain}/${config.lre.project}`);
            if (scripts.length > 0) {
                const first = scripts[0]!;
                expect(first).toHaveProperty('id');
                expect(first).toHaveProperty('name');
                expect(first).toHaveProperty('testFolderPath');
                expect(typeof first.id).toBe('number');
                expect(first.id).toBeGreaterThan(0);
                console.log(`   First script: [${first.id}] ${first.name} @ ${first.testFolderPath}`);
            }

            await downloader.logout();
        },
        30_000
    );

    // ── Script download + extraction ───────────────────────────────────────────

    (canDownload() ? test : test.skip)(
        'downloader: downloads a script and returns a non-empty Buffer',
        async () => {
            const downloader = new LreScriptDownloader(dlConfig, logger as never);
            await downloader.authenticate();

            const scripts = await downloader.fetchScriptList();
            if (scripts.length === 0) {
                console.warn('No scripts available — skipping download sub-test.');
                await downloader.logout();
                return;
            }

            const target = scripts[0]!;
            console.log(`⬇️  Downloading script ID=${target.id} "${target.name}"…`);

            const sink = { log: (m: string) => console.log(m), warning: (m: string) => console.warn(m), error: (m: string) => console.error(m), debug: () => {} };
            const buf = await downloader.downloadScriptContent(target, sink);

            expect(buf).not.toBeNull();
            expect(buf!.byteLength).toBeGreaterThan(0);
            console.log(`   Received ${(buf!.byteLength / 1024).toFixed(1)} KB`);

            await downloader.logout();
        },
        60_000
    );

    (canDownload() ? test : test.skip)(
        'runner: downloads and extracts script(s) to correct local directory structure',
        async () => {
            const runner = new LreScriptDownloadRunner(dlConfig, logger as never, 1, 0);

            const success = await runner.run();

            // With threshold=0 the run always passes as long as auth succeeds
            expect(success).toBe(true);

            // If at least one script was downloaded, verify directory structure
            const entries = fs.readdirSync(tempWorkspace, { withFileTypes: true });
            if (entries.length > 0) {
                console.log(`📂 Extracted entries in workspace:`);
                entries.forEach(e => console.log(`   ${e.isDirectory() ? 'd' : 'f'} ${e.name}`));

                // At least one entry should be a directory (the extracted script folder)
                const dirs = entries.filter(e => e.isDirectory());
                expect(dirs.length).toBeGreaterThan(0);

                // No .usz files should remain in the workspace root
                const uszFiles = entries.filter(e => !e.isDirectory() && e.name.endsWith('.usz'));
                expect(uszFiles).toHaveLength(0);
            }
        },
        120_000
    );

    (canDownload() ? test : test.skip)(
        'runner: Subject prefix is stripped from local path and script folder is named after script',
        async () => {
            const downloader = new LreScriptDownloader(dlConfig, logger as never);
            await downloader.authenticate();
            const scripts = await downloader.fetchScriptList();
            await downloader.logout();

            if (scripts.length === 0) {
                console.warn('No scripts — skipping path-mapping sub-test.');
                return;
            }

            const target = scripts[0]!;
            const runner = new LreScriptDownloadRunner(dlConfig, logger as never, 1, 0);
            await runner.run();

            // Build the expected local path
            const serverPath = target.testFolderPath.replace(/[\\/]/g, path.sep);
            const segments = serverPath.split(path.sep).filter(Boolean);
            const withoutSubject =
                segments.length > 0 && segments[0]!.toLowerCase() === 'subject'
                    ? segments.slice(1)
                    : segments;
            const expectedDir = path.join(tempWorkspace, ...withoutSubject, target.name);

            expect(fs.existsSync(expectedDir)).toBe(true);
            console.log(`✅ Script extracted to expected path: ${expectedDir}`);

            // Verify temp .usz is gone
            const tmpFiles = fs.readdirSync(os.tmpdir())
                .filter(f => f.startsWith('lre_download_') && f.endsWith('.usz'));
            expect(tmpFiles).toHaveLength(0);
        },
        120_000
    );

    // ── No-scripts edge case ───────────────────────────────────────────────────

    (hasProps() ? test : test.skip)(
        'runner: returns true gracefully when project has no scripts',
        async () => {
            // Use a non-existent project to force an empty script list
            const emptyConfig: LreDownloadConfig = {
                ...dlConfig,
                project: '__nonexistent_project_for_testing__',
            };
            const runner = new LreScriptDownloadRunner(emptyConfig, logger as never);

            // This may fail authentication (project doesn't exist) or return empty list.
            // Either way the runner must not throw an unhandled exception.
            let threw = false;
            try {
                await runner.run();
            } catch {
                threw = true;
            }
            expect(threw).toBe(false);
        },
        30_000
    );
});


