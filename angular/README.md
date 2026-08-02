# Integration with OpenText Enterprise Performance Engineering

This extension enables you to include **OpenText Enterprise Performance Engineering** operations as tasks in a Microsoft Azure DevOps Server CI/CD pipeline. Configure your performance tests and script repositories once and automate them on every build — no manual intervention required.

The extension ships **two tasks**:

| Task | What it does |
|---|---|
| **Enterprise Performance Engineering Test** | Run a performance test from a pipeline and collect results |
| **Enterprise Performance Engineering Workspace Sync** | Scan a repository for script folders, zip them, and upload them to an Enterprise Performance Engineering project |

---

## Key Features

### Enterprise Performance Engineering Test task

- Run an OpenText Enterprise Performance Engineering test directly from an Azure DevOps pipeline
- **`varTestID` accepts a numeric Test ID *or* a path to a `.yaml`/`.yml` test-definition file** — when a YAML file is supplied the task creates or updates the LRE test automatically before running it
- Authenticate with **username/password** or **API token** (required for SSO-configured servers)
- **Auto-provision test infrastructure** — if no test set or test instance exists in the project, the task automatically creates a test set folder, a test set, and a test instance so the pipeline never blocks on missing setup
- **YAML-based test creation** — define the full test topology (groups, scripts, scheduler, RTS, elastic configuration) in a YAML file committed to your repository. Script paths are resolved to IDs automatically, and test-plan folders are created on demand
- Configure post-run actions: *Collate Results*, *Collate and Analyze*, or *Do Not Collate*
- Optional **SLA-based build status** — fail the build step when a configured Service Level Agreement is breached
- Trend report integration — attach results to an existing trend report or the test's auto-trend report
- Timeslot retry support — automatically retry failed timeslot reservations with configurable delay and attempt count
- Proxy support with optional credentials
- Timestamped log output (millisecond precision) in the build log and a local artifact log file
- Artifacts saved to the configured artifacts staging directory (ZIP result files, trend PDF)

### Enterprise Performance Engineering Workspace Sync task

- **Automatically keep an Enterprise Performance Engineering project in sync with a Git repository** — no manual script uploads needed
- Recursively scans the workspace for Enterprise Performance Engineering performance test script folders:
  - LoadRunner scripts: any folder containing a `.usr` file
  - JMeter scripts: any folder containing a `.jmx` file
  - Gatling scripts: any folder containing a `.scala` or `.java` file
  - DevWeb scripts: any folder containing both `main.js` and `rts.yml`
- Compresses each detected script folder into a ZIP archive and uploads it to the corresponding Enterprise Performance Engineering test plan path
- Ensures all required Enterprise Performance Engineering test plan sub-folders exist before starting uploads
- **Differential sync** — pass a git commit SHA via `varBaseCommitSha` and the task uploads **only script folders that contain changed files since that commit**. Falls back to full sync automatically if git diff is unavailable
- **Configurable success threshold** — decide how many upload failures are acceptable before failing the pipeline (see below)
- **Sequential uploads by default** (`varParallelUploads = 1`) — safe with all Enterprise Performance Engineering server releases. Parallel uploads can be enabled for servers that support concurrent ingest
- Proxy support with optional credentials
- Upload log saved to the artifacts directory


---

## Supported Product Versions

This extension supports the **3 latest versions** of OpenText Enterprise Performance Engineering.

---

## What's New in Version 3.4.0

> **August 2026**

### 🔧 Token authentication fixed for Enterprise Performance Engineering Workspace Sync

Token authentication (`varUseTokenForAuthentication = true`) previously failed for **LreWorkspaceSyncTask** with server error `ErrorCode 1101 "Authentication information is missing from request header"`. The root causes were:

| Root cause | Fix |
|---|---|
| Missing `X-QC-HIDDEN-SECURITY-ID: 12` header on all HTTP requests | Added to shared `createLreAxiosInstance()` factory — all tasks automatically include it |
| Token auth XML used `xmlns="http://www.hp.com/PC/REST/API"` namespace (rejected by server) | Fixed to use `<?xml version="1.0" encoding="utf-8"?>` declaration with no namespace |

