# Local Testing Guide for Enterprise Performance Engineering Task Extension

This guide explains how to test the `Micro-Focus.PCIntegration` extension VSIX outside of Azure DevOps pipelines.
The extension contains **two tasks** — both can be tested locally.

## Prerequisite

- Install **Node.js 20 or newer** before running the local scripts. The extension targets the Node 20 Azure DevOps task runtime and the local wrappers assume the same baseline.

---

## Testing the CI Test Run Task (`LreCiTask`)

### Option 1: Using the PowerShell Test Script (Easiest)

The fastest way to test the task locally:

```powershell
# Navigate to the angular directory (single project root)
cd C:\Git\plugin\Performance-Center-TFS-Plugin2\angular

# Install all dependencies (only needed once)
npm install

# Run the test script with custom parameters
.\test-local.ps1 `
  -PCServer "http://your-server:80" `
  -Domain "YOUR_DOMAIN" `
  -Project "YOUR_PROJECT" `
  -TestID "1" `
  -UserName "your_username" `
  -Password "your_password"

# Or use defaults (will show as "MyServer", etc.)
.\test-local.ps1
```

**What it does:**
- Compiles the TypeScript code
- Sets up Azure DevOps environment variables
- Runs the task with your provided inputs
- Displays generated artifacts in the console

### Option 2: Node.js Direct Execution

```powershell
# From the single project root
cd C:\Git\plugin\Performance-Center-TFS-Plugin2\angular
npm install           # once — covers both tasks
npm run build:ci      # build CI task only

# Set environment variables
$env:INPUT_VARPCSERVER     = "http://your-server:80"
$env:INPUT_VARUSERNAME     = "admin"
$env:INPUT_VARPASSWORD     = "password"
$env:INPUT_VARDOMAIN       = "DEFAULT"
$env:INPUT_VARPROJECT      = "MyProject"
$env:INPUT_VARTESTID       = "1"
$env:INPUT_VARARTIFACTSDIR = "C:\temp\artifacts"

# Run via the bootstrap (which loads dist/LreCiTask/index.js)
node LreCiTask\index.js
```

### Option 3: Using the Node.js Test Runner Script

```powershell
cd C:\Git\plugin\Performance-Center-TFS-Plugin2\angular
npm install
npm run build:ci
node test-local.js
```

Edit `test-local.js` to customize your test inputs.

### Option 4: Install in Local Azure DevOps Server

For full integration testing in Azure DevOps:

1. **On your Azure DevOps Server:**
   - Go to `Azure DevOps Server Administration Console`
   - Select `Extensions`
   - Click `Upload extension...`
   - Select the latest `.vsix` (from `angular/out/`)

2. **In a test build pipeline:**
   - Create a new build pipeline
   - Add the **"Enterprise Performance Engineering Test"** task
   - Configure with your Enterprise Performance Engineering server details
   - Run the pipeline

---

## Testing the Enterprise Performance Engineering Workspace Sync Task (`LreWorkspaceSyncTask`)

### Node.js Direct Execution

```powershell
# From the single project root
cd C:\Git\plugin\Performance-Center-TFS-Plugin2\angular
npm install           # once — covers both tasks
npm run build:sync    # build Workspace Sync task only

# Set required environment variables
$env:INPUT_VARPCSERVER         = "https://your-server:443"
$env:INPUT_VARUSERNAME         = "admin"
$env:INPUT_VARPASSWORD         = "password"
$env:INPUT_VARDOMAIN           = "DEFAULT"
$env:INPUT_VARPROJECT          = "MyProject"
$env:INPUT_VARWORKSPACEDIR     = "C:\path\to\your\workspace"
$env:INPUT_VARRUNTIMEONLY      = "false"
$env:INPUT_VARPARALLELUPLOADS  = "1"
$env:INPUT_VARSUCCESSTHRESHOLD = ""
$env:INPUT_VARARTIFACTSDIR     = "C:\temp\sync-artifacts"

# Run via the bootstrap (which loads dist/LreWorkspaceSyncTask/index.js)
node LreWorkspaceSyncTask\index.js
```

### Success Threshold Examples

```powershell
# Strict mode — fail if even one script fails to upload
$env:INPUT_VARSUCCESSTHRESHOLD = "100"

# Lenient mode — pass even if all scripts fail (authentication failure still fails the task)
$env:INPUT_VARSUCCESSTHRESHOLD = "0"

# Custom — require at least 80% of scripts to upload successfully
$env:INPUT_VARSUCCESSTHRESHOLD = "80"

# Default behaviour (50%) — leave empty or omit the variable entirely
$env:INPUT_VARSUCCESSTHRESHOLD = ""
```

> **Note:** 5 consecutive upload failures always abort the task with failure, regardless of the threshold.

### Type-Check Only (no server needed)

```powershell
cd C:\Git\plugin\Performance-Center-TFS-Plugin2\angular
npm test     # type-checks BOTH tasks in one command
```

### Install in Local Azure DevOps Server

Follow the same install steps above, then add the **"Enterprise Performance Engineering Workspace Sync"** task to your pipeline instead.

---

### Option 5: Extract and Inspect VSIX Contents

To see what's inside the VSIX:

```powershell
# The VSIX is actually a ZIP file
Copy-Item "C:\Git\plugin\Performance-Center-TFS-Plugin2\angular\out\Micro-Focus.PCIntegration-3.1.0.vsix" `
  -Destination "C:\temp\extension.zip"

