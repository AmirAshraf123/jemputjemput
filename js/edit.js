// The invitation editor: design, photo, templates and guest list.
import { sb, requireUser, signOut, $, toast, isConfigured, showSetupNotice } from "./sb.js";
import {
  esc, clamp, FONTS, PRESETS, presetById, cleanStyle, cleanPhoto, cleanDetails, imgCSS, SHAPE_DEF,
  cardHTML, thumbHTML, LANGS, TR_FIELDS, translated, langSwitchHTML, photoUrl, watchPhotos, fmtDate, OCCASIONS, occasionOf, inviteLine, initialsFor, ensureFonts,
  CORNERS, TEXTURES, SHAPES, SECTIONS, OPENINGS, readabilityIssues, musicUrl, eventTitle, fontCSSUrl, cardFontKeys,
} from "./card.js";

if (!isConfigured) showSetupNotice();
const user = await requireUser();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const [hashId, hashTab] = location.hash.slice(1).split("/");
const invId = [hashId, new URLSearchParams(location.search).get("id")].find((x) => UUID.test(x || "")) || null;
// Opening a different invitation's link while this page is open: load that one.
window.addEventListener("hashchange", () => {
  const [id, tab] = location.hash.slice(1).split("/");
  if (UUID.test(id) && id !== invId) location.reload();
  else if (inv) showTab(tab === "guests" ? "guests" : "design");
});

let inv = null;            // { id, template, details, style, photo }
let group = null;          // { token, enabled, max } or null when the database update hasn't been run
let guests = [], myTpls = [];
let filter = "all", groupFilter = "", confirmDel = null, confirmTpl = null, confirmPhoto = false;
const canShare = typeof navigator.share === "function";   // the phone's own share sheet (most phones; some desktop browsers)
let saveTimer = null, dirty = false, photoBusy = false, drag = null;

/* ---------- load (called at the bottom, once everything below is defined) ---------- */
async function init() {
  if (!user) return;
  $("signOut").onclick = signOut;
  if (!invId) { showProblem("This page was opened without an invitation. Pick one from your invitations."); return; }
  let { data, error } = await sb.from("invitations")
    .select("id, template, details, style, photo, group_token, group_enabled, group_max_seats").eq("id", invId).maybeSingle();
  if (error && /group_/.test(error.message)) {
    // The group-link database update (supabase/002_group_links.sql) hasn't been run yet. Everything else still works.
    ({ data, error } = await sb.from("invitations").select("id, template, details, style, photo").eq("id", invId).maybeSingle());
  }
  if (error) { showProblem("Couldn't load this invitation: " + error.message); return; }
  if (!data) {
    showProblem("This invitation doesn't exist or belongs to another account.");
  } else {
    const base = presetById(data.template)?.style || PRESETS[0].style;
    inv = { id: data.id, template: data.template, details: cleanDetails(data.details), style: cleanStyle(data.style, base), photo: cleanPhoto(data.photo) };
    group = data && "group_token" in data ? { token: data.group_token, enabled: !!data.group_enabled, max: data.group_max_seats || 2 } : null;
    setupFontSelects(); setupGroup(); setupOccasion(); setupCustomise();
    fillForm(); renderDesign(); showTab(hashTab === "guests" ? "guests" : "design");
    loadTemplates(); loadGuests(); subscribeGuests();
  }
}

function showProblem(msg) {
  $("notFound").hidden = false; $("tabs").hidden = true;
  $("notFound").innerHTML = `${esc(msg)} <a href="app.html">Back to your invitations</a>`;
}

/* ---------- tabs ---------- */
function showTab(name) {
  for (const b of $("tabs").children) b.setAttribute("aria-selected", String(b.dataset.tab === name));
  $("v-design").hidden = name !== "design"; $("v-guests").hidden = name !== "guests";
  history.replaceState(null, "", location.pathname + "#" + inv.id + (name === "guests" ? "/guests" : ""));
  if (name === "guests") { renderGroup(); renderGuests(); } // keeps WhatsApp messages in step with any name or date changes
}
$("tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && inv) showTab(b.dataset.tab); });

/* ---------- saving ---------- */
function queueSave() {
  dirty = true; renderDesign();
  $("saveState").textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const { error } = await sb.from("invitations")
      .update({ template: inv.template, details: inv.details, style: inv.style, photo: inv.photo })
      .eq("id", inv.id);
    dirty = false;
    $("saveState").textContent = error ? "Couldn't save: " + error.message : "All changes saved";
  }, 700);
}
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- design form ---------- */
function setupFontSelects() {
  ensureFonts(Object.keys(FONTS));   // the font menus preview every font
  const opts = Object.entries(FONTS).map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join("");
  for (const sel of [$("sNameFont"), $("sBodyFont")]) {
    sel.innerHTML = opts;
    for (const o of sel.options) { o.style.fontFamily = FONTS[o.value][1]; o.style.fontStyle = FONTS[o.value][2] || "normal"; }
  }
}
const initials = () => initialsFor(inv.details);
function baseStyleOf(tid) {
  if (tid?.startsWith("mine:")) { const t = myTpls.find((x) => x.id === tid.slice(5)); if (t) return t.style; }
  return (presetById(tid) || PRESETS[0]).style;
}
function baseName(tid) {
  if (tid?.startsWith("mine:")) return myTpls.find((x) => x.id === tid.slice(5))?.name || "your template";
  return presetById(tid)?.name || "Songket";
}
function renderTemplates() {
  const ini = initials();
  $("tpls").innerHTML = PRESETS.map((p) => `<button type="button" class="tpl" data-t="${p.id}" aria-pressed="${inv.template === p.id}">${thumbHTML(p.style, p.name, ini)}</button>`).join("");
  $("mineWrap").hidden = !myTpls.length;
  $("mine").innerHTML = myTpls.map((t) => `<div class="tpl" role="button" tabindex="0" data-t="mine:${t.id}" aria-pressed="${inv.template === "mine:" + t.id}">${thumbHTML(t.style, t.name, ini)}
    <button type="button" class="x${confirmTpl === t.id ? " armed" : ""}" data-del="${t.id}" aria-label="Delete ${esc(t.name)}">${confirmTpl === t.id ? "Delete?" : "×"}</button></div>`).join("");
  const changed = JSON.stringify(cleanStyle(baseStyleOf(inv.template))) !== JSON.stringify(inv.style);
  $("tplState").innerHTML = changed ? `<span class="tag">Customised from ${esc(baseName(inv.template))}</span>` : "";
  $("resetStyle").disabled = !changed;
}
function fillStyle() {
  const s = inv.style;
  for (const el of document.querySelectorAll("#styleBox [data-s]")) {
    if (el === document.activeElement && el.type !== "range") continue;
    if (el.type === "checkbox") el.checked = !!s[el.dataset.s]; else el.value = s[el.dataset.s];
  }
  $("oHeadSpacing").textContent = s.headSpacing ? (s.headSpacing / 100).toFixed(2) + " em" : "none";
  $("bg2Wrap").hidden = s.texture !== "gradient";
  $("oNameSize").textContent = s.nameSize + "px"; $("oBodySize").textContent = s.bodySize + "px"; $("oRadius").textContent = s.radius + "px";
}
function fillForm() {
  for (const el of document.querySelectorAll("#designForm [data-k]")) if (el !== document.activeElement) el.value = inv.details[el.dataset.k] ?? "";
  fillOccasion(); fillStyle(); renderTemplates(); fillPhoto(); fillCustomise();
}

