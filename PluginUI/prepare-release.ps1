<#
.SYNOPSIS
    Prepares a deployment-ready staging folder for PluginsUI + both angular tasks.
.DESCRIPTION
    Produces a self-contained folder that the WiX installer (PluginsInstaller) can
    package as-is.
    Output layout
    -------------
    <staging>\
      PluginsUI.exe / .dll / runtimeconfig.json ...
      node_modules\          PRODUCTION deps ONLY (~6-10 MB, shared by both tasks)
      LreCiTask\
        index.js               bootstrap (polyfills + loads dist)
        dist\                  compiled TypeScript output
          LreCiTask\index.js
          src\...
      LreWorkspaceSyncTask\
        index.js               bootstrap
        dist\
          LreWorkspaceSyncTask\index.js
          src\...
      Scripts\
        test-connection.js
        run-lre-task.ps1
        run-workspace-sync.ps1
      Assets\
        pc-logo.png  qicon.png  PC.ico  ...
    NOTE: The full dev node_modules (TypeScript, ESLint, ...) is NEVER
    copied -- only runtime packages are installed via "npm ci --omit=dev"
    from the single angular/ project root.
.PARAMETER StagingDir
    Output folder.  Defaults to PluginUI\staging\.
.PARAMETER Configuration
    MSBuild configuration (Debug | Release).  Defaults to Release.
.PARAMETER SkipAngularBuild
    Skip "npm run build" -- use the existing dist\ from the source tree.
.PARAMETER FromVsix
    Extract dist\ + bootstrap index.js for both tasks from a .vsix.
    Faster when a published .vsix already exists.
    node_modules are still installed lean from the angular/ root.
.PARAMETER VsixPath
    Full path to the .vsix.  Only used with -FromVsix.
    Defaults to the latest .vsix found in <repoRoot>\Extension\.
.EXAMPLE
    # Full build from source (default)
    .\prepare-release.ps1
    # Reuse existing dist\ in the source tree (skip npm run build)
    .\prepare-release.ps1 -SkipAngularBuild
    # Extract dist\ + bootstrap from the latest published .vsix
    .\prepare-release.ps1 -FromVsix
    # Extract dist\ from a specific .vsix
    .\prepare-release.ps1 -FromVsix -VsixPath "C:\builds\Micro-Focus.PCIntegration-3.1.0.vsix"
    # Custom staging folder
    .\prepare-release.ps1 -StagingDir C:\Installer\payload
