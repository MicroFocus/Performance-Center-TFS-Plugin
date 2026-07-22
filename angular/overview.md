# Overview

The **"OpenText Enterprise Performance Engineering CI"** extension allows Azure DevOps Server pipelines to integrate with OpenText Enterprise Performance Engineering through two native build or release tasks.

## Tasks included

### Enterprise Performance Engineering Test
Run a performance test managed in an Enterprise Performance Engineering project directly from a pipeline. The task authenticates with the Enterprise Performance Engineering server, provisions a test timeslot, monitors the run until completion, and downloads result artifacts — all without leaving Azure DevOps.

### Enterprise Performance Engineering Workspace Sync
Scan a Git repository for Enterprise Performance Engineering performance test script folders, compress each into a ZIP, and upload them to the configured Enterprise Performance Engineering project. Keeps the Enterprise Performance Engineering test plan in sync with the source repository automatically on every build.

**Detected script types:** LoadRunner (`.usr`), JMeter (`.jmx`), Gatling (`.scala` / `.java`), DevWeb (`main.js` + `rts.yml`).

**Differential sync:** pass a git commit SHA via the `varBaseCommitSha` input to upload only the script folders that changed since that commit. Leave the input empty for a full sync (default). Falls back to a full sync automatically if the git diff cannot be computed.

## This extension currently supports:

* The three latest versions of OpenText Enterprise Performance Engineering.

## System prerequisites

* An OpenText Enterprise Performance Engineering server accessible from the Azure DevOps agent host.
* Azure DevOps agent v3.x (recommended) or v2.x with Node 20 externals installed. The agent supplies Node.js automatically — no separate Node.js installation is required.
