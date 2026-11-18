/* Jemput sticker library: original drawings that show in natural colours, or in any single colour or foil.
   Drawings use colour tokens like {P} (petal), {G} (leaf) and {A} (accent). For natural colours each token gets
   the sticker's own palette, with soft shading ({SD}) and highlights ({HL}) for depth. For one colour, every token
   becomes black and the shading disappears, so the drawing can be used as a mask and filled with any colour.
   Each entry: label, category, viewBox width and height, palette and the SVG content. */

const r2 = (n) => Math.round(n * 10) / 10;
const rad = (d) => (d * Math.PI) / 180;
const op = (o) => (o < 1 ? ` fill-opacity="${o}"` : "");
// n copies of an element rotated evenly around (cx, cy)
const around = (n, cx, cy, el, start = 0) => Array.from({ length: n }, (_, i) => `<g transform="rotate(${r2(start + (360 / n) * i)} ${cx} ${cy})">${el}</g>`).join("");
// a shape filled with a colour, then shaded at the bottom and lit at the top-left, so it looks rounded
const shaded = (d, c, extra = "", { sd = true, hl = true } = {}) => `<path d="${d}" fill="{${c}}"${extra}/>${sd ? `<path d="${d}" fill="{SD}"${extra}/>` : ""}${hl ? `<path d="${d}" fill="{HL}"${extra}/>` : ""}`;
const stroke = (d, w = 2, c = "GD", o = 1) => `<path d="${d}" fill="none" stroke="{${c}}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${o < 1 ? ` stroke-opacity="${o}"` : ""}/>`;
const dot = (x, y, r, c = "A", o = 1) => `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(r)}" fill="{${c}}"${op(o)}/>`;
// a leaf pointing along +x from (x, y): shaded blade, a midrib and a few side veins
const leafPath = (l, w) => `M0 0C${r2(l * 0.3)} ${r2(-w)} ${r2(l * 0.75)} ${r2(-w * 0.8)} ${l} 0C${r2(l * 0.75)} ${r2(w * 0.8)} ${r2(l * 0.3)} ${r2(w)} 0 0Z`;
function leaf(x, y, angle, l, w, { c = "G", o = 1, veins = l > 13 } = {}) {
  const v = veins ? `<path d="M${r2(l * 0.05)} 0L${r2(l * 0.88)} 0${[0.3, 0.5, 0.7].map((t) => `M${r2(l * t)} 0L${r2(l * (t + 0.14))} ${r2(-w * 0.55)}M${r2(l * t)} 0L${r2(l * (t + 0.14))} ${r2(w * 0.55)}`).join("")}" fill="none" stroke="{GL}" stroke-width="${r2(Math.max(0.5, w * 0.12))}" stroke-linecap="round" stroke-opacity=".7"/>` : "";
  return `<g transform="translate(${r2(x)} ${r2(y)}) rotate(${r2(angle)})"${op(o)}>${shaded(leafPath(l, w), c)}${v}</g>`;
}
// a five-petal blossom with a darker heart and stamens
function blossom(x, y, r, { c = "P", o = 1 } = {}) {
  const petal = `M0 0C${r2(-r * 0.5)} ${r2(-r * 0.25)} ${r2(-r * 0.55)} ${r2(-r * 0.95)} 0 ${r2(-r)}C${r2(r * 0.55)} ${r2(-r * 0.95)} ${r2(r * 0.5)} ${r2(-r * 0.25)} 0 0Z`;
  return `<g transform="translate(${r2(x)} ${r2(y)})"${op(o)}>${around(5, 0, 0, shaded(petal, c, "", { sd: false }))}${around(5, 0, 0, `<path d="M0 0L0 ${r2(-r * 0.45)}" stroke="{PD}" stroke-width="${r2(r * 0.07)}" stroke-linecap="round"/>`, 36)}<circle r="${r2(r * 0.24)}" fill="{A}"/>${around(5, 0, 0, `<circle cx="0" cy="${r2(-r * 0.36)}" r="${r2(r * 0.07)}" fill="{AD}"/>`, 36)}</g>`;
}
// points along a quadratic curve, for placing leaves on a stem
function along(p0, p1, p2, n) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n, mt = 1 - t;
    const x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0], y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1];
    const dx = 2 * mt * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), dy = 2 * mt * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    return { x, y, a: (Math.atan2(dy, dx) * 180) / Math.PI, t };
  });
}
function starPts(cx, cy, n, ro, ri, start = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rad(start + (180 / n) * i); pts.push(`${r2(cx + r * Math.cos(a))} ${r2(cy + r * Math.sin(a))}`); }
  return "M" + pts.join("L") + "Z";
}
const ring = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