/* ---------- extra lines, second language, layout, opening and music ---------- */
const options = (obj) => Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v.label || v)}</option>`).join("");
function setupCustomise() {
  $("sCorners").innerHTML = options(CORNERS); $("sTexture").innerHTML = options(TEXTURES); $("sShape").innerHTML = options(SHAPES);
  $("lang1").innerHTML = options(LANGS); $("opening").innerHTML = options(OPENINGS);
}
function fillCustomise() { renderExtras(); renderSectionList(); fillLangs(); fillMusic(); }

function renderExtras() {
  const list = inv.details.extras;
  $("extrasList").innerHTML = list.map((x, i) => `<div class="extra-row">
      <label class="f extra-time"><span class="vh">Time for line ${i + 1}</span><input id="xTime${i}" data-x="time" data-i="${i}" maxlength="24" placeholder="Time (optional)" value="${esc(x.time)}"></label>
      <label class="f extra-text"><span class="vh">Line ${i + 1}</span><input id="xText${i}" data-x="text" data-i="${i}" maxlength="120" placeholder="e.g. Akad nikah" value="${esc(x.text)}"></label>
      <button type="button" class="btn sm ghost" data-xdel="${i}" aria-label="Remove line ${i + 1}">Remove</button></div>`).join("")
    || `<p class="hint">No extra lines yet.</p>`;
  $("addExtra").disabled = list.length >= 8;
  $("addExtra").textContent = list.length >= 8 ? "Up to 8 lines" : "Add a line";
}
$("extrasList").addEventListener("input", (e) => {
  const t = e.target; if (!t.dataset.x) return;
  const extras = inv.details.extras.map((x) => ({ ...x }));
  extras[+t.dataset.i][t.dataset.x] = t.value;
  inv.details = cleanDetails({ ...inv.details, extras }); queueSave();
});
$("extrasList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-xdel]"); if (!b) return;
  const extras = inv.details.extras.filter((_, i) => i !== +b.dataset.xdel);
  inv.details = cleanDetails({ ...inv.details, extras }); renderExtras(); queueSave();
  $("addExtra").focus();
});
$("addExtra").addEventListener("click", () => {
  inv.details = cleanDetails({ ...inv.details, extras: [...inv.details.extras, { time: "", text: "" }] });
  renderExtras(); queueSave();
  $("xText" + (inv.details.extras.length - 1))?.focus();
});

const GRIP = '<svg viewBox="0 0 20 20" aria-hidden="true"><g fill="currentColor"><circle cx="7" cy="5" r="1.6"/><circle cx="13" cy="5" r="1.6"/><circle cx="7" cy="10" r="1.6"/><circle cx="13" cy="10" r="1.6"/><circle cx="7" cy="15" r="1.6"/><circle cx="13" cy="15" r="1.6"/></g></svg>';
function renderSectionList() {
  const { order, hidden } = inv.details;
  $("secList").innerHTML = order.map((k) => `<li class="sec-item${hidden.includes(k) ? " is-hidden" : ""}" data-k="${k}">
      <button type="button" class="drag-handle" id="drag-${k}" data-k="${k}" aria-label="Move ${esc(SECTIONS[k])}. Drag, or use the up and down arrow keys" aria-describedby="secHint">${GRIP}</button>
      <label class="chk"><input type="checkbox" data-show="${k}" ${hidden.includes(k) ? "" : "checked"}> ${esc(SECTIONS[k])}</label>
    </li>`).join("");
}
$("secList").addEventListener("change", (e) => {
  const k = e.target.dataset.show; if (!k) return;
  const hidden = e.target.checked ? inv.details.hidden.filter((x) => x !== k) : [...inv.details.hidden, k];
  inv.details = cleanDetails({ ...inv.details, hidden }); renderSectionList(); queueSave();
  document.querySelector(`[data-show="${k}"]`)?.focus();
});
function setOrder(order, save) {
  inv.details = cleanDetails({ ...inv.details, order });
  renderDesign();
  if (save) { renderSectionList(); queueSave(); }
}

/* Drag to reorder: works with a mouse or a finger (pointer events, so phones work too).
   The dragged row follows the pointer, the others slide out of the way, and the preview updates as you go. */
let sdrag = null;
$("secList").addEventListener("pointerdown", (e) => {
  const handle = e.target.closest(".drag-handle"); if (!handle || e.button > 0) return;
  e.preventDefault();
  const items = [...$("secList").children];
  const li = handle.closest("li"), from = items.indexOf(li);
  const rects = items.map((x) => x.getBoundingClientRect());
  const step = rects.length > 1 ? rects[1].top - rects[0].top : rects[0].height;
  handle.setPointerCapture(e.pointerId);
  li.classList.add("dragging"); $("secList").classList.add("is-dragging");
  sdrag = { handle, li, items, from, to: from, y: e.clientY, raf: 0, startY: e.clientY, scrollY: window.scrollY, step, order: [...inv.details.order] };
});
$("secList").addEventListener("pointermove", (e) => {
  if (!sdrag) return;
  sdrag.y = e.clientY; dragTo();
  if (!sdrag.raf) sdrag.raf = requestAnimationFrame(edgeScroll);
});
// Keep the page scrolling while the finger rests near the top or bottom.
// On phones the preview is pinned at the top and the tab bar at the bottom, so measure from those.
function edgeScroll() {
  if (!sdrag) return;
  const top = phone.matches ? $("preview").getBoundingClientRect().bottom : 0;
  const bar = phone.matches ? ($("tabs")?.getBoundingClientRect().top || innerHeight) : innerHeight;
  const edge = 60, y = sdrag.y;
  const v = y < top + edge ? -Math.ceil((top + edge - y) / 6) : y > Math.min(bar, innerHeight) - edge ? Math.ceil((y - Math.min(bar, innerHeight) + edge) / 6) : 0;
  if (v) { const before = window.scrollY; window.scrollBy(0, Math.max(-14, Math.min(14, v))); if (window.scrollY !== before) dragTo(); }
  sdrag.raf = requestAnimationFrame(edgeScroll);
}
function dragTo() {
  const dy = sdrag.y - sdrag.startY + (window.scrollY - sdrag.scrollY);
  sdrag.li.style.transform = `translateY(${dy}px)`;
  const to = Math.max(0, Math.min(sdrag.items.length - 1, sdrag.from + Math.round(dy / sdrag.step)));
  if (to === sdrag.to) return;
  sdrag.to = to;
  sdrag.items.forEach((x, i) => {
    if (x === sdrag.li) return;
    const shift = sdrag.from < to ? (i > sdrag.from && i <= to ? -1 : 0) : (i < sdrag.from && i >= to ? 1 : 0);
    x.style.transform = shift ? `translateY(${shift * sdrag.step}px)` : "";
  });
  const order = [...sdrag.order]; const [k] = order.splice(sdrag.from, 1); order.splice(to, 0, k);
  setOrder(order, false);   // live preview while dragging
}
function endSectionDrag(cancel) {
  if (!sdrag) return;
  const { from, to, order: original, li, raf } = sdrag, k = li.dataset.k;
  cancelAnimationFrame(raf); sdrag = null;
  $("secList").classList.remove("is-dragging");
  if (cancel || from === to) { setOrder(original, false); renderSectionList(); }
  else {
    const order = [...original]; order.splice(from, 1); order.splice(to, 0, k);
    setOrder(order, true);
    announce(`${SECTIONS[k]} moved to position ${to + 1} of ${order.length}`);
  }
  $(`drag-${k}`)?.focus({ preventScroll: true });
}
$("secList").addEventListener("pointerup", () => endSectionDrag(false));
$("secList").addEventListener("pointercancel", () => endSectionDrag(true));
// Keyboard: focus a handle and press the up or down arrow.
$("secList").addEventListener("keydown", (e) => {
  const handle = e.target.closest(".drag-handle");
  if (!handle || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
  e.preventDefault();
  const order = [...inv.details.order], k = handle.dataset.k, i = order.indexOf(k), j = i + (e.key === "ArrowUp" ? -1 : 1);
  if (j < 0 || j >= order.length) return;
  order.splice(i, 1); order.splice(j, 0, k);
  setOrder(order, true);
  $(`drag-${k}`)?.focus();
  announce(`${SECTIONS[k]} moved to position ${j + 1} of ${order.length}`);
});
function announce(msg) { $("secLive").textContent = msg; }

/* ---------- second language: guests switch between two languages on the card ---------- */
let pvLang = "";   // which language the preview shows ("" = the main one)
let trMoreOpen = false;   // whether "Names and places" is unfolded
const curLang = () => (pvLang && pvLang === inv.details.lang2 ? pvLang : inv.details.lang1);
function fillLangs() {
  const d = inv.details;
  $("lang1").value = d.lang1;
  $("lang2").innerHTML = `<option value="">None</option>` + Object.entries(LANGS).filter(([k]) => k !== d.lang1).map(([k, v]) => `<option value="${k}">${esc(v.name === v.label ? v.label : `${v.name} (${v.label})`)}</option>`).join("");
  $("lang2").value = d.lang2;
  $("trBox").hidden = !d.lang2;
  if (pvLang && pvLang !== d.lang2) pvLang = "";
  renderLangSwitch(); renderTr();
}
function renderLangSwitch() { $("pvLang").innerHTML = langSwitchHTML(inv.details, curLang()); }
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
  return items;
}
const HOW = { "built-in": "Built-in translation", auto: "Machine translation, please check it", you: "Your wording", stale: "You changed the original since this was translated", none: "" };
function renderTr() {
  const d = inv.details; if (!d.lang2) { $("trList").innerHTML = ""; return; }
  if ($("trList").contains(document.activeElement) && document.activeElement.dataset.tr) return;   // don't redraw under the cursor
  const L2 = LANGS[d.lang2], items = trItems();
  $("trIntro").textContent = `Standard wording, dates and labels are already in ${L2.name}. Check each line below and change anything you like.`;
  const row = (it) => {
    const r = translated(it.src, it.saved, d), val = r.how === "none" ? "" : r.text;
    const ph = it.optional ? `Leave empty to keep "${it.src}"` : `${L2.name} for this line`;
    const field = it.area
      ? `<textarea id="tr-${it.id}" data-tr="${it.id}" lang="${d.lang2}" maxlength="400" rows="3" placeholder="${esc(ph)}">${esc(val)}</textarea>`
      : `<input id="tr-${it.id}" data-tr="${it.id}" lang="${d.lang2}" maxlength="${it.id[0] === "x" ? 160 : 400}" placeholder="${esc(ph)}" value="${esc(val)}">`;
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
  if (id[0] === "x") {
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

/* Readability check: flags text colours that are hard to read on the card, with one-tap fixes. */
function renderReadability() {
  const issues = readabilityIssues(inv.style, inv.photo);
  const box = $("readBox");
  if (!issues.length) { box.className = "readability ok"; box.innerHTML = `<span>All text is easy to read on this card.</span>`; return; }
  box.className = "readability warn";
  box.innerHTML = `<b>Some text may be hard to read</b><ul>${issues.map((x) => `<li><span>${x.photo
    ? "The photo shows through strongly behind the text."
    : `${esc(x.label)} colour is too faint on the card colour (contrast ${x.ratio.toFixed(1)}, needs ${x.need}).`}</span>
      <button type="button" class="btn sm" data-fix="${x.key}">${x.photo ? "Fade the photo more" : `Fix ${esc(x.label.toLowerCase())} colour`}</button></li>`).join("")}</ul>
      ${issues.length > 1 ? `<button type="button" class="btn sm ghost" data-fix="all">Fix all</button>` : ""}`;
}
$("readBox").addEventListener("click", (e) => {
  const b = e.target.closest("[data-fix]"); if (!b) return;
  const issues = readabilityIssues(inv.style, inv.photo).filter((x) => b.dataset.fix === "all" || x.key === b.dataset.fix);
  for (const x of issues) {
    if (x.photo) inv.photo = cleanPhoto({ ...inv.photo, fade: 70 });
    else inv.style = cleanStyle({ ...inv.style, [x.key]: x.fix }, inv.style);
  }
  fillStyle(); fillPhoto(); renderTemplates(); queueSave(); toast("Colours adjusted so the text is easier to read");
});

/* Background music: stored next to the photos; guests press play (phones never play sound by themselves). */
function fillMusic() {
  const has = !!inv.details.music;
  $("musicNone").hidden = has; $("musicSet").hidden = !has;
  if (has && $("musicPreview").dataset.src !== inv.details.music) { $("musicPreview").src = musicUrl(inv.details.music); $("musicPreview").dataset.src = inv.details.music; }
}
$("musicFile").addEventListener("change", async (e) => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const type = file.type || { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac" }[ext];
  if (!["mp3", "m4a", "aac"].includes(ext) || !type) { toast("Please choose an MP3 or M4A file."); return; }
  if (file.size > 10 * 1024 * 1024) { toast("That file is over 10 MB. Try a shorter clip or a smaller MP3."); return; }
  $("musicNote").textContent = "Uploading…";
  const path = `${user.id}/${inv.id}/music-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from("photos").upload(path, file, { contentType: type, cacheControl: "31536000", upsert: false });
  $("musicNote").textContent = "MP3 or M4A, up to 10 MB. Guests tap a play button to start it. Only use music you have the right to share.";
  if (error) {
    toast(/mime|type/i.test(error.message) ? "Music needs a one-time update: run supabase/004_music.sql in Supabase, then try again." : "Upload failed: " + error.message);
    return;
  }
  const old = inv.details.music;
  inv.details = cleanDetails({ ...inv.details, music: path }); fillMusic(); queueSave(); toast("Music added");
  if (old) sb.storage.from("photos").remove([old]);
});
$("removeMusic").addEventListener("click", () => {
  const old = inv.details.music;
  inv.details = cleanDetails({ ...inv.details, music: "" }); $("musicPreview").removeAttribute("src"); delete $("musicPreview").dataset.src;
  fillMusic(); queueSave(); toast("Music removed");
  if (old) sb.storage.from("photos").remove([old]);
});

