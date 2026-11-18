// Editor: the card's second language. Guests switch between two languages; the host checks each line,
// with built-in wording, their own, or the free MyMemory translator (only when they press Translate).
import { $, toast } from "./sb.js";
import { esc, cleanDetails, LANGS, TR_FIELDS, translated, langSwitchHTML, occasionOf, eventsOf } from "./card.js";

let inv = null, queueSave = () => { }, renderDesign = () => { };
/** ctx: { inv: the invitation being edited, queueSave(), renderDesign() } */
export function setupLanguages(ctx) { ({ inv, queueSave, renderDesign } = ctx); }

/* ---------- second language: guests switch between two languages on the card ---------- */
let pvLang = "";   // which language the preview shows ("" = the main one)
let trMoreOpen = false;   // whether "Names and places" is unfolded
export const curLang = () => (pvLang && pvLang === inv.details.lang2 ? pvLang : inv.details.lang1);
export function fillLangs() {
  const d = inv.details;
  $("lang1").value = d.lang1;
  $("lang2").innerHTML = `<option value="">None</option>` + Object.entries(LANGS).filter(([k]) => k !== d.lang1).map(([k, v]) => `<option value="${k}">${esc(v.name === v.label ? v.label : `${v.name} (${v.label})`)}</option>`).join("");
  $("lang2").value = d.lang2;
  $("trBox").hidden = !d.lang2;
  if (pvLang && pvLang !== d.lang2) pvLang = "";
  renderLangSwitch(); renderTr();
}
export function renderLangSwitch() { $("pvLang").innerHTML = langSwitchHTML(inv.details, curLang()); }
$("pvLang").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lang]"); if (!b) return;
  pvLang = b.dataset.lang === inv.details.lang1 ? "" : b.dataset.lang;
  renderLangSwitch(); renderDesign(); $("pvLang").querySelector(`[data-lang="${b.dataset.lang}"]`)?.focus();
});
// The parts of this card that can be translated, with their current wording.
function trItems() {
  const d = inv.details, occ = occasionOf(d), items = [];
  for (const f of TR_FIELDS) {
    const src = d[f.k]; if (!src?.trim()) continue;
    let { label, auto, optional } = f;
    if (f.k === "name1") label = occ.two ? "First name" : occ.l1;
    if (f.k === "name2") { if (occ.two) label = "Second name"; else { label = occ.l2.replace(/ \(optional\)$/, ""); auto = true; optional = false; } }
    items.push({ id: f.k, label, auto, optional, area: f.area, src, saved: d.tr[f.k] });
  }
  d.extras.forEach((x, i) => { if (x.text.trim()) items.push({ id: "x" + i, label: `Extra line ${i + 1}`, auto: true, src: x.text, saved: x.tr }); });
  eventsOf(d).forEach((e, i) => { if (e.name.trim()) items.push({ id: "ev-" + e.id, label: `Event ${i + 1}`, auto: true, src: e.name, saved: e.tr }); });
  return items;
}
const HOW = { "built-in": "Built-in translation", auto: "Machine translation, please check it", you: "Your wording", stale: "You changed the original since this was translated", none: "" };
export function renderTr() {
  const d = inv.details; if (!d.lang2) { $("trList").innerHTML = ""; return; }
  if ($("trList").contains(document.activeElement) && document.activeElement.dataset.tr) return;   // don't redraw under the cursor
  const L2 = LANGS[d.lang2], items = trItems();
  $("trIntro").textContent = `Standard wording is already in ${L2.name}. Check each line.`;
  const row = (it) => {
    const r = translated(it.src, it.saved, d), val = r.how === "none" ? "" : r.text;
    const ph = it.optional ? `Leave empty to keep "${it.src}"` : `${L2.name} for this line`;
    const field = it.area
      ? `<textarea id="tr-${it.id}" data-tr="${it.id}" lang="${d.lang2}" maxlength="400" rows="3" placeholder="${esc(ph)}">${esc(val)}</textarea>`
      : `<input id="tr-${it.id}" data-tr="${it.id}" lang="${d.lang2}" maxlength="${it.id.startsWith("ev-") ? 120 : it.id[0] === "x" ? 160 : 400}" placeholder="${esc(ph)}" value="${esc(val)}">`;
    const status = r.how === "none" ? (it.optional ? "" : "Not translated yet, so guests will see the original") : HOW[r.how];
    const btn = it.auto && r.how !== "built-in" ? `<button type="button" class="btn sm ghost" data-trgo="${it.id}" aria-describedby="tr-${it.id}">${r.how === "stale" ? "Translate again" : "Translate"}</button>` : "";
    return `<div class="tr-row${r.how === "stale" || (r.how === "none" && !it.optional) ? " needs" : ""}">
      <label for="tr-${it.id}"><span class="tr-label">${esc(it.label)}</span> <span class="tr-src">${esc(it.src)}</span></label>
      ${field}
      ${status || btn ? `<div class="tr-meta"><span class="tr-status" id="trs-${it.id}">${esc(status)}</span>${btn}</div>` : ""}
    </div>`;
  };
  const main = items.filter((it) => !it.optional), extra = items.filter((it) => it.optional);
  const moreOpen = trMoreOpen || extra.some((it) => it.saved?.t);
  $("trList").innerHTML = (main.map(row).join("") || `<p class="hint">Fill in the card first, then its lines appear here.</p>`)
    + (extra.length ? `<details class="tr-more" id="trMore"${moreOpen ? " open" : ""}><summary>Names and places in ${esc(L2.name)} (optional)</summary>
        <p class="hint">Names and places usually stay as they are. Fill these in only if you want them written differently, for example in Chinese characters.</p>${extra.map(row).join("")}</details>` : "");
}
// Save one translation (or clear it when empty, so the built-in or original shows again).
function setTr(id, text, by) {
  const it = trItems().find((x) => x.id === id); if (!it) return;
  const val = text.trim() ? { t: text, src: it.src, by } : undefined;
  if (id.startsWith("ev-")) {
    const events = inv.details.events.map((e) => (e.id === id.slice(3) ? { ...e, tr: val } : e));
    inv.details = cleanDetails({ ...inv.details, events });
  } else if (id[0] === "x") {
    const extras = inv.details.extras.map((x, i) => (i === +id.slice(1) ? { ...x, tr: val } : x));
    inv.details = cleanDetails({ ...inv.details, extras });
  } else {
    const tr = { ...inv.details.tr }; if (val) tr[id] = val; else delete tr[id];
    inv.details = cleanDetails({ ...inv.details, tr });
  }
  if (!pvLang) { pvLang = inv.details.lang2; renderLangSwitch(); }   // show the translated card while translating
  queueSave();
}
$("trList").addEventListener("toggle", (e) => { if (e.target.id === "trMore") trMoreOpen = e.target.open; }, true);
$("trList").addEventListener("input", (e) => { const id = e.target.dataset.tr; if (id) setTr(id, e.target.value, "you"); });
$("trList").addEventListener("focusout", () => setTimeout(() => { if (!$("trList").contains(document.activeElement)) renderTr(); }, 0));
// Machine translation through MyMemory (free, no account). Text is sent to their server only when the host presses Translate.
async function machineTranslate(text) {
  const d = inv.details;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${LANGS[d.lang1].mm}|${LANGS[d.lang2].mm}`;
  const res = await fetch(url);
  const j = await res.json().catch(() => ({}));
  const out = j?.responseData?.translatedText || "";
  if (+j?.responseStatus === 429 || /MYMEMORY WARNING|USED ALL AVAILABLE/i.test(out)) throw new Error("quota");
  if (!res.ok || +j?.responseStatus !== 200 || !out || /^(QUERY LENGTH|INVALID)/i.test(out)) throw new Error("failed");
  const tx = document.createElement("textarea"); tx.innerHTML = out; return tx.value;   // it returns some characters as HTML codes
}
const trError = (err) => toast(err.message === "quota"
  ? "The free translator has reached its limit for today. Try again tomorrow, or type the translation yourself."
  : "Couldn't reach the translator. Check your connection and try again, or type the translation yourself.");
async function translateOne(id) {
  const it = trItems().find((x) => x.id === id); if (!it) return false;
  $("trs-" + id) && ($("trs-" + id).textContent = "Translating…");
  const t = await machineTranslate(it.src);
  setTr(id, t, "auto");
  return true;
}
$("trList").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-trgo]"); if (!b) return;
  b.disabled = true;
  try { await translateOne(b.dataset.trgo); renderTr(); $(`tr-${b.dataset.trgo}`)?.focus(); }
  catch (err) { trError(err); renderTr(); }
});
$("trAll").addEventListener("click", async (e) => {
  const btn = e.currentTarget, d = inv.details;
  // only lines that aren't already translated for their current wording and have no built-in version
  const todo = trItems().filter((it) => it.auto && ["none", "stale"].includes(translated(it.src, it.saved, d).how));
  if (!todo.length) { toast(`Everything is already in ${LANGS[d.lang2].name}.`); return; }
  btn.disabled = true; let done = 0;
  try {
    for (const it of todo) { btn.textContent = `Translating ${done + 1} of ${todo.length}…`; await translateOne(it.id); done++; }
    toast(`Translated ${done} line${done === 1 ? "" : "s"}. Have a read to check they sound right.`);
  } catch (err) { trError(err); }
  finally { btn.disabled = false; btn.textContent = "Translate everything"; renderTr(); }
});
