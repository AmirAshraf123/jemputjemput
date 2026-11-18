// Everything about how an invitation card looks: fonts, templates, photo placement.
// Used by the landing page, the editor and the guest page, so all three always match.
import { BASE_URL as SUPABASE_URL } from "./base-url.js";
import { STICKERS, stickerMask, stickerImage } from "./stickers.js";

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
/* ---------- languages ----------
   A card can have a second language. Guests switch between the two with a button; only one shows at a time. */
export const LANGS = {
  en: { label: "English", name: "English", locale: "en-SG", mm: "en" },
  ms: { label: "Bahasa Melayu", name: "Malay", locale: "ms-MY", mm: "ms" },
  zh: { label: "中文", name: "Chinese", locale: "zh-SG", mm: "zh-CN", font: "'Noto Serif SC'", key: "notoSC" },
  ta: { label: "தமிழ்", name: "Tamil", locale: "ta-SG", mm: "ta", font: "'Noto Serif Tamil'", key: "notoTamil" },
};
/* Ready-made translations of the standard wording, so most cards need no typing or online translator.
   Each row is the same phrase in every language; a match in any language gives the others. */
const PHRASES = [
  // wedding
  { en: "Together with their families", ms: "Bersama keluarga mereka", zh: "携同双方家人", ta: "குடும்பத்தினருடன் இணைந்து" },
  { en: "We would be honoured to have you with us as we begin our life together.", ms: "Kehadiran anda amat kami hargai sempena permulaan hidup baharu kami bersama.", zh: "诚挚邀请您见证我们携手开启人生新篇章。", ta: "எங்கள் புதிய வாழ்க்கையைத் தொடங்கும் இந்த இனிய தருணத்தில் உங்கள் வருகையை அன்புடன் எதிர்பார்க்கிறோம்." },
  // engagement
  { en: "Please join us to celebrate the engagement of", ms: "Dengan sukacitanya kami menjemput anda ke majlis pertunangan", zh: "诚邀您共同庆祝订婚之喜", ta: "நிச்சயதார்த்த விழாவைக் கொண்டாட உங்களை அன்புடன் அழைக்கிறோம்" },
  { en: "Come and share our joy as we take the next step together.", ms: "Marilah berkongsi kegembiraan kami ketika kami melangkah ke fasa seterusnya bersama.", zh: "欢迎与我们分享这份喜悦，一同见证我们迈出新的一步。", ta: "நாங்கள் இணைந்து அடுத்த அடியை எடுத்து வைக்கும் இந்த மகிழ்ச்சியில் பங்கேற்க வாருங்கள்." },
  // birthday
  { en: "You're invited to celebrate", ms: "Anda dijemput untuk meraikan", zh: "诚邀您一同庆祝", ta: "கொண்டாட்டத்திற்கு உங்களை அன்புடன் அழைக்கிறோம்" },
  { en: "Join us for cake, good food and even better company!", ms: "Mari bersama kami menikmati kek, juadah yang lazat dan suasana yang meriah!", zh: "一起来享用蛋糕和美食，共度欢乐时光！", ta: "கேக், சுவையான உணவு, இனிய நட்புடன் கொண்டாட எங்களுடன் இணையுங்கள்!" },
  // baby
  { en: "Please join us to welcome", ms: "Dengan sukacitanya kami menjemput anda meraikan kelahiran", zh: "诚邀您一同迎接", ta: "வரவேற்க எங்களுடன் இணையுங்கள்" },
  { en: "We would love you to celebrate the arrival of our little one with us.", ms: "Kami amat berbesar hati jika anda dapat bersama meraikan kehadiran cahaya mata kami.", zh: "诚邀您与我们一同庆祝小宝贝的到来。", ta: "எங்கள் செல்லக் குழந்தையின் வருகையை எங்களுடன் கொண்டாட அன்புடன் அழைக்கிறோம்." },
  // anniversary
  { en: "Celebrating 25 years together", ms: "Meraikan 25 tahun bersama", zh: "庆祝相伴25周年", ta: "இணைந்த 25 ஆண்டுகளைக் கொண்டாடுகிறோம்" },
  { en: "Please join us as we mark this milestone with family and friends.", ms: "Sila bersama kami meraikan detik bermakna ini bersama keluarga dan sahabat handai.", zh: "诚邀您与亲朋好友一同见证这个重要的时刻。", ta: "குடும்பத்தினர், நண்பர்களுடன் இந்த மைல்கல்லைக் கொண்டாட எங்களுடன் இணையுங்கள்." },
  // open house
  { en: "You're warmly invited to our", ms: "Anda dijemput dengan penuh mesra ke", zh: "诚挚邀请您光临我们的", ta: "எங்கள் நிகழ்விற்கு உங்களை அன்புடன் அழைக்கிறோம்" },
  { en: "Drop by for good food and good company. Bring the whole family!", ms: "Jemputlah datang menikmati juadah dan beramah mesra. Bawalah seisi keluarga!", zh: "欢迎前来品尝美食、欢聚一堂，欢迎携全家同来！", ta: "சுவையான உணவுக்கும் இனிய சந்திப்புக்கும் வாருங்கள். முழு குடும்பத்துடன் வாருங்கள்!" },
  // graduation
  { en: "Please join us to celebrate", ms: "Sila bersama kami meraikan", zh: "诚邀您共同庆祝", ta: "கொண்டாட எங்களுடன் இணையுங்கள்" },
  { en: "Help us celebrate years of hard work and a bright future ahead.", ms: "Mari bersama meraikan hasil usaha bertahun-tahun dan masa depan yang cerah.", zh: "一同庆祝多年的努力付出与光明的未来。", ta: "பல ஆண்டுகால உழைப்பையும் ஒளிமயமான எதிர்காலத்தையும் கொண்டாட எங்களுடன் இணையுங்கள்." },
  // party
  { en: "You're invited to", ms: "Anda dijemput ke", zh: "诚邀您参加", ta: "உங்களை அன்புடன் அழைக்கிறோம்" },
  { en: "We'd love you to join us.", ms: "Kami amat berbesar hati jika anda dapat bersama kami.", zh: "期待您的光临。", ta: "உங்கள் வருகையை எதிர்பார்க்கிறோம்." },
];
const norm = (t) => String(t || "").trim().replace(/\s+/g, " ").replace(/[’‘]/g, "'").toLowerCase();
/** The built-in translation of a phrase, or "" if it isn't one of the standard phrases. */
export function builtInPhrase(text, from, to) {
  const n = norm(text); if (!n || from === to) return "";
  const row = PHRASES.find((r) => norm(r[from]) === n);
  return row?.[to] || "";
}
/** Words the card itself adds, in each language. */
const LABELS = {
  dress: { en: (x) => `Dress code: ${x}`, ms: (x) => `Kod pakaian: ${x}`, zh: (x) => `着装要求：${x}`, ta: (x) => `ஆடை விதிமுறை: ${x}` },
  forGuest: { en: (n) => `Specially for ${n}`, ms: (n) => `Istimewa buat ${n}`, zh: (n) => `特邀：${n}`, ta: (n) => `${n} அவர்களுக்குச் சிறப்பு அழைப்பு` },
  noDate: { en: () => "Pick a date", ms: () => "Pilih tarikh", zh: () => "请选择日期", ta: () => "தேதியைத் தேர்ந்தெடுக்கவும்" },
};
/** Parts of the card that can be translated, in the order the editor lists them. `auto` = can use the Translate button. */
export const TR_FIELDS = [
  { k: "headline", label: "Heading", auto: true, area: false },
  { k: "message", label: "Message", auto: true, area: true },
  { k: "name1", label: "Names", auto: false, optional: true },
  { k: "name2", label: "Second name", auto: false, optional: true },
  { k: "venue", label: "Venue", auto: false, optional: true },
  { k: "address", label: "Address", auto: false, optional: true },
  { k: "dress", label: "Dress code", auto: true, area: false },
];
/** Which text to show for one part in the second language.
    A translation saved for the current wording wins; then a built-in phrase; then an older saved translation; then the original. */