/* ---------- florals ---------- */
const rose = (() => {
  // a cupped bloom: wide outer petals, a cup, curled inner petals, two leaves
  const outer = "M50 84C26 84 12 68 14 50C16 40 24 36 30 40C26 50 34 64 50 66C66 64 74 50 70 40C76 36 84 40 86 50C88 68 74 84 50 84Z";
  const cup = "M50 70C34 70 24 58 26 44C28 32 38 26 50 26C62 26 72 32 74 44C76 58 66 70 50 70Z";
  const inner = "M50 58C40 58 35 50 37 42C39 35 45 32 52 33C60 34 64 41 62 48C60 55 55 58 50 58Z";
  return leaf(46, 84, 158, 30, 10) + leaf(54, 84, 22, 28, 9) + stroke("M50 84V98", 2.6, "GD")
    + shaded(outer, "PD") + shaded(cup, "P") + shaded(inner, "PD", "", { hl: false })
    + stroke("M38 44C40 34 48 30 56 32C64 34 66 44 60 50C54 56 44 54 42 46C40 40 46 36 52 38C56 40 56 46 52 47", 2.4, "PL")
    + stroke("M30 52C36 62 46 66 56 64M70 52C66 60 60 64 54 66", 1.6, "PL", 0.7);
})();
const peony = (() => {
  const petal = (r, rx, ry) => `M50 ${50 - r + ry}C${50 - rx} ${50 - r + ry * 0.4} ${50 - rx * 0.9} ${50 - r - ry * 0.8} 50 ${50 - r - ry}C${50 + rx * 0.9} ${50 - r - ry * 0.8} ${50 + rx} ${50 - r + ry * 0.4} 50 ${50 - r + ry}Z`;
  const layer = (n, r, rx, ry, c, start) => around(n, 50, 50, shaded(petal(r, rx, ry), c, "", { hl: c !== "PD" }), start);
  return layer(10, 30, 14, 16, "PD", 0) + layer(8, 20, 12, 14, "P", 20) + layer(6, 10, 9, 10, "PL", 0)
    + dot(50, 50, 6, "A") + around(12, 50, 50, `<circle cx="50" cy="42" r="1.5" fill="{AD}"/>`, 15);
})();
const frangipani = (() => {
  // five overlapping petals, white with a yellow throat
  const petal = "M50 50C38 40 36 14 54 10C72 8 70 36 50 50Z";
  const throat = "M50 50C46 42 46 32 51 26C55 32 55 42 50 50Z";
  return around(5, 50, 50, shaded(petal, "P") + `<path d="${throat}" fill="{A}" fill-opacity=".85"/>` + stroke("M50 50C46 40 47 24 53 16", 1, "PD", 0.6), 8) + dot(50, 50, 5, "AD");
})();
const hibiscus = (() => {
  const petal = "M50 50C34 44 26 22 40 12C46 8 54 10 56 14C64 8 76 14 72 26C70 36 60 46 50 50Z";
  return around(5, 50, 50, shaded(petal, "P") + stroke("M50 50L52 22M50 50L44 26M50 50L60 28", 0.9, "PD", 0.7) + `<path d="M50 50L54 40L46 40Z" fill="{PD}"/>`, 0)
    + stroke("M50 50C58 40 66 30 74 20", 2.6, "A") + dot(74, 20, 3.4, "AD") + dot(70, 16, 2.2, "A") + dot(78, 24, 2.2, "A") + dot(72, 25, 1.8, "A") + dot(50, 50, 5, "PD");
})();
const daisy = (() => {
  const petal = "M50 48C46 40 46 20 50 10C54 20 54 40 50 48Z";
  return around(16, 50, 50, shaded(petal, "P", "", { hl: false }) + `<path d="${petal}" fill="none" stroke="{PD}" stroke-width=".9"/>` + stroke("M50 44L50 16", 0.6, "PD", 0.8)) + around(16, 50, 50, `<path d="${petal}" fill="{P}" fill-opacity=".9" transform="rotate(11.25 50 50) scale(.92) translate(4.3 4.3)"/>`)
    + `<circle cx="50" cy="50" r="11" fill="{A}"/><circle cx="50" cy="50" r="11" fill="{SD}"/>` + around(14, 50, 50, `<circle cx="50" cy="43" r="1.2" fill="{AD}"/>`) + around(8, 50, 50, `<circle cx="50" cy="46" r="1" fill="{AD}"/>`, 22);
})();
const babysBreath = (() => {
  const stems = stroke("M50 98C50 70 48 50 42 30M49 70C58 56 66 44 74 34M48 56C38 46 30 40 22 36M45 42C50 32 56 22 60 12M43 34C36 26 30 18 28 8", 1.4, "GD");
  const pts = [[42, 30], [74, 34], [22, 36], [60, 12], [28, 8], [36, 22], [68, 22], [52, 20], [18, 26], [80, 26], [46, 10], [30, 30], [64, 40]];
  const puff = (x, y, r) => `<g transform="translate(${x} ${y})">${around(6, 0, 0, `<circle cx="0" cy="${r2(-r * 0.5)}" r="${r2(r * 0.5)}" fill="{P}"/>`)}<circle r="${r2(r * 0.5)}" fill="{PD}"/><circle r="${r2(r)}" fill="{HL}"/></g>`;
  return stems + leaf(50, 80, -130, 14, 3, { veins: false }) + leaf(50, 74, -50, 12, 3, { veins: false }) + pts.map(([x, y], i) => puff(x, y, 3.6 + (i % 3) * 0.8)).join("");
})();
const tulip = (() => {
  const back = "M34 30C34 50 42 58 50 58C58 58 66 50 66 30L58 38L50 24L42 38Z";
  const front = "M42 38L50 24L58 38C56 48 53 56 50 56C47 56 44 48 42 38Z";
  return stroke("M50 98C50 80 50 66 50 56", 3, "GD") + leaf(50, 92, -118, 36, 10) + leaf(50, 86, -58, 30, 9)
    + shaded(back, "PD") + shaded(front, "P") + stroke("M50 28V52", 0.8, "PL", 0.6);
})();
const cherryBranch = (() => {
  const br = stroke("M4 70C40 60 70 50 112 30C130 22 146 20 156 18", 3.4, "B") + stroke("M60 54C66 40 74 30 86 24M112 30C116 42 124 50 136 54", 2.4, "B");
  const bud = (x, y, a) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="4.4" transform="rotate(${a} ${x} ${y})" fill="{PD}"/>`;
  return br + leaf(20, 66, -20, 16, 5) + leaf(96, 36, -60, 14, 4.5) + blossom(86, 24, 13) + blossom(136, 54, 12) + blossom(150, 16, 11, { o: 0.92 }) + blossom(40, 58, 10, { o: 0.92 })
    + blossom(106, 38, 8) + bud(122, 22, 30) + bud(70, 47, -20) + bud(146, 30, 60);
})();
const lotus = (() => {
  const p = (a, l, w, c) => `<g transform="rotate(${a} 50 80)">${shaded(`M50 80C${50 - w} ${80 - l * 0.4} ${50 - w * 0.6} ${80 - l * 0.9} 50 ${80 - l}C${50 + w * 0.6} ${80 - l * 0.9} ${50 + w} ${80 - l * 0.4} 50 80Z`, c)}${stroke(`M50 78L50 ${80 - l * 0.8}`, 0.8, "PD", 0.5)}</g>`;
  return shaded("M8 84C24 94 76 94 92 84C80 78 20 78 8 84Z", "G") + p(-72, 34, 12, "PD") + p(72, 34, 12, "PD") + p(-40, 46, 14, "P") + p(40, 46, 14, "P") + p(0, 58, 16, "PL")
    + dot(50, 74, 4, "A");
})();
const jasmine = (() => {
  const s = stroke("M6 60C40 54 80 40 154 20", 2, "GD") + stroke("M60 50C64 40 70 34 78 30M104 38C106 48 112 54 120 56", 1.5, "GD");
  const fl = (x, y, r) => `<g transform="translate(${x} ${y})">${shaded(starPts(0, 0, 5, r, r * 0.45), "P", "", { sd: false })}<path d="${starPts(0, 0, 5, r, r * 0.45)}" fill="none" stroke="{PD}" stroke-width=".7"/><circle r="${r2(r * 0.2)}" fill="{A}"/></g>`;
  const bud = (x, y, a) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="5" transform="rotate(${a} ${x} ${y})" fill="{PD}"/>`;
  return s + leaf(92, 36, -30, 18, 6) + leaf(20, 58, 160, 16, 5) + leaf(130, 30, 20, 15, 5) + fl(78, 30, 11) + fl(120, 56, 10) + fl(154, 20, 10) + fl(36, 56, 8) + bud(136, 26, 40) + bud(52, 50, -30);
})();

