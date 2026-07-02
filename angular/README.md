# Integration with OpenText Enterprise Performance Engineering

This extension enables you to include an **OpenText Enterprise Performance Engineering (LRE)** test execution as a task in a Microsoft Azure DevOps Server CI/CD pipeline. Configure your performance tests once and run them automatically on every build — no manual intervention required.

---

## Key Features

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

---

## Supported Product Versions

This extension supports the **3 latest versions** of OpenText Enterprise Performance Engineering.

---

## What's New in Version 3.0.0

> **July 2026**

Version 3.0.0 is a complete rewrite of the extension task in **TypeScript / Node.js**, replacing the legacy C# implementation. All existing task inputs and behaviours are preserved.

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
- Eliminates the most common first-run failure mode — no manual LRE UI setup required

#### ⚙️ Azure DevOps Compliance
- Minimum agent version requirement updated to `2.144.0`
- Agent proxy auto-detected from Azure DevOps agent configuration when no explicit proxy URL is provided in the task inputs
- Every log line is simultaneously written to a `LreCiTask.log` file in the artifacts directory

---

## Installation Instructions

For full installation instructions, see the [Installation and environment set up](https://admhelp.microfocus.com/lr/en/latest/help/WebHelp/Content/Controller/Azure_DevOps.htm#mt-item-1).

> **Note:** You must have Administrator privileges to install the extension on your Azure DevOps server.

---

## Documentation

Full usage documentation: [Continuous integration with Azure DevOps](https://admhelp.microfocus.com/lr/en/latest/help/WebHelp/Content/Controller/Azure_DevOps.htm).