/* ---------- occasion: changes the name fields, default wording and suggested template ---------- */
function setupOccasion() {
  $("occasion").innerHTML = Object.entries(OCCASIONS).map(([k, o]) => `<option value="${k}">${esc(o.label)}</option>`).join("");
}
function fillOccasion() {
  const occ = occasionOf(inv.details);
  $("occasion").value = inv.details.occasion;
  $("namesLegend").textContent = occ.legend;
  $("l1").textContent = occ.l1; $("l2").textContent = occ.l2;
  $("name1").placeholder = occ.two ? "e.g. Hakim" : occ.ph1;
  $("name2").placeholder = occ.two ? "e.g. Nadia" : (occ.ex2 || "");
  renderSideControls();
}

/* ---------- guest sides (weddings, engagements) or groups (everything else) ---------- */
const SIDE_LABEL = { Groom: "Groom's side", Bride: "Bride's side", Both: "Both" };
const usesSides = () => !!occasionOf(inv.details).sides;
const sideText = (side) => (usesSides() ? SIDE_LABEL[side] || side : side) || "";
function renderSideControls() {
  const sides = usesSides();
  $("sideLabel").textContent = sides ? "Side" : "Group (optional)";
  $("gSide").hidden = !sides; $("gGroup").hidden = sides;
  $("sideHead").textContent = sides ? "Side" : "Group";
  const used = [...new Set(guests.map((g) => g.side).filter((x) => x && !(x in SIDE_LABEL)))];
  $("groupSuggest").innerHTML = [...new Set([...used, "Family", "Friends", "Work", "Neighbours", "School"])]
    .map((x) => `<option value="${esc(x)}"></option>`).join("");
}
const chosenSide = () => (usesSides() ? $("gSide").value : $("gGroup").value.trim().slice(0, 40));
/** Adds guests. Before the guest-groups database update (supabase/003_guest_groups.sql), only Groom/Bride/Both
 *  are accepted, so on that error the guests are saved without their group and the host is told how to fix it. */
