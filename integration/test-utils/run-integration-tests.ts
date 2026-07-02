import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { LreClient } from '../../angular/LreCiTask/src/lre/LreClient';
import { LreConfig, PostRunAction } from '../../angular/LreCiTask/src/models';
import { PropertiesLoader } from './PropertiesLoader';
import globalSetup from './global-setup';
import globalTeardown from './global-teardown';

const REPO_ROOT = path.resolve(__dirname, '../..');
const SAFE_MODE = process.env.INTEGRATION_SAFE_MODE === 'true';

function createClientConfig() {
    const config = PropertiesLoader.loadConfig();
    const lreConfig: LreConfig = {
        serverUrl: config.lre.serverUrl,
        domain: config.lre.domain,
        project: config.lre.project,
        tenant: config.lre.tenant,
        useToken: config.auth.useToken,
        username: config.auth.username,
        password: config.auth.password,
        clientId: config.auth.clientId,
        clientSecret: config.auth.clientSecret,
        proxyUrl: config.proxy?.url,
        proxyUser: config.proxy?.username,
        proxyPassword: config.proxy?.password
    };

    return { config, lreConfig };
}

async function withClient<T>(lreConfig: LreConfig, action: (client: LreClient) => Promise<T>): Promise<T> {
    const client = new LreClient(lreConfig);
    try {
        return await action(client);
    } finally {
        if (client.isLoggedIn()) {
            await client.logout();
        }
    }
}

function ensureDirectory(targetPath: string): string {
    fs.mkdirSync(targetPath, { recursive: true });
    return targetPath;
}

function resolveArtifactsDirectory(relativeOrAbsolutePath: string): string {
    return path.isAbsolute(relativeOrAbsolutePath)
        ? relativeOrAbsolutePath
        : path.resolve(REPO_ROOT, relativeOrAbsolutePath);
}

async function runAuthenticationChecks(): Promise<void> {
    const { config, lreConfig } = createClientConfig();

    console.log('\n[auth] Verifying successful authentication...');
    await withClient(lreConfig, async (client) => {
        const authenticated = await client.authenticate();
        assert.equal(authenticated, true, 'Expected valid credentials to authenticate successfully');
        assert.equal(client.isLoggedIn(), true, 'Expected authenticated session to be marked as logged in');
    });

    console.log('[auth] Verifying invalid credentials are rejected...');
    await withClient(
        {
            ...lreConfig,
            password: config.auth.useToken ? lreConfig.password : 'invalid-password-123',
            clientSecret: config.auth.useToken ? 'invalid-secret-123' : lreConfig.clientSecret
        },
        async (client) => {
            const authenticated = await client.authenticate();
            assert.equal(authenticated, false, 'Expected invalid credentials to fail authentication');
            assert.equal(client.isLoggedIn(), false, 'Expected invalid authentication to leave client logged out');
        }
    );

    console.log('[auth] Verifying a session can be reused across requests...');
    await withClient(lreConfig, async (client) => {
        const authenticated = await client.authenticate();
        assert.equal(authenticated, true, 'Expected valid credentials to authenticate successfully');

        const firstTest = await client.getTest(config.test.id);
        const secondTest = await client.getTest(config.test.id);

        assert.ok(firstTest, `Expected test ${config.test.id} to be returned on the first request`);
        assert.ok(secondTest, `Expected test ${config.test.id} to be returned on the second request`);
        assert.equal(firstTest?.ID, config.test.id);
        assert.equal(secondTest?.ID, config.test.id);
    });
}

