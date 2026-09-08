import { embed } from "./embed";

/**
 * Karriere-Grundwerte eines Mitglieds aus dem DOCA-Mitgliederportal
 * (geliefert von webspiele/webdarts/stats.php, gleiche Domain).
 */
export interface PortalStats {
  matches: number;
  average: number;
  checkoutPct: number;
  shortestLeg: number | null;
  highestFinish: number;
}

/** Holt die Portal-Werte für mehrere DOCA-User-IDs auf einmal. */
export async function fetchPortalStats(uids: string[]): Promise<Record<string, PortalStats>> {
  if (!embed || uids.length === 0) return {};
  try {
    const res = await fetch(
      `${embed.baseUrl}/webspiele/webdarts/stats.php?ids=${encodeURIComponent(uids.join(","))}`,
      { credentials: "same-origin" },
    );
    if (!res.ok) return {};
    const json = (await res.json()) as { stats?: Record<string, PortalStats> };
    return json.stats ?? {};
  } catch {
    return {};
  }
}
