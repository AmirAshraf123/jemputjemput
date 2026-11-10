// The invitation editor: design, photo, templates and guest list.
import { sb, requireUser, signOut, $, toast, isConfigured, showSetupNotice } from "./sb.js";
import {
  esc, clamp, FONTS, PRESETS, presetById, cleanStyle, cleanPhoto, cleanDetails, imgCSS, SHAPE_DEF,
  cardHTML, thumbHTML, photoUrl, watchPhotos, fmtDate,
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
let filter = "all", confirmDel = null, confirmTpl = null, confirmPhoto = false;
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
    setupFontSelects(); setupGroup();
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
  if (name === "guests") renderGroup(); // keeps the group message in step with any name or date changes
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
  const opts = Object.entries(FONTS).map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join("");
  for (const sel of [$("sNameFont"), $("sBodyFont")]) {
    sel.innerHTML = opts;
    for (const o of sel.options) { o.style.fontFamily = FONTS[o.value][1]; o.style.fontStyle = FONTS[o.value][2] || "normal"; }
  }
}
const initials = () => `${(inv.details.name1 || "A")[0]}&${(inv.details.name2 || "B")[0]}`;
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
  $("oNameSize").textContent = s.nameSize + "px"; $("oBodySize").textContent = s.bodySize + "px"; $("oRadius").textContent = s.radius + "px";
}
function fillForm() {
  for (const el of document.querySelectorAll("#designForm [data-k]")) if (el !== document.activeElement) el.value = inv.details[el.dataset.k] ?? "";
  fillStyle(); renderTemplates(); fillPhoto();
}
function renderDesign() { $("designCard").innerHTML = cardHTML(inv); }