async function runTestManagementChecks(): Promise<void> {
    const { config, lreConfig } = createClientConfig();

    await withClient(lreConfig, async (client) => {
        console.log('\n[test-management] Authenticating...');
        assert.equal(await client.authenticate(), true, 'Expected authentication before test management checks');

        console.log(`[test-management] Loading test ${config.test.id}...`);
        const lreTest = await client.getTest(config.test.id);
        assert.ok(lreTest, `Expected test ${config.test.id} to exist`);
        assert.equal(lreTest.ID, config.test.id);
        if (config.test.name) {
            assert.equal(lreTest.Name, config.test.name, 'Expected configured test name to match');
        }

        console.log(`[test-management] Loading test instances for test ${config.test.id}...`);
        const instances = await client.getTestInstances(config.test.id);
        assert.ok(instances, 'Expected test instances response');
        assert.ok(Array.isArray(instances.TestInstancesList), 'Expected TestInstancesList to be an array');

        console.log('[test-management] Verifying a non-existent test returns null...');
        const missingTest = await client.getTest(999999);
        assert.equal(missingTest, null, 'Expected a non-existent test to return null');

        // ── Test set folder & test set creation ─────────────────────────────────
        console.log('\n[test-management] Retrieving test set folders...');
        const foldersResponse = await client.getTestSetFolders();
        assert.ok(foldersResponse, 'Expected getTestSetFolders to return a response');
        assert.ok(Array.isArray(foldersResponse.TestSetFoldersList), 'Expected TestSetFoldersList to be an array');
        console.log(`[test-management] Found ${foldersResponse.TestSetFoldersList.length} folder(s):`);
        foldersResponse.TestSetFoldersList.forEach(f => {
            console.log(`  Folder ID: ${f.TestSetFolderId}, Name: ${f.TestSetFolderName}, Parent: ${f.Parent}`);
        });

        // Verify Root folder is present. Root has TestSetFolderId = 0 (falsy but valid!).
        const rootFolder = foldersResponse.TestSetFoldersList.find(
            f => (f.TestSetFolderName ?? '').toLowerCase() === 'root'
        );
        assert.ok(rootFolder, 'Expected a folder named "Root" to exist');
        assert.ok(rootFolder.TestSetFolderId != null, `Expected Root folder to have a numeric ID, got: ${rootFolder.TestSetFolderId}`);
        console.log(`[test-management] Root folder ID: ${rootFolder.TestSetFolderId}`);

        console.log('\n[test-management] Retrieving test sets...');
        const testSetsResponse = await client.getTestSets();
        assert.ok(testSetsResponse, 'Expected getTestSets to return a response');
        assert.ok(Array.isArray(testSetsResponse.TestSetsList), 'Expected TestSetsList to be an array');
        console.log(`[test-management] Found ${testSetsResponse.TestSetsList.length} test set(s):`);
        testSetsResponse.TestSetsList.forEach(ts => {
            console.log(`  TestSet ID: ${ts.TestSetID}, Name: ${ts.TestSetName ?? ts.Name}`);
        });

        // ── Create a test set folder under Root ──────────────────────────────────
        const folderName = `CI Integration Test Folder ${Date.now()}`;
        console.log(`\n[test-management] Creating test set folder "${folderName}" under Root (ID: ${rootFolder.TestSetFolderId})...`);
        const newFolderId = await client.createTestSetFolder(folderName, rootFolder.TestSetFolderId);
        assert.ok(newFolderId != null, `Expected createTestSetFolder to return a numeric ID, got: ${newFolderId}`);
        assert.ok(newFolderId > 0, `Expected folder ID to be > 0, got: ${newFolderId}`);
        console.log(`[test-management] ✅ Created test set folder "${folderName}" with ID: ${newFolderId}`);

        // Verify it now appears in the folder list
        const foldersAfter = await client.getTestSetFolders();
        const createdFolder = foldersAfter?.TestSetFoldersList?.find(f => f.TestSetFolderId === newFolderId);
        assert.ok(createdFolder, `Expected newly created folder (ID: ${newFolderId}) to appear in getTestSetFolders`);
        console.log(`[test-management] ✅ Verified folder appears in list: ${createdFolder.TestSetFolderName}`);

        // ── Create a test set inside the new folder ───────────────────────────────
        const testSetName = `CI Integration Test Set ${Date.now()}`;
        console.log(`\n[test-management] Creating test set "${testSetName}" in folder ${newFolderId}...`);
        const newTestSetId = await client.createTestSet(testSetName, newFolderId);
        assert.ok(newTestSetId, `Expected createTestSet to return a numeric ID, got: ${newTestSetId}`);
        assert.ok(newTestSetId > 0, `Expected test set ID to be > 0, got: ${newTestSetId}`);
        console.log(`[test-management] ✅ Created test set "${testSetName}" with ID: ${newTestSetId}`);

        // Verify it now appears in the test sets list
        const setsAfter = await client.getTestSets();
        const createdSet = setsAfter?.TestSetsList?.find(ts => ts.TestSetID === newTestSetId);
        assert.ok(createdSet, `Expected newly created test set (ID: ${newTestSetId}) to appear in getTestSets`);
        console.log(`[test-management] ✅ Verified test set appears in list: ${createdSet.TestSetName ?? createdSet.Name}`);

        // ── Create a test instance in the new test set ────────────────────────────
        console.log(`\n[test-management] Creating test instance for test ${config.test.id} in test set ${newTestSetId}...`);
        const newInstanceId = await client.createTestInstance(config.test.id, newTestSetId);
        assert.ok(newInstanceId, `Expected createTestInstance to return a numeric ID, got: ${newInstanceId}`);
        assert.ok(newInstanceId > 0, `Expected test instance ID to be > 0, got: ${newInstanceId}`);
        console.log(`[test-management] ✅ Created test instance with ID: ${newInstanceId}`);
    });
}

