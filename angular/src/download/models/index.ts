/**
 * Models for Enterprise Performance Engineering Download Scripts Task
 */

export interface LreDownloadConfig {
    serverUrl: string;
    tenant?: string;
    useToken: boolean;
    /** username or clientId (token mode) */
    username: string;
    /** password or clientSecret (token mode) */
    password: string;
    clientId?: string;
    clientSecret?: string;
    domain: string;
    project: string;
    proxyUrl?: string;
    proxyUser?: string;
    proxyPassword?: string;
    /**
     * When `true`, relaxes HTTPS security: accepts TLS 1.0/1.1 and
     * self-signed / untrusted certificates.  Default: `false`.
     */
    allowInsecureTls?: boolean;
    /** Local directory where downloaded scripts are written */
    workspaceDir: string;
    artifactsDir: string;
}

/** Script entry as returned by GET /Scripts */
export interface RemoteScript {
    /** Script ID on the server */
    id: number;
    /** Script name (used as the .usz file name, without extension) */
    name: string;
    /**
     * Folder path on the server, e.g. "Subject\scripts\DevWeb".
     * The leading "Subject\" segment is stripped when computing the local path.
     */
    testFolderPath: string;
}

export interface DownloadResult {
    script: RemoteScript;
    success: boolean;
    /** Absolute local directory where the script was extracted */
    localPath?: string;
    error?: string;
}

