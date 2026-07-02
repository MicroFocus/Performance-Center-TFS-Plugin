# VSIX Deployment & Version Management Guide

**Current Version**: 3.0.1

## Deployment Requirements

### ADO Server Agent Prerequisites
- **Node.js**: 16+  (NOT 6, NOT 10, NOT 14)
  - The `task.json` execution handler `Node16` ensures Node 16+ is used
  - If an agent doesn't have Node16 handler, it will fail (this is intentional)
- **No PowerShell required** — runs cross-platform
- **No .NET dependencies** — pure TypeScript/Node.js

### Latest VSIX
```
C:\Git\plugin\Performance-Center-TFS-Plugin\Micro-Focus.PCIntegration-3.0.1.vsix
```

## Workflow for Future Changes

### 1. When Code Changes Require New Build

**Always:**
```
Version: OLD (e.g., 3.0.1) → NEW (e.g., 3.0.2)
```

**Update 3 files:**
- `PC.TFS.BuildTask/LreCiExtension/LreCiTask/package.json`
  ```json
  "version": "3.0.2"
  ```
- `PC.TFS.BuildTask/LreCiExtension/LreCiTask/task.json`
  ```json
  "version": {
    "Major": 3,
    "Minor": 0,
    "Patch": 2
  }
  ```
- `PC.TFS.BuildTask/LreCiExtension/vss-extension.json`
  ```json3.0.1
  "version": "3.0.2"
  ```

### 2. Build & Package

```powershell
# Navigate to task directory
cd "C:\Git\plugin\Performance-Center-TFS-Plugin\PC.TFS.BuildTask\LreCiExtension\LreCiTask"

# Compile TypeScript
npm run build

# Navigate to extension directory
cd ".."

# Create VSIX
tfx extension create --manifest-globs vss-extension.json --output-path "C:\Git\plugin\Performance-Center-TFS-Plugin"
```

### 3. Deploy to ADO Server

- Use ADO Server administration UI to upload new VSIX
- Old version (3.0.1) and new version (3.0.2) coexist
- Pipeline YAML/UI automatically picks up new version

## Troubleshooting

### Issue: Node 6 SyntaxError (spread operator)
- ❌ Check `task.json` has `"Node": ...` (old, references v6)
- ✅ Must have `"Node16": ...` (minimum)
- ✅ Can also have `"Node20": ...` (newer agents)

### Issue: "No run results found" warning
- Normal if:
  - Run just finished (wait 3-9 seconds, task retries 3 times)
  - Post-run action is "Do Not Collate"
  - Server still generating analysis data
- Adjust retry delays in `index.ts` if needed:
  ```typescript
  retryAttempts: 3,
  retryDelayMs: 3000  // milliseconds
  ```

### Issue: Trend PDF not found
- Verify trend report ID is correct
- Verify test has auto-trending configured
- Check if trend is still being generated (same timing as results)

## Test Coverage

**Safe (read-only) tests:**
```powershell
cd "PC.TFS.BuildTask/LreCiExtension/LreCiTask"
npm run test:integration:safe
```
Result: 9 tests pass, 6 skipped (no actual runs)

**Full integration tests** (require `integration.test.executeRun=true`):
- Starts real test runs (consumes licenses!)
- Downloads reports from actual runs
- Not recommended for frequent testing

## Key Files

| File | Purpose |
|------|---------|
| `index.ts` | Task entrypoint; orchestrates auth → run → download |
| `src/lre/LreClient.ts` | HTTP client; all API communication |
| `src/lre/LreTestRunner.ts` | Run lifecycle orchestration |
| `src/lre/LreReportDownloader.ts` | Report download with retry mechanism |
| `task.json` | ADO task manifest (execution handlers, inputs) |
| `vss-extension.json` | VSIX metadata |

## Known Limitations

1. **Retry timing** — Hardcoded to 3 attempts, 3-second delays
   - If server takes >9 seconds to generate results, may need adjustment
   - Edit `index.ts` lines 184-186 and 192-194

2. **Single-child XML elements** — Always normalized to arrays in collections
   - Normal behavior, no change needed

3. **Post-run action** — Results may not be available if "Do Not Collate"
   - This is expected LRE server behavior

## Support Resources

- **LRE API Docs**: https://admhelp.microfocus.com/lre/en/all/api_refs/Performance_Center_REST_API/Content/Welcome.htm
- **Implementation Notes**: `PC.TFS.BuildTask/LreCiExtension/LreCiTask/docs/LRE-API-Analysis.md`
- **Progress Tracking**: `PC.TFS.BuildTask/LreCiExtension/LreCiTask/docs/IMPLEMENTATION-PROGRESS.md`

