/**
 * TypeScript interfaces for OpenText Enterprise Performance Engineering REST API entities
 * Converted from C# PCEntities namespace
 */

// ============================================================================
// XML helpers
// ============================================================================

/**
 * Escapes the five XML special characters so user-supplied values
 * (username, password, clientId, clientSecret, …) cannot break or inject
 * into the XML payloads built by the toXml() classes below.
 */
export function escapeXml(value: string | number | boolean): string {
    return String(value)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&apos;');
}

// ============================================================================
// Enums (from PCConstants.cs)
// ============================================================================

export type PostRunAction = 'Collate And Analyze' | 'Collate Results' | 'Do Not Collate';

export type RunState =
    | 'Before Collating Results'
    | 'Before Creating Analysis Data'
    | 'Canceled'
    | 'Collating Results'
    | 'Creating Analysis Data'
    | 'Failed Collating Results'
    | 'Failed Creating Analysis Data'
    | 'Initializing'
    | 'Pending Creating Analysis Data'
    | 'Run Failure'
    | 'Running'
    | 'Stopping'
    | 'Finished';

export type RunSLAStatus = 'Passed' | 'Failed' | 'No Data';

// ============================================================================
// Core Entities
// ============================================================================

export interface LreTimeslotDuration {
    Hours?: number;
    Minutes: number;
}

export interface LreErrorResponse {
    ExceptionMessage: string;
    ErrorCode: number;
}

// ============================================================================
// Test Entities
// ============================================================================

export interface LreTest {
    ID: number;
    Name: string;
    TestFolderPath?: string;
    Content?: {
        AutomaticTrending?: {
            ReportId: number;
        };
    };
    ReportId?: number; // Computed from Content.AutomaticTrending.ReportId
}

export interface LreTestInstance {
    TestInstanceID: number;
    TestID: number;
    TestSetID: number;
}

export interface LreTestInstances {
    TestInstancesList: LreTestInstance[];
}

export interface LreTestSet {
    TestSetID: number;
    /** The field name in the LRE API XML response is TestSetName (C# PCTestSet.cs). */
    TestSetName?: string;
    /** Kept for backwards-compat with older code that expected Name. */
    Name?: string;
    TestSetParentId?: number;
}

export interface LreTestSets {
    TestSetsList: LreTestSet[];
}

export interface LreTestSetFolder {
    /** Numeric ID of this folder as returned by the LRE API.
     *  Note: field name from server is TestSetFolderId (lowercase 'd'). Root folder = 0. */
    TestSetFolderId: number;
    /** Display name returned by the API as TestSetFolderName. */
    TestSetFolderName: string;
    /** ID of the parent folder (-1 for Root). */
    Parent?: number;
}

export interface LreTestSetFolders {
    TestSetFoldersList: LreTestSetFolder[];
}

// ============================================================================
// Run Entities
// ============================================================================

export interface LreRunRequest {
    TestID: number;
    TestInstanceID: number;
    TimeslotDuration: LreTimeslotDuration;
    PostRunAction: PostRunAction;
    VudsMode: boolean;
}

export interface LreRunResponse {
    ID: number; // Run ID
    TestID: number;
    TestInstanceID: number;
    TimeslotID: number;
    Duration: number; // in seconds
    RunState: RunState;
    RunSLAStatus?: RunSLAStatus;
    PostRunAction: PostRunAction;
    VudsMode: boolean;
}

// ============================================================================
// Run Results & Logging
// ============================================================================

export interface LreRunResult {
    ID: number;
    Name: string;
    Type?: string;
    RunID: number;
}

export interface LreRunResults {
    ResultsList: LreRunResult[];
}

export interface LreRunEventLogRecord {
    ID: number;
    Type: string;
    Description: string;
    Time: string;
}

export interface LreRunEventLog {
    RecordsList: LreRunEventLogRecord[];
}

// ============================================================================
// Trend Report Entities
// ============================================================================

export interface LreTrendReport {
    ID: number;
    ReportName: string;
}

export interface LreTrendReports {
    TrendReportList: LreTrendReport[];
}

export interface LreTrendReportRoot {
    TrendReport: {
        ID: number;
        GeneratedReport?: string; // XML data
    };
}

// ============================================================================
// Authentication Entities
// ============================================================================


export interface LreAuthenticationClient {
    ClientIdKey: string;
    ClientSecretKey: string;
}


export interface LreConfig {
    serverUrl: string; // e.g., "https://lre.example.com"
    domain: string;
    project: string;
    useToken: boolean;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
    tenant?: string; // optional GUID for multi-tenant
    proxyUrl?: string;
    proxyUser?: string;
    proxyPassword?: string;
}

export interface LreTestExecutionConfig {
    testId: number;
    testInstanceId?: number; // optional, will be auto-created if not provided
    autoTestInstance: boolean;
    timeslotDurationMinutes: number;
    postRunAction: PostRunAction;
    useVuds: boolean;
    useSLAStatus: boolean;
    trending: 'DoNotTrend' | 'AssociatedTrend' | 'UseTrendReportID';
    trendReportId?: number;
    timeslotRepeat: 'DoNotRepeat' | 'RepeatWithParameters';
    timeslotRepeatDelay?: number;    // minutes between retry attempts
    timeslotRepeatAttempts?: number; // max number of retry attempts
}

