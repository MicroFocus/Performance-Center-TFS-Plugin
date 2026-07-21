/**
 * Enterprise Performance Engineering HTTP Client
 * Handles all REST API communication with OpenText Enterprise Performance Engineering server
 */

import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { XMLParser } from 'fast-xml-parser';
import * as tl from 'azure-pipelines-task-lib/task';
import {
    LreConfig,
    LreErrorResponse,
    LreTest,
    LreTestInstance,
    LreTestInstances,
    LreTestSets,
    LreTestSet,
    LreTestSetFolders,
    LreTestSetFolder,
    LreRunResponse,
    LreRunResults,
    LreRunResult,
    LreRunEventLog,
    LreRunEventLogRecord,
    LreTrendReportRoot,
    LreAuthenticationClientXml,
    LreRunRequestXml,
    LreTimeslotDuration,
    PostRunAction,
    LreTestInstanceRequestXml,
    LreTestSetFolderRequestXml,
    LreTestSetRequestXml,
    LreStopRunRequestXml
} from '../models';

export class LreClient {
    private httpClient: AxiosInstance;
    private cookieJar: CookieJar;
    private xmlParser: XMLParser;
    private baseUrl: string;
    private resourceBaseUrl: string;
    private tenantSuffix: string;
    private isAuthenticated: boolean = false;
    /** Raw cookie string pinned to axios defaults after a successful auth.
     *  Kept as a field so logout() can clear it. */
    private sessionCookieHeader: string | undefined;

