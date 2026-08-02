import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { LreClient }              from '../../angular/src/ci/lre/LreClient';
import { LreConfig, PostRunAction } from '../../angular/src/ci/models';
import { LreScriptDownloader }    from '../../angular/src/download/lre/LreScriptDownloader';
import type { LreDownloadConfig } from '../../angular/src/download/models';
import { LreScriptUploader }      from '../../angular/src/sync/lre/LreScriptUploader';
import type { LreSyncConfig }     from '../../angular/src/sync/models';
import { LreTestCreator }         from '../../angular/src/ci/lre/LreTestCreator';
import { PropertiesLoader, IntegrationTestConfig } from './PropertiesLoader';
import globalSetup    from './global-setup';
import globalTeardown from './global-teardown';

// ── Constants ─────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '../..');
const SAFE_MODE = process.env['INTEGRATION_SAFE_MODE'] === 'true';

// Track overall results
const results: { name: string; status: 'PASS' | 'FAIL' | 'SKIP'; detail?: string }[] = [];

// ── Minimal logger for non-CI-task classes ────────────────────────────────────

class StdoutLogger {
    log    (msg: string) { console.log  (`  ${msg}`); }
    info   (msg: string) { console.log  (`  ${msg}`); }
    warning(msg: string) { console.warn (`  WARN: ${msg}`); }
    warn   (msg: string) { console.warn (`  WARN: ${msg}`); }
    error  (msg: string) { console.error(`  ERROR: ${msg}`); }
    debug  (msg: string) { /* suppress */ }
    close  ()            { /* no-op */ }
    getLogFilePath() { return undefined as string | undefined; }
}

// ── Result helpers ────────────────────────────────────────────────────────────

