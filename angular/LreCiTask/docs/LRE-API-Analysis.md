# OpenText Enterprise Performance Engineering REST API Analysis

## Official Reference

> **Public API Documentation**
> https://admhelp.microfocus.com/lre/en/all/api_refs/Performance_Center_REST_API/Content/Welcome.htm
>
> All endpoint signatures, XML schemas, and error codes are documented there.
> This document records the *implementation-level* details discovered by reading both
> the official docs and the .NET reference implementation (`PC.Plugins.Common/Rest/PCRestProxy.cs`).

---

## Base URLs

| Purpose | Pattern |
|---|---|
| REST root | `{protocol}://{server}[:{port}]/LoadTest/rest` |
| Auth | `{REST root}/authentication-point` |
| Resources | `{REST root}/domains/{domain}/projects/{project}` |

---

## Required Headers (all requests)

| Header | Value | Notes |
|---|---|---|
| `X-QC-HIDDEN-SECURITY-ID` | `12` | **Required on every request** — server returns 1101 without it |
| `Accept` | `application/xml` | |
| `Content-Type` | `application/xml` | POST/PUT only |

---

## Tenant (multi-tenancy)

When a tenant GUID is configured, append it to **auth and logout URLs only** as a
`/?tenant=<guid>` path-suffix (not a query string on resource URLs):

```
/authentication-point/authenticate/?tenant=fa128c06-5436-413d-9cfa-9f04bb738df3
/authentication-point/logout/?tenant=fa128c06-5436-413d-9cfa-9f04bb738df3
```

Resource URLs (`/domains/{d}/projects/{p}/...`) do **not** carry the tenant.

> **⚠️ Implementation note** – the .NET `RestEntity.PCClientRequest` appends the tenant
> value as `"/" + tenantString` where `tenantString` already contains `"?tenant=guid"`,
> producing the `/?tenant=guid` suffix pattern above.

---

## Authentication

### Username / Password
```
GET /LoadTest/rest/authentication-point/authenticate/?tenant={guid}
Authorization: Basic {base64(user:password)}
Content-Type: application/xml
X-QC-HIDDEN-SECURITY-ID: 12
```
**Response**: HTTP 200, empty body, `Set-Cookie: LWSSO_COOKIE_KEY=...`

> **⚠️ Correction vs. earlier analysis** – this is a **GET**, not a POST.
> Credentials go in the `Authorization: Basic` header, not in an XML body.

### API Token (SSO)
```
POST /LoadTest/rest/authentication-point/authenticateclient/?tenant={guid}
Content-Type: application/xml
X-QC-HIDDEN-SECURITY-ID: 12

<?xml version="1.0" encoding="utf-8"?>
<AuthenticationClient xmlns="http://www.hp.com/PC/REST/API">
  <ClientId>{clientId}</ClientId>
  <ClientSecret>{clientSecret}</ClientSecret>
</AuthenticationClient>
```
**Response**: HTTP 200, `Set-Cookie: LWSSO_COOKIE_KEY=...`

### Logout
```
GET /LoadTest/rest/authentication-point/logout/?tenant={guid}
```
**Response**: HTTP 200

---

## Test Management

### Get Test by ID
```
GET /LoadTest/rest/domains/{domain}/projects/{project}/tests/{testId}
```
**Response XML root**: `<Test xmlns="http://www.hp.com/PC/REST/API">`

Relevant fields:
```xml
<Test>
  <ID>180</ID>
  <Name>test1</Name>
  <TestFolderPath>Subject\Tests</TestFolderPath>
  <Content>
    <AutomaticTrending>
      <ReportId>5</ReportId>     <!-- populated if auto-trending is enabled -->
    </AutomaticTrending>
    ...
  </Content>
</Test>
```

> **⚠️ Implementation note** – `ReportId` lives inside `Content.AutomaticTrending`, not at
> the `Test` root. Client code must manually promote it: `lreTest.ReportId = lreTest.Content?.AutomaticTrending?.ReportId`.

### Get All Test Instances
```
GET /LoadTest/rest/domains/{domain}/projects/{project}/testinstances
```
**Response XML root**: `<TestInstances xmlns="http://www.hp.com/PC/REST/API">`

```xml
<TestInstances>
  <TestInstance>
    <TestID>180</TestID>
    <TestSetID>100</TestSetID>   <!-- capital D -->
    <TestInstanceID>8</TestInstanceID>
  </TestInstance>
  ...
</TestInstances>
```

> **⚠️ Correction** – The `?filter=query={TestID}[{id}]` query string returns **HTTP 500**
> on at least one server version. Always fetch all instances and filter client-side.
>
> **⚠️ XML field name** – the field is `<TestSetID>` (capital D), not `TestSetId`.
>
> **⚠️ fast-xml-parser** – when only one `<TestInstance>` child exists, the parser returns
> a plain object; when multiple exist it returns an array. Always normalise:
> `Array.isArray(raw.TestInstance) ? raw.TestInstance : [raw.TestInstance]`

### Create Test Instance
```
POST /LoadTest/rest/domains/{domain}/projects/{project}/testinstances
Content-Type: application/xml

<?xml version="1.0" encoding="utf-8"?>
<TestInstance xmlns="http://www.hp.com/PC/REST/API">
  <TestID>{testId}</TestID>
  <TestSetID>{testSetId}</TestSetID>
</TestInstance>
```
**Response**: HTTP 201, `<TestInstance>` with `<TestInstanceID>`

