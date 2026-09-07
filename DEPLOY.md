# Webdarts – Betrieb / Deployment

Webdarts besteht aus zwei Teilen:

| Teil | Was | Port (Standard) |
|---|---|---|
| **server** (`apps/server`) | Node/Socket.IO – Räume, Matchstand, LiveKit-Tokens, Match-Historie | 8787 |
| **web** (`apps/web`) | statisches Build (React/Vite), ausgeliefert über nginx | 80 / 8080 |

Video/Audio läuft über **LiveKit** (Cloud oder self-hosted). Ohne `LIVEKIT_*`-Keys
startet alles, nur ohne Bild/Ton.

## Wichtig: HTTPS

Kamera, Mikrofon und Bildschirmaufnahme funktionieren im Browser **nur über HTTPS**
(Ausnahme: `localhost`). Für den echten Betrieb einen Reverse-Proxy mit TLS
davorsetzen (Caddy, Traefik, nginx). Der Server spricht dann über **WSS**.

## Variante A – Docker Compose (einfach)

```bash
cp apps/server/.env.example apps/server/.env   # LIVEKIT_* eintragen (optional)

# .env fürs Compose (oder Variablen direkt setzen):
#   CLIENT_ORIGIN     = öffentliche URL der Web-App   (z. B. https://darts.doca.at)
#   PUBLIC_SERVER_URL = öffentliche URL des Servers   (z. B. https://darts-api.doca.at)
#   LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET

docker compose up -d --build
```

- Web: `http://localhost:8080`
- Server: `http://localhost:8787`
- Match-Historie: Docker-Volume `webdarts-data` (`/app/data/results.jsonl`)

`PUBLIC_SERVER_URL` wird **zur Build-Zeit** in die Web-App eingebacken – bei
Änderung `docker compose build web` neu bauen.

## Variante B – ohne Docker

```bash
npm ci
npm -w @webdarts/web run build          # erzeugt apps/web/dist  -> statisch ausliefern
VITE_SERVER_URL=https://…               # vor dem Build setzen

# Server (Prozessmanager wie pm2 / systemd empfohlen):
PORT=8787 CLIENT_ORIGIN=https://darts.doca.at \
LIVEKIT_URL=… LIVEKIT_API_KEY=… LIVEKIT_API_SECRET=… \
npx tsx apps/server/src/index.ts
```

`apps/web/dist` kann direkt in ein Verzeichnis von doca.at kopiert werden
(SPA-Fallback auf `index.html` nicht vergessen – siehe `apps/web/nginx.conf`).

## Umgebungsvariablen (Server)

| Variable | Bedeutung | Standard |
|---|---|---|
| `PORT` | Server-Port | 8787 |
| `CLIENT_ORIGIN` | erlaubte Origin der Web-App (CORS) | `http://localhost:5173` |
| `LIVEKIT_URL` | `wss://…livekit.cloud` | – (Video aus) |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit-Schlüssel | – |
| `RESULTS_FILE` | Pfad der Match-Historie (JSON-Lines) | `data/results.jsonl` (relativ zum Arbeitsverzeichnis) |

## Endpunkte

- `GET /health` → `{ ok, videoEnabled }`
- `GET /results?limit=50` → letzte Match-Ergebnisse (JSON)

## Reverse-Proxy-Skizze (nginx)

```nginx
# Web
server {
  server_name darts.doca.at;
  location / { proxy_pass http://127.0.0.1:8080; }
}
# Server (WebSocket!)
server {
  server_name darts-api.doca.at;
  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

TLS via Certbot/Caddy ergänzen.
