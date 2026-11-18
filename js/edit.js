// The invitation editor: design, photo, templates and guest list.
import { sb, requireUser, signOut, $, toast, isConfigured, showSetupNotice } from "./sb.js";
import { setupFreeDesign } from "./freedesign.js";
import { setupEvents } from "./edit-events.js";
import { setupLanguages, fillLangs, renderTr, renderLangSwitch, curLang } from "./edit-languages.js";
import { setupImport } from "./edit-import.js";
import { setupCheckin, clock } from "./edit-checkin.js";
import { setupExport } from "./edit-export.js";
import { setupPalette } from "./edit-palette.js";
import { setupGuestEvents, invitedOf } from "./edit-guest-events.js";
import { FALLS, playFall, bloom } from "./effects.js";
import {
  esc, clamp, FONTS, PRESETS, presetById, cleanStyle, cleanPhoto, cleanDetails, imgCSS, SHAPE_DEF,
  cardHTML, thumbHTML, FOILS, FILTERS, LANGS, TR_FIELDS, translated, langSwitchHTML, photoUrl, watchPhotos, fmtDate, OCCASIONS, occasionOf, inviteLine, initialsFor, ensureFonts,
  CORNERS, TEXTURES, SHAPES, SECTIONS, OPENINGS, eventsOf, mainEvent, eventName, readabilityIssues, musicUrl, mix, contrast, fixColor, eventTitle, fontCSSUrl, cardFontKeys,
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
let guests = [], myTpls = [], pubTpls = [];
let shareReady = true;     // false until the community templates database update (005) has been run
let filter = "all", groupFilter = "", confirmDel = null, confirmTpl = null, confirmPhoto = false;
const canShare = typeof navigator.share === "function";   // the phone's own share sheet (most phones; some desktop browsers)
let saveTimer = null, dirty = false, photoBusy = false, drag = null;
let fd = null;             // free design (stickers, pictures and text placed anywhere)
let evUI = null;           // separate events on the Details step
let gev = null;            // events on the Guests tab

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
    fd = setupFreeDesign(fdContext);
    setupLanguages({ inv, queueSave, renderDesign });
    setupImport({ inv, guests: () => guests, usesSides, sideText, insertGuests, NEEDS_UPDATE, added: () => { renderSideControls(); renderGuests(); renderReady(); } });
    setupCheckin({ guests: () => guests, renderGuests });
    setupExport({ inv, phone });
    setupPalette({ inv, applied: () => { fillStyle(); renderTemplates(); queueSave(); } });
    evUI = setupEvents({ inv: () => inv, change: (d) => { inv.details = d; queueSave(); }, refresh: () => { renderSectionList(); gev?.render(); renderGuests(); } });
    gev = setupGuestEvents({ inv: () => inv, guests: () => guests, renderGuests: () => renderGuests(), saveDetails: (patch) => { inv.details = cleanDetails({ ...inv.details, ...patch }); queueSave(); renderGroup(); } });
    $("pageTitle").textContent = `Edit invitation: ${eventTitle(inv.details)}`;
    fillForm(); renderDesign(); resetHistory(); showTab(hashTab === "guests" ? "guests" : "design");
    let saved = ""; try { saved = localStorage.getItem("jemput.step") || ""; } catch { }
    showStep(STEPS.includes(saved) && hashTab !== "start" ? saved : "details", false);
    if (hashTab === "start") openStart();
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

/* ---------- design steps: Details · Style · Decorate · Reveal ---------- */
const STEPS = ["details", "style", "decorate", "reveal"];
function showStep(name, focus = true) {
  for (const b of $("steps").querySelectorAll("[data-step]")) {
    const on = b.dataset.step === name;
    b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
    $("step-" + b.dataset.step).hidden = !on;
  }
  fd?.setOn(name === "decorate");   // stickers can be moved on the preview only while decorating
  if (name === "style" && !tplsShown) { tplsShown = true; renderTemplates(); }
  try { localStorage.setItem("jemput.step", name); } catch { }
  if (focus) {
    const top = $("steps").getBoundingClientRect().top, pinned = phone.matches ? $("preview").getBoundingClientRect().bottom : 0;
    if (top < pinned || top > innerHeight) window.scrollTo({ top: window.scrollY + top - pinned - 8, behavior: "smooth" });
  }
}
$("steps").addEventListener("click", (e) => { const b = e.target.closest("[data-step]"); if (b) showStep(b.dataset.step); });
// arrow keys move between the steps, like other tabs
$("steps").addEventListener("keydown", (e) => {
  const i = STEPS.indexOf(document.activeElement.dataset.step); if (i < 0) return;
  const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: STEPS.length - 1 }[e.key];
  if (j === undefined) return;
  e.preventDefault(); const k = (j + STEPS.length) % STEPS.length;
  showStep(STEPS[k]); $("st-" + STEPS[k]).focus();
});
$("designForm").addEventListener("click", (e) => {
  const b = e.target.closest("[data-go]"); if (!b) return;
  if (b.dataset.go === "guests") { showTab("guests"); window.scrollTo(0, 0); $("gName").focus(); return; }
  showStep(b.dataset.go); $("st-" + b.dataset.go).focus({ preventScroll: true });
});

