/**
 * LreScriptDownloader
 *
 * Handles all REST API communication with the Enterprise Performance Engineering server
 * for script download:
 *  - Authentication (username/password or API token) — identical to LreScriptUploader
 *  - Listing all scripts in a domain/project via GET /Scripts
 *  - Downloading each script's content via GET /Scripts/{id}/content
 *    (returns a zip file; saved with a .usz extension)
 *  - Logout
 *
 * The XML namespace used by the REST API:
 *   http://www.hp.com/PC/REST/API
 */

import { AxiosInstance, AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { LreDownloadConfig, RemoteScript } from '../models';
import { Logger } from '../../shared/utils/Logger';
import { buildTokenAuthXml, createLreAxiosInstance } from '../../shared/utils/LreHttpUtils';

/**
 * Minimal log-sink interface — satisfied by both Logger and DownloadBuffer.
 * Passing a DownloadBuffer as the sink keeps all per-attempt messages inside
 * the script's own log block instead of leaking them into concurrent output.
 */
export interface ILogSink {
    log(msg: string): void;
    warning(msg: string): void;
    error(msg: string): void;
    debug(msg: string): void;
}

export class LreScriptDownloader {
    private httpClient: AxiosInstance;
    private xmlParser: XMLParser;
    private baseUrl: string;
    private resourceBaseUrl: string;
    private tenantSuffix: string;
    private isAuthenticated: boolean = false;
    private sessionCookieHeader: string | undefined;

    constructor(
        private config: LreDownloadConfig,
        private logger: Logger
    ) {
        const { httpClient } = createLreAxiosInstance({
            proxyUrl: config.proxyUrl,
            proxyUser: config.proxyUser,
            proxyPassword: config.proxyPassword,
            timeoutMs: 120_000
        });
        this.httpClient = httpClient;

        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseAttributeValue: true
        });

        this.tenantSuffix   = config.tenant ? `/?tenant=${config.tenant}` : '';
        this.baseUrl         = `${config.serverUrl}/LoadTest/rest`;
        this.resourceBaseUrl = `${this.baseUrl}/domains/${config.domain}/projects/${config.project}`;

        this.logger.debug(`LreScriptDownloader initialized: ${this.baseUrl}`);
    }

    // ========================================================================
    // Authentication — mirrors LreScriptUploader exactly
    // ========================================================================

    async authenticate(): Promise<boolean> {
        const MAX_AUTH_RETRIES = 5;
        const BASE_DELAY_MS   = 5_000;

        for (let attempt = 1; attempt <= MAX_AUTH_RETRIES; attempt++) {
            try {
                const ok = this.config.useToken
                    ? await this.authenticateWithToken()
                    : await this.authenticateWithPassword();

                if (ok) return true;

                // A clean false return means the server responded with a 4xx
                // (bad credentials / forbidden) — retrying will not help.
                return false;
            } catch (error) {
                // An exception means a 5xx or network error — transient, worth retrying.
                this.logger.error(
                    `Authentication attempt ${attempt}/${MAX_AUTH_RETRIES} threw: ${this.getErrorMessage(error)}`
                );
            }

            if (attempt < MAX_AUTH_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
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
            { headers: { 'Authorization': `Basic ${encoded}`, 'Content-Type': 'application/xml' } }
        );

        if (response.status >= 500) throw new Error(`HTTP ${response.status} — server unavailable`);

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
        const xml = buildTokenAuthXml(
            this.config.clientId ?? this.config.username,
            this.config.clientSecret ?? this.config.password
        );

        const response = await this.httpClient.post(
            `${this.baseUrl}/authentication-point/authenticateclient${this.tenantSuffix}`,
            xml,
            { headers: { 'Content-Type': 'application/xml' } }
        );

        if (response.status >= 500) throw new Error(`HTTP ${response.status} — server unavailable`);

        this.isAuthenticated = this.isSuccessResponse(response);
        if (!this.isAuthenticated) {
            this.logger.error(
                `Token authentication failed. HTTP ${response.status}: ${JSON.stringify(response.data)}`
            );
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
            delete this.httpClient.defaults.headers.common['Cookie'];
            this.sessionCookieHeader = undefined;
            this.logger.log('Logged out successfully');
        } catch (e) {
            this.logger.warning(`Logout failed: ${this.getErrorMessage(e)}`);
        }
    }

    // ========================================================================
    // Script listing
    // ========================================================================

    /**
     * Fetches the complete list of scripts in the domain/project.
     *
     * API: GET /Scripts → <Scripts><Script><ID>…</ID><Name>…</Name>
     *                                      <TestFolderPath>…</TestFolderPath>…</Script></Scripts>
     */
    async fetchScriptList(): Promise<RemoteScript[]> {
        const url = `${this.resourceBaseUrl}/Scripts`;
        this.logger.debug(`Fetching script list: GET ${url}`);

        try {
            const response = await this.httpClient.get(url);

            if (!this.isSuccessResponse(response)) {
                this.logger.error(
                    `Failed to fetch script list. HTTP ${response.status}: ${JSON.stringify(response.data)}`
                );
                return [];
            }

            return this.parseScriptList(response.data);
        } catch (e) {
            this.logger.error(`Network error fetching script list: ${this.getErrorMessage(e)}`);
            return [];
        }
    }

    private parseScriptList(responseData: unknown): RemoteScript[] {
        const results: RemoteScript[] = [];
        try {
            const xml = typeof responseData === 'string' ? responseData : '';
            if (!xml) return results;

            const parsed = this.xmlParser.parse(xml);

            // Response structure: <Scripts><Script>…</Script></Scripts>
            const root    = parsed?.Scripts ?? parsed;
            const items   = root?.Script;
            if (!items) return results;

            const scripts = Array.isArray(items) ? items : [items];
            for (const s of scripts) {
                const id   = Number(s['ID'] ?? s['Id'] ?? 0);
                const name = String(s['Name'] ?? '').trim();
                const path = String(s['TestFolderPath'] ?? '').trim();
                if (id > 0 && name) {
                    results.push({ id, name, testFolderPath: path });
                }
            }
        } catch (e) {
            this.logger.error(`Could not parse script list: ${this.getErrorMessage(e)}`);
        }
        return results;
    }

    // ========================================================================
    // Script download
    // ========================================================================

    /**
     * Downloads a single script's binary content (zip) from the server.
     *
     * Retries up to MAX_RETRIES times with exponential back-off on network /
     * server errors.  On HTTP 2xx but empty body the session may have expired;
     * re-authenticates once and retries.
     *
     * @returns the raw zip Buffer on success, null on failure (all retries exhausted)
     */
    async downloadScriptContent(
        script: RemoteScript,
        sink: ILogSink
    ): Promise<Buffer | null> {
        const MAX_RETRIES   = 3;
        const BASE_DELAY_MS = 2_000;
        const url = `${this.resourceBaseUrl}/scripts/${script.id}/zip`;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                this.logger.debug(
                    `GET ${url} | attempt=${attempt}/${MAX_RETRIES}`
                );

                const response = await this.httpClient.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 300_000
                });

                if (!this.isSuccessResponse(response)) {
                    const retryNote = response.status >= 500 && attempt < MAX_RETRIES
                        ? ' — retrying...' : '';
                    if (response.status >= 500 && attempt < MAX_RETRIES) {
                        sink.log(`  Attempt ${attempt}/${MAX_RETRIES}: HTTP ${response.status}${retryNote}`);
                    } else {
                        sink.warning(`  Attempt ${attempt}/${MAX_RETRIES}: HTTP ${response.status}${retryNote}`);
                    }
                    if (attempt < MAX_RETRIES) {
                        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                        sink.debug(`  Retrying in ${delay / 1000}s...`);
                        await sleep(delay);
                    }
                    continue;
                }

                const data = Buffer.from(response.data as ArrayBuffer);
                if (!data || data.byteLength === 0) {
                    // HTTP 2xx but empty — possible session expiry
                    sink.warning(
                        `  Attempt ${attempt}/${MAX_RETRIES}: HTTP ${response.status} but empty body` +
                        (attempt < MAX_RETRIES ? ' — re-authenticating...' : '')
                    );
                    if (attempt < MAX_RETRIES) {
                        const ok = await this.authenticate();
                        if (!ok) { sink.error('  Re-authentication failed — giving up.'); return null; }
                        continue;
                    }
                    return null;
                }

                sink.log(`  Downloaded ${(data.byteLength / 1024).toFixed(1)} KB from server`);
                return data;

            } catch (e) {
                const msg = this.getErrorMessage(e);
                if (attempt < MAX_RETRIES) {
                    sink.log(`  Attempt ${attempt}/${MAX_RETRIES}: network error — ${msg}, retrying...`);
                    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                    sink.debug(`  Retrying in ${delay / 1000}s...`);
                    await sleep(delay);
                } else {
                    sink.warning(`  Attempt ${attempt}/${MAX_RETRIES}: network error — ${msg}`);
                }
            }
        }

        return null;
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    private isSuccessResponse(response: AxiosResponse): boolean {
        return [200, 201, 202, 204].includes(response.status);
    }

    private captureSessionCookies(response: AxiosResponse): void {
        const raw = response.headers['set-cookie'];
        if (!raw) { this.logger.debug('Auth response: no Set-Cookie headers received'); return; }

        const headers      = Array.isArray(raw) ? raw : [raw];
        const uniqueValues = new Set<string>();

        for (const h of headers) {
            const m = h.match(/^([^;]+)/);
            if (m) uniqueValues.add(m[1].trim());
        }

        this.sessionCookieHeader = [...uniqueValues].join('; ');
        this.httpClient.defaults.headers.common['Cookie'] = this.sessionCookieHeader;
        this.logger.debug(
            `Session cookies pinned (${headers.length} Set-Cookie header(s) → ${uniqueValues.size} unique value(s))`
        );
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) return error.message;
        return String(error);
    }
}

// ============================================================================
// Utility helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

