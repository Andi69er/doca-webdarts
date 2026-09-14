/**
 * Mini-Dartscheibe fürs Bot-Videofenster - portiert & optisch aufgewertet aus
 * doca.at `js/scorer/dartboard.js` (DOCA-Trainer). Gleiche Positions-/
 * Flugbahn-Mathematik wie im Original (bewusst unverändert), aber mit
 * Farbverläufen/Schatten für einen fotorealistischeren Eindruck statt
 * flacher Vektor-Flächen. Reine SVG/DOM-Klasse (kein React-State-Krempel),
 * wird von BotDartboard.tsx per useRef/useEffect eingebunden.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/** Dauer der Flugbahn-Animation - MUSS zu `bot-dart-fly-in` in styles.css passen. */
export const DART_FLIGHT_MS = 850;
/** Echte Pause NACH der gelandeten Flugbahn, bevor der nächste Dart startet -
 *  kein Mensch wirft 3 Darts in unter 2 Sekunden. */
const DART_PAUSE_AFTER_LANDING_MS = 1250;
/** Zeitabstand zwischen zwei einfliegenden Darts (= Flugbahn + Pause danach).
 *  Von BotDartboard.tsx und VideoStage.tsx importiert (Großansicht-Haltezeit),
 *  damit alles synchron bleibt. */
export const DART_STAGGER_MS = DART_FLIGHT_MS + DART_PAUSE_AFTER_LANDING_MS;
/** Anteil der Animation, bei dem der Dart optisch "landet" (siehe 55%-Keyframe
 *  in styles.css) - erst dann darf das getroffene Feld aufleuchten. */
const DART_IMPACT_FRACTION = 0.55;

export class DartboardRenderer {
  private svg: SVGSVGElement;
  private readonly center = 225;
  private readonly radius = 200;
  private dartCounter = 0;

  constructor(container: HTMLElement) {
    this.svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    this.svg.setAttribute("viewBox", "0 0 450 450");
    this.svg.classList.add("bot-dartboard-svg");
    this.buildDefs();
    this.render();
    container.appendChild(this.svg);
  }

