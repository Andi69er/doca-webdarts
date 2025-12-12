# 🚀 Einfachste Methode: Manuelle Befehle

Falls das Script Probleme macht, verwende einfach diese Befehle **einzeln** in PowerShell:

## Schritt 1: PowerShell öffnen
```powershell
cd "C:\Users\andre\OneDrive\Desktop\DOCA LETZTVERSION\neues projekt"
```

## Schritt 2: Git-Befehle ausführen

**Kopiere jeden Befehl einzeln und drücke Enter:**

```powershell
git init
```

```powershell
git add .
```

```powershell
git commit -m "DOCA Online Dart"
```

```powershell
git remote add origin https://github.com/DEIN-USERNAME/DEIN-REPO.git
```
*(Ersetze DEIN-USERNAME und DEIN-REPO mit deinen Werten)*

```powershell
git branch -M main
```

```powershell
git push -u origin main
```

## Schritt 3: Bei Passwort-Abfrage

- **Benutzername**: Dein GitHub-Benutzername
- **Passwort**: Personal Access Token (nicht dein GitHub-Passwort!)

### Personal Access Token erstellen:
1. Gehe zu: https://github.com/settings/tokens
2. "Generate new token" → "Generate new token (classic)"
3. Name: "Render Deployment"
4. Berechtigungen: **"repo"** aktivieren
5. "Generate token" klicken
6. Token kopieren und als Passwort verwenden

## ✅ Fertig!

Nach erfolgreichem Push:
1. Gehe zu https://render.com
2. "New +" → "Web Service"
3. GitHub Repository verbinden
4. "Create Web Service" klicken


