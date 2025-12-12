# 📤 Schritt-für-Schritt: Code zu GitHub pushen

## Schritt 1: GitHub-Repository erstellen

1. **Gehe zu**: https://github.com
2. **Logge dich ein** (oder erstelle einen Account)
3. **Klicke auf**: Das **"+"** Symbol oben rechts → **"New repository"**
4. **Repository-Name eingeben**: z.B. `doca-online-dart`
5. **Beschreibung** (optional): "DOCA Online Dart Application"
6. **WICHTIG**: 
   - ✅ **NICHT** "Initialize with README" ankreuzen
   - ✅ **NICHT** "Add .gitignore" ankreuzen
   - ✅ **NICHT** "Choose a license" auswählen
7. **Klicke auf**: **"Create repository"**
8. **Kopiere die URL** die GitHub dir zeigt (z.B. `https://github.com/DEIN-USERNAME/doca-online-dart.git`)

## Schritt 2: PowerShell im Projektordner öffnen

1. **Öffne PowerShell** (Windows-Taste + X → "Windows PowerShell")
2. **Navigiere zum Projektordner**:
   ```powershell
   cd "C:\Users\andre\OneDrive\Desktop\DOCA LETZTVERSION\neues projekt"
   ```

## Schritt 3: Git initialisieren (falls noch nicht geschehen)

```powershell
git init
```

## Schritt 4: Alle Dateien hinzufügen

```powershell
git add .
```

## Schritt 5: Ersten Commit erstellen

```powershell
git commit -m "DOCA Online Dart - Initial commit"
```

## Schritt 6: GitHub-Repository verbinden

**Ersetze `DEIN-USERNAME` und `doca-online-dart` mit deinen Werten:**

```powershell
git remote add origin https://github.com/DEIN-USERNAME/doca-online-dart.git
```

## Schritt 7: Branch auf "main" setzen

```powershell
git branch -M main
```

## Schritt 8: Zu GitHub pushen

```powershell
git push -u origin main
```

**Falls du nach Benutzername und Passwort gefragt wirst:**
- **Benutzername**: Dein GitHub-Benutzername
- **Passwort**: Verwende ein **Personal Access Token** (siehe unten)

## 🔑 Personal Access Token erstellen (falls nötig)

GitHub akzeptiert keine Passwörter mehr, du brauchst ein Token:

1. **Gehe zu**: https://github.com/settings/tokens
2. **Klicke auf**: **"Generate new token"** → **"Generate new token (classic)"**
3. **Name**: z.B. "Render Deployment"
4. **Ablauf**: Wähle eine Dauer (z.B. 90 Tage)
5. **Berechtigungen**: Aktiviere **"repo"** (alle Repository-Berechtigungen)
6. **Klicke auf**: **"Generate token"**
7. **Kopiere das Token** (wird nur einmal angezeigt!)
8. **Verwende dieses Token** als Passwort beim Push

## ✅ Fertig!

Nach erfolgreichem Push siehst du:
```
Enumerating objects: X, done.
Counting objects: 100% (X/X), done.
...
To https://github.com/DEIN-USERNAME/doca-online-dart.git
 * [new branch]      main -> main
```

## 🚀 Oder: Verwende das automatische Script

Einfacher geht's mit dem Script:

```powershell
.\deploy.ps1
```

Das Script führt dich durch alles!