  private buildDefs(): void {
    const defs = document.createElementNS(SVG_NS, "defs");

    const radial = (
      id: string,
      stops: { off: string; col: string; op?: number }[],
      cx = "38%",
      cy = "32%",
    ) => {
      const g = document.createElementNS(SVG_NS, "radialGradient");
      g.setAttribute("id", id);
      g.setAttribute("cx", cx);
      g.setAttribute("cy", cy);
      g.setAttribute("r", "75%");
      for (const s of stops) {
        const stop = document.createElementNS(SVG_NS, "stop");
        stop.setAttribute("offset", s.off);
        stop.setAttribute("stop-color", s.col);
        if (s.op !== undefined) stop.setAttribute("stop-opacity", String(s.op));
        g.appendChild(stop);
      }
      defs.appendChild(g);
    };

    radial("segBlack", [
      { off: "0%", col: "#3a3a3a" },
      { off: "60%", col: "#1a1a1a" },
      { off: "100%", col: "#050505" },
    ]);
    radial("segWhite", [
      { off: "0%", col: "#ffffff" },
      { off: "60%", col: "#efe6d2" },
      { off: "100%", col: "#c9bfa5" },
    ]);
    radial("segRed", [
      { off: "0%", col: "#e94b4b" },
      { off: "55%", col: "#b71c1c" },
      { off: "100%", col: "#6e0f0f" },
    ]);
    radial("segGreen", [
      { off: "0%", col: "#3fae52" },
      { off: "55%", col: "#1b5e20" },
      { off: "100%", col: "#0d3410" },
    ]);
    radial("bullOuter", [
      { off: "0%", col: "#3fae52" },
      { off: "70%", col: "#1b5e20" },
      { off: "100%", col: "#0a2a0d" },
    ], "42%", "38%");
    radial("bullInner", [
      { off: "0%", col: "#ff6b5b" },
      { off: "55%", col: "#c1121f" },
      { off: "100%", col: "#6b0a0a" },
    ], "38%", "34%");

    // Metall-Nummernring (gebürstetes Stahl-Band).
    const metal = document.createElementNS(SVG_NS, "linearGradient");
    metal.setAttribute("id", "metalRing");
    metal.setAttribute("x1", "0%");
    metal.setAttribute("y1", "0%");
    metal.setAttribute("x2", "100%");
    metal.setAttribute("y2", "100%");
    [
      { off: "0%", col: "#8a8f96" },
      { off: "25%", col: "#e8ebee" },
      { off: "50%", col: "#6d7278" },
      { off: "75%", col: "#d9dce0" },
      { off: "100%", col: "#5a5e63" },
    ].forEach((s) => {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", s.off);
      stop.setAttribute("stop-color", s.col);
      metal.appendChild(stop);
    });
    defs.appendChild(metal);

    // Holz-Umrandung (montiertes Board an der Wand).
    const wood = document.createElementNS(SVG_NS, "radialGradient");
    wood.setAttribute("id", "woodRing");
    wood.setAttribute("cx", "40%");
    wood.setAttribute("cy", "35%");
    wood.setAttribute("r", "75%");
    [
      { off: "0%", col: "#8a5a34" },
      { off: "55%", col: "#5e3a1e" },
      { off: "100%", col: "#2e1c0f" },
    ].forEach((s) => {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", s.off);
      stop.setAttribute("stop-color", s.col);
      wood.appendChild(stop);
    });
    defs.appendChild(wood);

    // Sanftes Ambient-Licht hinter dem ganzen Board (Spotlight-Gefühl im Videofenster).
    const glow = document.createElementNS(SVG_NS, "radialGradient");
    glow.setAttribute("id", "ambientGlow");
    glow.setAttribute("cx", "45%");
    glow.setAttribute("cy", "38%");
    glow.setAttribute("r", "65%");
    [
      { off: "0%", col: "#ffffff", op: 0.16 },
      { off: "100%", col: "#ffffff", op: 0 },
    ].forEach((s) => {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", s.off);
      stop.setAttribute("stop-color", s.col);
      stop.setAttribute("stop-opacity", String(s.op));
      glow.appendChild(stop);
    });
    defs.appendChild(glow);

    this.svg.appendChild(defs);
  }

  private render(): void {
    // Ambient-Glow-Fläche hinter allem.
    this.svg.appendChild(this.circle(this.center, this.center, this.radius + 45, "url(#ambientGlow)"));

    // Holz-Umrandung.
    this.svg.appendChild(this.circle(this.center, this.center, this.radius + 22, "url(#woodRing)"));
    // Metall-Nummernring.
    this.svg.appendChild(this.circle(this.center, this.center, this.radius + 13, "url(#metalRing)"));
    // Schwarzer Innenring, auf dem die Zahlen sitzen.
    this.svg.appendChild(this.circle(this.center, this.center, this.radius + 2, "#111"));

    SEGMENTS.forEach((num, i) => this.renderSegment(num, i * 18 - 90 - 9, i));

    this.svg.appendChild(this.circle(this.center, this.center, 16, "url(#bullOuter)", "segment-SB segment"));
    this.svg.appendChild(this.circle(this.center, this.center, 6.35, "url(#bullInner)", "segment-BE segment"));
    // Kleiner Glanzpunkt auf dem Bull für den 3D-Effekt.
    const glint = document.createElementNS(SVG_NS, "circle");
    glint.setAttribute("cx", String(this.center - 2));
    glint.setAttribute("cy", String(this.center - 2));
    glint.setAttribute("r", "1.6");
    glint.setAttribute("fill", "rgba(255,255,255,0.55)");
    glint.setAttribute("pointer-events", "none");
    this.svg.appendChild(glint);

    this.renderSpider();
    SEGMENTS.forEach((num, i) => this.renderNumber(num, i * 18 - 90));
  }

