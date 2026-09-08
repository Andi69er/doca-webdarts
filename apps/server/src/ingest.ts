/**
 * Meldet beendete Matches an doca.at (webspiele/webdarts/ingest.php), damit die
 * Nutzung dauerhaft in der DB landet (Render-Dateisystem ist flüchtig).
 * Deaktiviert, solange WEBDARTS_INGEST_URL nicht gesetzt ist.
 */

const URL_ = (process.env.WEBDARTS_INGEST_URL ?? "").trim();
const SECRET = process.env.WEBDARTS_SECRET ?? "";
const enabled = URL_.length > 0 && SECRET.length > 0;

export async function sendUsage(record: Record<string, unknown>): Promise<void> {
  if (!enabled) return;
  const body = JSON.stringify({ record });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 8000);
      const res = await fetch(URL_, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webdarts-key": SECRET,
        },
        body,
        signal: ac.signal,
      });
      clearTimeout(t);
      if (res.ok) return;
      console.warn("[ingest] HTTP", res.status);
    } catch (err) {
      console.warn("[ingest] Versuch", attempt + 1, (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}
