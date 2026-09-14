/**
 * Grober LiveKit-Minuten-Zähler für einen Frühwarn-Alarm, BEVOR das
 * monatliche Freikontingent (LiveKit Cloud "Build"-Plan: 5000
 * Teilnehmer-Minuten, Stand 09/2026) überschritten wird und Kosten entstehen.
 * Keine exakte Abrechnungs-Nachbildung (die bleibt bei LiveKit selbst,
 * cloud.livekit.io -> Settings -> Billing) - nur eine Näherung aus den
 * "participant_left"-Webhooks (joinedAt bis Event-Zeitpunkt), die früh genug
 * warnt, bevor tatsächlich etwas kostet.
 *
 * Persistenz auf doca.at (gleiches Muster wie tournaments.ts): Render
 * verliert seinen lokalen Speicher bei manchen Deploys, siehe Memory
 * webdarts-3k-tournament-integration.md.
 */

import { WebhookReceiver } from "livekit-server-sdk";

const API_KEY = process.env.LIVEKIT_API_KEY?.trim() ?? "";
const API_SECRET = process.env.LIVEKIT_API_SECRET?.trim() ?? "";
const receiver = API_KEY && API_SECRET ? new WebhookReceiver(API_KEY, API_SECRET) : null;

const STORE_URL = (process.env.WEBDARTS_LIVEKIT_USAGE_URL ?? "").trim();
const ALERT_URL = (process.env.WEBDARTS_LIVEKIT_ALERT_URL ?? "").trim();
const SECRET = process.env.WEBDARTS_SECRET ?? "";

/** LiveKit Cloud "Build"-Plan (Stand 09/2026): 5000 Freiminuten/Monat. Bei
 *  einem Plan-Wechsel hier anpassen. */
const MONTHLY_LIMIT_MIN = 5000;
/** Ab wie viel Prozent des Freikontingents die Warn-Mail rausgeht. */
const ALERT_THRESHOLD = 0.8;

interface UsageState {
  month: string; // "YYYY-MM"
  minutes: number;
  alerted: boolean;
}

let state: UsageState | null = null;
let loaded = false;

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function load(): Promise<UsageState> {
  if (loaded && state) return state;
  loaded = true;
  if (STORE_URL && SECRET) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 8_000);
      const res = await fetch(STORE_URL, { headers: { "x-webdarts-key": SECRET }, signal: ac.signal });
      clearTimeout(t);
      if (res.ok) {
        const data = (await res.json()) as Partial<UsageState>;
        if (data && typeof data.month === "string" && typeof data.minutes === "number") {
          state = { month: data.month, minutes: data.minutes, alerted: Boolean(data.alerted) };
        }
      }
    } catch (err) {
      console.warn("[livekitUsage] Laden von doca.at fehlgeschlagen:", (err as Error).message);
    }
  }
  if (!state) state = { month: monthKey(), minutes: 0, alerted: false };
  return state;
}

async function persist(): Promise<void> {
  if (!STORE_URL || !SECRET || !state) return;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8_000);
    await fetch(STORE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webdarts-key": SECRET },
      body: JSON.stringify(state),
      signal: ac.signal,
    });
    clearTimeout(t);
  } catch (err) {
    console.warn("[livekitUsage] Speichern auf doca.at fehlgeschlagen:", (err as Error).message);
  }
}

async function sendAlert(minutes: number): Promise<void> {
  if (!ALERT_URL || !SECRET) {
    console.warn("[livekitUsage] Schwelle erreicht, aber WEBDARTS_LIVEKIT_ALERT_URL nicht gesetzt.");
    return;
  }
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8_000);
    await fetch(ALERT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webdarts-key": SECRET },
      body: JSON.stringify({
        minutes: Math.round(minutes),
        limit: MONTHLY_LIMIT_MIN,
        percent: Math.round((minutes / MONTHLY_LIMIT_MIN) * 100),
        month: monthKey(),
      }),
      signal: ac.signal,
    });
    clearTimeout(t);
  } catch (err) {
    console.warn("[livekitUsage] Alarm-Mail auslösen fehlgeschlagen:", (err as Error).message);
  }
}

/** Vom Express-Webhook-Handler aufgerufen. `rawBody` MUSS der unveränderte
 *  Rohtext des Requests sein (nicht JSON.parse'd) - sonst schlägt die
 *  Signaturprüfung fehl. Läuft bewusst "fire and forget": der Handler
 *  antwortet LiveKit sofort mit 200, unabhängig vom Ausgang hier. */
export async function handleLivekitWebhook(rawBody: string, authHeader: string | undefined): Promise<void> {
  if (!receiver) return;
  let event;
  try {
    event = await receiver.receive(rawBody, authHeader);
  } catch (err) {
    console.warn("[livekitUsage] Webhook-Signatur ungültig:", (err as Error).message);
    return;
  }
  if (event.event !== "participant_left" || !event.participant) return;

  const joinedAtSec = Number(event.participant.joinedAt);
  const leftAtSec = Number(event.createdAt);
  if (!joinedAtSec || !leftAtSec || leftAtSec <= joinedAtSec) return;
  // Gegen Ausreißer (Uhrzeit-Skew, hängengebliebene Teilnehmer) auf 6h gekappt.
  const durationMin = Math.min(leftAtSec - joinedAtSec, 6 * 3600) / 60;

  const st = await load();
  const nowMonth = monthKey();
  if (st.month !== nowMonth) {
    st.month = nowMonth;
    st.minutes = 0;
    st.alerted = false;
  }
  st.minutes += durationMin;
  await persist();

  if (!st.alerted && st.minutes >= MONTHLY_LIMIT_MIN * ALERT_THRESHOLD) {
    st.alerted = true;
    await persist();
    await sendAlert(st.minutes);
  }
}