async function insertGuests(rows) {
  let res = await sb.from("guests").insert(rows).select("*");
  if (res.error && /guests_side_check|check constraint/i.test(res.error.message)) {
    res = await sb.from("guests").insert(rows.map((r) => ({ ...r, side: "Both" }))).select("*");
    res.withoutGroup = !res.error;
  }
  return res;
}
const NEEDS_UPDATE = " (without the group: to use groups, run supabase/003_guest_groups.sql in Supabase once)";
function addedToast(names, withoutGroup) {
  toast((names.length === 1 ? `Added ${names[0]}` : `Added ${names.length} guests`) + (withoutGroup ? NEEDS_UPDATE : ""));
}
$("occasion").addEventListener("change", (e) => {
  const prev = occasionOf(inv.details), next = OCCASIONS[e.target.value];
  if (!next) return;
  const d = { ...inv.details, occasion: e.target.value };
  // Swap in the new occasion's wording, but never overwrite words the user typed themselves.
  if (!d.headline.trim() || d.headline === prev.headline) d.headline = next.headline;
  if (!d.message.trim() || d.message === prev.message) d.message = next.message;
  inv.details = cleanDetails(d);
  // Likewise, switch to the occasion's template only if the old occasion's template was still untouched.
  const untouched = inv.template === prev.template && JSON.stringify(cleanStyle(baseStyleOf(inv.template))) === JSON.stringify(inv.style);
  if (untouched && presetById(next.template)) { inv.template = next.template; inv.style = cleanStyle(presetById(next.template).style); }
  fillForm(); renderGuests(); queueSave();
  toast(`Set up for ${next.label.toLowerCase()}`);
});
function renderDesign() { $("designCard").innerHTML = cardHTML(inv, null, curLang()); fitPreview(); renderReadability(); renderTr(); }

/* ---------- phone preview: pinned, scaled to fit, can be hidden or opened full size ---------- */
const phone = matchMedia("(max-width: 880px)");
function fitPreview() {
  const scale = $("pvScale"), card = $("designCard").firstElementChild;
  if (!phone.matches || !card || $("preview").classList.contains("collapsed")) { scale.style.transform = ""; return; }
  const frame = $("pvFrame");
  const s = Math.min(1, frame.clientHeight / card.offsetHeight, frame.clientWidth / scale.offsetWidth);
  scale.style.transform = `scale(${s.toFixed(3)})`;
}
new ResizeObserver(() => fitPreview()).observe($("designCard"));   // fonts and photos change the card's height
phone.addEventListener("change", fitPreview);
window.addEventListener("resize", fitPreview);
function setCollapsed(c) {
  $("preview").classList.toggle("collapsed", c);
  $("pvToggle").textContent = c ? "Show preview" : "Hide preview";
  $("pvToggle").setAttribute("aria-expanded", String(!c));
  try { localStorage.setItem("jemput.previewHidden", c ? "1" : ""); } catch { }
  fitPreview();
}
$("pvToggle").addEventListener("click", () => setCollapsed(!$("preview").classList.contains("collapsed")));
try { if (localStorage.getItem("jemput.previewHidden")) setCollapsed(true); } catch { }
let pvReturnFocus = null;
function openFull() {
  pvReturnFocus = document.activeElement;
  $("pvFullCard").innerHTML = cardHTML(inv, null, curLang());
  $("pvFullView").hidden = false; document.body.style.overflow = "hidden";
  $("pvClose").focus();
}
function closeFull() {
  $("pvFullView").hidden = true; document.body.style.overflow = "";
  $("pvFullCard").innerHTML = "";
  pvReturnFocus?.focus?.();
}
/* Save the card as a picture: 1080px wide, ready for Instagram, Status or printing.
   On phones that can share files, it opens the share sheet (Save Image, Instagram, WhatsApp…); otherwise it downloads. */