### 🔧 Auth retry loop no longer hammers the server on bad credentials

When token or password authentication returned HTTP 4xx (invalid credentials), **LreWorkspaceSyncTask** previously entered a 5-attempt exponential-backoff retry loop (5 + 10 + 20 + 40 s = 75 s), risking account lockouts. The retry logic now:

- **Exits immediately** on a clean 4xx response — no retry
- **Retries** only on thrown exceptions (5xx / network errors) with exponential back-off

---

## What's New in Version 3.3.0

> **July 2026**

### 🆕 YAML-based test creation (`varTestID` accepts `.yaml` / `.yml`)

The `varTestID` input of the **Enterprise Performance Engineering Test** task now accepts either a numeric test ID (existing behaviour) or a path to a YAML file that describes the test topology.

```yaml
# perf-tests/api-load.yaml
test_name: "API Load Test"
test_folder_path: "ci-tests/api"
test_content:
  lg_amount: 1
  group:
    - group_name: "API Group"
      vusers: 50
      script_path: "scripts\\api\\my_script"
  scheduler:
    rampup: 120
    duration: 600
```

When a YAML path is provided the task:
1. Parses the file (full-test or content-only format)
2. Resolves `script_path` entries to numeric script IDs via `GET /Scripts`
3. Creates any missing test-plan folders via `POST /testplan`
4. `POST /tests` to create the test, or `PUT /tests/{id}` if a test with that name already exists (idempotent)
5. Runs the test as usual and downloads result artifacts

See [`YAML-TEST-CREATION-FEATURE.md`](../YAML-TEST-CREATION-FEATURE.md) for the complete schema reference and implementation notes.

### 🔧 Bug fixes in 3.3.0

| Fix |
|---|
| `getScripts()` always returned empty list — LRE returns XML not JSON; no `<ScriptList>` wrapper in real responses |
| `ensureTestPlanFolderExists()` threw on HTTP 400 "already exists" — now treated as a no-op (same as 409) |
| New `varWorkspaceDir` task input — allows PluginUI to pass an absolute workspace root while using a relative YAML path |
| `GlobalCommandLine` XML used wrong field names (`<GroupName>`/`<CommandLine>`) — corrected to `<Name>`/`<Value>` per the LRE API spec |

### 🔧 PluginUI — "Browse…" button for YAML files

The **Test ID** field in PluginsUI has been renamed to **"Test ID or YAML"** and now includes a **Browse…** button to navigate to a `.yaml` / `.yml` file. The validation accepts either a positive integer or a file path ending in `.yaml`/`.yml`.

---

## YAML Test Definition Reference

When `varTestID` is a path to a `.yaml` or `.yml` file, the task parses the file and creates or updates an LRE test before running it.

Two shapes are supported:

### Shape 1 — Full-test (name + folder + content)

```yaml
##################################################
test_name: "My Performance Test"
test_folder_path: "ci-tests/api"          # relative to Subject\ in LRE test plan
test_content:
  controller: "Controller01"              # optional — pin to a specific controller host
  lg_amount: 2                            # number of LGs; ignored when every group lists lg_name[]
  group:
    - group_name: "API Load"
      vusers: 50
      script_path: "scripts\\api\\my_script"   # resolved to script ID automatically
      lg_name:                            # when ALL groups have lg_name → manual LG distribution
        - LG1
        - LG2
      command_line: "-param value"        # optional — runtime CLI args passed to the script
      rts:
        pacing:
          number_of_iterations: 0         # 0 = infinite
          type: "random interval"         # see pacing types below
          delay: 60                       # seconds
          delay_random_range: 10          # upper-bound offset for "random" types
        thinktime:
          type: "random"                  # ignore | replay | modify | random
          min_percentage: 50
          max_percentage: 150
          limit_seconds: 20
        java_vm:                          # Java protocol scripts only
          jdk_home: "C:\\Java\\jdk-17"
          java_vm_parameters: "-Xms64m -Xmx512m"
          java_env_class_paths:
            - "C:\\mylib\\mylib.jar"
        jmeter:                           # JMeter scripts only
          jmeter_home_path: "C:\\jmeter"
          start_measurements: true
          jmeter_min_port: 10000          # optional custom port range
          jmeter_max_port: 10099
          jmeter_additional_properties: "prop=val"
        selenium:                         # Selenium scripts only
          jre_path: "C:\\Java\\jre"
          class_path: "C:\\selenium\\selenium.jar"
          test_ng_files: "testng.xml"
  scheduler:
    rampup: 120                           # seconds; 0 = start all simultaneously
    duration: 600                         # seconds; 0 = run until completion
  automatic_trending:                     # optional — attach results to a trend report
    report_id: 5
    max_runs_in_report: 10
  lg_elastic_configuration:              # optional — elastic load generators
    image_id: 1
    memory_limit: 2048
    cpu_limit: 2
  controller_elastic_configuration:      # optional — elastic controller
    image_id: 2
    memory_limit: 4096
    cpu_limit: 4
##################################################
```

