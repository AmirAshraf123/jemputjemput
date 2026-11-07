// Everything about how an invitation card looks: fonts, templates, photo placement.
// Used by the landing page, the editor and the guest page, so all three always match.
import { BASE_URL as SUPABASE_URL } from "./base-url.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const clamp = (n, a, b, d) => { n = +n; return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };

/* ---------- fonts ---------- */
// key: [label, CSS font stack, optional font-style]
export const FONTS = {
  italiana: ["Italiana", "'Italiana',Georgia,serif"],
  marcellus: ["Marcellus", "'Marcellus',Georgia,serif"],
  cinzel: ["Cinzel", "'Cinzel',Georgia,serif"],
  playfair: ["Playfair Display", "'Playfair Display',Georgia,serif"],
  playfairI: ["Playfair Display Italic", "'Playfair Display',Georgia,serif", "italic"],
  abril: ["Abril Fatface", "'Abril Fatface',Georgia,serif"],
  poiret: ["Poiret One", "'Poiret One','Josefin Sans',sans-serif"],
  greatvibes: ["Great Vibes (script)", "'Great Vibes',cursive"],
  parisienne: ["Parisienne (script)", "'Parisienne',cursive"],
  amiri: ["Amiri", "'Amiri',Georgia,serif"],
  cormorant: ["Cormorant Garamond", "'Cormorant Garamond',Georgia,serif"],
  cormorantI: ["Cormorant Garamond Italic", "'Cormorant Garamond',Georgia,serif", "italic"],
  ebgaramond: ["EB Garamond", "'EB Garamond',Georgia,serif"],
  lora: ["Lora", "'Lora',Georgia,serif"],
  josefin: ["Josefin Sans", "'Josefin Sans',system-ui,sans-serif"],
  figtree: ["Figtree", "'Figtree',system-ui,sans-serif"],
};

/* ---------- templates ---------- */
const BASE = { nameSize: 44, bodySize: 16, align: "center", radius: 0, line: false, ornament: "rule" };
export const PRESETS = [
  { id: "songket", name: "Songket", style: { ...BASE, bg: "#123d2f", ink: "#f1e4bd", accent: "#e7c873", frame: "diamonds", frameA: "#c9a24a", frameB: "#123d2f", line: true, nameFont: "marcellus", bodyFont: "cormorant", nameSize: 40 } },
  { id: "peranakan", name: "Peranakan", style: { ...BASE, bg: "#fbf3ea", ink: "#1f4d4a", accent: "#b8506c", frame: "dots", frameA: "#2f7f7a", frameB: "#e595ab", nameFont: "playfairI", bodyFont: "cormorant", nameSize: 40, radius: 6 } },
  { id: "minimal", name: "Minimal", style: { ...BASE, bg: "#fbfaf7", ink: "#2b2a27", accent: "#2b2a27", frame: "none", frameA: "#c9c4b8", frameB: "#fbfaf7", line: true, nameFont: "italiana", bodyFont: "cormorant", nameSize: 46 } },
  { id: "deco", name: "Art Deco", style: { ...BASE, bg: "#14161c", ink: "#e9dfc8", accent: "#d4b26a", frame: "deco", frameA: "#d4b26a", frameB: "#14161c", line: true, nameFont: "poiret", bodyFont: "josefin", nameSize: 42, bodySize: 15, ornament: "diamond" } },
  { id: "botanical", name: "Botanical", style: { ...BASE, bg: "#f3f5ee", ink: "#2f3b2c", accent: "#4f6b3a", frame: "stripes", frameA: "#cdd8bf", frameB: "#e5ecdb", nameFont: "parisienne", bodyFont: "ebgaramond", nameSize: 52, radius: 14, ornament: "flourish" } },
  { id: "blush", name: "Blush", style: { ...BASE, bg: "#fff7f5", ink: "#5a3d3d", accent: "#b76e79", frame: "double", frameA: "#e3aeb5", frameB: "#fff7f5", nameFont: "greatvibes", bodyFont: "lora", nameSize: 54, bodySize: 15, radius: 10, ornament: "dots" } },
  { id: "midnight", name: "Midnight", style: { ...BASE, bg: "#172447", ink: "#e6e9f2", accent: "#c9d1e6", frame: "dots", frameA: "#172447", frameB: "#8d9bc2", line: true, nameFont: "cinzel", bodyFont: "cormorant", nameSize: 36, ornament: "diamond" } },
  { id: "marigold", name: "Marigold", style: { ...BASE, bg: "#fff4e0", ink: "#5b1f12", accent: "#c2410c", frame: "checks", frameA: "#f59e0b", frameB: "#b91c1c", nameFont: "abril", bodyFont: "lora", nameSize: 40, bodySize: 15, radius: 4, ornament: "flourish" } },
  { id: "heritage", name: "Heritage", style: { ...BASE, bg: "#f7f1e3", ink: "#3a2f1d", accent: "#8a6a2c", frame: "double", frameA: "#8a6a2c", frameB: "#f7f1e3", nameFont: "amiri", bodyFont: "ebgaramond", nameSize: 44, ornament: "flourish" } },
];
export const presetById = (id) => PRESETS.find((p) => p.id === id);

