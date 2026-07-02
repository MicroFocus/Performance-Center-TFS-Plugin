#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Validates the release/deploy.txt file format
.DESCRIPTION
    This script validates that the release/deploy.txt file has the correct format
    before pushing changes to trigger the release workflow.
#>

$deployFile = "release/deploy.txt"

if (-not (Test-Path $deployFile)) {
    Write-Host "❌ Error: $deployFile not found!" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Validating $deployFile..." -ForegroundColor Yellow

$content = Get-Content $deployFile -Raw
$lines = Get-Content $deployFile

$enabledFound = $false
$versionFound = $false
$enabled = $null
$version = $null

foreach ($line in $lines) {
    if ($line -match '^enabled=') {
        $enabledFound = $true
        $enabled = ($line -split '=', 2)[1].Trim()
    }
    if ($line -match '^version=') {
        $versionFound = $true
        $version = ($line -split '=', 2)[1].Trim()
    }
}

Write-Host ""

if (-not $enabledFound) {
    Write-Host "❌ Error: 'enabled' property not found" -ForegroundColor Red
    exit 1
}
else {
    Write-Host "✅ enabled = $enabled" -ForegroundColor Green
}

if (-not $versionFound) {
    Write-Host "❌ Error: 'version' property not found" -ForegroundColor Red
    exit 1
}
else {
    Write-Host "✅ version = $version" -ForegroundColor Green
}

# Validate version format
if ($version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "❌ Error: Version '$version' is not in semantic versioning format (X.Y.Z)" -ForegroundColor Red
    exit 1
}
else {
    Write-Host "✅ Version format is valid (semantic versioning)" -ForegroundColor Green
}

# Validate enabled value
if ($enabled -notmatch '^(true|false)$') {
    Write-Host "❌ Error: 'enabled' must be 'true' or 'false', got '$enabled'" -ForegroundColor Red
    exit 1
}
else {
    Write-Host "✅ Enabled value is valid" -ForegroundColor Green
}

Write-Host ""
if ($enabled -eq "true") {
    Write-Host "⚠️  WARNING: Release is enabled! When you push this file, a release will be created." -ForegroundColor Yellow
    Write-Host "   Version: $version" -ForegroundColor Yellow
}
else {
    Write-Host "ℹ️  Release is disabled (enabled=false)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "✅ All validations passed!" -ForegroundColor Green
exit 0

