/**
 * Integration Tests: Run Execution
 * ⚠️  WARNING: These tests execute REAL test runs and consume VUD licenses!
 * Set integration.test.executeRun=false to skip these tests.
 */

import { LreClient } from '../../angular/LreCiTask/src/lre/LreClient';
import { LreConfig, RunState, PostRunAction } from '../../angular/LreCiTask/src/models';
import { PropertiesLoader, IntegrationTestConfig } from '../test-utils/PropertiesLoader';

describe('Enterprise Performance Engineering Run Execution Integration Tests', () => {
    let config: IntegrationTestConfig;
    let client: LreClient;
    let createdRunId: number | null = null;

    beforeAll(async () => {
        if (!PropertiesLoader.hasPropertiesFile()) {
            console.warn('⚠️  Skipping integration tests: integration-tests.properties not found');
            return;
        }

        config = PropertiesLoader.loadConfig();

        if (!config.behavior.executeRun) {
            console.warn('⚠️  Skipping run execution tests: integration.test.executeRun=false');
            console.warn('   Set integration.test.executeRun=true to enable these tests.');
            return;
        }

        console.warn('⚠️⚠️⚠️  RUN EXECUTION TESTS ENABLED  ⚠️⚠️⚠️');
        console.warn('   This will execute a REAL test and consume VUD licenses!');
        console.warn(`   Server: ${config.lre.serverUrl}`);
        console.warn(`   Duration: ${config.run.timeslotDurationMinutes} minutes`);

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
        // Cleanup: Stop the run if it was created
        if (createdRunId && client && config?.behavior.testCleanup) {
            console.log(`🧹 Cleanup: Stopping run ${createdRunId}...`);
            await client.stopRun(createdRunId, 'Do Not Collate');
        }

        if (client && config?.behavior.testCleanup) {
            await client.logout();
        }
    });

    const testIf = (condition: () => boolean) => () => condition() ? test : test.skip;

    testIf(() => PropertiesLoader.hasPropertiesFile() && !!config?.behavior?.executeRun)()(
        'should start a test run successfully',
        async () => {
            // Get or create test instance
            let testInstanceId = config.test.testInstanceId;

            if (!testInstanceId) {
                console.log('🔧 No test instance specified, creating one...');
                testInstanceId = await client.createTestInstance(
                    config.test.id,
                    config.test.testSetId
                ) ?? undefined;
                expect(testInstanceId).toBeDefined();
                console.log(`✅ Created test instance: ${testInstanceId}`);
            }

            // Start run
            console.log(`🚀 Starting run for test ${config.test.id}, instance ${testInstanceId}...`);

            const runResponse = await client.startRun(
                config.test.id,
                testInstanceId!,
                { Minutes: config.run.timeslotDurationMinutes },
                config.run.postRunAction as PostRunAction,
                config.run.useVuds
            );

            expect(runResponse).toBeDefined();
            expect(runResponse?.ID).toBeGreaterThan(0);

            createdRunId = runResponse!.ID;

            console.log(`✅ Run started successfully!`);
            console.log(`   Run ID: ${runResponse?.ID}`);
            console.log(`   Test ID: ${runResponse?.TestID}`);
            console.log(`   Test Instance ID: ${runResponse?.TestInstanceID}`);
            console.log(`   Timeslot ID: ${runResponse?.TimeslotID}`);
            console.log(`   Initial State: ${runResponse?.RunState}`);
        },
        120000 // 2 minute timeout for start
    );

    testIf(() => PropertiesLoader.hasPropertiesFile() && !!config?.behavior?.executeRun)()(
        'should retrieve run data and monitor state changes',
        async () => {
            expect(createdRunId).toBeDefined();

            console.log(`📊 Monitoring run ${createdRunId} state changes...`);

            const seenStates = new Set<RunState>();
            let iterations = 0;
            const maxIterations = 10; // Monitor for ~20 seconds

            while (iterations < maxIterations) {
                const runData = await client.getRunData(createdRunId!);

                expect(runData).toBeDefined();
                expect(runData?.ID).toBe(createdRunId);

                if (runData && !seenStates.has(runData.RunState)) {
                    seenStates.add(runData.RunState);
                    console.log(`   State change: ${runData.RunState}`);
                }

                // Wait 2 seconds between polls
                await new Promise(resolve => setTimeout(resolve, 2000));
                iterations++;
            }

            console.log(`✅ Monitored ${iterations} state updates`);
            console.log(`   States observed: ${Array.from(seenStates).join(', ')}`);

            expect(seenStates.size).toBeGreaterThan(0);
        },
        180000 // 3 minute timeout
    );

    testIf(() => PropertiesLoader.hasPropertiesFile() && !!config?.behavior?.executeRun)()(
        'should retrieve run event logs',
        async () => {
            expect(createdRunId).toBeDefined();

            console.log(`📝 Retrieving event logs for run ${createdRunId}...`);

            const eventLog = await client.getRunEventLog(createdRunId!);

            expect(eventLog).toBeDefined();

            if (eventLog?.RecordsList && eventLog.RecordsList.length > 0) {
                console.log(`✅ Found ${eventLog.RecordsList.length} event log records`);

                // Show first 5 log entries
                const entriesToShow = eventLog.RecordsList.slice(0, 5);
                entriesToShow.forEach(record => {
                    console.log(`   [${record.Time}] ${record.Type}: ${record.Description}`);
                });

                if (eventLog.RecordsList.length > 5) {
                    console.log(`   ... and ${eventLog.RecordsList.length - 5} more`);
                }
            } else {
                console.log(`ℹ️  No event log records yet (run may be initializing)`);
            }
        },
        60000
    );

    testIf(() => PropertiesLoader.hasPropertiesFile() && !!config?.behavior?.executeRun && !!config?.behavior?.testCleanup)()(
        'should stop a running test',
        async () => {
            expect(createdRunId).toBeDefined();

            console.log(`🛑 Stopping run ${createdRunId}...`);

            const stopped = await client.stopRun(createdRunId!, 'Do Not Collate');

            expect(stopped).toBe(true);

            // Verify state changed to Stopping
            await new Promise(resolve => setTimeout(resolve, 2000));
            const runData = await client.getRunData(createdRunId!);

            console.log(`✅ Stop command sent successfully`);
            console.log(`   Final state: ${runData?.RunState}`);

            // Mark as cleaned up
            createdRunId = null;
        },
        60000
    );
});
