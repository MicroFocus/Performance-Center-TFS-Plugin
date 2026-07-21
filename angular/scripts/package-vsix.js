/**
 * package-vsix.js â€” Single-project VSIX packaging helper.
 *
 * The Azure DevOps agent installs each task into its own isolated directory,
 * so the VSIX must bundle node_modules/ inside each task directory.
 * During development we use a single shared node_modules/ at angular/.
 *
 * This script:
 *   1. Ensures devDependencies are installed
 *   2. Builds both tasks so dist/ is current
 *   3. Prunes devDependencies from the shared node_modules/
 *   4. Copies the shared node_modules/ into each task directory
 *      (copy rather than junction â€” tfx does not follow Windows junctions reliably)
 *   5. Runs tfx extension create
 *   6. Removes the per-task copies
 *   7. Restores devDependencies with npm install
 *
 * Run from angular/:  node scripts/package-vsix.js
 * Or via npm script:  npm run package:vsix
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

const ROOT      = path.resolve(__dirname, '..');          // angular/
const SHARED_NM = path.join(ROOT, 'node_modules');
const TASK_DIRS = ['LreCiTask', 'LreWorkspaceSyncTask'];
const TASK_NM   = TASK_DIRS.map(t => path.join(ROOT, t, 'node_modules'));

// Track what this run created so cleanup never deletes pre-existing directories.
const created = new Set();

function run(cmd, opts = {}) {
    console.log(`\n> ${cmd}`);
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

function copyNodeModules(dest) {
    if (fs.existsSync(dest)) {
        console.log(`  already exists (skipping copy): ${path.relative(ROOT, dest)}`);
        return;
    }
    console.log(`  copying â†’ ${path.relative(ROOT, dest)}  (may take a few secondsâ€¦)`);
    fs.cpSync(SHARED_NM, dest, { recursive: true });
    created.add(dest);
    console.log(`  done: ${path.relative(ROOT, dest)}`);
}

function removeNodeModules(dest) {
    if (!created.has(dest)) return;
    console.log(`  removing: ${path.relative(ROOT, dest)}`);
    fs.rmSync(dest, { recursive: true, force: true });
}

// â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

console.log('=== LRE Extension VSIX packaging ===\n');

// 0. Ensure devDependencies are present (guards against an interrupted previous run)
run('npm install');

// 1. Build both tasks so dist/ is current
run('npm run build');

// 2. Prune devDependencies from the shared node_modules
run('npm prune --omit=dev');

// 3. Copy shared node_modules into each task directory
console.log('\nCopying shared node_modules into task directoriesâ€¦');
TASK_NM.forEach(copyNodeModules);

let exitCode = 0;
try {
    // 4. Package the VSIX
    run('tfx extension create --manifest-globs vss-extension.json --output-path ../Extension');
} catch (err) {
    console.error('\nVSIX packaging failed:', err.message);
    exitCode = 1;
} finally {
    // 5. Remove the per-task copies regardless of success/failure
    console.log('\nRemoving per-task node_modules copiesâ€¦');
    TASK_NM.forEach(removeNodeModules);

    // 6. Restore devDependencies
    run('npm install');
}

process.exit(exitCode);