### Shape 2 — Content-only (name from filename, folder from path)

```yaml
##################################################
group:
  - group_name: "Smoke"
    vusers: 10
    script_path: "scripts\\smoke\\login_flow"
    lg_name:
      - LG1
scheduler:
  rampup: 0
  duration: 300
##################################################
```

> Lines wrapped in `##...##` (sentinel markers used in the GitHub Action format) are stripped automatically.  
> The test name is derived from the YAML **filename** and the test-plan folder from the file's **directory path** relative to the workspace root.

---

### Field reference

#### `group[]`

| Field | Type | Default | Notes |
|---|---|---|---|
| `group_name` | string | `Group_N` | |
| `vusers` | number or string | `1` | |
| `script_id` | number | — | Provide `script_id` **or** `script_path` |
| `script_path` | string | — | `folder\\scriptName` as seen in LRE Scripts; matched case-insensitively |
| `lg_name` | string[] | — | When **all** groups have `lg_name` → manual LG distribution. `LG\d+` → automatch · `DOCKER\d+` → dynamic · anything else → specific |
| `command_line` | string | — | Global command-line override passed to the LRE controller for this group |

#### `rts.pacing`

| Field | Type | Default | Notes |
|---|---|---|---|
| `number_of_iterations` | number | `1` | `0` = infinite |
| `type` | string | `immediately` | `immediately` · `fixed interval` · `fixed delay` · `random interval` · `random delay` |
| `delay` | number (sec) | `0` | Delay for fixed/random types |
| `delay_random_range` | number (sec) | `0` | For random types: range = `[delay, delay + delay_random_range]` |

#### `rts.thinktime`

| Field | Type | Notes |
|---|---|---|
| `type` | string | `ignore` · `replay` · `modify` · `random` |
| `limit_seconds` | number | Max think time cap (replay / random) |
| `min_percentage` | number | For `random` type |
| `max_percentage` | number | For `random` type |
| `multiply_factor` | number | For `modify` type |

#### `rts.java_vm`

| Field | Type | Notes |
|---|---|---|
| `jdk_home` | string | Path to JDK root; when set, `UserSpecifiedJdk = true` |
| `java_vm_parameters` | string | JVM args, e.g. `-Xms64m -Xmx512m` |
| `java_env_class_paths` | string[] | Additional classpath entries |
| `use_xboot` | boolean | Default `false` |
| `enable_classloader_per_vuser` | boolean | Default `false` |

#### `rts.jmeter`

| Field | Type | Notes |
|---|---|---|
| `jmeter_home_path` | string | JMeter installation directory |
| `start_measurements` | boolean | Default `false` |
| `jmeter_min_port` | number | Custom port range start |
| `jmeter_max_port` | number | Custom port range end |
| `jmeter_additional_properties` | string | Extra JMeter properties string |

#### `rts.selenium`

| Field | Type |
|---|---|
| `jre_path` | string |
| `class_path` | string |
| `test_ng_files` | string |

#### `scheduler`

| Field | Type | Default | Ramp-up behaviour |
|---|---|---|---|
| `rampup` | number (sec) | `0` | `0`–`1` → all simultaneously · `2`–`30` → two batches · `>30` → one-vuser-at-a-time (min interval 15 s) |
| `duration` | number (sec) | `0` | `0` = run until completion |

#### `automatic_trending`

