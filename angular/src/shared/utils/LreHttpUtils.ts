/**
 * LreHttpUtils — shared HTTP/auth utilities used by all LRE tasks.
 *
 * Centralises two things that MUST be identical across LreCiTask,
 * LreDownloadScriptsTask and LreWorkspaceSyncTask:
 *
 *  1. The `X-QC-HIDDEN-SECURITY-ID` request header — required by every LRE
 *     REST API call.  Without it the server returns HTTP 400 with ErrorCode
 *     1101 ("Authentication information is missing from request header").
 *
 *  2. The token-authentication XML body — the root element must have NO
 *     namespace and must be preceded by the XML declaration.  Using the old
 *     `xmlns="http://www.hp.com/PC/REST/API"` attribute causes the same 400.
 */

import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as https from 'https';

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Fixed protocol constant required by every LRE REST API request.
 * This is a non-secret, publicly-documented header value defined by the
 * OpenText Enterprise Performance Engineering server API specification.
 */
export const LRE_SECURITY_HEADER_VALUE = '12';

// ─── Token-auth XML ─────────────────────────────────────────────────────────

/**
 * Builds the XML body for POST /authentication-point/authenticateclient.
 *
 * The element names and root namespace MUST match the server's expectations
 * (confirmed against live server; see C# reference PCRestProxy.AuthenticateWithToken):
 *   • XML declaration present
 *   • Root element `<AuthenticationClient>` with NO xmlns attribute
 *   • Children `<ClientIdKey>` and `<ClientSecretKey>`
 *
 * @param clientId     The API client ID (the "I_KEY_…" string)
 * @param clientSecret The API client secret (the "S_KEY_…" string)
 */
export function buildTokenAuthXml(clientId: string, clientSecret: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<AuthenticationClient>
    <ClientIdKey>${escapeXml(clientId)}</ClientIdKey>
    <ClientSecretKey>${escapeXml(clientSecret)}</ClientSecretKey>
</AuthenticationClient>`;
}

// ─── Axios factory ───────────────────────────────────────────────────────────

export interface LreAxiosConfig {
    proxyUrl?: string;
    proxyUser?: string;
    proxyPassword?: string;
    timeoutMs?: number;
    /**
     * When `true`, relaxes HTTPS security for connections to the LRE server:
     *   • Accepts TLS 1.0 / TLS 1.1 (in addition to TLS 1.2+)
     *   • Skips certificate validation (self-signed / expired / untrusted CA)
     *
     * **Default: `false`** — strict TLS 1.2+ with full certificate validation.
     *
     * Only enable this when the LRE server uses an older TLS configuration or
     * a certificate that the agent machine cannot validate.  Using this option
     * in production is a security trade-off: man-in-the-middle attacks become
     * possible on the connection between the ADO agent and the LRE server.
     */
    allowInsecureTls?: boolean;
}

/**
 * Creates an axios instance pre-configured with:
 *   • CookieJar support
 *   • `X-QC-HIDDEN-SECURITY-ID` default header
 *   • `Content-Type: application/xml` and `Accept: application/xml` defaults
 *   • Optional proxy
 *   • `validateStatus: () => true` — callers check status codes themselves
 *   • Optional relaxed TLS agent (only when `allowInsecureTls` is `true`)
 *
 * Implementation note — two code paths:
 *
 *   DEFAULT (`allowInsecureTls` = false):
 *     Use `axios-cookiejar-support`'s `wrapper()` which installs its own
 *     adapter.  No custom httpsAgent — Node TLS defaults apply (TLS 1.2+,
 *     full certificate validation).
 *
 *   INSECURE (`allowInsecureTls` = true):
 *     `axios-cookiejar-support` v1+ throws
 *     "does not support for use with other http(s).Agent" when it detects a
 *     custom httpsAgent inside `axios.create()`.  To avoid this conflict we
 *     bypass `wrapper()` entirely and replicate its cookie behaviour with
 *     plain axios interceptors, while still passing the custom httpsAgent.
 */
export function createLreAxiosInstance(config: LreAxiosConfig): {
    httpClient: AxiosInstance;
    cookieJar: CookieJar;
} {
    const cookieJar = new CookieJar();

    const commonHeaders = {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
        'X-QC-HIDDEN-SECURITY-ID': LRE_SECURITY_HEADER_VALUE
    };

    if (config.allowInsecureTls) {
        // ── Insecure-TLS path ────────────────────────────────────────────────
        // axios-cookiejar-support v1+ is incompatible with a custom httpsAgent
        // (it throws at request-time).  We replicate cookie-jar behaviour with
        // interceptors and pass the agent directly to axios.create().
        const httpsAgent = new https.Agent({
            minVersion: 'TLSv1',       // accept TLS 1.0 / 1.1 / 1.2 / 1.3
            rejectUnauthorized: false  // accept self-signed / untrusted-CA certs
        });

        const httpClient = axios.create({
            timeout: config.timeoutMs ?? 120_000,
            withCredentials: true,
            validateStatus: () => true,
            httpsAgent,
            headers: commonHeaders,
            proxy: parseProxy(config)
        });

        // Request interceptor — attach stored cookies
        httpClient.interceptors.request.use(async reqConfig => {
            try {
                const url = resolveUrl(reqConfig);
                if (url) {
                    const cookieString = await cookieJar.getCookieString(url);
                    if (cookieString) {
                        reqConfig.headers = reqConfig.headers ?? {};
                        reqConfig.headers['Cookie'] = cookieString;
                    }
                }
            } catch { /* ignore cookie errors */ }
            return reqConfig;
        });

        // Response interceptor — store Set-Cookie headers
        httpClient.interceptors.response.use(async response => {
            try {
                const url = resolveUrl(response.config);
                if (url) {
                    const setCookie = response.headers['set-cookie'];
                    if (setCookie) {
                        const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
                        for (const c of cookies) {
                            try { await cookieJar.setCookie(c, url); } catch { /* ignore */ }
                        }
                    }
                }
            } catch { /* ignore cookie errors */ }
            return response;
        });

        return { httpClient, cookieJar };
    }

    // ── Default (strict TLS) path ────────────────────────────────────────────
    // wrapper() installs its own adapter for cookie handling.  No custom
    // httpsAgent — Node's OpenSSL defaults enforce TLS 1.2+ and full
    // certificate-chain validation.
    const httpClient = wrapper(axios.create({
        jar: cookieJar,
        timeout: config.timeoutMs ?? 120_000,
        withCredentials: true,
        validateStatus: () => true,
        headers: commonHeaders,
        proxy: parseProxy(config)
    }));

    return { httpClient, cookieJar };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Reconstructs the full request URL from an axios request config so that
 * the manual cookie interceptors can look up / store cookies correctly.
 */
function resolveUrl(reqConfig: { url?: string; baseURL?: string }): string | null {
    const url = reqConfig.url ?? '';
    const base = reqConfig.baseURL ?? '';
    if (!url && !base) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (base) return base.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
    return null;
}

function parseProxy(config: LreAxiosConfig): false | {
    host: string;
    port: number;
    auth?: { username: string; password: string };
} {
    if (!config.proxyUrl) return false;
    try {
        const url = new URL(config.proxyUrl);
        const proxy: { host: string; port: number; auth?: { username: string; password: string } } = {
            host: url.hostname,
            port: parseInt(url.port) || 80
        };
        if (config.proxyUser && config.proxyPassword) {
            proxy.auth = { username: config.proxyUser, password: config.proxyPassword };
        }
        return proxy;
    } catch {
        return false;
    }
}
