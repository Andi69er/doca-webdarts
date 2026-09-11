/**
 * Namensabgleich 3K <-> DOCA-Mitglieder, für die Turnier-Anbindung.
 * `normalizeName` ist der gleiche Algorithmus wie `_bench_normalize_name()`
 * in php_logic/benchmarking_helper.php (dort schon produktiv) – klein
 * geschrieben, Umlaute/Akzente ersetzt, nur alphanumerisch.
 */

export interface DirectoryMember {
  id: number;
  username: string;
  darts_live_username: string;
  firstname: string;
  lastname: string;
}

const ACCENTS: Record<string, string> = {
  ä: "ae", ö: "oe", ü: "ue", ß: "ss",
  é: "e", è: "e", ê: "e", ë: "e",
  á: "a", à: "a", â: "a", å: "a",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ò: "o", ô: "o",
  ú: "u", ù: "u", û: "u",
};

export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  let n = raw.normalize("NFC").toLowerCase().trim();
  n = n.replace(/[äöüßéèêëáàâåíìîïóòôúùû]/g, (c) => ACCENTS[c] ?? c);
  n = n.replace(/[^a-z0-9]/g, "");
  return n;
}

/** "Sandra Kriese (Schnecke1102)" -> { fullName: "Sandra Kriese", username: "Schnecke1102" } */
export function parseSingleDisplayName(displayName: string): { fullName: string; username: string | null } {
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(displayName.trim());
  if (m) return { fullName: m[1]!.trim(), username: m[2]!.trim() };
  return { fullName: displayName.trim(), username: null };
}

/** Einzel: Username (bevorzugt) oder Voller-Name gegen die Mitgliederliste matchen. */
export function matchSingle(displayName: string, members: DirectoryMember[]): string | null {
  const { fullName, username } = parseSingleDisplayName(displayName);
  if (username) {
    const key = normalizeName(username);
    const hit = members.find(
      (m) => normalizeName(m.username) === key || normalizeName(m.darts_live_username) === key,
    );
    if (hit) return "u:" + hit.id;
  }
  const fnKey = normalizeName(fullName);
  if (fnKey) {
    const hit = members.find((m) => normalizeName(m.firstname + m.lastname) === fnKey);
    if (hit) return "u:" + hit.id;
  }
  return null;
}

/**
 * Doppel: Team-Anzeigename "Nachname1 & Nachname2" -> genau EIN Mitglied pro
 * Nachname finden. Bei 0 oder >1 Treffern für irgendeinen Teil: null (manuell
 * zuordnen). Gibt die zwei Uids in der Reihenfolge des Namens zurück.
 */
export function matchDoubleTeam(
  displayName: string,
  members: DirectoryMember[],
): [string | null, string | null] {
  const parts = displayName.split("&").map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 2) return [null, null];
  const resolve = (surname: string): string | null => {
    const key = normalizeName(surname);
    if (!key) return null;
    const hits = members.filter((m) => normalizeName(m.lastname) === key);
    return hits.length === 1 ? "u:" + hits[0]!.id : null;
  };
  return [resolve(parts[0]!), resolve(parts[1]!)];
}