#>
param(
    [string]$StagingDir      = "",
    [string]$Configuration   = "Release",
    [switch]$SkipAngularBuild,
    [switch]$FromVsix,
    [string]$VsixPath        = ""
)
$ErrorActionPreference = "Stop"
# ---- Resolve paths -----------------------------------------------------------
$repoRoot        = Split-Path $PSScriptRoot -Parent
$pluginUiDir     = $PSScriptRoot
$angularRoot     = Join-Path $repoRoot "angular"                # single npm project root
$angularCiTask   = Join-Path $angularRoot "LreCiTask"           # task manifest + bootstrap
$angularSyncTask = Join-Path $angularRoot "LreWorkspaceSyncTask"
$pluginsUiProj   = Join-Path $pluginUiDir "PluginsUI"
$extensionDir    = Join-Path $repoRoot "Extension"
if ([string]::IsNullOrWhiteSpace($StagingDir)) {
    $StagingDir = Join-Path $pluginUiDir "staging"
}
# Resolve VSIX: prefer explicit path, else find the latest .vsix in Extension\
if ([string]::IsNullOrWhiteSpace($VsixPath) -or -not (Test-Path $VsixPath)) {
    $latest = Get-ChildItem $extensionDir -Filter "*.vsix" -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1
    if ($latest) { $VsixPath = $latest.FullName }
}
# Sub-task directories inside staging
$stagingCi   = Join-Path $StagingDir "LreCiTask"
$stagingSync = Join-Path $StagingDir "LreWorkspaceSyncTask"
Write-Host ""
Write-Host "=== PluginsUI Release Staging ===" -ForegroundColor Cyan
Write-Host "  Repo root         : $repoRoot"
Write-Host "  Angular root      : $angularRoot"
Write-Host "  Staging dir       : $StagingDir"
Write-Host "  Configuration     : $Configuration"
if ($FromVsix) { Write-Host "  Source            : VSIX  -->  $VsixPath" -ForegroundColor Yellow }
Write-Host ""
# ---- Clean staging -----------------------------------------------------------
if (Test-Path $StagingDir) {
    Write-Host "Cleaning previous staging folder..." -ForegroundColor Yellow
    Remove-Item $StagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null
New-Item -ItemType Directory -Path $stagingCi   -Force | Out-Null
New-Item -ItemType Directory -Path $stagingSync -Force | Out-Null
# ---- Helper: extract a task's dist\ + bootstrap index.js from the VSIX ------
function Extract-TaskFromVsix {
    param(
        [System.IO.Compression.ZipArchive]$Zip,
        [string]$TaskName,
        [string]$DestDir
    )
    $distPrefix    = "$TaskName/dist/"
    $bootstrapName = "$TaskName/index.js"
    $distDst       = Join-Path $DestDir "dist"
    New-Item -ItemType Directory -Path $distDst -Force | Out-Null
    $extracted = 0
    foreach ($entry in $Zip.Entries) {
        if ($entry.FullName.EndsWith('/')) { continue }
        if ($entry.FullName -eq $bootstrapName) {
            $targetPath = Join-Path $DestDir "index.js"
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetPath, $true)
            $extracted++
            continue
        }
        if ($entry.FullName -notmatch "^$distPrefix") { continue }
        $relative   = $entry.FullName -replace "^$distPrefix", ''
        $targetPath = Join-Path $distDst ($relative -replace '/', '\')
        $targetDir  = Split-Path $targetPath -Parent
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetPath, $true)
        $extracted++
    }
    return $extracted
}
# ---- Step 1: Obtain dist\ + bootstrap for both tasks -------------------------
Write-Host "Step 1 -- Obtaining dist\ + bootstrap for both tasks..." -ForegroundColor Yellow
if ($FromVsix) {
    if (-not (Test-Path $VsixPath)) { throw "VSIX not found: $VsixPath" }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($VsixPath)
    $nCi   = Extract-TaskFromVsix -Zip $zip -TaskName "LreCiTask"            -DestDir $stagingCi
    $nSync = Extract-TaskFromVsix -Zip $zip -TaskName "LreWorkspaceSyncTask"  -DestDir $stagingSync
    $zip.Dispose()
    if ($nCi   -eq 0) { throw "No LreCiTask files found in VSIX: $VsixPath" }
    if ($nSync -eq 0) { throw "No LreWorkspaceSyncTask files found in VSIX: $VsixPath" }
    Write-Host "  OK  LreCiTask: $nCi files extracted from VSIX." -ForegroundColor Green
    Write-Host "  OK  LreWorkspaceSyncTask: $nSync files extracted from VSIX." -ForegroundColor Green
} elseif ($SkipAngularBuild) {
    foreach ($pair in @(
        @{ Task = "LreCiTask";            Src = $angularCiTask;   Dst = $stagingCi   },
        @{ Task = "LreWorkspaceSyncTask"; Src = $angularSyncTask; Dst = $stagingSync }
    )) {
        $distSrc = Join-Path $pair.Src "dist"
        if (-not (Test-Path $distSrc)) {
            throw "dist\ not found: $distSrc`nRun: cd angular && npm install && npm run build"
        }
        Copy-Item $distSrc (Join-Path $pair.Dst "dist") -Recurse -Force
        Copy-Item (Join-Path $pair.Src "index.js") (Join-Path $pair.Dst "index.js") -Force
        Write-Host "  OK  $($pair.Task) dist\ + bootstrap copied from source tree." -ForegroundColor Green
    }
} else {
    Write-Host "  Building both tasks from angular/ root..." -ForegroundColor DarkGray
    Push-Location $angularRoot
    try {
        npm install 2>&1 | Out-Null
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed (exit $LASTEXITCODE)" }
    } finally { Pop-Location }
    foreach ($pair in @(
        @{ Task = "LreCiTask";            Src = $angularCiTask;   Dst = $stagingCi   },
        @{ Task = "LreWorkspaceSyncTask"; Src = $angularSyncTask; Dst = $stagingSync }
    )) {
        Copy-Item (Join-Path $pair.Src "dist")     (Join-Path $pair.Dst "dist")     -Recurse -Force
        Copy-Item (Join-Path $pair.Src "index.js") (Join-Path $pair.Dst "index.js") -Force
        Write-Host "  OK  $($pair.Task) built and staged." -ForegroundColor Green
    }
}
# ---- Step 2: Build PluginsUI (.NET) ------------------------------------------
Write-Host ""
Write-Host "Step 2 -- Building PluginsUI (dotnet publish)..." -ForegroundColor Yellow
$publishDir = Join-Path $StagingDir "_dotnet_publish"
dotnet publish $pluginsUiProj `
    --configuration $Configuration `
    --output $publishDir `
    --self-contained false `
    /p:DebugType=None /p:DebugSymbols=false /p:SkipInstallerBuild=true /p:SkipAngularCopy=true 2>&1
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed (exit $LASTEXITCODE)" }
Write-Host "  OK  PluginsUI published." -ForegroundColor Green
Write-Host "  Copying .NET binaries to staging root..." -ForegroundColor DarkGray
Get-ChildItem $publishDir -File | Copy-Item -Destination $StagingDir
foreach ($sub in @("Assets", "Scripts")) {
    $src = Join-Path $publishDir $sub
    if (Test-Path $src) { Copy-Item $src (Join-Path $StagingDir $sub) -Recurse -Force }
}
Remove-Item $publishDir -Recurse -Force
# ---- Step 3: Install shared production node_modules -------------------------
#  The angular/ directory is the single npm project root.
#  One "npm ci --omit=dev" covers all runtime deps for both tasks.
#  Node.js walks up from LreCiTask/dist/ and LreWorkspaceSyncTask/dist/ to
#  find the shared node_modules/ at the staging root.
Write-Host ""
Write-Host "Step 3 -- Installing shared production node_modules (npm ci --omit=dev)..." -ForegroundColor Yellow
Write-Host "  Dev tools (TypeScript, ESLint, esbuild, ...) are excluded." -ForegroundColor DarkGray
$nodeModulesDst = Join-Path $StagingDir "node_modules"
# Run npm ci in a temp dir so the source tree is not modified
$tmpNpm = Join-Path $StagingDir "_npm_ci_tmp"
New-Item -ItemType Directory -Path $tmpNpm -Force | Out-Null
Copy-Item (Join-Path $angularRoot "package.json")      $tmpNpm -Force
Copy-Item (Join-Path $angularRoot "package-lock.json") $tmpNpm -Force
Push-Location $tmpNpm
try {
    npm ci --omit=dev 2>&1
    if ($LASTEXITCODE -ne 0) { throw "npm ci --omit=dev failed (exit $LASTEXITCODE)" }
} finally { Pop-Location }
Copy-Item (Join-Path $tmpNpm "node_modules") $nodeModulesDst -Recurse -Force
Remove-Item $tmpNpm -Recurse -Force
Write-Host "  OK  Shared node_modules installed at staging root." -ForegroundColor Green
# ---- Report ------------------------------------------------------------------
Write-Host ""
Write-Host "=== Staging complete! ===" -ForegroundColor Green
Write-Host ""
function Get-DirSizeMB($path) {
    if (-not (Test-Path $path)) { return 0.0 }
    (Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue |
        Measure-Object Length -Sum).Sum / 1MB
}
$items = @(
    @{ Name = "LreCiTask\index.js";         Path = (Join-Path $stagingCi   "index.js") }
    @{ Name = "LreCiTask\dist\";            Path = (Join-Path $stagingCi   "dist") }
    @{ Name = "LreWSSyncTask\index.js";     Path = (Join-Path $stagingSync "index.js") }
    @{ Name = "LreWSSyncTask\dist\";        Path = (Join-Path $stagingSync "dist") }
    @{ Name = "node_modules\ (shared)";     Path = $nodeModulesDst }
    @{ Name = "Scripts\";                   Path = (Join-Path $StagingDir  "Scripts") }
    @{ Name = "Assets\";                    Path = (Join-Path $StagingDir  "Assets") }
    @{ Name = "PluginsUI.exe";              Path = (Join-Path $StagingDir  "PluginsUI.exe") }
)
foreach ($i in $items) {
    $mb = if (Test-Path $i.Path) {
        (Get-ChildItem $i.Path -Recurse -EA SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB
    } else { 0.0 }
    Write-Host ("  {0,-34} {1,6:N1} MB" -f $i.Name, $mb)
}
$totalMB = (Get-ChildItem $StagingDir -Recurse | Measure-Object Length -Sum).Sum / 1MB
Write-Host ""
Write-Host ("  {0,-34} {1,6:N1} MB  <-- total installer payload" -f "TOTAL", $totalMB) -ForegroundColor Cyan
Write-Host ""
Write-Host "  Staging folder : $StagingDir"
Write-Host ""
Write-Host "  Prerequisites on the target machine:"
Write-Host "    .NET 10 Desktop Runtime  (winget install Microsoft.DotNet.DesktopRuntime.10)"
Write-Host "    Node.js >= 20            (winget install OpenJS.NodeJS.LTS)"
Write-Host ""