| Field | Type | Notes |
|---|---|---|
| `report_id` | number | Required |
| `max_runs_in_report` | number | Default `10` |

#### `lg_elastic_configuration` / `controller_elastic_configuration`

| Field | Type |
|---|---|
| `image_id` | number |
| `memory_limit` | number (MB) |
| `cpu_limit` | number |

---

## What's New in Version 3.2.0

> **July 2026**

### 🆕 Differential sync (`varBaseCommitSha`)

A new optional input `varBaseCommitSha` enables **differential sync**: the task runs `git diff --name-only <sha> HEAD` inside the workspace directory and uploads **only the script folders containing changed files** since that commit. All unchanged scripts are skipped.

| Scenario | Behaviour |
|---|---|
| `varBaseCommitSha` is empty | Full sync — every detected script folder is uploaded (default) |
| `varBaseCommitSha` contains a valid SHA | Differential sync — only folders with changed files are uploaded |
| `git diff` fails (shallow clone, bad SHA) | Warning logged; falls back to full sync automatically |

#### Pipeline example — automatic differential sync (Azure DevOps Server on-premises)

The snippet below stores the GitLab HEAD SHA as a build artifact and retrieves it at the start of each build. The **first run** performs a full sync; **subsequent runs** upload only changed scripts.

> **Requirement:** enable **"Allow scripts to access the OAuth token"** on the agent job (pipeline Settings → Agent job → Additional options).

```yaml
steps:
- script: |
    git clone https://$(GitLabUser):$(GitLabToken)@<your-gitlab-host>/<repo>.git gitlab-src
  displayName: 'Checkout GitLab repo'

# ── Find the last successful build and download its stored SHA ────────────────
- powershell: |
    $orgUri   = $env:SYSTEM_TEAMFOUNDATIONSERVERURI
    $project  = $env:SYSTEM_TEAMPROJECTID
    $defId    = $env:SYSTEM_DEFINITIONID
    $curBuild = [int]$env:BUILD_BUILDID
    $token    = $env:SYSTEM_ACCESSTOKEN
    $headers  = @{ Authorization = "Bearer $token" }

    $buildsUrl = "${orgUri}${project}/_apis/build/builds?definitions=${defId}&resultFilter=succeeded&statusFilter=completed&`$top=10&api-version=6.0"
    $builds    = Invoke-RestMethod -Uri $buildsUrl -Headers $headers -ErrorAction SilentlyContinue
    $prev      = $builds.value | Where-Object { $_.id -ne $curBuild } | Select-Object -First 1

    if (-not $prev) {
      Write-Host "No previous successful build — full sync will run."
      Write-Host "##vso[task.setvariable variable=lastSyncSha]"
      exit 0
    }

    Write-Host "Previous successful build: $($prev.id)"
    $artUrl = "${orgUri}${project}/_apis/build/builds/$($prev.id)/artifacts?artifactName=last-sync-sha&api-version=6.0"
    try {
      $art     = Invoke-RestMethod -Uri $artUrl -Headers $headers -ErrorAction Stop
      $zipPath = "$(Agent.TempDirectory)\last-sync-sha-dl.zip"
      Invoke-WebRequest -Uri $art.resource.downloadUrl -Headers $headers -OutFile $zipPath
      Expand-Archive -Path $zipPath -DestinationPath "$(System.ArtifactsDirectory)\last-sync-sha" -Force
      $shaFile = Get-ChildItem -Path "$(System.ArtifactsDirectory)\last-sync-sha" -Filter sha.txt -Recurse | Select-Object -First 1
      if ($shaFile) {
        $sha = (Get-Content $shaFile.FullName).Trim()
        Write-Host "Last sync SHA: $sha"
        Write-Host "##vso[task.setvariable variable=lastSyncSha]$sha"
      } else {
        Write-Host "sha.txt not found — full sync will run."
        Write-Host "##vso[task.setvariable variable=lastSyncSha]"
      }
    } catch {
      Write-Host "Artifact not found in build $($prev.id) — full sync will run."
      Write-Host "##vso[task.setvariable variable=lastSyncSha]"
    }
  displayName: 'Download last sync SHA'
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)

