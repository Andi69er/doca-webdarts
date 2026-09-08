/**
 * Einbettungs-Daten von der doca.at-PHP-Seite. `window.WEBDARTS` wird dort
 * gesetzt, wenn ein eingeloggtes Mitglied Webdarts öffnet.
 * Fehlt es (lokale Entwicklung / Standalone), läuft alles im Gast-Modus.
 */

export interface PdcStar {
  player: string;
  average: number;
  image: string;
}

/** DOCA-Mitglied für die Partner-Auswahl ("Beide an einem Board"). */
export interface EmbedMember {
  /** = "u:<uid>" (Server-Identität). */
  id: string;
  name: string;
  image: string | null;
}

export interface WebdartsEmbed {
  /** WebSocket-URL des Spiel-Servers, z.B. wss://doca-webdarts.onrender.com */
  wsUrl: string;
  /** Eingeloggtes Mitglied. */
  user: { id: string; name: string };
  /** Signiertes SSO-Ticket für den Server. */
  token: string;
  /** Basis-URL von doca.at (für Bilder / Links). */
  baseUrl: string;
  /** PDC-Stars mit echten Averages (für die Bot-Auswahl). */
  pdcStars: PdcStar[];
  /** Alle DOCA-Mitglieder (für die Partner-Auswahl); optional. */
  members?: EmbedMember[];
}

export const embed: WebdartsEmbed | null =
  typeof window !== "undefined" && (window as unknown as { WEBDARTS?: WebdartsEmbed }).WEBDARTS
    ? (window as unknown as { WEBDARTS: WebdartsEmbed }).WEBDARTS
    : null;

export const isEmbedded = embed !== null;
