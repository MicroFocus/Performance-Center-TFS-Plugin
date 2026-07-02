# Local Testing Guide for LRE Task Extension

This guide explains how to test the `Micro-Focus.PCIntegration` extension VSIX outside of Azure DevOps pipelines.

## Prerequisite

- Install **Node.js 20 or newer** before running the local scripts. The extension targets the Node 20 Azure DevOps task runtime and the local wrappers assume the same baseline.

## Testing Options

### Option 1: Using the PowerShell Test Script (Easiest)

The fastest way to test the task locally:

```powershell
# Navigate to the angular directory
cd C:\Git\plugin\Performance-Center-TFS-Plugin2\angular

# Run the test script with custom parameters
.\test-local.ps1 `
  -PCServer "http://your-lre-server:80" `
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

For more control over the environment:

```powershell
cd C:\Git\plugin\Performance-Center-TFS-Plugin2\angular\LreCiTask

# Build the TypeScript
npm install
npm run build

# Run directly with Node (uses dist/index.js)
node index.js
```

**Note:** You must set environment variables before running:
```powershell
$env:INPUT_VARPCSERVER    = "http://your-server:80"
$env:INPUT_VARUSERNAME    = "admin"
$env:INPUT_VARPASSWORD    = "password"
$env:INPUT_VARDOMAIN      = "DEFAULT"
$env:INPUT_VARPROJECT     = "MyProject"
$env:INPUT_VARTESTID      = "1"
$env:INPUT_VARARTIFACTSDIR = "C:\temp\artifacts"
```

### Option 3: Using the Node.js Test Runner Script

For JavaScript-based testing:

```powershell
cd C:\Git\plugin\Performance-Center-TFS-Plugin2\angular

# First, build the task
cd LreCiTask
npm install
npm run build
cd ..

# Run the test
node test-local.js
```

Edit `test-local.js` to customize your test inputs.

### Option 4: Install in Local Azure DevOps Server

For full integration testing in Azure DevOps:

1. **On your Azure DevOps Server:**
   - Go to `Azure DevOps Server Administration Console`
   - Select `Extensions`
   - Click `Upload extension...`
   - Select `Micro-Focus.PCIntegration-3.0.0.vsix` (from `angular/out/`)

2. **In a test build pipeline:**
   - Create a new build pipeline
   - Add the "Enterprise Performance Engineering Test" task
   - Configure with your Performance Center server details
   - Run the pipeline

### Option 5: Extract and Inspect VSIX Contents

To see what's inside the VSIX:

```powershell
# The VSIX is actually a ZIP file
Copy-Item "C:\Git\plugin\Performance-Center-TFS-Plugin2\angular\out\Micro-Focus.PCIntegration-3.0.0.vsix" `
  -Destination "C:\temp\extension.zip"

# Extract it
Expand-Archive "C:\temp\extension.zip" -DestinationPath "C:\temp\extension"

# Explore the structure
Get-ChildItem "C:\temp\extension" -Recurse
```

## Environment Variables Reference

When testing locally, these environment variables are read by the Azure DevOps task library:

| Variable | Purpose | Example |
|----------|---------|---------|
| `INPUT_VARPCSERVER` | Performance Center server URL | `http://lre-server:80` |
| `INPUT_VARUSERNAME` | Username/Token ID for auth | `admin` |
| `INPUT_VARPASSWORD` | Password/Token secret | `password123` |
| `INPUT_VARDOMAIN` | PC Domain | `DEFAULT` |
| `INPUT_VARPROJECT` | PC Project | `MyProject` |
| `INPUT_VARTESTID` | Test ID | `1` |
| `INPUT_VARARTIFACTSDIR` | Where to save results | `C:\artifacts` |
| `SYSTEM_TASKINSTANCEID` | Task instance ID | Auto-generated |
| `SYSTEM_JOBID` | Job ID | Auto-generated |
| `BUILD_BUILDID` | Build ID | `1` |
| `BUILD_ARTIFACTSTAGINGDIRECTORY` | Artifacts staging | `C:\temp\artifacts` |

## Troubleshooting

### Issue: "Node command not found"
**Solution:** Install Node.js 20+ from https://nodejs.org/ (use LTS version)

### Issue: "Cannot find module..."
**Solution:** Run `npm install` in the `LreCiTask` directory

### Issue: TypeScript compilation errors
**Solution:** 
```powershell
cd LreCiTask
npm install
npm run build
# Check errors in dist/
```

### Issue: Task timeout
**Solution:** The task might be waiting for the Performance Center server response. Verify:
- PC server URL is correct
- Network connectivity to PC server
- Credentials are valid
- Test ID exists in the specified domain/project

## File Locations

- **Source code:** `angular/LreCiTask/src/`
- **Compiled output:** `angular/LreCiTask/dist/`
- **Extension manifest:** `angular/vss-extension.json`
- **Task definition:** `angular/LreCiTask/task.json`
- **Test artifacts:** Generated to your specified `varArtifactsDir`

## Next Steps After Testing

If the local test succeeds:

1. **Package the VSIX:**
   ```powershell
   cd C:\Git\plugin\Performance-Center-TFS-Plugin2\angular\LreCiTask
   npm run package:vsix
   ```

2. **Deploy to Azure DevOps Server** (see Option 4)

3. **Run in actual pipeline** and verify results

## Additional Resources

- [Azure DevOps Task Library Docs](https://github.com/Microsoft/azure-pipelines-task-lib)
- [Building Extensions for Azure DevOps](https://docs.microsoft.com/en-us/azure/devops/extend/develop/add-build-task)
- Performance Center Documentation: https://admhelp.microfocus.com/lr/en/latest/help/WebHelp/Content/Controller/Azure_DevOps.htm
