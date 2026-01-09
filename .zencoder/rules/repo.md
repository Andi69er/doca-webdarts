---
description: Repository Information Overview
alwaysApply: true
---

# Repository Information Overview

## Repository Summary
DOCA WebDarts is a multi-project Node.js and React monorepo delivering a real-time online darts experience that mixes multiplayer game logic, Socket.IO signaling, and WebRTC video. Two independent Node services (the root monolith and the modular `backend/` service) expose REST and WebSocket endpoints while serving compiled React bundles. The primary React client under `frontend/` implements lobby, gameplay, statistics, media streaming, and device-control flows, while `backend/frontend/` hosts a lighter legacy UI that can be embedded directly inside the backend build. Deployment is orchestrated on Render via `render.yaml`, and extensive operational guidance lives in markdown playbooks such as `technical_specification.md`, `DEPLOY.md`, `RENDER_SETUP.md`, and `QUICK_START.md`.

## Repository Structure
- `backend/`: Production-grade Express 5 service with JWT auth helpers, REST endpoints, a Socket.IO server, persistent room state under `socket/state.js`, and rich event handlers inside `socket/events/`. Includes its own `.env`, node_modules, and a nested `frontend/` bundle.
- `frontend/`: Main Create React App project (`src/components`, `src/contexts`, `src/hooks`, `src/gameModes.js`) with build output under `build/`, CRA `public/`, and dedicated node_modules.
- `backend/frontend/`: Secondary CRA client (simpler App, SocketContext hard-wired to Render URL) used for quick backend-embedded UI builds.
- `public/`: CRA template assets used by the root Node service when serving static content outside the `frontend/` directory.
- `database/`: Placeholder directory for future SQL dumps or migration scripts (currently empty).
- Documentation: `technical_specification.md`, deployment guides (`DEPLOY.md`, `QUICK_DEPLOY.md`, `RENDER_DEPLOYMENT.md`, `RENDER_SETUP.md`, `QUICK_START.md`, `EINFACHE_ANLEITUNG.md`), and helper cheat-sheets (`GIT_COMMANDS.md`, `GITHUB_PUSH_ANLEITUNG.md`).
- Scripts & tooling: PowerShell deployers (`deploy.ps1`, `deploy-simple.ps1`), automation helpers (`run-backend.bat`, `start-backend.bat`), and Render manifest `render.yaml`.
- Environment configuration: Root and backend `.env` files defining DB and service hosts, plus render-level variables declared in `render.yaml`.

### Main Repository Components
- **Root Node Service (`./`)**: Lightweight Express/Socket.IO server (`index.js`) with built-in X01 game logic, JWT helpers (`auth.js`), and room orchestration used for quick local iterations and manual test harnesses.
- **Backend Service (`backend/`)**: Full-featured API and signaling layer with modular Socket.IO event registration, keep-alive pings, MySQL connectivity via `mysql2`, and the ability to serve the production React bundle.
- **Frontend App (`frontend/`)**: Complete React 19 client with routing, contexts, advanced hooks (WebRTC, camera, recording, game flow), and comprehensive UI components for lobby, scoring, statistics, chat, and media panes.
- **Legacy Frontend Bundle (`backend/frontend/`)**: Minimal CRA project used to embed a React UI straight into the backend build, featuring a hard-coded Socket.IO connection, auto-reload hooks, and lightweight context wiring.

## Projects

### Root Node Service (./)
**Configuration File**: `package.json`

#### Language & Runtime
- Runs on Node.js (ES5 CommonJS) with Express 4.18.x, `socket.io` 4.7+, and `nodemon` for hot reloading via `npm run dev`.
- `index.js` hosts HTTP + Socket.IO servers, configures permissive CORS for Netlify/Render/local origins, and serves the compiled React UI from `frontend/build/`.
- Real-time play is managed by inline `X01Game`/`RoomManager` classes plus placeholder `CricketGame` and `BullOffGame` shells; `gameModes.js` and `rooms.js` expose richer class structures for future reuse.
- `auth.js` provides JWT helpers (`generateJWT`, `verifyJWT`, `refreshJWT`) and mock OAuth redirect URLs driven by `DOCA_OAUTH_*` envs. `.env` defines DB host credentials, `DOCA_SERVER_URL`, and `PORT=3001`.
- Static assets default to the root-level CRA `public/` folder, and fallback routes send `frontend/build/index.html` for SPA navigation.