const IMAGE_LIB = "https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm";
// The picture is drawn without the page's stylesheets, so the card's fonts are embedded directly.
// Only font files covering characters on the card are fetched (Chinese fonts are split into many files).
async function embeddedFontCSS(text) {
  const url = fontCSSUrl(cardFontKeys(inv)); if (!url) return "";
  const css = await (await fetch(url)).text();
  const used = new Set([...text].map((ch) => ch.codePointAt(0)));
  const covers = (range) => range.split(",").some((r) => {
    const [a, b] = r.trim().replace(/^U\+/i, "").split("-").map((h) => parseInt(h.replace(/\?/g, "0"), 16));
    const hi = b ?? (r.includes("?") ? parseInt(r.trim().replace(/^U\+/i, "").replace(/\?/g, "F"), 16) : a);
    for (const cp of used) if (cp >= a && cp <= hi) return true;
    return false;
  });
  const blocks = css.match(/@font-face\s*{[^}]*}/g) || [];
  const keep = blocks.filter((blk) => { const m = blk.match(/unicode-range:\s*([^;]+);/); return !m || covers(m[1]); });
  const toData = async (u) => { const blob = await (await fetch(u)).blob(); return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); };
  const out = [];
  for (const blk of keep) {
    const m = blk.match(/url\(([^)]+)\)/); if (!m) continue;
    out.push(blk.replace(m[0], `url(${await toData(m[1].replace(/["']/g, ""))})`));
  }
  return out.join("\n");
}
async function saveImage(btn) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = "Preparing…";
  const host = document.createElement("div");
  host.className = "export-host";
  try {
    const { toBlob } = await import(IMAGE_LIB);
    host.innerHTML = cardHTML(inv, null, curLang());
    document.body.append(host);
    await document.fonts.ready;
    await Promise.all([...host.querySelectorAll("img")].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
    const node = host.firstElementChild;
    const fontEmbedCSS = await embeddedFontCSS(host.textContent + "&");
    const blob = await toBlob(node, { pixelRatio: 1080 / node.offsetWidth, cacheBust: true, fontEmbedCSS });
    if (!blob) throw new Error("empty image");
    const name = (eventTitle(inv.details).replace(/[^\w\s-]+/g, "").trim().replace(/\s+/g, "-") || "invitation") + ".png";
    const file = new File([blob], name, { type: "image/png" });
    if (phone.matches && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: eventTitle(inv.details) }).catch(() => { });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast("Image saved to your downloads");
    }
  } catch (err) {
    console.error(err);
    toast("Couldn't create the image. Check your connection and try again, or take a screenshot of the full-size preview.");
  } finally {
    host.remove(); btn.disabled = false; btn.textContent = label;
  }
}
$("pvDownload").addEventListener("click", (e) => saveImage(e.currentTarget));
$("pvFullDownload").addEventListener("click", (e) => saveImage(e.currentTarget));
$("pvFull").addEventListener("click", openFull);
$("pvClose").addEventListener("click", closeFull);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("pvFullView").hidden) closeFull(); });
/* ---------- collapsible sections: everything open on wide screens; on phones only the essentials ---------- */
function setSection(fs, open) {
  fs.querySelector(".sec-body").hidden = !open;
  fs.querySelector(".sec-toggle").setAttribute("aria-expanded", String(open));
  fs.classList.toggle("closed", !open);
}
for (const fs of document.querySelectorAll("#designForm fieldset")) {
  setSection(fs, !phone.matches || !!fs.dataset.openPhone);
  fs.querySelector(".sec-toggle").addEventListener("click", () => setSection(fs, fs.classList.contains("closed")));
}
// Show the save status next to the preview too, since the header scrolls away on phones.
new MutationObserver(() => { $("pvSave").textContent = $("saveState").textContent; })
  .observe($("saveState"), { childList: true, characterData: true, subtree: true });

$("designForm").addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.k) {
    inv.details = cleanDetails({ ...inv.details, [t.dataset.k]: t.value });
    if (t.dataset.k === "name1" || t.dataset.k === "name2") renderTemplates();
    if (t.dataset.k === "lang1" || t.dataset.k === "lang2") fillLangs();
    queueSave(); return;
  }
  if (t.dataset.s) {
    const v = t.type === "checkbox" ? t.checked : t.type === "range" ? +t.value : t.value;
    inv.style = cleanStyle({ ...inv.style, [t.dataset.s]: v }, inv.style);
    fillStyle(); renderTemplates(); queueSave();
  }
});

/* ---------- templates ---------- */
function chooseTemplate(tid) { inv.template = tid; inv.style = cleanStyle(baseStyleOf(tid)); confirmTpl = null; fillStyle(); renderTemplates(); queueSave(); }
$("tpls").addEventListener("click", (e) => { const b = e.target.closest(".tpl"); if (b) chooseTemplate(b.dataset.t); });
$("mine").addEventListener("click", async (e) => {
  const x = e.target.closest(".x");
  if (x) {
    const id = x.dataset.del;
    if (confirmTpl !== id) { confirmTpl = id; renderTemplates(); return; }
    confirmTpl = null;
    const { error } = await sb.from("templates").delete().eq("id", id);
    if (error) { toast("Couldn't delete: " + error.message); return; }
    myTpls = myTpls.filter((t) => t.id !== id); renderTemplates(); toast("Template deleted");
    return;
  }
  const b = e.target.closest(".tpl"); if (b) chooseTemplate(b.dataset.t);
});
$("mine").addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("tpl")) { e.preventDefault(); chooseTemplate(e.target.dataset.t); }
});
$("resetStyle").addEventListener("click", () => chooseTemplate(inv.template));
async function loadTemplates() {
  const { data } = await sb.from("templates").select("id, name, style").order("created_at");
  myTpls = (data || []).map((t) => ({ id: t.id, name: String(t.name).slice(0, 40), style: cleanStyle(t.style) }));
  renderTemplates();
}
$("saveTpl").addEventListener("click", async () => {
  const name = $("tplName").value.trim();
  if (!name) { $("tplName").focus(); toast("Give your template a name first"); return; }
  const { data, error } = await sb.from("templates").insert({ name, style: inv.style }).select("id").single();
  if (error) { toast("Couldn't save: " + error.message); return; }
  myTpls.push({ id: data.id, name, style: { ...inv.style } });
  inv.template = "mine:" + data.id; $("tplName").value = "";
  renderTemplates(); queueSave(); toast(`Saved "${name}"`);
});

