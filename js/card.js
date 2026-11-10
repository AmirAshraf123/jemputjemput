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
  { id: "confetti", name: "Confetti", style: { ...BASE, bg: "#fffaf3", ink: "#3b2a4a", accent: "#d63b72", frame: "confetti", frameA: "#fffaf3", frameB: "#2bb3a3", nameFont: "abril", bodyFont: "josefin", nameSize: 46, bodySize: 15, radius: 14, ornament: "dots" } },
  { id: "sunny", name: "Sunny", style: { ...BASE, bg: "#fff6dc", ink: "#4a3410", accent: "#d5641c", frame: "stripes", frameA: "#ffd166", frameB: "#fff6dc", nameFont: "poiret", bodyFont: "lora", nameSize: 48, radius: 12, ornament: "dots" } },
  { id: "littleone", name: "Little One", style: { ...BASE, bg: "#f4f8fb", ink: "#33465c", accent: "#5b80ad", frame: "dots", frameA: "#dce8f3", frameB: "#f3c1cf", nameFont: "greatvibes", bodyFont: "lora", nameSize: 56, bodySize: 15, radius: 20, ornament: "flourish" } },
  { id: "festive", name: "Festive", style: { ...BASE, bg: "#0f4a3a", ink: "#f6ead0", accent: "#f2c14e", frame: "checks", frameA: "#f2c14e", frameB: "#0f4a3a", line: true, nameFont: "cinzel", bodyFont: "cormorant", nameSize: 36, ornament: "diamond" } },
  { id: "graduate", name: "Graduate", style: { ...BASE, bg: "#1b2440", ink: "#eef0f6", accent: "#e3b04b", frame: "solid", frameA: "#e3b04b", frameB: "#1b2440", nameFont: "playfair", bodyFont: "figtree", nameSize: 42, bodySize: 15, radius: 4 } },
  { id: "rosegold", name: "Rose Gold", style: { ...BASE, bg: "#fbf1ee", ink: "#4d2f2a", accent: "#a8636a", frame: "double", frameA: "#c9968f", frameB: "#fbf1ee", nameFont: "cormorantI", bodyFont: "ebgaramond", nameSize: 50, radius: 6, ornament: "flourish" } },
];

/* ---------- occasions ----------
   two:  the card shows two names joined by "&" (a couple); otherwise one main name with an optional smaller line under it. */
export const OCCASIONS = {
  wedding: {
    label: "Wedding", two: true, legend: "The couple", l1: "First name", l2: "Second name", ph1: "Your name", ph2: "Partner's name",
    headline: "Together with their families", message: "We would be honoured to have you with us as we begin our life together.", hosts: "couple", template: "songket"
  },
  engagement: {
    label: "Engagement", two: true, legend: "The couple", l1: "First name", l2: "Second name", ph1: "Your name", ph2: "Partner's name",
    headline: "Please join us to celebrate the engagement of", message: "Come and share our joy as we take the next step together.", hosts: "couple", template: "rosegold"
  },
  birthday: {
    label: "Birthday", two: false, legend: "Whose birthday", l1: "Birthday person", l2: "Which birthday (optional)", ph1: "Name", ex2: "e.g. 30th Birthday",
    headline: "You're invited to celebrate", message: "Join us for cake, good food and even better company!", hosts: "host", template: "confetti"
  },
  baby: {
    label: "Aqiqah or baby celebration", two: false, legend: "The baby", l1: "Baby's name", l2: "Parents (optional)", ph1: "Baby's name", ex2: "e.g. Son of Hakim & Nadia",
    headline: "Please join us to welcome", message: "We would love you to celebrate the arrival of our little one with us.", hosts: "family", template: "littleone"
  },
  anniversary: {
    label: "Anniversary", two: true, legend: "The couple", l1: "First name", l2: "Second name", ph1: "Your name", ph2: "Partner's name",
    headline: "Celebrating 25 years together", message: "Please join us as we mark this milestone with family and friends.", hosts: "couple", template: "rosegold"
  },
  openhouse: {
    label: "Open house or festive gathering", two: false, legend: "The event", l1: "Event name", l2: "Hosted by (optional)", ph1: "Event name", ex2: "e.g. The Hakim family",
    headline: "You're warmly invited to our", message: "Drop by for good food and good company. Bring the whole family!", hosts: "host", template: "festive"
  },
  graduation: {
    label: "Graduation", two: false, legend: "The graduate", l1: "Graduate's name", l2: "Achievement (optional)", ph1: "Name", ex2: "e.g. Class of 2027",
    headline: "Please join us to celebrate", message: "Help us celebrate years of hard work and a bright future ahead.", hosts: "host", template: "graduate"
  },
  party: {
    label: "Party or other event", two: false, legend: "The event", l1: "Event name", l2: "Hosted by (optional)", ph1: "Event name", ex2: "e.g. The Events Team",
    headline: "You're invited to", message: "We'd love you to join us.", hosts: "host", template: "sunny"
  },
};
export const occasionOf = (d) => OCCASIONS[d?.occasion] || OCCASIONS.wedding;

