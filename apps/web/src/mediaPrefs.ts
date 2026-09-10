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

/** LiveKit-Video-Optionen aus der gemerkten Kamera (oder `true`). */
export function videoCaptureOpts(): true | { deviceId: string } {
  const id = getCamDeviceId();
  return id ? { deviceId: id } : true;
}
export function audioCaptureOpts(): true | { deviceId: string } {
  const id = getMicDeviceId();
  return id ? { deviceId: id } : true;
}