/* ---------- leaves and vines ---------- */
const vine = (() => {
  const d = "M4 40C34 6 60 6 80 30C100 54 126 54 150 30C166 14 182 12 196 20";
  const ls = [[22, 22, -60, 1], [40, 12, 20, -1], [62, 16, 60, 1], [84, 36, 40, -1], [104, 48, -10, 1], [126, 46, -30, -1], [146, 32, -60, 1], [170, 16, -20, -1], [188, 16, 10, 1]];
  return stroke(d, 2.2, "GD") + ls.map(([x, y, a, s], i) => leaf(x, y, a + (s > 0 ? -60 : 60), 20 + (i % 2) * 4, 7, { c: i % 3 === 1 ? "GL2" : "G" })).join("") + stroke("M80 30c4-8 12-10 16-6c3 3 0 8-4 6", 1.3, "GD") + stroke("M150 30c-2-8 2-14 8-14c4 0 5 5 1 6", 1.3, "GD");
})();
const eucalyptus = (() => {
  const pts = along([10, 112], [36, 52], [104, 8], 8);
  return stroke("M10 112Q36 52 104 8", 2.2, "GD") + pts.map((p, i) => {
    const side = i % 2 ? 1 : -1, perp = rad(p.a + 90 * side), r = 10 - i * 0.6;
    const cx = p.x + Math.cos(perp) * (r + 2), cy = p.y + Math.sin(perp) * (r + 2);
    const d = `M${r2(cx - r)} ${r2(cy)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0`;
    return shaded(d, i % 2 ? "GL2" : "G") + stroke(`M${r2(p.x)} ${r2(p.y)}L${r2(cx)} ${r2(cy)}`, 0.8, "GL", 0.8);
  }).join("");
})();
const fern = (() => {
  const pts = along([60, 158], [56, 80], [60, 4], 14);
  return stroke("M60 158Q56 80 60 4", 2, "GD") + pts.map((p, i) => {
    const l = 8 + Math.sin(p.t * Math.PI) * 30 * (1 - p.t * 0.4);
    return leaf(p.x, p.y, p.a + 180 - 55, l, l * 0.22, { veins: false }) + leaf(p.x, p.y, p.a + 180 + 55, l, l * 0.22, { veins: false, c: "GL2" });
  }).join("");
})();
const olive = (() => {
  const pts = along([6, 50], [80, 20], [154, 34], 9);
  const fruit = (x, y, a) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="6.5" transform="rotate(${a} ${x} ${y})" fill="{A}"/><ellipse cx="${x}" cy="${y}" rx="5" ry="6.5" transform="rotate(${a} ${x} ${y})" fill="{HL}"/>`;
  return stroke("M6 50Q80 20 154 34", 1.8, "B") + pts.map((p, i) => leaf(p.x, p.y, p.a + (i % 2 ? -40 : 40), 22, 4.5, { c: i % 2 ? "GL2" : "G", veins: false })).join("") + fruit(62, 44, 20) + fruit(112, 18, -20) + fruit(88, 42, 10);
})();
const laurel = (() => {
  const cx = 60, cy = 56, R = 46;
  const branch = (s) => {
    const P = Array.from({ length: 10 }, (_, i) => 100 + i * 17).map((a) => [cx - s * R * Math.cos(rad(180 - a)), cy + R * Math.sin(rad(a))]);
    return stroke("M" + P.map((p) => `${r2(p[0])} ${r2(p[1])}`).join("L"), 1.8, "GD") + P.slice(0, -1).map((p, i) => {
      const q = P[i + 1], dir = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
      return leaf(p[0], p[1], dir - s * 38, 16, 5) + leaf(p[0], p[1], dir + s * 30, 12, 4, { c: "GL2" });
    }).join("");
  };
  return branch(1) + branch(-1);
})();
const wreath = (() => {
  const n = 22;
  return stroke("M50 8A42 42 0 1 1 49.9 8", 1.6, "GD") + Array.from({ length: n }, (_, i) => {
    const a = (360 / n) * i, x = 50 + 42 * Math.cos(rad(a)), y = 50 + 42 * Math.sin(rad(a));
    return leaf(x, y, a + 90 + (i % 2 ? 35 : -35), 12, 4, { c: i % 2 ? "GL2" : "G", veins: false });
  }).join("") + blossom(50, 8, 8) + blossom(14, 72, 6) + blossom(86, 72, 6);
})();
const monstera = (() => {
  const d = `M50 96C50 96 48 80 46 74C24 70 6 52 8 30C10 14 26 4 44 6C58 6 70 12 80 22C92 34 94 54 84 66C76 76 62 76 54 74C53 80 52 90 50 96Z
  M30 24C26 30 24 36 24 42L34 40C34 34 36 30 38 26Z M48 22C46 28 46 34 46 40L54 40C54 34 56 28 58 24Z M66 30C62 34 60 40 60 46L70 46C70 40 72 36 74 34Z M22 50C22 54 24 58 26 60L34 54C32 52 32 50 32 48Z M40 54C40 58 42 62 44 64L50 56C48 54 48 52 48 50Z M60 56C62 60 64 62 68 62L68 54C66 54 64 52 64 50Z`;
  return shaded(d, "G", ` fill-rule="evenodd"`) + stroke("M50 94C50 70 46 50 44 10M45 40L30 30M46 52L28 54M48 62L40 66M45 30L56 20M46 48L64 38M48 60L64 58", 1.1, "GL", 0.8);
})();
const hangingVine = (() => {
  const pts = along([30, 4], [10, 100], [34, 196], 10);
  return stroke("M4 4H56", 2.4, "B") + stroke("M30 4Q10 100 34 196", 2, "GD") + pts.map((p, i) => leaf(p.x, p.y, p.a + (i % 2 ? -70 : 70), 22, 7.5, { c: i % 3 === 1 ? "GL2" : "G" })).join("") + blossom(34, 196, 8) + blossom(18, 120, 6);
})();

/* ---------- lines and frames (natural colours: gilded) ---------- */
const flourish = stroke("M100 20C88 6 70 6 66 16C62 26 76 30 80 22M100 20C112 6 130 6 134 16C138 26 124 30 120 22M66 16C54 28 30 26 6 20M134 16C146 28 170 26 194 20", 2, "P")
  + shaded("M100 11L107 20L100 29L93 20Z", "P") + dot(40, 25, 2, "PD") + dot(160, 25, 2, "PD");
const swirlCorner = stroke("M6 94C6 46 46 6 94 6M6 70C6 36 36 6 70 6M24 94C18 70 30 50 50 46C66 42 72 58 62 64C54 68 48 60 54 56M94 24C70 18 50 30 46 50", 2, "P") + dot(94, 6, 3, "PD") + dot(6, 94, 3, "PD") + leaf(28, 28, -45, 16, 5);
const arch = shaded("M6 136V50A44 44 0 0 1 94 50V136Z M12 130V50A38 38 0 0 1 88 50V130Z", "P", ` fill-rule="evenodd"`) + stroke("M18 124V51A32 32 0 0 1 82 51V124", 1.2, "PD", 0.7);
const scallop = (() => {
  const n = 20, pts = [];
  for (let i = 0; i <= n; i++) { const a = rad((360 / n) * i - 90); pts.push([50 + 44 * Math.cos(a), 50 + 44 * Math.sin(a)]); }
  const d = `M${r2(pts[0][0])} ${r2(pts[0][1])}` + pts.slice(1).map((p) => `A7 7 0 0 1 ${r2(p[0])} ${r2(p[1])}`).join("");
  return stroke(d, 2.2, "P") + stroke("M50 12A38 38 0 1 1 49.9 12", 1, "PD", 0.7);
})();
const diamondRule = stroke("M4 10H84M116 10H196", 1.6, "P") + shaded("M100 2L108 10L100 18L92 10Z", "P") + `<path d="M88 10L91 7L94 10L91 13Z" fill="{PD}"/><path d="M106 10L109 7L112 10L109 13Z" fill="{PD}"/>`;
const decoFan = Array.from({ length: 7 }, (_, i) => { const a = rad(200 + i * 23.3), b = rad(200 + (i + 1) * 23.3); return shaded(`M50 70L${r2(50 + 46 * Math.cos(a))} ${r2(70 + 46 * Math.sin(a))}A46 46 0 0 1 ${r2(50 + 46 * Math.cos(b))} ${r2(70 + 46 * Math.sin(b))}Z`, i % 2 ? "PD" : "P"); }).join("")
  + stroke("M8 70H92", 2, "PD") + shaded("M40 70a10 10 0 0 1 20 0Z", "A");
const ribbon = shaded("M30 22L4 22L16 34L4 46H30Z", "PD") + shaded("M170 22L196 22L184 34L196 46H170Z", "PD") + `<path d="M30 46L44 54V46Z M170 46L156 54V46Z" fill="{SDS}"/>` + shaded("M30 14H170V46H30Z", "P") + stroke("M38 20H162M38 40H162", 1, "PL", 0.6);

/* ---------- celebration ---------- */
const balloons = (() => {
  const b = (x, y, rx, ry, c) => {
    const d = `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
    return shaded(d, c) + `<path d="M${x - 3} ${y + ry + 2}L${x} ${y + ry - 2}L${x + 3} ${y + ry + 2}Z" fill="{${c}}"/><ellipse cx="${r2(x - rx * 0.4)}" cy="${r2(y - ry * 0.45)}" rx="${r2(rx * 0.16)}" ry="${r2(ry * 0.24)}" fill="{W}" fill-opacity=".7" transform="rotate(-25 ${r2(x - rx * 0.4)} ${r2(y - ry * 0.45)})"/>`;
  };
  return stroke("M50 98C48 80 30 72 30 56M50 98C50 80 52 64 54 48M50 98C54 80 70 72 74 60", 1, "GD") + b(30, 34, 16, 20, "P2") + b(74, 40, 15, 19, "A") + b(54, 26, 17, 21, "P");
})();
const confetti = (() => {
  let out = "", seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const cols = ["P", "A", "P2", "G"];
  for (let i = 0; i < 32; i++) {
    const a = rnd() * 360, d = 12 + rnd() * 36, x = 50 + d * Math.cos(rad(a)), y = 50 + d * Math.sin(rad(a)), k = i % 4, c = cols[(i * 7) % 4];
    out += k === 0 ? `<rect x="${r2(x - 2)}" y="${r2(y - 4)}" width="4" height="8" rx="1" transform="rotate(${r2(a)} ${r2(x)} ${r2(y)})" fill="{${c}}"/>`
      : k === 1 ? dot(x, y, 2.2, c) : k === 2 ? stroke(`M${r2(x - 4)} ${r2(y)}q2 -4 4 0t4 0`, 1.6, c) : `<path d="${starPts(x, y, 4, 3.6, 1.3)}" fill="{${c}}"/>`;
  }
  return out;
})();
const starShape = shaded(starPts(50, 52, 5, 46, 19), "A") + around(5, 50, 52, `<path d="M50 52L50 6" stroke="{AD}" stroke-width="1" stroke-opacity=".5"/>`, 0);
const sparkle = shaded("M50 2C53 36 64 47 98 50C64 53 53 64 50 98C47 64 36 53 2 50C36 47 47 36 50 2Z", "A") + shaded("M84 8C85 15 87 17 94 18C87 19 85 21 84 28C83 21 81 19 74 18C81 17 83 15 84 8Z", "A", ` fill-opacity=".8"`) + dot(50, 50, 4, "W", 0.8);
const heart = shaded("M50 90C20 68 4 50 4 30C4 16 15 6 28 6C38 6 46 12 50 20C54 12 62 6 72 6C85 6 96 16 96 30C96 50 80 68 50 90Z", "P") + `<ellipse cx="26" cy="24" rx="7" ry="10" transform="rotate(-35 26 24)" fill="{W}" fill-opacity=".45"/>`;
const rings = `${stroke(ring(38, 38, 26), 5, "A")}${stroke(ring(38, 38, 26), 1.4, "W", 0.5)}${stroke(ring(64, 56, 26), 5, "A2")}${stroke(ring(64, 56, 26), 1.4, "W", 0.5)}`
  + shaded("M38 0L46 8L38 18L30 8Z", "GEM") + `<path d="M30 8H46M34 8L38 18L42 8" fill="none" stroke="{W}" stroke-width=".8" stroke-opacity=".8"/>`;
