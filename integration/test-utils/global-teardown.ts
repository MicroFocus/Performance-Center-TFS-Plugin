/**
 * Global teardown for integration tests
 * Runs once after all test suites
 */

export default async function globalTeardown() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅  Integration Test Suite Complete');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
}