/** A short name for the event, e.g. "Hakim & Nadia's wedding" or "Aisyah's 30th Birthday". */
export function eventTitle(d) {
  const o = d?.occasion in OCCASIONS ? d.occasion : "wedding";
  const n1 = (d?.name1 || "").trim(), n2 = (d?.name2 || "").trim();
  const pair = [n1, n2].filter(Boolean).join(" & ");
  switch (o) {
    case "wedding": return pair ? `${pair}'s wedding` : "Wedding";
    case "engagement": return pair ? `${pair}'s engagement` : "Engagement";
    case "anniversary": return pair ? `${pair}'s anniversary` : "Anniversary";
    case "birthday": return n1 ? `${n1}'s ${n2 || "birthday"}` : (n2 || "Birthday");
    case "baby": return n1 ? `Welcoming baby ${n1}` : "Baby celebration";
    case "graduation": return n1 ? `${n1}'s graduation` : "Graduation";
    default: return n1 || OCCASIONS[o].label;
  }
}
/** The opening line of a WhatsApp invitation. */
export function inviteLine(d) {
  const o = d?.occasion in OCCASIONS ? d.occasion : "wedding";
  const n2 = (d?.name2 || "").trim();
  if ((o === "openhouse" || o === "party") && n2) return `You're invited to ${eventTitle(d)}, hosted by ${n2}`;
  if (o === "baby") return (d?.name1 || "").trim() ? `You're invited to welcome baby ${d.name1.trim()}` : "You're invited to our baby celebration";
  return `You're invited to ${eventTitle(d)}`;
}
/** Who guests are replying to: "the couple", "the family" or "the hosts". */
export const hostWord = (d) => ({ couple: "the couple", family: "the family", host: "the hosts" })[occasionOf(d).hosts];
/** Default wording when creating an invitation for an occasion. */
export function defaultDetailsFor(o) {
  const occ = OCCASIONS[o] || OCCASIONS.wedding;
  return { ...DEFAULT_DETAILS, occasion: o in OCCASIONS ? o : "wedding", headline: occ.headline, message: occ.message };
}
/** Letters shown on template swatches and dashboard tiles. */
export function initialsFor(d) {
  const occ = occasionOf(d), n1 = (d?.name1 || "").trim(), n2 = (d?.name2 || "").trim();
  if (occ.two) return `${(n1 || "A")[0]}&${(n2 || "B")[0]}`.toUpperCase();
  const w = n1.split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || occ.label)[0]).toUpperCase();
}
export const presetById = (id) => PRESETS.find((p) => p.id === id);

