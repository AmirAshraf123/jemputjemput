// The page a guest opens from their personal link: invite.html?g=<token>
import { sb, $, toast } from "./sb.js";
import { cardHTML, cleanDetails, esc, fmtDate, timeRange, watchPhotos } from "./card.js";

const params = new URLSearchParams(location.search);
const [hashToken, hashFlag] = location.hash.slice(1).split("/");
const token = (hashToken || params.get("g") || "").replace(/[^a-f0-9]/gi, "");
const preview = hashFlag === "preview" || params.has("preview");
let inv = null, guest = null, draft = null;

watchPhotos();
$("previewNote").hidden = !preview;

if (!token) notFound();
else {
  const { data, error } = await sb.rpc("get_invite", { p_token: token });
  if (error || !data) notFound(error);
  else {
    inv = data.invitation; guest = data.guest;
    const d = cleanDetails(inv.details);
    document.title = `You're invited · ${[d.name1, d.name2].filter(Boolean).join(" & ")}`;
    render();
  }
}

function notFound(err) {
  $("card").innerHTML = `<div class="empty"><h2 style="font-family:var(--display);font-weight:400;font-size:32px;margin:0 0 8px">We couldn't find this invitation</h2>
    <p>${err ? "Something went wrong loading it. Please try again in a moment." : "The link may be incomplete. Please check you copied the whole link, or ask the couple to send it again."}</p></div>`;
}

function calLink(d) {
  if (!d.date) return "";
  const day = d.date.replace(/-/g, ""), t = (x) => (x || "00:00").replace(":", "") + "00";
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(`Wedding of ${d.name1} & ${d.name2}`)
    + `&dates=${day}T${t(d.start)}/${day}T${t(d.end || d.start)}&ctz=Asia/Singapore&location=` + encodeURIComponent([d.venue, d.address].filter(Boolean).join(", "));
}

function render() {
  const d = cleanDetails(inv.details);
  $("card").innerHTML = cardHTML(inv, guest.name);
  const place = [d.venue, d.address].filter(Boolean).join(", ");
  const map = place ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(place) : "";
  $("details").hidden = false;
  $("details").innerHTML = `<dl>
      ${d.date ? `<dt>Date</dt><dd>${esc(fmtDate(d.date))}</dd>` : ""}
      ${timeRange(d) ? `<dt>Time</dt><dd>${esc(timeRange(d))}</dd>` : ""}
      ${d.venue || d.address ? `<dt>Venue</dt><dd>${esc(d.venue)}${d.address ? `<div class="sub">${esc(d.address)}</div>` : ""}</dd>` : ""}
      ${d.dress ? `<dt>Dress</dt><dd>${esc(d.dress)}</dd>` : ""}
    </dl>
    <div class="links">${map ? `<a class="btn ghost sm" href="${map}" target="_blank" rel="noopener">Open in Maps</a>` : ""}
    ${d.date ? `<a class="btn ghost sm" href="${calLink(d)}" target="_blank" rel="noopener">Add to Google Calendar</a>` : ""}</div>`;
  renderRsvp();
}

function renderRsvp() {
  const el = $("rsvp"); el.hidden = false;
  const d = cleanDetails(inv.details), g = guest;
  if (g.status !== "pending" && !draft) {
    el.innerHTML = `<div class="thanks"><h3>${g.status === "yes" ? "See you there!" : "Thank you for letting us know"}</h3>
      <p class="sub">${g.status === "yes" ? `We've saved ${g.coming} ${g.coming === 1 ? "seat" : "seats"} for you.` : "You'll be missed."}</p>
      <button class="btn ghost" id="change">Change my reply</button></div>`;
    $("change").onclick = () => { draft = { status: g.status, coming: g.coming || 1, dietary: g.dietary || "", note: g.note || "" }; renderRsvp(); };
    return;
  }
  const seats = Math.max(1, g.seats);
  draft ||= { status: "", coming: seats, dietary: "", note: "" };
  el.innerHTML = `<h3>Will you join us?</h3>
    ${d.rsvpBy ? `<p class="sub" style="margin:0">Please reply by ${esc(fmtDate(d.rsvpBy))}.</p>` : ""}
    <div class="choice"><button type="button" class="y" data-s="yes" aria-pressed="${draft.status === "yes"}">Joyfully accept</button>
      <button type="button" class="n" data-s="no" aria-pressed="${draft.status === "no"}">Regretfully decline</button></div>
    <div ${draft.status === "yes" ? "" : "hidden"} style="display:grid;gap:12px">
      <label class="f">How many of you are coming? <span class="sub">(${seats} ${seats === 1 ? "seat" : "seats"} reserved for you)</span>
        <select id="rComing">${Array.from({ length: seats }, (_, i) => `<option ${i + 1 === +draft.coming ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label>
      <label class="f">Dietary needs<input id="rDiet" maxlength="200" value="${esc(draft.dietary)}" placeholder="e.g. vegetarian, no seafood"></label>
    </div>
    <label class="f">A note for the couple (optional)<textarea id="rNote" maxlength="500">${esc(draft.note)}</textarea></label>
    <button class="btn" id="rSend" ${draft.status && !preview ? "" : "disabled"}>${preview ? "Sending is off in preview" : "Send reply"}</button>`;
  el.querySelector(".choice").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; readDraft(); draft.status = b.dataset.s; renderRsvp(); };
  $("rSend").onclick = send;
}

function readDraft() {
  const c = $("rComing"), di = $("rDiet"), n = $("rNote");
  if (c) draft.coming = +c.value; if (di) draft.dietary = di.value; if (n) draft.note = n.value;
}

async function send() {
  if (preview) return;
  readDraft(); $("rSend").disabled = true; $("rSend").textContent = "Sending…";
  const { data, error } = await sb.rpc("submit_rsvp", {
    p_token: token, p_status: draft.status, p_coming: draft.coming, p_dietary: draft.dietary.trim(), p_note: draft.note.trim(),
  });
  if (error) { $("rSend").disabled = false; $("rSend").textContent = "Send reply"; toast("Couldn't send your reply. Please try again."); return; }
  guest = { ...guest, ...data }; draft = null; renderRsvp(); toast("Reply sent. Thank you!");
}
