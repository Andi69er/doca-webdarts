# DOCA Online Dart - Deployment Script
# Dieses Script hilft dir beim Deployment auf Render

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DOCA Online Dart - Deployment Helper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Prüfe, ob Git installiert ist
Write-Host "[1/6] Prüfe Git-Installation..." -ForegroundColor Yellow
$gitCheck = git --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Git gefunden: $gitCheck" -ForegroundColor Green
} else {
    Write-Host "✗ Git ist nicht installiert!" -ForegroundColor Red
    Write-Host "Bitte installiere Git von https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

# Prüfe, ob wir in einem Git-Repository sind
Write-Host ""
Write-Host "[2/6] Prüfe Git-Repository..." -ForegroundColor Yellow
if (Test-Path .git) {
    Write-Host "✓ Git-Repository gefunden" -ForegroundColor Green
} else {
    Write-Host "⚠ Git-Repository nicht gefunden. Initialisiere..." -ForegroundColor Yellow
    git init 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Git-Repository initialisiert" -ForegroundColor Green
    } else {
        Write-Host "✗ Fehler beim Initialisieren" -ForegroundColor Red
        exit 1
    }
}

# Prüfe Git-Status
Write-Host ""
Write-Host "[3/6] Prüfe Änderungen..." -ForegroundColor Yellow
$status = git status --porcelain 2>&1
if ($status -and $LASTEXITCODE -eq 0) {
    Write-Host "✓ Änderungen gefunden:" -ForegroundColor Green
    git status --short
} else {
    Write-Host "⚠ Keine Änderungen zum Committen" -ForegroundColor Yellow
}

# Füge alle Dateien hinzu
Write-Host ""
Write-Host "[4/6] Füge Dateien hinzu..." -ForegroundColor Yellow
git add . 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Alle Dateien hinzugefügt" -ForegroundColor Green
} else {
    Write-Host "⚠ Fehler beim Hinzufügen von Dateien" -ForegroundColor Yellow
}

# Committe Änderungen
Write-Host ""
Write-Host "[5/6] Committe Änderungen..." -ForegroundColor Yellow
$commitMessage = "DOCA Online Dart - Ready for deployment"
$commitOutput = git commit -m $commitMessage 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Änderungen committed" -ForegroundColor Green
} else {
    if ($commitOutput -match "nothing to commit") {
        Write-Host "⚠ Keine neuen Änderungen zum Committen" -ForegroundColor Yellow
    } else {
        Write-Host "⚠ Fehler beim Committen" -ForegroundColor Yellow
    }
}

# Prüfe Remote-Repository
Write-Host ""
Write-Host "[6/6] Prüfe Remote-Repository..." -ForegroundColor Yellow
$remote = git remote get-url origin 2>&1
if ($LASTEXITCODE -eq 0 -and $remote) {
    Write-Host "✓ Remote-Repository gefunden: $remote" -ForegroundColor Green
} else {
    Write-Host "⚠ Kein Remote-Repository konfiguriert!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Bitte füge dein GitHub-Repository hinzu:" -ForegroundColor Cyan
    Write-Host "  git remote add origin https://github.com/DEIN-USERNAME/DEIN-REPO.git" -ForegroundColor White
    Write-Host ""
    $addRemote = Read-Host "Möchtest du jetzt ein Remote-Repository hinzufügen? (j/n)"
    if ($addRemote -eq "j" -or $addRemote -eq "J" -or $addRemote -eq "y" -or $addRemote -eq "Y") {
        $repoUrl = Read-Host "GitHub Repository URL eingeben"
        git remote add origin $repoUrl 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Remote-Repository hinzugefügt" -ForegroundColor Green
        } else {
            Write-Host "✗ Fehler beim Hinzufügen des Remote-Repositorys" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⚠ Bitte füge später manuell ein Remote-Repository hinzu" -ForegroundColor Yellow
        exit 0
    }
}

# Prüfe Branch
Write-Host ""
Write-Host "Prüfe Branch..." -ForegroundColor Yellow
$branchOutput = git branch --show-current 2>&1
if ($LASTEXITCODE -eq 0 -and $branchOutput) {
    $currentBranch = $branchOutput.Trim()
    if ($currentBranch -eq "main") {
        Write-Host "✓ Branch: main" -ForegroundColor Green
    } elseif ($currentBranch -eq "master") {
        Write-Host "⚠ Branch: master (empfohlen: main)" -ForegroundColor Yellow
        $switchBranch = Read-Host "Zu 'main' wechseln? (j/n)"
        if ($switchBranch -eq "j" -or $switchBranch -eq "J" -or $switchBranch -eq "y" -or $switchBranch -eq "Y") {
            git branch -M main 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Zu 'main' gewechselt" -ForegroundColor Green
                $currentBranch = "main"
            }
        }
    } else {
        Write-Host "⚠ Unbekannter Branch: $currentBranch" -ForegroundColor Yellow
        $newBranch = Read-Host "Branch-Name eingeben (Enter für 'main')"
        if ([string]::IsNullOrWhiteSpace($newBranch)) {
            $currentBranch = "main"
        } else {
            $currentBranch = $newBranch
        }
    }
} else {
    Write-Host "⚠ Kein Branch gefunden, verwende 'main'" -ForegroundColor Yellow
    $currentBranch = "main"
    git branch -M main 2>&1 | Out-Null
}

# Pushe zu GitHub
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bereit zum Pushen!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
$push = Read-Host "Möchtest du jetzt zu GitHub pushen? (j/n)"
if ($push -eq "j" -or $push -eq "J" -or $push -eq "y" -or $push -eq "Y") {
    Write-Host ""
    Write-Host "Pushe zu GitHub..." -ForegroundColor Yellow
    $pushOutput = git push -u origin $currentBranch 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Erfolgreich zu GitHub gepusht!" -ForegroundColor Green
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "  Nächste Schritte:" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "1. Gehe zu https://render.com" -ForegroundColor White
        Write-Host "2. Klicke auf 'New +' -> 'Web Service'" -ForegroundColor White
        Write-Host "3. Verbinde dein GitHub Repository" -ForegroundColor White
        Write-Host "4. Render erkennt automatisch die render.yaml" -ForegroundColor White
        Write-Host "5. Klicke auf 'Create Web Service'" -ForegroundColor White
        Write-Host ""
        Write-Host "Viel Erfolg! 🚀" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "✗ Fehler beim Pushen!" -ForegroundColor Red
        Write-Host "Ausgabe: $pushOutput" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Mögliche Ursachen:" -ForegroundColor Yellow
        Write-Host "- Keine Berechtigung für das Repository" -ForegroundColor Yellow
        Write-Host "- Repository existiert nicht auf GitHub" -ForegroundColor Yellow
        Write-Host "- Falsche Remote-URL" -ForegroundColor Yellow
        Write-Host "- Benötigt Personal Access Token statt Passwort" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Bitte prüfe die Fehlermeldung oben." -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "Du kannst später pushen mit:" -ForegroundColor Cyan
    $pushCommand = "git push -u origin " + $currentBranch
    Write-Host "  $pushCommand" -ForegroundColor White
}

Write-Host ""