/* ---------- style ---------- */
const HEX = /^#[0-9a-fA-F]{6}$/;
const FRAMES = ["none", "solid", "double", "diamonds", "checks", "dots", "stripes", "deco", "confetti"];
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
    case "confetti": {
      const dot = (c, x, y, r, t) => `radial-gradient(circle at ${x}% ${y}%,${c} 0 ${u(r)},transparent ${u(r + 0.6)}) 0 0/${u(t)} ${u(t)}`;
      return `background:${dot(B, 25, 30, 3, 22)},${dot(s.accent, 70, 65, 3, 26)},${dot("#f5b82e", 45, 85, 2.5, 18)},${A};padding:${p}px`;
    }
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
    path: p.path, mode: ["top", "bottom", "left", "right", "background"].includes(p.mode) ? p.mode : "top", shape,
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
  occasion: "wedding", name1: "", name2: "", headline: "Together with their families",
  message: "We would be honoured to have you with us as we begin our life together.",
  date: "", start: "11:00", end: "16:00", rsvpBy: "", venue: "", address: "", dress: "",
};
const LIMITS = { occasion: 20, name1: 60, name2: 60, headline: 80, message: 400, date: 10, start: 5, end: 5, rsvpBy: 10, venue: 120, address: 200, dress: 80 };
export function cleanDetails(d) {
  d = d && typeof d === "object" ? d : {};
  const out = {};
  for (const k of Object.keys(DEFAULT_DETAILS)) out[k] = typeof d[k] === "string" ? d[k].slice(0, LIMITS[k]) : DEFAULT_DETAILS[k];
  if (!(out.occasion in OCCASIONS)) out.occasion = "wedding";   // invitations made before occasions existed are weddings
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
  const d = cleanDetails(inv.details), s = cleanStyle(inv.style), p = cleanPhoto(inv.photo), src = photoUrl(p), occ = occasionOf(d);
  const orn = s.ornament === "none" ? "" : s.ornament === "rule" ? `<div class="c-orn rule"></div>` : `<div class="c-orn" aria-hidden="true">${ORN[s.ornament]}</div>`;
  let bg = "", photo = "", veil = "";
  if (src) {
    const img = `<img src="${esc(src)}" alt="" style="${imgCSS(p)}">`;
    if (p.mode === "background") { bg = `<div class="c-bg">${img}</div><div class="c-veil"></div>`; veil = `;--veil:rgba(${hexRgb(s.bg)},${(p.fade / 100).toFixed(2)})`; }
    else {
      const side = p.mode === "left" || p.mode === "right";
      photo = `<div class="c-photo ${p.shape} at-${p.mode}" style="${side ? "" : `width:${p.size}%;`}aspect-ratio:100/${p.h}">${img}</div>`;
    }
  }
  const names = occ.two
    ? `<h2 class="c-names"><span>${esc(d.name1 || occ.ph1)}</span><span class="amp">&amp;</span><span>${esc(d.name2 || occ.ph2)}</span></h2>`
    : `<h2 class="c-names"><span>${esc(d.name1 || occ.ph1)}</span></h2>${d.name2 ? `<p class="c-sub">${esc(d.name2)}</p>` : ""}`;
  const content = `
    ${d.headline ? `<p class="c-head">${esc(d.headline)}</p>` : ""}
    ${names}
    ${d.message ? `<p class="c-msg">${esc(d.message)}</p>` : ""}
    ${orn}
    <p class="c-date">${esc(fmtDate(d.date) || "Pick a date")}</p>
    <p class="c-time">${esc(timeRange(d))}</p>
    ${d.venue ? `<p class="c-venue">${esc(d.venue)}</p>` : ""}
    ${d.address ? `<p class="c-addr">${esc(d.address)}</p>` : ""}
    ${d.dress ? `<p class="c-dress">Dress code: ${esc(d.dress)}</p>` : ""}
    ${guestName ? `<p class="c-for">Specially for ${esc(guestName)}</p>` : ""}`;
  let body;
  if (photo && (p.mode === "left" || p.mode === "right")) {
    body = `<div class="c-side ${p.mode}" style="--pw:${Math.round(p.size * 0.55)}%">${photo}<div class="c-main">${content}</div></div>`;
  } else if (photo && p.mode === "bottom") body = content + photo;
  else body = photo + content;
  return `<div class="card" style="${frameCSS(s)};--r:${s.radius}px"><div class="card-inner${s.line ? " lined" : ""}${bg ? " has-bg" : ""}" style="${innerVars(s)}${veil}">
    ${bg}${body}
  </div></div>`;
}

/** Small template swatch with the event's initials. */
export function thumbHTML(style, label, initials) {
  const s = cleanStyle(style), nf = FONTS[s.nameFont];
  return `<span class="thumb" style="${frameCSS(s, 0.45)};border-radius:${Math.round(s.radius * 0.5)}px"><span class="thumb-in" style="background:${s.bg};color:${s.accent};font-family:${nf[1]};font-style:${nf[2] || "normal"};border-radius:${Math.round(s.radius * 0.3)}px">${esc(initials)}</span></span>${esc(label)}`;
}