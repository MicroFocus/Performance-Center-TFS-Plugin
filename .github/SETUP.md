# CI/CD Setup Guide

This guide explains how to set up and use the new GitHub Actions CI/CD workflows.

## Prerequisites

- Repository is hosted on GitHub
- GitHub Actions is enabled for your repository (default for public repos, check Settings for private repos)
- Your repository has a `.github/workflows/` directory with the workflow files

## What's Been Set Up

### Workflow Files
1. **`.github/workflows/ci.yml`** - CI Build Workflow
   - Runs on code changes (excluding release/deploy.txt)
   - Builds, tests, and packages VSIX

2. **`.github/workflows/release.yml`** - Release Workflow
   - Runs when release/deploy.txt is modified with `enabled=true`
   - Creates GitHub Release with VSIX artifact

### Helper Scripts
1. **`scripts/Validate-Release.ps1`** - PowerShell validation script (Windows)
2. **`scripts/validate-release.sh`** - Bash validation script (Linux/macOS)

### Configuration
- **`release/deploy.txt`** - Release trigger file (already exists)

## First-Time Setup

### 1. Enable GitHub Actions

In your GitHub repository:
1. Go to **Settings** → **Actions** → **General**
2. Ensure "Allow all actions and reusable workflows" is selected
3. Save changes

### 2. Verify Workflows

Check that your workflows are loaded:
1. Go to **Actions** tab in GitHub
2. You should see two workflows listed:
   - "CI Build"
   - "Release"

### 3. Verify `release/deploy.txt` Format

```bash
# Run validation
./scripts/validate-release.ps1  # Windows
./scripts/validate-release.sh   # macOS/Linux
```

Current status:
```
enabled=false      # Release is currently disabled
version=3.0.11     # Next version to release
```

## Usage Workflows

### For Regular Development

1. **Make code changes**
   ```bash
   git checkout master
   git pull origin master
   git add .
   git commit -m "Your feature or fix"
   git push origin master
   ```

2. **CI Workflow automatically runs:**
   - ✅ Installs dependencies
   - ✅ Runs linter
   - ✅ Runs tests
   - ✅ Builds TypeScript
   - ✅ Creates VSIX
   - ✅ Stores artifact for 30 days

3. **View Results:**
   - Go to **Actions** tab
   - Click on the "CI Build" workflow run
   - Expand the job to see logs
   - Download artifact: "vsix-build"

### For Creating a Release

1. **Update the version in `release/deploy.txt`:**
   ```bash
   # Edit release/deploy.txt
   # Change:
   #   enabled=false
   #   version=3.0.11
   # To:
   #   enabled=true
   #   version=3.0.12
   ```

2. **Validate the file (optional but recommended):**
   ```bash
   ./scripts/validate-release.ps1  # Windows
   ./scripts/validate-release.sh   # macOS/Linux
   ```

3. **Commit and push:**
   ```bash
   git add release/deploy.txt
   git commit -m "Release v3.0.12"
   git push origin master
   ```

4. **Release Workflow automatically:**
   - ✅ Reads and validates deploy.txt
   - ✅ Updates version in all files:
     - `angular/vss-extension.json`
     - `angular/LreCiTask/task.json`
     - `angular/LreCiTask/package.json`
   - ✅ Runs full build pipeline (linter, tests, build)
   - ✅ Creates VSIX
   - ✅ Creates GitHub Release (tag: `v3.0.12`)
   - ✅ Uploads VSIX as release asset
   - ✅ Resets `enabled=false` in deploy.txt
   - ✅ Commits and pushes updated files

5. **Verify Release:**
   - Go to **Releases** section of your GitHub repo
   - Find the new release with the version tag
   - Download the VSIX artifact
   - Or go to **Actions** and check the Release workflow logs

## Important Constraints

⚠️ **These behaviors are by design:**

| Action | CI Runs? | Release Runs? | Why? |
|--------|----------|---------------|------|
| Push code to master | ✅ Yes | ❌ No | Don't want duplicate builds during release |
| Modify release/deploy.txt with enabled=false | ❌ No | ❌ No | No release needed |
| Modify release/deploy.txt with enabled=true | ❌ No | ✅ Yes | Trigger release, not CI |
| Create pull request | ✅ Yes | ❌ No | CI should run on PRs for validation |

## Troubleshooting

### "Workflow is not running"
- Check that workflows are in `.github/workflows/` directory
- Verify GitHub Actions is enabled (Settings → Actions)
- Make sure you're pushing to the `master` branch

### "Release didn't trigger"
- Verify `enabled=true` (case-sensitive) in deploy.txt
- Check version format: must be X.Y.Z (e.g., 3.0.12)
- Go to Actions tab to see workflow logs for errors

### "CI didn't run after code push"
- Check that you're pushing to `master` branch
- If you only modified `release/deploy.txt`, CI is intentionally skipped
- Try pushing other file changes to trigger CI

### "Build failed in workflow"
- Go to Actions tab
- Click on the failed workflow run
- Expand the failed job step
- Read the error message
- Common issues:
  - Missing dependencies: check `npm ci` output
  - TypeScript errors: check `npm run build` output
  - Tests failing: check `npm test` output

### "Release created but VSIX not attached"
- Check "Release and Upload Asset" step in workflow logs
- Verify VSIX was created in `angular/out/` directory
- Check GitHub Actions logs for any upload errors

## Manual Override (If Needed)

If you need to manually trigger workflows:

1. Go to **Actions** tab
2. Select the workflow (CI Build or Release)
3. Click **Run workflow**
4. Select the branch and fill in parameters

However, this is usually not needed as workflows trigger automatically.

## Monitoring Workflow Health

Check workflow status regularly:
- Go to **Actions** tab
- Look at recent workflow runs
- Click any failed run to see what went wrong
- Check badges if you added them to README.md

## Next Steps

1. **Test the CI workflow:**
   ```bash
   git checkout -b test/ci-workflow
   git add .
   git commit -m "test: verify CI workflow"
   git push origin test/ci-workflow
   ```
   Then create a PR and watch CI run

2. **Test the Release workflow:**
   - Update `release/deploy.txt` with a test version
   - Set `enabled=true`
   - Push and watch the release workflow

3. **Monitor first production releases:**
   - Keep Actions tab open to watch workflow progress
   - Check that all files were updated correctly
   - Verify GitHub Release was created

## Getting Help

For workflow-specific issues:
1. Check the Actions tab logs in your GitHub repository
2. Look for error messages in the workflow job output
3. Common issues are listed in the Troubleshooting section above
4. Check `.github/workflows/` files for any syntax issues

## File Reference

```
.github/
  CI-CD-WORKFLOW.md           # Detailed workflow documentation
  workflows/
    ci.yml                    # CI Build workflow
    release.yml               # Release workflow

scripts/
  Validate-Release.ps1        # Windows validation script
  validate-release.sh         # Bash validation script

release/
  deploy.txt                  # Release trigger configuration
```

