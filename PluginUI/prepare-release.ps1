<#
.SYNOPSIS
    Prepares a deployment-ready staging folder for PluginsUI + the LRE angular task.

.DESCRIPTION
    Produces a self-contained folder that an installer (WiX, Inno Setup, etc.)
    can package as-is.

    Output layout
    -------------
    <staging>\
      PluginsUI.exe / .dll / runtimeconfig.json ...
      dist\                  compiled angular task  (~0.1 MB)
        index.js  index.js.map  src\...
      node_modules\          PRODUCTION deps ONLY  (~6.9 MB)
        azure-pipelines-task-lib\  axios\  ...
      package.json           used by npm ci
      package-lock.json
      Scripts\
        test-connection.js
        run-lre-task.ps1
      Assets\
        pc-logo.png  qicon.png  PC.ico  ...

    NOTE: The full dev node_modules (TypeScript, ESLint, Jest, ...) is NEVER
    copied -- only the 6 runtime packages are installed via "npm ci --omit=dev".

.PARAMETER StagingDir
    Output folder.  Defaults to PluginUI\staging\.

.PARAMETER Configuration
    MSBuild configuration (Debug | Release).  Defaults to Release.

.PARAMETER SkipAngularBuild
    Skip "npm run build" -- use the existing dist\ from the source tree.

.PARAMETER FromVsix
    Extract dist\ from the .vsix instead of building from source.
    Faster when a published .vsix already exists.

.PARAMETER VsixPath
    Full path to the .vsix.  Only used with -FromVsix.
    Defaults to angular\out\Micro-Focus.PCIntegration-3.0.0.vsix.

.EXAMPLE
    # Full build from source
    .\prepare-release.ps1

    # Reuse existing dist\ in the source tree
    .\prepare-release.ps1 -SkipAngularBuild

    # Extract dist\ from an existing .vsix  (node_modules still built lean)
    .\prepare-release.ps1 -FromVsix

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
$repoRoot      = Split-Path $PSScriptRoot -Parent
$pluginUiDir   = $PSScriptRoot
$angularTask   = Join-Path $repoRoot "angular\LreCiTask"
$pluginsUiProj = Join-Path $pluginUiDir "PluginsUI"

if ([string]::IsNullOrWhiteSpace($StagingDir)) {
    $StagingDir = Join-Path $pluginUiDir "staging"
}
if ([string]::IsNullOrWhiteSpace($VsixPath)) {
    $VsixPath = [System.IO.Path]::GetFullPath(
        (Join-Path $repoRoot "angular\out\Micro-Focus.PCIntegration-3.0.0.vsix"))
}

Write-Host ""
Write-Host "=== PluginsUI Release Staging ===" -ForegroundColor Cyan
Write-Host "  Repo root    : $repoRoot"
Write-Host "  Angular task : $angularTask"
Write-Host "  PluginsUI    : $pluginsUiProj"
Write-Host "  Staging dir  : $StagingDir"
Write-Host "  Configuration: $Configuration"
if ($FromVsix) { Write-Host "  Source       : VSIX  -->  $VsixPath" -ForegroundColor Yellow }
Write-Host ""

# ---- Clean staging -----------------------------------------------------------
if (Test-Path $StagingDir) {
    Write-Host "Cleaning previous staging folder..." -ForegroundColor Yellow
    Remove-Item $StagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

# ---- Step 1: Obtain dist\ ----------------------------------------------------
if ($FromVsix) {
    Write-Host "Step 1 -- Extracting dist\ from VSIX..." -ForegroundColor Yellow
    if (-not (Test-Path $VsixPath)) {
        throw "VSIX not found: $VsixPath"
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip     = [System.IO.Compression.ZipFile]::OpenRead($VsixPath)
    $distDst = Join-Path $StagingDir "dist"
    New-Item -ItemType Directory -Path $distDst -Force | Out-Null

    $extracted = 0
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -notmatch '^LreCiTask/dist/') { continue }
        if ($entry.FullName.EndsWith('/'))                 { continue }

        $relative   = $entry.FullName -replace '^LreCiTask/dist/', ''
        $targetPath = Join-Path $distDst ($relative -replace '/', '\')
        $targetDir  = Split-Path $targetPath -Parent
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetPath, $true)
        $extracted++
    }
    $zip.Dispose()

    if ($extracted -eq 0) {
        throw "No LreCiTask/dist/ entries found inside the VSIX."
    }
    Write-Host "  OK  Extracted $extracted files from VSIX dist\." -ForegroundColor Green

} elseif ($SkipAngularBuild) {
    Write-Host "Step 1 -- Skipping build, copying existing dist\ from source tree..." -ForegroundColor Yellow
    $distSrc = Join-Path $angularTask "dist"
    if (-not (Test-Path $distSrc)) {
        throw "dist\ not found at: $distSrc`nRun 'npm run build' in angular\LreCiTask first."
    }
    Copy-Item $distSrc (Join-Path $StagingDir "dist") -Recurse -Force
    Write-Host "  OK  dist\ copied from source tree." -ForegroundColor Green

} else {
    Write-Host "Step 1 -- Building angular task (npm run build)..." -ForegroundColor Yellow
    Push-Location $angularTask
    try {
        npm install 2>&1 | Out-Null
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed (exit $LASTEXITCODE)" }
    } finally { Pop-Location }
    Copy-Item (Join-Path $angularTask "dist") (Join-Path $StagingDir "dist") -Recurse -Force
    Write-Host "  OK  Angular task built and dist\ copied." -ForegroundColor Green
}

