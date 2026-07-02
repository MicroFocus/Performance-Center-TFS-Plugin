# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the Performance-Center-TFS-Plugin project.

## Workflows Overview

### 1. CI Build (`ci.yml`)

**Purpose:** Build and test on every code change

**Triggers:**
- Push to `master` branch (excluding `release/deploy.txt` and `.md` files)
- Pull requests to `master` branch

**Actions:**
1. Install Node.js 24.x
2. Install dependencies with npm
3. Run dependency security audit
4. Run ESLint (code quality)
5. Run TypeScript validation
6. Compile TypeScript
7. Package VSIX extension
8. Upload VSIX artifact (30-day retention)

**Example Trigger:**
```bash
git push origin master
# → CI workflow runs automatically
# → Check Actions tab for results and artifact
```

---

### 2. Release (`release.yml`)

**Purpose:** Create versioned releases when triggered via `release/deploy.txt`

**Triggers:**
- Push to `master` branch that modifies `release/deploy.txt`
- Only runs if `enabled=true` in the file

**Actions:**
1. Read and validate `release/deploy.txt`
2. Update version in `vss-extension.json`
3. Update version in `task.json`
4. Update version in `package.json`
5. Run full secure build pipeline (audit, tests, linter, compile)
6. Package VSIX
7. Create GitHub Release (with tag and release notes)
8. Upload VSIX as release asset
9. Reset `enabled=false` in `deploy.txt`
10. Commit and push updated files

**Example Trigger:**
```bash
# Edit release/deploy.txt:
# enabled=true
# version=3.0.12

git add release/deploy.txt
git commit -m "Release v3.0.12"
git push origin master
# → Release workflow runs automatically
# → Check GitHub Releases page for the new release
```

---

## Quick Reference

| Workflow | Triggers | Does CI | Creates Release | Artifacts |
|----------|----------|---------|-----------------|-----------|
| CI Build | Code push, PRs | ✅ | ❌ | VSIX artifact |
| Release | deploy.txt push | ❌ | ✅ | GitHub Release + VSIX |

---

## Workflow Files Reference

- **`ci.yml`** - CI Build workflow definition
- **`release.yml`** - Release workflow definition
- **`../dependabot.yml`** - Weekly dependency and GitHub Actions update automation

## Documentation

- **`../SETUP.md`** - Complete setup and usage guide
- **`../CI-CD-WORKFLOW.md`** - Detailed workflow documentation

## Helper Scripts

- **`../../scripts/Validate-Release.ps1`** - Validate deploy.txt (PowerShell)
- **`../../scripts/validate-release.sh`** - Validate deploy.txt (Bash)

---

## Monitoring Workflows

To check workflow status:
1. Go to your GitHub repository
2. Click the **Actions** tab
3. View running/completed workflows
4. Click any workflow for detailed logs

---

## Workflow Status Badges (Optional)

You can add these badges to your `README.md` to show workflow status:

```markdown
![CI Build](https://github.com/YOUR-ORG/YOUR-REPO/actions/workflows/ci.yml/badge.svg)
![Release](https://github.com/YOUR-ORG/YOUR-REPO/actions/workflows/release.yml/badge.svg)
```

Replace `YOUR-ORG` and `YOUR-REPO` with your actual GitHub org and repo name.

This project also keeps a static security-review badge in the root `readme.md` to call out the current reviewed extension baseline.

---

## Key Configuration

**Branches:**
- CI runs on: `master`
- Release runs on: `master` (only when deploy.txt is modified)

**Node.js Version:**
- Builds use Node.js 24.x
- Azure DevOps task runtime uses Node20
- Local package development requires Node.js 20+ (Node 24 recommended)

**Dependencies:**
- All dependencies are installed fresh with `npm ci`
- `npm run security:audit` is enforced in CI and release builds
- `tfx-cli` is installed for VSIX packaging

**Artifacts:**
- VSIX files stored in `angular/out/`
- CI artifacts retained for 30 days
- Release artifacts stored as GitHub Releases (indefinite)

---

## Permissions Required

Both workflows require:
- ✅ Provided automatically by GitHub Actions
- `GITHUB_TOKEN` - Automatically available for:
  - Reading repo code
  - Creating releases
  - Committing and pushing changes

No additional setup needed!

---

## Troubleshooting

**Workflow not appearing?**
- Ensure `.github/workflows/*.yml` files exist
- Check GitHub Actions is enabled (Settings → Actions)

**Workflow not triggering?**
- Verify you're pushing to `master` branch
- Check file paths match expected locations

**Build failing?**
- Check workflow logs in Actions tab
- Look for specific step failure
- Common causes: missing dependencies, test failures, TypeScript errors

**Release not creating?**
- Verify `enabled=true` (case-sensitive) in deploy.txt
- Check version format: must be X.Y.Z (e.g., 3.0.12)
- View release workflow logs for specific error

---

## Related Documentation

- **Workflow Documentation:** `../CI-CD-WORKFLOW.md`
- **Setup Instructions:** `../SETUP.md`
- **Main Project README:** `../../README.md`

