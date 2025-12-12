# 🚀 Schnellstart - Deployment

## Einfachste Methode: PowerShell-Script verwenden

1. **Öffne PowerShell** im Projektordner:
   ```powershell
   cd "C:\Users\andre\OneDrive\Desktop\DOCA LETZTVERSION\neues projekt"
   ```

2. **Führe das Script aus**:
   ```powershell
   .\deploy.ps1
   ```

3. **Folge den Anweisungen** - Das Script führt dich durch alles!

## Alternative: Manuelle Befehle

Falls du das Script nicht verwenden möchtest:

```powershell
# 1. Status prüfen
git status

# 2. Alles hinzufügen
git add .

# 3. Committen
git commit -m "DOCA Online Dart - Ready for deployment"

# 4. Pushen (falls Remote bereits konfiguriert)
git push origin main
```

## Wichtig beim ersten Mal:

Falls noch kein GitHub-Repository verbunden ist:

```powershell
git init
git remote add origin https://github.com/DEIN-USERNAME/DEIN-REPO.git
git branch -M main
```

## Nach dem Push zu GitHub:

1. Gehe zu https://render.com
2. "New +" → "Web Service"
3. GitHub Repository verbinden
4. Render erkennt automatisch die `render.yaml`
5. "Create Web Service" klicken
6. Fertig! 🎉