# ---- Step 2: Build PluginsUI (.NET) ------------------------------------------
Write-Host ""
Write-Host "Step 2 -- Building PluginsUI (dotnet publish)..." -ForegroundColor Yellow
$publishDir = Join-Path $StagingDir "_dotnet_publish"
dotnet publish $pluginsUiProj `
    --configuration $Configuration `
    --output $publishDir `
    --self-contained false `
    /p:DebugType=None /p:DebugSymbols=false /p:SkipInstallerBuild=true 2>&1
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed (exit $LASTEXITCODE)" }
Write-Host "  OK  PluginsUI published." -ForegroundColor Green

Write-Host "  Copying .NET binaries to staging root..." -ForegroundColor DarkGray
Get-ChildItem $publishDir -File | Copy-Item -Destination $StagingDir
foreach ($sub in @("Assets", "Scripts")) {
    $src = Join-Path $publishDir $sub
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $StagingDir $sub) -Recurse -Force
    }
}
Remove-Item $publishDir -Recurse -Force

# ---- Step 3: Install production-only node_modules ---------------------------
Write-Host ""
Write-Host "Step 3 -- Installing production node_modules (npm ci --omit=dev)..." -ForegroundColor Yellow
Write-Host "  Installs only the 6 runtime packages (~6.9 MB); dev tools excluded." -ForegroundColor DarkGray

Copy-Item (Join-Path $angularTask "package.json")      $StagingDir -Force
Copy-Item (Join-Path $angularTask "package-lock.json") $StagingDir -Force

Push-Location $StagingDir
try {
    npm ci --omit=dev 2>&1
    if ($LASTEXITCODE -ne 0) { throw "npm ci --omit=dev failed (exit $LASTEXITCODE)" }
} finally { Pop-Location }
Write-Host "  OK  Production node_modules installed." -ForegroundColor Green

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
    @{ Name = "dist\";         Path = (Join-Path $StagingDir "dist") }
    @{ Name = "node_modules\"; Path = (Join-Path $StagingDir "node_modules") }
    @{ Name = "Scripts\";      Path = (Join-Path $StagingDir "Scripts") }
    @{ Name = "Assets\";       Path = (Join-Path $StagingDir "Assets") }
    @{ Name = "PluginsUI.exe"; Path = (Join-Path $StagingDir "PluginsUI.exe") }
)
foreach ($i in $items) {
    $mb = if (Test-Path $i.Path) {
        (Get-ChildItem $i.Path -Recurse -EA SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB
    } else { 0.0 }
    Write-Host ("  {0,-18} {1,6:N1} MB" -f $i.Name, $mb)
}
$totalMB = (Get-ChildItem $StagingDir -Recurse | Measure-Object Length -Sum).Sum / 1MB
Write-Host ""
Write-Host ("  {0,-18} {1,6:N1} MB  <-- total installer payload" -f "TOTAL", $totalMB) -ForegroundColor Cyan
Write-Host ""
Write-Host "  Staging folder : $StagingDir"
Write-Host ""
Write-Host "  Prerequisites on the target machine:"
Write-Host "    .NET 8 Desktop Runtime  (winget install Microsoft.DotNet.DesktopRuntime.8)"
Write-Host "    Node.js >= 20           (winget install OpenJS.NodeJS.LTS)"
Write-Host ""