# ── Sync (differential when SHA available, full on first run) ─────────────────
- task: LoadRunnerEnterpriseSync@3
  inputs:
    varPCServer: 'https://<lre-server>:<port>/?tenant=<guid>'
    varUserName: '<username>'
    varPassWord: '$(PCPassword)'
    varDomain: '<domain>'
    varProject: '<project>'
    varWorkspaceDir: '$(Build.SourcesDirectory)/gitlab-src'
    varBaseCommitSha: '$(lastSyncSha)'   # empty on first run → full sync
    varParallelUploads: '5'
    varSuccessThreshold: '80'

# ── Save HEAD SHA for the next build ─────────────────────────────────────────
- powershell: |
    $sha = (& git -C "$(Build.SourcesDirectory)\gitlab-src" rev-parse HEAD).Trim()
    $dir = "$(Agent.TempDirectory)\last-sync-sha"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Set-Content -Path "$dir\sha.txt" -Value $sha
    Write-Host "Saved SHA: $sha"
  displayName: 'Save current sync SHA'
  condition: succeeded()

- task: PublishBuildArtifacts@1
  displayName: 'Publish last sync SHA'
  condition: succeeded()
  inputs:
    PathtoPublish: '$(Agent.TempDirectory)\last-sync-sha'
    ArtifactName: 'last-sync-sha'
    publishLocation: 'Container'
```

---

## What's New in Version 3.1.0

> **July 2026**

### 🆕 Enterprise Performance Engineering Workspace Sync — `varSuccessThreshold` parameter

A new optional parameter controls how many upload failures the pipeline tolerates before failing the task.

| `varSuccessThreshold` value | Task result |
|---|---|
| *(empty / not set)* | Default: passes when **≥ 50%** of scripts upload successfully |
| `0` | Passes even if **no scripts** were uploaded (authentication failure still fails the task) |
| `100` | Fails if **even one** script fails to upload |
| Outside 0–100 | Falls back to the default (50%) |

> **Always fails on 5 consecutive upload failures** — this abort rule applies regardless of the threshold setting.

### ⚠️ Enterprise Performance Engineering Workspace Sync — `varParallelUploads` default changed to `1`
---

## What's New in Version 3.0.0

> **July 2026**

Version 3.0.0 is a complete rewrite of the extension in **TypeScript / Node.js**, replacing the legacy C# implementation. All existing task inputs and behaviours are preserved.

### Highlights

#### 🔧 Node.js Runtime Compatibility
- Requires **Node.js 16 or later**; Node 20 is recommended
- Execution handlers declared for **Node 20.1, Node 20, and Node 16** in priority order — Azure DevOps agents automatically select the highest supported version
- Polyfills injected at bootstrap cover built-ins introduced between Node 16 and Node 20 (`crypto.randomUUID`, `Object.fromEntries`, `Array.flat/flatMap`, `Promise.allSettled`, `String.trimStart/trimEnd`, `queueMicrotask`, `globalThis`)

#### 🛠️ Auto-Provisioning of Test Infrastructure
- When a project has no test sets or instances for the selected test, the task now **automatically**:
  1. Retrieves existing test set folders and locates (or creates) a *"CI Test Sets"* folder under the project Root
  2. Creates a new test set inside that folder
  3. Creates a test instance for the configured test
- Eliminates the most common first-run failure mode — no manual Enterprise Performance Engineering UI setup required

#### ⚙️ Azure DevOps Compliance
- Minimum agent version requirement updated to `2.144.0`
- Agent proxy auto-detected from Azure DevOps agent configuration when no explicit proxy URL is provided in the task inputs
- Every log line is simultaneously written to a log file in the artifacts directory

---

## Installation Instructions

For full installation instructions, see the [Installation and environment set up](https://admhelp.microfocus.com/lr/en/latest/help/WebHelp/Content/Controller/Azure_DevOps.htm#mt-item-1).

> **Note:** You must have Administrator privileges to install the extension on your Azure DevOps server.

---

## Documentation

Full usage documentation: [Continuous integration with Azure DevOps](https://admhelp.microfocus.com/lr/en/latest/help/WebHelp/Content/Controller/Azure_DevOps.htm).
