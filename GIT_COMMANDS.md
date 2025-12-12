# Git-Befehle für Deployment

## ⚠️ Wichtig: Prüfe zuerst, ob Git initialisiert ist

```powershell
git status
```

Falls du eine Fehlermeldung bekommst, musst du zuerst initialisieren:

```powershell
git init
```

## 📝 Schritt-für-Schritt (Empfohlen)

### 1. Status prüfen
```powershell
git status
```

### 2. Alle Änderungen hinzufügen
```powershell
git add .
```

### 3. Committen
```powershell
git commit -m "DOCA Online Dart - Ready for deployment"
```

### 4. Remote-Repository verbinden (nur beim ersten Mal)
```powershell
git remote add origin https://github.com/DEIN-USERNAME/DEIN-REPO.git
```

### 5. Branch setzen (falls nötig)
```powershell
git branch -M main
```

### 6. Pushen
```powershell
git push -u origin main
```

## 🚀 Alles in einem (wenn bereits initialisiert)

```powershell
git status; git add .; git commit -m "DOCA Online Dart - Ready for deployment"; git push origin main
```

## ⚠️ Häufige Fehler

1. **"fatal: not a git repository"**
   - Lösung: `git init` ausführen

2. **"fatal: remote origin already exists"**
   - Lösung: `git remote remove origin` dann neu hinzufügen

3. **"error: failed to push"**
   - Lösung: Prüfe, ob das GitHub-Repository existiert und du die Berechtigung hast

4. **"error: src refspec main does not match any"**
   - Lösung: Erst einen Commit machen, dann pushen