/* ---------- saving ---------- */
function queueSave() {
  dirty = true; renderDesign(); record();
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
// Font menus preview every font, but all 16 are only fetched the first time someone opens a font menu.
let allFonts = false;
const loadAllFonts = () => { if (!allFonts) { allFonts = true; ensureFonts(Object.keys(FONTS)); } };
for (const ev of ["focusin", "pointerdown"]) document.addEventListener(ev, (e) => {
  if (e.target.matches?.('select[data-s$="Font"], select[data-p="font"], #sBodyFont')) loadAllFonts();
}, true);
function setupFontSelects() {
  const opts = Object.entries(FONTS).map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join("");
  for (const sel of [$("sBodyFont")]) {
    sel.innerHTML = opts;
    for (const o of sel.options) { o.style.fontFamily = FONTS[o.value][1]; o.style.fontStyle = FONTS[o.value][2] || "normal"; }
  }
}
const initials = () => initialsFor(inv.details);
// the look of a style without its free-design items, for "has this been customised?"
const lookOf = (st) => JSON.stringify({ ...st, layers: undefined });
function baseStyleOf(tid) {
  if (tid?.startsWith("mine:")) { const t = myTpls.find((x) => x.id === tid.slice(5)); if (t) return t.style; }
  if (tid?.startsWith("pub:")) { const t = pubTpls.find((x) => x.id === tid.slice(4)); if (t) return t.style; }
  return (presetById(tid) || PRESETS[0]).style;
}
function baseName(tid) {
  if (tid?.startsWith("mine:")) return myTpls.find((x) => x.id === tid.slice(5))?.name || "your template";
  if (tid?.startsWith("pub:")) return pubTpls.find((x) => x.id === tid.slice(4))?.name || "a community template";
  return presetById(tid)?.name || "Songket";
}
// The template tiles (and their fonts) are only drawn once the Style step has been opened.
let tplsShown = false;
function renderTemplates() {
  if (!tplsShown) return;
  const ini = initials();
  $("tpls").innerHTML = PRESETS.map((p) => `<button type="button" class="tpl" data-t="${p.id}" aria-pressed="${inv.template === p.id}">${thumbHTML(p.style, p.name, ini)}</button>`).join("");
  $("mineWrap").hidden = !myTpls.length;
  $("mine").innerHTML = myTpls.map((t) => `<div class="tpl" role="button" tabindex="0" data-t="mine:${t.id}" aria-pressed="${inv.template === "mine:" + t.id}">${thumbHTML(t.style, t.name, ini)}
    <button type="button" class="x${confirmTpl === t.id ? " armed" : ""}" data-del="${t.id}" aria-label="Delete ${esc(t.name)}">${confirmTpl === t.id ? "Delete?" : "×"}</button>
    ${t.reported ? `<span class="share-t off" title="Several people reported this template, so it's no longer on the community list.">Not shared: reported</span>`
      : shareReady ? `<button type="button" class="share-t" data-share="${t.id}" aria-pressed="${!!t.shared}" aria-label="${t.shared ? "Stop sharing" : "Share"} ${esc(t.name)} with everyone">${t.shared ? "Shared" : "Share"}</button>` : ""}</div>`).join("");
  $("pubWrap").hidden = !pubTpls.length;
  $("pub").innerHTML = pubTpls.map((t) => `<div class="tpl pub" role="button" tabindex="0" data-t="pub:${t.id}" aria-pressed="${inv.template === "pub:" + t.id}">${thumbHTML(t.style, t.name, ini)}<span class="by">by ${esc(t.author || "a Jemput designer")}</span>
    <button type="button" class="x report${armedReport === t.id ? " armed" : ""}" data-report="${t.id}" aria-label="${armedReport === t.id ? "Confirm reporting" : "Report"} ${esc(t.name)}">${armedReport === t.id ? "Report it?" : "Report"}</button></div>`).join("");
  const changed = lookOf(cleanStyle(baseStyleOf(inv.template))) !== lookOf(inv.style);
  $("tplState").innerHTML = changed ? `<span class="tag">Customised from ${esc(baseName(inv.template))}</span>` : "";
  $("resetStyle").disabled = !changed;
}
function fillStyle() {
  const s = inv.style;
  for (const el of document.querySelectorAll("#styleBox [data-s]")) {
    if (el === document.activeElement && el.type !== "range") continue;
    if (el.type === "checkbox") el.checked = !!s[el.dataset.s];
    else if (el.type === "color" && !s[el.dataset.s]) el.value = el.dataset.follow === "accent" ? s.accent : s.ink;   // follows the card
    else el.value = s[el.dataset.s];
    if (el.classList.contains("part-color")) el.classList.toggle("own", !!s[el.dataset.s] && !["accent", "headColor"].includes(el.dataset.s));
  }
  const out = (id, t) => { if ($(id)) $(id).textContent = t; };
  out("oHeadSpacing", s.headSpacing ? (s.headSpacing / 100).toFixed(2) + " em" : "none");
  $("bg2Wrap").hidden = s.texture !== "gradient";
  $("cornerColorWrap").hidden = s.corners === "none";
  out("oNameSize", s.nameSize + "px"); out("oBodySize", s.bodySize + "px"); out("oRadius", s.radius + "px");
  document.querySelectorAll("[data-follow-reset]").forEach((b) => { b.hidden = !s[b.dataset.followReset]; });
}
function fillForm() {
  for (const el of document.querySelectorAll("#designForm [data-k]")) if (el !== document.activeElement) el.value = inv.details[el.dataset.k] ?? "";
  fillOccasion(); fillStyle(); renderTemplates(); fillPhoto(); fillCustomise(); evUI?.fill();
}

/* ---------- extra lines, second language, layout, opening and music ---------- */
const options = (obj) => Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v.label || v)}</option>`).join("");
function setupCustomise() {
  $("sCorners").innerHTML = options(CORNERS); $("sTexture").innerHTML = options(TEXTURES); $("sShape").innerHTML = options(SHAPES);
  $("lang1").innerHTML = options(LANGS); $("opening").innerHTML = options(OPENINGS); $("fall").innerHTML = options(FALLS);
}
function fillCustomise() { renderExtras(); renderSectionList(); fillLangs(); fillMusic(); $("bloom").checked = inv.details.bloom === "1"; }

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
/* Each part's own settings: a colour swatch on the row, and a "Style" panel with its font and anything else it has. */
const PART_UI = {
  headline: {
    color: "headColor", font: "headFont", more: () => `
      <div class="row">
        <label class="f">Letters<select data-s="headCase"><option value="upper">CAPITALS</option><option value="normal">As typed</option></select></label>
        <label class="f"><span class="lab">Letter spacing <output id="oHeadSpacing"></output></span><input type="range" data-s="headSpacing" min="0" max="40" step="1"></label>
      </div>
      <label class="chk"><input type="checkbox" data-s="headItalic"> Italic</label>` },
  names: {
    color: "accent", font: "nameFont", noSame: true, more: () => `
      <div class="row">
        <label class="f"><span class="lab">Size <output id="oNameSize"></output></span><input type="range" data-s="nameSize" min="28" max="64" step="1"></label>
        <label class="f">Finish<select data-s="namesFoil">${Object.entries(FOILS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("")}</select></label>
      </div>` },
  message: { color: "msgColor", font: "msgFont" },
  divider: {
    color: "divColor", follow: "accent", more: () => `
      <label class="f">Style<select data-s="ornament"><option value="rule">Thin line</option><option value="dots">• • •</option><option value="diamond">◆</option>
        <option value="flourish">❦</option><option value="none">None</option></select></label>` },
  when: { color: "whenColor", font: "whenFont" },
  where: { color: "whereColor", font: "whereFont" },
  dress: { color: "dressColor", font: "dressFont" },
  extras: { color: "extrasColor", font: "extrasFont", hint: "The times use the names colour." },
};
const openParts = new Set();   // which "Style" panels are open, so they stay open when the list redraws
const fontOptions = (same) => (same ? `<option value="">Same as text font</option>` : "") + Object.entries(FONTS).map(([k, v]) => `<option value="${k}" style="font-family:${esc(v[1])};font-style:${v[2] || "normal"}">${esc(v[0])}</option>`).join("");
function renderSectionList() {
  const { order, hidden } = inv.details;
  $("secList").innerHTML = order.map((k) => {
    const multi = eventsOf(inv.details).length > 0;
    const ui = PART_UI[k], open = openParts.has(k);
    const name = esc(multi && k === "when" ? "Events" : multi && k === "where" ? "Venues (shown with each event)" : SECTIONS[k]);
    const panel = `<div class="part-opts" id="opts-${k}"${open ? "" : " hidden"}>
        ${ui.font ? `<label class="f">Font<select data-s="${ui.font}">${fontOptions(!ui.noSame)}</select></label>` : ""}
        ${ui.more ? ui.more() : ""}
        ${ui.color !== "accent" && ui.color !== "headColor" ? `<button type="button" class="btn sm ghost" data-follow-reset="${ui.color}">Use the card's ${ui.follow === "accent" ? "names" : "text"} colour</button>` : ""}
        ${ui.hint ? `<p class="hint">${esc(ui.hint)}</p>` : ""}
      </div>`;
    return `<li class="sec-item${hidden.includes(k) ? " is-hidden" : ""}" data-k="${k}">
      <div class="sec-row">
        <button type="button" class="drag-handle" id="drag-${k}" data-k="${k}" aria-label="Move ${name}. Drag, or use the up and down arrow keys" aria-describedby="secHint">${GRIP}</button>
        <label class="chk"><input type="checkbox" data-show="${k}" ${hidden.includes(k) ? "" : "checked"}> ${name}</label>
        <input type="color" class="part-color" data-s="${ui.color}"${ui.follow ? ` data-follow="${ui.follow}"` : ""} aria-label="${name} colour">
        <button type="button" class="btn sm ghost part-more" data-more="${k}" aria-expanded="${open}" aria-controls="opts-${k}" aria-label="${name} style">Style</button>
      </div>${panel}
    </li>`;
  }).join("");
  fillStyle();
}
$("secList").addEventListener("change", (e) => {
  const k = e.target.dataset.show; if (!k) return;
  const hidden = e.target.checked ? inv.details.hidden.filter((x) => x !== k) : [...inv.details.hidden, k];
  inv.details = cleanDetails({ ...inv.details, hidden }); renderSectionList(); queueSave();
  document.querySelector(`[data-show="${k}"]`)?.focus();
});
$("secList").addEventListener("click", (e) => {
  const more = e.target.closest("[data-more]");
  if (more) {
    const k = more.dataset.more, open = !openParts.has(k);
    open ? openParts.add(k) : openParts.delete(k);
    more.setAttribute("aria-expanded", open); $("opts-" + k).hidden = !open; return;
  }
  const r = e.target.closest("[data-follow-reset]");
  if (r) { inv.style = cleanStyle({ ...inv.style, [r.dataset.followReset]: "" }, inv.style); fillStyle(); renderTemplates(); queueSave(); }
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
  // rows can be different heights (a "Style" panel may be open), so remember where each one starts
  const rects = items.map((x) => x.getBoundingClientRect());
  const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 6;
  const mids = rects.map((r) => (r.top + r.bottom) / 2), step = rects[from].height + gap;
  handle.setPointerCapture(e.pointerId);
  li.classList.add("dragging"); $("secList").classList.add("is-dragging");
  sdrag = { handle, li, items, from, to: from, y: e.clientY, raf: 0, startY: e.clientY, scrollY: window.scrollY, step, mids, order: [...inv.details.order] };
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
  const centre = sdrag.mids[sdrag.from] + dy;
  const to = sdrag.mids.filter((m, i) => i !== sdrag.from && m < centre).length;
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

/* ---------- second language: see edit-languages.js ---------- */

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
  const untouched = inv.template === prev.template && lookOf(cleanStyle(baseStyleOf(inv.template))) === lookOf(inv.style);
  if (untouched && presetById(next.template)) { inv.template = next.template; inv.style = cleanStyle({ ...presetById(next.template).style, layers: inv.style.layers }); }
  fillForm(); renderGuests(); queueSave();
  toast(`Set up for ${next.label.toLowerCase()}`);
});
function renderDesign() { $("designCard").innerHTML = cardHTML(inv, null, curLang()); fitPreview(); renderReadability(); renderTr(); fd?.decorate(); fd?.refresh(); renderReady(); }

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
// A template's look replaces the card's look, but stickers and text boxes stay unless the template brings its own.
function chooseTemplate(tid) {
  const base = cleanStyle(baseStyleOf(tid));
  inv.template = tid; inv.style = cleanStyle({ ...base, layers: base.layers.length ? base.layers : inv.style.layers });
  confirmTpl = null; fillStyle(); renderTemplates(); queueSave();
}
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
  const sh = e.target.closest("[data-share]");
  if (sh) { const t = myTpls.find((x) => x.id === sh.dataset.share); if (t && await setShared(t, !t.shared)) { renderTemplates(); $("mine").querySelector(`[data-share="${t.id}"]`)?.focus(); } return; }
  const b = e.target.closest(".tpl"); if (b) chooseTemplate(b.dataset.t);
});
$("mine").addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("tpl")) { e.preventDefault(); chooseTemplate(e.target.dataset.t); }
});
$("resetStyle").addEventListener("click", () => chooseTemplate(inv.template));
async function loadTemplates() {
  // newest database first (with reports), then older ones without reports or sharing
  let { data, error } = await sb.from("templates").select("id, name, style, is_public, author, reported").eq("owner", user.id).order("created_at");
  if (error) ({ data, error } = await sb.from("templates").select("id, name, style, is_public, author").eq("owner", user.id).order("created_at"));
  if (error) { shareReady = false; ({ data } = await sb.from("templates").select("id, name, style").eq("owner", user.id).order("created_at")); }
  myTpls = (data || []).map((t) => ({ id: t.id, name: String(t.name).slice(0, 40), style: cleanStyle(t.style), shared: !!t.is_public, author: t.author || "", reported: !!t.reported }));
  const mineAuthor = myTpls.find((t) => t.author)?.author; if (mineAuthor && !$("tplAuthor").value) $("tplAuthor").value = mineAuthor;
  if (shareReady) {
    const r = await sb.from("templates").select("id, name, style, author").eq("is_public", true).neq("owner", user.id).order("published_at", { ascending: false }).limit(60);
    let mine = []; try { mine = JSON.parse(localStorage.getItem("jemput.reported") || "[]"); } catch { }
    pubTpls = (r.data || []).filter((t) => !mine.includes(t.id))   // ones you reported disappear for you straight away
      .map((t) => ({ id: t.id, name: String(t.name).slice(0, 40), style: cleanStyle(t.style), author: String(t.author || "").slice(0, 60) }));
  }
  renderTemplates();
}
// Report a community template: press once to arm, again to send. Three reports from different people take it off the list.
let armedReport = null;
$("pub").addEventListener("click", async (e) => {
  const r = e.target.closest("[data-report]");
  if (r) {
    const id = r.dataset.report;
    if (armedReport !== id) { armedReport = id; renderTemplates(); $("pub").querySelector(`[data-report="${id}"]`)?.focus(); return; }
    armedReport = null;
    const { error } = await sb.rpc("report_template", { p_id: id, p_reason: "" });
    if (error && /could not find|function/i.test(error.message)) { toast("Reporting needs a one-time database update: run supabase/006_safety_and_checkin.sql in Supabase's SQL Editor."); renderTemplates(); return; }
    if (error) { toast("Couldn't send the report: " + error.message); renderTemplates(); return; }
    try { const mine = JSON.parse(localStorage.getItem("jemput.reported") || "[]"); mine.push(id); localStorage.setItem("jemput.reported", JSON.stringify(mine)); } catch { }
    pubTpls = pubTpls.filter((t) => t.id !== id); renderTemplates();
    toast("Thanks for reporting it. You won't see it again, and it's removed for everyone if others report it too.");
    return;
  }
  const b = e.target.closest(".tpl"); if (b) chooseTemplate(b.dataset.t);
});
$("pub").addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("tpl")) { e.preventDefault(); chooseTemplate(e.target.dataset.t); }
});
$("tplShare").addEventListener("change", (e) => {
  if (e.target.checked && !shareReady) { e.target.checked = false; toast("Sharing needs a one-time database update: run supabase/005_public_templates.sql in Supabase's SQL Editor."); return; }
  $("tplAuthorWrap").hidden = !e.target.checked; if (e.target.checked) $("tplAuthor").focus();
});
async function setShared(t, on) {
  const author = $("tplAuthor").value.trim() || t.author;
  if (on && !author) { $("tplShare").checked = true; $("tplAuthorWrap").hidden = false; $("tplAuthor").focus(); toast("Add a name to credit first, then press Share again."); return false; }
  const patch = on ? { is_public: true, author, published_at: new Date().toISOString() } : { is_public: false };
  const { error } = await sb.from("templates").update(patch).eq("id", t.id);
  if (error) { toast("Couldn't change sharing: " + error.message); return false; }
  Object.assign(t, { shared: on, author: on ? author : t.author });
  toast(on ? `"${t.name}" is now a community template, credited to ${author}.` : `"${t.name}" is no longer shared.`);
  return true;
}
$("saveTpl").addEventListener("click", async () => {
  const name = $("tplName").value.trim();
  if (!name) { $("tplName").focus(); toast("Give your template a name first"); return; }
  const { data, error } = await sb.from("templates").insert({ name, style: inv.style }).select("id").single();
  if (error) { toast("Couldn't save: " + error.message); return; }
  const t = { id: data.id, name, style: { ...inv.style }, shared: false, author: "" };
  myTpls.push(t);
  inv.template = "mine:" + data.id; $("tplName").value = "";
  renderTemplates(); queueSave(); toast(`Saved "${name}"`);
  if ($("tplShare").checked && await setShared(t, true)) { $("tplShare").checked = false; $("tplAuthorWrap").hidden = true; renderTemplates(); }
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
  $("palBox").hidden = !src;
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
/* iPhone photos (HEIC/HEIF) are turned into JPG in the browser first. The converter is large, so it only loads when needed. */
const HEIC_LIB = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/+esm";
const isHeic = (f) => /^image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name || "");
async function fromHeic(file, note) {
  if (!isHeic(file)) return file;
  note?.("Converting your iPhone photo…");
  try {
    const { default: heic2any } = await import(HEIC_LIB);
    let out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    if (Array.isArray(out)) out = out[0];   // a Live Photo or burst gives several; use the first
    return new File([out], (file.name || "photo").replace(/\.hei[cf]$/i, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    throw new Error("Couldn't convert that iPhone photo. Try sharing it as a JPG, or take a screenshot of it.");
  }
}
async function handlePhoto(file) {
  if (!file) return;
  try { file = await fromHeic(file, (t) => { $("photoNote").textContent = t; }); }
  catch (err) { $("photoNote").textContent = "Or drag one here."; toast(err.message); return; }
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { toast("Please choose a JPG, PNG, WebP or iPhone (HEIC) photo."); return; }
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
  if (fd?.on && (p.mode === "background" || e.target.closest(".ly, .fd-overlay"))) return;
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
  const when = fmtDate(mainEvent(d).date), by = fmtDate(d.rsvpBy);
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
  const d = inv.details, mine = invitedOf(d, g).filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date));
  const when = fmtDate(mine[0]?.date || mainEvent(d).date), by = fmtDate(d.rsvpBy);
  return `Hi ${g.name}! ${inviteLine(d)}${when ? " on " + when : ""}. Here's your invitation${by ? ", please reply by " + by : ""}: ${guestLink(g)}`;
}
async function loadGuests() {
  const { data, error } = await sb.from("guests").select("*").eq("invitation_id", inv.id).order("created_at");
  if (error) { toast("Couldn't load guests: " + error.message); return; }
  guests = data; renderSideControls(); gev?.render(); renderGuests(); renderReady();
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
  renderStats(); gev?.renderStats();
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
  const list = guests.filter((g) => (filter === "all" || (filter === "dup" ? g.dup_reason : g.status === filter)) && (!groupFilter || g.side === groupFilter) && (!gev || gev.keep(g)));
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
      <td class="g-reply">${gev && eventsOf(inv.details).length ? gev.rowHTML(g) : `<span class="pill ${esc(g.status)}">${label[g.status] || "Waiting"}</span>`}${g.checked_in_at ? `<div class="arrived">Arrived ${esc(clock(g.checked_in_at))}</div>` : ""}</td>
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
  if (gev?.onRowClick(b.dataset.act, g)) return;
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
  const evIds = gev?.chosen();
  if (evIds && gev.ready()) row.events = evIds;
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
  const head = ["Name", "Phone", usesSides() ? "Side" : "Group", "Seats", "Reply", "Coming", "Dietary", "Note", "Replied at", "Added by", "Possible duplicate", "Invitation link", "Arrived", ...(gev?.csvHead() || [])];
  const label = { yes: "Coming", no: "Can't make it", pending: "Waiting" };
  const rows = guests.map((g) => [g.name, g.phone, sideText(g.side), g.seats, label[g.status], g.coming, g.dietary, g.note,
  g.responded_at ? new Date(g.responded_at).toLocaleString("en-SG") : "", g.source === "group" ? "Group link" : "You",
  g.dup_reason || "", guestLink(g), g.checked_in_at ? new Date(g.checked_in_at).toLocaleString("en-SG") : "", ...(gev?.csvCells(g) || [])]);
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
  const d = inv.details;
  a.download = `guest-list-${[d.name1, d.name2].filter(Boolean).join("-") || "event"}.csv`.replace(/[^\w.-]+/g, "-");
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

init();


/* ---------- free design ---------- */
const fdContext = {
  $, toast, phone,
  getStyle: () => inv.style,
  setStyle(style, save = true) { inv.style = cleanStyle(style, inv.style); if (save) { fillStyle(); renderTemplates(); queueSave(); } else renderDesign(); },
  // show a style on the preview without keeping it (while dragging a layer up or down the list)
  preview(style) { $("designCard").innerHTML = cardHTML(style ? { ...inv, style: cleanStyle(style, inv.style) } : inv, null, curLang()); fitPreview(); fd.decorate(); },
  announce(msg) { $("fdLive").textContent = msg; },
  upload: uploadDecoration,
};
// Your own pictures for the card: PNG, WebP or JPG kept as they are (resized if huge); SVG turned into a PNG here,
// so only plain pictures are ever stored.
async function uploadDecoration(file) {
  file = await fromHeic(file);
  if (!/^image\/(png|webp|jpeg|svg\+xml)$/.test(file.type)) throw new Error("Please choose a PNG, SVG, WebP, JPG or iPhone (HEIC) picture.");
  if (file.size > 10e6) throw new Error("That picture is over 10 MB. Please use a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("Couldn't read that picture. Try a PNG.")); img.src = url; });
    let w = img.naturalWidth, h = img.naturalHeight;
    if (file.type === "image/svg+xml") {   // drawings have no fixed size: use their proportions, 1600px on the long side
      const vb = (await file.text()).match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
      const ar = vb ? +vb[2] / +vb[1] : (h && w ? h / w : 1);
      w = ar <= 1 ? 1600 : Math.round(1600 / ar); h = Math.round(w * ar);
    } else { const k = Math.min(1, 1600 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k); }
    if (!w || !h) throw new Error("Couldn't read that picture. Try a PNG.");
    const keepJpeg = file.type === "image/jpeg";
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    const type = keepJpeg ? "image/jpeg" : "image/png";
    const blob = await new Promise((r) => c.toBlob(r, type, 0.88));
    if (!blob) throw new Error("Couldn't prepare that picture.");
    const path = `${user.id}/${inv.id}/deco-${Date.now()}.${keepJpeg ? "jpg" : "png"}`;
    const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
    if (error) throw new Error("Upload failed: " + error.message);
    return { path, ar: h / w };
  } finally { URL.revokeObjectURL(url); }
}

/* ---------- undo and redo (everything on the Design tab) ---------- */
let hist = [], hi = -1, histTimer = null, restoring = false;
const snapshot = () => JSON.stringify({ template: inv.template, details: inv.details, style: inv.style, photo: inv.photo });
function pushHistory() {
  clearTimeout(histTimer); histTimer = null;
  const s = snapshot(); if (hist[hi] === s) return;
  hist = hist.slice(0, hi + 1); hist.push(s);
  if (hist.length > 100) hist.shift();
  hi = hist.length - 1; undoButtons();
}
// changes that come quickly one after another (typing, dragging a slider) become one step
function record() { if (restoring || !inv) return; clearTimeout(histTimer); histTimer = setTimeout(pushHistory, 500); undoButtons(); }
function resetHistory() { hist = [snapshot()]; hi = 0; undoButtons(); }
function undoButtons() { $("undoBtn").disabled = hi <= 0 && !histTimer; $("redoBtn").disabled = hi >= hist.length - 1; }
function restore(i) {
  const o = JSON.parse(hist[i]); hi = i;
  restoring = true;
  inv.template = o.template; inv.details = cleanDetails(o.details); inv.style = cleanStyle(o.style); inv.photo = cleanPhoto(o.photo);
  fillForm(); queueSave();
  restoring = false; undoButtons();
}
function undo() { if (histTimer) pushHistory(); if (hi > 0) { restore(hi - 1); toast("Undone"); } }
function redo() { if (hi < hist.length - 1) { restore(hi + 1); toast("Redone"); } }
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
document.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || $("v-design").hidden) return;
  const k = e.key.toLowerCase();
  if (k !== "z" && k !== "y") return;
  if (e.target.matches("input[type=text], input:not([type]), input[type=number], input[type=url], input[type=tel], input[type=email], textarea")) return;   // typing boxes keep their own undo
  e.preventDefault();
  if (k === "y" || e.shiftKey) redo(); else undo();
});