const cake = shaded("M8 90h84v6a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3Z", "A2") + shaded("M16 62h68v28H16Z", "P") + shaded("M28 40h44v22H28Z", "PL")
  + stroke("M28 46c6 6 10 6 15 0s10-6 15 0 10 6 14 0", 2.4, "W") + stroke("M16 68c8 7 12 7 17 0s12-7 17 0 12 7 17 0 12-7 17 0", 2.4, "W")
  + `<rect x="48" y="24" width="4" height="16" rx="1" fill="{P2}"/>` + shaded("M50 9C56 16 55 21 50 23C45 21 44 16 50 9Z", "A") + dot(36, 78, 2.2, "P2") + dot(64, 78, 2.2, "P2") + dot(50, 52, 2, "P2");
const gift = shaded("M12 42h76v52H12Z", "P") + shaded("M6 28h88v16H6Z", "PD") + `<rect x="45" y="28" width="10" height="66" fill="{AD}"/><rect x="45" y="28" width="10" height="66" fill="{SD}"/>`
  + shaded("M50 28C40 10 22 12 26 22C30 30 44 28 50 28ZM50 28C60 10 78 12 74 22C70 30 56 28 50 28Z", "AD");
const gradCap = shaded("M24 44V64C24 72 38 78 50 78C62 78 76 72 76 64V44L50 56Z", "PD") + shaded("M50 14L96 34L50 54L4 34Z", "P") + stroke("M86 38V66", 2, "A") + shaded("M82 66H90L88 82H84Z", "A") + dot(50, 34, 3, "A");