  private renderSpider(): void {
    for (let i = 0; i < 20; i++) {
      const angle = ((i * 18 - 90 - 9) * Math.PI) / 180;
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(this.center + 16 * Math.cos(angle)));
      line.setAttribute("y1", String(this.center + 16 * Math.sin(angle)));
      line.setAttribute("x2", String(this.center + 170 * Math.cos(angle)));
      line.setAttribute("y2", String(this.center + 170 * Math.sin(angle)));
      line.classList.add("bot-dartboard-wire");
      this.svg.appendChild(line);
    }
    [6.35, 16, 99, 107, 162, 170].forEach((r) => {
      this.svg.appendChild(this.circle(this.center, this.center, r, "none", "bot-dartboard-wire"));
    });
  }

  private renderSegment(num: number, startAngle: number, i: number): void {
    const endAngle = startAngle + 18;
    const fill = i % 2 === 0 ? "url(#segBlack)" : "url(#segWhite)";
    const altFill = i % 2 === 0 ? "url(#segRed)" : "url(#segGreen)";

    this.svg.appendChild(this.arc(162, 170, startAngle, endAngle, altFill, `seg-D${num}`, `segment-D${num} segment`));
    this.svg.appendChild(this.arc(99, 107, startAngle, endAngle, altFill, `seg-T${num}`, `segment-T${num} segment`));
    this.svg.appendChild(
      this.arc(107, 162, startAngle, endAngle, fill, `seg-S${num}-O`, `segment-${num} segment-S${num} segment`),
    );
    this.svg.appendChild(
      this.arc(16, 99, startAngle, endAngle, fill, `seg-S${num}-I`, `segment-${num} segment-S${num} segment`),
    );
  }

  private renderNumber(num: number, angle: number): void {
    const rad = (angle * Math.PI) / 180;
    const x = this.center + (this.radius - 12) * Math.cos(rad);
    const y = this.center + (this.radius - 12) * Math.sin(rad);
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(y));
    text.classList.add("bot-dartboard-number");
    text.textContent = String(num);
    this.svg.appendChild(text);
  }

  private circle(cx: number, cy: number, r: number, fill: string, className = ""): SVGCircleElement {
    const c = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
    c.setAttribute("cx", String(cx));
    c.setAttribute("cy", String(cy));
    c.setAttribute("r", String(r));
    if (className) c.setAttribute("class", className);
    else c.setAttribute("fill", fill);
    if (className && fill) c.style.fill = fill;
    return c;
  }

  private arc(
    innerR: number,
    outerR: number,
    startAngle: number,
    endAngle: number,
    fill: string,
    id: string,
    className: string,
  ): SVGPathElement {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = this.center + outerR * Math.cos(startRad);
    const y1 = this.center + outerR * Math.sin(startRad);
    const x2 = this.center + outerR * Math.cos(endRad);
    const y2 = this.center + outerR * Math.sin(endRad);
    const x3 = this.center + innerR * Math.cos(endRad);
    const y3 = this.center + innerR * Math.sin(endRad);
    const x4 = this.center + innerR * Math.cos(startRad);
    const y4 = this.center + innerR * Math.sin(startRad);
    const path = document.createElementNS(SVG_NS, "path") as SVGPathElement;
    path.setAttribute(
      "d",
      `M ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 0 0 ${x4} ${y4} Z`,
    );
    path.setAttribute("id", id);
    path.setAttribute("class", className);
    path.style.fill = fill;
    return path;
  }

  /** Zeichnet einen Dart ein. `segmentLabel`: "T20", "D16", "20", "SB", "BE", "Miss". */
  addDart(segmentLabel: string): void {
    let r: number;
    let angle: number;
    let specificId: string | null = null;

    if (segmentLabel === "Miss" || segmentLabel === "0") {
      r = 210 + Math.random() * 10;
      angle = Math.random() * 360;
    } else if (segmentLabel === "BE") {
      r = Math.random() * 5;
      angle = Math.random() * 360;
    } else if (segmentLabel === "SB") {
      r = 10 + Math.random() * 5;
      angle = Math.random() * 360;
    } else {
      const match = /([TD]?)(\d+)/.exec(segmentLabel);
      if (!match) return;
      const type = match[1];
      const num = parseInt(match[2]!, 10);
      const segIndex = SEGMENTS.indexOf(num);
      if (segIndex === -1) return;
      angle = segIndex * 18 - 90 - (Math.random() * 10 - 5);
      if (type === "T") {
        r = 103;
        specificId = `seg-T${num}`;
      } else if (type === "D") {
        r = 166;
        specificId = `seg-D${num}`;
      } else {
        const outer = Math.random() > 0.4;
        r = outer ? (107 + 162) / 2 : (16 + 99) / 2;
        specificId = outer ? `seg-S${num}-O` : `seg-S${num}-I`;
      }
    }

    const rad = (angle * Math.PI) / 180;
    const x = this.center + r * Math.cos(rad);
    const y = this.center + r * Math.sin(rad);
    const dx = x - this.center;
    const dy = y - this.center;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const group = document.createElementNS(SVG_NS, "g");
    group.classList.add("bot-dart-marker");
    // Die Flugbahn läuft entlang derselben Achse (dx/dist, dy/dist), auf der auch
    // die Dart-Form selbst gezeichnet ist (Spitze innen, Flights außen) - der Dart
    // fliegt also entlang seiner eigenen Längsachse ins Ziel, statt immer aus einer
    // fixen Bildschirmrichtung. So sieht die Einflugrichtung für JEDEN Treffer
    // (egal ob oben, unten oder seitlich am Board) konsistent und plausibel aus.
    const flyDist = 250 + Math.random() * 50;
    group.style.setProperty("--fly-x", `${(dx / dist) * flyDist}px`);
    group.style.setProperty("--fly-y", `${(dy / dist) * flyDist}px`);
    group.style.setProperty("--fly-rot", `${Math.random() * 14 - 7}deg`);

    // Einschlag-Schatten auf dem Board (3D-Eindruck: Dart steckt drin).
    const impact = document.createElementNS(SVG_NS, "ellipse");
    impact.setAttribute("cx", String(x));
    impact.setAttribute("cy", String(y + 1));
    impact.setAttribute("rx", "5");
    impact.setAttribute("ry", "2.4");
    impact.setAttribute("fill", "rgba(0,0,0,0.55)");
    group.appendChild(impact);

    // Perpendikulare Achse zur Flugrichtung - für die Breite von Spitze/Barrel
    // und für den Metall-Glanzstreifen, der IMMER quer zur Dart-Längsachse
    // laufen muss (nicht abhängig von der Einschlagrichtung am Board).
    const ux = dx / dist;
    const uy = dy / dist;
    const px = -uy;
    const py = ux;

    const pointLen = 18;
    const xP = x + ux * pointLen;
    const yP = y + uy * pointLen;
    // Stahlspitze als gefülltes, spitz zulaufendes Dreieck statt dünner Linie
    // mit unrealistischem Leuchtpunkt - sieht nach echtem Metall aus.
    const tipW = 2.2;
    const tip = document.createElementNS(SVG_NS, "path");
    tip.setAttribute(
      "d",
      `M ${x} ${y} L ${xP + px * tipW} ${yP + py * tipW} L ${xP - px * tipW} ${yP - py * tipW} Z`,
    );
    tip.setAttribute("fill", "#8d8d8d");
    tip.setAttribute("stroke", "#4a4a4a");
    tip.setAttribute("stroke-width", "0.4");
    group.appendChild(tip);

    const barrelLen = 35;
    const xB = xP + ux * barrelLen;
    const yB = yP + uy * barrelLen;
    const xM = xP + ux * barrelLen * 0.5;
    const yM = yP + uy * barrelLen * 0.5;
    const wTip = 1.6;
    const wMid = 3.4;
    const wEnd = 2;

    // Eigener, lokaler Glanzverlauf QUER zur Flugachse (nicht längs) - simuliert
    // den runden Metall-Zylinder, der über seine Breite hell-dunkel-hell glänzt,
    // und sieht dadurch aus JEDER Einschlagrichtung gleich plausibel aus.
    const gradId = `dartBarrelShine-${this.dartCounter++}`;
    const localDefs = document.createElementNS(SVG_NS, "defs");
    const shine = document.createElementNS(SVG_NS, "linearGradient");
    shine.setAttribute("id", gradId);
    shine.setAttribute("gradientUnits", "userSpaceOnUse");
    shine.setAttribute("x1", String(xM - px * wMid));
    shine.setAttribute("y1", String(yM - py * wMid));
    shine.setAttribute("x2", String(xM + px * wMid));
    shine.setAttribute("y2", String(yM + py * wMid));
    [
      { off: "0%", col: "#1a1a1a" },
      { off: "25%", col: "#8a8a8a" },
      { off: "50%", col: "#fdfdfd" },
      { off: "75%", col: "#8a8a8a" },
      { off: "100%", col: "#1a1a1a" },
    ].forEach((s) => {
      const stop = document.createElementNS(SVG_NS, "stop");
      stop.setAttribute("offset", s.off);
      stop.setAttribute("stop-color", s.col);
      shine.appendChild(stop);
    });
    localDefs.appendChild(shine);
    group.appendChild(localDefs);

    // Tailliertes Barrel (Linsenform: schmal-dick-schmal) statt einer flachen
    // Strich-Linie - eher wie ein echter Dart-Barrel im Profil.
    const barrel = document.createElementNS(SVG_NS, "path");
    barrel.setAttribute(
      "d",
      `M ${xP + px * wTip} ${yP + py * wTip} ` +
        `Q ${xM + px * wMid} ${yM + py * wMid} ${xB + px * wEnd} ${yB + py * wEnd} ` +
        `L ${xB - px * wEnd} ${yB - py * wEnd} ` +
        `Q ${xM - px * wMid} ${yM - py * wMid} ${xP - px * wTip} ${yP - py * wTip} Z`,
    );
    barrel.setAttribute("fill", `url(#${gradId})`);
    barrel.setAttribute("stroke", "#2a2a2a");
    barrel.setAttribute("stroke-width", "0.4");
    group.appendChild(barrel);

    const shaftLen = 28;
    const xS = xB + (dx / dist) * shaftLen;
    const yS = yB + (dy / dist) * shaftLen;
    const shaft = document.createElementNS(SVG_NS, "path");
    shaft.setAttribute("d", `M ${xB} ${yB} L ${xS} ${yS}`);
    shaft.setAttribute("stroke", "#ccc");
    shaft.setAttribute("stroke-width", "2.3");
    group.appendChild(shaft);

    const fLen = 25;
    const fWidth = 22;
    const fAngle = (Math.atan2(yS - yB, xS - xB) * 180) / Math.PI;
    const wing = (scaleY: number, color: string) => {
      const w = document.createElementNS(SVG_NS, "path");
      w.setAttribute(
        "d",
        `M 0 0 L ${fLen * 0.3} ${-fWidth / 2} L ${fLen} ${-fWidth / 2} L ${fLen * 0.8} 0 L ${fLen} ${fWidth / 2} L ${fLen * 0.3} ${fWidth / 2} Z`,
      );
      w.setAttribute("fill", color);
      w.setAttribute("stroke", "rgba(255,255,255,0.35)");
      w.setAttribute("stroke-width", "0.5");
      w.setAttribute("opacity", "0.92");
      w.setAttribute("transform", `translate(${xS}, ${yS}) rotate(${fAngle}) scale(1, ${scaleY})`);
      return w;
    };
    group.appendChild(wing(0.6, "#a31414"));
    group.appendChild(wing(-0.6, "#f4433f"));

    this.svg.appendChild(group);

    const el = specificId ? this.svg.getElementById(specificId) : this.svg.querySelector(`.segment-${segmentLabel}`);
    if (el) {
      // Erst aufleuchten, wenn der Dart optisch auch wirklich eingeschlagen
      // ist (nicht schon beim Start der Flugbahn).
      setTimeout(() => {
        el.classList.add("segment-hit");
        setTimeout(() => el.classList.remove("segment-hit"), 1200);
      }, DART_FLIGHT_MS * DART_IMPACT_FRACTION);
    }
  }

  clearDarts(): void {
    this.svg.querySelectorAll(".bot-dart-marker").forEach((d) => d.remove());
  }

  destroy(): void {
    this.svg.remove();
  }
}