    constructor(private config: LreConfig) {
        this.cookieJar = new CookieJar();

        // Setup axios with cookie support
        this.httpClient = wrapper(axios.create({
            jar: this.cookieJar,
            timeout: 60000,
            withCredentials: true,
            // Never throw on HTTP error status — we check status codes ourselves in isSuccessResponse()
            validateStatus: () => true,
            headers: {
                'Content-Type': 'application/xml',
                'Accept': 'application/xml',
                'X-QC-HIDDEN-SECURITY-ID': '12'
            },
            proxy: this.parseProxy()
        }));

        // Setup XML parser
        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseAttributeValue: true
        });


        // Build base URLs
        // Auth endpoints use tenant as a path-suffix /?tenant=<guid>  (matches .NET RestEntity pattern)
        // Resource endpoints do NOT carry the tenant (matches .NET PCClientRequest non-login format)
        this.tenantSuffix = config.tenant ? `/?tenant=${config.tenant}` : '';
        this.baseUrl = `${config.serverUrl}/LoadTest/rest`;
        this.resourceBaseUrl = `${this.baseUrl}/domains/${config.domain}/projects/${config.project}`;

        tl.debug(`LreClient initialized: ${this.baseUrl}`);
    }

    // ========================================================================
    // Authentication
    // ========================================================================

    async authenticate(): Promise<boolean> {
        try {
            if (this.config.useToken) {
                return await this.authenticateWithToken();
            } else {
                return await this.authenticateWithPassword();
            }
        } catch (error) {
            tl.error(`Authentication failed (exception): ${this.getErrorMessage(error)}`);
            return false;
        }
    }

    private async authenticateWithPassword(): Promise<boolean> {
        tl.debug(`Authenticating with username/password: ${this.config.username}`);

        const credentials = `${this.config.username}:${this.config.password}`;
        const encoded = Buffer.from(credentials, 'utf8').toString('base64');

        const response = await this.httpClient.get(
            `${this.baseUrl}/authentication-point/authenticate${this.tenantSuffix}`,
            {
                headers: {
                    'Authorization': `Basic ${encoded}`,
                    'Content-Type': 'application/xml'
                }
            }
        );

        this.isAuthenticated = this.isSuccessResponse(response);
        if (!this.isAuthenticated) {
            tl.debug(`Auth response status: ${response.status}, body: ${JSON.stringify(response.data)}`);
        } else {
            this.captureSessionCookies(response);
        }
        tl.debug(`Authentication ${this.isAuthenticated ? 'succeeded' : 'failed'}`);
        return this.isAuthenticated;
    }

    private async authenticateWithToken(): Promise<boolean> {
        tl.debug(`Authenticating with API token: ${this.config.clientId}`);

        const authXml = new LreAuthenticationClientXml(
            this.config.clientId!,    // → ClientIdKey
            this.config.clientSecret! // → ClientSecretKey
        );

        const response = await this.httpClient.post(
            `${this.baseUrl}/authentication-point/authenticateclient${this.tenantSuffix}`,
            authXml.toXml(),
            { headers: { 'Content-Type': 'application/xml' } }
        );

        this.isAuthenticated = this.isSuccessResponse(response);
        if (this.isAuthenticated) {
            this.captureSessionCookies(response);
        }
        tl.debug(`Token authentication ${this.isAuthenticated ? 'succeeded' : 'failed'}`);
        return this.isAuthenticated;
    }

    async logout(): Promise<void> {
        if (!this.isAuthenticated) return;

        try {
            await this.httpClient.get(`${this.baseUrl}/authentication-point/logout${this.tenantSuffix}`);
            this.isAuthenticated = false;
            // Clear the pinned session cookie so it cannot be reused after logout.
            delete this.httpClient.defaults.headers.common['Cookie'];
            this.sessionCookieHeader = undefined;
            tl.debug('Logged out successfully');
        } catch (error) {
            tl.warning(`Logout failed: ${this.getErrorMessage(error)}`);
        }
    }

    // ========================================================================
    // Test Management
    // ========================================================================

    async getTest(testId: number): Promise<LreTest | null> {
        try {
            const response = await this.httpClient.get(
                `${this.resourceBaseUrl}/tests/${testId}`
            );

            if (!this.isSuccessResponse(response)) {
                return null;
            }

            const lreTest = this.parseXmlResponse<LreTest>(response.data);

            // Populate the computed ReportId from Content.AutomaticTrending.ReportId
            if (lreTest?.Content?.AutomaticTrending?.ReportId) {
                lreTest.ReportId = lreTest.Content.AutomaticTrending.ReportId;
            }

            return lreTest;
        } catch (error) {
            tl.error(`Failed to get test ${testId}: ${this.getErrorMessage(error)}`);
            return null;
        }
    }

    async getTestInstances(testId: number): Promise<LreTestInstances | null> {
        try {
            // The query-filter syntax is not supported on all server versions;
            // fetch ALL test instances and filter client-side by TestID.
            const response = await this.httpClient.get(
                `${this.resourceBaseUrl}/testinstances`
            );

            if (!this.isSuccessResponse(response)) {
                return null;
            }

            // fast-xml-parser returns a single object when there is one child element,
            // or an array when there are many — normalise to array.
            const raw = this.parseXmlResponse<{ TestInstance?: LreTestInstance | LreTestInstance[] }>(
                response.data
            );
            if (!raw) return null;

            const all: LreTestInstance[] = raw.TestInstance
                ? (Array.isArray(raw.TestInstance) ? raw.TestInstance : [raw.TestInstance])
                : [];

            return {
                TestInstancesList: all.filter(i => Number(i.TestID) === testId)
            };
        } catch (error) {
            tl.error(`Failed to get test instances for test ${testId}: ${this.getErrorMessage(error)}`);
            return null;
        }
    }

    async createTestInstance(testId: number, testSetId: number): Promise<number | null> {
        try {
            const requestXml = new LreTestInstanceRequestXml(testId, testSetId);

            const response = await this.httpClient.post(
                `${this.resourceBaseUrl}/testinstances`,
                requestXml.toXml()
            );

            if (!this.isSuccessResponse(response)) {
                return null;
            }

            const instance = this.parseXmlResponse<LreTestInstance>(response.data);
            return instance?.TestInstanceID || null;
        } catch (error) {
            tl.error(`Failed to create test instance: ${this.getErrorMessage(error)}`);
            return null;
        }
    }

    async getTestSets(): Promise<LreTestSets | null> {
        try {
            const response = await this.httpClient.get(
                `${this.resourceBaseUrl}/testsets`
            );

            if (!this.isSuccessResponse(response)) {
                return null;
            }

            // fast-xml-parser returns a single object when there is one child element,
            // or an array when there are many — normalise to array.
            const raw = this.parseXmlResponse<{ TestSet?: LreTestSet | LreTestSet[] }>(
                response.data
            );
            if (!raw) return null;

            const testSetsList: LreTestSet[] = raw.TestSet
                ? (Array.isArray(raw.TestSet) ? raw.TestSet : [raw.TestSet])
                : [];

            return { TestSetsList: testSetsList };
        } catch (error) {
            tl.error(`Failed to get test sets: ${this.getErrorMessage(error)}`);
            return null;
        }
    }

    async getTestSetFolders(): Promise<LreTestSetFolders | null> {
        try {
            const response = await this.httpClient.get(
                `${this.resourceBaseUrl}/testsetfolders`
            );

            if (!this.isSuccessResponse(response)) {
                tl.debug(`getTestSetFolders: HTTP ${response.status}`);
                return null;
            }

            tl.debug(`getTestSetFolders raw response: ${response.data}`);

            const raw = this.parseXmlResponse<{ TestSetFolder?: LreTestSetFolder | LreTestSetFolder[] }>(
                response.data
            );
            if (!raw) return null;

            tl.debug(`getTestSetFolders parsed: ${JSON.stringify(raw)}`);

            const list: LreTestSetFolder[] = raw.TestSetFolder
                ? (Array.isArray(raw.TestSetFolder) ? raw.TestSetFolder : [raw.TestSetFolder])
                : [];

            return { TestSetFoldersList: list };
        } catch (error) {
            tl.debug(`Failed to get test set folders: ${this.getErrorMessage(error)}`);
            return null;
        }
    }

    async createTestSetFolder(name: string, parentFolderId: number): Promise<number | null> {
        try {
            const requestXml = new LreTestSetFolderRequestXml(name, parentFolderId);
            tl.debug(`createTestSetFolder XML: ${requestXml.toXml()}`);
            const response = await this.httpClient.post(
                `${this.resourceBaseUrl}/testsetfolders`,
                requestXml.toXml()
            );

            if (!this.isSuccessResponse(response)) {
                const err = this.parseXmlResponse<LreErrorResponse>(response.data);
                tl.error(`createTestSetFolder failed (HTTP ${response.status}): ${err?.ExceptionMessage ?? response.data}`);
                return null;
            }

            tl.debug(`createTestSetFolder raw response: ${response.data}`);
            const folder = this.parseXmlResponse<LreTestSetFolder>(response.data);
            tl.debug(`createTestSetFolder parsed: ${JSON.stringify(folder)}`);
            // TestSetFolderId may be 0 (valid for Root's children), so check for null/undefined explicitly
            return folder?.TestSetFolderId != null ? folder.TestSetFolderId : null;
        } catch (error) {
            tl.error(`Failed to create test set folder: ${this.getErrorMessage(error)}`);
            return null;
        }
    }

    async createTestSet(name: string, testSetParentId: number): Promise<number | null> {
        try {
            const requestXml = new LreTestSetRequestXml(name, testSetParentId);
            tl.debug(`createTestSet XML: ${requestXml.toXml()}`);
            const response = await this.httpClient.post(
                `${this.resourceBaseUrl}/testsets`,
                requestXml.toXml()
            );

            if (!this.isSuccessResponse(response)) {
                const err = this.parseXmlResponse<LreErrorResponse>(response.data);
                tl.error(`createTestSet failed (HTTP ${response.status}): ${err?.ExceptionMessage ?? response.data}`);
                return null;
            }

            tl.debug(`createTestSet raw response: ${response.data}`);
            const testSet = this.parseXmlResponse<LreTestSet>(response.data);
            tl.debug(`createTestSet parsed: ${JSON.stringify(testSet)}`);
            return testSet?.TestSetID ?? null;
        } catch (error) {
            tl.error(`Failed to create test set: ${this.getErrorMessage(error)}`);
            return null;
        }
    }

    // ========================================================================
    // Run Execution
    // ========================================================================

    async startRun(
        testId: number,
        testInstanceId: number,
        timeslotDuration: LreTimeslotDuration,
        postRunAction: PostRunAction,
        vudsMode: boolean
    ): Promise<LreRunResponse | null> {
        try {
            const runRequest = new LreRunRequestXml(
                testId,
                testInstanceId,
                timeslotDuration,
                postRunAction,
                vudsMode
            );

            tl.debug(`Starting run for test ${testId}, instance ${testInstanceId}`);

            const response = await this.httpClient.post(
                `${this.resourceBaseUrl}/Runs`,
                runRequest.toXml()
            );

            if (!this.isSuccessResponse(response)) {
                const error = this.parseXmlResponse<LreErrorResponse>(response.data);
                tl.error(`StartRun failed: ${error?.ExceptionMessage || 'Unknown error'}`);
                return null;
            }

            const runResponse = this.parseXmlResponse<LreRunResponse>(response.data);
            tl.debug(`Run started successfully: Run ID = ${runResponse?.ID}`);
            return runResponse;
        } catch (error) {
            tl.error(`Failed to start run: ${this.getErrorMessage(error)}`);
            return null;
        }
    }

    async getRunData(runId: number): Promise<LreRunResponse | null> {
        try {
            const response = await this.httpClient.get(
                `${this.resourceBaseUrl}/Runs/${runId}`
            );

            if (!this.isSuccessResponse(response)) {
                return null;
            }

            return this.parseXmlResponse<LreRunResponse>(response.data);
        } catch (error) {
            tl.debug(`Failed to get run data for ${runId}: ${this.getErrorMessage(error)}`);
            return null;
        }
    }

    async getRunEventLog(runId: number): Promise<LreRunEventLog | null> {
        try {
            const response = await this.httpClient.get(
                `${this.resourceBaseUrl}/Runs/${runId}/EventLog`
            );

            if (!this.isSuccessResponse(response)) {
                return null;
            }

            // fast-xml-parser returns a single object when there is one child element,
            // or an array when there are many — normalise to array.
            const raw = this.parseXmlResponse<{ LREMessage?: LreRunEventLogRecord | LreRunEventLogRecord[] }>(
                response.data
            );
            if (!raw) return null;

            const recordsList: LreRunEventLogRecord[] = raw.LREMessage
                ? (Array.isArray(raw.LREMessage) ? raw.LREMessage : [raw.LREMessage])
                : [];

            return { RecordsList: recordsList };
        } catch (error) {
            tl.debug(`Failed to get event log for run ${runId}: ${this.getErrorMessage(error)}`);
            return null;
        }
    }

    async stopRun(runId: number, postRunAction?: PostRunAction): Promise<boolean> {
        try {
            const stopRequest = new LreStopRunRequestXml(true, postRunAction ?? 'Do Not Collate');
            const stopModes = ['stop', 'stopNow', 'abort'];

            for (const stopMode of stopModes) {
                const response = await this.httpClient.post(
                    `${this.resourceBaseUrl}/Runs/${runId}/${stopMode}`,
                    stopRequest.toXml(),
                    { headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' } }
                );

                if (this.isSuccessResponse(response)) {
                    tl.debug(`StopRun succeeded for run ${runId} using mode "${stopMode}".`);
                    return true;
                }

                tl.debug(
                    `StopRun mode "${stopMode}" failed for run ${runId}: HTTP ${response.status}.`
                );
            }

            return false;
        } catch (error) {
            tl.error(`Failed to stop run ${runId}: ${this.getErrorMessage(error)}`);
            return false;
        }
    }

    // ========================================================================
    // Results & Reports
    // ========================================================================

    async getRunResults(runId: number): Promise<LreRunResults | null> {
        try {
            const response = await this.httpClient.get(
                `${this.resourceBaseUrl}/Runs/${runId}/Results`
            );

            if (!this.isSuccessResponse(response)) {
                return null;
            }

            // Server returns <RunResults><RunResult>...</RunResult></RunResults>
            // with RunResult as either a single object or an array.
            const raw = this.parseXmlResponse<{ RunResult?: LreRunResult | LreRunResult[] }>(
                response.data
            );
            if (!raw) return null;

            const resultsList: LreRunResult[] = raw.RunResult
                ? (Array.isArray(raw.RunResult) ? raw.RunResult : [raw.RunResult])
                : [];

            return { ResultsList: resultsList };
        } catch (error) {
            tl.debug(`Failed to get run results for ${runId}: ${this.getErrorMessage(error)}`);
            return null;
        }
    }

    async downloadRunResultData(runId: number, resultId: number, outputPath: string): Promise<boolean> {
        try {
            tl.debug(`Downloading result ${resultId} from run ${runId} to ${outputPath}`);

            const response = await this.httpClient.get(
                `${this.resourceBaseUrl}/Runs/${runId}/Results/${resultId}/data`,
                { responseType: 'arraybuffer' }
            );

            if (!this.isSuccessResponse(response)) {
                return false;
            }

            // Ensure directory exists
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(outputPath, response.data);
            tl.debug(`Downloaded successfully to ${outputPath}`);
            return true;
        } catch (error) {
            tl.error(`Failed to download result data: ${this.getErrorMessage(error)}`);
            return false;
        }
    }

    async getTrendReport(trendReportId: number, runId: number): Promise<LreTrendReportRoot | null> {
        try {
            const response = await this.httpClient.get(
                `${this.resourceBaseUrl}/TrendReports/${trendReportId}/${runId}`
            );

            if (!this.isSuccessResponse(response)) {
                return null;
            }

            return this.parseXmlResponse<LreTrendReportRoot>(response.data);
        } catch (error) {
            tl.debug(`Failed to get trend report: ${this.getErrorMessage(error)}`);
            return null;
        }
    }

    async downloadTrendReportPDF(trendReportId: number, runId: number, outputPath: string): Promise<boolean> {
        try {
            // Server variants differ here:
            // - Some expect /TrendReports/{trendReportId}/{runId}/data
            // - Others expect /TrendReports/{trendReportId}/data (legacy .NET behavior)
            const urls = [
                `${this.resourceBaseUrl}/TrendReports/${trendReportId}/${runId}/data`,
                `${this.resourceBaseUrl}/TrendReports/${trendReportId}/data`
            ];

            let response: AxiosResponse | null = null;
            for (const url of urls) {
                const candidate = await this.httpClient.get(url, { responseType: 'arraybuffer' });
                if (this.isSuccessResponse(candidate)) {
                    response = candidate;
                    break;
                }
                tl.debug(`Trend PDF endpoint attempt failed (${candidate.status}): ${url}`);
            }

            if (!response) {
                return false;
            }

            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(outputPath, response.data);
            tl.debug(`Trend report PDF downloaded to ${outputPath}`);
            return true;
        } catch (error) {
            tl.error(`Failed to download trend report PDF: ${this.getErrorMessage(error)}`);
            return false;
        }
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private isSuccessResponse(response: AxiosResponse): boolean {
        const validCodes = [200, 201, 202, 204];
        return validCodes.includes(response.status);
    }

    /**
     * Pins session cookies from an auth response directly onto the axios instance
     * defaults so they are sent with every subsequent request.
     *
     * Why not rely solely on the CookieJar?
     * `axios-cookiejar-support` does not forward cookies from the jar when axios
     * is configured with a `proxy` option — the proxy code-path bypasses the
     * cookie interceptors.  Setting `Cookie` on axios.defaults.headers is
     * proxy-transparent and always works.
     *
     * The server returns LWSSO_COOKIE_KEY under several path variants
     * (/loadtest, /Loadtest, /LoadTest, /FrontEnd, /SNV …).  We collect all
     * unique name=value pairs (deduplicating by value) so the server receives
     * whichever one it recognises.
     */
    private captureSessionCookies(response: AxiosResponse): void {
        const raw = response.headers['set-cookie'];
        if (!raw) {
            tl.debug('Auth response: no Set-Cookie headers received');
            return;
        }

        const headers = Array.isArray(raw) ? raw : [raw];
        const uniqueValues = new Set<string>();

        for (const h of headers) {
            const m = h.match(/^([^;]+)/);
            if (m) uniqueValues.add(m[1].trim());
        }

        this.sessionCookieHeader = [...uniqueValues].join('; ');
        this.httpClient.defaults.headers.common['Cookie'] = this.sessionCookieHeader;
        tl.debug(
            `Session cookies pinned to axios defaults ` +
            `(${headers.length} Set-Cookie header(s) → ${uniqueValues.size} unique value(s))`
        );
    }

    private parseXmlResponse<T>(xmlData: string): T | null {
        try {
            if (!xmlData || xmlData.trim() === '') {
                return null;
            }

            const parsed = this.xmlParser.parse(xmlData);

            // Navigate through XML structure (responses typically have root element)
            const rootKey = Object.keys(parsed)[0];
            return parsed[rootKey] as T;
        } catch (error) {
            tl.warning(`XML parsing failed: ${error}`);
            return null;
        }
    }

    private parseProxy(): false | { host: string; port: number; auth?: { username: string; password: string } } {
        if (!this.config.proxyUrl) {
            return false;
        }

        try {
            const url = new URL(this.config.proxyUrl);
            const proxy: { host: string; port: number; auth?: { username: string; password: string } } = {
                host: url.hostname,
                port: parseInt(url.port) || 80
            };

            if (this.config.proxyUser && this.config.proxyPassword) {
                proxy.auth = {
                    username: this.config.proxyUser,
                    password: this.config.proxyPassword
                };
            }

            return proxy;
        } catch {
            tl.warning(`Invalid proxy URL: ${this.config.proxyUrl}`);
            return false;
        }
    }

    private getErrorMessage(error: unknown): string {
        if (axios.isAxiosError(error)) {
            if (error.response) {
                const lreError = this.parseXmlResponse<LreErrorResponse>(error.response.data);
                if (lreError) {
                    return `${lreError.ExceptionMessage} (Code: ${lreError.ErrorCode})`;
                }
                return `HTTP ${error.response.status}: ${error.response.statusText}`;
            } else if (error.request) {
                return `No response from server. Check network/proxy settings.`;
            }
        }
        return error instanceof Error ? error.message : String(error);
    }

    isLoggedIn(): boolean {
        return this.isAuthenticated;
    }
}