async function runReportChecks(): Promise<void> {
    const { config, lreConfig } = createClientConfig();

    if (!config.behavior.downloadReports || !config.run.existingRunId) {
        console.log('\n[reports] Skipping report checks because downloadReports=false or pc.run.id is not configured.');
        return;
    }

    const artifactsRoot = ensureDirectory(resolveArtifactsDirectory(config.artifacts.directory));
    const outputDir = ensureDirectory(path.join(artifactsRoot, `integration-audit-${Date.now()}`));

    await withClient(lreConfig, async (client) => {
        console.log(`\n[reports] Authenticating for report checks against run ${config.run.existingRunId}...`);
        assert.equal(await client.authenticate(), true, 'Expected authentication before report checks');

        const runResults = await client.getRunResults(config.run.existingRunId!);
        assert.ok(runResults, `Expected run results for run ${config.run.existingRunId}`);
        assert.ok(runResults.ResultsList.length > 0, `Expected at least one downloadable result for run ${config.run.existingRunId}`);

        const preferredResult = runResults.ResultsList.find(result => /html|report/i.test(result.Name)) ?? runResults.ResultsList[0];
        const resultPath = path.join(outputDir, `run${config.run.existingRunId}_${preferredResult.ID}_${preferredResult.Name}`);

        console.log(`[reports] Downloading result ${preferredResult.ID} (${preferredResult.Name})...`);
        const downloaded = await client.downloadRunResultData(config.run.existingRunId!, preferredResult.ID, resultPath);
        assert.equal(downloaded, true, 'Expected run result download to succeed');
        assert.equal(fs.existsSync(resultPath), true, `Expected downloaded file to exist: ${resultPath}`);

        if (config.trend?.reportId) {
            const trendPath = path.join(outputDir, `trend-${config.trend.reportId}-run-${config.run.existingRunId}.pdf`);
            console.log(`[reports] Downloading trend PDF ${config.trend.reportId} for run ${config.run.existingRunId}...`);
            const trendDownloaded = await client.downloadTrendReportPDF(config.trend.reportId, config.run.existingRunId!, trendPath);
            assert.equal(trendDownloaded, true, 'Expected trend PDF download to succeed');
            assert.equal(fs.existsSync(trendPath), true, `Expected downloaded trend PDF to exist: ${trendPath}`);
        }
    });
}

async function runOptionalExecutionChecks(): Promise<void> {
    const { config, lreConfig } = createClientConfig();

    if (SAFE_MODE || !config.behavior.executeRun) {
        console.log('\n[run-execution] Skipping live run execution checks.');
        if (SAFE_MODE && config.behavior.executeRun) {
            console.log('[run-execution] INTEGRATION_SAFE_MODE=true forced execution checks off.');
        }
        return;
    }

    await withClient(lreConfig, async (client) => {
        console.log('\n[run-execution] Authenticating...');
        assert.equal(await client.authenticate(), true, 'Expected authentication before execution checks');

        let testInstanceId = config.test.testInstanceId;
        if (!testInstanceId) {
            console.log(`[run-execution] Creating test instance in test set ${config.test.testSetId}...`);
            testInstanceId = await client.createTestInstance(config.test.id, config.test.testSetId) ?? undefined;
            assert.ok(testInstanceId, 'Expected test instance creation to return an ID');
        }

        console.log(`[run-execution] Starting run for test ${config.test.id}, instance ${testInstanceId}...`);
        const runResponse = await client.startRun(
            config.test.id,
            testInstanceId!,
            { Minutes: config.run.timeslotDurationMinutes },
            config.run.postRunAction as PostRunAction,
            config.run.useVuds
        );

        assert.ok(runResponse, 'Expected startRun to return a response');
        assert.ok(runResponse.ID > 0, 'Expected created run ID to be greater than zero');

        const runData = await client.getRunData(runResponse.ID);
        assert.ok(runData, 'Expected run data to be available immediately after starting the run');

        if (config.behavior.testCleanup) {
            console.log(`[run-execution] Sending stop for run ${runResponse.ID}...`);
            const stopped = await client.stopRun(runResponse.ID, 'Do Not Collate');
            assert.equal(stopped, true, 'Expected stopRun to succeed');
        }
    });
}

async function main(): Promise<void> {
    await globalSetup();

    if (!PropertiesLoader.hasPropertiesFile()) {
        await globalTeardown();
        return;
    }

    if (SAFE_MODE) {
        console.log('🔒 Safe mode enabled: live execution checks are disabled.');
    }

    try {
        await runAuthenticationChecks();
        await runTestManagementChecks();
        await runReportChecks();
        await runOptionalExecutionChecks();

        console.log('\n✅ All integration verification checks passed.');
    } finally {
        await globalTeardown();
    }
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error('\n❌ Integration verification failed');
    console.error(message);
    process.exit(1);
});

