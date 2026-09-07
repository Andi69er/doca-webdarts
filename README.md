# DOCA Webdarts

**Eigenständige** Online-Darts-Website mit Fokus auf **Doppelspiele (2 gegen 2)** –
4 Board-Kameras + Mikrofone, gemeinsamer Scorer, Ausbullen, automatisches
Video-Layout (aktiver Werfer groß).

> Läuft komplett getrennt von doca.at. Keine Anbindung, kein gemeinsamer Login,
> kein Risiko für die bestehende Seite. Eine Integration kann später separat kommen.

## Projektaufbau (npm-Workspaces)

```
packages/engine   Reine Scoring-Logik (X01 + Cricket, 2v2, Ausbullen, Checkout).
                  Framework-unabhängig, mit Tests. Enthält auch das Netz-Protokoll.
apps/server       Node-Server (Express + Socket.IO). Hält pro Raum den
                  autoritativen Spielstand, verteilt Aktionen, stellt LiveKit-Tokens aus.
apps/web          React-Oberfläche (Vite): Landing → Lobby → Match mit Video + Scorer.
```

Kein eigener Media-Server nötig: das Video läuft über **LiveKit** (kostenloses
Cloud-Projekt). Ohne LiveKit-Keys startet trotzdem alles – nur ohne Bild/Ton.

## Schnellstart

```bash
npm install

# optional: Video aktivieren
cp apps/server/.env.example apps/server/.env
#   -> LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET von cloud.livekit.io eintragen

npm run dev        # startet Server (:8787) und Web (:5173) zusammen
```

Dann `http://localhost:5173` öffnen. Ablauf:

1. **Name eingeben** → man landet in der **Lobby** (Hub).
2. Lobby zeigt: **wer online ist**, einen **globalen Chat** (Spiel ausmachen) und die
   **Liste offener Räume**. Kein Beitritts-Code – Räume sind direkt sichtbar.
3. **Raum erstellen** (X01/Cricket, Doppel/Einzel) → erscheint für alle in der Liste.
4. Mitspieler klicken **Beitreten**, setzen sich auf die 4 Plätze, Host stellt den
   Modus fein ein und startet das Match. Andere können **zuschauen**.

## Weitere Befehle

```bash
npm test                       # Engine-Tests (Vitest)
npm run typecheck              # alle drei Pakete
npm run build                  # Web-Produktionsbuild
npm -w @webdarts/server start  # nur Server
```

## Funktionsumfang aktuell

| Bereich | Status |
|---|---|
| X01 (301/501/701, Straight/Double/Master-Out, Bust) | ✅ |
| Cricket (Standard + Cut-Throat), 2v2 | ✅ |
| Ausbullen mit **3 Darts** (bester Dart zählt), Nachwerfen bei Gleichstand | ✅ |
| Match-Statistik (Average, First 9, 95+/133+/171+/180, Checkout %, höchstes Finish, kürzestes Leg) | ✅ |
| Scoreboard + Zifferntastatur im darts-live-Stil | ✅ |
| Optionaler Raumname | ✅ |
| Doppel-Wurfreihenfolge, Anwurfwechsel, Legs + Sätze | ✅ |
| Checkout-Vorschlag fürs Team am Wurf | ✅ |
| Globale Lobby: Online-Liste, Chat, sichtbare Raumliste (ohne Code) | ✅ |
| Räume, Sitzplätze, Zuschauer, „Zurück zur Lobby“ | ✅ |
| Echtzeit-Sync über Socket.IO, serverseitige Validierung | ✅ |
| Undo | ✅ |
| Scorer-UI: „Summe“ + „Dart für Dart“ | ✅ |
| Video: 4 Kacheln über LiveKit, aktiver Werfer groß | ✅ (Keys nötig) |
| Mikrofone (LiveKit Audio) | ✅ (Keys nötig) |
| Checkdart-Abfrage (Darts zum Checkout / auf Doppel) | ✅ |
| Revanche-Angebot nach Match-Ende | ✅ |
| Bildschirmaufnahme pro Spieler + Speichern-Dialog | ✅ |
| Sicherheit: Validierung, Rate-Limits, Header | ✅ |
| Barrierefreiheit: Dialoge, Fokus, aria, Live-Regionen | ✅ |
| Responsiv (Handy/Tablet/Desktop), iOS „Ton aktivieren" | ✅ |
| **Reconnect**: Sitz & Raum bleiben nach Reload/Abbruch (Client-Token) | ✅ |
| **Pause**: manuell (WC/Telefon) + automatisch bei Verbindungsabbruch | ✅ |
| „Du bist am Wurf"-Signal (Ton + Tab-Titel) | ✅ |
| Cricket-Tafel mit Marks-Gitter | ✅ |
| Match-Historie (`data/results.jsonl`, `GET /results`) | ✅ |
| Deployment: Dockerfiles + Compose + `DEPLOY.md` | ✅ |

## Noch offen / nächste Ausbaustufen

- **doca.at-Anbindung**: Login/SSO (`/hashcode/config.php`), iframe-Einbettung
- **Füll-Bot** aus doca.at übernehmen (Dartscheiben-Simulation), wenn nur 3 Spieler da sind
- **Ausbullen im Doppel**: aktuell wirft pro Team eine Person – optional alle vier
- **Turnier-/Ligamodus**, feste Team-Zuordnung
- **HTTPS/WSS**-Betrieb (siehe `DEPLOY.md`)

## Wie die Teile zusammenspielen

```
 Browser (Spieler 1..4 + Zuschauer)
        │  Socket.IO  (room:*, match:*)          WebRTC
        ▼                                          │
 apps/server ── MatchController (packages/engine) ─┘
        │  stellt LiveKit-Token aus
        ▼
 LiveKit Cloud (SFU)  ── verteilt 4 Cams + 4 Mics an alle
```

Der Selektor `scoreboard(state).thrower` liefert den aktiven Spieler. Dessen
LiveKit-Identität = Sitz-Belegung, daran hängt die große Videokachel.