$("designForm").addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.k) {
    inv.details = cleanDetails({ ...inv.details, [t.dataset.k]: t.value });
    if (t.dataset.k === "name1" || t.dataset.k === "name2") renderTemplates();
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
    const top = p.mode === "top";
    $("pShapeWrap").hidden = !top; $("pSizeRow").hidden = !top; $("matchFrame").hidden = !top; $("pFadeWrap").hidden = top;
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
  const who = [d.name1, d.name2].filter(Boolean).join(" & ") || "We";
  const when = fmtDate(d.date), by = fmtDate(d.rsvpBy);
  return `${who} would love for you to join their wedding${when ? " on " + when : ""}! Tap the link to see the invitation and reply${by ? " by " + by : ""}. One reply per household, please: ${groupLink()}`;
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
  const who = [d.name1, d.name2].filter(Boolean).join(" & ") || "We";
  const when = fmtDate(d.date), by = fmtDate(d.rsvpBy);
  return `Hi ${g.name}! ${who} would love for you to join their wedding${when ? " on " + when : ""}. Here's your invitation${by ? ", please reply by " + by : ""}: ${guestLink(g)}`;
}
async function loadGuests() {
  const { data, error } = await sb.from("guests").select("*").eq("invitation_id", inv.id).order("created_at");
  if (error) { toast("Couldn't load guests: " + error.message); return; }
  guests = data; renderGuests();
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
  $("stats").innerHTML = [
    ["", guests.length, "invitations"], ["", seats, "seats offered"], ["yes", coming, "people coming"],
    ["wait", waiting, "still to reply"], ["no", declined, "can't make it"],
  ].map(([c, n, l]) => `<div class="stat ${c}"><b>${n}</b><span>${l}</span></div>`).join("");
}
function renderGuests() {
  renderStats();
  const dups = guests.filter((g) => g.dup_reason);
  $("dupChip").hidden = !dups.length;
  $("dupChip").textContent = `Possible duplicates (${dups.length})`;
  if (filter === "dup" && !dups.length) filter = "all";
  const list = guests.filter((g) => filter === "all" || (filter === "dup" ? g.dup_reason : g.status === filter));
  for (const c of $("filters").querySelectorAll(".chip")) c.setAttribute("aria-pressed", String(c.dataset.f === filter));
  if (!list.length) {
    $("gBody").innerHTML = `<tr><td colspan="6" class="empty">${guests.length ? "No guests match this filter." : "No guests yet. Add the first household above."}</td></tr>`;
    return;
  }
  const label = { yes: "Coming", no: "Can't make it", pending: "Waiting" };
  $("gBody").innerHTML = list.map((g) => {
    const wa = waNumber(g.phone);
    return `<tr>
      <td><b>${esc(g.name)}</b>${g.source === "group" ? ` <span class="tag">Group link</span>` : ""}${g.phone ? `<div class="sub">${esc(g.phone)}</div>` : ""}
        ${g.dup_reason ? `<div class="dup"><span>Possible duplicate: ${esc(g.dup_reason)}</span> <button class="linkbtn" data-act="notdup" data-id="${g.id}">Not a duplicate</button></div>` : ""}</td>
      <td>${esc(g.side)}</td>
      <td class="num">${g.status === "yes" ? `${g.coming} of ${g.seats}` : g.seats}</td>
      <td><span class="pill ${esc(g.status)}">${label[g.status] || "Waiting"}</span></td>
      <td>${g.dietary ? `<div>${esc(g.dietary)}</div>` : ""}${g.note ? `<div class="sub">“${esc(g.note)}”</div>` : ""}</td>
      <td><div class="acts">
        ${wa ? `<a class="btn sm" href="https://wa.me/${wa}?text=${encodeURIComponent(inviteText(g))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        <button class="btn sm ghost" data-act="copy" data-id="${g.id}">Copy message</button>
        <a class="btn sm ghost" href="${esc(guestLink(g))}/preview" target="_blank" rel="noopener">Preview</a>
        <button class="btn sm ${confirmDel === g.id ? "danger" : "ghost"}" data-act="del" data-id="${g.id}">${confirmDel === g.id ? "Confirm remove" : "Remove"}</button>
      </div></td></tr>`;
  }).join("");
}
$("filters").addEventListener("click", (e) => {
  const b = e.target.closest(".chip"); if (!b) return;
  filter = b.dataset.f;
  for (const c of $("filters").querySelectorAll(".chip")) c.setAttribute("aria-pressed", String(c === b));
  renderGuests();
});
$("gBody").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-act]"); if (!b) return;
  const g = guests.find((x) => x.id === b.dataset.id); if (!g) return;
  if (b.dataset.act === "copy") {
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
$("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const row = {
    invitation_id: inv.id, name: $("gName").value.trim(), phone: $("gPhone").value.trim(),
    seats: Math.round(clamp($("gSeats").value, 1, 50, 2)), side: $("gSide").value,
  };
  if (!row.name) return;
  const { data, error } = await sb.from("guests").insert(row).select("*").single();
  if (error) { toast("Couldn't add guest: " + error.message); return; }
  if (!guests.some((g) => g.id === data.id)) guests.push(data);
  renderGuests();
  $("gName").value = ""; $("gPhone").value = ""; $("gSeats").value = 2; $("gName").focus();
  toast(`Added ${row.name}`);
});
$("csv").addEventListener("click", () => {
  const head = ["Name", "Phone", "Side", "Seats", "Reply", "Coming", "Dietary", "Note", "Replied at", "Added by", "Possible duplicate", "Invitation link"];
  const label = { yes: "Coming", no: "Can't make it", pending: "Waiting" };
  const rows = guests.map((g) => [g.name, g.phone, g.side, g.seats, label[g.status], g.coming, g.dietary, g.note,
  g.responded_at ? new Date(g.responded_at).toLocaleString("en-SG") : "", g.source === "group" ? "Group link" : "You",
  g.dup_reason || "", guestLink(g)]);
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
  const d = inv.details;
  a.download = `guest-list-${[d.name1, d.name2].filter(Boolean).join("-") || "wedding"}.csv`.replace(/[^\w.-]+/g, "-");
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

init();
