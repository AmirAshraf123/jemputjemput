import { sb, requireUser, signOut, $, toast, isConfigured, showSetupNotice } from "./sb.js";
import { thumbHTML, cleanDetails, cleanStyle, fmtDate, esc, PRESETS, DEFAULT_DETAILS } from "./card.js";

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
    const names = [d.name1, d.name2].filter(Boolean).join(" & ") || "Untitled invitation";
    const ini = `${(d.name1 || "A")[0]}&${(d.name2 || "B")[0]}`;
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

$("newInv").addEventListener("click", async () => {
  $("newInv").disabled = true;
  const { data, error } = await sb.from("invitations")
    .insert({ template: "songket", style: PRESETS[0].style, details: DEFAULT_DETAILS })
    .select("id").single();
  $("newInv").disabled = false;
  if (error) { toast("Couldn't create it: " + error.message); return; }
  location.href = `edit.html#${data.id}`;
});