/* ---------- style ---------- */
const HEX = /^#[0-9a-fA-F]{6}$/;
const FRAMES = ["none", "solid", "double", "diamonds", "checks", "dots", "stripes", "deco"];
const ORNAMENTS = ["rule", "dots", "diamond", "flourish", "none"];

/** Returns a safe, complete style. Anything missing or invalid falls back. */
export function cleanStyle(s, fallback = PRESETS[0].style) {
  s = s && typeof s === "object" ? s : {};
  const f = fallback, col = (k) => (HEX.test(s[k]) ? s[k] : f[k]);
  return {
    bg: col("bg"), ink: col("ink"), accent: col("accent"), frameA: col("frameA"), frameB: col("frameB"),
    frame: FRAMES.includes(s.frame) ? s.frame : f.frame,
    ornament: ORNAMENTS.includes(s.ornament) ? s.ornament : f.ornament,
    align: s.align === "left" ? "left" : "center",
    line: typeof s.line === "boolean" ? s.line : !!f.line,
    nameFont: FONTS[s.nameFont] ? s.nameFont : f.nameFont,
    bodyFont: FONTS[s.bodyFont] ? s.bodyFont : f.bodyFont,
    nameSize: clamp(s.nameSize, 28, 64, f.nameSize),
    bodySize: clamp(s.bodySize, 13, 20, f.bodySize),
    radius: clamp(s.radius, 0, 28, f.radius),
  };
}

export function frameCSS(s, scale = 1) {
  const A = s.frameA, B = s.frameB, p = Math.round(14 * scale), u = (n) => Math.max(3, Math.round(n * scale)) + "px";
  switch (s.frame) {
    case "none": return `background:${s.bg};padding:0`;
    case "solid": return `background:${A};padding:${p}px`;
    case "double": return `background:${s.bg};padding:${Math.round(8 * scale)}px;border:${u(7)} double ${A}`;
    case "diamonds": return `background:repeating-conic-gradient(from 45deg,${A} 0 25%,${B} 0 50%) 0 0/${u(16)} ${u(16)};padding:${p}px`;
    case "checks": return `background:repeating-conic-gradient(${A} 0 25%,${B} 0 50%) 0 0/${u(14)} ${u(14)};padding:${p}px`;
    case "dots": return `background:radial-gradient(circle,${B} ${u(3)},transparent ${u(4)}) 0 0/${u(18)} ${u(18)},${A};padding:${p}px`;
    case "stripes": return `background:repeating-linear-gradient(45deg,${A} 0 ${u(6)},${B} ${u(6)} ${u(12)});padding:${p}px`;
    case "deco": return `background:repeating-linear-gradient(90deg,${A} 0 ${u(2)},${B} ${u(2)} ${u(8)});padding:${p}px`;
  }
  return "";
}

function innerVars(s) {
  const nf = FONTS[s.nameFont], bf = FONTS[s.bodyFont];
  return `--cbg:${s.bg};--ink:${s.ink};--acc:${s.accent};--lc:${s.frameA};--nf:${nf[1]};--nfs:${nf[2] || "normal"};--bf:${bf[1]};--ns:${s.nameSize}px;--bs:${s.bodySize}px;--al:${s.align};--ji:${s.align === "left" ? "start" : "center"}`;
}
const ORN = { dots: "• • •", diamond: "◆", flourish: "❦" };

/* ---------- photo ---------- */
// h = frame height as % of its width
export const SHAPE_DEF = { arch: { size: 72, h: 133 }, circle: { size: 58, h: 100 }, rect: { size: 72, h: 75 } };
const PHOTO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(jpg|png|webp|gif)$/;

export function cleanPhoto(p) {
  if (!p || typeof p !== "object" || !PHOTO_PATH.test(p.path)) return null;
  const shape = ["arch", "circle", "rect"].includes(p.shape) ? p.shape : "arch", d = SHAPE_DEF[shape];
  return {
    path: p.path, mode: p.mode === "background" ? "background" : "top", shape,
    size: clamp(p.size, 30, 100, d.size), h: clamp(p.h, 40, 200, d.h),
    dx: clamp(p.dx, -100, 100, 0), dy: clamp(p.dy, -100, 100, 0),
    zoom: clamp(p.zoom, 20, 300, 100), ar: clamp(p.ar, 0.2, 5, 1.5), fade: clamp(p.fade, 0, 90, 60),
  };
}
export const photoUrl = (p) => (p?.path ? `${SUPABASE_URL}/storage/v1/object/public/photos/${p.path}` : "");
export const imgCSS = (p) => `--z:${(p.zoom / 100).toFixed(3)};--dx:${p.dx};--dy:${p.dy};--ar:${p.ar.toFixed(4)}`;
export function hexRgb(h) { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }

