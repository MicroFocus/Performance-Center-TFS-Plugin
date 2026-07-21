/**
 * LreScriptUploader
 *
 * Handles all REST API communication with the Enterprise Performance Engineering server for script upload:
 *  - Authentication (username/password or API token)
 *  - Creating test plan folders (ensuring the subject path exists)
 *  - Uploading scripts via multipart POST to /Scripts endpoint
 *  - Logout
 *
 * The API uses application/xml for structured calls and
 * multipart/form-data for the script upload (File + XML metadata).
 *
 * The xmlns used in all XML payloads is the HP/OpenText PC REST API namespace:
 *   http://www.hp.com/PC/REST/API
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import { LreSyncConfig } from '../models';
import { Logger } from '../../shared/utils/Logger';

const PC_API_XMLNS = 'http://www.hp.com/PC/REST/API';

/**
 * Minimal log-sink interface satisfied by both Logger and the UploadBuffer
 * used in LreWorkspaceSyncRunner.  Passing an UploadBuffer as the sink
 * keeps all per-attempt retry messages inside the script's own log block
 * instead of leaking them into the surrounding concurrent output.
 */
export interface ILogSink {
    log(msg: string): void;
    warning(msg: string): void;
    error(msg: string): void;
    debug(msg: string): void;
}

export class LreScriptUploader {
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
    /**
     * In-memory cache of all known test plan folder full paths (lower-cased).
     * Populated on first call to ensureTestPlanFolderExists and reused for all
     * subsequent calls within the same sync session — avoids one GET per unique path.
     */
    private existingFolderPaths: Set<string> | null = null;

