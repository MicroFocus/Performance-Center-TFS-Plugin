# Quick Start Guide - CI/CD Workflows

## TL;DR

- **Regular development**: Push code to `master` → CI automatically builds and tests
- **Create a release**: Edit `release/deploy.txt` with `enabled=true` and version → Workflow creates GitHub Release

---

## 30-Second Setup

1. ✅ Workflows are already created in `.github/workflows/`
2. ✅ No additional setup needed - GitHub Actions works automatically
3. ✅ Optional: Add badges to your README (see below)

---

## Development Workflow

### 1. Regular Development (CI Pipeline)

```bash
# Make your changes
git checkout master
git pull origin master
git add .
git commit -m "feat: add new feature"
git push origin master

# 🤖 CI Workflow runs automatically:
# - Installs dependencies
# - Runs linter
# - Runs tests  
# - Builds VSIX
# - Stores artifact

# ✅ Check results:
# Go to Actions tab → Find "CI Build" workflow
# Download artifact: "vsix-build"
```

### 2. Pull Requests (CI Pipeline)

```bash
git checkout -b feature/my-feature
# Make changes...
git push origin feature/my-feature

# 🤖 CI Workflow runs on PR to master
# ✅ Check results in PR checks section
```

---

## Release Workflow

### 1. Prepare for Release

Edit `release/deploy.txt`:

```bash
# BEFORE:
enabled=false
version=3.0.11

# AFTER (when ready to release):
enabled=true
version=3.0.12
```

**Version must be in format: X.Y.Z**

### 2. Validate (Optional)

```bash
# Windows
./scripts/Validate-Release.ps1

# macOS/Linux
chmod +x ./scripts/validate-release.sh
./scripts/validate-release.sh
```

### 3. Commit and Push

```bash
git add release/deploy.txt
git commit -m "Release v3.0.12"
git push origin master

# 🤖 Release Workflow runs automatically:
# - Reads deploy.txt
# - Updates all version files
# - Runs full build
# - Creates GitHub Release v3.0.12
# - Uploads VSIX as asset
# - Resets enabled=false

# ✅ Check results:
# Go to Releases section of your GitHub repo
# Download v3.0.12 release with VSIX
```

---

## Files Changed

After a successful release:
- `angular/vss-extension.json` - Version updated
- `angular/LreCiTask/task.json` - Version updated (Major, Minor, Patch)
- `angular/LreCiTask/package.json` - Version updated
- `release/deploy.txt` - Reset to `enabled=false`

All committed automatically by the workflow!

---

## Monitoring Workflows

**In GitHub:**
1. Go to **Actions** tab
2. View running/completed workflows
3. Click any workflow for detailed logs
4. Check specific step for error details

**Common statuses:**
- ✅ **Success** - All steps passed
- ❌ **Failure** - Check logs for error
- 🟡 **Queued/Running** - Workflow is processing

---

## When Something Goes Wrong

### CI Build Failed
1. Go to Actions → CI Build → Failed run
2. Expand the failed step (e.g., "Run tests")
3. Fix the error locally
4. Commit and push again

**Common failures:**
- Tests failing: `npm test` has assertion errors
- Linter errors: Code style issues (run `npm run lint` locally)
- Build errors: TypeScript compilation issues
- Missing dependencies: Check package.json

### Release Failed
1. Go to Actions → Release → Failed run
2. Check "Read deploy.txt" step first (version format issue?)
3. Check specific build step for details
4. Fix the issue
5. Make sure `enabled=true` is still set in deploy.txt
6. Push again

**Common failures:**
- Invalid version format (must be X.Y.Z like 3.0.12)
- `enabled` not exactly `true` (case-sensitive)
- Build itself failed (same as CI errors above)

---

## Adding Status Badges (Optional)

Add to your `README.md`:

```markdown
## CI/CD Status

[![CI Build](https://github.com/YOUR-ORG/YOUR-REPO/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/YOUR-ORG/YOUR-REPO/actions/workflows/ci.yml)
[![Release](https://github.com/YOUR-ORG/YOUR-REPO/actions/workflows/release.yml/badge.svg?branch=master)](https://github.com/YOUR-ORG/YOUR-REPO/actions/workflows/release.yml)
```

Replace:
- `YOUR-ORG` with your GitHub organization
- `YOUR-REPO` with your repository name

---

## Pro Tips

1. **Always validate before release:**
   ```bash
   ./scripts/validate-release.ps1  # or validate-release.sh
   ```

2. **Check workflow logs while pushing:**
   ```bash
   git push origin master
   # Immediately go to Actions tab to watch live
   ```

3. **Keep VSIX files safe:**
   - GitHub keeps releases indefinitely
   - Always download release assets before major changes
   - CI artifacts are kept for 30 days

4. **Version numbering:**
   - X = Major version (breaking changes)
   - Y = Minor version (new features)
   - Z = Patch version (bugfixes)
   - Example: 3.0.11 → 3.0.12 (patch), 3.1.0 (minor), 4.0.0 (major)

---

## Full Documentation

- **Detailed Guide:** `.github/CI-CD-WORKFLOW.md`
- **Setup Instructions:** `.github/SETUP.md`
- **Workflow Details:** `.github/workflows/README.md`

---

## Quick Reference

| Task | Command | Trigger |
|------|---------|---------|
| Regular development | `git push origin master` | CI Build |
| Create PR | `git push origin feature-branch` | CI Build (PR check) |
| Release | Edit deploy.txt + `git push` | Release |
| Download CI artifact | Check Actions tab | After CI Build runs |
| Download release | Check Releases page | After Release runs |

---

## Need Help?

1. **Check workflow logs** - Most details are there
2. **Validate deploy.txt** - Use validation scripts
3. **Read full documentation** - See links above
4. **Check version file formats** - Must be X.Y.Z

Questions? Check `.github/SETUP.md` for troubleshooting section.