/** Learns each photo's real proportions when it loads. onAspect(ar) lets the editor store it. */
export function watchPhotos(onAspect) {
  document.addEventListener("load", (e) => {
    const img = e.target;
    if (!img.matches?.(".c-photo img,.c-bg img") || !img.naturalWidth) return;
    const ar = img.naturalWidth / img.naturalHeight;
    img.style.setProperty("--ar", ar.toFixed(4));
    onAspect?.(ar);
  }, true);
  document.addEventListener("error", (e) => {
    const b = e.target.closest?.(".c-photo,.c-bg");
    if (b && e.target.tagName === "IMG") b.hidden = true;
  }, true);
}

/* ---------- details ---------- */
export const DEFAULT_DETAILS = {
  name1: "", name2: "", headline: "Together with their families",
  message: "We would be honoured to have you with us as we begin our life together.",
  date: "", start: "11:00", end: "16:00", rsvpBy: "", venue: "", address: "", dress: "",
};
const LIMITS = { name1: 60, name2: 60, headline: 80, message: 400, date: 10, start: 5, end: 5, rsvpBy: 10, venue: 120, address: 200, dress: 80 };
export function cleanDetails(d) {
  d = d && typeof d === "object" ? d : {};
  const out = {};
  for (const k of Object.keys(DEFAULT_DETAILS)) out[k] = typeof d[k] === "string" ? d[k].slice(0, LIMITS[k]) : DEFAULT_DETAILS[k];
  return out;
}

export function fmtDate(d) {
  if (!d) return "";
  const x = new Date(d + "T00:00:00");
  return isNaN(x) ? "" : x.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
export function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
export const timeRange = (d) => [fmtTime(d.start), fmtTime(d.end)].filter(Boolean).join(" – ");

/* ---------- rendering ---------- */
/** inv = { details, style, photo }. Returns the card's HTML. */
export function cardHTML(inv, guestName) {
  const d = cleanDetails(inv.details), s = cleanStyle(inv.style), p = cleanPhoto(inv.photo), src = photoUrl(p);
  const orn = s.ornament === "none" ? "" : s.ornament === "rule" ? `<div class="c-orn rule"></div>` : `<div class="c-orn" aria-hidden="true">${ORN[s.ornament]}</div>`;
  let bg = "", top = "", veil = "";
  if (src) {
    const img = `<img src="${esc(src)}" alt="" style="${imgCSS(p)}">`;
    if (p.mode === "background") { bg = `<div class="c-bg">${img}</div><div class="c-veil"></div>`; veil = `;--veil:rgba(${hexRgb(s.bg)},${(p.fade / 100).toFixed(2)})`; }
    else top = `<div class="c-photo ${p.shape}" style="width:${p.size}%;aspect-ratio:100/${p.h}">${img}</div>`;
  }
  return `<div class="card" style="${frameCSS(s)};--r:${s.radius}px"><div class="card-inner${s.line ? " lined" : ""}${bg ? " has-bg" : ""}" style="${innerVars(s)}${veil}">
    ${bg}${top}
    ${d.headline ? `<p class="c-head">${esc(d.headline)}</p>` : ""}
    <h2 class="c-names"><span>${esc(d.name1 || "Your name")}</span><span class="amp">&amp;</span><span>${esc(d.name2 || "Partner's name")}</span></h2>
    ${d.message ? `<p class="c-msg">${esc(d.message)}</p>` : ""}
    ${orn}
    <p class="c-date">${esc(fmtDate(d.date) || "Pick a date")}</p>
    <p class="c-time">${esc(timeRange(d))}</p>
    ${d.venue ? `<p class="c-venue">${esc(d.venue)}</p>` : ""}
    ${d.address ? `<p class="c-addr">${esc(d.address)}</p>` : ""}
    ${d.dress ? `<p class="c-dress">Dress code: ${esc(d.dress)}</p>` : ""}
    ${guestName ? `<p class="c-for">Specially for ${esc(guestName)}</p>` : ""}
  </div></div>`;
}

/** Small template swatch with the couple's initials. */
export function thumbHTML(style, label, initials) {
  const s = cleanStyle(style), nf = FONTS[s.nameFont];
  return `<span class="thumb" style="${frameCSS(s, 0.45)};border-radius:${Math.round(s.radius * 0.5)}px"><span class="thumb-in" style="background:${s.bg};color:${s.accent};font-family:${nf[1]};font-style:${nf[2] || "normal"};border-radius:${Math.round(s.radius * 0.3)}px">${esc(initials)}</span></span>${esc(label)}`;
}
