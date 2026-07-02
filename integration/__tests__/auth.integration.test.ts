/**
 * Integration Tests: Authentication
 * Tests authentication against a real LRE server
 */

import { LreClient } from '../../angular/LreCiTask/src/lre/LreClient';
import { LreConfig } from '../../angular/LreCiTask/src/models';
import { PropertiesLoader, IntegrationTestConfig } from '../test-utils/PropertiesLoader';

describe('LRE Authentication Integration Tests', () => {
    let config: IntegrationTestConfig;
    let lreConfig: LreConfig;

    beforeAll(() => {
        // Skip all tests if properties file doesn't exist
        if (!PropertiesLoader.hasPropertiesFile()) {
            console.warn('⚠️  Skipping integration tests: integration-tests.properties not found');
            console.warn('   Copy integration-tests.properties.template and configure it.');
            return;
        }

        config = PropertiesLoader.loadConfig();

        // Display warning if destructive operations are enabled
        const warning = PropertiesLoader.getDestructiveOperationWarning(config);
        if (warning) {
            console.warn(warning);
        }

        lreConfig = {
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

        console.log(`🔗 Testing against: ${config.lre.serverUrl}`);
        console.log(`📦 Project: ${config.lre.domain}/${config.lre.project}`);
        console.log(`🔑 Auth method: ${config.auth.useToken ? 'API Token' : 'Username/Password'}`);
    });

    // Skip all tests if no properties file
    const testIf = (condition: () => boolean) => () => condition() ? test : test.skip;

    testIf(() => PropertiesLoader.hasPropertiesFile())()(
        'should authenticate successfully with configured credentials',
        async () => {
            const client = new LreClient(lreConfig);

            const authenticated = await client.authenticate();

            expect(authenticated).toBe(true);
            expect(client.isLoggedIn()).toBe(true);

            // Cleanup
            if (config.behavior.testCleanup) {
                await client.logout();
            }
        },
        30000 // 30 second timeout
    );

    testIf(() => PropertiesLoader.hasPropertiesFile())()(
        'should fail authentication with invalid credentials',
        async () => {
            const invalidConfig = { ...lreConfig };

            if (config.auth.useToken) {
                invalidConfig.clientSecret = 'invalid-secret-123';
            } else {
                invalidConfig.password = 'invalid-password-123';
            }

            const client = new LreClient(invalidConfig);

            const authenticated = await client.authenticate();

            expect(authenticated).toBe(false);
            expect(client.isLoggedIn()).toBe(false);
        },
        30000
    );

    testIf(() => PropertiesLoader.hasPropertiesFile())()(
        'should maintain session across multiple requests',
        async () => {
            const client = new LreClient(lreConfig);

            // Authenticate
            const authenticated = await client.authenticate();
            expect(authenticated).toBe(true);

            // Make multiple requests with the same client (should reuse session)
            const test1 = await client.getTest(config.test.id);
            expect(test1).toBeDefined();
            expect(test1?.ID).toBe(config.test.id);

            const test2 = await client.getTest(config.test.id);
            expect(test2).toBeDefined();
            expect(test2?.ID).toBe(config.test.id);

            // Cleanup
            if (config.behavior.testCleanup) {
                await client.logout();
                expect(client.isLoggedIn()).toBe(false);
            }
        },
        60000
    );

    testIf(() => PropertiesLoader.hasPropertiesFile())()(
        'should handle logout correctly',
        async () => {
            const client = new LreClient(lreConfig);

            // Authenticate
            await client.authenticate();
            expect(client.isLoggedIn()).toBe(true);

            // Logout
            await client.logout();
            expect(client.isLoggedIn()).toBe(false);

            // Subsequent requests should fail (session invalidated)
            // Note: This might still work due to cookie caching, so we just verify logout was called
        },
        30000
    );

    testIf(() => PropertiesLoader.hasPropertiesFile() && !!config?.lre?.tenant)()(
        'should authenticate with tenant parameter',
        async () => {
            const client = new LreClient(lreConfig);

            const authenticated = await client.authenticate();

            expect(authenticated).toBe(true);
            console.log(`✅ Multi-tenant authentication successful with tenant: ${config.lre.tenant}`);

            // Cleanup
            if (config.behavior.testCleanup) {
                await client.logout();
            }
        },
        30000
    );

    testIf(() => PropertiesLoader.hasPropertiesFile() && !!config?.proxy)()(
        'should authenticate through proxy',
        async () => {
            const client = new LreClient(lreConfig);

            const authenticated = await client.authenticate();

            expect(authenticated).toBe(true);
            console.log(`✅ Proxy authentication successful through: ${config.proxy?.url}`);

            // Cleanup
            if (config.behavior.testCleanup) {
                await client.logout();
            }
        },
        30000
    );
});
