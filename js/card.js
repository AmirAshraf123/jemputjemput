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

/* Google Fonts request for each font. Pages only load the site's own fonts (Figtree and Playfair Display);
   card fonts are added the first time a card or swatch needs them, so a guest downloads only their card's two fonts. */
const GFAMILY = {
  italiana: "Italiana", marcellus: "Marcellus", cinzel: "Cinzel:wght@400;600",
  playfair: "Playfair+Display:ital,wght@0,400;0,500;1,500", playfairI: "Playfair+Display:ital,wght@0,400;0,500;1,500",
  abril: "Abril+Fatface", poiret: "Poiret+One", greatvibes: "Great+Vibes", parisienne: "Parisienne", amiri: "Amiri:wght@400;700",
  cormorant: "Cormorant+Garamond:ital,wght@0,400;0,600;1,400", cormorantI: "Cormorant+Garamond:ital,wght@0,400;0,600;1,400",
  ebgaramond: "EB+Garamond:ital@0;1", lora: "Lora:ital@0;1", josefin: "Josefin+Sans:wght@300;400;600", figtree: "",
  notoSC: "Noto+Serif+SC:wght@400;600", notoTamil: "Noto+Serif+Tamil:wght@400;600",
};
/** Second language shown under the heading, names and message. */
export const ALT_SCRIPTS = {
  "": { label: "None" },
  same: { label: "Malay or English (same fonts)" },
  zh: { label: "Chinese", font: "'Noto Serif SC',serif", key: "notoSC" },
  ta: { label: "Tamil", font: "'Noto Serif Tamil',serif", key: "notoTamil" },
  jawi: { label: "Jawi or Arabic", font: "'Amiri',serif", key: "amiri", rtl: true },
};
const loadedFamilies = new Set(["", "Playfair+Display:ital,wght@0,400;0,500;1,500"]);   // already linked by every page
/** Google Fonts stylesheet address for these fonts (used to embed fonts when saving the card as a picture). */
export function fontCSSUrl(keys) {
  const fams = [...new Set(keys.map((k) => GFAMILY[k]).filter(Boolean))];
  return fams.length ? "https://fonts.googleapis.com/css2?" + fams.map((f) => "family=" + f).join("&") + "&display=swap" : "";
}
/** The font keys a card uses: names, text and any second-language font. */
export function cardFontKeys(inv) {
  const s = cleanStyle(inv.style), d = cleanDetails(inv.details), alt = ALT_SCRIPTS[d.altScript];
  return [s.nameFont, s.bodyFont, alt.key, "figtree", "playfair"].filter(Boolean);
}
export function ensureFonts(keys) {
  if (typeof document === "undefined") return;
  const want = [...new Set(keys.map((k) => GFAMILY[k]).filter((f) => f !== undefined && !loadedFamilies.has(f)))];
  if (!want.length) return;
  want.forEach((f) => loadedFamilies.add(f));
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?" + want.map((f) => "family=" + f).join("&") + "&display=swap";
  document.head.appendChild(link);
}

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
    label: "Wedding", two: true, sides: true, legend: "The couple", l1: "First name", l2: "Second name", ph1: "Your name", ph2: "Partner's name",
    headline: "Together with their families", message: "We would be honoured to have you with us as we begin our life together.", hosts: "couple", template: "songket"
  },
  engagement: {
    label: "Engagement", two: true, sides: true, legend: "The couple", l1: "First name", l2: "Second name", ph1: "Your name", ph2: "Partner's name",
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
export const CORNERS = { none: "None", floral: "Flowers", leaf: "Leafy vine", ketupat: "Ketupat weave", mandala: "Mandala arcs" };
export const TEXTURES = { none: "Plain", paper: "Paper grain", linen: "Linen", dots: "Soft dots", gradient: "Gradient" };
export const SHAPES = { portrait: "Portrait (fits the text)", square: "Square: Instagram post", story: "Tall: Stories and Status" };

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
    // added later; older designs fall back to how cards looked before
    headColor: HEX.test(s.headColor) ? s.headColor : (HEX.test(f.headColor) ? f.headColor : col("ink")),
    headCase: ["upper", "normal"].includes(s.headCase) ? s.headCase : (f.headCase || "upper"),
    headItalic: typeof s.headItalic === "boolean" ? s.headItalic : !!f.headItalic,
    headSpacing: clamp(s.headSpacing, 0, 40, f.headSpacing ?? 22),
    corners: s.corners in CORNERS ? s.corners : (f.corners in CORNERS ? f.corners : "none"),
    texture: s.texture in TEXTURES ? s.texture : (f.texture in TEXTURES ? f.texture : "none"),
    bg2: HEX.test(s.bg2) ? s.bg2 : (HEX.test(f.bg2) ? f.bg2 : mix(col("bg"), col("accent"), 0.18)),
    shape: s.shape in SHAPES ? s.shape : (f.shape in SHAPES ? f.shape : "portrait"),
  };
}

