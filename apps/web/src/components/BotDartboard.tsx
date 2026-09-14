import { useEffect, useRef } from "react";
import type { Dart } from "@webdarts/engine";
import { DartboardRenderer } from "../dartboardRenderer";

/** Zeitabstand zwischen zwei einfliegenden Darts (muss zur CSS-Animation
 *  `bot-dart-fly-in` in styles.css passen - siehe dort). Auch von
 *  VideoStage.tsx importiert, um die Großansicht passend lang zu halten. */
export const BOT_DART_STAGGER_MS = 550;
/** Dauer der Flugbahn-Animation je Dart (Wert aus der CSS-Animation). */
export const BOT_DART_FLIGHT_MS = 850;

/** "T20", "D16", "20", "SB" (Single Bull/25), "BE" (Bullseye/50), "Miss". */
function dartToSegmentLabel(d: Dart): string {
  if (d.value === 0) return "Miss";
  if (d.value === 25) return d.multiplier === 2 ? "BE" : "SB";
  return (d.multiplier === 3 ? "T" : d.multiplier === 2 ? "D" : "") + d.value;
}

/**
 * Mini-Dartscheibe im Bot-Videofenster (ersetzt dort das fehlende Kamerabild).
 * `visitKey` triggert eine neue Animation NUR bei einer echt neuen Aufnahme
 * (z.B. `leg.visits.length`) - reine Referenzänderungen von `darts` durch
 * unrelated Raum-Updates (Chat etc.) sollen die Flugbahn nicht neu abspielen.
 */
export function BotDartboard({ darts, visitKey }: { darts: Dart[]; visitKey: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DartboardRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = new DartboardRenderer(containerRef.current);
    rendererRef.current = renderer;
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.clearDarts();
    darts.forEach((d, i) => {
      setTimeout(() => renderer.addDart(dartToSegmentLabel(d)), i * BOT_DART_STAGGER_MS);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitKey]);

  return <div ref={containerRef} className="bot-dartboard-container" />;
}
