// Editor: three readable colour sets made from the main colours of the card's photo.
import { $, toast } from "./sb.js";
import { esc, cleanStyle, photoUrl, mix, contrast, fixColor } from "./card.js";

let ctx = null;
/** ctx: { inv: the invitation being edited, applied() after a colour set is applied } */
export function setupPalette(c) { ctx = c; }

/* ---------- colours from the photo ---------- */
// Finds the photo's main colours (a small k-means on a thumbnail), then builds three readable colour sets from them.
const hexOfRgb = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
function satOf(hex) { const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; }
const lumOf = (hex) => contrast(hex, "#000000");   // higher = lighter
async function photoColours(src) {
  const img = new Image(); img.crossOrigin = "anonymous";
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
  const c = document.createElement("canvas"); c.width = c.height = 48;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0, 48, 48);
  const px = [], d = g.getImageData(0, 0, 48, 48).data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) px.push([d[i], d[i + 1], d[i + 2]]);
  px.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  let cents = Array.from({ length: 6 }, (_, k) => px[Math.floor(((k + 0.5) / 6) * px.length)]);
  let groups = [];
  for (let it = 0; it < 10; it++) {
    groups = cents.map(() => []);
    for (const p of px) { let bi = 0, bd = Infinity; cents.forEach((q, i) => { const dd = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (dd < bd) { bd = dd; bi = i; } }); groups[bi].push(p); }
    cents = groups.map((gr, i) => (gr.length ? [0, 1, 2].map((j) => gr.reduce((a, p) => a + p[j], 0) / gr.length) : cents[i]));
  }
  return cents.map((q, i) => ({ hex: hexOfRgb(q), n: groups[i].length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
}
function palettesFrom(cols) {
  const byLum = [...cols].sort((a, b) => lumOf(a.hex) - lumOf(b.hex));
  const dark = byLum[0].hex, light = byLum[byLum.length - 1].hex;
  const vivids = [...cols].sort((a, b) => satOf(b.hex) * Math.sqrt(b.n) - satOf(a.hex) * Math.sqrt(a.n));
  const v1 = vivids[0].hex, v2 = (vivids[1] || vivids[0]).hex;
  const make = (name, bg, inkFrom, accFrom, frameA, frameB) => {
    const ink = fixColor(inkFrom, bg, 4.5), accent = fixColor(accFrom, bg, 3);
    return { name, style: { bg, ink, headColor: ink, accent, frameA: frameA || accent, frameB: frameB || bg, bg2: mix(bg, accent, 0.18) } };
  };
  return [
    make("Light", mix(light, "#ffffff", 0.65), dark, v1),
    make("Dark", mix(dark, "#000000", 0.25), mix(light, "#ffffff", 0.5), v1 === dark ? light : v1),
    make("Rich", mix(v1, "#000000", 0.45), mix(light, "#ffffff", 0.7), v2 === v1 ? light : v2, null, mix(v1, "#000000", 0.6)),
  ];
}
let palettes = [];
$("palGo").addEventListener("click", async (e) => {
  const b = e.currentTarget; b.disabled = true; b.textContent = "Looking at your photo…";
  try {
    palettes = palettesFrom(await photoColours(photoUrl(ctx.inv.photo)));
    $("palList").innerHTML = palettes.map((p, i) => `<button type="button" class="pal-opt" data-pal="${i}">
        <span class="pal-sw" aria-hidden="true">${[p.style.bg, p.style.ink, p.style.accent, p.style.frameA, p.style.frameB].map((c) => `<i style="background:${c}"></i>`).join("")}</span>
        <span>${esc(p.name)}</span></button>`).join("");
    $("palList").querySelector("button")?.focus();
  } catch { toast("Couldn't read the photo's colours. Try again in a moment."); }
  finally { b.disabled = false; b.textContent = "Pick colours from my photo"; }
});
$("palList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-pal]"); if (!b) return;
  const p = palettes[+b.dataset.pal];
  ctx.inv.style = cleanStyle({ ...ctx.inv.style, ...p.style }, ctx.inv.style);
  ctx.applied();
  toast(`${p.name} colours from your photo applied. Undo puts the old ones back.`);
});
