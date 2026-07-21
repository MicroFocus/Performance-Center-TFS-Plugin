/**
 * serverUtils — shared helpers used by both LreCiTask and LreWorkspaceSyncTask.
 */

/**
 * Parses the varPCServer input which may be a bare host:port or a full URL
 * with an optional tenant query-string: https://host/?tenant=<guid>
 *
 * Returns the origin (scheme + host + port) and the tenant GUID separately so
 * callers can append ?tenant=… only to the auth endpoints that require it.
 */
export function parseServerInput(raw: string): { serverUrl: string; tenant?: string } {
    try {
        const parsed = new URL(raw);
        return {
            serverUrl: parsed.origin,
            tenant: parsed.searchParams.get('tenant') ?? undefined
        };
    } catch {
        return { serverUrl: raw };
    }
}

