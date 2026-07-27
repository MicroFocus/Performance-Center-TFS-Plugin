# VSIX Deployment & Version Management Guide

**Current Version**: `3.3.0` (production release — testing series was `3.300.x`)

---

## Versioning Convention

| Scenario | Version format | Example |
|---|---|---|
| **Testing on ADO on-premises** | `3.300.x` — increment Patch for each test deployment | `3.300.0`, `3.300.1`, `3.300.2` … |
| **Production release** | `3.3.0` — set once integration tests pass | `3.3.0` |

### Files to update when bumping the patch counter

Three files must always be kept in sync:

| File | Field | Example |
|---|---|---|
| `angular/vss-extension.json` | `"version"` | `"3.300.1"` |
| `angular/LreCiTask/task.json` | `"version".Patch` | `"Patch": 1` |
| `angular/package.json` | `"version"` | `"3.300.1"` |
| `angular/package-lock.json` | `"version"` (root) + `packages[""].version` | `"3.300.1"` |

---

## Build & Package Workflow

```powershell
# 1. Install / update dependencies (only needed once or after package.json changes)
cd angular
npm install

# 2. Type-check
npm run typecheck

# 3. Run unit tests
npm run test:unit

# 4. Compile TypeScript → dist/
npm run build

# 5. Package VSIX (requires tfx-cli: npm install -g tfx-cli)
npm run package:vsix
# Output: Extension/Micro-Focus.PCIntegration-<version>.vsix
```

---

## Deploy to ADO Server

1. In Azure DevOps Server Administration Console → **Extensions** → **Upload extension**
2. Select the VSIX from `Extension/Micro-Focus.PCIntegration-<version>.vsix`
3. The new version coexists with the previous one; pipeline tasks pick up the new version automatically (or pin the major version in `task.json` references)

---

## Key Source Files

| File | Purpose |
|---|---|
| `angular/LreCiTask/index.ts` | Task entry-point — reads inputs, orchestrates auth → (YAML create) → run → download |
| `angular/src/ci/lre/LreClient.ts` | All LRE REST API calls (auth, tests, scripts, runs, reports, testplan folders) |
| `angular/src/ci/lre/LreTestRunner.ts` | Run lifecycle — polling, SLA evaluation, timeslot retry |
| `angular/src/ci/lre/LreTestCreator.ts` | YAML pipeline — parse → resolve scripts → create/update test |
| `angular/src/ci/yaml/YamlTestParser.ts` | Reads `.yaml`/`.yml` files, detects full-test vs content-only shape |
| `angular/src/ci/yaml/TestContentXmlBuilder.ts` | Converts parsed YAML to LRE REST API XML (`<Test>` and `<Content>`) |
| `angular/src/ci/yaml/SimplifiedModels.ts` | TypeScript interfaces for all YAML entity types |
| `angular/src/ci/lre/LreReportDownloader.ts` | Report/PDF download with retry |
| `angular/src/ci/models/index.ts` | Shared interfaces, XML helper classes |
| `angular/LreCiTask/task.json` | ADO task manifest (inputs, execution handlers, version) |
| `angular/vss-extension.json` | VSIX metadata (publisher, version, included files) |
| `angular/package.json` | npm scripts, dependencies |

---

## Integration Tests (YAML test creation)

The YAML test creation feature includes integration tests that run against a real LRE server. They are **disabled by default**.

```properties
# integration/integration-tests.properties
integration.test.createTestFromYaml=true    # ← set to true to enable

pc.yaml.scriptPath=scripts\\api\\my_script   # must exist in the LRE project
pc.yaml.testFolderPath=ci-tests\\yaml-it
pc.yaml.testName=YAML Integration Test
```

Run integration tests:

```powershell
cd angular
npm run test:integration
```

---

## Troubleshooting

### Issue: YAML script path not found
- Verify the script exists in the LRE project (Test Management → Test Plan → Scripts)
- The path is matched case-insensitively as `<TestFolderPath>\<Name>`
- A name-only match (without folder prefix) is also attempted as a fallback

### Issue: 409 conflict on `POST /tests` with no ID extracted
- The LRE server returned a 409 but the error message contained no number
- The regex tries `ID: <n>`, `test id: <n>`, `(<n>)`, and last-number fallback
- Check `tl.debug` output (enable ADO task debug logging) for the raw error message

### Issue: Node 6 SyntaxError (spread operator)
- Ensure `task.json` uses `"Node16"` or `"Node20"` execution handler — not legacy `"Node"`

### Issue: "No run results found" warning
- Normal if the post-run action is "Do Not Collate" or results are still generating
- The downloader retries 3 times with 3-second delays; adjust in `LreReportDownloader.ts` if needed

---

## Support Resources

- **Enterprise Performance Engineering API Docs**: https://admhelp.microfocus.com/lre/en/all/api_refs/Performance_Center_REST_API/Content/Welcome.htm
- **Feature design & progress**: `YAML-TEST-CREATION-FEATURE.md`
- **Local testing guide**: `angular/LOCAL-TESTING-GUIDE.md`