export function translated(src, saved, d) {
  if (saved?.t && saved.src === src) return { text: saved.t, how: saved.by === "auto" ? "auto" : "you" };
  const b = builtInPhrase(src, d.lang1, d.lang2);
  if (b) return { text: b, how: "built-in" };
  if (saved?.t) return { text: saved.t, how: "stale" };
  return { text: src, how: "none" };
}
const loadedFamilies = new Set(["", "Playfair+Display:ital,wght@0,400;0,500;1,500"]);   // already linked by every page
/** Google Fonts stylesheet address for these fonts (used to embed fonts when saving the card as a picture). */
export function fontCSSUrl(keys) {
  const fams = [...new Set(keys.map((k) => GFAMILY[k]).filter(Boolean))];
  return fams.length ? "https://fonts.googleapis.com/css2?" + fams.map((f) => "family=" + f).join("&") + "&display=swap" : "";
}
/** The font keys a card uses: names, text and any second-language font. */
export function cardFontKeys(inv) {
  const s = cleanStyle(inv.style), d = cleanDetails(inv.details);
  return [s.nameFont, s.bodyFont, ...PART_STYLE.map((p) => p.font && s[p.font]).filter(Boolean), ...s.layers.filter((x) => x.type === "text" && x.font).map((x) => x.font), LANGS[d.lang1]?.key, LANGS[d.lang2]?.key, "figtree", "playfair"].filter(Boolean);
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
/* Each part of the card can have its own colour and font. An empty value means "same as the card's text"
   (or the names colour, for the divider and corners). `v` is the CSS variable the card uses. */
export const PART_STYLE = [
  { part: "headline", color: "headColor", font: "headFont", fv: "--hf" },
  { part: "names", color: "accent" },
  { part: "message", color: "msgColor", font: "msgFont", v: "--mc", fv: "--mf" },
  { part: "divider", color: "divColor", v: "--oc", follows: "accent" },
  { part: "when", color: "whenColor", font: "whenFont", v: "--wc", fv: "--wf" },
  { part: "where", color: "whereColor", font: "whereFont", v: "--vc", fv: "--vf" },
  { part: "dress", color: "dressColor", font: "dressFont", v: "--dc", fv: "--df" },
  { part: "extras", color: "extrasColor", font: "extrasFont", v: "--xc", fv: "--xf" },
];
/** The colour a part actually shows in, following the card's text or names colour when it has none of its own. */
export const partColor = (s, key) => s[key] || (key === "divColor" || key === "cornerColor" ? s.accent : s.ink);

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
    // per-part colours and fonts ("" = follow the card)
    // (a key that's present but empty means the person chose "follow the card")
    ...Object.fromEntries([...PART_STYLE.filter((p) => p.v).map((p) => p.color), "cornerColor"].map((k) => [k, k in s ? (HEX.test(s[k]) ? s[k] : "") : (HEX.test(f[k]) ? f[k] : "")])),
    ...Object.fromEntries(PART_STYLE.filter((p) => p.font).map((p) => p.font).map((k) => [k, k in s ? (FONTS[s[k]] ? s[k] : "") : (FONTS[f[k]] ? f[k] : "")])),
    namesFoil: s.namesFoil in FOILS ? s.namesFoil : (f.namesFoil in FOILS ? f.namesFoil : ""),
    // free-design layer: stickers, pictures and text boxes placed anywhere
    layers: cleanLayers("layers" in s ? s.layers : f.layers),
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
  const checks = [["ink", "Text", 4.5], ["headColor", "Heading", 4.5], ["accent", "Names", 3],
  ["msgColor", "Message", 4.5], ["whenColor", "Date and time", 4.5], ["whereColor", "Venue", 4.5], ["dressColor", "Dress code", 4.5], ["extrasColor", "Extra lines", 4.5]];
  for (const [key, label, need] of checks) {
    if (!s[key]) continue;   // follows the text colour, which is already checked
    const r = worst(s[key]);
    if (r < need) issues.push({ key, label, ratio: r, need, fix: fixColor(s[key], grounds, need) });
  }
  if (p?.mode === "background" && p.fade < 55) issues.push({ key: "fade", label: "Photo behind the text", photo: true });
  return issues;
}

