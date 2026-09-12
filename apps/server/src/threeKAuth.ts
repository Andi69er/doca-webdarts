/**
 * Login als Vereins-Account ("doca") bei 3K, ausschließlich für den
 * Ergebnis-/Bestleistungen-Write-back (siehe Memory
 * webdarts-3k-tournament-integration.md). Komplett getrennt vom normalen
 * Lesezugriff in threeK.ts – eigener Host, eigenes Auth-Schema.
 *
 * Kein Refresh-Token-Ablauf nachgebaut: Write-back passiert selten genug
 * (ein paar Mal pro Turniertag), dass ein einfacher Re-Login bei Bedarf
 * reicht statt ein zweites, unbekanntes Endpoint-Verhalten zu reverse-
 * engineeren.
 *
 * WICHTIG: THREEK_USERNAME/THREEK_PASSWORD sind das echte 3K-Vereinskonto
 * mit Schreibrechten. Nur als Render-Umgebungsvariable setzen, nie im Code,
 * Chat oder Log-Ausgaben (auch nicht das Token selbst – nur Feldnamen bei
 * Bedarf loggen, siehe unten).
 */

const LOGIN_URL = "https://backend-user.3k-darts.com/2k-user/api/v1/authentication/login";

const USERNAME = process.env.THREEK_USERNAME ?? "";
const PASSWORD = process.env.THREEK_PASSWORD ?? "";
export const MANDANT_KEY = process.env.THREEK_MANDANT_KEY ?? "";
export const MANDANT_DATABASE = process.env.THREEK_MANDANT_DATABASE ?? "";

export const threeKWriteEnabled = Boolean(USERNAME && PASSWORD && MANDANT_KEY && MANDANT_DATABASE);

if (!threeKWriteEnabled) {
  console.warn(
    "[threeKAuth] THREEK_USERNAME/THREEK_PASSWORD/THREEK_MANDANT_KEY/THREEK_MANDANT_DATABASE " +
      "nicht vollständig gesetzt – 3K-Write-back ist deaktiviert.",
  );
}

interface CachedToken {
  token: string;
  expiresAt: number;
}
let cached: CachedToken | null = null;

/** Vorsichtig kurze Gültigkeit angenommen, da die echte Lebensdauer des
 *  Tokens (noch) unbekannt ist – lieber einmal zu oft neu einloggen als
 *  mit einem abgelaufenen Token gegen eine Wand laufen. */
const TOKEN_TTL_MS = 30 * 60_000;

/** Übliche Feldnamen für das Zugangstoken in Login-Antworten – die 3K-
 *  Antwortform selbst wurde bewusst nie eingesehen (hätte ein echtes,
 *  funktionierendes Token offengelegt). Passt einer nicht, wird das beim
 *  ersten echten Login-Versuch im Server-Log sichtbar (nur Feldnamen, kein
 *  Wert) und diese Liste kann ergänzt werden. */
const TOKEN_FIELD_CANDIDATES = ["accessToken", "access_token", "token", "jwt"];

async function login(): Promise<string> {
  let res: Response;
  try {
    res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Origin: "https://portal.3k-darts.com",
        Referer: "https://portal.3k-darts.com/",
      },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD, noDartsScorerInfos: true }),
    });
  } catch (err) {
    // Node/undici verschluckt bei einem reinen Netzwerkfehler die eigentliche
    // Ursache hinter `err.cause` (z.B. ENOTFOUND/ECONNREFUSED/Zertifikat) -
    // "fetch failed" allein sagt nichts. Die mitgeben, ohne Secrets zu loggen.
    const cause = (err as { cause?: unknown })?.cause;
    throw new Error(`3K-Login: Netzwerkfehler beim Verbinden zu ${LOGIN_URL} – ${String(cause ?? err)}`);
  }
  if (!res.ok) {
    throw new Error(`3K-Login fehlgeschlagen: HTTP ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  for (const field of TOKEN_FIELD_CANDIDATES) {
    const val = data[field];
    if (typeof val === "string" && val) return val;
  }
  // Nur die Schlüssel loggen, nie die Werte - das genügt, um die Liste oben anzupassen.
  console.warn("[threeKAuth] Login ok, aber kein bekanntes Token-Feld gefunden. Vorhandene Keys:", Object.keys(data));
  throw new Error("3K-Login: Token-Feld nicht gefunden (Feldnamen stehen im Server-Log).");
}

/** Gültiges Bearer-Token für 3K, aus dem Cache oder frisch eingeloggt. */
export async function getThreeKToken(): Promise<string> {
  if (!threeKWriteEnabled) throw new Error("3K-Write-back ist nicht konfiguriert.");
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const token = await login();
  cached = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}

/** Nach einem 401 aufrufen, damit der nächste getThreeKToken() neu einloggt. */
export function invalidateThreeKToken(): void {
  cached = null;
}
