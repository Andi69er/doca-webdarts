import { useEffect, useRef } from "react";
import { scoreboard, type MatchState } from "@webdarts/engine";

const SOUND_KEY = "wd:sound";

export function turnSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}
export function setTurnSound(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

function beep() {
  if (!turnSoundEnabled()) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => ctx.close();
  } catch {
    /* Audio nicht verfügbar */
  }
}

/**
 * Signal, wenn der eigene Spieler an die Reihe kommt: kurzer Ton + Tab-Titel
 * blinkt, bis der Tab wieder aktiv ist oder der Zug weiter ist.
 */
export function useTurnAlert(match: MatchState, myId: string | null, active: boolean) {
  const wasMyTurn = useRef(false);
  const baseTitle = useRef(document.title);
  const flashRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const myTurn =
      active && match.phase === "playing" && scoreboard(match).thrower?.playerId === myId;

    const stopFlash = () => {
      if (flashRef.current) clearInterval(flashRef.current);
      flashRef.current = null;
      document.title = baseTitle.current;
    };

    if (myTurn && !wasMyTurn.current) {
      beep();
      if (document.hidden) {
        let on = false;
        flashRef.current = setInterval(() => {
          on = !on;
          document.title = on ? "🎯 Du bist am Wurf!" : baseTitle.current;
        }, 900);
      }
    }
    if (!myTurn && wasMyTurn.current) stopFlash();

    wasMyTurn.current = myTurn;

    const onVisible = () => {
      if (!document.hidden) stopFlash();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [match, myId, active]);

  useEffect(() => {
    return () => {
      if (flashRef.current) clearInterval(flashRef.current);
      document.title = baseTitle.current;
    };
  }, []);
}