function pass(name: string, detail?: string): void {
    results.push({ name, status: 'PASS', detail });
    console.log(`  ✅ PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string): void {
    results.push({ name, status: 'FAIL', detail });
    console.error(`  ❌ FAIL  ${name} — ${detail}`);
}

function skip(name: string, reason: string): void {
    results.push({ name, status: 'SKIP', detail: reason });
    console.log(`  ⏭️  SKIP  ${name} — ${reason}`);
}

// ── Config helpers ────────────────────────────────────────────────────────────

function tokenConfig(cfg: IntegrationTestConfig): LreConfig {
    return {
        serverUrl:    cfg.lre.serverUrl,
        domain:       cfg.lre.domain,
        project:      cfg.lre.project,
        tenant:       cfg.lre.tenant,
        useToken:     true,
        clientId:     cfg.auth.clientId,
        clientSecret: cfg.auth.clientSecret,
        proxyUrl:     cfg.proxy?.url,
        proxyUser:    cfg.proxy?.username,
        proxyPassword:cfg.proxy?.password
    };
}

function passwordConfig(cfg: IntegrationTestConfig): LreConfig {
    return {
        serverUrl:    cfg.lre.serverUrl,
        domain:       cfg.lre.domain,
        project:      cfg.lre.project,
        tenant:       cfg.lre.tenant,
        useToken:     false,
        username:     cfg.auth.username,
        password:     cfg.auth.password,
        proxyUrl:     cfg.proxy?.url,
        proxyUser:    cfg.proxy?.username,
        proxyPassword:cfg.proxy?.password
    };
}

function resolveArtifactsDirectory(rel: string): string {
    return path.isAbsolute(rel) ? rel : path.resolve(REPO_ROOT, rel);
}

// ── Assertion wrappers ────────────────────────────────────────────────────────

async function check(name: string, fn: () => Promise<void>): Promise<void> {
    try {
        await fn();
        pass(name);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        fail(name, msg);
    }
}

// ── ════════════════════════════════════════════════════════════════════════════
// ── 1. LreCiTask — LreClient
// ── ════════════════════════════════════════════════════════════════════════════

async function runCiTaskChecks(cfg: IntegrationTestConfig): Promise<void> {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(' LreCiTask — LreClient');
    console.log('══════════════════════════════════════════════════════════════');

    // ── Token auth ────────────────────────────────────────────────────────────
    if (cfg.auth.clientId && cfg.auth.clientSecret) {
        console.log('\n[ci/token] Token authentication checks…');
        const lreCfgToken = tokenConfig(cfg);

        await check('[ci/token] authenticate (token)', async () => {
            const client = new LreClient(lreCfgToken);
            const ok = await client.authenticate();
            assert.equal(ok, true, 'Expected token auth to succeed');
            assert.equal(client.isLoggedIn(), true);
            await client.logout();
            assert.equal(client.isLoggedIn(), false);
        });

        await check('[ci/token] reject invalid token secret', async () => {
            const bad = { ...lreCfgToken, clientSecret: 'invalid-secret-xyz' };
            const client = new LreClient(bad);
            const ok = await client.authenticate();
            assert.equal(ok, false, 'Expected invalid token to be rejected');
        });

        await check('[ci/token] getTest after token auth', async () => {
            const client = new LreClient(lreCfgToken);
            assert.equal(await client.authenticate(), true);
            const t = await client.getTest(cfg.test.id);
            assert.ok(t, `Expected test ${cfg.test.id} to exist`);
            assert.equal(Number(t!.ID), cfg.test.id);
            console.log(`         test name: "${t!.Name}"`);
            await client.logout();
        });
    } else {
        skip('[ci/token] token auth checks', 'pc.lre.idKey / pc.lre.secretKey not configured');
    }

    // ── Password auth ─────────────────────────────────────────────────────────
    if (cfg.auth.username && cfg.auth.password) {
        console.log('\n[ci/password] Password authentication checks…');
        const lreCfgPwd = passwordConfig(cfg);

        await check('[ci/password] authenticate (password)', async () => {
            const client = new LreClient(lreCfgPwd);
            const ok = await client.authenticate();
            assert.equal(ok, true, 'Expected password auth to succeed');
            assert.equal(client.isLoggedIn(), true);
            await client.logout();
        });

        await check('[ci/password] reject wrong password', async () => {
            const bad = { ...lreCfgPwd, password: 'wrong-password-xyz' };
            const client = new LreClient(bad);
            const ok = await client.authenticate();
            assert.equal(ok, false, 'Expected wrong password to be rejected');
        });

        await check('[ci/password] getTest after password auth', async () => {
            const client = new LreClient(lreCfgPwd);
            assert.equal(await client.authenticate(), true);
            const t = await client.getTest(cfg.test.id);
            assert.ok(t, `Expected test ${cfg.test.id} to exist`);
            assert.equal(Number(t!.ID), cfg.test.id);
            await client.logout();
        });
    } else {
        skip('[ci/password] password auth checks', 'pc.alm.user / pc.alm.password not configured');
    }

    // ── Task operation: test management ──────────────────────────────────────
    console.log('\n[ci/task] Test management operations…');
    const activeCfg = cfg.auth.clientId ? tokenConfig(cfg) : passwordConfig(cfg);

    await check('[ci/task] getTest', async () => {
        const client = new LreClient(activeCfg);
        assert.equal(await client.authenticate(), true);
        const t = await client.getTest(cfg.test.id);
        assert.ok(t);
        assert.equal(Number(t!.ID), cfg.test.id);
        await client.logout();
    });

    await check('[ci/task] getTestInstances', async () => {
        const client = new LreClient(activeCfg);
        assert.equal(await client.authenticate(), true);
        const instances = await client.getTestInstances(cfg.test.id);
        assert.ok(instances);
        assert.ok(Array.isArray(instances!.TestInstancesList));
        console.log(`         ${instances!.TestInstancesList.length} instance(s) found`);
        await client.logout();
    });

    await check('[ci/task] getTestSetFolders includes Root', async () => {
        const client = new LreClient(activeCfg);
        assert.equal(await client.authenticate(), true);
        const folders = await client.getTestSetFolders();
        assert.ok(folders);
        assert.ok(Array.isArray(folders!.TestSetFoldersList));
        const root = folders!.TestSetFoldersList.find(
            f => (f.TestSetFolderName ?? '').toLowerCase() === 'root'
        );
        assert.ok(root, 'Expected a "Root" folder');
        console.log(`         Root folder ID: ${root!.TestSetFolderId}`);
        await client.logout();
    });

    await check('[ci/task] createTestSetFolder + createTestSet + createTestInstance', async () => {
        const client = new LreClient(activeCfg);
        assert.equal(await client.authenticate(), true);

        const folders = await client.getTestSetFolders();
        const root = folders!.TestSetFoldersList.find(
            f => (f.TestSetFolderName ?? '').toLowerCase() === 'root'
        );
        assert.ok(root, 'Root folder not found');

        const folderId = await client.createTestSetFolder(`IT-Folder-${Date.now()}`, root!.TestSetFolderId);
        assert.ok(folderId != null && folderId >= 0, `Expected folder ID >= 0, got ${folderId}`);

        const setId = await client.createTestSet(`IT-TestSet-${Date.now()}`, folderId!);
        assert.ok(setId, `Expected test set ID, got ${setId}`);

        const instanceId = await client.createTestInstance(cfg.test.id, setId!);
        assert.ok(instanceId, `Expected test instance ID, got ${instanceId}`);
        console.log(`         folder=${folderId}, set=${setId}, instance=${instanceId}`);

        await client.logout();
    });

    // ── Task operation: YAML test creation ───────────────────────────────────
    if (cfg.behavior.createTestFromYaml && cfg.yaml) {
        console.log('\n[ci/yaml] YAML test creation…');
        const yamlFilePath = path.join(cfg.yaml.workspaceDir, cfg.yaml.testFile);

        if (!fs.existsSync(yamlFilePath)) {
            fail('[ci/yaml] create test from YAML', `YAML file not found: ${yamlFilePath}`);
        } else {
            await check('[ci/yaml] create/update test from YAML', async () => {
                const client = new LreClient(activeCfg);
                assert.equal(await client.authenticate(), true, 'Auth failed before YAML test creation');

                const creator = new LreTestCreator(client);
                const testId = await creator.createOrUpdateFromFile(
                    yamlFilePath,
                    cfg.yaml!.workspaceDir
                );
                assert.ok(testId > 0, `Expected a positive test ID from YAML creation, got ${testId}`);
                console.log(`         YAML test ID: ${testId} (folder: ${cfg.yaml!.testFolderPath})`);
                await client.logout();
            });
        }
    } else {
        skip('[ci/yaml] YAML test creation', 'integration.test.createTestFromYaml=false or yaml config missing');
    }

    // ── Task operation: run execution (optional) ──────────────────────────────
    if (!SAFE_MODE && cfg.behavior.executeRun) {
        console.log('\n[ci/run] Run execution…');
        await check('[ci/run] startRun + getRunData + stopRun', async () => {
            const client = new LreClient(activeCfg);
            assert.equal(await client.authenticate(), true);

            const tiid = cfg.test.testInstanceId
                ?? (await client.createTestInstance(cfg.test.id, cfg.test.testSetId) ?? undefined);
            assert.ok(tiid, 'No test instance available');

            const runResp = await client.startRun(
                cfg.test.id, tiid!,
                { Minutes: cfg.run.timeslotDurationMinutes },
                cfg.run.postRunAction as PostRunAction,
                cfg.run.useVuds
            );
            assert.ok(runResp?.ID, 'Expected run ID');
            console.log(`         Run ${runResp!.ID} started`);

            const runData = await client.getRunData(runResp!.ID);
            assert.ok(runData, 'Expected run data');

            if (cfg.behavior.testCleanup) {
                await client.stopRun(runResp!.ID, 'Do Not Collate');
                console.log(`         Run ${runResp!.ID} stopped`);
            }
            await client.logout();
        });
    } else {
        skip('[ci/run] run execution', SAFE_MODE ? 'SAFE_MODE=true' : 'integration.test.executeRun=false');
    }
}

// ── ════════════════════════════════════════════════════════════════════════════
// ── 2. LreDownloadScriptsTask — LreScriptDownloader
// ── ════════════════════════════════════════════════════════════════════════════

async function runDownloadScriptsChecks(cfg: IntegrationTestConfig): Promise<void> {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(' LreDownloadScriptsTask — LreScriptDownloader');
    console.log('══════════════════════════════════════════════════════════════');

    const logger = new StdoutLogger();

    function makeDownloadConfig(authOverride: Partial<LreDownloadConfig>, workspaceDir: string): LreDownloadConfig {
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
            artifactsDir: resolveArtifactsDirectory(cfg.artifacts.directory),
            ...authOverride
        };
    }

    const tempBase = cfg.download.workspaceDir || path.join(os.tmpdir(), 'lre-dl-inttest');
    const tempWs = path.join(tempBase, `run-${Date.now()}`);
    fs.mkdirSync(tempWs, { recursive: true });

    // ── Token auth ────────────────────────────────────────────────────────────
    if (cfg.auth.clientId && cfg.auth.clientSecret) {
        console.log('\n[dl/token] Token authentication checks…');
        const tokenDlCfg = makeDownloadConfig({ useToken: true }, tempWs);

        await check('[dl/token] authenticate (token)', async () => {
            const dl = new LreScriptDownloader(tokenDlCfg, logger as never);
            const ok = await dl.authenticate();
            assert.equal(ok, true, 'Expected token auth to succeed');
            await dl.logout();
        });

        await check('[dl/token] reject invalid token secret', async () => {
            const bad = makeDownloadConfig({ useToken: true, clientSecret: 'invalid-secret-xyz' }, tempWs);
            const dl = new LreScriptDownloader(bad, logger as never);
            const ok = await dl.authenticate();
            assert.equal(ok, false, 'Expected invalid token to be rejected');
        });
    } else {
        skip('[dl/token] token auth checks', 'token credentials not configured');
    }

    // ── Password auth ─────────────────────────────────────────────────────────
    if (cfg.auth.username && cfg.auth.password) {
        console.log('\n[dl/password] Password authentication checks…');
        const pwdDlCfg = makeDownloadConfig({ useToken: false }, tempWs);

        await check('[dl/password] authenticate (password)', async () => {
            const dl = new LreScriptDownloader(pwdDlCfg, logger as never);
            const ok = await dl.authenticate();
            assert.equal(ok, true, 'Expected password auth to succeed');
            await dl.logout();
        });

        await check('[dl/password] reject wrong password', async () => {
            const bad = makeDownloadConfig({ useToken: false, password: 'wrong-password-xyz' }, tempWs);
            const dl = new LreScriptDownloader(bad, logger as never);
            const ok = await dl.authenticate();
            assert.equal(ok, false, 'Expected wrong password to be rejected');
        });
    } else {
        skip('[dl/password] password auth checks', 'username/password not configured');
    }

    // ── Task operation: fetch script list ─────────────────────────────────────
    const activeDlCfg = makeDownloadConfig({
        useToken:     !!cfg.auth.clientId,
        clientId:     cfg.auth.clientId,
        clientSecret: cfg.auth.clientSecret
    }, tempWs);

    await check('[dl/task] fetchScriptList', async () => {
        const dl = new LreScriptDownloader(activeDlCfg, logger as never);
        assert.equal(await dl.authenticate(), true);
        const scripts = await dl.fetchScriptList();
        assert.ok(Array.isArray(scripts));
        console.log(`         ${scripts.length} script(s) in ${cfg.lre.domain}/${cfg.lre.project}`);
        if (scripts.length > 0) {
            console.log(`         First: [${scripts[0]!.id}] ${scripts[0]!.name} @ ${scripts[0]!.testFolderPath}`);
        }
        await dl.logout();
    });

    // ── Task operation: download content ─────────────────────────────────────
    if (cfg.behavior.downloadScripts) {
        await check('[dl/task] downloadScriptContent (first script)', async () => {
            const dl = new LreScriptDownloader(activeDlCfg, logger as never);
            assert.equal(await dl.authenticate(), true);

            const scripts = await dl.fetchScriptList();
            if (scripts.length === 0) {
                console.log('         No scripts in project — skipping download sub-check');
                await dl.logout();
                return;
            }

            const target = scripts[0]!;
            console.log(`         Downloading script ID=${target.id} "${target.name}"…`);
            const sink = { log: (m: string) => console.log(`  ${m}`), warning: (m: string) => console.warn(`  ${m}`), error: (m: string) => console.error(`  ${m}`), debug: () => {} };
            const buf = await dl.downloadScriptContent(target, sink);
            assert.ok(buf !== null, 'Expected non-null buffer');
            assert.ok(buf!.byteLength > 0, 'Expected non-empty buffer');
            console.log(`         Received ${(buf!.byteLength / 1024).toFixed(1)} KB`);
            await dl.logout();
        });
    } else {
        skip('[dl/task] downloadScriptContent', 'integration.test.downloadScripts=false');
    }

    // Clean up temp workspace
    try { fs.rmSync(tempWs, { recursive: true, force: true }); } catch { /* best-effort */ }
}

// ── ════════════════════════════════════════════════════════════════════════════
// ── 3. LreWorkspaceSyncTask — LreScriptUploader
// ── ════════════════════════════════════════════════════════════════════════════

async function runWorkspaceSyncChecks(cfg: IntegrationTestConfig): Promise<void> {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(' LreWorkspaceSyncTask — LreScriptUploader');
    console.log('══════════════════════════════════════════════════════════════');

    const logger = new StdoutLogger();

    function makeSyncConfig(authOverride: Partial<LreSyncConfig>): LreSyncConfig {
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
            workspaceDir: cfg.sync?.workspaceDir ?? '',
            runtimeOnly:  false,
            artifactsDir: resolveArtifactsDirectory(cfg.artifacts.directory),
            ...authOverride
        };
    }

    // ── Token auth ────────────────────────────────────────────────────────────
    if (cfg.auth.clientId && cfg.auth.clientSecret) {
        console.log('\n[sync/token] Token authentication checks…');
        const tokenSyncCfg = makeSyncConfig({ useToken: true });

        await check('[sync/token] authenticate (token)', async () => {
            const uploader = new LreScriptUploader(tokenSyncCfg, logger as never);
            const ok = await uploader.authenticate();
            assert.equal(ok, true, 'Expected token auth to succeed');
            await uploader.logout();
        });

        await check('[sync/token] reject invalid token secret', async () => {
            const bad = makeSyncConfig({ useToken: true, clientSecret: 'invalid-secret-xyz' });
            const uploader = new LreScriptUploader(bad, logger as never);
            const ok = await uploader.authenticate();
            assert.equal(ok, false, 'Expected invalid token to be rejected');
        });
    } else {
        skip('[sync/token] token auth checks', 'token credentials not configured');
    }

    // ── Password auth ─────────────────────────────────────────────────────────
    if (cfg.auth.username && cfg.auth.password) {
        console.log('\n[sync/password] Password authentication checks…');
        const pwdSyncCfg = makeSyncConfig({ useToken: false });

        await check('[sync/password] authenticate (password)', async () => {
            const uploader = new LreScriptUploader(pwdSyncCfg, logger as never);
            const ok = await uploader.authenticate();
            assert.equal(ok, true, 'Expected password auth to succeed');
            await uploader.logout();
        });

        await check('[sync/password] reject wrong password', async () => {
            const bad = makeSyncConfig({ useToken: false, password: 'wrong-password-xyz' });
            const uploader = new LreScriptUploader(bad, logger as never);
            const ok = await uploader.authenticate();
            assert.equal(ok, false, 'Expected wrong password to be rejected');
        });
    } else {
        skip('[sync/password] password auth checks', 'username/password not configured');
    }

    // ── Task operation: upload scripts from workspace ─────────────────────────
    if (cfg.behavior.syncWorkspace && cfg.sync?.workspaceDir) {
        console.log('\n[sync/task] Workspace sync upload…');
        console.log(`  Workspace: ${cfg.sync.workspaceDir}`);

        const { LreWorkspaceSyncRunner } = await import('../../angular/src/sync/lre/LreWorkspaceSyncRunner');

        const activeSyncCfg = makeSyncConfig({
            useToken:     !!cfg.auth.clientId,
            clientId:     cfg.auth.clientId,
            clientSecret: cfg.auth.clientSecret,
            workspaceDir: cfg.sync.workspaceDir
        });

        await check('[sync/task] scan workspace and upload scripts', async () => {
            const runner = new LreWorkspaceSyncRunner(activeSyncCfg, logger as never, 1, 0);
            const ok = await runner.run();
            // threshold=0 means pass even if 0 scripts uploaded (handles empty workspace)
            assert.equal(ok, true, 'Expected sync runner to complete successfully');
        });
    } else {
        skip('[sync/task] workspace sync upload',
             !cfg.behavior.syncWorkspace
                 ? 'integration.test.syncWorkspace=false'
                 : 'pc.sync.workspaceDir not configured');
    }
}

// ── ════════════════════════════════════════════════════════════════════════════
// ── Main
// ── ════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
    await globalSetup();

    if (!PropertiesLoader.hasPropertiesFile()) {
        console.warn('⚠️  integration-tests.properties not found — all checks skipped.');
        await globalTeardown();
        return;
    }

    const cfg = PropertiesLoader.loadConfig();

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  LRE Integration Test Suite                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`  Server  : ${cfg.lre.serverUrl}`);
    console.log(`  Project : ${cfg.lre.domain}/${cfg.lre.project}`);
    if (SAFE_MODE) console.log('  🔒 SAFE MODE — live execution disabled');

    try {
        await runCiTaskChecks(cfg);
        await runDownloadScriptsChecks(cfg);
        await runWorkspaceSyncChecks(cfg);
    } finally {
        await globalTeardown();
    }

    // ── Print summary ─────────────────────────────────────────────────────────
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  Results Summary                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    for (const r of results) {
        const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️ ';
        console.log(`  ${icon}  [${r.status}]  ${r.name}${r.detail ? `\n          ${r.detail}` : ''}`);
    }
    console.log('');
    console.log(`  Total: ${results.length}   ✅ ${passed} passed   ❌ ${failed} failed   ⏭️  ${skipped} skipped`);
    console.log('');

    if (failed > 0) {
        process.exit(1);
    }
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error('\n❌ Integration test runner crashed');
    console.error(message);
    process.exit(1);
});

