/* Jemput sticker library: original one-colour drawings that can be recoloured, foiled, moved and resized.
   Every drawing uses currentColor; lighter parts use fill-opacity so they still read in a single colour.
   Each entry: label, category, viewBox width and height, and the SVG content. */

const r2 = (n) => Math.round(n * 10) / 10;
const rad = (d) => (d * Math.PI) / 180;
// n copies of an element rotated evenly around (cx, cy)
const around = (n, cx, cy, el, start = 0) => Array.from({ length: n }, (_, i) => `<g transform="rotate(${r2(start + (360 / n) * i)} ${cx} ${cy})">${el}</g>`).join("");
// a leaf shape pointing along +x from (0,0), length l and width w
const leafPath = (l, w) => `M0 0C${r2(l * 0.3)} ${r2(-w)} ${r2(l * 0.75)} ${r2(-w * 0.8)} ${l} 0C${r2(l * 0.75)} ${r2(w * 0.8)} ${r2(l * 0.3)} ${r2(w)} 0 0Z`;
const leaf = (x, y, angle, l, w, op = 1) => `<path d="${leafPath(l, w)}" transform="translate(${r2(x)} ${r2(y)}) rotate(${r2(angle)})"${op < 1 ? ` fill-opacity="${op}"` : ""}/>`;
// a small five-petal blossom
const blossom = (x, y, r, op = 1) => `<g transform="translate(${r2(x)} ${r2(y)})"${op < 1 ? ` fill-opacity="${op}"` : ""}>${around(5, 0, 0, `<ellipse cx="0" cy="${r2(-r * 0.55)}" rx="${r2(r * 0.42)}" ry="${r2(r * 0.55)}"/>`)}<circle r="${r2(r * 0.22)}" fill-opacity=".5"/></g>`;
const dot = (x, y, r, op = 1) => `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(r)}"${op < 1 ? ` fill-opacity="${op}"` : ""}/>`;
const stroke = (d, w = 2, op = 1) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op < 1 ? ` stroke-opacity="${op}"` : ""}/>`;
// points along a quadratic curve, for placing leaves on a stem
function along(p0, p1, p2, n) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n, mt = 1 - t;
    const x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0], y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1];
    const dx = 2 * mt * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), dy = 2 * mt * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    return { x, y, a: (Math.atan2(dy, dx) * 180) / Math.PI, t };
  });
}
function star(cx, cy, n, ro, ri, start = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rad(start + (180 / n) * i); pts.push(`${r2(cx + r * Math.cos(a))},${r2(cy + r * Math.sin(a))}`); }
  return `<polygon points="${pts.join(" ")}"/>`;
}

/* ---------- florals ---------- */
const rose = (() => {
  // a cupped bloom seen from the side-front: wide outer petals, a cup, and a curled centre
  const outer = `<path d="M50 84C26 84 12 68 14 50C16 40 24 36 30 40C26 50 34 64 50 66C66 64 74 50 70 40C76 36 84 40 86 50C88 68 74 84 50 84Z" fill-opacity=".45"/>`;
  const cup = `<path d="M50 70C34 70 24 58 26 44C28 32 38 26 50 26C62 26 72 32 74 44C76 58 66 70 50 70Z" fill-opacity=".75"/>`;
  const curl = stroke("M38 44C40 34 48 30 56 32C64 34 66 44 60 50C54 56 44 54 42 46C40 40 46 36 52 38C56 40 56 46 52 47", 2.6, 1)
    + stroke("M30 52C36 62 46 66 56 64M70 52C66 60 60 64 54 66", 1.8, 0.6);
  return `${leaf(46, 82, 160, 30, 9, 0.8)}${leaf(54, 82, 20, 30, 9, 0.8)}${stroke("M50 84V98", 2.4)}${outer}${cup}${curl}`;
})();
const peony = (() => {
  const ring = (n, r, rx, ry, op, start) => around(n, 50, 50, `<ellipse cx="50" cy="${50 - r}" rx="${rx}" ry="${ry}" fill-opacity="${op}"/>`, start);
  return ring(10, 28, 13, 17, 0.3, 0) + ring(8, 18, 11, 14, 0.5, 20) + ring(6, 9, 8, 10, 0.75, 0) + dot(50, 50, 5, 0.4)
    + around(12, 50, 50, `<circle cx="50" cy="41" r="1.4"/>`, 15);
})();
const frangipani = (() => {
  const petal = `<path d="M50 50C38 40 36 14 54 10C72 8 70 36 50 50Z"/><path d="M50 50C46 40 47 24 53 16" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.4"/>`;
  return around(5, 50, 50, petal, 8) + dot(50, 50, 7, 0.45);
})();
const hibiscus = (() => {
  const petal = `<path d="M50 50C34 44 26 22 40 12C46 8 54 10 56 14C64 8 76 14 72 26C70 36 60 46 50 50Z" fill-opacity=".85"/><path d="M50 50L52 24" stroke="currentColor" stroke-opacity=".3" stroke-width="1.2"/>`;
  return around(5, 50, 50, petal, 0) + stroke("M50 50C58 40 66 30 74 20", 2.4) + dot(74, 20, 3) + dot(70, 17, 2) + dot(77, 24, 2) + dot(72, 25, 1.6) + dot(50, 50, 6, 0.4);
})();
const daisy = around(16, 50, 50, `<ellipse cx="50" cy="26" rx="4.2" ry="16" fill-opacity=".8"/>`) + dot(50, 50, 11) + around(10, 50, 50, `<circle cx="50" cy="44" r="1.3" fill-opacity=".0"/>`);
const babysBreath = (() => {
  const stems = stroke("M50 98C50 70 48 50 42 30M49 70C58 56 66 44 74 34M48 56C38 46 30 40 22 36M45 42C50 32 56 22 60 12M43 34C36 26 30 18 28 8", 1.6);
  const pts = [[42, 30], [74, 34], [22, 36], [60, 12], [28, 8], [36, 22], [68, 22], [52, 20], [18, 26], [80, 26], [46, 10], [30, 30], [64, 40]];
  return stems + pts.map(([x, y], i) => blossom(x, y, 5 + (i % 3), 0.95)).join("");
})();
const tulip = `${stroke("M50 98C50 80 50 66 50 56", 3)}${leaf(50, 92, -120, 34, 9, 0.7)}${leaf(50, 86, -55, 30, 8, 0.7)}<path d="M34 30C34 50 42 58 50 58C58 58 66 50 66 30L58 38L50 24L42 38Z"/><path d="M42 38L50 24L58 38C56 46 53 50 50 50C47 50 44 46 42 38Z" fill-opacity=".45"/>`;
const cherryBranch = (() => {
  const br = stroke("M4 70C40 60 70 50 112 30C130 22 146 20 156 18M60 54C66 40 74 30 86 24M112 30C116 42 124 50 136 54", 3);
  return br + blossom(86, 24, 13) + blossom(136, 54, 12) + blossom(150, 16, 11, 0.85) + blossom(40, 58, 10, 0.85) + blossom(104, 40, 8, 0.7) + dot(122, 22, 3) + dot(70, 48, 3) + leaf(20, 66, -20, 14, 4, 0.6);
})();
const lotus = (() => {
  const p = (a, l, w, op) => `<path d="M50 80C${50 - w} ${80 - l * 0.4} ${50 - w * 0.6} ${80 - l * 0.9} 50 ${80 - l}C${50 + w * 0.6} ${80 - l * 0.9} ${50 + w} ${80 - l * 0.4} 50 80Z" transform="rotate(${a} 50 80)" fill-opacity="${op}"/>`;
  return p(-70, 34, 12, 0.35) + p(70, 34, 12, 0.35) + p(-40, 46, 14, 0.55) + p(40, 46, 14, 0.55) + p(0, 58, 16, 0.9) + `<path d="M14 84C30 90 70 90 86 84" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`;
})();
const jasmine = (() => {
  const s = stroke("M6 60C40 54 80 40 154 20", 2) + stroke("M60 50C64 40 70 34 78 30M104 38C106 48 112 54 120 56", 1.6);
  const fl = (x, y, r) => `<g transform="translate(${x} ${y})">${star(0, 0, 5, r, r * 0.42)}<circle r="${r2(r * 0.18)}" fill-opacity=".3"/></g>`;
  return s + fl(78, 30, 11) + fl(120, 56, 10) + fl(154, 20, 10) + fl(36, 56, 8) + leaf(92, 36, -30, 16, 5, 0.6) + leaf(20, 58, 160, 14, 4, 0.6) + dot(136, 30, 3.5, 0.8);
})();

