// Guests tab: which events each guest is invited to, their answer for each, and totals per event.
import { $, sb, toast } from "./sb.js";
import { esc, eventsOf, fmtDate, timeRange } from "./card.js";

/** The events a guest is invited to: the ones on their list that still exist. No list (or none left) means all of them. */
export function invitedOf(details, g) {
  const all = eventsOf(details);
  const mine = Array.isArray(g?.events) ? all.filter((e) => g.events.includes(e.id)) : [];
  return mine.length ? mine : all;
}
/** A guest's answer for one event. Replies from before the events were set up count for every event. */
export function replyFor(g, e) {
  const r = g.replies?.[e.id];
  if (r && (r.s === "yes" || r.s === "no")) return { s: r.s, n: r.s === "yes" ? +r.n || 1 : 0 };
  if (g.status !== "pending" && !Object.keys(g.replies || {}).length) return { s: g.status, n: g.status === "yes" ? g.coming : 0 };
  return { s: "pending", n: 0 };
}
const shortName = (e, i) => e.name.trim() || `Event ${i + 1}`;

/** ctx: { inv(), guests(), renderGuests(), saveDetails(patch) } */
export function setupGuestEvents(ctx) {
  let dbReady = null;        // false until the events database update (007) has been run
  let editing = null;        // the guest whose events are being changed
  let evFilter = "";         // show only guests invited to this event

  // one quick check: does the guests table have the new columns yet?
  async function checkDb() {
    const { error } = await sb.from("guests").select("events, replies").limit(1);
    dbReady = !error;
    render();
  }
  const evs = () => eventsOf(ctx.inv().details);
  const indexOf = (e) => ctx.inv().details.events.findIndex((x) => x.id === e.id);

  /* the "Invited to" boxes when adding a guest */
  function renderAdd() {
    const list = evs(), box = $("gEventsBox");
    box.hidden = !list.length;
    if (!list.length) return;
    const was = new Set([...$("gEvents").querySelectorAll("input:not(:checked)")].map((x) => x.value));
    $("gEvents").innerHTML = list.map((e) => `<label class="chk"><input type="checkbox" value="${esc(e.id)}"${was.has(e.id) ? "" : " checked"}> ${esc(shortName(e, indexOf(e)))}</label>`).join("");
  }
  /** null (all events) or the ids ticked */
  function chosen() {
    const list = evs(); if (!list.length) return undefined;
    const ids = [...$("gEvents").querySelectorAll("input:checked")].map((x) => x.value);
    return ids.length && ids.length < list.length ? ids : null;
  }

  /* totals per event, under the main totals */
  function renderStats() {
    const list = evs(), guests = ctx.guests();
    $("evStats").hidden = !list.length;
    if (!list.length) return;
    $("evStats").innerHTML = list.map((e) => {
      const inv = guests.filter((g) => invitedOf(ctx.inv().details, g).some((x) => x.id === e.id));
      const rs = inv.map((g) => replyFor(g, e));
      const coming = rs.reduce((a, r) => a + r.n, 0), waiting = rs.filter((r) => r.s === "pending").length, no = rs.filter((r) => r.s === "no").length;
      return `<div class="ev-stat"><b>${esc(shortName(e, indexOf(e)))}</b><span class="sub">${esc([fmtDate(e.date), timeRange(e)].filter(Boolean).join(" · "))}</span>
        <span><b class="yes">${coming}</b> coming · ${waiting} waiting · ${no} can't · ${inv.length} invited</span></div>`;
    }).join("");
  }

  /* "Show event" filter */
  function renderFilter() {
    const list = evs();
    $("evFilterWrap").hidden = list.length < 2;
    if (evFilter && !list.some((e) => e.id === evFilter)) evFilter = "";
    $("evFilter").innerHTML = `<option value="">All events</option>` + list.map((e) => `<option value="${esc(e.id)}"${e.id === evFilter ? " selected" : ""}>${esc(shortName(e, indexOf(e)))}</option>`).join("");
  }
  $("evFilter").addEventListener("change", (e) => { evFilter = e.target.value; ctx.renderGuests(); });
  const keep = (g) => !evFilter || invitedOf(ctx.inv().details, g).some((e) => e.id === evFilter);

  /* in each guest's row: their answer per event, and a way to change which events they're invited to */
  function rowHTML(g) {
    const list = evs(); if (!list.length) return "";
    const mine = invitedOf(ctx.inv().details, g), label = { yes: "Coming", no: "Can't", pending: "Waiting" };
    const chips = mine.map((e) => {
      const r = replyFor(g, e);
      return `<li><span class="ev-n">${esc(shortName(e, indexOf(e)))}</span> <span class="pill ${r.s}">${r.s === "yes" ? `${r.n} coming` : label[r.s]}</span></li>`;
    }).join("");
    const ed = editing === g.id ? `<fieldset class="ev-pick" id="evPick-${g.id}"><legend class="vh">Events ${esc(g.name)} is invited to</legend>
        ${list.map((e) => `<label class="chk"><input type="checkbox" data-evg="${g.id}" value="${esc(e.id)}"${mine.some((x) => x.id === e.id) ? " checked" : ""}> ${esc(shortName(e, indexOf(e)))}</label>`).join("")}
        <button type="button" class="btn sm" data-act="evdone" data-id="${g.id}">Done</button></fieldset>` : "";
    return `<ul class="ev-replies">${chips}</ul>${list.length > 1 && !ed ? `<button type="button" class="linkbtn" data-act="events" data-id="${g.id}" aria-label="Change which events ${esc(g.name)} is invited to">Invited to ${mine.length === list.length ? "all events" : mine.length + " of " + list.length}</button>` : ""}${ed}`;
  }
  async function saveGuestEvents(g, ids) {
    if (dbReady === false) { toast("Choosing events per guest needs a one-time database update: run supabase/007_events.sql in Supabase."); return; }
    const value = ids.length && ids.length < evs().length ? ids : null;
    const { error } = await sb.from("guests").update({ events: value }).eq("id", g.id);
    if (error) { toast("Couldn't save: " + error.message); return; }
    g.events = value;
  }
  $("gBody").addEventListener("change", async (e) => {
    const id = e.target.dataset.evg; if (!id) return;
    const g = ctx.guests().find((x) => x.id === id); if (!g) return;
    const ids = [...$("evPick-" + id).querySelectorAll("input:checked")].map((x) => x.value);
    if (!ids.length) { e.target.checked = true; toast("Each guest needs at least one event"); return; }
    await saveGuestEvents(g, ids);
    renderStats();
  });
  // returns true when it handled the click
  function onRowClick(act, g) {
    if (act === "events") { editing = g.id; ctx.renderGuests(); $("evPick-" + g.id)?.querySelector("input")?.focus(); return true; }
    if (act === "evdone") { editing = null; ctx.renderGuests(); document.querySelector(`[data-act="events"][data-id="${g.id}"]`)?.focus(); return true; }
    return false;
  }

  /* the group link: which events it's for */
  function renderGroup() {
    const list = evs(), d = ctx.inv().details;
    $("grpEventsBox").hidden = list.length < 2;
    if (list.length < 2) return;
    const on = d.groupEvents.length ? d.groupEvents : list.map((e) => e.id);
    $("grpEvents").innerHTML = list.map((e) => `<label class="chk"><input type="checkbox" value="${esc(e.id)}"${on.includes(e.id) ? " checked" : ""}> ${esc(shortName(e, indexOf(e)))}</label>`).join("");
  }
  $("grpEvents").addEventListener("change", (e) => {
    const ids = [...$("grpEvents").querySelectorAll("input:checked")].map((x) => x.value);
    if (!ids.length) { e.target.checked = true; toast("The group link needs at least one event"); return; }
    ctx.saveDetails({ groupEvents: ids.length === evs().length ? [] : ids });
    toast("Group link updated");
  });

  /* extra CSV columns: one per event */
  function csvHead() { return evs().flatMap((e, i) => [`${shortName(e, i)}: reply`, `${shortName(e, i)}: coming`]); }
  function csvCells(g) {
    const mine = invitedOf(ctx.inv().details, g), label = { yes: "Coming", no: "Can't make it", pending: "Waiting" };
    return evs().flatMap((e) => {
      if (!mine.some((x) => x.id === e.id)) return ["Not invited", ""];
      const r = replyFor(g, e); return [label[r.s], r.s === "yes" ? r.n : 0];
    });
  }

  function render() {
    renderAdd(); renderFilter(); renderStats(); renderGroup();
    $("evDbNote").hidden = !(dbReady === false && evs().length);
  }
  checkDb();
  return { render, rowHTML, onRowClick, chosen, keep, csvHead, csvCells, renderStats, ready: () => dbReady !== false };
}