/* ---------- photo ---------- */
watchPhotos((ar) => {
  if (inv?.photo && Math.abs(inv.photo.ar - ar) > 0.01 && !drag) { inv.photo.ar = ar; queueSave(); }
});
function fillPhoto() {
  const p = inv.photo, src = photoUrl(p);
  $("phPrev").innerHTML = src ? `<img class="ph" src="${esc(src)}" alt="Current photo">` : `<span class="ph-empty" aria-hidden="true">＋</span>`;
  $("photoBtn").textContent = src ? "Replace photo" : "Choose a photo";
  $("photoBtn").hidden = photoBusy;
  $("photoOpts").hidden = !src;
  if (p) {
    for (const el of $("photoOpts").querySelectorAll("[data-p]")) if (!(el === document.activeElement && el.type !== "range")) el.value = p[el.dataset.p];
    $("oSize").textContent = p.size + "%"; $("oH").textContent = p.h + "%";
    $("oPosX").textContent = p.dx; $("oPosY").textContent = p.dy; $("oZoom").textContent = p.zoom + "%"; $("oFade").textContent = p.fade + "%";
    const framed = p.mode !== "background";
    $("pShapeWrap").hidden = !framed; $("pSizeRow").hidden = !framed; $("matchFrame").hidden = !framed; $("pFadeWrap").hidden = framed;
  }
  $("removePhoto").textContent = confirmPhoto ? "Confirm remove" : "Remove photo";
  $("removePhoto").className = "btn sm " + (confirmPhoto ? "danger" : "ghost");
  if (!photoBusy) $("photoNote").textContent = "Or drag a photo here. JPG, PNG or WebP.";
}
$("photoOpts").addEventListener("input", (e) => {
  const k = e.target.dataset.p; if (!k || !inv.photo) return;
  const v = e.target.type === "range" ? +e.target.value : e.target.value;
  const extra = k === "shape" ? { size: SHAPE_DEF[v]?.size, h: SHAPE_DEF[v]?.h } : {};
  inv.photo = cleanPhoto({ ...inv.photo, [k]: v, ...extra }); fillPhoto(); queueSave();
});

// Big photos are resized before upload so invitations load fast on phones.
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("decode")); img.src = url; });
    const ar = img.naturalWidth / img.naturalHeight;
    if (file.size < 2.5e6 && file.type !== "image/gif") return { blob: file, type: file.type, ar };
    const k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86));
    if (!blob) throw new Error("encode");
    return { blob, type: "image/jpeg", ar };
  } finally { URL.revokeObjectURL(url); }
}
async function handlePhoto(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { toast("Please choose a JPG, PNG or WebP photo. iPhone HEIC photos need converting first."); return; }
  photoBusy = true; $("photoNote").textContent = "Uploading…"; fillPhoto();
  const old = inv.photo;
  try {
    const { blob, type, ar } = await shrink(file);
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[type];
    const path = `${user.id}/${inv.id}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
    if (error) throw error;
    const keep = old || { mode: "top", shape: "arch", fade: 60 };
    inv.photo = cleanPhoto({ ...keep, path, ar, dx: 0, dy: 0, zoom: 100 });
    photoBusy = false; fillPhoto(); queueSave(); toast("Photo added");
    if (old?.path) sb.storage.from("photos").remove([old.path]);
  } catch (err) {
    photoBusy = false; fillPhoto();
    toast(err?.message === "decode" ? "Couldn't read that image. Try a JPG or PNG." : "Upload failed: " + (err?.message || "unknown error"));
  }
}
$("photoFile").addEventListener("change", (e) => { handlePhoto(e.target.files[0]); e.target.value = ""; });
const drop = $("drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); handlePhoto(e.dataTransfer.files[0]); });

$("matchFrame").addEventListener("click", () => {
  const p = inv.photo; if (!p) return;
  inv.photo = cleanPhoto({ ...p, h: Math.round(100 / p.ar), zoom: 100, dx: 0, dy: 0 }); fillPhoto(); queueSave();
  if (100 / p.ar > 200 || 100 / p.ar < 40) toast("The photo is a very unusual shape, so a little of it is trimmed.");
});
$("fitPhoto").addEventListener("click", () => {
  const p = inv.photo; if (!p) return;
  const box = $("designCard").querySelector(p.mode === "background" ? ".c-bg" : ".c-photo"); if (!box) return;
  const W = box.clientWidth, H = box.clientHeight;
  const cover = Math.max(W, H * p.ar), contain = Math.min(W, H * p.ar);
  inv.photo = cleanPhoto({ ...p, dx: 0, dy: 0, zoom: Math.max(20, Math.floor((contain / cover) * 100)) }); fillPhoto(); queueSave();
});
$("recenter").addEventListener("click", () => { if (!inv.photo) return; inv.photo = cleanPhoto({ ...inv.photo, dx: 0, dy: 0, zoom: 100 }); fillPhoto(); queueSave(); });
$("removePhoto").addEventListener("click", () => {
  if (!confirmPhoto) { confirmPhoto = true; fillPhoto(); return; }
  confirmPhoto = false; const old = inv.photo; inv.photo = null; fillPhoto(); queueSave();
  if (old?.path) sb.storage.from("photos").remove([old.path]);
});

// Drag the photo in the preview to move it.
$("designCard").addEventListener("pointerdown", (e) => {
  const p = inv?.photo; if (!p) return;
  const box = e.target.closest(p.mode === "background" ? ".card-inner.has-bg" : ".c-photo"); if (!box) return;
  const img = box.querySelector(".c-photo img,.c-bg img"); if (!img) return;
  e.preventDefault(); box.setPointerCapture(e.pointerId); box.classList.add("dragging");
  const r = img.parentElement.getBoundingClientRect();
  drag = { box, img, x: e.clientX, y: e.clientY, w: r.width, h: r.height, sx: p.dx, sy: p.dy };
});
$("designCard").addEventListener("pointermove", (e) => {
  if (!drag) return; const p = inv.photo;
  p.dx = Math.round(clamp(drag.sx + ((e.clientX - drag.x) / drag.w) * 100, -100, 100, 0));
  p.dy = Math.round(clamp(drag.sy + ((e.clientY - drag.y) / drag.h) * 100, -100, 100, 0));
  drag.img.style.cssText = imgCSS(p);
  $("pPosX").value = p.dx; $("pPosY").value = p.dy; $("oPosX").textContent = p.dx; $("oPosY").textContent = p.dy;
});
function endDrag() { if (!drag) return; drag.box.classList.remove("dragging"); drag = null; queueSave(); }
$("designCard").addEventListener("pointerup", endDrag);
$("designCard").addEventListener("pointercancel", endDrag);

/* ---------- group link ---------- */
const groupLink = () => new URL("invite.html", location.href).href + "#g/" + group.token;
function groupText() {
  const d = inv.details;
  const when = fmtDate(d.date), by = fmtDate(d.rsvpBy);
  return `${inviteLine(d)}${when ? " on " + when : ""}! Tap the link to see the invitation and reply${by ? " by " + by : ""}. One reply per household, please: ${groupLink()}`;
}
function setupGroup() {
  $("grpMax").innerHTML = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1} ${i ? "people" : "person"}</option>`).join("");
  renderGroup();
}
function renderGroup() {
  if (!group) { $("grpSetup").hidden = false; $("grpOn").disabled = true; $("grpOff").hidden = true; $("grpBody").hidden = true; return; }
  $("grpOn").checked = group.enabled;
  $("grpBody").hidden = !group.enabled; $("grpOff").hidden = group.enabled;
  $("grpMax").value = String(group.max);
  $("grpLink").value = groupLink();
  $("grpWa").href = "https://wa.me/?text=" + encodeURIComponent(groupText());
  $("grpPreview").href = groupLink() + "/preview";
  $("grpNew").textContent = confirmNewLink ? "Old link will stop working. Confirm" : "Make a new link";
  $("grpNew").className = "btn sm " + (confirmNewLink ? "danger" : "ghost");
}
let confirmNewLink = false;
async function saveGroup(fields, okMsg) {
  const { error } = await sb.from("invitations").update(fields).eq("id", inv.id);
  if (error) { toast("Couldn't save: " + error.message); return false; }
  if (okMsg) toast(okMsg);
  return true;
}
$("grpOn").addEventListener("change", async (e) => {
  const on = e.target.checked;
  if (await saveGroup({ group_enabled: on }, on ? "Group link is on" : "Group link is off. It won't open for anyone now")) group.enabled = on;
  renderGroup();
});
$("grpMax").addEventListener("change", async (e) => {
  const max = Math.round(clamp(e.target.value, 1, 20, 2));
  if (await saveGroup({ group_max_seats: max }, "Saved")) group.max = max;
  renderGroup();
});
$("grpCopy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(groupText()); toast("Message with the group link copied"); }
  catch { $("grpLink").select(); toast("Couldn't copy automatically. The link is selected, so copy it from there."); }
});
$("grpLink").addEventListener("focus", (e) => e.target.select());
$("grpNew").addEventListener("click", async () => {
  if (!confirmNewLink) { confirmNewLink = true; renderGroup(); return; }
  confirmNewLink = false;
  const token = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (await saveGroup({ group_token: token }, "New link made. The old one no longer works")) group.token = token;
  renderGroup();
});