/* ---------- leaves and vines ---------- */
const vine = (() => {
  const d = "M4 40C34 6 60 6 80 30C100 54 126 54 150 30C166 14 182 12 196 20";
  const ls = [[22, 22, -60, 1], [40, 12, 20, -1], [62, 16, 60, 1], [84, 36, 40, -1], [104, 48, -10, 1], [126, 46, -30, -1], [146, 32, -60, 1], [170, 16, -20, -1], [188, 16, 10, 1]];
  return stroke(d, 2.2) + ls.map(([x, y, a, s], i) => leaf(x, y, a + (s > 0 ? -60 : 60), 20 + (i % 2) * 4, 7, i % 2 ? 0.65 : 1)).join("") + stroke("M80 30c4-8 12-10 16-6c3 3 0 8-4 6", 1.4) + stroke("M150 30c-2-8 2-14 8-14c4 0 5 5 1 6", 1.4);
})();
const eucalyptus = (() => {
  const pts = along([10, 112], [36, 52], [104, 8], 8);
  return stroke("M10 112Q36 52 104 8", 2.2) + pts.map((p, i) => {
    const side = i % 2 ? 1 : -1, perp = rad(p.a + 90 * side), r = 10 - i * 0.6;
    const cx = p.x + Math.cos(perp) * (r + 2), cy = p.y + Math.sin(perp) * (r + 2);
    return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill-opacity="${i % 2 ? 0.6 : 0.95}"/>`;
  }).join("");
})();
const fern = (() => {
  const pts = along([60, 158], [56, 80], [60, 4], 14);
  return stroke("M60 158Q56 80 60 4", 2) + pts.map((p, i) => {
    const l = 8 + Math.sin(p.t * Math.PI) * 30 * (1 - p.t * 0.4);
    return leaf(p.x, p.y, p.a + 180 - 55, l, l * 0.22) + leaf(p.x, p.y, p.a + 180 + 55, l, l * 0.22, 0.75);
  }).join("");
})();
const olive = (() => {
  const pts = along([6, 50], [80, 20], [154, 34], 9);
  return stroke("M6 50Q80 20 154 34", 1.8) + pts.map((p, i) => leaf(p.x, p.y, p.a + (i % 2 ? -40 : 40), 22, 4.5, i % 2 ? 0.7 : 1)).join("")
    + `<ellipse cx="62" cy="44" rx="5" ry="6.5" transform="rotate(20 62 44)"/><ellipse cx="112" cy="18" rx="4.5" ry="6" fill-opacity=".7" transform="rotate(-20 112 18)"/>`;
})();
const laurel = (() => {
  // two branches following one circle, from the bottom centre up each side; leaves sit on the branch and point up it
  const cx = 60, cy = 56, R = 46;
  const branch = (s) => {
    const angles = Array.from({ length: 10 }, (_, i) => 100 + i * 17);   // degrees, 90 = straight down
    const pt = (a) => [cx + s * R * Math.cos(rad(a)) * -1 * -1 * (s > 0 ? 1 : 1), cy + R * Math.sin(rad(a))];
    const P = angles.map((a) => [cx - s * R * Math.cos(rad(180 - a)) , cy + R * Math.sin(rad(a))]);
    const stem = stroke("M" + P.map((p) => `${r2(p[0])} ${r2(p[1])}`).join("L"), 1.8);
    const leaves = P.slice(0, -1).map((p, i) => {
      const q = P[i + 1], dir = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
      return leaf(p[0], p[1], dir - s * 38, 15, 5, i % 2 ? 0.7 : 1) + leaf(p[0], p[1], dir + s * 30, 12, 4, 0.55);
    }).join("");
    return stem + leaves;
  };
  return branch(1) + branch(-1);
})();
const wreath = (() => {
  const n = 22;
  return stroke("M50 8A42 42 0 1 1 49.9 8", 1.6) + Array.from({ length: n }, (_, i) => {
    const a = (360 / n) * i, x = 50 + 42 * Math.cos(rad(a)), y = 50 + 42 * Math.sin(rad(a));
    return leaf(x, y, a + 90 + (i % 2 ? 35 : -35), 11, 3.6, i % 2 ? 0.65 : 1);
  }).join("") + blossom(50, 8, 7) + blossom(14, 72, 5, 0.8) + blossom(86, 72, 5, 0.8);
})();
const monstera = `<path fill-rule="evenodd" d="M50 96C50 96 48 80 46 74C24 70 6 52 8 30C10 14 26 4 44 6C58 6 70 12 80 22C92 34 94 54 84 66C76 76 62 76 54 74C53 80 52 90 50 96Z
  M30 24C26 30 24 36 24 42L34 40C34 34 36 30 38 26Z M48 22C46 28 46 34 46 40L54 40C54 34 56 28 58 24Z M66 30C62 34 60 40 60 46L70 46C70 40 72 36 74 34Z M22 50C22 54 24 58 26 60L34 54C32 52 32 50 32 48Z M40 54C40 58 42 62 44 64L50 56C48 54 48 52 48 50Z M60 56C62 60 64 62 68 62L68 54C66 54 64 52 64 50Z"/>
  <circle cx="34" cy="34" r="2.4" fill-opacity="0"/>`;
const hangingVine = (() => {
  const pts = along([30, 4], [10, 100], [34, 196], 10);
  return stroke("M30 4Q10 100 34 196", 2) + stroke("M4 4H56", 2.4) + pts.map((p, i) => leaf(p.x, p.y, p.a + (i % 2 ? -70 : 70), 22, 7.5, i % 2 ? 0.7 : 1)).join("") + blossom(34, 196, 8) + blossom(18, 120, 6, 0.85);
})();

/* ---------- lines and frames ---------- */
const flourish = stroke("M100 20C88 6 70 6 66 16C62 26 76 30 80 22M100 20C112 6 130 6 134 16C138 26 124 30 120 22M66 16C54 28 30 26 6 20M134 16C146 28 170 26 194 20", 2)
  + `<path d="M100 12L106 20L100 28L94 20Z"/>` + dot(40, 25, 2) + dot(160, 25, 2);
const swirlCorner = stroke("M6 94C6 46 46 6 94 6M6 70C6 36 36 6 70 6M24 94C18 70 30 50 50 46C66 42 72 58 62 64C54 68 48 60 54 56M94 24C70 18 50 30 46 50", 2) + dot(94, 6, 3) + dot(6, 94, 3) + leaf(28, 28, -45, 14, 4, 0.6);
const arch = `<path fill-rule="evenodd" d="M6 136V50A44 44 0 0 1 94 50V136Z M12 130V50A38 38 0 0 1 88 50V130Z"/>${stroke("M18 124V51A32 32 0 0 1 82 51V124", 1.2, 0.6)}`;
const scallop = (() => {
  const n = 20, pts = [];
  let d = "";
  for (let i = 0; i <= n; i++) { const a = rad((360 / n) * i - 90); pts.push([50 + 44 * Math.cos(a), 50 + 44 * Math.sin(a)]); }
  d = `M${r2(pts[0][0])} ${r2(pts[0][1])}` + pts.slice(1).map((p) => `A7 7 0 0 1 ${r2(p[0])} ${r2(p[1])}`).join("");
  return stroke(d, 2) + stroke("M50 12A38 38 0 1 1 49.9 12", 1, 0.6);
})();
const diamondRule = stroke("M4 10H84M116 10H196", 1.6) + `<path d="M100 2L108 10L100 18L92 10Z"/><path d="M88 10L91 7L94 10L91 13Z" fill-opacity=".6"/><path d="M106 10L109 7L112 10L109 13Z" fill-opacity=".6"/>`;
const decoFan = Array.from({ length: 7 }, (_, i) => { const a = rad(200 + i * 23.3), b = rad(200 + (i + 1) * 23.3); return `<path d="M50 70L${r2(50 + 46 * Math.cos(a))} ${r2(70 + 46 * Math.sin(a))}A46 46 0 0 1 ${r2(50 + 46 * Math.cos(b))} ${r2(70 + 46 * Math.sin(b))}Z" fill-opacity="${i % 2 ? 0.45 : 0.9}"/>`; }).join("")
  + stroke("M8 70H92", 2) + `<path d="M50 70m-10 0a10 10 0 0 1 20 0Z" fill-opacity="1"/>`;
const ribbon = `<path d="M30 14H170V46H30Z"/><path d="M30 22L4 22L16 34L4 46H30Z" fill-opacity=".6"/><path d="M170 22L196 22L184 34L196 46H170Z" fill-opacity=".6"/><path d="M30 46L44 54V46Z M170 46L156 54V46Z" fill-opacity=".4"/>${stroke("M38 20H162M38 40H162", 1, 0.35)}`;

/* ---------- celebration ---------- */
const balloons = (() => {
  const b = (x, y, rx, ry, op) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill-opacity="${op}"/><path d="M${x - 3} ${y + ry}L${x} ${y + ry - 3}L${x + 3} ${y + ry}Z" fill-opacity="${op}"/><ellipse cx="${x - rx * 0.4}" cy="${y - ry * 0.4}" rx="${r2(rx * 0.18)}" ry="${r2(ry * 0.25)}" fill-opacity="0"/>`;
  return stroke("M50 96C48 80 30 70 30 56M50 96C50 80 52 64 54 48M50 96C54 80 70 72 74 60", 1.2) + b(30, 34, 16, 20, 0.55) + b(74, 40, 15, 19, 0.75) + b(54, 26, 17, 21, 1);
})();
const confetti = (() => {
  let out = "", seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 30; i++) {
    const a = rnd() * 360, d = 12 + rnd() * 36, x = 50 + d * Math.cos(rad(a)), y = 50 + d * Math.sin(rad(a)), k = i % 4, op = [1, 0.75, 0.55, 0.85][k];
    out += k === 0 ? `<rect x="${r2(x - 2)}" y="${r2(y - 4)}" width="4" height="8" rx="1" transform="rotate(${r2(a)} ${r2(x)} ${r2(y)})" fill-opacity="${op}"/>`
      : k === 1 ? dot(x, y, 2.2, op) : k === 2 ? stroke(`M${r2(x - 4)} ${r2(y)}q2 -4 4 0t4 0`, 1.6, op) : star(x, y, 4, 3.4, 1.2);
  }
  return out;
})();
const starShape = star(50, 52, 5, 46, 19);
const sparkle = `<path d="M50 2C53 36 64 47 98 50C64 53 53 64 50 98C47 64 36 53 2 50C36 47 47 36 50 2Z"/><path d="M84 8C85 15 87 17 94 18C87 19 85 21 84 28C83 21 81 19 74 18C81 17 83 15 84 8Z" fill-opacity=".6"/>`;
const heart = `<path d="M50 90C20 68 4 50 4 30C4 16 15 6 28 6C38 6 46 12 50 20C54 12 62 6 72 6C85 6 96 16 96 30C96 50 80 68 50 90Z"/>`;
const rings = `${stroke("M38 38m-26 0a26 26 0 1 0 52 0a26 26 0 1 0 -52 0", 5)}${stroke("M64 56m-26 0a26 26 0 1 0 52 0a26 26 0 1 0 -52 0", 5, 0.65)}<path d="M38 2L45 9L38 18L31 9Z"/>`;
const cake = `<rect x="28" y="40" width="44" height="22" rx="3" fill-opacity=".7"/><rect x="16" y="62" width="68" height="28" rx="3"/><rect x="8" y="90" width="84" height="6" rx="3" fill-opacity=".5"/>${stroke("M28 48c6 6 10 6 15 0s10-6 15 0 10 6 14 0", 1.6, 0.5)}${stroke("M16 70c8 7 12 7 17 0s12-7 17 0 12 7 17 0 12-7 17 0", 1.6, 0.5)}<rect x="48" y="24" width="4" height="16" rx="1"/><path d="M50 10C55 16 55 20 50 22C45 20 45 16 50 10Z" fill-opacity=".8"/>`;
const gift = `<rect x="12" y="40" width="76" height="54" rx="3" fill-opacity=".8"/><rect x="6" y="28" width="88" height="16" rx="3"/><rect x="45" y="28" width="10" height="66" fill-opacity="0"/>${stroke("M50 28V94", 8, 0.35)}<path d="M50 28C40 10 22 12 26 22C30 30 44 28 50 28ZM50 28C60 10 78 12 74 22C70 30 56 28 50 28Z" fill-opacity=".9"/>`;
const gradCap = `<path d="M50 14L96 34L50 54L4 34Z"/><path d="M24 44V64C24 72 38 78 50 78C62 78 76 72 76 64V44L50 56L24 44Z" fill-opacity=".7"/>${stroke("M86 38V66", 2)}<path d="M82 66H90L88 80H84Z"/>`;

/* ---------- festive and cultural ---------- */
const crescent = `<path d="M60 8A42 42 0 1 0 92 76A34 34 0 1 1 60 8Z"/>${star(74, 34, 5, 12, 5)}`;
const ketupat = `<path d="M50 4L92 46L50 88L8 46Z" fill-opacity=".3"/>${stroke("M50 4L92 46L50 88L8 46Z", 2.4)}${stroke("M29 25L71 67M50 46L71 25M29 67L50 46M39.5 14.5L81.5 56.5M18.5 35.5L60.5 77.5M60.5 14.5L18.5 56.5M81.5 35.5L39.5 77.5", 1.6, 0.7)}${stroke("M50 88C46 94 40 96 34 98M50 88C54 94 60 96 66 98", 2)}`;
const pelita = `<path d="M30 62C30 80 70 80 70 62Z"/><rect x="42" y="78" width="16" height="10" rx="2" fill-opacity=".7"/><rect x="34" y="88" width="32" height="6" rx="3"/><rect x="47" y="50" width="6" height="12" fill-opacity=".6"/><path d="M50 10C62 24 62 38 50 46C38 38 38 24 50 10Z"/><path d="M50 24C55 31 55 38 50 42C45 38 45 31 50 24Z" fill-opacity=".35"/>`;
const lantern = `<rect x="38" y="8" width="24" height="8" rx="2"/>${stroke("M50 2V8", 2)}<ellipse cx="50" cy="50" rx="36" ry="34" fill-opacity=".85"/>${stroke("M50 16C34 30 34 70 50 84M50 16C66 30 66 70 50 84M50 16V84", 1.6, 0.4)}<rect x="38" y="84" width="24" height="7" rx="2"/>${stroke("M44 91V100M50 91V102M56 91V100", 1.6)}`;
const mandala = (() => {
  const ring = (n, r, el, start = 0) => around(n, 50, 50, el(r), start);
  return dot(50, 50, 6) + stroke("M50 50m-12 0a12 12 0 1 0 24 0a12 12 0 1 0 -24 0", 1.4)
    + ring(8, 0, () => `<path d="M50 36C46 30 46 24 50 18C54 24 54 30 50 36Z"/>`)
    + ring(8, 0, () => `<path d="M50 38C40 34 36 26 38 20C44 22 48 28 50 38Z" fill-opacity=".5"/>`, 22.5)
    + stroke("M50 50m-34 0a34 34 0 1 0 68 0a34 34 0 1 0 -68 0", 1.2, 0.7)
    + ring(16, 0, () => `<path d="M50 14C47 10 47 6 50 2C53 6 53 10 50 14Z" fill-opacity=".8"/>`)
    + ring(16, 0, () => `<circle cx="50" cy="10" r="1.6"/>`, 11.25);
})();
const wau = `<path d="M50 4C60 14 64 22 62 30C76 26 92 30 96 40C82 40 70 44 62 50C66 62 64 74 56 84C54 90 52 96 50 98C48 96 46 90 44 84C36 74 34 62 38 50C30 44 18 40 4 40C8 30 24 26 38 30C36 22 40 14 50 4Z" fill-opacity=".85"/>${stroke("M50 4V98M4 40C30 38 70 38 96 40", 1.4, 0.4)}<path d="M38 50C30 62 30 72 34 80C38 74 42 66 44 60Z M62 50C70 62 70 72 66 80C62 74 58 66 56 60Z" fill-opacity=".45"/>`;
const islamicStar = `<path fill-rule="evenodd" d="${(() => { const sq = (o) => [0, 1, 2, 3].map((i) => { const a = rad(o + i * 90 - 45); return `${r2(50 + 44 * Math.cos(a))} ${r2(50 + 44 * Math.sin(a))}`; }); const a = sq(0), b = sq(45); return `M${a.join("L")}Z M${b.join("L")}Z`; })()}" fill-opacity=".85"/>${stroke("M50 50m-16 0a16 16 0 1 0 32 0a16 16 0 1 0 -32 0", 2)}${dot(50, 50, 6)}`;
const diya = `<path d="M8 54C16 78 84 78 92 54C70 62 30 62 8 54Z"/><path d="M8 54C30 60 70 60 92 54C80 48 20 48 8 54Z" fill-opacity=".5"/><path d="M92 54C96 50 98 46 96 42" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M50 14C60 26 60 38 50 46C40 38 40 26 50 14Z"/><path d="M50 28C54 33 54 39 50 42C46 39 46 33 50 28Z" fill-opacity=".35"/>${stroke("M30 66L36 70M50 68V72M70 66L64 70", 1.6, 0.4)}`;
const songket = (() => {
  const m = (cx, cy, s, op) => `<path d="M${cx} ${cy - s}L${cx + s} ${cy}L${cx} ${cy + s}L${cx - s} ${cy}Z" fill-opacity="${op}"/>`;
  return m(50, 50, 46, 0.3) + stroke("M50 4L96 50L50 96L4 50Z", 2) + m(50, 50, 28, 0.7) + m(50, 50, 12, 1) + m(50, 14, 6, 1) + m(50, 86, 6, 1) + m(14, 50, 6, 1) + m(86, 50, 6, 1);
})();
const kolam = (() => {
  let out = "";
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (Math.abs(x - 2) + Math.abs(y - 2) <= 2) out += dot(14 + x * 18, 14 + y * 18, 2.6);
  return out + stroke("M50 5C68 14 68 32 50 41C32 32 32 14 50 5ZM95 50C86 68 68 68 59 50C68 32 86 32 95 50ZM50 95C32 86 32 68 50 59C68 68 68 86 50 95ZM5 50C14 32 32 32 41 50C32 68 14 68 5 50Z", 1.8)
    + stroke("M50 23C62 32 68 38 77 50C68 62 62 68 50 77C38 68 32 62 23 50C32 38 38 32 50 23Z", 1.6, 0.6);
})();
const mosque = `<path d="M50 8C52 14 56 16 56 20C56 24 52 26 50 26C48 26 44 24 44 20C44 16 48 14 50 8Z" fill-opacity=".8"/><path d="M22 60C22 40 36 30 50 28C64 30 78 40 78 60Z"/><rect x="18" y="60" width="64" height="34" fill-opacity=".7"/><path d="M42 94V76A8 8 0 0 1 58 76V94Z" fill-opacity="0"/><rect x="4" y="40" width="8" height="54" rx="2"/><path d="M8 26L12 40H4Z"/><rect x="88" y="40" width="8" height="54" rx="2"/><path d="M92 26L96 40H88Z"/>${stroke("M42 94V76A8 8 0 0 1 58 76V94", 2, 0.5)}`;

/* ---------- paper ---------- */
const washi = `<path d="M6 8L12 4L18 8L24 4L30 8L36 4L42 8L48 4L54 8L60 4L66 8L72 4L78 8L84 4L90 8L96 4L102 8L108 4L114 8L120 4L126 8L132 4L138 8L144 4L150 8L156 4L160 8V32L154 36L148 32L142 36L136 32L130 36L124 32L118 36L112 32L106 36L100 32L94 36L88 32L82 36L76 32L70 36L64 32L58 36L52 32L46 36L40 32L34 36L28 32L22 36L16 32L10 36L4 32Z" fill-opacity=".45"/>${stroke("M14 14L22 26M34 14L42 26M54 14L62 26M74 14L82 26M94 14L102 26M114 14L122 26M134 14L142 26", 2, 0.4)}`;
const waxSeal = (() => {
  const n = 14; let d = "";
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? 44 : 47 + (i % 4 === 0 ? 2 : 0), a = rad((180 / n) * i); d += `${i ? "L" : "M"}${r2(50 + r * Math.cos(a))} ${r2(50 + r * Math.sin(a))}`; }
  return `<path d="${d}Z"/>${stroke("M50 50m-32 0a32 32 0 1 0 64 0a32 32 0 1 0 -64 0", 2.2, 0.35)}${around(8, 50, 50, `<path d="M50 30C46 36 46 42 50 46C54 42 54 36 50 30Z" fill-opacity=".3"/>`)}`;
})();

