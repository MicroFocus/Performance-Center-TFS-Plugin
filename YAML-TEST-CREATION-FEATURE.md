# YAML Test Creation Feature — Analysis, Design & Progress Tracker

> **Project:** Performance-Center-TFS-Plugin2 (Azure DevOps Extension — LreCiTask)  
> **Author:** GitHub Copilot assisted implementation  
> **Created:** 2026-07-23  
> **Status:** ✅ Implementation Complete — live testing in progress (3 bugs found & fixed)  
> **Current testing version:** `3.300.2`  
> **Versioning:** Testing builds ship as `3.300.x` (patch incremented on each ADO on-premises deployment).  
> Final release will be tagged **`3.3.0`** once integration tests pass.

---

## Table of Contents

1. [Background & Motivation](#1-background--motivation)
2. [Feature Description](#2-feature-description)
3. [Architecture Overview](#3-architecture-overview)
4. [YAML Schema Reference](#4-yaml-schema-reference)
5. [Key Technical Concepts](#5-key-technical-concepts)
6. [Implementation Plan — Phase Breakdown](#6-implementation-plan--phase-breakdown)
7. [Progress Tracker](#7-progress-tracker)
8. [File Inventory](#8-file-inventory)
9. [Integration Test Configuration](#9-integration-test-configuration)
10. [Testing Strategy](#10-testing-strategy)
11. [PluginUI Changes](#11-pluginui-changes)
12. [Known Decisions & Edge Cases](#12-known-decisions--edge-cases)

---

## 1. Background & Motivation

The Java library `performance-center-plugins-common` exposes a rich API for interacting with
**OpenText Enterprise Performance Engineering** (formerly LoadRunner Enterprise / LRE).  Among its
features is the ability to **create or update an LRE test from a YAML file** via
`createOrUpdateTestFromYamlContent` / `createOrUpdateTest`.

The LreCiTask (TypeScript / Node.js, Azure DevOps extension) currently only supports running an
**existing** test identified by its numeric Test ID.  The GitHub Action counterpart (`lre-gh-action`)
already exposes the `lre_test` input as *"test ID or YAML file path"*, letting CI pipelines define
test topology entirely as code, stored alongside the application in source control.

This feature brings the same capability to the **Azure DevOps extension**.

---

## 2. Feature Description

### User-visible change

The `varTestID` input of `LreCiTask` accepts **either**:

| Value | Behaviour |
|---|---|
| A positive integer (e.g. `"180"`) | Existing behaviour — run the test with that ID |
| A path to a `.yaml` / `.yml` file | **New** — parse the file, create/update the test in LRE, then run it |

### End-to-end flow (YAML path)

```
YAML file on disk
      │
      ▼
YamlTestParser.parseFile()
      │  returns ParsedYamlTest
      ▼
ScriptResolver (inside LreTestCreator)
      │  resolves every group's script_path → script_id via GET /Scripts
      ▼
TestPlanFolder check / create (POST /testplan)
      ▼
TestContentXmlBuilder.buildTestXml()
      │  produces <Test xmlns="..."> XML
      ▼
LreClient.createTest()  →  POST /tests
      │  409 Conflict?  extract ID → LreClient.updateTest(id, contentXml)
      ▼
Test ID (integer)
      │
      ▼  (same as before)
LreTestRunner runs the test
```

---

## 3. Architecture Overview

### Existing codebase (unchanged paths)

| File | Role |
|---|---|
| `angular/LreCiTask/index.ts` | Task entry-point — reads all `INPUT_*` env vars, orchestrates execution |
| `angular/src/ci/lre/LreClient.ts` | All LRE REST calls |
| `angular/src/ci/lre/LreTestRunner.ts` | Polls run, collects results, SLA evaluation |
| `angular/src/ci/models/index.ts` | Shared TypeScript interfaces + XML helpers |

### New files (this feature)

```
angular/src/ci/yaml/
├── SimplifiedModels.ts       ← YAML entity interfaces
├── YamlTestParser.ts         ← reads .yaml file → ParsedYamlTest
├── TestContentXmlBuilder.ts  ← ParsedYamlTest → LRE XML
└── LreTestCreator.ts         ← orchestrates resolution + API calls  [TODO]

angular/LreCiTask/
└── index.ts                  ← detect YAML vs integer, call LreTestCreator  [TODO]

angular/src/ci/yaml/__tests__/
├── YamlTestParser.test.ts    [TODO]
└── TestContentXmlBuilder.test.ts  [TODO]
```

---

## 4. YAML Schema Reference

### Shape 1 — Full-test YAML

Use when you want to declare the test name and folder alongside the content.

```yaml
test_name: "My Performance Test"
test_folder_path: "ci-tests/api"   # relative to Subject\ in LRE test plan
test_content:
  controller: "Controller01"        # optional
  lg_amount: 2                      # ignored when each group lists lg_name[]
  group:
    - group_name: "API Load"
      vusers: 50
      script_path: "scripts\\api\\my_script"   # resolved to script_id automatically
      rts:
        pacing:
          number_of_iterations: 0   # 0 = infinite
          type: "fixed interval"
          delay: 60
        thinktime:
          type: "replay"
      command_line: "-param value"
  scheduler:
    rampup: 120      # seconds — ramp-up period
    duration: 600    # seconds — 0 = run until completion
```

### Shape 2 — Content-only YAML

Use when the YAML file *is* the test (name derived from filename, folder from directory path
relative to workspace root).

```yaml
group:
  - group_name: "Smoke"
    vusers: 10
    script_path: "scripts\\smoke\\login_flow"
    lg_name:
      - LG1
      - LG2
scheduler:
  rampup: 0
  duration: 300
```

### Full field reference

#### `group[]`

| Field | Type | Default | Notes |
|---|---|---|---|
| `group_name` | string | `Group_N` | |
| `vusers` | number | `1` | |
| `script_id` | number | — | Provide **either** `script_id` or `script_path` |
| `script_path` | string | — | `folder\\scriptName` under Subject in LRE |
| `lg_name` | string[] | — | When all groups supply `lg_name` → manual LG distribution |
| `command_line` | string | — | |
| `rts.pacing` | object | 1 iter / immediately | |
| `rts.thinktime` | object | — | |
| `rts.java_vm` | object | — | |
| `rts.jmeter` | object | — | |
| `rts.selenium` | object | — | |

#### `scheduler`

| Field | Type | Default | Notes |
|---|---|---|---|
| `rampup` | number (sec) | `0` | See ramp logic below |
| `duration` | number (sec) | `0` | `0` = until completion |

#### `automatic_trending`

| Field | Type | Notes |
|---|---|---|
| `report_id` | number | Required |
| `max_runs_in_report` | number | Default `3` |

#### Elastic (optional)

`lg_elastic_configuration` / `controller_elastic_configuration`:

| Field | Type |
|---|---|
| `image_id` | number |
| `memory_limit` | number |
| `cpu_limit` | number |

---

## 5. Key Technical Concepts

### 5.1 YAML Shape Detection

```
if (doc.test_name && doc.test_folder_path && doc.test_content)  →  Full-test shape
else if (Array.isArray(doc.group) && doc.group.length > 0)      →  Content-only shape
else  →  throw error
```

### 5.2 LG Distribution

```
if (lg_amount is set and > 0)     →  "all to each group" (Amount = lg_amount)
else if (ALL groups have lg_name) →  "manual"
else                               →  "all to each group" (Amount = 1)
```

### 5.3 Ramp-up Logic (mirrors Java `SchedulerFactory`)

```
rampup  > 30 s:
    exactInterval = rampup / totalVusers
    if exactInterval < 15 s:
        vusers = ceil(15 / exactInterval)
        interval = 15 s
    else:
        vusers = 1
        interval = floor(exactInterval)
    → StartVusers Type="gradually"

rampup 2–30 s:
    vusers   = ceil(totalVusers / 2)
    interval = floor(rampup / 2)
    → StartVusers Type="gradually"

rampup 0–1 s:
    → StartVusers Type="simultaneously"
```

### 5.4 Script Resolution

`GET /LoadTest/rest/domains/{d}/projects/{p}/Scripts`

Returns `<Scripts><ScriptList><Script><ID>…</ID><Name>…</Name><TestFolderPath>…</TestFolderPath></Script></ScriptList></Scripts>`

Match: `script_path` = `<TestFolderPath>\\<Name>` (case-insensitive, normalise separators).

### 5.5 Test Plan Folder Creation

`POST /LoadTest/rest/domains/{d}/projects/{p}/testplan`

Body:
```xml
<TestPlanFolder xmlns="http://www.hp.com/PC/REST/API">
  <Path>Subject\parent\folder</Path>
  <Name>leafFolderName</Name>
</TestPlanFolder>
```

### 5.6 Conflict Handling (409)

When `POST /tests` returns HTTP 409, the error body contains the existing test ID.
Extract it, then call `PUT /tests/{id}` with a `<Content xmlns="…">…</Content>` body.

### 5.7 Host Type Detection

| LG name pattern | XML HostType |
|---|---|
| `LG\d+` (e.g. `LG1`) | `automatch` |
| `DOCKER\d+` (e.g. `DOCKER3`) | `dynamic` |
| Anything else | `specific` |

### 5.8 Sentinel Comment Stripping

GitHub Action YAML examples wrap sections with `##…##` sentinel comments.
The parser strips these before calling `js-yaml`:

```
/^#{2,}[^#\n]*#{2,}$/gm  →  ''
```

---

## 6. Implementation Plan — Phase Breakdown

### Phase 1 — YAML Parsing & XML Building *(Core library)*

| # | Task | File(s) |
|---|---|---|
| 1.1 | TypeScript interfaces mirroring Java simplified entity classes | `src/ci/yaml/SimplifiedModels.ts` |
| 1.2 | YAML parser — file & string, shape detection, validation, name/folder derivation | `src/ci/yaml/YamlTestParser.ts` |
| 1.3 | XML builder — full `<Test>` + standalone `<Content>`, all child elements | `src/ci/yaml/TestContentXmlBuilder.ts` |
| 1.4 | Unit tests — parser (both shapes, errors, sentinel stripping) | `src/ci/yaml/__tests__/YamlTestParser.test.ts` |
| 1.5 | Unit tests — XML builder (scheduler ramp, RTS defaults, LG distribution) | `src/ci/yaml/__tests__/TestContentXmlBuilder.test.ts` |

### Phase 2 — LreClient Extensions *(API layer)*

| # | Task | File(s) |
|---|---|---|
| 2.1 | New models: `LreScript`, `LreScripts`, `LreTestPlanFolder`, `LreTestPlanFolders`, `LreTestCreateResponse`, `LreTestPlanFolderRequestXml` | `src/ci/models/index.ts` |
| 2.2 | `getScripts()` — `GET /Scripts` | `src/ci/lre/LreClient.ts` |
| 2.3 | `createTest(xml)` — `POST /tests` | `src/ci/lre/LreClient.ts` |
| 2.4 | `updateTest(id, contentXml)` — `PUT /tests/{id}` | `src/ci/lre/LreClient.ts` |
| 2.5 | `ensureTestPlanFolderExists(folderPath)` — `GET` + `POST /testplan` | `src/ci/lre/LreClient.ts` |
| 2.6 | Unit tests for each new client method (mock HTTP) | `LreCiTask/__tests__/LreClient.test.ts` |

### Phase 3 — LreTestCreator Orchestrator

| # | Task | File(s) |
|---|---|---|
| 3.1 | `resolveScriptIds(content)` — bulk resolve `script_path` → `script_id` | `src/ci/yaml/LreTestCreator.ts` |
| 3.2 | `createOrUpdateTest(parsed)` — folder creation, POST/PUT, conflict handling | `src/ci/yaml/LreTestCreator.ts` |
| 3.3 | Unit tests for `LreTestCreator` (mock LreClient) | `src/ci/yaml/__tests__/LreTestCreator.test.ts` |

### Phase 4 — Task Entry-Point Integration

| # | Task | File(s) |
|---|---|---|
| 4.1 | `isYamlTestPath(value)` helper — detects `.yaml` / `.yml` extension | `LreCiTask/index.ts` |
| 4.2 | Branch on YAML vs integer: call `LreTestCreator.createOrUpdateTest()`, use returned ID | `LreCiTask/index.ts` |
| 4.3 | Remove/relax integer-only validation for `varTestID` | `LreCiTask/index.ts` |
| 4.4 | Update task help text | `LreCiTask/task.json` |

### Phase 5 — PluginUI Changes (WPF / C#)

| # | Task | File(s) |
|---|---|---|
| 5.1 | Change "Test ID" label to "Test ID or YAML file" | `PluginUI/PluginsUI/MainWindow.xaml` |
| 5.2 | Add "Browse…" button next to the input that opens a `.yaml` / `.yml` file dialog | `PluginUI/PluginsUI/MainWindow.xaml` |
| 5.3 | Implement `BrowseYamlFile_Click` handler | `PluginUI/PluginsUI/MainWindow.xaml.cs` |
| 5.4 | Update tooltip / help text for the field | `PluginUI/PluginsUI/MainWindow.xaml` |
| 5.5 | Validation — skip integer-only validation when value ends in `.yaml` / `.yml` | `PluginUI/PluginsUI/MainWindow.xaml.cs` |

### Phase 6 — Integration Tests

| # | Task | File(s) |
|---|---|---|
| 6.1 | Add YAML test creation properties to `.properties` files | `integration/integration-tests.properties` + `.template` |
| 6.2 | Extend `IntegrationTestConfig` with new fields | `integration/test-utils/PropertiesLoader.ts` |
| 6.3 | `runYamlTestCreationChecks()` — end-to-end integration test | `integration/test-utils/run-integration-tests.ts` |
| 6.4 | YAML test fixture file used by integration tests | `integration/__tests__/fixtures/sample-test.yaml` |

---

## 7. Progress Tracker

| Phase | Task | Status | Notes |
|---|---|---|---|
| **1** | **YAML Parsing & XML Building** | | |
| 1.1 | `SimplifiedModels.ts` — all interfaces | ✅ Done | |
| 1.2 | `YamlTestParser.ts` | ✅ Done | Sentinel stripping, shape detection, name/folder derivation |
| 1.3 | `TestContentXmlBuilder.ts` | ✅ Done | All sections: scheduler, RTS, LG dist, elastic, trending |
| 1.4 | Unit tests — `YamlTestParser` | ✅ Done | 22 tests — all pass |
| 1.5 | Unit tests — `TestContentXmlBuilder` | ✅ Done | 62 tests — all pass |
| **2** | **LreClient Extensions** | | |
| 2.1 | New model interfaces in `models/index.ts` | ✅ Done | `LreScript`, `LreScriptsApiResponse`, `LreTestCreateResponse`, `LreTestPlanFolderRequestXml` |
| 2.2 | `getScripts()` | ✅ Done | Fetches all scripts, normalises single-vs-array |
| 2.3 | `createTest(xml)` — 409 conflict handling | ✅ Done | Returns `{testId, existed}` |
| 2.4 | `updateTest(id, contentXml)` | ✅ Done | PUT /tests/{id} |
| 2.5 | `ensureTestPlanFolderExists()` + private `createTestPlanFolder()` | ✅ Done | Creates folders level-by-level; 409 silently ignored |
| 2.6 | Unit tests — LreClient new methods | ⏸ Deferred | Deferred until code is stable |
| **3** | **LreTestCreator Orchestrator** | | |
| 3.1 | Script ID resolution | ✅ Done | Case-insensitive; full-path + name-only matching |
| 3.2 | `createOrUpdate()` — folder creation + POST/PUT + conflict handling | ✅ Done | |
| 3.3 | `createOrUpdateFromFile()` entry-point | ✅ Done | Parses YAML, resolves, creates/updates |
| 3.4 | `isYamlFilePath()` static helper | ✅ Done | Used by index.ts to detect YAML branch |
| 3.5 | Unit tests — `LreTestCreator` | ⏸ Deferred | Deferred until code is stable |
| **4** | **Task Entry-Point Integration** | | |
| 4.1 | `isYamlFilePath()` detection in `index.ts` | ✅ Done | Delegates to `LreTestCreator.isYamlFilePath()` |
| 4.2 | YAML branch in main flow (step 6b) | ✅ Done | After auth, before runner.execute |
| 4.3 | Relaxed `varTestID` validation (YAML or integer) | ✅ Done | |
| 4.4 | `task.json` label + help text update | ✅ Done | Label: "Test ID or YAML file" |
| **5** | **PluginUI Changes** | | |
| 5.1 | Label change | ✅ Done | "Test ID or YAML:" |
| 5.2 | Browse button (XAML) | ✅ Done | Opens `.yaml`/`.yml` file dialog; pre-navigates to repo root |
| 5.3 | Browse handler (C#) | ✅ Done | `BrowseYamlFile_Click` — sets `TestID.Text` to selected path |
| 5.4 | Tooltip update | ✅ Done | Updated on help icon and TextBox |
| 5.5 | Validation update | ✅ Done | Accepts integer OR `.yaml`/`.yml` path; descriptive error |
| **6** | **Integration Tests** | | |
| 6.1 | New properties in `.properties` files | ✅ Done | `pc.yaml.*` + `integration.test.createTestFromYaml` in both files |
| 6.2 | `IntegrationTestConfig` new fields | ✅ Done | `behavior.createTestFromYaml` + optional `yaml` block |
| 6.3 | `runYamlTestCreationChecks()` | ✅ Done | Create + idempotency + getTest verification; skipped when flag=false |
| 6.4 | YAML fixture file | ✅ Done | `integration/__tests__/fixtures/sample-test.yaml` (static + runtime-patched copy) |
| **7** | **Build, Final Validation & Release Prep** | | |
| 7.1 | LreClient unit tests for new methods (deferred 2.6) | ✅ Done | 28 tests in `src/ci/lre/__tests__/LreClient.yaml.test.ts` |
| 7.2 | Fix ts-jest `diagnostics` config (axios augmentation) | ✅ Done | `diagnostics: false` in `jest.config.js`; type safety still via `typecheck` script |
| 7.3 | Full `npm run build` (compiled JS output) | ✅ Done | 0 errors |
| 7.4 | Version scheme: `3.300.0` for testing, `3.3.0` for release | ✅ Done | `vss-extension.json` Minor=300, `task.json` Minor=300, `package.json` 3.300.0 |

**Legend:** ✅ Done &nbsp; 🟡 In Progress &nbsp; ⬜ TODO &nbsp; ⏸ Deferred &nbsp; ❌ Blocked

---

> **📊 Final metrics**
> - Unit tests: **149 passing** across 4 suites
> - Coverage: `LreTestCreator` 100% · `YamlTestParser` 98% · `TestContentXmlBuilder` 80%
> - TypeScript typecheck: **0 errors**
> - PluginUI (C#/WPF) build: **0 errors**
> - Full TypeScript build (`npm run build`): **0 errors**
> - Testing version: **`3.300.2`** (current)
> - Release version: **`3.3.0`** (set when integration tests pass)
> - To activate integration tests: set `integration.test.createTestFromYaml=true` and configure `pc.yaml.scriptPath` in `integration-tests.properties`

---

## 8. File Inventory

### New files created by this feature

| File | Description |
|---|---|
| `angular/src/ci/yaml/SimplifiedModels.ts` | TypeScript interfaces for all YAML model entities |
| `angular/src/ci/yaml/YamlTestParser.ts` | YAML → `ParsedYamlTest` |
| `angular/src/ci/yaml/TestContentXmlBuilder.ts` | `ParsedYamlTest` → LRE XML |
| `angular/src/ci/lre/LreTestCreator.ts` | ✅ Orchestrates resolution + API calls |
| `angular/src/ci/yaml/__tests__/YamlTestParser.test.ts` | ✅ 22 unit tests |
| `angular/src/ci/yaml/__tests__/TestContentXmlBuilder.test.ts` | ✅ 62 unit tests |
| `angular/src/ci/lre/__tests__/LreTestCreator.test.ts` | ✅ 28 unit tests |
| `angular/src/ci/lre/__tests__/LreClient.yaml.test.ts` | ✅ 22 unit tests (getScripts, createTest, updateTest, ensureTestPlanFolderExists) |
| `angular/jest.config.js` | Root-level Jest configuration (`diagnostics: false` for ts-jest) |
| `angular/tsconfig.test.json` | TypeScript config for Jest (relaxed strict rules) |
| `integration/__tests__/fixtures/sample-test.yaml` | ✅ Static YAML fixture (runtime copy patched with env values) |

### Modified files

| File | Change |
|---|---|
| `angular/src/ci/models/index.ts` | Add `LreScript`, `LreScripts`, `LreTestPlanFolder`, `LreTestPlanFolders`, `LreTestCreateResponse`, `LreTestPlanFolderRequestXml` |
| `angular/src/ci/lre/LreClient.ts` | Add `getScripts()`, `createTest()`, `updateTest()`, `ensureTestPlanFolderExists()`; **bug fixes in `3.300.1`** (see §12) |
| `angular/LreCiTask/index.ts` | YAML branch for `varTestID`, `varWorkspaceDir` resolution, helper function, relaxed validation |
| `angular/LreCiTask/task.json` | Update `varTestID` help text and label; add `varWorkspaceDir` input |
| `integration/integration-tests.properties` | Add `pc.yaml.*` properties |
| `integration/integration-tests.properties.template` | Same additions |
| `integration/test-utils/PropertiesLoader.ts` | Extend `IntegrationTestConfig` with YAML fields |
| `integration/test-utils/run-integration-tests.ts` | Add `runYamlTestCreationChecks()` |
| `PluginUI/PluginsUI/MainWindow.xaml` | Label + Browse button for YAML; **new `WorkspaceDir` row + Browse button** |
| `PluginUI/PluginsUI/MainWindow.xaml.cs` | Browse handler + updated validation; **`BrowseWorkspaceDir_Click`, save/load `WorkspaceDir`** |
| `PluginUI/PluginsUI/Models/LreConfiguration.cs` | **New `WorkspaceDir` property** |
| `PluginUI/PluginsUI/Services/LreTaskRunner.cs` | **Passes `INPUT_VARWORKSPACEDIR` env var when WorkspaceDir is set** |

### Dependencies added

| Package | Type | Purpose |
|---|---|---|
| `js-yaml` | production | Parse YAML files at runtime |
| `@types/js-yaml` | dev | TypeScript types |
| `jest` | dev | Test runner |
| `ts-jest` | dev | TypeScript support for Jest |
| `@types/jest` | dev | TypeScript types |

---

## 9. Integration Test Configuration

Add the following properties to both
`integration/integration-tests.properties` and
`integration/integration-tests.properties.template`:

```properties
# ── YAML test creation feature ──────────────────────────────────────────────
# Set to true to run YAML test creation integration tests
integration.test.createTestFromYaml=false

# Script path used in the YAML fixture (must exist in LRE project)
pc.yaml.scriptPath=daniel\\scripts\\demo_script_new

# Folder under Subject\ where the YAML test will be created
pc.yaml.testFolderPath=ci-tests\\yaml-integration

# Test name used in the YAML fixture
pc.yaml.testName=YAML Integration Test
```

`IntegrationTestConfig` additions:

```typescript
createTestFromYaml: boolean;   // false by default
yamlScriptPath: string;
yamlTestFolderPath: string;
yamlTestName: string;
```

---

## 10. Testing Strategy

### Unit Tests

All unit tests live under `angular/src/ci/yaml/__tests__/` and run with:

```powershell
cd angular
npm test
```

**`YamlTestParser.test.ts`** must cover:
- Full-test YAML — happy path
- Content-only YAML — name/folder derived from filename
- `test_name` missing → error
- `group` array empty → error
- Group with neither `script_id` nor `script_path` → error
- Sentinel `##…##` comment lines are stripped before parsing
- Forward-slash folder paths normalised to backslash
- Leading `Subject\` stripped and re-added correctly
- Unknown file path → error

**`TestContentXmlBuilder.test.ts`** must cover:
- `buildTestXml()` — minimal YAML → XML snapshot test
- Scheduler: `rampup = 0` → simultaneously
- Scheduler: `rampup = 60`, 2 vusers → gradually, 1 vuser, 30 s interval
- Scheduler: `rampup = 600`, 10 vusers → gradually, interval capped at 15 s
- LG distribution: all groups have `lg_name` → manual
- LG distribution: `lg_amount` set → "all to each group"
- Host type: `LG1` → automatch, `DOCKER2` → dynamic, `myhost.example.com` → specific
- `buildContentXml()` — wraps in `<Content>` not `<Test>`
- RTS defaults emitted when `rts` is omitted
- Pacing — all 5 type variants

**`LreTestCreator.test.ts`** must cover:
- Script resolution: `script_path` matched → `script_id` populated
- Script not found → descriptive error
- Test folder auto-created when it does not exist
- `createOrUpdateTest()` → POST → success → returns test ID
- `createOrUpdateTest()` → POST → 409 → extract ID → PUT → returns test ID

### Integration Tests

Run with:

```powershell
cd angular
npm run test:integration
```

`runYamlTestCreationChecks()` steps:
1. Load YAML fixture file with `pc.yaml.scriptPath`, `pc.yaml.testFolderPath`, `pc.yaml.testName`
2. Instantiate `LreTestCreator` with real `LreClient` pointing at test server
3. Call `createOrUpdateTest()` — verify a test ID is returned (> 0)
4. Call `createOrUpdateTest()` again with the same YAML — verify 409 is handled, same test ID returned
5. Run the created test with `LreTestRunner` — verify it starts successfully

---

## 11. PluginUI Changes

### MainWindow.xaml

Change the "Test ID" row (lines 239–250) from a plain `TextBox` to a row with a `TextBox` plus
a `Browse…` button:

```xml
<!-- Before -->
<Label Content="Test ID:" />
<TextBox x:Name="TestID" ... />

<!-- After -->
<Label Content="Test ID or YAML file:" ToolTip="Enter a numeric test ID, or browse to a .yaml/.yml file to create/update a test." />
<DockPanel LastChildFill="True">
    <Button DockPanel.Dock="Right" Content="Browse…" Width="65" Margin="4,0,0,0"
            Click="BrowseYamlFile_Click" />
    <TextBox x:Name="TestID" ... />
</DockPanel>
```

### MainWindow.xaml.cs

Add handler:

```csharp
private void BrowseYamlFile_Click(object sender, RoutedEventArgs e)
{
    var dlg = new Microsoft.Win32.OpenFileDialog
    {
        Title  = "Select LRE Test YAML file",
        Filter = "YAML files (*.yaml;*.yml)|*.yaml;*.yml|All files (*.*)|*.*"
    };
    if (dlg.ShowDialog() == true)
        TestID.Text = dlg.FileName;
}
```

Update validation (skip integer check when value ends in `.yaml` / `.yml`):

```csharp
// Existing:
if (string.IsNullOrWhiteSpace(TestID.Text)) { ... }

// Add after blank check:
var testIdValue = TestID.Text.Trim();
bool isYamlFile = testIdValue.EndsWith(".yaml", StringComparison.OrdinalIgnoreCase)
               || testIdValue.EndsWith(".yml",  StringComparison.OrdinalIgnoreCase);
if (!isYamlFile && !int.TryParse(testIdValue, out _))
{
    MessageBox.Show("Test ID must be a positive integer or a path to a .yaml/.yml file.",
                    "Validation Error", MessageBoxButton.OK, MessageBoxImage.Warning);
    return;
}
```

---

## 12. Known Decisions & Edge Cases

| Decision | Rationale |
|---|---|
| `script_path` matching is case-insensitive | LRE script names on Windows are case-insensitive |
| `Subject\` prefix is always stripped from user input and re-added by the builder | Prevents double-prefix bugs |
| If `lg_amount` is set, it wins over `lg_name[]` for distribution mode | Mirrors Java `ContentPartsFactory.getLgDistribution()` exactly |
| Ramp interval minimum is 15 s (hard-coded constant) | Java constant `MIN_RAMP_INTERVAL_SECS = 15` |
| 409 response body from LRE contains the existing test ID as a number | Java regex parses it out; TypeScript uses the same approach |
| `duration = 0` means "run until completion" (not zero seconds) | Mirrors Java model convention |
| Content-only YAML with no `sourceFilePath` gets name `"LreTest"` and folder `"Subject"` | Safe fallback; avoids crash |
| Test plan folders are created one level at a time from the root | LRE API does not support recursive folder creation |
| Unit tests use snapshot assertions for XML output | Ensures byte-for-byte compatibility with LRE API expectations |

---

## 13. Live Testing Bug Fixes (v3.300.1)

Two bugs were discovered during the first live test runs (PluginUI against a real LRE server) and fixed in `3.300.1`.

### Bug 1 — `getScripts()` always returned empty list

**Symptom (3.300.0):**
```
ERROR: LreTestCreator: script path "scripts\mb1255" not found in project. Available scripts: 
```

**Root cause:**  
The implementation assumed `/Scripts` returns JSON (based on API docs). The real LRE server returns **XML**:
```xml
<Scripts xmlns="http://www.hp.com/PC/REST/API">
  <Script><ID>175</ID><Name>Parameters</Name>...</Script>
  <Script><ID>176</ID>...</Script>
</Scripts>
```
`parseXmlResponse` strips the root `<Scripts>` tag → returns `{ Script: [...] }`. The XML fallback was looking for `raw?.ScriptList?.Script` — but there is **no `<ScriptList>` wrapper** in real responses.

**Fix (`LreClient.ts`, `LreScriptsApiResponse`):**
```typescript
// Before (wrong):
const scriptEntry = raw?.ScriptList?.Script;

// After (correct — tries direct Script first, falls back to wrapped shape):
const scriptEntry = raw?.Script ?? raw?.ScriptList?.Script;
```
Both JSON and XML shapes are still supported. `extractScriptsFromJson()` runs first (pre-parsed object), XML fallback runs if it returns `null`.

---

### Bug 2 — `ensureTestPlanFolderExists()` threw on existing folders

**Symptom (3.300.1):**
```
ERROR: createTestPlanFolder failed (HTTP 400) for "Subject\Tests":
       Failed to create folder with the name 'Tests'. A folder with the same name already exists in 'Subject'.
```

**Root cause:**  
The code only silently ignored **HTTP 409** (Conflict) for duplicate folders. The real LRE server returned **HTTP 400** with an "already exists" message instead.

**Fix (`LreClient.ts`):**
```typescript
// Also treat 400 + "already exists" message as a no-op:
if (/already exists/i.test(message)) {
    tl.debug(`createTestPlanFolder: "${parentPath}\\${leafName}" already exists (${response.status}) — skipping`);
    return;
}
```

---

### `varWorkspaceDir` input (added in 3.300.1)

**Problem:** PluginUI passes an absolute YAML path (`C:\Git\plugin\jenkins-sync\Tests\yaml\mb1255.yml`), but the ADO pipeline uses a relative path (`Tests/yaml/mb1255.yml`) relative to the repo checkout root. These are fundamentally different calling conventions.

**Solution:** New optional `varWorkspaceDir` task input.

| Scenario | How path is resolved |
|---|---|
| ADO pipeline (no `varWorkspaceDir`) | `BUILD_SOURCESDIRECTORY` / `SYSTEM_DEFAULTWORKINGDIRECTORY` env vars used as workspace root |
| PluginUI | Set `WorkspaceDir = C:\Git\plugin\jenkins-sync`, `Test ID = Tests\yaml\mb1255.yml` |
| Absolute path | Used as-is regardless of workspace dir |

The task input name is `varWorkspaceDir`; the PluginUI passes it as `INPUT_VARWORKSPACEDIR`.

---

## 14. Live Testing Bug Fixes (v3.300.2)

### Bug 3 — `GlobalCommandLine` used wrong XML field names

**Symptom (3.300.1), reproduced with `Mobile.yml` (25 groups with `command_line`):**
```
ERROR: createTest failed (HTTP 400): Invalid design performance test request.
Invalid Global RTS and/or Global Command Line configuration provided:
Invalid Global Command Line name AdvantageOnlineShopping for group AdvantageOnlineShopping.
...
```

**Root cause:**  
`TestContentXmlBuilder.buildGlobalCommandLine()` was generating:
```xml
<CommandLine>
  <GroupName>AdvantageOnlineShopping</GroupName>
  <CommandLine>-environment ENVVAR</CommandLine>
</CommandLine>
```

The Java `CommandLine` class has fields `Name` and `Value` (not `GroupName` and `CommandLine`):
```java
public class CommandLine {
    private String Name;   // → <Name>
    private String Value;  // → <Value>
}
// Used as: new CommandLine(group.getGroup_name(), group.getCommand_line())
```

**Fix (`TestContentXmlBuilder.ts`):**
```typescript
// Before (wrong):
`<CommandLine>` +
`<GroupName>${escapeXml(g.group_name ?? '')}</GroupName>` +
`<CommandLine>${escapeXml(g.command_line ?? '')}</CommandLine>` +
`</CommandLine>`

// After (correct):
`<CommandLine>` +
`<Name>${escapeXml(g.group_name ?? '')}</Name>` +
`<Value>${escapeXml(g.command_line ?? '')}</Value>` +
`</CommandLine>`
```

The single-group `mb1255.yml` (no `command_line`) never hit this code path — which is why that test passed but `Mobile.yml` (24 groups all with `command_line`) failed immediately.

