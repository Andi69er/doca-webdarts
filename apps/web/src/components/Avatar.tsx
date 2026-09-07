import { useState } from "react";

/** Rundes Profilbild mit Initialen-Fallback (Mitglied / PDC-Star / Bot). */
export function Avatar({
  src,
  name,
  size = 22,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (src && !failed) {
    return (
      <img
        className="wd-avatar"
        src={src}
        alt=""
        style={style}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className="wd-avatar wd-avatar-fallback" style={style} aria-hidden="true">
      {name.trim().slice(0, 2).toUpperCase() || "?"}
    </span>
  );
}
