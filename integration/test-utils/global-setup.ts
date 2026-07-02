/**
 * Global setup for integration tests
 * Runs once before all test suites
 */

import { PropertiesLoader } from './PropertiesLoader';

export default async function globalSetup() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🧪  OpenText Enterprise Performance Engineering Integration Test Suite');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check if properties file exists
    if (!PropertiesLoader.hasPropertiesFile()) {
        console.warn('⚠️  WARNING: integration-tests.properties not found!');
        console.warn('   All integration tests will be SKIPPED.');
        console.warn('');
        console.warn('   To run integration tests:');
        console.warn('   1. cd integration');
        console.warn('   2. cp integration-tests.properties.template integration-tests.properties');
        console.warn('   3. Edit integration-tests.properties with your LRE credentials');
        console.warn('');
        return;
    }

    try {
        const config = PropertiesLoader.loadConfig();

        console.log('✅ Configuration loaded successfully');
        console.log('');
        console.log('📋 Test Configuration:');
        console.log(`   Server: ${config.lre.serverUrl}`);
        console.log(`project: ${config.lre.domain}/${config.lre.project}`);
        console.log(`   Proxy: ${config.proxy?.url || 'None'}`);
        console.log(`   Tenant: ${config.lre.tenant || 'None'}`);
        console.log('');
        console.log('🔑 Authentication:');
        console.log(`   Method: ${config.auth.useToken ? 'API Token' : 'Username/Password'}`);
        if (config.auth.useToken) {
            console.log(`   Client ID: ${config.auth.clientId?.substring(0, 10)}...`);
        } else {
            console.log(`   Username: ${config.auth.username?.substring(0, 3)}***`);
        }
        console.log('');
        console.log('🧪 Test Scope:');
        console.log(`   Test ID: ${config.test.id}`);
        console.log(`   TestSet ID: ${config.test.testSetId}`);
        if (config.test.testInstanceId) {
            console.log(`   Test Instance ID: ${config.test.testInstanceId} (existing)`);
        } else {
            console.log(`   Test Instance: Will be created`);
        }
        console.log('');
        console.log('⚙️  Test Behavior:');
        console.log(`   Execute Runs: ${config.behavior.executeRun ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`   Download Reports: ${config.behavior.downloadReports ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`   Test Cleanup: ${config.behavior.testCleanup ? '✅ ENABLED' : '❌ DISABLED'}`);

        // Show warning if destructive operations are enabled
        const warning = PropertiesLoader.getDestructiveOperationWarning(config);
        if (warning) {
            console.log('');
            console.log(warning);
        }

        console.log('');
        console.log('───────────────────────────────────────────────────────────────');
        console.log('');

    } catch (error) {
        console.error('❌ Failed to load configuration:');
        console.error((error as Error).message);
        console.error('');
        process.exit(1);
    }
}
