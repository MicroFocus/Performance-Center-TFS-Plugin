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
- Authenticate with **username/password** or **API token** (required for SSO-configured servers)
- **Auto-provision test infrastructure** — if no test set or test instance exists in the project, the task automatically creates a test set folder, a test set, and a test instance so the pipeline never blocks on missing setup
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
