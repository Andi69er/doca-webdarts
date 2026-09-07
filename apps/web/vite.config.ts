import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// WD_BASE steuert den öffentlichen Pfad der Assets.
// - Standalone:            "/"  (Standard)
// - Einbettung in doca.at: "/webspiele/webdarts/app/"  (npm run build:embed)
const base = process.env.WD_BASE || "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5173 },
  build: {
    manifest: true,
    outDir: process.env.WD_OUTDIR || "dist",
    emptyOutDir: true,
  },
});