### Get All Test Sets
```
GET /LoadTest/rest/domains/{domain}/projects/{project}/testsets
```
**Response**: `<TestSets>` with `<TestSet>` children, each having `<TestSetID>` and `<Name>`

---

## Test Execution

### Start Run
```
POST /LoadTest/rest/domains/{domain}/projects/{project}/Runs
Content-Type: application/xml

<?xml version="1.0" encoding="utf-8"?>
<Run xmlns="http://www.hp.com/PC/REST/API">
  <TestID>{testId}</TestID>
  <TestInstanceID>{testInstanceId}</TestInstanceID>
  <TimeslotDuration>
    <Hours>{hours}</Hours>
    <Minutes>{minutes}</Minutes>
  </TimeslotDuration>
  <PostRunAction>{action}</PostRunAction>
  <!-- "Collate And Analyze" | "Collate Results" | "Do Not Collate" -->
  <VudsMode>{true|false}</VudsMode>
</Run>
```
**Response**: HTTP 201, `<Run>` with `<ID>` (run ID) and `<TimeslotID>`

### Get Run Data (polling)
```
GET /LoadTest/rest/domains/{domain}/projects/{project}/Runs/{runId}
```
**Response**: `<Run>` with `<RunState>`

**Terminal states**:

| State | Meaning |
|---|---|
| `Finished` | Completed normally |
| `Run Failure` | Test failed during execution |
| `Canceled` | Stopped by user |
| `Failed Collating Results` | Post-run collation failed |
| `Failed Creating Analysis Data` | Analysis phase failed |

**Transient states** (keep polling):
`Initializing`, `Running`, `Stopping`, `Collating Results`, `Creating Analysis Data`,
`Before Collating Results`, `Before Creating Analysis Data`, `Pending Creating Analysis Data`

### Get Run Event Log
```
GET /LoadTest/rest/domains/{domain}/projects/{project}/Runs/{runId}/EventLog
```
**Response**: `<EventLog>` with `<LREMessage>` children, each having `<ID>`, `<Type>`, `<Description>`, `<Time>`

> Stream incrementally by tracking the last seen `<ID>` and only emitting new records.

### Stop Run
```
POST /LoadTest/rest/domains/{domain}/projects/{project}/Runs/{runId}
Content-Type: application/xml

<?xml version="1.0" encoding="utf-8"?>
<Run xmlns="http://www.hp.com/PC/REST/API">
  <State>Stopping</State>
  <PostRunAction>{action}</PostRunAction>
</Run>
```

---

## Results & Reports

### List Run Results
```
GET /LoadTest/rest/domains/{domain}/projects/{project}/Runs/{runId}/Results
```
**Response**: `<ResultsList>` with `<Result>` children (`<ID>`, `<Name>`, `<Type>`)

### Download Result Data (e.g., reports.zip)
```
GET /LoadTest/rest/domains/{domain}/projects/{project}/Runs/{runId}/Results/{resultId}/data
```
**Response**: Binary stream (ZIP file)

### Get Trend Report XML
```
GET /LoadTest/rest/domains/{domain}/projects/{project}/TrendReports/{trendReportId}/{runId}
```
**Response**: `<TrendReport>` XML

### Download Trend Report PDF
```
GET /LoadTest/rest/domains/{domain}/projects/{project}/TrendReports/{trendReportId}/{runId}/data
```
**Response**: Binary stream (PDF file)

---

## Error Responses

All errors return an XML body:
```xml
<Exception xmlns="http://www.hp.com/PC/REST/API">
  <ExceptionMessage>Human-readable message</ExceptionMessage>
  <ErrorCode>1101</ErrorCode>
</Exception>
```

Common error codes:

| Code | Meaning |
|---|---|
| 1001 | Operation failed (generic server error) |
| 1003 | Resource not found |
| 1101 | Authentication information missing from request header |

---

## Cookie Behaviour

The session cookie is `LWSSO_COOKIE_KEY`. The server sets it with multiple `path` values
(`/loadtest`, `/Loadtest`, `/LoadTest`, `/FrontEnd`, `/SNV`, etc.) and `SameSite=Strict`.

Use `axios-cookiejar-support` + `tough-cookie` with `validateStatus: () => true` so HTTP
4xx responses are returned as resolved values (not thrown exceptions) and cookie processing
is not interrupted.

---

## TypeScript Implementation Checklist (as implemented)

- [x] GET + `Authorization: Basic` for password auth
- [x] POST + XML body for token auth
- [x] `X-QC-HIDDEN-SECURITY-ID: 12` on all requests
- [x] Tenant as `/?tenant=guid` path-suffix on auth/logout only
- [x] `validateStatus: () => true` — never throw on HTTP errors
- [x] `axios-cookiejar-support` + `tough-cookie` cookie jar
- [x] `fast-xml-parser` for XML ↔ object
- [x] Single-vs-array normalisation for collection responses
- [x] `ReportId` computed from `Content.AutomaticTrending.ReportId`
- [x] Fetch-all testinstances + client-side filter (no server filter)
- [x] Proxy configuration support
- [x] Timeslot retry loop
- [x] Run state polling
- [x] Event log incremental streaming
- [x] adm-zip for report extraction
- [x] SLA status evaluation