#### Dependencies
**Main Dependencies**:
- `express@^4.18.2`
- `socket.io@^4.7.4` and `socket.io-client@^4.8.3`
- `dotenv@^16.4.5`
- `jsonwebtoken@^9.0.2`
- Runtime imports also expect `cors` and `body-parser` (used in `index.js`) even though they are not declared in the current package file.

**Development Dependencies**:
- `nodemon@^3.0.2`

#### Build & Installation
```bash
npm install
npm run dev   # nodemon index.js
npm start     # node index.js
```
Auxiliary launchers include `run-backend.bat` (navigates to `backend/` and runs `npm start`) for Windows operators who prefer scripts over npm commands.

#### Testing
- `npm test` is a placeholder that exits with an error, so automated coverage is absent.
- Manual Socket.IO regression scripts exist at the repo root (`test_multiplayer.js`, `test_statistics.js`, `test_throw.js`, `temp_fixed.js`, `test_multiplayer.js`) and connect to `http://localhost:3001` to simulate lobby creation, score entries, and stats fetches.
- `backend_logs.txt` captures console traces for manual review.

### Backend Service (`backend/`)
**Configuration File**: `backend/package.json`

#### Language & Runtime
- Node.js/Express 5.x application with HTTP and Socket.IO servers created in `index.js`.
- CORS white-list mirrors the production Netlify and Render hosts plus local ports 3000/3002; HTTP JSON + URL-encoded bodies go through `body-parser`.
- Auth endpoints reuse `backend/auth.js`, while stats routes currently serve deterministic dummy payloads and history/achievement mock data.
- Static hosting points to `../frontend/build`, letting the backend double as the web host after `frontend` builds run.
- `socketHandler.js` wires connections, user tracking (`socket/state.js` maintains `onlineUsers`, `connectedUsers`, `rooms`, `finishedGames`), and dispatches feature-specific event modules:
  - `registerLobbyEvents.js` handles room creation, team metadata (`teamAssignments`, singles/doubles), lobby lists, and running game snapshots.
  - `registerGameLifecycleEvents.js` and `registerGameplayEvents.js` (not shown fully but present) coordinate state transitions, scoring, and leg/set bookkeeping using helpers from `socket/utils/gameStateUtils.js`.
  - `registerMediaEvents.js` relays `camera-offer`, `camera-answer`, and `camera-ice` WebRTC signals per room or socket ID.
  - `registerDisconnectHandler.js` keeps room rosters and metrics clean.
- Scheduled keep-alive pings (configurable via `KEEPALIVE_*` envs) periodically GET the Render URL’s `/healthz` endpoint to prevent cold starts.

#### Dependencies
**Main Dependencies**:
- `express@^5.1.0`
- `socket.io@^4.8.1`
- `cors@^2.8.5`
- `body-parser@^2.2.0`
- `dotenv@^17.2.3`
- `axios@^1.13.2` (Render keep-alive pings)
- `jsonwebtoken@^9.0.2`
- `mysql2@^3.15.3` (planned direct DB access)

#### Build & Installation
```bash
cd backend
npm install
npm start   # node index.js
```
`run-backend.bat` automates these steps on Windows. Production deployments rely on `render.yaml`, where the backend start command is `cd backend && node index.js`.

#### Testing
- No Jest/Mocha suites are defined in this package. The `npm test` script is still the default stub, so verification depends on manual Socket.IO/client testing and Render health checks (`/healthz`).

### Frontend App (`frontend/`)
**Configuration File**: `frontend/package.json`

