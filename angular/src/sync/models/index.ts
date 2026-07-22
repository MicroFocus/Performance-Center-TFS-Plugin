/**
 * Models for Enterprise Performance Engineering Workspace Sync Task
 */

export interface LreSyncConfig {
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
    workspaceDir: string;
    runtimeOnly: boolean;
    artifactsDir: string;
    /**
     * Optional git commit SHA to use as the base for differential sync.
     * When set, only script folders containing files changed since this
     * commit are uploaded. Falls back to full sync if git diff fails.
     */
    baseCommitSha?: string;
}

export interface ScriptFolder {
    /** Absolute path to the script folder */
    fullPath: string;
    /** Path relative to workspace root */
    relativePath: string;
    /** Name of the folder (last segment) */
    folderName: string;
    /** Name to use for the zip file */
    zipFileName: string;
    /** Subject path for upload in the test plan (e.g. "Subject\scripts\MyScript") */
    subjectPath: string;
}

export interface UploadResult {
    scriptFolder: ScriptFolder;
    success: boolean;
    scriptId?: number;
    method?: 'POST' | 'PUT' | 'POST_RETRY' | 'PUT_RETRY';
    error?: string;
}

/** Script entry as returned by GET /Scripts (JSON response) */
export interface LreScript {
    ID: number;
    Name: string;
    TestFolderPath: string;
    IsScriptLocked: boolean;
}

