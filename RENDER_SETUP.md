# Render Deployment Anleitung

## Voraussetzungen
- Render Account (kostenlos verfügbar)
- GitHub Repository mit dem Code

## Deployment-Schritte

### Option 1: Automatisches Deployment mit render.yaml

1. **Repository auf GitHub hochladen**
   - Stelle sicher, dass alle Dateien committed sind
   - Pushe den Code zu GitHub

2. **Neuen Web Service auf Render erstellen**
   - Gehe zu https://render.com
   - Klicke auf "New +" → "Web Service"
   - Verbinde dein GitHub Repository
   - Render erkennt automatisch die `render.yaml` Datei

3. **Umgebungsvariablen (optional)**
   - Falls benötigt, kannst du zusätzliche Umgebungsvariablen in der Render-UI hinzufügen

4. **Deployment starten**
   - Render baut und deployed automatisch
   - Die URL wird nach dem Deployment angezeigt

### Option 2: Manuelles Setup

Falls die `render.yaml` nicht automatisch erkannt wird:

1. **Neuen Web Service erstellen**
   - Gehe zu https://render.com
   - Klicke auf "New +" → "Web Service"
   - Verbinde dein GitHub Repository

2. **Build-Einstellungen**
   - **Build Command**: `cd backend && npm install && cd ../frontend && npm install && npm run build && cd ../backend`
   - **Start Command**: `cd backend && node index.js`
   - **Environment**: `Node`

3. **Umgebungsvariablen**
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (oder automatisch von Render zugewiesen)

4. **Deployment**
   - Klicke auf "Create Web Service"
   - Render baut und deployed automatisch

## Wichtige Hinweise

- Das Backend serviert das gebaute Frontend automatisch
- Stelle sicher, dass `frontend/build` nach dem Build existiert
- Die Socket.IO-Verbindung funktioniert automatisch über die Render-URL

## Troubleshooting

- **Build-Fehler**: Prüfe die Build-Logs in Render
- **Socket-Verbindung**: Stelle sicher, dass CORS korrekt konfiguriert ist
- **Port**: Render weist automatisch einen Port zu, verwende `process.env.PORT`


