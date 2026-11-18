import { sb, requireUser, signOut, $, toast, isConfigured, showSetupNotice } from "./sb.js";
import { thumbHTML, cleanDetails, cleanStyle, fmtDate, esc, PRESETS, presetById, OCCASIONS, eventTitle, initialsFor, defaultDetailsFor, mainEvent, eventsOf } from "./card.js";

if (!isConfigured) showSetupNotice();
const user = await requireUser();
let invs = [], confirmDel = null;

if (user) {
  $("who").textContent = user.email || "";
  $("signOut").onclick = signOut;
  if (!(await fromDraft())) await load();
}

// A card started on the home page before signing in: make it a real invitation and open it.
async function fromDraft() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem("jemput.draft") || "null"); } catch { }
  if (!d?.ready || !OCCASIONS[d.occasion]) return false;
  try { localStorage.removeItem("jemput.draft"); } catch { }
  const occ = OCCASIONS[d.occasion], tpl = presetById(d.template) ? d.template : occ.template;
  const details = cleanDetails({ ...defaultDetailsFor(d.occasion), name1: String(d.name1 || ""), name2: String(d.name2 || ""), date: String(d.date || "") });
  const { data, error } = await sb.from("invitations").insert({ template: tpl, style: presetById(tpl).style, details }).select("id").single();
  if (error) { toast("Couldn't save the card you started: " + error.message); return false; }
  location.href = `edit.html#${data.id}`;
  return true;
}

async function load() {
  const { data, error } = await sb.from("invitations")
    .select("id, template, details, style, updated_at, guests(status, coming, seats)")
    .order("updated_at", { ascending: false });
  if (error) { $("invs").innerHTML = `<p class="empty">Couldn't load your invitations: ${esc(error.message)}</p>`; return; }
  invs = data;
  render();
}

function render() {
  if (!invs.length) {
    $("invs").innerHTML = `<div class="empty" style="grid-column:1/-1"><p>No invitations yet.</p><button type="button" class="btn" id="emptyNew">Make your first invitation</button></div>`;
    $("emptyNew").onclick = () => $("newInv").click();
    return;
  }
  $("invs").innerHTML = invs.map((inv) => {
    const d = cleanDetails(inv.details), s = cleanStyle(inv.style);
    const g = inv.guests || [];
    const coming = g.filter((x) => x.status === "yes").reduce((a, x) => a + (x.coming || 0), 0);
    const waiting = g.filter((x) => x.status === "pending").length, replied = g.length - waiting;
    // the one thing to do next on this invitation
    const occ = OCCASIONS[d.occasion];
    const next = !(d.name1 && (!occ.two || d.name2)) ? ["Add the names", ""]
      : !mainEvent(d).date ? ["Add the date", ""]
        : !g.length ? ["Add guests", "/guests"]
          : waiting ? [`${waiting} still to reply · send a reminder`, "/guests"]
            : ["Everyone has replied · see the list", "/guests"];
    const names = (d.name1 || d.name2) ? eventTitle(d) : `Untitled ${OCCASIONS[d.occasion].label.toLowerCase()}`;
    const ini = initialsFor(d);
    return `<article class="inv">
      <a class="open" href="edit.html#${inv.id}">
        ${thumbHTML(s, "", ini)}
        <h2 class="inv-title">${esc(names)}</h2>
        <div class="meta"><span>${esc(fmtDate(mainEvent(d).date) || "No date yet")}</span>${eventsOf(d).length ? `<span>${eventsOf(d).length} events</span>` : ""}</div>
        <div class="meta"><span>${g.length} invited</span><span>${coming} coming</span><span>${replied} of ${g.length} replied</span></div>
        ${g.length ? `<div class="bar" role="img" aria-label="${replied} of ${g.length} replied"><i style="width:${Math.round((replied / g.length) * 100)}%"></i></div>` : ""}
      </a>
      <a class="next" href="edit.html#${inv.id}${next[1]}">${esc(next[0])}</a>
      <div class="foot"><button class="btn sm ${confirmDel === inv.id ? "danger" : "ghost"}" data-del="${inv.id}">${confirmDel === inv.id ? "Delete for good" : "Delete"}</button></div>
    </article>`;
  }).join("");
}

