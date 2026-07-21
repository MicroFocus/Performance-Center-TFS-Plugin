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
- **Configurable success threshold** — decide how many upload failures are acceptable before failing the pipeline (see below)
- **Sequential uploads by default** (`varParallelUploads = 1`) — safe with all Enterprise Performance Engineering server releases. Parallel uploads can be enabled for servers that support concurrent ingest
- Proxy support with optional credentials
- Upload log saved to the artifacts directory

---

## Supported Product Versions

This extension supports the **3 latest versions** of OpenText Enterprise Performance Engineering.

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