# Extract it
Expand-Archive "C:\temp\extension.zip" -DestinationPath "C:\temp\extension"

# Explore the structure
Get-ChildItem "C:\temp\extension" -Recurse
```

## Environment Variables Reference

### CI Test Run Task (`LreCiTask`)

| Variable | Purpose | Example |
|----------|---------|---------|
| `INPUT_VARPCSERVER` | Enterprise Performance Engineering server URL | `http://server:80` |
| `INPUT_VARUSERNAME` | Username/Token ID for auth | `admin` |
| `INPUT_VARPASSWORD` | Password/Token secret | `password123` |
| `INPUT_VARDOMAIN` | Enterprise Performance Engineering Domain | `DEFAULT` |
| `INPUT_VARPROJECT` | Enterprise Performance Engineering Project | `MyProject` |
| `INPUT_VARTESTID` | Test ID | `1` |
| `INPUT_VARARTIFACTSDIR` | Where to save results | `C:\artifacts` |
| `SYSTEM_TASKINSTANCEID` | Task instance ID | Auto-generated |
| `SYSTEM_JOBID` | Job ID | Auto-generated |
| `BUILD_BUILDID` | Build ID | `1` |
| `BUILD_ARTIFACTSTAGINGDIRECTORY` | Artifacts staging | `C:\temp\artifacts` |

### Workspace Sync Task (`LreWorkspaceSyncTask`)

| Variable | Purpose | Default | Example |
|----------|---------|---------|---------|
| `INPUT_VARPCSERVER` | Enterprise Performance Engineering server URL | — | `https://server:443` |
| `INPUT_VARUSERNAME` | Username / Token ID | — | `admin` |
| `INPUT_VARPASSWORD` | Password / Token secret | — | `password123` |
| `INPUT_VARDOMAIN` | Enterprise Performance Engineering Domain | — | `DEFAULT` |
| `INPUT_VARPROJECT` | Enterprise Performance Engineering Project | — | `MyProject` |
| `INPUT_VARWORKSPACEDIR` | Root directory to scan | cwd | `C:\repos\myproject` |
| `INPUT_VARRUNTIMEONLY` | Upload runtime-only scripts | `false` | `true` |
| `INPUT_VARPARALLELUPLOADS` | Concurrent uploads (1–20) | `1` | `1` |
| `INPUT_VARSUCCESSTHRESHOLD` | Min % success (0–100, empty=50%) | `""` | `80` |
| `INPUT_VARARTIFACTSDIR` | Where to save upload logs | — | `C:\temp\sync-artifacts` |

## Troubleshooting

### Issue: "Node command not found"
**Solution:** Install Node.js 20+ from https://nodejs.org/ (use LTS version)

### Issue: "Cannot find module..."
**Solution:** Run `npm install` from `angular/` (the single project root — covers both tasks)

### Issue: TypeScript compilation errors
**Solution:**
```powershell
cd angular
npm install
npm run build      # builds both tasks
# or target a specific task:
npm run build:ci
npm run build:sync
```

### Issue: Task timeout (CI task)
**Solution:** The task might be waiting for the Enterprise Performance Engineering server response. Verify:
- Enterprise Performance Engineering server URL is correct
- Network connectivity to Enterprise Performance Engineering server
- Credentials are valid
- Test ID exists in the specified domain/project

### Issue: No scripts found (Workspace Sync)
**Solution:** Verify the workspace directory contains folders with `.usr`, `.jmx`, `.scala`, `.java`, or `main.js`+`rts.yml` files. The scanner does not recurse into subdirectories once a script folder is identified.

### Issue: Upload failures (Workspace Sync)
**Solution:**
- If `INPUT_VARSUCCESSTHRESHOLD = "100"`, any single failure causes the task to fail — lower the threshold if partial failures are acceptable
- Check that the Enterprise Performance Engineering server is reachable and the credentials have write access to the project
- The task aborts after **5 consecutive failures** — check server health if this is triggered
- Keep `INPUT_VARPARALLELUPLOADS = "1"` (the default) if the server does not yet support concurrent script uploads

## File Locations

- **Shared source:** `angular/src/` (`ci/`, `sync/`, `shared/`)
- **CI task compiled output:** `angular/LreCiTask/dist/`
- **Sync task compiled output:** `angular/LreWorkspaceSyncTask/dist/`
- **Extension manifest:** `angular/vss-extension.json`
- **CI task definition:** `angular/LreCiTask/task.json`
- **Sync task definition:** `angular/LreWorkspaceSyncTask/task.json`
- **Test artifacts:** Generated to your specified `varArtifactsDir`

## Next Steps After Testing

If the local test succeeds:

1. **Package the VSIX from the single project root:**
   ```powershell
   cd C:\Git\plugin\Performance-Center-TFS-Plugin2\angular
   npm run package:vsix
   ```

2. **Deploy to Azure DevOps Server** (see above)

3. **Run in actual pipeline** and verify results

## Additional Resources

- [Azure DevOps Task Library Docs](https://github.com/Microsoft/azure-pipelines-task-lib)
- [Building Extensions for Azure DevOps](https://docs.microsoft.com/en-us/azure/devops/extend/develop/add-build-task)
- Performance Center Documentation: https://admhelp.microfocus.com/lr/en/latest/help/WebHelp/Content/Controller/Azure_DevOps.htm
