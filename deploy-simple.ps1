# Einfaches Deployment Script
Write-Host "DOCA Online Dart - Einfaches Deployment" -ForegroundColor Cyan
Write-Host ""

# Git initialisieren
if (-not (Test-Path .git)) {
    Write-Host "Initialisiere Git..." -ForegroundColor Yellow
    git init
}

# Dateien hinzufügen
Write-Host "Fuege Dateien hinzu..." -ForegroundColor Yellow
git add .

# Committen
Write-Host "Committte Aenderungen..." -ForegroundColor Yellow
git commit -m "DOCA Online Dart - Ready for deployment"

# Remote prüfen
$remote = git remote get-url origin 2>$null
if (-not $remote) {
    Write-Host ""
    Write-Host "Kein GitHub-Repository verbunden!" -ForegroundColor Yellow
    $repoUrl = Read-Host "GitHub Repository URL eingeben (z.B. https://github.com/USERNAME/REPO.git)"
    git remote add origin $repoUrl
}

# Branch setzen
git branch -M main 2>$null

# Pushen
Write-Host ""
Write-Host "Pushe zu GitHub..." -ForegroundColor Yellow
git push -u origin main

Write-Host ""
Write-Host "Fertig! Gehe jetzt zu https://render.com" -ForegroundColor Green