/* ---------- free design: stickers, pictures and text boxes placed anywhere on the card ----------
   Positions are the item's centre as a % of the card's width (x) and height (y); widths are a % of the card's width,
   so a design keeps its look on every screen size, card shape and language. */
export const FOILS = {
  "": { label: "None" },
  gold: { label: "Gold foil", css: "linear-gradient(135deg,#8a6a1f 0%,#f6e27a 32%,#b8892b 52%,#fff3b0 72%,#9c7a2a 100%)" },
  rose: { label: "Rose gold foil", css: "linear-gradient(135deg,#9b5a4a 0%,#f4c7b3 32%,#b9766a 52%,#ffe1d4 72%,#a5604f 100%)" },
  silver: { label: "Silver foil", css: "linear-gradient(135deg,#6f7378 0%,#f2f4f6 32%,#9aa0a6 52%,#ffffff 72%,#7d8288 100%)" },
};
export const FILTERS = {
  none: { label: "None", css: "" },
  bw: { label: "Black and white", css: "grayscale(1) contrast(1.05)" },
  warm: { label: "Warm", css: "sepia(.35) saturate(1.25) brightness(1.03)" },
  faded: { label: "Faded", css: "contrast(.82) brightness(1.1) saturate(.7)" },
  duo: { label: "Duotone (card colours)", css: "grayscale(1) contrast(1.1)" },
};
export const MAX_LAYERS = 40;
const num = (v, lo, hi, d) => (Number.isFinite(+v) && v !== "" && v !== null ? Math.min(hi, Math.max(lo, +v)) : d);
export function cleanLayers(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const x of list.slice(0, MAX_LAYERS)) {
    if (!x || typeof x !== "object") continue;
    const base = {
      id: typeof x.id === "string" && /^[a-z0-9]{4,12}$/.test(x.id) ? x.id : Math.random().toString(36).slice(2, 10),
      x: num(x.x, -50, 150, 50), y: num(x.y, -50, 150, 50), w: num(x.w, 2, 200, 30), rot: num(x.rot, -180, 180, 0),
      fx: !!x.fx, fy: !!x.fy, op: num(x.op, 0.05, 1, 1), back: !!x.back, hide: !!x.hide, lock: !!x.lock, shadow: !!x.shadow,
    };
    if (x.type === "sticker" && STICKERS[x.sticker]) {
      out.push({ ...base, type: "sticker", sticker: x.sticker, color: HEX.test(x.color) ? x.color : "", foil: x.foil in FOILS || x.foil === "natural" ? x.foil : "" });
    } else if (x.type === "image" && PHOTO_PATH.test(x.path)) {
      out.push({ ...base, type: "image", path: x.path, ar: num(x.ar, 0.1, 10, 1), filter: x.filter in FILTERS ? x.filter : "none" });
    } else if (x.type === "text" && typeof x.text === "string") {
      out.push({
        ...base, type: "text", text: x.text.slice(0, 200), font: FONTS[x.font] ? x.font : "", size: num(x.size, 2, 30, 7),
        color: HEX.test(x.color) ? x.color : "", foil: x.foil in FOILS ? x.foil : "", ls: num(x.ls, -5, 60, 0), lh: num(x.lh, 80, 220, 120),
        curve: num(x.curve, -100, 100, 0), align: ["left", "center", "right"].includes(x.align) ? x.align : "center", bold: !!x.bold, italic: !!x.italic
      });
    }
  }
  return out;
}
const layerLabel = (x) => (x.type === "sticker" ? STICKERS[x.sticker].label : x.type === "image" ? "Your picture" : `Text: ${x.text.trim().slice(0, 24) || "(empty)"}`);
export { layerLabel };
// curved text: an arc whose bend is set by `curve` (-100 bends down like a frown, 100 like a smile)
function curvedTextSVG(x, fontStack) {
  const W = 1000, fs = (x.size * W) / x.w, theta = (Math.abs(x.curve) / 100) * Math.PI * 0.95, bend = x.curve > 0 ? 1 : -1;
  const R = theta > 0.01 ? W / 2 / Math.sin(theta / 2) : 1e6, sag = theta > 0.01 ? R * (1 - Math.cos(theta / 2)) : 0;
  const H = Math.ceil(sag + fs * 1.5), pad = fs * 1.05;
  const y0 = bend > 0 ? pad : H - fs * 0.35, y1 = bend > 0 ? pad + sag : H - fs * 0.35 - sag;
  // smile: ends high, middle low (text sits on top of a "U"); frown: ends low, middle high
  const d = bend > 0 ? `M0 ${r1(y0)}A${r1(R)} ${r1(R)} 0 0 0 ${W} ${r1(y0)}` : `M0 ${r1(y0)}A${r1(R)} ${r1(R)} 0 0 1 ${W} ${r1(y0)}`;
  const fill = x.foil ? `url(#fl-${x.id})` : "currentColor";
  const grad = x.foil ? `<defs><linearGradient id="fl-${x.id}" x1="0" y1="0" x2="1" y2="1">${FOILS[x.foil].css.match(/#[0-9a-f]{6} \d+%/gi).map((st) => { const [c, o] = st.split(" "); return `<stop offset="${o}" stop-color="${c}"/>`; }).join("")}</linearGradient></defs>` : "";
  void y1;
  return `<svg class="ly-curve" viewBox="0 0 ${W} ${H}" aria-hidden="true">${grad}<path id="cp-${x.id}" d="${d}" fill="none"/><text fill="${fill}" font-size="${r1(fs)}" style="font-family:${esc(fontStack)};font-weight:${x.bold ? 700 : 400};font-style:${x.italic ? "italic" : "normal"};letter-spacing:${x.ls / 100}em" text-anchor="middle"><textPath href="#cp-${x.id}" startOffset="50%">${esc(x.text)}</textPath></text></svg>`;
}
const r1 = (n) => Math.round(n * 10) / 10;
function layerItemHTML(x, s, langFont) {
  const t = `translate(-50%,-50%) rotate(${x.rot}deg)${x.fx || x.fy ? ` scale(${x.fx ? -1 : 1},${x.fy ? -1 : 1})` : ""}`;
  const sh = x.shadow ? "drop-shadow(0 .9cqw 1.2cqw rgba(0,0,0,.35))" : "";
  let inner = "";
  if (x.type === "sticker") {
    const st = STICKERS[x.sticker];
    if (x.foil === "natural") {   // its own colours, with shading
      inner = `<div class="ly-art" style="aspect-ratio:${st.w}/${st.h};background:${stickerImage(x.sticker)} center/contain no-repeat"></div>`;
    } else {                      // one colour or foil, through a mask that keeps the lighter details lighter
      const paint = x.foil ? FOILS[x.foil].css : (x.color || s.accent), m = stickerMask(x.sticker);
      inner = `<div class="ly-art" style="aspect-ratio:${st.w}/${st.h};background:${paint};-webkit-mask:${m} center/contain no-repeat;mask:${m} center/contain no-repeat luminance"></div>`;
    }
  } else if (x.type === "image") {
    const img = `<img src="${esc(photoUrl(x))}" alt="" crossorigin="anonymous" style="aspect-ratio:${(1 / x.ar).toFixed(4)};${FILTERS[x.filter].css ? `filter:${FILTERS[x.filter].css}` : ""}">`;
    inner = x.filter === "duo" ? `<div class="duo" style="--d1:${s.bg};--d2:${s.accent}">${img}</div>` : img;
  } else {
    const stack = x.font ? FONTS[x.font][1] : "var(--bf)", full = langFont && x.font ? stack.replace(/(serif|cursive|sans-serif)$/, langFont + ",$1") : stack;
    const col = x.color || s.ink;
    inner = x.curve
      ? `<div class="ly-text" style="color:${col}">${curvedTextSVG(x, full)}</div>`
      : `<div class="ly-text${x.foil ? " foil" : ""}" style="font-family:${esc(full)};font-size:${x.size}cqw;color:${col};letter-spacing:${x.ls / 100}em;line-height:${x.lh / 100};text-align:${x.align};font-weight:${x.bold ? 700 : 400};font-style:${x.italic ? "italic" : "normal"}${x.foil ? `;--foil:${FOILS[x.foil].css}` : ""}">${esc(x.text)}</div>`;
  }
  return `<div class="ly ly-${x.type}" data-id="${x.id}" style="left:${x.x}%;top:${x.y}%;width:${x.w}%;transform:${t};opacity:${x.op}${sh ? `;filter:${sh}` : ""}">${inner}</div>`;
}
/** The two free-design layers: behind the card's text and in front of it. */
export function layersHTML(s, langFont) {
  const vis = s.layers.filter((x) => !x.hide);
  if (!vis.length) return "";
  const group = (back) => { const items = vis.filter((x) => x.back === back); return items.length ? `<div class="c-layer ${back ? "back" : "front"}" aria-hidden="true">${items.map((x) => layerItemHTML(x, s, langFont)).join("")}</div>` : ""; };
  return group(true) + group(false);
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
function innerVars(s, langFont) {
  const nf = FONTS[s.nameFont], bf = FONTS[s.bodyFont];
  const withLang = (stack) => (langFont ? stack.replace(/(serif|cursive|sans-serif)$/, langFont + ",$1") : stack);
  const parts = PART_STYLE.map((p) => (p.v && s[p.color] ? `;${p.v}:${s[p.color]}` : "") + (p.fv && s[p.font] ? `;${p.fv}:${withLang(FONTS[s[p.font]][1])}` : "")).join("")
    + (s.cornerColor ? `;--cc:${s.cornerColor}` : "");
  return parts.slice(1) + ";" + `--tex:${textureCSS(s)};--hc:${s.headColor};--htt:${s.headCase === "upper" ? "uppercase" : "none"};--hfs:${s.headItalic ? "italic" : "normal"};--hls:${(s.headSpacing / 100).toFixed(2)}em;--cbg:${s.bg};--ink:${s.ink};--acc:${s.accent};--lc:${s.frameA};--nf:${nf[1]};--nfs:${nf[2] || "normal"};--bf:${bf[1]};--ns:${s.nameSize}px;--bs:${s.bodySize}px;--al:${s.align};--ji:${s.align === "left" ? "start" : "center"}`;
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
    filter: p.filter in FILTERS ? p.filter : "none",
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
  lang1: "en", lang2: "", opening: "none", music: "", fall: "none", bloom: "",
  occasion: "wedding", name1: "", name2: "", headline: "Together with their families",
  message: "We would be honoured to have you with us as we begin our life together.",
  date: "", start: "11:00", end: "16:00", rsvpBy: "", venue: "", address: "", dress: "",
};
const LIMITS = { lang1: 4, lang2: 4, fall: 10, bloom: 1, opening: 10, music: 120, occasion: 20, name1: 60, name2: 60, headline: 80, message: 400, date: 10, start: 5, end: 5, rsvpBy: 10, venue: 120, address: 200, dress: 80 };
export function cleanDetails(d) {
  d = d && typeof d === "object" ? d : {};
  const out = {};
  for (const k of Object.keys(DEFAULT_DETAILS)) out[k] = typeof d[k] === "string" ? d[k].slice(0, LIMITS[k]) : DEFAULT_DETAILS[k];
  if (!(out.occasion in OCCASIONS)) out.occasion = "wedding";   // invitations made before occasions existed are weddings
  if (!["none", "petals", "sparkles", "confetti", "hearts"].includes(out.fall)) out.fall = "none";
  out.bloom = out.bloom === "1" || out.bloom === true ? "1" : "";
  if (!(out.lang1 in LANGS)) out.lang1 = "en";
  if (!(out.lang2 in LANGS) || out.lang2 === out.lang1) out.lang2 = "";
  // translations of the second language: { t: text, src: the wording it was made from, by: "you" or "auto" }
  const cleanTr = (x, max) => (x && typeof x === "object" && typeof x.t === "string" && x.t.trim()
    ? { t: x.t.slice(0, max), src: String(x.src ?? "").slice(0, max), by: x.by === "auto" ? "auto" : "you" } : undefined);
  const tr = d.tr && typeof d.tr === "object" ? d.tr : {};
  out.tr = {};
  for (const f of TR_FIELDS) { const v = cleanTr(tr[f.k], 400); if (v) out.tr[f.k] = v; }
  // cards made with the earlier "lines under the English" second language
  if (d.altScript && !d.lang2 && !d.tr) {
    out.lang2 = { same: "ms", zh: "zh", ta: "ta" }[d.altScript] || "";
    for (const [k, old] of [["headline", "altHeadline"], ["message", "altMessage"], ["name1", "altNames"]])
      if (out.lang2 && typeof d[old] === "string" && d[old].trim()) out.tr[k] = { t: d[old].slice(0, 400), src: out[k], by: "you" };
  }
  if (!(out.opening in OPENINGS)) out.opening = "none";
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(mp3|m4a|aac)$/.test(out.music)) out.music = "";
  out.extras = (Array.isArray(d.extras) ? d.extras : []).slice(0, 8).map((x) => ({
    time: String(x?.time ?? "").slice(0, 24), text: String(x?.text ?? "").slice(0, 120),
    ...(cleanTr(x?.tr, 160) ? { tr: cleanTr(x.tr, 160) } : {}),
  }));
  const keys = Object.keys(SECTIONS);
  out.order = [...new Set((Array.isArray(d.order) ? d.order : []).filter((k) => keys.includes(k)))];
  for (const k of keys) if (!out.order.includes(k)) out.order.push(k);   // sections added later go at the end
  out.hidden = [...new Set((Array.isArray(d.hidden) ? d.hidden : []).filter((k) => keys.includes(k)))];
  return out;
}

