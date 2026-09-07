# --- Webdarts-Web (statisches Build, ausgeliefert über nginx) ----------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/engine packages/engine
COPY apps/web apps/web

# URL des Webdarts-Servers (wird zur Build-Zeit fest eingebacken)
ARG VITE_SERVER_URL=http://localhost:8787
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN npm -w @webdarts/web run build

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
