/**
 * Gemerkte Geräteauswahl (Kamera / Mikrofon) für Webdarts.
 * Wird im Camtest gesetzt und von Lobby-Audio + Match-Video verwendet.
 */
const CAM_KEY = "wd.camDeviceId";
const MIC_KEY = "wd.micDeviceId";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}
function write(key: string, val: string | null) {
  try {
    if (val) localStorage.setItem(key, val);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const getCamDeviceId = () => read(CAM_KEY);
export const getMicDeviceId = () => read(MIC_KEY);
export const setCamDeviceId = (id: string | null) => write(CAM_KEY, id);
export const setMicDeviceId = (id: string | null) => write(MIC_KEY, id);

/**
 * LiveKit-Video-Aufnahmeoptionen: gemerkte Kamera + fester 720p/24fps-Deckel,
 * damit das Senden (WebRTC-Upstream) nicht den Rest der Verbindung auslastet.
 */
export function videoCaptureOpts(): { deviceId?: string; resolution: { width: number; height: number; frameRate: number } } {
  const id = getCamDeviceId();
  const resolution = { width: 1280, height: 720, frameRate: 24 };
  return id ? { deviceId: id, resolution } : { resolution };
}
export function audioCaptureOpts(): true | { deviceId: string } {
  const id = getMicDeviceId();
  return id ? { deviceId: id } : true;
}
