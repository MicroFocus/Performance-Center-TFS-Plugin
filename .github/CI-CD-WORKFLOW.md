# CI/CD Workflow Guide

This project uses GitHub Actions for automated CI/CD pipelines. There are two main workflows:

## 1. CI Build Workflow (`.github/workflows/ci.yml`)

**Triggers on:**
- Push to `master` branch (excluding `release/deploy.txt` and markdown files)
- Pull requests to `master` branch

**What it does:**
1. Sets up Node.js 18.x environment
2. Installs dependencies
3. Runs linter (ESLint)
4. Runs unit tests
5. Builds TypeScript
6. Packages VSIX extension
7. Uploads VSIX artifact to GitHub Actions storage (30-day retention)

**Artifacts:**
- VSIX files are available as artifacts in the workflow run (named `vsix-build`)
- Can be downloaded from the GitHub Actions UI

---

## 2. Release Workflow (`.github/workflows/release.yml`)

**Triggers on:**
- Push to `master` branch that modifies `release/deploy.txt`

**How it works:**
1. Reads `release/deploy.txt` to check if `enabled=true`
2. If `enabled=true`:
   - Validates and extracts version from deploy.txt
   - Updates version in `angular/vss-extension.json`
   - Updates version in `angular/LreCiTask/task.json`
   - Updates version in `angular/LreCiTask/package.json`
   - Runs full build pipeline (linter, tests, build)
   - Packages VSIX
   - Creates a GitHub Release with the VSIX as an asset
   - Resets `release/deploy.txt` to `enabled=false`
   - Commits and pushes updated version files
3. If `enabled=false` or not specified:
   - Release workflow is skipped (no action taken)

---

## How to Use

### For Regular Development (CI Build)

Just commit and push your changes to `master`:

```bash
git add .
git commit -m "Your changes"
git push origin master
```

The CI workflow will automatically:
- Run tests and linting
- Build the VSIX
- Store artifacts for download

### For Creating a Release

1. **Update the version number in `release/deploy.txt`:**

   ```bash
   # Edit release/deploy.txt
   enabled=true
   version=3.0.12  # Update to your desired version
   ```

2. **Commit and push:**

   ```bash
   git add release/deploy.txt
   git commit -m "Release v3.0.12"
   git push origin master
   ```

3. **The workflow will automatically:**
   - Update all version files (`vss-extension.json`, `task.json`, `package.json`)
   - Build and package the VSIX
   - Create a GitHub Release (tag `v3.0.12`)
   - Upload the VSIX as a release asset
   - Reset `deploy.txt` to `enabled=false`
   - Commit and push these changes back

4. **Verify the release:**
   - Go to your GitHub repository's "Releases" section
   - Find the new release with the VSIX artifact attached

---

## Important Notes

⚠️ **DO NOT manually trigger the Release workflow** - it only runs when `release/deploy.txt` is changed with `enabled=true`

⚠️ **The CI workflow WILL NOT trigger** when only `release/deploy.txt` is modified - this prevents duplicate builds during releases

⚠️ **Version format must be semantic** (e.g., `3.0.11`, `3.0.12`) - the workflow parses this to update Major, Minor, and Patch versions

⚠️ **The release workflow requires write permissions** to:
- Create tags and releases
- Commit and push version updates
- These are granted via `GITHUB_TOKEN` (automatically provided by GitHub)

---

## Troubleshooting

### Release didn't create
- Check that `enabled=true` (case-sensitive) in `release/deploy.txt`
- Check that version format is valid (semantic versioning: X.Y.Z)
- Check workflow logs in GitHub Actions tab

### CI doesn't run after push
- If you only changed `release/deploy.txt`, CI is skipped by design
- Make other code changes to trigger CI

### VSIX not created
- Check that TypeScript compiles without errors
- Ensure `tfx-cli` is installed correctly
- Check for any errors in the `angular/` folder
- Verify all dependencies are installed (`npm ci`)

---

## Workflow Variables

Both workflows use these key directories:
- **Source**: `angular/LreCiTask/` - Node.js/TypeScript project
- **Extension manifest**: `angular/vss-extension.json`
- **Task config**: `angular/LreCiTask/task.json`
- **Build output**: `angular/out/` - VSIX files generated here
- **Config file**: `release/deploy.txt` - Release trigger

---

## Summary Table

| Scenario | Trigger | CI Runs | Release Runs | Result |
|----------|---------|---------|--------------|--------|
| Regular code push | `push to master` | ✅ Yes | ❌ No | VSIX built, artifact stored |
| Update deploy.txt with `enabled=false` | `push release/deploy.txt` | ❌ No | ❌ No | No action |
| Update deploy.txt with `enabled=true` | `push release/deploy.txt` | ❌ No | ✅ Yes | GitHub Release created with VSIX |
| PR to master | `pull_request` | ✅ Yes | ❌ No | VSIX built, artifact stored |

