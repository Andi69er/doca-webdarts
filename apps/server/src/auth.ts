/**
 * SSO-Ticket-Prüfung. Die doca.at-PHP-Seite signiert für den eingeloggten User
 * ein Ticket mit `WEBDARTS_SECRET` (HMAC-SHA256), dieser Server verifiziert es.
 *
 * Ticket-Format:  base64url(JSON{uid,name,exp}) + "." + base64url(HMAC)
 *
 * Ist kein `WEBDARTS_SECRET` gesetzt (lokale Entwicklung), läuft alles im
 * Gast-Modus weiter (Name + cid vom Client).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = (process.env.WEBDARTS_SECRET ?? "").trim();

/** Ist Login erzwungen? (Ja, sobald ein Secret hinterlegt ist.) */
export const authRequired = SECRET.length > 0;

export interface VerifiedUser {
  uid: string;
  name: string;
  image: string | null;
}

function b64urlToBuf(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

/** Prüft ein Ticket. Rückgabe: User oder null. */
export function verifyTicket(ticket: unknown): VerifiedUser | null {
  if (!authRequired || typeof ticket !== "string" || !ticket.includes(".")) return null;
  const [payloadPart, sigPart] = ticket.split(".", 2) as [string, string];
  if (!payloadPart || !sigPart) return null;

  const expected = createHmac("sha256", SECRET).update(payloadPart).digest();
  let given: Buffer;
  try {
    given = b64urlToBuf(sigPart);
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let data: { uid?: unknown; name?: unknown; img?: unknown; exp?: unknown };
  try {
    data = JSON.parse(b64urlToBuf(payloadPart).toString("utf8"));
  } catch {
    return null;
  }

  const exp = Number(data.exp);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const uid = String(data.uid ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  const name = String(data.name ?? "").slice(0, 40);
  if (!uid || !name) return null;

  const rawImg = String(data.img ?? "").slice(0, 300);
  const image = /^https:\/\//.test(rawImg) ? rawImg : null;

  return { uid, name, image };
}
