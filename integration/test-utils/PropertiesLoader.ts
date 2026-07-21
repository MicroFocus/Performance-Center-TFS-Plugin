/**
 * Loads and validates integration test configuration from properties file
 */

import * as fs from 'fs';
import * as path from 'path';

export interface IntegrationTestConfig {
    lre: {
        serverUrl: string;
        domain: string;
        project: string;
        tenant?: string;
    };
    auth: {
        useToken: boolean;
        username?: string;
        password?: string;
        clientId?: string;
        clientSecret?: string;
    };
    proxy?: {
        url: string;
        username?: string;
        password?: string;
    };
    test: {
        id: number;
        name?: string;
        testSetId: number;
        testInstanceId?: number;
        maxWaitMinutes: number;
    };
    run: {
        timeslotDurationMinutes: number;
        postRunAction: string;
        useVuds: boolean;
        /** Existing completed run ID – for report-download tests without executing a new run. */
        existingRunId?: number;
    };
    trend?: {
        reportId: number;
    };
    artifacts: {
        directory: string;
    };
    behavior: {
        executeRun: boolean;
        downloadReports: boolean;
        testCleanup: boolean;
    };
}

export class PropertiesLoader {
    private static readonly PROPERTIES_FILE = 'integration-tests.properties';
    private static readonly TEMPLATE_FILE = 'integration-tests.properties.template';

    /**
     * Check if the properties file exists
     */
    static hasPropertiesFile(): boolean {
        const integrationDir = path.join(__dirname, '..');
        const propsPath = path.join(integrationDir, this.PROPERTIES_FILE);
        return fs.existsSync(propsPath);
    }

    /**
     * Load configuration from properties file
     * @throws Error if file doesn't exist or is invalid
     */
    static loadConfig(): IntegrationTestConfig {
        const integrationDir = path.join(__dirname, '..');
        const propsPath = path.join(integrationDir, this.PROPERTIES_FILE);

        if (!fs.existsSync(propsPath)) {
            const templatePath = path.join(integrationDir, this.TEMPLATE_FILE);
            throw new Error(
                `Integration test properties file not found: ${propsPath}\n\n` +
                `Please copy the template and configure it:\n` +
                `  cp ${templatePath} ${propsPath}\n\n` +
                `Then edit ${this.PROPERTIES_FILE} with your server details.`
            );
        }

        const content = fs.readFileSync(propsPath, 'utf-8');
        const props = this.parseProperties(content);

        return this.buildConfig(props);
    }

    /**
     * Parse Java-style properties file
     */
    private static parseProperties(content: string): Record<string, string> {
        const props: Record<string, string> = {};

        content.split('\n').forEach(line => {
            // Skip comments and empty lines
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                return;
            }

            // Parse key=value
            const match = trimmed.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                props[key] = value;
            }
        });

        return props;
    }

    /**
     * Build typed configuration from properties
     */
    private static buildConfig(props: Record<string, string>): IntegrationTestConfig {
        // Validate required properties
        this.requireProperty(props, 'pc.lre.server');
        this.requireProperty(props, 'pc.alm.domain');
        this.requireProperty(props, 'pc.alm.project');

        const useToken = !!(props['pc.lre.idKey'] && props['pc.lre.idKey'].trim() &&
                            props['pc.lre.secretKey'] && props['pc.lre.secretKey'].trim());

        if (!useToken) {
            this.requireProperty(props, 'pc.alm.user');
            this.requireProperty(props, 'pc.alm.password');
        }

        // Parse server URL: pc.lre.server may be the full homepage URL like
        // http://host/homepage/?tenant=xxx  — extract just the origin for LreClient
        // and the tenant from the query string if not set via pc.lre.tenant.
        const rawServer = props['pc.lre.server'];
        let serverUrl: string;
        let tenant: string | undefined = props['pc.lre.tenant'];

        try {
            const parsed = new URL(rawServer);
            serverUrl = parsed.origin; // e.g. http://host
            if (!tenant && parsed.searchParams.has('tenant')) {
                tenant = parsed.searchParams.get('tenant') ?? undefined;
            }
        } catch {
            // Not a full URL — combine protocol + raw value
            serverUrl = rawServer.startsWith('http') ? rawServer
                : `${props['pc.web.protocol'] || 'https'}://${rawServer}`;
        }

        return {
            lre: {
                serverUrl,
                domain: props['pc.alm.domain'],
                project: props['pc.alm.project'],
                tenant
            },
            auth: {
                useToken,
                username: props['pc.alm.user'],
                password: props['pc.alm.password'],
                clientId: props['pc.lre.idKey'],
                clientSecret: props['pc.lre.secretKey']
            },
            proxy: props['pc.proxy.url'] ? {
                url: props['pc.proxy.url'],
                username: props['pc.proxy.user'],
                password: props['pc.proxy.password']
            } : undefined,
            test: {
                id: props['pc.test.id'] ? parseInt(props['pc.test.id']) : 0,
                name: props['pc.test.name'],
                testSetId: props['pc.testset.id'] ? parseInt(props['pc.testset.id']) : 0,
                testInstanceId: props['pc.testinstance.id'] ? parseInt(props['pc.testinstance.id']) : undefined,
                maxWaitMinutes: parseInt(props['pc.test.maxWaitMinutes'] || '60')
            },
            run: {
                timeslotDurationMinutes: parseInt(props['pc.run.timeslotDurationMinutes'] || '30'),
                postRunAction: props['pc.run.postRunAction'] || 'Collate And Analyze',
                useVuds: props['pc.run.useVuds'] === 'true',
                existingRunId: props['pc.run.id'] ? parseInt(props['pc.run.id']) : undefined
            },
            trend: props['pc.trend.reportId'] ? {
                reportId: parseInt(props['pc.trend.reportId'])
            } : undefined,
            artifacts: {
                directory: props['pc.artifacts.directory'] || './integration/test-results'
            },
            behavior: {
                executeRun: props['integration.test.executeRun'] === 'true',
                downloadReports: props['integration.test.downloadReports'] === 'true',
                testCleanup: props['integration.test.testCleanup'] !== 'false' // default true
            }
        };
    }

    private static requireProperty(props: Record<string, string>, key: string): void {
        if (!props[key] || props[key].trim() === '') {
            throw new Error(`Required property '${key}' is missing or empty in integration-tests.properties`);
        }
    }

    /**
     * Get a warning message for destructive operations
     */
    static getDestructiveOperationWarning(config: IntegrationTestConfig): string | null {
        if (!config.behavior.executeRun) {
            return null;
        }

        return `
⚠️  WARNING: Destructive test operations are ENABLED
    - executeRun: ${config.behavior.executeRun}
    - downloadReports: ${config.behavior.downloadReports}

This will:
  • Execute a real test on ${config.lre.serverUrl}
  • Consume VUD licenses
  • Take at least ${config.run.timeslotDurationMinutes} minutes

Set integration.test.executeRun=false to run safe read-only tests.
`;
    }
}