/* ---------- guests ---------- */
const guestLink = (g) => new URL("invite.html", location.href).href + "#" + g.token;
function waNumber(p) { let d = String(p || "").replace(/\D/g, ""); if (d.length === 8) d = "65" + d; return d; }
function inviteText(g) {
  const d = inv.details;
  const when = fmtDate(d.date), by = fmtDate(d.rsvpBy);
  return `Hi ${g.name}! ${inviteLine(d)}${when ? " on " + when : ""}. Here's your invitation${by ? ", please reply by " + by : ""}: ${guestLink(g)}`;
}
async function loadGuests() {
  const { data, error } = await sb.from("guests").select("*").eq("invitation_id", inv.id).order("created_at");
  if (error) { toast("Couldn't load guests: " + error.message); return; }
  guests = data; renderSideControls(); renderGuests();
}
function subscribeGuests() {
  sb.channel("guests-" + inv.id)
    .on("postgres_changes", { event: "*", schema: "public", table: "guests", filter: `invitation_id=eq.${inv.id}` }, () => loadGuests())
    .subscribe((status) => {
      const on = status === "SUBSCRIBED";
      $("live").className = "live" + (on ? " on" : "");
      $("live").lastElementChild.textContent = on ? "Live: replies appear as they arrive" : "Not live. Refresh to see new replies";
    });
}
function renderStats() {
  const sum = (arr, f) => arr.reduce((a, g) => a + f(g), 0);
  const seats = sum(guests, (g) => g.seats), coming = sum(guests.filter((g) => g.status === "yes"), (g) => g.coming);
  const waiting = guests.filter((g) => g.status === "pending").length, declined = guests.filter((g) => g.status === "no").length;
  // On phones the two totals become one line above three tiles (see .stats-line in base.css).
  $("stats").innerHTML = `<p class="stats-line">${guests.length} ${guests.length === 1 ? "invitation" : "invitations"} · ${seats} seats offered</p>` + [
    ["total", guests.length, "invitations"], ["total", seats, "seats offered"], ["yes", coming, "people coming"],
    ["wait", waiting, "still to reply"], ["no", declined, "can't make it"],
  ].map(([c, n, l]) => `<div class="stat ${c}"><b>${n}</b><span>${l}</span></div>`).join("");
}
function renderGuests() {
  renderStats();
  const dups = guests.filter((g) => g.dup_reason);
  $("dupChip").hidden = !dups.length;
  $("dupChip").textContent = `Possible duplicates (${dups.length})`;
  if (filter === "dup" && !dups.length) filter = "all";
  const groups = [...new Set(guests.map((g) => g.side).filter(Boolean))];
  $("groupFilterWrap").hidden = groups.length < 2;
  if (groupFilter && !groups.includes(groupFilter)) groupFilter = "";
  $("groupFilterLabel").textContent = usesSides() ? "Show side" : "Show group";
  $("groupFilter").innerHTML = `<option value="">${usesSides() ? "All sides" : "All groups"}</option>` +
    groups.map((x) => `<option value="${esc(x)}" ${x === groupFilter ? "selected" : ""}>${esc(sideText(x))}</option>`).join("");
  const list = guests.filter((g) => (filter === "all" || (filter === "dup" ? g.dup_reason : g.status === filter)) && (!groupFilter || g.side === groupFilter));
  for (const c of $("filters").querySelectorAll(".chip")) c.setAttribute("aria-pressed", String(c.dataset.f === filter));
  if (!list.length) {
    $("gBody").innerHTML = `<tr><td colspan="6" class="empty">${guests.length ? "No guests match this filter." : "No guests yet. Add the first household above."}</td></tr>`;
    return;
  }
  const label = { yes: "Coming", no: "Can't make it", pending: "Waiting" };
  $("gBody").innerHTML = list.map((g) => {
    const wa = waNumber(g.phone);
    return `<tr>
      <td class="g-name"><b>${esc(g.name)}</b>${g.source === "group" ? ` <span class="tag">Group link</span>` : ""}${g.phone ? `<div class="sub">${esc(g.phone)}</div>` : ""}
        ${g.dup_reason ? `<div class="dup"><span>Possible duplicate: ${esc(g.dup_reason)}</span> <button class="linkbtn" data-act="notdup" data-id="${g.id}">Not a duplicate</button></div>` : ""}</td>
      <td class="g-side${g.side ? "" : " is-empty"}" data-label="${usesSides() ? "Side" : "Group"}">${esc(sideText(g.side)) || "—"}</td>
      <td class="num g-seats" data-label="Seats">${g.status === "yes" ? `${g.coming} of ${g.seats}` : g.seats}</td>
      <td class="g-reply"><span class="pill ${esc(g.status)}">${label[g.status] || "Waiting"}</span></td>
      <td class="g-notes">${g.dietary ? `<div>${esc(g.dietary)}</div>` : ""}${g.note ? `<div class="sub">“${esc(g.note)}”</div>` : ""}</td>
      <td class="g-acts"><div class="acts">
        ${wa ? `<a class="btn sm" href="https://wa.me/${wa}?text=${encodeURIComponent(inviteText(g))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        ${canShare ? `<button class="btn sm ghost" data-act="share" data-id="${g.id}">Share…</button>` : ""}
        <button class="btn sm ghost" data-act="copy" data-id="${g.id}">Copy message</button>
        <a class="btn sm ghost" href="${esc(guestLink(g))}/preview" target="_blank" rel="noopener">Preview</a>
        <button class="btn sm ${confirmDel === g.id ? "danger" : "ghost"}" data-act="del" data-id="${g.id}">${confirmDel === g.id ? "Confirm remove" : "Remove"}</button>
      </div></td></tr>`;
  }).join("");
}
$("groupFilter").addEventListener("change", (e) => { groupFilter = e.target.value; renderGuests(); });
$("filters").addEventListener("click", (e) => {
  const b = e.target.closest(".chip"); if (!b) return;
  filter = b.dataset.f;
  for (const c of $("filters").querySelectorAll(".chip")) c.setAttribute("aria-pressed", String(c === b));
  renderGuests();
});
$("gBody").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-act]"); if (!b) return;
  const g = guests.find((x) => x.id === b.dataset.id); if (!g) return;
  if (b.dataset.act === "share") {
    navigator.share({ text: inviteText(g) }).catch(() => { });   // closing the share sheet isn't an error worth showing
  } else if (b.dataset.act === "copy") {
    try { await navigator.clipboard.writeText(inviteText(g)); toast("Invitation message copied"); }
    catch { toast("Couldn't copy automatically. Use Preview to get the link."); }
  } else if (b.dataset.act === "notdup") {
    const { error } = await sb.from("guests").update({ dup_of: null, dup_reason: "" }).eq("id", g.id);
    if (error) { toast("Couldn't update: " + error.message); return; }
    g.dup_of = null; g.dup_reason = ""; renderGuests(); toast("Marked as not a duplicate");
  } else if (b.dataset.act === "del") {
    if (confirmDel !== g.id) { confirmDel = g.id; renderGuests(); return; }
    confirmDel = null;
    const { error } = await sb.from("guests").delete().eq("id", g.id);
    if (error) { toast("Couldn't remove: " + error.message); return; }
    guests = guests.filter((x) => x.id !== g.id); renderGuests(); toast("Guest removed");
  }
});
// Phone extras: the share sheet for the group link, and picking guests from contacts (Android Chrome supports this; iPhone doesn't).
$("grpShare").hidden = !canShare;
$("grpShare").addEventListener("click", () => navigator.share({ text: groupText() }).catch(() => { }));
const canPickContacts = "contacts" in navigator && "ContactsManager" in window;
$("contactsRow").hidden = !canPickContacts;
$("fromContacts").addEventListener("click", async () => {
  let picked;
  try { picked = await navigator.contacts.select(["name", "tel"], { multiple: true }); } catch { return; }
  const seats = Math.round(clamp($("gSeats").value, 1, 50, 2)), side = chosenSide();
  const rows = (picked || []).map((c) => {
    const tel = String(c.tel?.[0] || "").trim().slice(0, 40);
    const name = String(c.name?.[0] || tel).trim().slice(0, 120);
    return name ? { invitation_id: inv.id, name, phone: tel, seats, side } : null;
  }).filter(Boolean);
  if (!rows.length) return;
  const { data, error, withoutGroup } = await insertGuests(rows);
  if (error) { toast("Couldn't add them: " + error.message); return; }
  for (const g of data || []) if (!guests.some((x) => x.id === g.id)) guests.push(g);
  renderGuests();
  addedToast(rows.map((r) => r.name), withoutGroup);
});

$("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const row = {
    invitation_id: inv.id, name: $("gName").value.trim(), phone: $("gPhone").value.trim(),
    seats: Math.round(clamp($("gSeats").value, 1, 50, 2)), side: chosenSide(),
  };
  if (!row.name) return;
  const { data: added, error, withoutGroup } = await insertGuests([row]);
  if (error) { toast("Couldn't add guest: " + error.message); return; }
  const data = added[0];
  if (!guests.some((g) => g.id === data.id)) guests.push(data);
  renderSideControls();   // a new group name becomes a suggestion for the next guest
  renderGuests();
  $("gName").value = ""; $("gPhone").value = ""; $("gSeats").value = 2; $("gName").focus();
  addedToast([row.name], withoutGroup);
});
$("csv").addEventListener("click", () => {
  const head = ["Name", "Phone", usesSides() ? "Side" : "Group", "Seats", "Reply", "Coming", "Dietary", "Note", "Replied at", "Added by", "Possible duplicate", "Invitation link"];
  const label = { yes: "Coming", no: "Can't make it", pending: "Waiting" };
  const rows = guests.map((g) => [g.name, g.phone, sideText(g.side), g.seats, label[g.status], g.coming, g.dietary, g.note,
  g.responded_at ? new Date(g.responded_at).toLocaleString("en-SG") : "", g.source === "group" ? "Group link" : "You",
  g.dup_reason || "", guestLink(g)]);
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
  const d = inv.details;
  a.download = `guest-list-${[d.name1, d.name2].filter(Boolean).join("-") || "event"}.csv`.replace(/[^\w.-]+/g, "-");
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

init();