# 🚀 Deployment auf Render - Schritt für Schritt

## Schritt 1: Render-Account erstellen/Anmelden

1. Gehe zu: **https://render.com**
2. Klicke auf **"Get Started for Free"** oder **"Sign In"**
3. Melde dich mit GitHub an (empfohlen) oder erstelle einen Account

## Schritt 2: Neuen Web Service erstellen

1. Klicke auf **"New +"** (oben rechts)
2. Wähle **"Web Service"**

## Schritt 3: GitHub Repository verbinden

1. Render fragt nach deinem Repository
2. Klicke auf **"Connect GitHub"** (falls noch nicht verbunden)
3. Autorisiere Render, auf deine Repositories zuzugreifen
4. Wähle dein Repository aus (z.B. `doca-online-dart`)

## Schritt 4: Service konfigurieren

Render sollte automatisch die `render.yaml` erkennen. Falls nicht:

### Automatische Erkennung (empfohlen):
- Render erkennt die `render.yaml` automatisch
- Klicke einfach auf **"Create Web Service"**

### Manuelle Konfiguration (falls nötig):
- **Name**: `doca-webdarts` (oder wie du möchtest)
- **Environment**: `Node`
- **Build Command**: 
  ```
  cd backend && npm install && cd ../frontend && npm install && npm run build
  ```
- **Start Command**: 
  ```
  cd backend && node index.js
  ```
- **Plan**: Free (kostenlos)

## Schritt 5: Deployment starten

1. Klicke auf **"Create Web Service"**
2. Render startet automatisch das Deployment
3. Warte 5-10 Minuten (Render baut alles)

## Schritt 6: Fertig! 🎉

Nach dem Deployment bekommst du:
- **URL**: z.B. `https://doca-webdarts.onrender.com`
- Die Anwendung ist jetzt live!

## Wichtige Hinweise:

- **Erstes Deployment**: Dauert länger (5-10 Minuten)
- **Spätere Deployments**: Automatisch bei jedem Push zu GitHub
- **Free Plan**: Service schläft nach 15 Minuten Inaktivität (wacht beim ersten Request auf)
- **Logs**: Du kannst die Build-Logs in Render sehen

## Troubleshooting:

- **Build-Fehler**: Prüfe die Logs in Render
- **Service startet nicht**: Prüfe die Logs und die Start-Command
- **Socket.IO funktioniert nicht**: Stelle sicher, dass CORS korrekt konfiguriert ist