/* ---------- colours from the photo: see edit-palette.js ---------- */

/* ---------- movement preview ---------- */
const fxColours = () => { const st = inv.style; return [st.accent, st.frameA, st.frameB, st.ink].filter((c, i, a) => a.indexOf(c) === i); };
$("bloom").addEventListener("change", (e) => { inv.details = cleanDetails({ ...inv.details, bloom: e.target.checked ? "1" : "" }); queueSave(); });
$("fxPlay").addEventListener("click", () => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { toast("Your device is set to reduce motion, so the movement is skipped here too."); return; }
  if (inv.details.fall === "none" && inv.details.bloom !== "1") { toast("Choose something to fall, or tick bloom, first."); return; }
  playFall(inv.details.fall, fxColours(), $("pvFrame"), { count: 22, seconds: 5 });
  if (inv.details.bloom === "1") bloom($("designCard"));
});


/* ---------- ready to send: what's still missing, each linking to where to fill it in ---------- */
function renderReady() {
  if (!inv) return;
  const d = inv.details, occ = occasionOf(d);
  const items = [
    { ok: !!(d.name1.trim() && (!occ.two || d.name2.trim())), label: occ.two ? "Names" : "Name", go: "name1" },
    ...(eventsOf(d).length ? [
      { ok: eventsOf(d).every((e) => e.date && e.name.trim()), label: "Event names and dates", go: "evName0" },
      { ok: eventsOf(d).every((e) => e.venue.trim()), label: "Venues", go: "evName0" },
    ] : [
      { ok: !!d.date, label: "Date", go: "date" },
      { ok: !!d.venue.trim(), label: "Venue", go: "venue" },
    ]),
    { ok: guests.length > 0, label: guests.length ? `${guests.length} ${guests.length === 1 ? "guest" : "guests"}` : "Guests", go: "guests" },
  ];
  const done = items.every((x) => x.ok);
  const html = `<span class="ready-h">${done ? "Ready to send" : "Before you send"}</span>` + items.map((x) =>
    `<button type="button" class="ready-i${x.ok ? " ok" : ""}" data-ready="${x.go}"><span class="tick" aria-hidden="true">${x.ok ? "✓" : ""}</span>${esc(x.label)}<span class="vh">${x.ok ? ", done" : ", not done yet"}</span></button>`).join("");
  $("ready").innerHTML = html; $("readyM").innerHTML = html;
}
for (const id of ["ready", "readyM"]) $(id).addEventListener("click", (e) => {
  const b = e.target.closest("[data-ready]"); if (!b) return;
  if (b.dataset.ready === "guests") { showTab("guests"); window.scrollTo(0, 0); $("gName").focus(); return; }
  showStep("details");
  const f = $(b.dataset.ready); const fs = f.closest("fieldset"); if (fs?.classList.contains("closed")) fs.querySelector(".sec-toggle").click();
  f.focus(); f.scrollIntoView({ block: "center", behavior: "smooth" });
});

