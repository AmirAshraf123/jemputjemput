import { sb, requireUser, signOut, $, toast, isConfigured, showSetupNotice } from "./sb.js";
import { thumbHTML, cleanDetails, cleanStyle, fmtDate, esc, PRESETS, presetById, OCCASIONS, eventTitle, initialsFor, defaultDetailsFor } from "./card.js";

if (!isConfigured) showSetupNotice();
const user = await requireUser();
let invs = [], confirmDel = null;

if (user) {
  $("who").textContent = user.email || "";
  $("signOut").onclick = signOut;
  await load();
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
    $("invs").innerHTML = `<div class="empty" style="grid-column:1/-1">You haven't made an invitation yet. Press <b>New invitation</b> to start.</div>`;
    return;
  }
  $("invs").innerHTML = invs.map((inv) => {
    const d = cleanDetails(inv.details), s = cleanStyle(inv.style);
    const g = inv.guests || [];
    const coming = g.filter((x) => x.status === "yes").reduce((a, x) => a + (x.coming || 0), 0);
    const waiting = g.filter((x) => x.status === "pending").length;
    const names = (d.name1 || d.name2) ? eventTitle(d) : `Untitled ${OCCASIONS[d.occasion].label.toLowerCase()}`;
    const ini = initialsFor(d);
    return `<article class="inv">
      <a class="open" href="edit.html#${inv.id}">
        ${thumbHTML(s, "", ini)}
        <h3>${esc(names)}</h3>
        <div class="meta"><span>${esc(fmtDate(d.date) || "No date yet")}</span></div>
        <div class="meta"><span>${g.length} invited</span><span>${coming} coming</span><span>${waiting} waiting</span></div>
      </a>
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
  location.href = `edit.html#${data.id}`;
});