// ============================================================================
// XML Serialization Helpers
// ============================================================================

export interface XmlSerializable {
    toXml(): string;
}

export class LreRunRequestXml implements LreRunRequest, XmlSerializable {
    constructor(
        public TestID: number,
        public TestInstanceID: number,
        public TimeslotDuration: LreTimeslotDuration,
        public PostRunAction: PostRunAction,
        public VudsMode: boolean
    ) {}

    toXml(): string {
        return `<?xml version="1.0" encoding="utf-8"?>
<Run xmlns="http://www.hp.com/PC/REST/API">
    <TestID>${escapeXml(this.TestID)}</TestID>
    <TestInstanceID>${escapeXml(this.TestInstanceID)}</TestInstanceID>
    <TimeslotDuration>
        <Hours>${escapeXml(this.TimeslotDuration.Hours || 0)}</Hours>
        <Minutes>${escapeXml(this.TimeslotDuration.Minutes)}</Minutes>
    </TimeslotDuration>
    <PostRunAction>${escapeXml(this.PostRunAction)}</PostRunAction>
    <VudsMode>${escapeXml(this.VudsMode)}</VudsMode>
</Run>`;
    }
}


export class LreAuthenticationClientXml implements LreAuthenticationClient, XmlSerializable {
    constructor(public ClientIdKey: string, public ClientSecretKey: string) {}

    toXml(): string {
        // Element names and root namespace must match the C# reference (PCRestProxy.AuthenticateWithToken):
        //   [XmlElement("ClientIdKey")] / [XmlElement("ClientSecretKey")]
        //   [XmlRootAttribute(Namespace = "")]  ← no namespace on the root
        return `<?xml version="1.0" encoding="utf-8"?>
<AuthenticationClient>
    <ClientIdKey>${escapeXml(this.ClientIdKey)}</ClientIdKey>
    <ClientSecretKey>${escapeXml(this.ClientSecretKey)}</ClientSecretKey>
</AuthenticationClient>`;
    }
}

export class LreTestInstanceRequestXml implements XmlSerializable {
    constructor(public TestID: number, public TestSetID: number) {}

    toXml(): string {
        return `<?xml version="1.0" encoding="utf-8"?>
<TestInstance xmlns="http://www.hp.com/PC/REST/API">
    <TestID>${escapeXml(this.TestID)}</TestID>
    <TestSetID>${escapeXml(this.TestSetID)}</TestSetID>
</TestInstance>`;
    }
}

/**
 * Creates a test set folder.
 * API field names (from docs): TestSetFolderName + Parent (numeric folder ID).
 * The xmlns namespace is required by the LRE API (error 1005 if omitted).
 *
 * The Parent field must be a real user-folder ID or the Root folder ID.
 * You cannot create test sets (not folders) directly under Root/Unattached,
 * but you CAN create test set folders under Root.
 */
export class LreTestSetFolderRequestXml implements XmlSerializable {
    constructor(public TestSetFolderName: string, public Parent: number) {}

    toXml(): string {
        return `<?xml version="1.0" encoding="utf-8"?>
<TestSetFolder xmlns="http://www.hp.com/PC/REST/API">
    <TestSetFolderName>${escapeXml(this.TestSetFolderName)}</TestSetFolderName>
    <Parent>${escapeXml(this.Parent)}</Parent>
</TestSetFolder>`;
    }
}

/**
 * Creates a test set inside a folder.
 * Field names match C# PCTestSet: TestSetName + TestSetParentId.
 * The xmlns namespace is required by the LRE API (error 1005 if omitted).
 */
export class LreTestSetRequestXml implements XmlSerializable {
    constructor(public TestSetName: string, public TestSetParentId: number) {}

    toXml(): string {
        return `<?xml version="1.0" encoding="utf-8"?>
<TestSet xmlns="http://www.hp.com/PC/REST/API">
    <TestSetName>${escapeXml(this.TestSetName)}</TestSetName>
    <TestSetParentId>${escapeXml(this.TestSetParentId)}</TestSetParentId>
</TestSet>`;
    }
}

export class LreStopRunRequestXml implements XmlSerializable {
    constructor(
        public ReleaseTimeslot: boolean = true,
        public PostRunAction: PostRunAction = 'Do Not Collate'
    ) {}

    toXml(): string {
        return `<?xml version="1.0" encoding="utf-8"?>
<PostRunActions xmlns="http://www.hp.com/PC/REST/API">
    <ReleaseTimeslot>${escapeXml(this.ReleaseTimeslot)}</ReleaseTimeslot>
    <PostRunAction>${escapeXml(this.PostRunAction)}</PostRunAction>
</PostRunActions>`;
    }
}