/* ---------- festive and cultural ---------- */
const crescent = shaded("M60 8A42 42 0 1 0 92 76A34 34 0 1 1 60 8Z", "A") + shaded(starPts(74, 34, 5, 12, 5), "A");
const ketupat = (() => {
  const outline = "M50 4L92 46L50 88L8 46Z";
  // woven strips: alternating light and dark squares
  let cells = "";
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const cx = 50 + (i - j) * 10.5, cy = 14.5 + (i + j) * 10.5;
    cells += `<path d="M${cx} ${cy - 10.5}L${cx + 10.5} ${cy}L${cx} ${cy + 10.5}L${cx - 10.5} ${cy}Z" fill="{${(i + j) % 2 ? "G" : "GL2"}}"/>`;
  }
  return cells + `<path d="${outline}" fill="{SD}"/><path d="${outline}" fill="{HL}"/>` + stroke(outline, 2.2, "GD") + stroke("M29 25L71 67M50 46L71 25M29 67L50 46M39.5 14.5L81.5 56.5M18.5 35.5L60.5 77.5M60.5 14.5L18.5 56.5M81.5 35.5L39.5 77.5", 1, "GD", 0.6) + stroke("M50 88C46 94 40 96 34 98M50 88C54 94 60 96 66 98", 2, "GD");
})();
const flame = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${shaded("M0 -36C12 -22 12 -8 0 0C-12 -8 -12 -22 0 -36Z", "F")}<path d="M0 -22C5 -15 5 -8 0 -4C-5 -8 -5 -15 0 -22Z" fill="{FL}"/></g>`;
const pelita = shaded("M30 62C30 80 70 80 70 62Z", "P") + shaded("M42 78h16v10H42Z", "PD") + shaded("M34 88h32v6H34Z", "P") + `<rect x="47" y="50" width="6" height="12" fill="{W}" fill-opacity=".8"/>` + flame(50, 46);
const lantern = `<rect x="38" y="8" width="24" height="8" rx="2" fill="{A}"/>${stroke("M50 2V8", 2, "A")}` + shaded("M14 50a36 34 0 1 0 72 0a36 34 0 1 0 -72 0", "P")
  + stroke("M50 16C34 30 34 70 50 84M50 16C66 30 66 70 50 84M50 16V84M30 22C20 36 20 64 30 78M70 22C80 36 80 64 70 78", 1.2, "PD", 0.7) + `<rect x="38" y="84" width="24" height="7" rx="2" fill="{A}"/>` + stroke("M44 91V100M50 91V103M56 91V100", 1.6, "P");
const mandala = (() => {
  const rr = (n, el, start = 0) => around(n, 50, 50, el, start);
  return rr(16, `<path d="M50 14C47 10 47 6 50 2C53 6 53 10 50 14Z" fill="{PD}"/>`) + rr(16, `<circle cx="50" cy="10" r="1.6" fill="{A}"/>`, 11.25)
    + stroke(ring(50, 50, 34), 1.2, "PD", 0.8)
    + rr(8, shaded("M50 38C40 34 36 26 38 20C44 22 48 28 50 38Z", "P2"), 22.5)
    + rr(8, shaded("M50 36C46 30 46 24 50 18C54 24 54 30 50 36Z", "P"))
    + stroke(ring(50, 50, 12), 1.4, "PD") + dot(50, 50, 6, "A");
})();
const wau = shaded("M50 4C60 14 64 22 62 30C76 26 92 30 96 40C82 40 70 44 62 50C66 62 64 74 56 84C54 90 52 96 50 98C48 96 46 90 44 84C36 74 34 62 38 50C30 44 18 40 4 40C8 30 24 26 38 30C36 22 40 14 50 4Z", "P")
  + `<path d="M38 50C30 62 30 72 34 80C38 74 42 66 44 60Z M62 50C70 62 70 72 66 80C62 74 58 66 56 60Z" fill="{A}"/>` + `<path d="M50 14C55 22 56 30 50 40C44 30 45 22 50 14Z" fill="{A2}"/>` + stroke("M50 4V98M4 40C30 38 70 38 96 40", 1.2, "PD", 0.6);
const islamicStar = `<path fill-rule="evenodd" d="${(() => { const sq = (o) => [0, 1, 2, 3].map((i) => { const a = rad(o + i * 90 - 45); return `${r2(50 + 44 * Math.cos(a))} ${r2(50 + 44 * Math.sin(a))}`; }); const a = sq(0), b = sq(45); return `M${a.join("L")}Z M${b.join("L")}Z`; })()}" fill="{P}"/>`
  + stroke(ring(50, 50, 18), 2.4, "A") + shaded(ring(50, 50, 12), "P2") + dot(50, 50, 5, "A");
const diya = shaded("M8 54C16 78 84 78 92 54C70 62 30 62 8 54Z", "P") + `<path d="M8 54C30 60 70 60 92 54C80 48 20 48 8 54Z" fill="{PD}"/>` + stroke("M92 54C96 50 98 46 96 42", 2.4, "P")
  + stroke("M24 64L30 68M40 68V72M60 68V72M76 64L70 68", 1.6, "A", 0.9) + flame(50, 50, 1);
const songket = (() => {
  const m = (cx, cy, s, c) => `<path d="M${cx} ${cy - s}L${cx + s} ${cy}L${cx} ${cy + s}L${cx - s} ${cy}Z" fill="{${c}}"/>`;
  return shaded("M50 4L96 50L50 96L4 50Z", "PD") + stroke("M50 4L96 50L50 96L4 50Z", 2.4, "A") + m(50, 50, 28, "A") + m(50, 50, 20, "PL") + m(50, 50, 10, "A")
    + m(50, 14, 6, "A") + m(50, 86, 6, "A") + m(14, 50, 6, "A") + m(86, 50, 6, "A") + stroke("M50 22V78M22 50H78", 0.8, "A", 0.6);
})();
const kolam = (() => {
  let out = "";
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (Math.abs(x - 2) + Math.abs(y - 2) <= 2) out += dot(14 + x * 18, 14 + y * 18, 2.6, "PD");
  return stroke("M50 5C68 14 68 32 50 41C32 32 32 14 50 5ZM95 50C86 68 68 68 59 50C68 32 86 32 95 50ZM50 95C32 86 32 68 50 59C68 68 68 86 50 95ZM5 50C14 32 32 32 41 50C32 68 14 68 5 50Z", 2, "P")
    + stroke("M50 23C62 32 68 38 77 50C68 62 62 68 50 77C38 68 32 62 23 50C32 38 38 32 50 23Z", 1.8, "A") + out;
})();
const mosque = shaded("M18 60h64v34H18Z", "W2") + shaded("M22 60C22 40 36 30 50 28C64 30 78 40 78 60Z", "P") + shaded("M50 8C52 14 56 16 56 20C56 24 52 26 50 26C48 26 44 24 44 20C44 16 48 14 50 8Z", "A")
  + shaded("M4 40h8v54H4Z", "W2") + shaded("M8 26L12 40H4Z", "P") + shaded("M88 40h8v54h-8Z", "W2") + shaded("M92 26L96 40H88Z", "P")
  + `<path d="M42 94V76A8 8 0 0 1 58 76V94Z" fill="{PD}"/>` + `<path d="M26 72v8h6v-8a3 3 0 0 0-6 0ZM68 72v8h6v-8a3 3 0 0 0-6 0Z" fill="{PD}"/>`;

/* ---------- paper ---------- */
const washi = `<path d="M6 8L12 4L18 8L24 4L30 8L36 4L42 8L48 4L54 8L60 4L66 8L72 4L78 8L84 4L90 8L96 4L102 8L108 4L114 8L120 4L126 8L132 4L138 8L144 4L150 8L156 4L160 8V32L154 36L148 32L142 36L136 32L130 36L124 32L118 36L112 32L106 36L100 32L94 36L88 32L82 36L76 32L70 36L64 32L58 36L52 32L46 36L40 32L34 36L28 32L22 36L16 32L10 36L4 32Z" fill="{P}" fill-opacity=".72"/>`
  + Array.from({ length: 13 }, (_, i) => dot(12 + i * 12, 14 + (i % 2) * 12, 2.6, "W", 0.85)).join("") + Array.from({ length: 13 }, (_, i) => dot(12 + i * 12, 26 - (i % 2) * 12, 1.4, "PD", 0.8)).join("");
const waxSeal = (() => {
  const n = 14; let d = "";
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? 44 : 47 + (i % 4 === 0 ? 2 : 0), a = rad((180 / n) * i); d += `${i ? "L" : "M"}${r2(50 + r * Math.cos(a))} ${r2(50 + r * Math.sin(a))}`; }
  return shaded(d + "Z", "P") + `<path d="${ring(50, 50, 33)}" fill="{PD}"/>` + `<path d="${ring(50, 50, 33)}" fill="{HL}"/>` + stroke(ring(50, 50, 33), 1.6, "PL", 0.7) + around(8, 50, 50, `<path d="M50 30C46 36 46 42 50 46C54 42 54 36 50 30Z" fill="{PL}" fill-opacity=".7"/>`);
})();

/* natural colours for each sticker: P petal/main, PD darker, PL lighter, A accent, AD darker accent,
   G leaf, GL2 second leaf green, GD stem/dark green, GL leaf vein, B bark, plus extras where needed */
const GREEN = { G: "#5f8f4e", GL2: "#7faa63", GD: "#3e6532", GL: "#b9d6a4", B: "#6e5440" };
const GOLD = { P: "#b98a35", PD: "#8c6524", PL: "#e8c879", A: "#d9a441", ...GREEN };
const PAL = {
  rose: { P: "#d9506a", PD: "#a8324b", PL: "#f3a2b2", ...GREEN },
  peony: { P: "#ee93aa", PD: "#d56f8b", PL: "#fbd3de", A: "#f2cd67", AD: "#d79b2e" },
  frangipani: { P: "#fffaf1", PD: "#d9c9a3", A: "#f5c242", AD: "#e4a52a" },
  hibiscus: { P: "#e2363e", PD: "#9d1b28", A: "#f4c84a", AD: "#d6962a" },
  daisy: { P: "#ffffff", PD: "#d9d2c3", A: "#f2b827", AD: "#b77a11" },
  lotus: { P: "#f2a7bd", PD: "#dc7d9b", PL: "#fbd6e1", A: "#f2cd67", ...GREEN },
  tulip: { P: "#e8505f", PD: "#b52e3f", PL: "#f7a3ad", ...GREEN },
  babysBreath: { P: "#ffffff", PD: "#e9e2d1", ...GREEN },
  cherry: { P: "#f6c3d1", PD: "#e08ba4", A: "#c2456b", AD: "#7d2541", ...GREEN },
  jasmine: { P: "#ffffff", PD: "#d8d0bc", A: "#f2cd67", ...GREEN },
  vine: GREEN, hangingVine: { ...GREEN, P: "#f6c3d1", PD: "#e08ba4", A: "#f2cd67", AD: "#d79b2e" },
  eucalyptus: { G: "#8db1a4", GL2: "#a9c7bb", GD: "#5c8174", GL: "#d4e5dd" },
  fern: { ...GREEN, G: "#4f8a42", GL2: "#6fa35a" },
  olive: { G: "#7d8f5a", GL2: "#9aab72", GD: "#56643b", GL: "#c9d3a9", B: "#6e5440", A: "#4a3d4a" },
  laurel: { ...GREEN, G: "#6f8f4c", GL2: "#93ad6c" }, wreath: { ...GREEN, P: "#fffaf1", PD: "#e2c9a6", A: "#f2cd67", AD: "#d79b2e" },
  monstera: { G: "#2f7d46", GD: "#1f5a32", GL: "#7fbf8f" },
  flourish: GOLD, diamondRule: GOLD, swirlCorner: GOLD, arch: GOLD, scallop: GOLD, decoFan: GOLD, ribbon: { P: "#c23b4e", PD: "#8e2535", PL: "#f0a0aa", SDS: "#5c1722" },
  heart: { P: "#e04b5f", W: "#ffffff" },
  rings: { A: "#d6a53b", A2: "#c9cdd2", W: "#ffffff", GEM: "#cfeaff" },
  sparkle: { A: "#f2c84b", W: "#ffffff" }, star: { A: "#f2c84b", AD: "#c99a1f" },
  balloons: { P: "#e8566b", P2: "#5aa6d6", A: "#f2c84b", GD: "#8a7f74", W: "#ffffff" },
  confetti: { P: "#e8566b", P2: "#5aa6d6", A: "#f2c84b", G: "#62b07a" },
  cake: { P: "#f4c6d1", PL: "#fbe3ea", A: "#f6b43c", A2: "#c9a774", P2: "#e8566b", W: "#ffffff" },
  gift: { P: "#5aa6d6", PD: "#3f86b8", A: "#f2c84b", AD: "#e6b43a" },
  gradCap: { P: "#2b2b33", PD: "#1c1c22", A: "#e8b94a" },
  crescent: { A: "#e2b14a" },
  ketupat: { G: "#a9c46c", GL2: "#cfe08f", GD: "#6c8a37" },
  pelita: { P: "#c9983b", PD: "#9c7228", F: "#f39a1e", FL: "#ffe28a", W: "#fff6dc" },
  mosque: { P: "#d9a441", A: "#e8c879", W2: "#f3ead6", PD: "#7a5a2a" },
  islamicStar: { P: "#2f6f73", P2: "#e9dfc6", A: "#d6a53b" },
  songket: { P: "#8c1d3a", PD: "#7a1832", PL: "#b03a58", A: "#d9a441" },
  wau: { P: "#d6402f", PD: "#8e2a1f", A: "#f2c84b", A2: "#2f8f8a" },
  lantern: { P: "#d7312f", PD: "#8e1d1c", A: "#e2b14a" },
  diya: { P: "#b8652a", PD: "#8a4519", A: "#f2c84b", F: "#f39a1e", FL: "#ffe28a" },
  kolam: { P: "#d14b7a", PD: "#5a4636", A: "#f0a23a" },
  mandala: { P: "#e07b2c", P2: "#c4434f", PD: "#8f3a1c", A: "#f2c84b" },
  washi: { P: "#e9a7b4", PD: "#c46f81", W: "#ffffff" },
  waxSeal: { P: "#9b1d2a", PD: "#7a1420", PL: "#d0505e" },
};

export const STICKER_CATS = { floral: "Flowers", leaves: "Leaves and vines", lines: "Lines and frames", celebrate: "Celebration", festive: "Festive and cultural", paper: "Paper" };
const S = (label, cat, w, h, svg, key) => ({ label, cat, w, h, svg, pal: PAL[key] || {} });
export const STICKERS = {
  rose: S("Rose", "floral", 100, 100, rose, "rose"),
  peony: S("Peony", "floral", 100, 100, peony, "peony"),
  frangipani: S("Frangipani", "floral", 100, 100, frangipani, "frangipani"),
  hibiscus: S("Bunga raya", "floral", 100, 100, hibiscus, "hibiscus"),
  daisy: S("Daisy", "floral", 100, 100, daisy, "daisy"),
  lotus: S("Lotus", "floral", 100, 100, lotus, "lotus"),
  tulip: S("Tulip", "floral", 100, 100, tulip, "tulip"),
  babysBreath: S("Baby's breath", "floral", 100, 100, babysBreath, "babysBreath"),
  cherry: S("Blossom branch", "floral", 160, 80, cherryBranch, "cherry"),
  jasmine: S("Jasmine sprig", "floral", 160, 70, jasmine, "jasmine"),
  vine: S("Vine", "leaves", 200, 60, vine, "vine"),
  hangingVine: S("Hanging vine", "leaves", 60, 206, hangingVine, "hangingVine"),
  eucalyptus: S("Eucalyptus", "leaves", 120, 120, eucalyptus, "eucalyptus"),
  fern: S("Fern", "leaves", 120, 160, fern, "fern"),
  olive: S("Olive branch", "leaves", 160, 60, olive, "olive"),
  laurel: S("Laurel", "leaves", 120, 110, laurel, "laurel"),
  wreath: S("Wreath", "leaves", 100, 100, wreath, "wreath"),
  monstera: S("Monstera leaf", "leaves", 100, 100, monstera, "monstera"),
  flourish: S("Flourish", "lines", 200, 40, flourish, "flourish"),
  diamondRule: S("Diamond line", "lines", 200, 20, diamondRule, "diamondRule"),
  swirlCorner: S("Swirl corner", "lines", 100, 100, swirlCorner, "swirlCorner"),
  arch: S("Arch frame", "lines", 100, 140, arch, "arch"),
  scallop: S("Scalloped ring", "lines", 100, 100, scallop, "scallop"),
  decoFan: S("Deco fan", "lines", 100, 74, decoFan, "decoFan"),
  ribbon: S("Ribbon banner", "lines", 200, 60, ribbon, "ribbon"),
  heart: S("Heart", "celebrate", 100, 96, heart, "heart"),
  rings: S("Rings", "celebrate", 100, 90, rings, "rings"),
  sparkle: S("Sparkle", "celebrate", 100, 100, sparkle, "sparkle"),
  star: S("Star", "celebrate", 100, 100, starShape, "star"),
  balloons: S("Balloons", "celebrate", 100, 100, balloons, "balloons"),
  confetti: S("Confetti", "celebrate", 100, 100, confetti, "confetti"),
  cake: S("Cake", "celebrate", 100, 100, cake, "cake"),
  gift: S("Gift", "celebrate", 100, 100, gift, "gift"),
  gradCap: S("Graduation cap", "celebrate", 100, 84, gradCap, "gradCap"),
  crescent: S("Crescent and star", "festive", 100, 100, crescent, "crescent"),
  ketupat: S("Ketupat", "festive", 100, 100, ketupat, "ketupat"),
  pelita: S("Pelita", "festive", 100, 100, pelita, "pelita"),
  mosque: S("Mosque", "festive", 100, 96, mosque, "mosque"),
  islamicStar: S("Eight-point star", "festive", 100, 100, islamicStar, "islamicStar"),
  songket: S("Songket motif", "festive", 100, 100, songket, "songket"),
  wau: S("Wau", "festive", 100, 100, wau, "wau"),
  lantern: S("Lantern", "festive", 100, 104, lantern, "lantern"),
  diya: S("Diya", "festive", 100, 80, diya, "diya"),
  kolam: S("Kolam", "festive", 100, 100, kolam, "kolam"),
  mandala: S("Mandala", "festive", 100, 100, mandala, "mandala"),
  washi: S("Washi tape", "paper", 164, 40, washi, "washi"),
  waxSeal: S("Wax seal", "paper", 100, 100, waxSeal, "waxSeal"),
};

/** The drawing as a complete SVG. natural = its own colours with shading; otherwise one flat colour (black for a mask). */
export function stickerSVG(key, color = "#000", natural = false) {
  const s = STICKERS[key]; if (!s) return "";
  let body;
  if (natural) {
    const id = "st-" + key;
    body = `<defs><linearGradient id="${id}-sd" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>`
      + `<radialGradient id="${id}-hl" cx=".32" cy=".25" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`
      + s.svg.replace(/\{SD\}/g, `url(#${id}-sd)`).replace(/\{HL\}/g, `url(#${id}-hl)`).replace(/\{(\w+)\}/g, (m, t) => s.pal[t] || s.pal.P || s.pal.G || "#7a7a7a");
  } else if (color === "#000") {
    // for a luminance mask: white shows the colour fully, greys show it partly, so lighter parts stay visible as detail
    body = s.svg.replace(/\{(SD|HL)\}/g, "none").replace(/\{(\w+)\}/g, (m, t) => TONE[t] || "#e0e0e0");
  } else {
    body = s.svg.replace(/\{(SD|HL)\}/g, "none").replace(/\{\w+\}/g, color);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.w} ${s.h}">${body}</svg>`;
}
// how strongly each part shows in one colour: dark parts fully, main parts nearly, light parts and highlights faintly
const TONE = {
  PD: "#fff", GD: "#fff", AD: "#fff", B: "#fff", SDS: "#fff", F: "#fff",
  P: "#d6d6d6", G: "#d6d6d6", A: "#d6d6d6", P2: "#c4c4c4", A2: "#c4c4c4", GEM: "#c4c4c4", W2: "#c4c4c4",
  PL: "#909090", GL2: "#a8a8a8", GL: "#8a8a8a", FL: "#909090", W: "#6e6e6e"
};
const cache = {};
const asUrl = (svg) => `url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27")}')`;   // safe inside style="…"
/** For one colour or foil: the drawing as a CSS mask, filled with any colour or gradient. */
export function stickerMask(key) { return (cache["m" + key] ||= asUrl(stickerSVG(key))); }
/** For natural colours: the drawing as a CSS background image. */
export function stickerImage(key) { return (cache["n" + key] ||= asUrl(stickerSVG(key, "#000", true))); }