#### Language & Runtime
- Create React App targeting React 19 with React Router DOM 7.9, `react-scripts` 5.0.1, and modern Browserslist targets.
- Application wiring (`src/App.js`) wraps the SPA inside `SocketProvider` and `BrowserRouter`, routing `/` (Lobby), `/game/:roomId`, and `/login`.
- `src/contexts/SocketContext.js` lazily discovers backend URLs: it prefers `REACT_APP_API_URL`, then derives candidates from `window.location`, and finally falls back to `http://localhost:3001`/`3002`. Connections default to WebSocket transport, enable delayed reconnection, and surface `socketConnected` state.
- `src/contexts/GameContext.js` composes multiple hooks—`useCameraController`, `useRecordingManager`, `useGameConnection`, `useGameFlow`, `useNumpadLock`—to coordinate gameplay phases, leg winners, numpad locking, auto video layout, and debugging overlays.
- `src/hooks/useWebRTC.js` implements full-featured RTC handling: peer connection pools, STUN server lists (Google STUN + others), Safari/Firefox/Edge-specific tweaks, auto reconnect scheduling, ICE queuing, receiver polling, and multi-stream fan-out to the in-app video layout.
- UI components live under `src/components` (Lobby, Game, PlayerScores, GameChat, Cricket board/panels, statistics widgets, popups, video panes) with CSS modules per component.
- Additional assets include `src/__mocks__/react-router-dom.js` (for Jest), `src/gameModes.js` (client-side metadata), and CRA defaults (`App.css`, `logo.svg`, `reportWebVitals.js`).

#### Dependencies
**Main Dependencies**:
- `react@^19.2.0` and `react-dom@^19.2.0`
- `react-router-dom@^7.9.6`
- `socket.io-client@^4.8.1`
- `react-scripts@5.0.1`
- `web-vitals@^2.1.4`

**Testing & Dev Dependencies**:
- `@testing-library/react@^16.3.0`
- `@testing-library/dom@^10.4.1`
- `@testing-library/jest-dom@^6.9.1`
- `@testing-library/user-event@^13.5.0`

#### Build & Installation
```bash
cd frontend
npm install
npm start         # react-scripts start
npm run build     # react-scripts build -> build/
```
Configure `REACT_APP_API_URL` during builds (Render static site or local `.env`) so `SocketProvider` prefers the correct backend host. The CRA output feeds both the root Node service and the backend service via `../frontend/build`.

#### Testing
```bash
cd frontend
npm test          # react-scripts test (Jest + RTL)
```
- Jest config in `package.json` remaps `react-router-dom` to `src/__mocks__/react-router-dom.js` for deterministic navigation during unit tests.
- Default coverage targets `src/App.test.js`; `src/setupTests.js` wires RTL matchers through `@testing-library/jest-dom`.

### Legacy Frontend Bundle (`backend/frontend/`)
**Configuration File**: `backend/frontend/package.json`

#### Language & Runtime
- Another CRA 5.0.1 project pinned to React 19 but with a drastically simplified codebase.
- `src/App.js` opens a Socket.IO connection to `http://localhost:3001`, displays backend connection status, and listens for `server_reload_trigger` to refresh the page automatically when Nodemon restarts the backend.
- `src/contexts/SocketContext.js` exposes a context pre-configured to connect against the Render-hosted backend (`https://doca-webdarts.onrender.com`) with aggressive reconnection attempts and combined websocket/polling transports.
- Intended for embedding inside backend deployments or serving as a minimal control panel while the main frontend evolves.

#### Dependencies
- Core CRA stack identical to the main frontend (`react`, `react-dom`, `react-scripts`, `web-vitals`, `@testing-library/*`).

#### Build & Installation
```bash
cd backend/frontend
npm install
npm run build
```
This bundle can be dropped into `backend/frontend/build` and served by the backend server if desired.

#### Testing
- Uses CRA’s default `npm test` (Jest + RTL). No custom suites beyond the CRA starter files.