    constructor(
        private config: LreSyncConfig,
        private logger: Logger
    ) {
        this.cookieJar = new CookieJar();

        this.httpClient = wrapper(axios.create({
            jar: this.cookieJar,
            timeout: 120000,
            withCredentials: true,
            // Never throw on HTTP error status — we check manually
            validateStatus: () => true,
            headers: {
                'Content-Type': 'application/xml',
                'Accept': 'application/xml'
            },
            proxy: this.parseProxy()
        }));


        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseAttributeValue: true
        });

        this.tenantSuffix = config.tenant ? `/?tenant=${config.tenant}` : '';
        this.baseUrl = `${config.serverUrl}/LoadTest/rest`;
        this.resourceBaseUrl = `${this.baseUrl}/domains/${config.domain}/projects/${config.project}`;

        this.logger.debug(`LreScriptUploader initialized: ${this.baseUrl}`);
    }

    // ========================================================================
    // Authentication
    // ========================================================================

    /**
     * Authenticates with the server, retrying up to 5 times with exponential
     * back-off (5 s → 10 s → 20 s → 40 s) on 5xx / network errors.
     * This handles the case where the server's IIS application pool has just
     * recycled and is still warming up (HTTP 503 for up to ~90 s).
     */
    async authenticate(): Promise<boolean> {
        const MAX_AUTH_RETRIES = 5;
        const BASE_DELAY_MS = 5000;

        for (let attempt = 1; attempt <= MAX_AUTH_RETRIES; attempt++) {
            try {
                const ok = this.config.useToken
                    ? await this.authenticateWithToken()
                    : await this.authenticateWithPassword();

                if (ok) return true;

                // authenticateWithPassword/Token already logged the failure.
                // Only retry on server-side errors (5xx); for 4xx (bad credentials)
                // there is no point retrying.
                // We detect 5xx by checking the last response stored in isAuthenticated
                // path — but since we don't have the status code here, we retry
                // for any failure and let the inner method decide to log.
            } catch (error) {
                this.logger.error(
                    `Authentication attempt ${attempt}/${MAX_AUTH_RETRIES} threw: ${this.getErrorMessage(error)}`
                );
            }

            if (attempt < MAX_AUTH_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 5 s, 10 s, 20 s, 40 s
                this.logger.warning(
                    `Authentication failed (attempt ${attempt}/${MAX_AUTH_RETRIES}). ` +
                    `Server may be starting up. Retrying in ${delay / 1000} s...`
                );
                await sleep(delay);
            }
        }

        this.logger.error(`Authentication failed after ${MAX_AUTH_RETRIES} attempts.`);
        return false;
    }

    private async authenticateWithPassword(): Promise<boolean> {
        this.logger.debug(`Authenticating with username/password: ${this.config.username}`);
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

        if (response.status >= 500) {
            // 5xx = server-side / transient — throw so the caller can retry
            throw new Error(`HTTP ${response.status} — server unavailable`);
        }

        this.isAuthenticated = this.isSuccessResponse(response);
        if (!this.isAuthenticated) {
            this.logger.error(`Authentication failed. HTTP ${response.status}: ${JSON.stringify(response.data)}`);
        } else {
            this.captureSessionCookies(response);
        }
        this.logger.log(`Authentication ${this.isAuthenticated ? 'succeeded' : 'failed'}`);
        return this.isAuthenticated;
    }

    private async authenticateWithToken(): Promise<boolean> {
        this.logger.debug(`Authenticating with API token`);
        const xml = `<AuthenticationClient xmlns="${PC_API_XMLNS}"><ClientIdKey>${escapeXml(this.config.clientId ?? this.config.username)}</ClientIdKey><ClientSecretKey>${escapeXml(this.config.clientSecret ?? this.config.password)}</ClientSecretKey></AuthenticationClient>`;

        const response = await this.httpClient.post(
            `${this.baseUrl}/authentication-point/authenticateclient${this.tenantSuffix}`,
            xml,
            { headers: { 'Content-Type': 'application/xml' } }
        );

        if (response.status >= 500) {
            throw new Error(`HTTP ${response.status} — server unavailable`);
        }

        this.isAuthenticated = this.isSuccessResponse(response);
        if (!this.isAuthenticated) {
            this.logger.error(`Token authentication failed. HTTP ${response.status}: ${JSON.stringify(response.data)}`);
        } else {
            this.captureSessionCookies(response);
        }
        this.logger.log(`Token authentication ${this.isAuthenticated ? 'succeeded' : 'failed'}`);
        return this.isAuthenticated;
    }

    async logout(): Promise<void> {
        if (!this.isAuthenticated) return;
        try {
            await this.httpClient.get(
                `${this.baseUrl}/authentication-point/logout${this.tenantSuffix}`
            );
            this.isAuthenticated = false;
            // Clear the pinned session cookie so it cannot be reused after logout.
            delete this.httpClient.defaults.headers.common['Cookie'];
            this.sessionCookieHeader = undefined;
            this.logger.log('Logged out successfully');
        } catch (e) {
            this.logger.warning(`Logout failed: ${this.getErrorMessage(e)}`);
        }
    }

    // ========================================================================
    // Test Plan Folder
    // ========================================================================

    /**
     * Ensures the given subject path exists in the test plan, creating any
     * missing folders along the way.
     *
     * Strategy:
     *  1. Fetch all existing folders once per sync session via GET /testplan →
     *     build a Set of known full paths (e.g. "Subject", "Subject\scripts").
     *     The set is cached in `existingFolderPaths` and reused for every
     *     subsequent call within the same session.
     *  2. Walk the path incrementally ("Subject" → "Subject\scripts" → …):
     *       • If the incremental path is already in the set  → skip.
     *       • If not → POST to /testplan with the EXISTING parent path and
     *         the NEW folder name, then add the new path to the set so deeper
     *         segments can build on top of it in the same call.
     *
     * API contract (confirmed against live server):
     *   GET  /testplan          → <TestPlanFolders><TestPlanFolder><FullPath>…
     *   POST /testplan  body:   <TestPlanFolder xmlns="…">
     *                             <Path>Subject\existing\parent</Path>
     *                             <Name>newFolderName</Name>
     *                           </TestPlanFolder>
     *
     * Note: "Subject" is the mandatory root folder; the API returns HTTP 400
     * when you try to create it (it already exists).  The new implementation
     * never tries to create it — it is always present in the GET response.
     */
    async ensureTestPlanFolderExists(subjectPath: string): Promise<void> {
        try {
            // ── 1. Fetch (or reuse cached) existing folder full-paths ──────
            if (this.existingFolderPaths === null) {
                this.existingFolderPaths = await this.fetchExistingFolderPaths();
            }

            // ── 2. Walk path segments; create any that are missing ─────────
            // e.g. subjectPath = "Subject\scripts\DevWeb\examples"
            // iterations: "Subject", "Subject\scripts", "Subject\scripts\DevWeb", ...
            const segments = subjectPath.split('\\').filter(s => s.length > 0);

            for (let i = 0; i < segments.length; i++) {
                const fullPathToHere = segments.slice(0, i + 1).join('\\');

                if (this.existingFolderPaths.has(fullPathToHere.toLowerCase())) {
                    // Folder already exists — nothing to do at this level
                    continue;
                }

                // Build the parent path (everything before the current segment)
                const parentPath = segments.slice(0, i).join('\\');

                const xml =
                    `<TestPlanFolder xmlns="${PC_API_XMLNS}">` +
                    `<Path>${escapeXml(parentPath)}</Path>` +
                    `<Name>${escapeXml(segments[i]!)}</Name>` +
                    `</TestPlanFolder>`;

                const resp = await this.httpClient.post(
                    `${this.resourceBaseUrl}/testplan`,
                    xml,
                    { headers: { 'Content-Type': 'application/xml' } }
                );

                if (this.isSuccessResponse(resp)) {
                    this.existingFolderPaths.add(fullPathToHere.toLowerCase());
                    this.logger.debug(`Created test plan folder: '${fullPathToHere}'`);
                } else {
                    this.logger.warning(
                        `Could not create folder '${fullPathToHere}' (HTTP ${resp.status}). ` +
                        `Upload to '${subjectPath}' may fail.`
                    );
                    // Stop creating deeper segments — parent failed
                    break;
                }
            }
        } catch (e) {
            this.logger.warning(
                `Error ensuring folder path '${subjectPath}': ${this.getErrorMessage(e)}`
            );
        }
    }

    /**
     * Fetches the complete test plan folder list from the server and returns a
     * Set of all known full paths, lower-cased for case-insensitive matching.
     *
     * API: GET /testplan → <TestPlanFolders><TestPlanFolder><FullPath>…
     */
    private async fetchExistingFolderPaths(): Promise<Set<string>> {
        const paths = new Set<string>();
        try {
            const response = await this.httpClient.get(
                `${this.resourceBaseUrl}/testplan`
            );
            if (this.isSuccessResponse(response)) {
                const raw = this.xmlParser.parse(
                    typeof response.data === 'string' ? response.data : ''
                );
                const root = raw?.TestPlanFolders ?? raw;
                const items = root?.TestPlanFolder;
                const folders: Array<Record<string, unknown>> = !items
                    ? []
                    : Array.isArray(items) ? items : [items];
                for (const f of folders) {
                    const fullPath = String(f['FullPath'] ?? '');
                    if (fullPath) paths.add(fullPath.toLowerCase());
                }
                this.logger.debug(`Fetched ${paths.size} existing test plan folder(s).`);
            } else {
                this.logger.warning(
                    `Could not retrieve test plan folders (HTTP ${response.status}). ` +
                    `Folder creation will proceed assuming no folders exist yet.`
                );
            }
        } catch (e) {
            this.logger.warning(
                `Error fetching test plan folders: ${this.getErrorMessage(e)}`
            );
        }
        return paths;
    }

    // ========================================================================
    // Script Upload
    // ========================================================================

    /**
     * Uploads a script zip to the server with up to MAX_RETRIES attempts.
     *
     * Error hierarchy handled here:
     *  1. Network errors (ECONNRESET, ETIMEDOUT) — caught, retried with
     *     exponential back-off (2 s → 4 s).
     *  2. HTTP 5xx / 4xx — returned as 0 by tryUploadScript, retried same way.
     *  3. HTTP 2xx but NO script ID in body — signals session expiry (app-pool
     *     recycle after 503 invalidates cookies). Re-authenticate immediately
     *     and retry without extra delay.
     *
     * @param zipPath     Absolute path to the zip file
     * @param subjectPath subject path in the test plan (e.g. "Subject\scripts")
     * @param runtimeOnly Whether to upload as runtime-only
     * @param sink        Optional log sink; when provided (e.g. an UploadBuffer) all
     *                    per-attempt messages are written there so they appear grouped
     *                    with the script's own log block rather than scattered in the
     *                    surrounding concurrent output.  Falls back to this.logger.
     * @returns script ID on success, 0 on failure (all attempts exhausted)
     */
    async uploadScript(
        zipPath: string,
        subjectPath: string,
        runtimeOnly: boolean,
        sink?: ILogSink
    ): Promise<number> {
        const MAX_RETRIES = 3;
        const BASE_DELAY_MS = 2000; // 2 s, 4 s (exponential)
        const effectiveSink: ILogSink = sink ?? this.logger;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const result = await this.tryUploadScript(
                    zipPath, subjectPath, runtimeOnly, attempt, MAX_RETRIES, effectiveSink
                );

                if (result.scriptId > 0) return result.scriptId;

                if (result.sessionExpired && attempt < MAX_RETRIES) {
                    // Session cookie was invalidated (e.g. IIS app-pool recycle after 503).
                    // Re-authenticate now; the retry will use the fresh session.
                    effectiveSink.warning(
                        `  Attempt ${attempt}/${MAX_RETRIES}: HTTP ${result.httpStatus} — ` +
                        `session may have expired, re-authenticating...`
                    );
                    const ok = await this.authenticate();
                    if (!ok) {
                        effectiveSink.error(`  Re-authentication failed — giving up.`);
                        return 0;
                    }
                    // Retry immediately — fresh session, no back-off needed
                    continue;
                }
            } catch (e) {
                // Network-level error (ECONNRESET, ETIMEDOUT, socket hang up, etc.)
                const msg = this.getErrorMessage(e);
                if (attempt < MAX_RETRIES) {
                    effectiveSink.log(
                        `  Attempt ${attempt}/${MAX_RETRIES}: network error — ${msg}, retrying...`
                    );
                } else {
                    effectiveSink.warning(
                        `  Attempt ${attempt}/${MAX_RETRIES}: network error — ${msg}`
                    );
                }
            }

            if (attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 2 s, 4 s
                effectiveSink.debug(`  Retrying in ${delay / 1000}s...`);
                await sleep(delay);
            }
        }

        return 0;
    }

    private async tryUploadScript(
        zipPath: string,
        subjectPath: string,
        runtimeOnly: boolean,
        attempt: number,
        maxRetries: number,
        sink: ILogSink
    ): Promise<{ scriptId: number; sessionExpired: boolean; httpStatus: number }> {
        const url = `${this.resourceBaseUrl}/Scripts`;

        const metaXml = buildScriptCreateXml(subjectPath, true, runtimeOnly, false);
        const form = new FormData();
        form.append('filename', fs.createReadStream(zipPath), {
            filename: path.basename(zipPath),
            contentType: 'application/octet-stream'
        });
        form.append('file', metaXml, { contentType: 'text/plain' });

        this.logger.debug(
            `POST ${url} | subjectPath=${subjectPath} | zip=${path.basename(zipPath)} | attempt=${attempt}/${maxRetries}`
        );

        const response = await this.httpClient.post(url, form, {
            headers: { ...form.getHeaders() },
            timeout: 300000
        });

        if (!this.isSuccessResponse(response)) {
            const isRetryable = response.status >= 500;
            const retryNote = isRetryable && attempt < maxRetries ? ' — retrying...' : '';
            if (isRetryable && attempt < maxRetries) {
                sink.log(
                    `  Attempt ${attempt}/${maxRetries}: HTTP ${response.status}${retryNote}`
                );
            } else {
                sink.warning(
                    `  Attempt ${attempt}/${maxRetries}: HTTP ${response.status}${retryNote}`
                );
            }
            // Log the full server response at debug level to keep the main output clean
            this.logger.debug(
                `Upload failed for ${path.basename(zipPath)}. HTTP ${response.status}: ` +
                `${JSON.stringify(response.data)}`
            );
            return { scriptId: 0, sessionExpired: false, httpStatus: response.status };
        }

        const scriptId = this.extractScriptId(response.data);
        if (scriptId === 0) {
            // HTTP 2xx but no ID — most likely session expiry (auth cookie invalidated).
            // Log a snippet to aid diagnosis.
            const snippet = typeof response.data === 'string'
                ? response.data.slice(0, 300).replace(/[\r\n]+/g, ' ')
                : JSON.stringify(response.data).slice(0, 300);
            sink.warning(
                `  Attempt ${attempt}/${maxRetries}: HTTP ${response.status} but no script ID — snippet: ${snippet}`
            );
            return { scriptId: 0, sessionExpired: true, httpStatus: response.status };
        }

        return { scriptId, sessionExpired: false, httpStatus: response.status };
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    private isSuccessResponse(response: AxiosResponse): boolean {
        return [200, 201, 202, 204].includes(response.status);
    }

    private extractScriptId(responseData: unknown): number {
        try {
            // Handle JSON response (server returns JSON when Accept: application/json is used)
            if (typeof responseData === 'object' && responseData !== null) {
                const obj = responseData as Record<string, unknown>;
                if (typeof obj['ID'] === 'number') return obj['ID'] as number;
                if (typeof obj['ID'] === 'string') return Number(obj['ID']);
            }
            // Handle XML response (sent when Accept: application/xml is set)
            const xml = typeof responseData === 'string' ? responseData : '';
            if (xml) {
                const parsed = this.xmlParser.parse(xml);
                // Response: <Script><ID>123</ID>...</Script>
                const script = parsed?.Script ?? parsed?.['Script'];
                if (script?.ID) {
                    return Number(script.ID);
                }
                // Try direct parse for edge cases
                const match = xml.match(/<ID>(\d+)<\/ID>/);
                if (match) return Number(match[1]);
            }
        } catch (e) {
            this.logger.debug(`Could not parse script ID from response: ${e}`);
        }
        return 0;
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
     */
    private captureSessionCookies(response: AxiosResponse): void {
        const raw = response.headers['set-cookie'];
        if (!raw) {
            this.logger.debug('Auth response: no Set-Cookie headers received');
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
        this.logger.debug(
            `Session cookies pinned to axios defaults ` +
            `(${headers.length} Set-Cookie header(s) → ${uniqueValues.size} unique value(s))`
        );
    }

    private parseProxy(): false | { host: string; port: number; auth?: { username: string; password: string } } {
        if (!this.config.proxyUrl) return false;
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
            this.logger.warning(`Invalid proxy URL: ${this.config.proxyUrl}`);
            return false;
        }
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) return error.message;
        return String(error);
    }
}

// ============================================================================
// XML helpers
// ============================================================================

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildScriptCreateXml(
    testFolderPath: string,
    overwrite: boolean,
    runtimeOnly: boolean,
    keepCheckedOut: boolean
): string {
    return `<Script xmlns="${PC_API_XMLNS}">` +
        `<TestFolderPath>${escapeXml(testFolderPath)}</TestFolderPath>` +
        `<Overwrite>${overwrite}</Overwrite>` +
        `<RuntimeOnly>${runtimeOnly}</RuntimeOnly>` +
        `<KeepCheckedOut>${keepCheckedOut}</KeepCheckedOut>` +
        `</Script>`;
}
