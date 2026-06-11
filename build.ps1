# Build script for Google Apps Script Web App Deployment
# This script combines index.html, style.css, and app.js into a single gas_deploy.html file.

$indexFile = Join-Path $PSScriptRoot "index.html"
$cssFile = Join-Path $PSScriptRoot "style.css"
$jsFile = Join-Path $PSScriptRoot "app.js"
$outputFile = Join-Path $PSScriptRoot "gas_deploy.html"

if (-not (Test-Path $indexFile)) {
    Write-Error "index.html not found!"
    Exit 1
}
if (-not (Test-Path $cssFile)) {
    Write-Error "style.css not found!"
    Exit 1
}
if (-not (Test-Path $jsFile)) {
    Write-Error "app.js not found!"
    Exit 1
}

Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Building Store Pro single-page file for Google Apps Script..." -ForegroundColor Cyan
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan

# Read contents
$indexContent = [System.IO.File]::ReadAllText($indexFile, [System.Text.Encoding]::UTF8)
$cssContent = [System.IO.File]::ReadAllText($cssFile, [System.Text.Encoding]::UTF8)
$jsContent = [System.IO.File]::ReadAllText($jsFile, [System.Text.Encoding]::UTF8)

# Inline CSS
Write-Host "Inlining style.css..." -ForegroundColor Yellow
$cssTag = "<style>`n$cssContent`n</style>"
$indexContent = $indexContent.Replace('<link rel="stylesheet" href="style.css">', $cssTag)

# Inline JS
Write-Host "Inlining app.js..." -ForegroundColor Yellow
$jsTag = "<script>`n$jsContent`n</script>"
$indexContent = $indexContent.Replace('<script src="app.js"></script>', $jsTag)

# Write output file
Write-Host "Writing compiled output to gas_deploy.html..." -ForegroundColor Yellow
[System.IO.File]::WriteAllText($outputFile, $indexContent, [System.Text.Encoding]::UTF8)

Write-Host "--------------------------------------------------------" -ForegroundColor Green
Write-Host "Build Succeeded! " -ForegroundColor Green -NoNewline
Write-Host "Created: gas_deploy.html" -ForegroundColor White
Write-Host "INSTRUCTIONS:" -ForegroundColor Green
Write-Host "1. Open 'gas_deploy.html' and copy its entire contents." -ForegroundColor White
Write-Host "2. Go to your Google Sheet -> Extensions -> Apps Script." -ForegroundColor White
Write-Host "3. In the Apps Script Editor, click '+' next to Files and select HTML." -ForegroundColor White
Write-Host "4. Name the new file 'index' (it will create 'index.html')." -ForegroundColor White
Write-Host "5. Delete any auto-generated code in 'index.html' and paste the contents you copied." -ForegroundColor White
Write-Host "6. Click 'Deploy' -> 'New Deployment' or 'Manage Deployments' to deploy a new version." -ForegroundColor White
Write-Host "--------------------------------------------------------" -ForegroundColor Green
