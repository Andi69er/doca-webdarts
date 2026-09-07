# --- Webdarts-Server ---------------------------------------------------------
# Läuft die TypeScript-Quellen direkt über tsx (kein separater Build-Schritt).
FROM node:22-alpine

WORKDIR /app

# Nur die Manifeste zuerst -> Docker-Layer-Cache für npm ci
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @webdarts/server --workspace @webdarts/engine --include-workspace-root || npm ci

# Quellcode
COPY tsconfig.base.json ./
COPY packages/engine packages/engine
COPY apps/server apps/server

ENV NODE_ENV=production
ENV PORT=8787
# Match-Historie landet unter /app/data -> als Volume mounten
VOLUME ["/app/data"]
EXPOSE 8787

CMD ["npx", "tsx", "apps/server/src/index.ts"]
