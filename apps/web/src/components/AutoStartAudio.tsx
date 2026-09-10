import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";

/**
 * Startet die Audiowiedergabe automatisch – sofort und spätestens bei der
 * ersten Nutzer-Interaktion irgendwo in der App. So muss niemand extra
 * „Ton aktivieren" klicken (der Button bleibt als Fallback).
 */
export function AutoStartAudio() {
  const room = useRoomContext();

  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      room
        .startAudio()
        .then(() => {
          done = true;
        })
        .catch(() => {});
    };

    go(); // sofort versuchen (klappt, wenn schon interagiert wurde)

    const opts = { capture: true } as const;
    window.addEventListener("pointerdown", go, opts);
    window.addEventListener("keydown", go, opts);
    window.addEventListener("touchstart", go, opts);
    return () => {
      window.removeEventListener("pointerdown", go, opts);
      window.removeEventListener("keydown", go, opts);
      window.removeEventListener("touchstart", go, opts);
    };
  }, [room]);

  return null;
}
