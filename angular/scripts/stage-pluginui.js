/**
 * stage-pluginui.js — Build TypeScript tasks and stage artifacts into the PluginsUI output directory.
 *
 * Modeled after package-vsix.js. Both scripts share the same compiled dist/ output;
 * this one stages the artifacts for PluginsUI.exe instead of packaging a VSIX.
 *
 * Steps:
 *   1. npm install         (only when node_modules is absent — first-time setup)
 *   2. npm run build       (tsc incremental — skips unchanged files, fast on rebuild)
 *   3. Per-task copy       (index.js + dist/) into <outputDir>/<TaskName>/
 *                           Only files newer than the destination are copied.
 *   4. node_modules sync   (robocopy /XO — mirrors only new/updated files)
 *
 * Usage:
 *   node scripts/stage-pluginui.js <outputDir>
 *
 * MSBuild usage (PluginsUI.csproj):
 *   <Exec Command="node &quot;scripts/stage-pluginui.js&quot; &quot;$(OutputPath)&quot;"
 *         WorkingDirectory="$(AngularRoot)" />
 *
 * Skip the build step (dist/ already current):
 *   node scripts/stage-pluginui.js <outputDir> --skip-build
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const { execSync, spawnSync } = require('child_process');

// ── Argument parsing ─────────────────────────────────────────────────────────

const args      = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');

// Strip any accidental trailing backslash or quote that Windows shell quoting
// can introduce when a path ending in \ is wrapped in double-quotes (path\" → path").
const rawOutputDir = args.find(a => !a.startsWith('--')) ?? '';
const outputDir = rawOutputDir.replace(/[/\\\"]+$/, '');

if (!outputDir) {
    console.error('Error: output directory argument is required.');
    console.error('Usage: node scripts/stage-pluginui.js <outputDir> [--skip-build]');
    process.exit(1);
}

// ── Constants ────────────────────────────────────────────────────────────────

const ROOT      = path.resolve(__dirname, '..');          // angular/
const SHARED_NM = path.join(ROOT, 'node_modules');
const TASK_DIRS = ['LreCiTask', 'LreWorkspaceSyncTask', 'LreDownloadScriptsTask'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
    console.log(`\n> ${cmd}`);
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

/**
 * Recursively copy files from src → dest, skipping files where the destination
 * is already up-to-date (mtime of dest >= mtime of src).
 * Returns { copied, skipped } counts.
 */
function syncNewerFiles(src, dest) {
    let copied = 0, skipped = 0;
    if (!fs.existsSync(src)) return { copied, skipped };

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath  = path.join(src,  entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            const sub = syncNewerFiles(srcPath, destPath);
            copied  += sub.copied;
            skipped += sub.skipped;
        } else {
            const srcMtime  = fs.statSync(srcPath).mtimeMs;
            const destMtime = fs.existsSync(destPath) ? fs.statSync(destPath).mtimeMs : 0;
            if (srcMtime > destMtime) {
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.copyFileSync(srcPath, destPath);
                copied++;
            } else {
                skipped++;
            }
        }
    }
    return { copied, skipped };
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('=== LRE PluginsUI staging ===\n');
console.log(`  Output directory : ${outputDir}`);
console.log(`  Skip build       : ${skipBuild}\n`);

// 1. Install dependencies (only when node_modules is absent)
if (!fs.existsSync(SHARED_NM)) {
    console.log('node_modules not found — running npm install...');
    run('npm install');
}

// 2. Build (tsc incremental — skips unchanged files automatically via .tsbuildinfo)
if (!skipBuild) {
    run('npm run build');
} else {
    console.log('\n[--skip-build] Skipping TypeScript compilation.');
}

// 3. Copy per-task artifacts (index.js + dist/)
console.log('\n--- Staging task artifacts ---');
for (const taskDir of TASK_DIRS) {
    const srcTask  = path.join(ROOT, taskDir);
    const destTask = path.join(outputDir, taskDir);
    const indexSrc = path.join(srcTask, 'index.js');

    if (!fs.existsSync(indexSrc)) {
        console.log(`  [skip] ${taskDir} — index.js not found (not built yet?)`);
        continue;
    }

    process.stdout.write(`  ${taskDir}  ...  `);
    fs.mkdirSync(destTask, { recursive: true });

    // Copy index.js if newer
    let taskCopied = 0, taskSkipped = 0;
    const indexDest    = path.join(destTask, 'index.js');
    const indexSrcMt   = fs.statSync(indexSrc).mtimeMs;
    const indexDestMt  = fs.existsSync(indexDest) ? fs.statSync(indexDest).mtimeMs : 0;
    if (indexSrcMt > indexDestMt) {
        fs.copyFileSync(indexSrc, indexDest);
        taskCopied++;
    } else {
        taskSkipped++;
    }

    // Sync dist/
    const distResult = syncNewerFiles(
        path.join(srcTask, 'dist'),
        path.join(destTask, 'dist')
    );
    taskCopied  += distResult.copied;
    taskSkipped += distResult.skipped;

    console.log(`${taskCopied} file(s) updated, ${taskSkipped} up-to-date`);
}

// 4. Mirror shared node_modules → outputDir/node_modules (robocopy /XO skips older-dest files)
console.log('\n--- Syncing node_modules ---');
if (fs.existsSync(SHARED_NM)) {
    const destNm = path.join(outputDir, 'node_modules');
    // robocopy exit codes: 0 = no change, 1 = files copied, >=8 = error
    const result = spawnSync(
        'robocopy',
        [SHARED_NM, destNm, '/E', '/XO', '/NFL', '/NDL', '/NJH', '/NJS', '/nc', '/ns', '/np'],
        { stdio: 'inherit' }
    );
    if (result.status >= 8) {
        console.error(`\nrobocopy failed with exit code ${result.status}`);
        process.exit(1);
    }
    console.log('node_modules synced.');
} else {
    console.warn('  [warning] Shared node_modules not found — skipping.');
}

console.log('\n=== Staging complete ===');