$("invs").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-del]");
  if (!b) return;
  const id = b.dataset.del;
  if (confirmDel !== id) { confirmDel = id; render(); return; }
  confirmDel = null;
  // remove this invitation's photos, then the invitation (guests go with it)
  const folder = `${user.id}/${id}`;
  const { data: files } = await sb.storage.from("photos").list(folder);
  if (files?.length) await sb.storage.from("photos").remove(files.map((f) => `${folder}/${f.name}`));
  const { error } = await sb.from("invitations").delete().eq("id", id);
  if (error) { toast("Couldn't delete: " + error.message); return; }
  invs = invs.filter((x) => x.id !== id); render(); toast("Invitation deleted");
});

// New invitation: pick the occasion first, so the wording and template start out right.
$("occGrid").innerHTML = Object.entries(OCCASIONS).map(([k, o]) => {
  const t = presetById(o.template);
  return `<button type="button" class="tpl occ" data-o="${k}">${thumbHTML(t.style, o.label, initialsFor({ ...defaultDetailsFor(k), name1: o.two ? "" : o.label }))}</button>`;
}).join("");
$("newInv").addEventListener("click", () => {
  const open = $("newPicker").hidden;
  $("newPicker").hidden = !open;
  $("newInv").setAttribute("aria-expanded", String(open));
  $("newInv").textContent = open ? "Cancel" : "New invitation";
  if (open) $("occGrid").querySelector("button")?.focus();
});
$("occGrid").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-o]"); if (!b) return;
  const occ = OCCASIONS[b.dataset.o];
  for (const x of $("occGrid").querySelectorAll("button")) x.disabled = true;
  const { data, error } = await sb.from("invitations")
    .insert({ template: occ.template, style: presetById(occ.template).style, details: defaultDetailsFor(b.dataset.o) })
    .select("id").single();
  if (error) { for (const x of $("occGrid").querySelectorAll("button")) x.disabled = false; toast("Couldn't create it: " + error.message); return; }
  location.href = `edit.html#${data.id}/start`;   // the editor opens with a short guided start
});


/* ---------- delete my account: files first, then the account (which takes everything else with it) ---------- */
$("delConfirm").addEventListener("input", (e) => { $("delAccount").disabled = e.target.value.trim().toUpperCase() !== "DELETE"; });
$("delAccount").addEventListener("click", async () => {
  const btn = $("delAccount"); btn.disabled = true; btn.textContent = "Deleting…";
  try {
    // every photo and music file is stored under <your id>/<invitation id>/
    const bucket = sb.storage.from("photos"), paths = [];
    const { data: top } = await bucket.list(user.id, { limit: 1000 });
    for (const f of top || []) {
      if (f.id) { paths.push(`${user.id}/${f.name}`); continue; }   // a file at the top level
      const { data: inner } = await bucket.list(`${user.id}/${f.name}`, { limit: 1000 });
      for (const x of inner || []) paths.push(`${user.id}/${f.name}/${x.name}`);
    }
    for (let i = 0; i < paths.length; i += 100) await bucket.remove(paths.slice(i, i + 100));
    const { error } = await sb.rpc("delete_my_account");
    if (error) {
      toast(/could not find|function/i.test(error.message)
        ? "Deleting accounts needs a one-time database update: run supabase/006_safety_and_checkin.sql in Supabase's SQL Editor."
        : "Couldn't delete your account: " + error.message);
      btn.disabled = false; btn.textContent = "Delete everything"; return;
    }
    try { for (const k of Object.keys(localStorage)) if (k.startsWith("jemput.")) localStorage.removeItem(k); } catch { }
    await sb.auth.signOut().catch(() => { });
    location.href = "index.html#deleted";
  } catch (err) {
    toast("Couldn't delete your account. Check your connection and try again.");
    btn.disabled = false; btn.textContent = "Delete everything";
  }
});