## Operations & Deployment
- `render.yaml` provisions a single Render web service (`doca-webdarts`, Node plan). The build command chains installs/builds for backend and frontend: `cd backend && npm install && cd ../frontend && npm install && npm run build`. The start command is `cd backend && node index.js`, and `healthCheckPath: /` expects the backend to serve the React index or respond via `/healthz`.
- Render environment variables include `NODE_ENV=production`, `KEEPALIVE_URL=https://doca-webdarts.onrender.com`, `KEEPALIVE_INTERVAL_MS=840000`, and `DISABLE_KEEPALIVE=false` to coordinate backend keep-alive pings.
- Deployment scripts: `deploy.ps1` and `deploy-simple.ps1` encapsulate git status checks, adds, commits, pushes, and Render deployment reminders; `QUICK_START.md` and `GITHUB_PUSH_ANLEITUNG.md` provide German-language walkthroughs for first-time setup, while `RENDER_DEPLOYMENT.md`/`RENDER_SETUP.md` document manual Render service configuration steps.
- Windows-friendly helpers (`run-backend.bat`, `start-backend.bat`) streamline backend starts; `deploy-simple.ps1` can orchestrate the same from PowerShell.
- There are no Dockerfiles or docker-compose manifests, so containerization must be added manually if required.

## Environment & Configuration
- Root `.env` and `backend/.env` share MySQL connection parameters: `DB_HOST=xserv2003.hybridserver.at`, `DB_USER=usrdb_docaxabk_dbmifglider_user`, `DB_PASSWORD=password`, `DB_NAME=usrdb_docaxabk_dbmifglider`, plus `DOCA_SERVER_URL=https://doca-server.onrender.com` and respective `PORT` values (3001 for root, 3002 for backend).
- `auth.js` depends on `JWT_SECRET` as well as doca.at OAuth settings (`DOCA_OAUTH_BASE_URL`, `DOCA_OAUTH_CLIENT_ID`, `DOCA_OAUTH_REDIRECT_URI`).
- Render config injects `KEEPALIVE_URL`, `KEEPALIVE_INTERVAL_MS`, and `DISABLE_KEEPALIVE`, which `backend/index.js` reads to decide whether to schedule Axios pings.
- The main frontend expects `REACT_APP_API_URL` during builds to prioritize a specific API host; otherwise `SocketProvider` cycles through window-derived URLs and hard-coded `http://localhost:3001` / `3002` fallbacks before enabling reconnection.
- `useWebRTC` lists multiple STUN servers (Google, Ekiga, Ideasip, Schlund) and applies user-agent-specific connection heuristics (Edge receiver polls, Safari bundle policy, Firefox transport policies) to keep video sessions stable. Signaling relies on backend `camera-offer`/`camera-answer`/`camera-ice` listeners.
- `GameContext` orchestrates timers, modal visibility, numpad locks, and debug logs while coordinating with `SocketContext`’s `socketConnected` state. Video layout auto-switches based on `gameState` and the active player but can be overridden manually.

## Data & External Services
- The system integrates with the existing doca-server stack hosted on Render and the MySQL database `usrdb_docaxabk_dbmifglider` (phpMyAdmin-managed). `technical_specification.md` describes how match results reside in `match_history`, and how statistics endpoints should expose metrics such as averages, finishes, and achievements.
- OAuth expectations include doca.at-based flows; `mockOAuthLogin`/`mockOAuthCallback` currently simulate redirects but are placeholders for real doca-server exchanges.
- Web clients may also connect directly to `https://doca-webdarts.onrender.com` (Render) or `https://heroic-banoffee-4c3f4f.netlify.app` (Netlify) as listed in CORS/Socket.IO origin arrays, ensuring compatibility with existing deployments.
- WebRTC STUN connectivity leans on public servers while future TURN support or doca-server signaling endpoints are outlined in the technical specification.

## Testing & Validation
- Frontend unit tests run through CRA/Jest with React Testing Library; `App.test.js` exercises routing/component rendering, and `setupTests.js` injects jest-dom matchers. Additional UI-targeted validation resides under component-specific `.backup` files, enabling manual regression diffing even though they are not executed automatically.
- No automated backend tests exist; reliability currently hinges on manual Socket.IO simulations (e.g., `test_multiplayer.js` randomly scores throws after creating rooms, verifying `game-state-update` payloads) and direct endpoint checks via REST clients.
- Health monitoring is limited to the `/healthz` endpoint inside `backend/index.js` plus Render’s own health checks; Axios keep-alive pings double as uptime verification by logging success/failure to stdout.
- Linting/type-check commands are not defined; contributors should rely on CRA’s built-in ESLint (invoked during `npm start`) and manual code reviews until dedicated tooling is added.
