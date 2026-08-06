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
 */
export function createLreAxiosInstance(config: LreAxiosConfig): {
    httpClient: AxiosInstance;
    cookieJar: CookieJar;
} {
    const cookieJar = new CookieJar();

    // Build an httpsAgent only when the user has explicitly opted in to
    // insecure TLS.  The default path uses Node's built-in TLS defaults
    // (TLS 1.2+ minimum, full certificate validation).
    const httpsAgent = config.allowInsecureTls
        ? new https.Agent({
            minVersion: 'TLSv1',          // accept TLS 1.0 / 1.1 / 1.2 / 1.3
            rejectUnauthorized: false      // accept self-signed / untrusted certs
        })
        : undefined;                       // use Node default (strict)

    const httpClient = wrapper(axios.create({
        jar: cookieJar,
        timeout: config.timeoutMs ?? 120_000,
        withCredentials: true,
        validateStatus: () => true,
        ...(httpsAgent ? { httpsAgent } : {}),
        headers: {
            'Content-Type': 'application/xml',
            'Accept': 'application/xml',
            'X-QC-HIDDEN-SECURITY-ID': LRE_SECURITY_HEADER_VALUE
        },
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
