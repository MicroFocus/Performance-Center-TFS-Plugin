/**
 * Integration Tests: Test Management
 * NOTE: These files are documentation/reference only.
 * The actual integration test runner is:
 *   integration/test-utils/run-integration-tests.ts
 * Run via: npm run test:integration (from angular/LreCiTask)
 */

import { LreClient } from '../../angular/LreCiTask/src/lre/LreClient';
import { LreConfig } from '../../angular/LreCiTask/src/models';
import { PropertiesLoader, IntegrationTestConfig } from '../test-utils/PropertiesLoader';

describe('LRE Test Management Integration Tests', () => {
    let config: IntegrationTestConfig;
    let client: LreClient;

    beforeAll(async () => {
        if (!PropertiesLoader.hasPropertiesFile()) {
            console.warn('⚠️  Skipping integration tests: integration-tests.properties not found');
            return;
        }
        config = PropertiesLoader.loadConfig();
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
        client = new LreClient(lreConfig);
        await client.authenticate();
    });

    afterAll(async () => {
        if (client && config?.behavior.testCleanup) {
            await client.logout();
        }
    });

    const testIf = (condition: () => boolean) => () => condition() ? test : test.skip;

    testIf(() => PropertiesLoader.hasPropertiesFile())()(
        'should retrieve test by ID',
        async () => {
            const lreTest = await client.getTest(config.test.id);
            expect(lreTest).toBeDefined();
            expect(lreTest?.ID).toBe(config.test.id);
            console.log(`✅ Retrieved test: ${lreTest?.Name} (ID: ${lreTest?.ID})`);
        },
        30000
    );

    testIf(() => PropertiesLoader.hasPropertiesFile())()(
        'should retrieve test set folders including Root',
        async () => {
            const folders = await client.getTestSetFolders();
            expect(folders).toBeDefined();
            expect(folders?.TestSetFoldersList).toBeDefined();
            folders?.TestSetFoldersList?.forEach(f => {
                console.log(`   Folder ID: ${f.TestSetFolderId}, Name: ${f.TestSetFolderName}, Parent: ${f.Parent}`);
            });
            const rootFolder = folders?.TestSetFoldersList?.find(
                f => (f.TestSetFolderName ?? '').toLowerCase() === 'root'
            );
            expect(rootFolder).toBeDefined();
            expect(rootFolder?.TestSetFolderId).toBeDefined();
            console.log(`✅ Root folder ID: ${rootFolder?.TestSetFolderId}`);
        },
        30000
    );

    testIf(() => PropertiesLoader.hasPropertiesFile())()(
        'should create a folder, test set and test instance end-to-end',
        async () => {
            const folders = await client.getTestSetFolders();
            const rootFolder = folders?.TestSetFoldersList?.find(
                f => (f.TestSetFolderName ?? '').toLowerCase() === 'root'
            );
            expect(rootFolder?.TestSetFolderID).toBeDefined();

            const folderId = await client.createTestSetFolder(`CI Test Folder ${Date.now()}`, rootFolder!.TestSetFolderId);
            expect(folderId).toBeGreaterThan(0);
            console.log(`✅ Created folder ID: ${folderId}`);

            const testSetId = await client.createTestSet(`CI Test Set ${Date.now()}`, folderId!);
            expect(testSetId).toBeGreaterThan(0);
            console.log(`✅ Created test set ID: ${testSetId}`);

            const instanceId = await client.createTestInstance(config.test.id, testSetId!);
            expect(instanceId).toBeGreaterThan(0);
            console.log(`✅ Created test instance ID: ${instanceId}`);
        },
        60000
    );

    testIf(() => PropertiesLoader.hasPropertiesFile())()(
        'should handle non-existent test gracefully',
        async () => {
            const lreTest = await client.getTest(999999);
            expect(lreTest).toBeNull();
        },
        30000
    );
});
