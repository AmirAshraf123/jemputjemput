/* Free design: stickers, your own pictures and text boxes, placed anywhere on the card.
   Select an item on the preview to move it, drag a corner to resize, the round handle to rotate,
   or pinch and twist with two fingers. Guides snap items to the centre, the edges and each other. */
import { STICKERS, STICKER_CATS, stickerSVG } from "./stickers.js";
import { esc, FONTS, FOILS, FILTERS, MAX_LAYERS, layerLabel, photoUrl } from "./card.js";
import { makeSortable, moveItem } from "./sortable.js";

const SNAP = 1.2;             // % of the card within which things snap
const newId = () => Math.random().toString(36).slice(2, 10);
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const GRIP = '<svg viewBox="0 0 20 20" aria-hidden="true"><g fill="currentColor"><circle cx="7" cy="5" r="1.6"/><circle cx="13" cy="5" r="1.6"/><circle cx="7" cy="10" r="1.6"/><circle cx="13" cy="10" r="1.6"/><circle cx="7" cy="15" r="1.6"/><circle cx="13" cy="15" r="1.6"/></g></svg>';
const EYE = (on) => on
  ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>'
  : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const LOCK = (on) => on
  ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
  : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export function setupFreeDesign(ctx) {
  // ctx: { $, getStyle, setStyle(style, save), toast, upload(file) → {path, ar}, phone (MediaQueryList), announce(msg) }
  const { $ } = ctx;
  let on = false, sel = null, cat = "floral", snapOn = true, layersSig = "", propsFor = "";
  try { on = localStorage.getItem("jemput.freeDesign") === "1"; } catch {}
  const layers = () => ctx.getStyle().layers;
  const find = (id) => layers().find((x) => x.id === id);
  const commit = (list, save = true) => ctx.setStyle({ ...ctx.getStyle(), layers: list }, save);
  const update = (id, patch, save = true) => commit(layers().map((x) => (x.id === id ? { ...x, ...patch } : x)), save);

  /* ---------- the panel ---------- */
  $("fdCats").innerHTML = Object.entries(STICKER_CATS).map(([k, v]) => `<button type="button" class="chip" data-cat="${k}" aria-pressed="${k === cat}">${esc(v)}</button>`).join("");
  function renderLib() {
    $("fdLib").innerHTML = Object.entries(STICKERS).filter(([, s]) => s.cat === cat).map(([k, s]) =>
      `<button type="button" class="fd-st" data-add="${k}" aria-label="Add ${esc(s.label)}" title="${esc(s.label)}">${stickerSVG(k, "currentColor")}</button>`).join("");
  }
  $("fdCats").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    cat = b.dataset.cat; $("fdCats").querySelectorAll("[data-cat]").forEach((x) => x.setAttribute("aria-pressed", x === b)); renderLib();
  });
  function add(item) {
    if (layers().length >= MAX_LAYERS) { ctx.toast(`A card can have up to ${MAX_LAYERS} items. Delete one to add another.`); return; }
    const x = { id: newId(), x: 50, y: 50, w: 30, rot: 0, op: 1, ...item };
    commit([...layers(), x]); select(x.id);
    ctx.announce(`${layerLabel(find(x.id) || x)} added. Drag it on the preview, or use the boxes below to place it.`);
  }
  $("fdLib").addEventListener("click", (e) => { const b = e.target.closest("[data-add]"); if (b) add({ type: "sticker", sticker: b.dataset.add, w: STICKERS[b.dataset.add].w > 150 ? 60 : 28 }); });
  $("fdAddText").addEventListener("click", () => { add({ type: "text", text: "Your text", w: 70, size: 7 }); requestAnimationFrame(() => $("fdText")?.select()); });
  $("fdUpload").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    $("fdUploadLabel").classList.add("busy");
    try { const { path, ar } = await ctx.upload(f); add({ type: "image", path, ar, w: 40 }); }
    catch (err) { ctx.toast(err.message || "Couldn't add that picture."); }
    finally { $("fdUploadLabel").classList.remove("busy"); }
  });
  $("fdOn").addEventListener("change", (e) => setOn(e.target.checked));
  $("fdSnap").addEventListener("change", (e) => { snapOn = e.target.checked; });
  function setOn(v) {
    on = v; $("fdOn").checked = v; $("fdTools").hidden = !v;
    try { localStorage.setItem("jemput.freeDesign", v ? "1" : ""); } catch {}
    if (!v) sel = null;
    refresh(true); decorate();
  }

  /* ---------- layers list: front-most at the top ---------- */
  const shown = () => [...layers()].reverse();
  function renderLayers() {
    const list = shown();
    layersSig = JSON.stringify(list.map((x) => [x.id, layerLabel(x), x.hide, x.lock, x.back, x.id === sel]));
    $("fdLayers").innerHTML = list.length ? list.map((x) => {
      const name = esc(layerLabel(x));
      const thumb = x.type === "sticker" ? stickerSVG(x.sticker, "currentColor") : x.type === "image" ? `<img src="${esc(photoUrl(x))}" alt="">` : `<span class="fd-t">T</span>`;
      return `<li class="sec-item fd-row${x.id === sel ? " on" : ""}${x.hide ? " is-hidden" : ""}" data-id="${x.id}">
        <div class="sec-row">
          <button type="button" class="drag-handle" data-id="${x.id}" aria-label="Move ${name} in front or behind. Drag, or use the up and down arrow keys">${GRIP}</button>
          <button type="button" class="fd-pick" data-pick="${x.id}" aria-pressed="${x.id === sel}"><span class="fd-thumb">${thumb}</span><span class="fd-name">${name}</span>${x.back ? `<span class="tag">Behind text</span>` : ""}</button>
          <button type="button" class="icon-btn" data-hide="${x.id}" aria-pressed="${!x.hide}" aria-label="${x.hide ? "Show" : "Hide"} ${name}">${EYE(!x.hide)}</button>
          <button type="button" class="icon-btn" data-lock="${x.id}" aria-pressed="${x.lock}" aria-label="${x.lock ? "Unlock" : "Lock"} ${name}">${LOCK(x.lock)}</button>
        </div></li>`;
    }).join("") : `<li class="hint fd-empty">Nothing added yet. Pick a sticker, add text or upload your own picture.</li>`;
  }
  makeSortable($("fdLayers"), {
    // while dragging, only the preview shows the new order; it's saved when dropped
    onPreview: (from, to) => { const n = layers().length; ctx.preview({ ...ctx.getStyle(), layers: moveItem(layers(), n - 1 - from, n - 1 - to) }); },
    onCommit: (from, to) => {
      const n = layers().length, id = shown()[from]?.id;
      if (from === to) ctx.preview(null);
      else { commit(moveItem(layers(), n - 1 - from, n - 1 - to)); ctx.announce(`${layerLabel(find(id))} moved to position ${to + 1} of ${n}, counting from the front`); }
      refresh(true); $("fdLayers").querySelector(`.drag-handle[data-id="${id}"]`)?.focus({ preventScroll: true });
    },
    onKey: (i, dir) => {
      const n = layers().length, j = i + dir; if (j < 0 || j >= n) return;
      const id = shown()[i].id; commit(moveItem(layers(), n - 1 - i, n - 1 - j)); refresh(true);
      $("fdLayers").querySelector(`.drag-handle[data-id="${id}"]`)?.focus(); ctx.announce(`${layerLabel(find(id))} moved to position ${j + 1} of ${n}, counting from the front`);
    },
    scrollTop: () => (ctx.phone.matches ? $("preview").getBoundingClientRect().bottom : 0),
    scrollBottom: () => (ctx.phone.matches ? ($("tabs")?.getBoundingClientRect().top || innerHeight) : innerHeight),
  });
  $("fdLayers").addEventListener("click", (e) => {
    const p = e.target.closest("[data-pick]"), h = e.target.closest("[data-hide]"), l = e.target.closest("[data-lock]");
    if (p) { select(p.dataset.pick === sel ? null : p.dataset.pick); $("fdLayers").querySelector(`[data-pick="${p.dataset.pick}"]`)?.focus(); }
    else if (h) { const x = find(h.dataset.hide); update(x.id, { hide: !x.hide }); refresh(true); $("fdLayers").querySelector(`[data-hide="${x.id}"]`)?.focus(); }
    else if (l) { const x = find(l.dataset.lock); update(x.id, { lock: !x.lock }); refresh(true); $("fdLayers").querySelector(`[data-lock="${x.id}"]`)?.focus(); }
  });

  /* ---------- properties of the selected item ---------- */
  const fontOpts = `<option value="">Same as text font</option>` + Object.entries(FONTS).map(([k, v]) => `<option value="${k}" style="font-family:${esc(v[1])}">${esc(v[0])}</option>`).join("");
  const opts = (o) => Object.entries(o).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
  const numF = (k, label, min, max, step, unit) => `<label class="f fd-num">${label}<span class="fd-unit"><input type="number" data-p="${k}" min="${min}" max="${max}" step="${step}" inputmode="decimal">${unit ? `<span aria-hidden="true">${unit}</span>` : ""}</span></label>`;
  function renderProps() {
    const x = find(sel);
    propsFor = x ? x.id + x.type : "";
    if (!x) { $("fdProps").innerHTML = ""; $("fdProps").hidden = true; return; }
    $("fdProps").hidden = false;
    const typeBits = x.type === "sticker" ? `
        <div class="row">
          <label class="f">Colour<input type="color" data-p="color"></label>
          <label class="f">Finish<select data-p="foil">${opts(FOILS)}</select></label>
        </div>
        <button type="button" class="btn sm ghost" data-act="namesColour">Use the names colour</button>`
      : x.type === "image" ? `<label class="f">Filter<select data-p="filter">${opts(FILTERS)}</select></label>`
      : `
        <label class="f">Text<textarea id="fdText" data-p="text" maxlength="200" rows="2"></textarea></label>
        <div class="row">
          <label class="f">Font<select data-p="font">${fontOpts}</select></label>
          <label class="f">Size <output data-o="size"></output><input type="range" data-p="size" min="2" max="30" step="0.5"></label>
        </div>
        <div class="row">
          <label class="f">Letter spacing <output data-o="ls"></output><input type="range" data-p="ls" min="-5" max="60" step="1"></label>
          <label class="f">Line height <output data-o="lh"></output><input type="range" data-p="lh" min="80" max="220" step="5"></label>
        </div>
        <label class="f">Curve <output data-o="curve"></output><input type="range" data-p="curve" min="-100" max="100" step="2"></label>
        <div class="row">
          <label class="f">Colour<input type="color" data-p="color"></label>
          <label class="f">Finish<select data-p="foil">${opts(FOILS)}</select></label>
          <label class="f">Align<select data-p="align"><option value="center">Centre</option><option value="left">Left</option><option value="right">Right</option></select></label>
        </div>
        <div class="fd-checks"><label class="chk"><input type="checkbox" data-p="bold"> Bold</label><label class="chk"><input type="checkbox" data-p="italic"> Italic</label></div>`;
    $("fdProps").innerHTML = `
      <div class="fd-props-head"><h3 class="sub-h" id="fdPropsTitle">${esc(layerLabel(x))}</h3>
        <button type="button" class="btn sm ghost" data-act="done">Done</button></div>
      ${typeBits}
      <div class="row fd-pos">${numF("x", "Across", -50, 150, 0.5, "%")}${numF("y", "Down", -50, 150, 0.5, "%")}${numF("w", "Width", 2, 200, 0.5, "%")}${numF("rot", "Turn", -180, 180, 1, "°")}</div>
      <label class="f">Opacity <output data-o="op"></output><input type="range" data-p="op" min="0.05" max="1" step="0.05"></label>
      <div class="fd-checks">
        <label class="chk"><input type="checkbox" data-p="back"> Behind the card's text</label>
        <label class="chk"><input type="checkbox" data-p="shadow"> Shadow</label>
        <label class="chk"><input type="checkbox" data-p="lock"> Lock in place</label>
      </div>
      <div class="fd-acts">
        <button type="button" class="btn sm ghost" data-act="fx">Flip across</button>
        <button type="button" class="btn sm ghost" data-act="fy">Flip up and down</button>
        <button type="button" class="btn sm ghost" data-act="centre">Centre on card</button>
        <button type="button" class="btn sm ghost" data-act="dup">Duplicate</button>
        <button type="button" class="btn sm danger" data-act="del">Delete</button>
      </div>
      <p class="hint">On the preview: drag to move, drag a corner to resize, the round handle to turn. Arrow keys nudge (hold Shift for bigger steps).</p>`;
    fillProps();
  }
  function fillProps() {
    const x = find(sel); if (!x) return;
    const s = ctx.getStyle();
    for (const el of $("fdProps").querySelectorAll("[data-p]")) {
      if (el === document.activeElement && el.type !== "range" && el.type !== "checkbox") continue;
      const k = el.dataset.p, v = x[k];
      if (el.type === "checkbox") el.checked = !!v;
      else if (el.type === "color") el.value = v || (x.type === "sticker" ? s.accent : s.ink);
      else if (el.type === "number") el.value = round(v, 1);
      else el.value = v ?? "";
    }
    const out = (k, t) => { const o = $("fdProps").querySelector(`[data-o="${k}"]`); if (o) o.textContent = t; };
    out("op", Math.round(x.op * 100) + "%");
    if (x.type === "text") { out("size", x.size); out("ls", (x.ls / 100).toFixed(2) + " em"); out("lh", (x.lh / 100).toFixed(2)); out("curve", x.curve ? (x.curve > 0 ? "smile " : "arch ") + Math.abs(x.curve) : "straight"); }
    const nc = $("fdProps").querySelector('[data-act="namesColour"]'); if (nc) nc.hidden = !x.color;
  }
  $("fdProps").addEventListener("input", (e) => {
    const k = e.target.dataset.p, x = find(sel); if (!k || !x) return;
    const t = e.target, v = t.type === "checkbox" ? t.checked : t.type === "range" || t.type === "number" ? +t.value : t.value;
    if (t.type === "number" && t.value === "") return;
    update(x.id, { [k]: v });
    if (k === "lock" || k === "back") renderLayers();
    if (k === "text") renderLayers();
  });
  $("fdProps").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"), x = find(sel); if (!b || !x) return;
    const a = b.dataset.act;
    if (a === "done") { select(null); return; }
    if (a === "fx") update(x.id, { fx: !x.fx });
    if (a === "fy") update(x.id, { fy: !x.fy });
    if (a === "centre") update(x.id, { x: 50, y: 50 });
    if (a === "namesColour") update(x.id, { color: "" });
    if (a === "dup") duplicate();
    if (a === "del") remove();
  });
  function duplicate() {
    const x = find(sel); if (!x) return;
    if (layers().length >= MAX_LAYERS) { ctx.toast(`A card can have up to ${MAX_LAYERS} items.`); return; }
    const copy = { ...x, id: newId(), x: x.x + 4, y: x.y + 4, lock: false };
    const list = [...layers()]; list.splice(list.indexOf(x) + 1, 0, copy); commit(list); select(copy.id);
    ctx.announce(`${layerLabel(x)} duplicated`);
  }
  function remove() {
    const x = find(sel); if (!x) return;
    commit(layers().filter((y) => y.id !== x.id)); sel = null; refresh(true);
    ctx.toast(`${layerLabel(x)} deleted. Undo brings it back.`);
  }

  function select(id) {
    sel = id && find(id) ? id : null;
    refresh(true); decorate();
  }
  /** Brings the panel up to date: redraws the list and properties when what they show has changed. */
  function refresh(force) {
    $("fdOn").checked = on; $("fdTools").hidden = !on;
    if (sel && !find(sel)) sel = null;
    const list = shown(), sig = JSON.stringify(list.map((x) => [x.id, layerLabel(x), x.hide, x.lock, x.back, x.id === sel]));
    if (force || sig !== layersSig) renderLayers();
    const x = find(sel);
    if (force || (x ? x.id + x.type : "") !== propsFor) renderProps(); else fillProps();
    $("fdCount").textContent = list.length ? `${list.length} of ${MAX_LAYERS}` : "";
  }

  /* ---------- on the preview: selection box, handles and guides ---------- */
  const card = () => $("designCard").querySelector(".card");
  const inner = () => $("designCard").querySelector(".card-inner");
  function decorate() {
    const host = $("designCard");
    host.classList.toggle("fd-on", on);
    host.querySelector(".fd-overlay")?.remove();
    if (!on) return;
    const c = card(), ci = inner(); if (!c || !ci) return;
    const ov = document.createElement("div");
    ov.className = "fd-overlay";
    ov.style.cssText = `left:${ci.offsetLeft}px;top:${ci.offsetTop}px;width:${ci.offsetWidth}px;height:${ci.offsetHeight}px`;
    const x = find(sel), el = x && ci.querySelector(`.ly[data-id="${x.id}"]`);
    if (x && el) {
      const inv = 1 / (parseFloat(getComputedStyle($("pvScale")).transform.split(",")[3]) || 1);   // keep handles finger-sized when the preview is scaled down
      ov.innerHTML = `<div class="fd-sel${x.lock ? " locked" : ""}" style="left:${x.x}%;top:${x.y}%;width:${el.offsetWidth}px;height:${el.offsetHeight}px;transform:translate(-50%,-50%) rotate(${x.rot}deg);--k:${inv.toFixed(3)}">
        ${x.lock ? "" : `<span class="fd-h nw" data-h="resize"></span><span class="fd-h ne" data-h="resize"></span><span class="fd-h sw" data-h="resize"></span><span class="fd-h se" data-h="resize"></span><span class="fd-rot" data-h="rotate"></span>`}</div>`;
    }
    c.style.position = "relative";
    c.appendChild(ov);
  }

  // where a pointer is, as % of the card
  const pct = (e) => { const r = inner().getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, r }; };
  let act = null;                  // the current drag: move, resize, rotate or pinch
  const pointers = new Map();
  $("designCard").addEventListener("pointerdown", (e) => {
    if (!on) return;
    // a second finger anywhere turns the drag into a pinch: spread to resize, twist to turn
    if (act && pointers.size === 1 && !pointers.has(e.pointerId)) {
      e.preventDefault(); e.stopPropagation();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); $("designCard").setPointerCapture(e.pointerId);
      const [a, b] = [...pointers.values()], cur = { ...act.start, ...act.patch };
      act = { ...act, kind: "pinch", start: cur, patch: null, d0: Math.hypot(b.x - a.x, b.y - a.y), a0: Math.atan2(b.y - a.y, b.x - a.x) };
      return;
    }
    const handle = e.target.closest("[data-h]"), item = e.target.closest(".ly");
    if (!handle && !item) { if (e.target.closest(".card")) { if (sel) select(null); } return; }
    const id = handle ? sel : item.dataset.id, x = find(id);
    if (!x) return;
    if (x.lock) { select(id); return; }
    e.preventDefault(); e.stopPropagation();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    $("designCard").setPointerCapture(e.pointerId);
    if (sel !== id) select(id);
    const p = pct(e), el = inner().querySelector(`.ly[data-id="${id}"]`);
    const r = inner().getBoundingClientRect();
    const base = { id, start: { ...x }, p0: p, el, r, hPct: (el.offsetHeight / inner().offsetHeight) * 100 };
    const cx = r.left + (x.x / 100) * r.width, cy = r.top + (x.y / 100) * r.height;
    if (handle?.dataset.h === "resize") act = { ...base, kind: "resize", cx, cy, d0: Math.hypot(e.clientX - cx, e.clientY - cy) };
    else if (handle?.dataset.h === "rotate") act = { ...base, kind: "rotate", cx, cy, a0: Math.atan2(e.clientY - cy, e.clientX - cx) };
    else act = { ...base, kind: "move" };
  }, true);
  $("designCard").addEventListener("pointermove", (e) => {
    if (!act) return;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = act.start; let patch = {};
    const guides = [];
    if (act.kind === "move") {
      const p = pct(e); let nx = s.x + (p.x - act.p0.x), ny = s.y + (p.y - act.p0.y);
      if (snapOn && !e.altKey) {
        // the item's centre and edges snap to the card's centre and edges, and to other items' centres and edges
        const hw = s.w / 2, hh = act.hPct / 2, others = layers().filter((o) => o.id !== s.id && !o.hide);
        const lx = [0, 50, 100, ...others.flatMap((o) => [o.x, o.x - o.w / 2, o.x + o.w / 2])];
        const ly = [0, 50, 100, ...others.map((o) => o.y)];
        const best = (v, half, lines) => {
          let b = null;
          for (const off of [0, -half, half]) for (const t of lines) { const d = Math.abs(v + off - t); if (d < SNAP && (!b || d < b.d)) b = { d, v: t - off, line: t }; }
          return b;
        };
        const bx = best(nx, hw, lx), by = best(ny, hh, ly);
        if (bx) { nx = bx.v; guides.push(["v", bx.line]); }
        if (by) { ny = by.v; guides.push(["h", by.line]); }
      }
      patch = { x: round(nx, 2), y: round(ny, 2) };
    } else if (act.kind === "resize") {
      const d = Math.hypot(e.clientX - act.cx, e.clientY - act.cy);
      patch = { w: round(Math.min(200, Math.max(2, (s.w * d) / Math.max(1, act.d0))), 2) };
    } else if (act.kind === "rotate") {
      let a = s.rot + ((Math.atan2(e.clientY - act.cy, e.clientX - act.cx) - act.a0) * 180) / Math.PI;
      a = ((a + 540) % 360) - 180;
      const step = e.shiftKey ? 15 : 0, near = [0, 90, -90, 180, -180, 45, -45, 135, -135].find((t) => Math.abs(a - t) < 3);
      if (step) a = Math.round(a / step) * step; else if (snapOn && near !== undefined) a = near;
      patch = { rot: Math.round(a) };
    } else if (act.kind === "pinch" && pointers.size >= 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      let rot = s.rot + ((ang - act.a0) * 180) / Math.PI; rot = ((rot + 540) % 360) - 180;
      patch = { w: round(Math.min(200, Math.max(2, (s.w * d) / Math.max(1, act.d0))), 2), rot: Math.round(rot) };
    }
    act.patch = { ...act.patch, ...patch };
    // move the item and its box directly; the card is redrawn properly when the drag ends
    const x = { ...s, ...act.patch }, el = act.el, box = $("designCard").querySelector(".fd-sel");
    const t = `translate(-50%,-50%) rotate(${x.rot}deg)`;
    el.style.left = x.x + "%"; el.style.top = x.y + "%"; el.style.width = x.w + "%";
    el.style.transform = t + (x.fx || x.fy ? ` scale(${x.fx ? -1 : 1},${x.fy ? -1 : 1})` : "");
    if (box) { box.style.left = x.x + "%"; box.style.top = x.y + "%"; box.style.width = el.offsetWidth + "px"; box.style.height = el.offsetHeight + "px"; box.style.transform = t; }
    const ov = $("designCard").querySelector(".fd-overlay");
    ov?.querySelectorAll(".fd-guide").forEach((g) => g.remove());
    for (const [dir, at] of guides) ov?.insertAdjacentHTML("beforeend", `<span class="fd-guide ${dir}" style="${dir === "v" ? "left" : "top"}:${at}%"></span>`);
  }, true);
  const endAct = (e) => {
    pointers.delete(e.pointerId);
    if (!act) return;
    if (act.kind === "pinch" && pointers.size === 1) { const a = act; act = null; pointers.clear(); if (a.patch) update(a.id, a.patch); refresh(); decorate(); return; }   // lifting one finger ends the pinch
    const a = act; act = null; pointers.clear();
    if (a.patch) update(a.id, a.patch);
    refresh(); decorate();
  };
  $("designCard").addEventListener("pointerup", endAct, true);
  $("designCard").addEventListener("pointercancel", endAct, true);

  // Keyboard: arrows nudge the selected item, Delete removes it, Escape lets go.
  document.addEventListener("keydown", (e) => {
    if (!on || !sel) return;
    const inField = e.target.matches("input:not([type=checkbox]):not([type=range]), textarea, select");
    const inScope = e.target.closest("#fdBox, #designCard, #pvFrame") || e.target === document.body;
    if (!inScope || inField) return;
    const x = find(sel); if (!x) return;
    const step = e.shiftKey ? 5 : 0.5, mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv && !e.target.closest(".drag-handle") && !x.lock) { e.preventDefault(); update(x.id, { x: round(x.x + mv[0], 2), y: round(x.y + mv[1], 2) }); fillProps(); decorate(); }
    else if ((e.key === "Delete" || e.key === "Backspace") && !e.target.closest(".drag-handle")) { e.preventDefault(); remove(); }
    else if (e.key === "Escape") select(null);
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(); }
  });

  renderLib();
  return {
    decorate,
    refresh: () => refresh(false),
    get on() { return on; },
    get selected() { return sel; },
    init() { if (layers().length && !on) setOn(true); else setOn(on); },
  };
}
