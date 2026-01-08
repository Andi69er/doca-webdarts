# Bug Fix Plan

This plan guides you through systematic bug resolution. Please update checkboxes as you complete each step.

## Phase 1: Investigation

### [x] Bug Reproduction

- Understand the reported issue and expected behavior
- Reproduce the bug in a controlled environment
- Document steps to reproduce consistently
- Identify affected components and versions

### [x] Root Cause Analysis

- Debug and trace the issue to its source
- Identify the root cause of the problem
- Understand why the bug occurs
- Check for similar issues in related code

## Phase 2: Resolution

### [x] Fix Implementation

- Develop a solution that addresses the root cause
- Ensure the fix doesn't introduce new issues
- Consider edge cases and boundary conditions
- Follow coding standards and best practices

### [x] Impact Assessment

- Identify areas affected by the change
- Check for potential side effects
- Ensure backward compatibility if needed
- Document any breaking changes

## Phase 3: Verification

### [x] Testing & Verification

- Verify the bug is fixed with the original reproduction steps
- Write regression tests to prevent recurrence
- Test related functionality for side effects
- Perform integration testing if applicable

### [x] Documentation & Cleanup

- Update relevant documentation
- Add comments explaining the fix
- Clean up any debug code
- Prepare clear commit message

## Phase 4: Modularisierung

### [x] Architekturplanung
- Identifiziere übergroße Dateien (z. B. socketHandler.js)
- Definiere Modulzuschnitt (State, Events, Utilities)
- Plane gemeinsame Abhängigkeiten/State-Übergaben

### [x] Umsetzung
- Erstelle neue Module/Dateien gemäß Planung
- Verschiebe Logik schrittweise aus socketHandler.js
- Sorge für unveränderte Funktionalität

### [x] Tests & Abschluss
- Führe relevante Tests/Builds aus
- Prüfe Lint-Hinweise
- Finales Cleanup

## Phase 5: Frontend-Aufteilung

### [x] Analyse & Planung
- `frontend/src/components/Game.js` (~2200 Zeilen) bündelt Socket-Lifecycle, Input-Flow, Popup-Steuerung, Kamera/WebRTC, Recording und Debugging.
- Cluster:
  - Lobby/Socket & GameState Sync (`Game.js` ca. 428-940, 512-908)
  - Input/Numpad & Turn-Lock (`Game.js` 710-832)
  - Popup/Modal Management (`Game.js` 362-907)
  - Kamera/WebRTC & Recording (`Game.js` 953-1619)
  - Mode-spezifische Layouts (`Game.js` 1730-2260)
  - Debug/Diagnostics (`Game.js` 1961-2055)
- Zielstruktur:
  - Hooks: `useGameConnection`, `useGameFlow`, `useNumpadLock`, `useMediaDevices`, `useWebRTC`, `useRecording`
  - Komponenten: `GameLayout`, `ReadyState`, `GameStatusBar`, `GameModals`, `VideoPanel`, `DebugPanel`, `CricketView`, `X01View`
  - Context: `GameProvider` kapselt GameState und liefert Selectors für Unterkomponenten
- Migration:
  1. Hooks + Provider einführen und bestehende Logik verschieben (keine UI-Änderung)
  2. Video/Recording in `VideoPanel` + `useWebRTC` auslagern, `Game.js` importiert nur Panel
  3. UI in `CricketView`/`X01View` splitten, Ready/Status/Numpad/Chat in dedizierte Container verschieben

### [ ] Umsetzung
- Neue Dateien/Module anlegen
- Bestehende Logik in kleinere Einheiten verschieben
- Imports/Exports anpassen, Funktionalität bewahren

### [ ] Tests & Abschluss
- Frontend-Build/Test ausführen
- Manuelle Smoke-Checks (so weit möglich)
- Plan/Todo aktualisieren

## Notes

- Update this plan as you discover more about the issue
- Check off completed items using [x]
- Add new steps if the bug requires additional investigation
