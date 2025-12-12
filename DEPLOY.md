# 🚀 Schnell-Deployment auf Render

## Schritt 1: Code zu GitHub pushen

```bash
# Falls noch kein Git-Repository initialisiert
git init
git add .
git commit -m "Initial commit - DOCA Online Dart"

# Verbinde mit deinem GitHub Repository
git remote add origin https://github.com/DEIN-USERNAME/DEIN-REPO.git
git push -u origin main
```

## Schritt 2: Auf Render deployen

### Option A: Automatisch mit render.yaml (Empfohlen)

1. Gehe zu https://render.com und logge dich ein
2. Klicke auf **"New +"** → **"Web Service"**
3. Verbinde dein GitHub Repository
4. Render erkennt automatisch die `render.yaml` Datei
5. Klicke auf **"Create Web Service"**
6. Warte auf das Deployment (ca. 5-10 Minuten)

### Option B: Manuell

1. Gehe zu https://render.com und logge dich ein
2. Klicke auf **"New +"** → **"Web Service"**
3. Verbinde dein GitHub Repository
4. Wähle den Branch (meist `main` oder `master`)
5. **Build Command**: 
   ```
   cd backend && npm install && cd ../frontend && npm install && npm run build && cd ../backend
   ```
6. **Start Command**: 
   ```
   cd backend && node index.js
   ```
7. **Environment**: `Node`
8. Klicke auf **"Create Web Service"**

## Schritt 3: Nach dem Deployment

- Die URL wird nach dem Deployment angezeigt (z.B. `https://doca-webdarts.onrender.com`)
- Die Anwendung sollte automatisch verfügbar sein
- Socket.IO funktioniert automatisch über die Render-URL

## Troubleshooting

- **Build-Fehler**: Prüfe die Build-Logs in Render
- **Port-Fehler**: Render weist automatisch einen Port zu (verwende `process.env.PORT`)
- **Socket-Verbindung**: Stelle sicher, dass CORS korrekt konfiguriert ist