export function fmtDate(d, lang = "en") {
  if (!d) return "";
  const x = new Date(d + "T00:00:00");
  return isNaN(x) ? "" : x.toLocaleDateString(LANGS[lang]?.locale || "en-SG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
export function fmtTime(t, lang = "en") {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return "";
  const [h, m] = t.split(":").map(Number);
  if (lang !== "en" && LANGS[lang]) return new Date(2000, 0, 1, h, m).toLocaleTimeString(LANGS[lang].locale, { hour: "numeric", minute: "2-digit" });
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
export const timeRange = (d, lang = "en") => [fmtTime(d.start, lang), fmtTime(d.end, lang)].filter(Boolean).join(" – ");

/** The language buttons shown above a card that has two languages. */
export function langSwitchHTML(d, current) {
  d = cleanDetails(d);
  if (!d.lang2) return "";
  return `<div class="lang-switch" role="group" aria-label="Language">${[d.lang1, d.lang2].map((l) =>
    `<button type="button" data-lang="${l}" lang="${l}" aria-pressed="${l === current}">${esc(LANGS[l].label)}</button>`).join("")}</div>`;
}

/* ---------- rendering ---------- */
/** inv = { details, style, photo }. Returns the card's HTML. */
export function cardHTML(inv, guestName, lang) {
  const d = cleanDetails(inv.details), s = cleanStyle(inv.style), p = cleanPhoto(inv.photo), src = photoUrl(p), occ = occasionOf(d);
  ensureFonts([s.nameFont, s.bodyFont, ...PART_STYLE.map((x) => x.font && s[x.font]).filter(Boolean), ...s.layers.filter((x) => x.type === "text" && x.font).map((x) => x.font)]);
  const orn = s.ornament === "none" ? "" : s.ornament === "rule" ? `<div class="c-orn rule"></div>` : `<div class="c-orn" aria-hidden="true">${ORN[s.ornament]}</div>`;
  let bg = "", photo = "", veil = "";
  if (src) {
    const fl = FILTERS[p.filter]?.css ? `;filter:${FILTERS[p.filter].css}` : "";
    const img = `<img src="${esc(src)}" alt="" style="${imgCSS(p)}${fl}">`;
    // duotone: the photo in the card's background and names colours
    const duo = p.filter === "duo";
    if (p.mode === "background") { bg = `<div class="c-bg${duo ? ` duo" style="--d1:${s.bg};--d2:${s.accent}` : ""}">${img}</div><div class="c-veil"></div>`; veil = `;--veil:rgba(${hexRgb(s.bg)},${(p.fade / 100).toFixed(2)})`; }
    else {
      const side = p.mode === "left" || p.mode === "right";
      photo = `<div class="c-photo ${p.shape} at-${p.mode}${p.filter === "duo" ? " duo" : ""}" style="${p.filter === "duo" ? `--d1:${s.bg};--d2:${s.accent};` : ""}${side ? "" : `width:${p.size}%;`}aspect-ratio:100/${p.h}">${img}</div>`;
    }
  }
  // which language to show: the second one only when asked for and set up
  const L = lang && lang === d.lang2 ? d.lang2 : d.lang1, second = L !== d.lang1;
  const T = (k) => (second ? translated(d[k], d.tr[k], d).text : d[k]);
  const fontKeys = [LANGS[L].key].filter(Boolean); if (fontKeys.length) ensureFonts(fontKeys);
  const n1 = T("name1") || occ.ph1, n2 = T("name2") || occ.ph2;
  const names = occ.two
    ? `<h2 class="c-names${s.namesFoil ? " foil" : ""}"${s.namesFoil ? ` style="--foil:${FOILS[s.namesFoil].css}"` : ""}><span>${esc(n1)}</span><span class="amp">&amp;</span><span>${esc(n2)}</span></h2>`
    : `<h2 class="c-names${s.namesFoil ? " foil" : ""}"${s.namesFoil ? ` style="--foil:${FOILS[s.namesFoil].css}"` : ""}><span>${esc(n1)}</span></h2>${d.name2 ? `<p class="c-sub">${esc(T("name2"))}</p>` : ""}`;
  const extras = d.extras.filter((x) => x.text.trim() || x.time.trim());
  const xText = (x) => (second && x.text.trim() ? translated(x.text, x.tr, d).text : x.text);
  const dress = T("dress");
  const parts = {
    headline: d.headline ? `<p class="c-head">${esc(T("headline"))}</p>` : "",
    names,
    message: d.message ? `<p class="c-msg">${esc(T("message"))}</p>` : "",
    divider: orn,
    when: `<p class="c-date">${esc(fmtDate(d.date, L) || LABELS.noDate[L]())}</p><p class="c-time">${esc(timeRange(d, L))}</p>`,
    where: (d.venue ? `<p class="c-venue">${esc(T("venue"))}</p>` : "") + (d.address ? `<p class="c-addr">${esc(T("address"))}</p>` : ""),
    dress: d.dress ? `<p class="c-dress">${esc(LABELS.dress[L](dress))}</p>` : "",
    extras: extras.length ? `<div class="c-extras">${extras.map((x) => `<p class="c-x">${x.time.trim() ? `<span class="c-xt">${esc(x.time)}</span>` : ""}<span>${esc(xText(x))}</span></p>`).join("")}</div>` : "",
  };
  const content = d.order.filter((k) => !d.hidden.includes(k)).map((k) => parts[k]).join("\n")
    + (guestName ? `<p class="c-for">${esc(LABELS.forGuest[L](guestName))}</p>` : "");
  let body;
  if (photo && (p.mode === "left" || p.mode === "right")) {
    body = `<div class="c-side ${p.mode}" style="--pw:${Math.round(p.size * 0.55)}%">${photo}<div class="c-main">${content}</div></div>`;
  } else if (photo && p.mode === "bottom") body = content + photo;
  else body = photo + content;
  // Chinese and Tamil letters aren't in the card's fonts, so add a matching font after them (Latin letters keep the template's font)
  const sf = LANGS[L].font ? `;--nf:${FONTS[s.nameFont][1].replace(/(serif|cursive|sans-serif)$/, LANGS[L].font + ",$1")};--bf:${FONTS[s.bodyFont][1].replace(/(serif|cursive|sans-serif)$/, LANGS[L].font + ",$1")}` : "";
  return `<div class="card" lang="${L}" style="${frameCSS(s)};--r:${s.radius}px"><div class="card-inner${s.line ? " lined" : ""}${bg ? " has-bg" : ""} shape-${s.shape}" style="${innerVars(s, LANGS[L].font)}${veil}${sf}">
    ${bg}${cornersHTML(s.corners)}${body}${layersHTML(s, LANGS[L].font)}
  </div></div>`;
}

/** Small template swatch with the event's initials. */
export function thumbHTML(style, label, initials) {
  const s = cleanStyle(style), nf = FONTS[s.nameFont];
  ensureFonts([s.nameFont]);
  // the swatch is a small picture of the design (its colours are the template's own); the label carries the meaning
  return `<span class="thumb" aria-hidden="true" style="${frameCSS(s, 0.45)};border-radius:${Math.round(s.radius * 0.5)}px"><span class="thumb-in" style="background:${s.bg};border-radius:${Math.round(s.radius * 0.3)}px"><svg class="thumb-svg" width="100%" height="100%" focusable="false"><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="${s.accent}" style="font-family:${esc(nf[1])};font-style:${nf[2] || "normal"}">${esc(initials)}</text></svg></span></span>${esc(label)}`;
}