/* ---------- guided start for a new invitation: who and when, then a look ---------- */
let startTpl = null;
function openStart() {
  const d = inv.details, occ = occasionOf(d);
  $("sl1").textContent = occ.l1; $("sl2").textContent = occ.l2;
  $("sName1").placeholder = occ.two ? "e.g. Hakim" : occ.ph1; $("sName2").placeholder = occ.two ? "e.g. Nadia" : (occ.ex2 || "");
  $("sName1").value = d.name1; $("sName2").value = d.name2; $("sDate").value = d.date; $("sStart").value = d.start; $("sVenue").value = d.venue;
  startTpl = inv.template;
  // the occasion's own template first, then the rest
  const order = [presetById(occ.template), ...PRESETS.filter((p) => p.id !== occ.template)].filter(Boolean);
  $("sTpls").innerHTML = order.map((p) => `<button type="button" class="tpl" role="radio" data-st="${p.id}" aria-checked="${p.id === startTpl}" tabindex="${p.id === startTpl ? 0 : -1}">${thumbHTML(p.style, p.name, initialsFor(d))}</button>`).join("");
  startPage("A");
  $("startDlg").showModal();
  $("sName1").focus();
}
function startPage(pg) {
  $("startA").hidden = pg !== "A"; $("startB").hidden = pg !== "B";
  $("startBack").hidden = pg === "A";
  $("startNext").textContent = pg === "A" ? "Next" : "Start designing";
  $("startStep").textContent = pg === "A" ? "Step 2 of 3" : "Step 3 of 3";
  $("startDlg").setAttribute("aria-labelledby", pg === "A" ? "startTitle" : "startTitleB");
}
function applyStart() {
  inv.details = cleanDetails({ ...inv.details, name1: $("sName1").value.trim(), name2: $("sName2").value.trim(), date: $("sDate").value, start: $("sStart").value, venue: $("sVenue").value.trim() });
  if (startTpl && startTpl !== inv.template) chooseTemplate(startTpl);
  fillForm(); queueSave();
}
function closeStart() {
  $("startDlg").close();
  history.replaceState(null, "", location.pathname + "#" + inv.id);
  $("st-details").focus();
}
$("startForm").addEventListener("submit", (e) => {   // Next button, or Enter in a field
  e.preventDefault();
  if (!$("startA").hidden) { startPage("B"); $("sTpls").querySelector('[aria-checked="true"]')?.focus(); return; }
  applyStart(); closeStart();
  toast("Your card is ready to make your own.");
});
$("startBack").addEventListener("click", () => { startPage("A"); $("sName1").focus(); });
$("startSkip").addEventListener("click", () => { applyStart(); closeStart(); });
$("startDlg").addEventListener("cancel", () => history.replaceState(null, "", location.pathname + "#" + inv.id));
$("sTpls").addEventListener("click", (e) => {
  const b = e.target.closest("[data-st]"); if (!b) return;
  startTpl = b.dataset.st;
  for (const x of $("sTpls").children) { const on = x === b; x.setAttribute("aria-checked", String(on)); x.tabIndex = on ? 0 : -1; }
});
// arrow keys move through the looks, like radio buttons
$("sTpls").addEventListener("keydown", (e) => {
  const list = [...$("sTpls").children], i = list.indexOf(document.activeElement); if (i < 0) return;
  const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key]; if (j === undefined) return;
  e.preventDefault(); const b = list[(j + list.length) % list.length]; b.click(); b.focus();
});


/* ---------- import guests (edit-import.js) and check-in on the day (edit-checkin.js) ---------- */