/* ---------- colour helpers and the readability check ---------- */
const rgbOf = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hexOf = (c) => "#" + c.map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0")).join("");
export function mix(a, b, t) { const x = rgbOf(a), y = rgbOf(b); return hexOf(x.map((v, i) => v + (y[i] - v) * t)); }
function lum(h) { return rgbOf(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0); }
export function contrast(a, b) { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }
/** Darkens or lightens fg (whichever works better) just enough to reach the target contrast against every background colour given. */
export function fixColor(fg, grounds, need) {
  grounds = [].concat(grounds);
  const worst = (c) => Math.min(...grounds.map((g) => contrast(c, g)));
  const toward = worst("#000000") >= worst("#ffffff") ? "#000000" : "#ffffff";
  for (let t = 0; t <= 1.0001; t += 0.02) { const c = mix(fg, toward, t); if (worst(c) >= need) return c; }
  return toward;
}
/** Text colours that would be hard to read on this card. Names are large text, so they need 3:1; other text 4.5:1. */
export function readabilityIssues(style, photo) {
  const s = cleanStyle(style), p = cleanPhoto(photo);
  const grounds = s.texture === "gradient" ? [s.bg, s.bg2] : [s.bg];
  const worst = (c) => Math.min(...grounds.map((g) => contrast(c, g)));
  const issues = [];
  for (const [key, label, need] of [["ink", "Text", 4.5], ["headColor", "Heading", 4.5], ["accent", "Names", 3]]) {
    const r = worst(s[key]);
    if (r < need) issues.push({ key, label, ratio: r, need, fix: fixColor(s[key], grounds, need) });
  }
  if (p?.mode === "background" && p.fade < 55) issues.push({ key: "fade", label: "Photo behind the text", photo: true });
  return issues;
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

function textureCSS(s) {
  const ink = rgbOf(s.ink).join(","), acc = rgbOf(s.accent).join(",");
  switch (s.texture) {
    case "paper": return `radial-gradient(rgba(${ink},.06) 1px,transparent 1.3px) 0 0/4px 4px,radial-gradient(rgba(${ink},.04) 1px,transparent 1.3px) 2px 2px/5px 5px`;
    case "linen": return `repeating-linear-gradient(0deg,rgba(${ink},.04) 0 1px,transparent 1px 4px),repeating-linear-gradient(90deg,rgba(${ink},.04) 0 1px,transparent 1px 4px)`;
    case "dots": return `radial-gradient(rgba(${acc},.14) 1.6px,transparent 2px) 0 0/16px 16px`;
    case "gradient": return `linear-gradient(165deg,${s.bg} 0%,${s.bg2} 100%)`;
    default: return "linear-gradient(transparent,transparent)";
  }
}
function innerVars(s) {
  const nf = FONTS[s.nameFont], bf = FONTS[s.bodyFont];
  return `--tex:${textureCSS(s)};--hc:${s.headColor};--htt:${s.headCase === "upper" ? "uppercase" : "none"};--hfs:${s.headItalic ? "italic" : "normal"};--hls:${(s.headSpacing / 100).toFixed(2)}em;--cbg:${s.bg};--ink:${s.ink};--acc:${s.accent};--lc:${s.frameA};--nf:${nf[1]};--nfs:${nf[2] || "normal"};--bf:${bf[1]};--ns:${s.nameSize}px;--bs:${s.bodySize}px;--al:${s.align};--ji:${s.align === "left" ? "start" : "center"}`;
}
const ORN = { dots: "• • •", diamond: "◆", flourish: "❦" };
/* Corner ornaments, drawn for the top-left corner and mirrored for the others. Colour follows the names colour. */
const CORNER_SVG = {
  floral: `<path d="M5 44C5 22 22 5 44 5" fill="none" stroke="currentColor" stroke-width="1.4"/><g fill="currentColor"><g opacity=".55">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="15" cy="8.5" rx="3.2" ry="5.2" transform="rotate(${a} 15 15)"/>`).join("")}</g><circle cx="15" cy="15" r="3"/><circle cx="31" cy="7.6" r="2"/><circle cx="7.6" cy="31" r="2"/><ellipse cx="41" cy="5.6" rx="5" ry="1.8" transform="rotate(-12 41 5.6)"/><ellipse cx="5.6" cy="41" rx="1.8" ry="5" transform="rotate(-12 5.6 41)"/></g>`,
  leaf: `<path d="M4 58C4 28 28 4 58 4" fill="none" stroke="currentColor" stroke-width="1.4"/><g fill="currentColor">${[[8, 40, -70], [13, 27, -55], [22, 16, -38], [34, 9, -22], [47, 5.5, -10]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="5.4" transform="rotate(${r} ${x} ${y})"/>`).join("")}${[[16, 36, -25], [27, 24, -45], [40, 15, -62]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="1.8" ry="4" opacity=".6" transform="rotate(${r} ${x} ${y})"/>`).join("")}</g>`,
  ketupat: `<g fill="none" stroke="currentColor" stroke-width="1.4"><path d="M17 3L31 17L17 31L3 17Z"/><path d="M10 10L24 24M24 10L10 24" opacity=".7"/><path d="M17 8L26 17L17 26L8 17Z" opacity=".7"/><path d="M31 17H58M17 31V58" opacity=".6"/></g><g fill="currentColor"><circle cx="44" cy="17" r="1.6"/><circle cx="17" cy="44" r="1.6"/></g>`,
  mandala: `<g fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 15A12 12 0 0 0 15 3"/><path d="M3 25A22 22 0 0 0 25 3" opacity=".8"/><path d="M3 35A32 32 0 0 0 35 3" opacity=".6"/></g><g fill="currentColor">${[10, 25, 40, 55, 70, 80].map((a) => { const r = 42, x = 3 + r * Math.cos((a * Math.PI) / 180), y = 3 + r * Math.sin((a * Math.PI) / 180); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.7"/>`; }).join("")}</g>`,
};
function cornersHTML(name) {
  if (!CORNER_SVG[name]) return "";
  return `<div class="c-corners" aria-hidden="true">${["tl", "tr", "bl", "br"].map((c) => `<svg class="cn ${c}" viewBox="0 0 64 64">${CORNER_SVG[name]}</svg>`).join("")}</div>`;
}

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
export const musicUrl = (path) => (path ? `${SUPABASE_URL}/storage/v1/object/public/photos/${path}` : "");
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
/** Parts of the card that can be reordered or hidden. */
export const SECTIONS = { headline: "Heading", names: "Names", message: "Message", divider: "Divider", when: "Date and time", where: "Venue and address", dress: "Dress code", extras: "Extra lines and schedule" };
export const OPENINGS = { none: "Show the card straight away", envelope: "Envelope they tap to open", fade: "Gentle fade-in" };
export const DEFAULT_DETAILS = {
  altScript: "", altHeadline: "", altNames: "", altMessage: "", opening: "none", music: "",
  occasion: "wedding", name1: "", name2: "", headline: "Together with their families",
  message: "We would be honoured to have you with us as we begin our life together.",
  date: "", start: "11:00", end: "16:00", rsvpBy: "", venue: "", address: "", dress: "",
};
const LIMITS = { altScript: 8, altHeadline: 100, altNames: 100, altMessage: 400, opening: 10, music: 120, occasion: 20, name1: 60, name2: 60, headline: 80, message: 400, date: 10, start: 5, end: 5, rsvpBy: 10, venue: 120, address: 200, dress: 80 };
export function cleanDetails(d) {
  d = d && typeof d === "object" ? d : {};
  const out = {};
  for (const k of Object.keys(DEFAULT_DETAILS)) out[k] = typeof d[k] === "string" ? d[k].slice(0, LIMITS[k]) : DEFAULT_DETAILS[k];
  if (!(out.occasion in OCCASIONS)) out.occasion = "wedding";   // invitations made before occasions existed are weddings
  if (!(out.altScript in ALT_SCRIPTS)) out.altScript = "";
  if (!(out.opening in OPENINGS)) out.opening = "none";
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(mp3|m4a|aac)$/.test(out.music)) out.music = "";
  out.extras = (Array.isArray(d.extras) ? d.extras : []).slice(0, 8).map((x) => ({
    time: String(x?.time ?? "").slice(0, 24), text: String(x?.text ?? "").slice(0, 120),
  }));
  const keys = Object.keys(SECTIONS);
  out.order = [...new Set((Array.isArray(d.order) ? d.order : []).filter((k) => keys.includes(k)))];
  for (const k of keys) if (!out.order.includes(k)) out.order.push(k);   // sections added later go at the end
  out.hidden = [...new Set((Array.isArray(d.hidden) ? d.hidden : []).filter((k) => keys.includes(k)))];
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
  ensureFonts([s.nameFont, s.bodyFont]);
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
  const alt = ALT_SCRIPTS[d.altScript];
  if (alt.key) ensureFonts([alt.key]);
  const altLine = (text, cls) => (d.altScript && text ? `<p class="c-alt ${cls}"${alt.rtl ? ' dir="rtl"' : ""}${alt.font ? ` style="font-family:${alt.font}"` : ""}>${esc(text)}</p>` : "");
  const names = occ.two
    ? `<h2 class="c-names"><span>${esc(d.name1 || occ.ph1)}</span><span class="amp">&amp;</span><span>${esc(d.name2 || occ.ph2)}</span></h2>`
    : `<h2 class="c-names"><span>${esc(d.name1 || occ.ph1)}</span></h2>${d.name2 ? `<p class="c-sub">${esc(d.name2)}</p>` : ""}`;
  const extras = d.extras.filter((x) => x.text.trim() || x.time.trim());
  const parts = {
    headline: (d.headline ? `<p class="c-head">${esc(d.headline)}</p>` : "") + altLine(d.altHeadline, "alt-head"),
    names: names + altLine(d.altNames, "alt-names"),
    message: (d.message ? `<p class="c-msg">${esc(d.message)}</p>` : "") + altLine(d.altMessage, "alt-msg"),
    divider: orn,
    when: `<p class="c-date">${esc(fmtDate(d.date) || "Pick a date")}</p><p class="c-time">${esc(timeRange(d))}</p>`,
    where: (d.venue ? `<p class="c-venue">${esc(d.venue)}</p>` : "") + (d.address ? `<p class="c-addr">${esc(d.address)}</p>` : ""),
    dress: d.dress ? `<p class="c-dress">Dress code: ${esc(d.dress)}</p>` : "",
    extras: extras.length ? `<div class="c-extras">${extras.map((x) => `<p class="c-x">${x.time.trim() ? `<span class="c-xt">${esc(x.time)}</span>` : ""}<span>${esc(x.text)}</span></p>`).join("")}</div>` : "",
  };
  const content = d.order.filter((k) => !d.hidden.includes(k)).map((k) => parts[k]).join("\n")
    + (guestName ? `<p class="c-for">Specially for ${esc(guestName)}</p>` : "");
  let body;
  if (photo && (p.mode === "left" || p.mode === "right")) {
    body = `<div class="c-side ${p.mode}" style="--pw:${Math.round(p.size * 0.55)}%">${photo}<div class="c-main">${content}</div></div>`;
  } else if (photo && p.mode === "bottom") body = content + photo;
  else body = photo + content;
  return `<div class="card" style="${frameCSS(s)};--r:${s.radius}px"><div class="card-inner${s.line ? " lined" : ""}${bg ? " has-bg" : ""} shape-${s.shape}" style="${innerVars(s)}${veil}">
    ${bg}${cornersHTML(s.corners)}${body}
  </div></div>`;
}

/** Small template swatch with the event's initials. */
export function thumbHTML(style, label, initials) {
  const s = cleanStyle(style), nf = FONTS[s.nameFont];
  ensureFonts([s.nameFont]);
  return `<span class="thumb" style="${frameCSS(s, 0.45)};border-radius:${Math.round(s.radius * 0.5)}px"><span class="thumb-in" style="background:${s.bg};color:${s.accent};font-family:${nf[1]};font-style:${nf[2] || "normal"};border-radius:${Math.round(s.radius * 0.3)}px">${esc(initials)}</span></span>${esc(label)}`;
}