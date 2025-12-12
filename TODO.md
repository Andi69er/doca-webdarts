# TODO: Implementiere Sperren des Nummernpads für Gegner nach Score-Eingabe

## Aufgabe
Nach Score-Eingabe muss das Nummernpad für den Gegner 5 Sekunden gesperrt bleiben, damit der aktive Spieler die Undo-Taste verwenden kann. Umgekehrt gilt das gleiche.

## Probleme gefunden
- Das Sperren funktioniert nur lokal in Game.js mit `opponentLocked`.
- Es fehlt die Kommunikation über Socket an den Gegner.
- Backend verarbeitet Score-Eingabe, aber sendet kein Sperr-Signal.

## Plan
1. **Backend (socketHandler.js)**: Neues Socket-Event `score-locked` hinzufügen, das nach Score-Eingabe das Sperren an alle Spieler sendet.
2. **Frontend (Game.js)**: Sperr-Event empfangen und `opponentLocked` setzen. Timer für 5 Sekunden starten.
3. **Timer-Logik**: Nach 5 Sekunden Sperren aufheben und `canUseUndo` zurücksetzen.

## Schritte
- [x] Socket-Event `score-locked` in socketHandler.js hinzufügen
- [x] Frontend-Event-Handler in Game.js für `score-locked` hinzufügen
- [x] Timer-Logik in Game.js anpassen
- [ ] Testen: Score eingeben und prüfen, ob Gegner gesperrt ist
- [ ] Testen: Undo-Funktionalität während Sperr-Zeit
- [ ] Testen: Sperren hebt sich nach 5 Sekunden auf

## Abhängige Dateien
- backend/socketHandler.js
- frontend/src/components/Game.js