export const STICKER_CATS = { floral: "Flowers", leaves: "Leaves and vines", lines: "Lines and frames", celebrate: "Celebration", festive: "Festive and cultural", paper: "Paper" };
export const STICKERS = {
  rose: { label: "Rose", cat: "floral", w: 100, h: 100, svg: rose },
  peony: { label: "Peony", cat: "floral", w: 100, h: 100, svg: peony },
  frangipani: { label: "Frangipani", cat: "floral", w: 100, h: 100, svg: frangipani },
  hibiscus: { label: "Bunga raya", cat: "floral", w: 100, h: 100, svg: hibiscus },
  daisy: { label: "Daisy", cat: "floral", w: 100, h: 100, svg: daisy },
  lotus: { label: "Lotus", cat: "floral", w: 100, h: 100, svg: lotus },
  tulip: { label: "Tulip", cat: "floral", w: 100, h: 100, svg: tulip },
  babysBreath: { label: "Baby's breath", cat: "floral", w: 100, h: 100, svg: babysBreath },
  cherry: { label: "Blossom branch", cat: "floral", w: 160, h: 80, svg: cherryBranch },
  jasmine: { label: "Jasmine sprig", cat: "floral", w: 160, h: 70, svg: jasmine },
  vine: { label: "Vine", cat: "leaves", w: 200, h: 60, svg: vine },
  hangingVine: { label: "Hanging vine", cat: "leaves", w: 60, h: 206, svg: hangingVine },
  eucalyptus: { label: "Eucalyptus", cat: "leaves", w: 120, h: 120, svg: eucalyptus },
  fern: { label: "Fern", cat: "leaves", w: 120, h: 160, svg: fern },
  olive: { label: "Olive branch", cat: "leaves", w: 160, h: 60, svg: olive },
  laurel: { label: "Laurel", cat: "leaves", w: 120, h: 110, svg: laurel },
  wreath: { label: "Wreath", cat: "leaves", w: 100, h: 100, svg: wreath },
  monstera: { label: "Monstera leaf", cat: "leaves", w: 100, h: 100, svg: monstera },
  flourish: { label: "Flourish", cat: "lines", w: 200, h: 40, svg: flourish },
  diamondRule: { label: "Diamond line", cat: "lines", w: 200, h: 20, svg: diamondRule },
  swirlCorner: { label: "Swirl corner", cat: "lines", w: 100, h: 100, svg: swirlCorner },
  arch: { label: "Arch frame", cat: "lines", w: 100, h: 140, svg: arch },
  scallop: { label: "Scalloped ring", cat: "lines", w: 100, h: 100, svg: scallop },
  decoFan: { label: "Deco fan", cat: "lines", w: 100, h: 74, svg: decoFan },
  ribbon: { label: "Ribbon banner", cat: "lines", w: 200, h: 60, svg: ribbon },
  heart: { label: "Heart", cat: "celebrate", w: 100, h: 96, svg: heart },
  rings: { label: "Rings", cat: "celebrate", w: 100, h: 90, svg: rings },
  sparkle: { label: "Sparkle", cat: "celebrate", w: 100, h: 100, svg: sparkle },
  star: { label: "Star", cat: "celebrate", w: 100, h: 100, svg: starShape },
  balloons: { label: "Balloons", cat: "celebrate", w: 100, h: 100, svg: balloons },
  confetti: { label: "Confetti", cat: "celebrate", w: 100, h: 100, svg: confetti },
  cake: { label: "Cake", cat: "celebrate", w: 100, h: 100, svg: cake },
  gift: { label: "Gift", cat: "celebrate", w: 100, h: 100, svg: gift },
  gradCap: { label: "Graduation cap", cat: "celebrate", w: 100, h: 84, svg: gradCap },
  crescent: { label: "Crescent and star", cat: "festive", w: 100, h: 100, svg: crescent },
  ketupat: { label: "Ketupat", cat: "festive", w: 100, h: 100, svg: ketupat },
  pelita: { label: "Pelita", cat: "festive", w: 100, h: 100, svg: pelita },
  mosque: { label: "Mosque", cat: "festive", w: 100, h: 96, svg: mosque },
  islamicStar: { label: "Eight-point star", cat: "festive", w: 100, h: 100, svg: islamicStar },
  songket: { label: "Songket motif", cat: "festive", w: 100, h: 100, svg: songket },
  wau: { label: "Wau", cat: "festive", w: 100, h: 100, svg: wau },
  lantern: { label: "Lantern", cat: "festive", w: 100, h: 104, svg: lantern },
  diya: { label: "Diya", cat: "festive", w: 100, h: 80, svg: diya },
  kolam: { label: "Kolam", cat: "festive", w: 100, h: 100, svg: kolam },
  mandala: { label: "Mandala", cat: "festive", w: 100, h: 100, svg: mandala },
  washi: { label: "Washi tape", cat: "paper", w: 164, h: 40, svg: washi },
  waxSeal: { label: "Wax seal", cat: "paper", w: 100, h: 100, svg: waxSeal },
};

/** The drawing as a complete SVG, in one colour (default black, which is what a mask needs). */
export function stickerSVG(key, color = "#000") {
  const s = STICKERS[key]; if (!s) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.w} ${s.h}" fill="${color}" color="${color}">${s.svg}</svg>`;
}
/** A data: URL for using the drawing as a CSS mask (so it can be filled with any colour or a foil gradient). */
const maskCache = {};
export function stickerMask(key) {
  // single quotes inside url() and encoded, so it can sit inside a style="…" attribute
  return (maskCache[key] ||= `url('data:image/svg+xml,${encodeURIComponent(stickerSVG(key)).replace(/'/g, "%27")}')`);
}
