// The page a guest opens.
//   Personal link: invite.html#<code>          (one guest or household)
//   Group link:    invite.html#g/<group code>   (anyone in a group chat)
// Add "/preview" to either to see it without being able to reply.
import { sb, $, toast } from "./sb.js";
import { playFall, bloom } from "./effects.js";
import { cardHTML, langSwitchHTML, cleanDetails, cleanStyle, esc, fmtDate, timeRange, watchPhotos, eventTitle, hostWord, initialsFor, musicUrl, mix } from "./card.js";

const params = new URLSearchParams(location.search);
const parts = location.hash.slice(1).split("/");
const isGroup = parts[0] === "g";
const groupToken = isGroup ? (parts[1] || "").replace(/[^a-f0-9]/gi, "") : "";
const preview = (isGroup ? parts[2] : parts[1]) === "preview" || params.has("preview");
let token = isGroup ? "" : (parts[0] || params.get("g") || "").replace(/[^a-f0-9]/gi, "");

let inv = null, guest = null, draft = null, maxSeats = 1, openingDone = false, music = null;
let lang = "";   // which language the card is showing, for two-language cards
let mode = "personal";   // "personal": replying as a known guest; "group": filling in the group form

watchPhotos();
$("previewNote").hidden = !preview;
// Opening a different invitation link in the same tab only changes the part after "#", which doesn't reload the page.
window.addEventListener("hashchange", () => location.reload());

// Remembers, on this phone only, which reply belongs to which group link, so reopening the link
// shows the earlier reply instead of a blank form. Storage can be unavailable (private browsing): then it just forgets.
const memKey = () => "jemput.group." + groupToken;
const remember = (t) => { try { localStorage.setItem(memKey(), t); } catch { } };
const recall = () => { try { return localStorage.getItem(memKey()) || ""; } catch { return ""; } };
const forget = () => { try { localStorage.removeItem(memKey()); } catch { } };

await start();

async function start() {
  if (isGroup) {
    if (!groupToken) return notFound();
    const saved = preview ? "" : recall();
    if (saved && await loadPersonal(saved)) return;
    if (saved) forget();               // the couple removed that reply; start fresh
    const { data, error } = await sb.rpc("get_group_invite", { p_token: groupToken });
    if (error || !data) return notFound(error, true);
    inv = data.invitation; maxSeats = Math.max(1, data.max_seats || 1); guest = null; mode = "group";
    setTitle(); render();
  } else {
    if (!token || !(await loadPersonal(token))) notFound();
  }
}

async function loadPersonal(t) {
  const { data, error } = await sb.rpc("get_invite", { p_token: t });
  if (error || !data) return false;
  token = t; inv = data.invitation; guest = data.guest; maxSeats = Math.max(1, guest.seats || 1); mode = "personal";
  setTitle(); render();
  return true;
}

function setTitle() {
  const d = cleanDetails(inv.details);
  document.title = `You're invited · ${eventTitle(d)}`;
}

function notFound(err, group) {
  $("details").hidden = true; $("rsvp").hidden = true;
  const why = err ? "Something went wrong loading it. Please try again in a moment."
    : group ? "This group link has been turned off or replaced. Please ask whoever sent it for the current link."
      : "The link may be incomplete. Please check you copied the whole link, or ask whoever sent it to send it again.";
  $("card").innerHTML = `<div class="empty"><h2 style="font-family:var(--display);font-weight:400;font-size:32px;margin:0 0 8px">We couldn't find this invitation</h2><p>${why}</p></div>`;
}

function calLink(d) {
  if (!d.date) return "";
  const day = d.date.replace(/-/g, ""), t = (x) => (x || "00:00").replace(":", "") + "00";
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(eventTitle(d))
    + `&dates=${day}T${t(d.start)}/${day}T${t(d.end || d.start)}&ctz=Asia/Singapore&location=` + encodeURIComponent([d.venue, d.address].filter(Boolean).join(", "));
}

/* Two-language cards: the guest picks with a button. Start with their last choice, or their phone's language if it's the second one. */
function pickLang(d) {
  if (!d.lang2) return d.lang1;
  try { const saved = localStorage.getItem("jemput.lang"); if (saved === d.lang1 || saved === d.lang2) return saved; } catch { }
  return (navigator.languages || [navigator.language || ""]).some((l) => String(l).toLowerCase().startsWith(d.lang2)) ? d.lang2 : d.lang1;
}
function renderCard() {
  const d = cleanDetails(inv.details);
  if (!lang || (lang !== d.lang1 && lang !== d.lang2)) lang = pickLang(d);
  $("langSw").innerHTML = langSwitchHTML(d, lang);
  $("card").innerHTML = cardHTML(inv, guest?.name, lang);
}
$("langSw").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lang]"); if (!b || b.dataset.lang === lang) return;
  lang = b.dataset.lang;
  try { localStorage.setItem("jemput.lang", lang); } catch { }
  renderCard();
  $("langSw").querySelector(`[data-lang="${lang}"]`)?.focus();
});

function render() {
  const d = cleanDetails(inv.details);
  renderCard();
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
  if (!openingDone) { openingDone = true; setupMusic(); setupOpening(); }
}

function renderRsvp() {
  const el = $("rsvp"); el.hidden = false;
  const d = cleanDetails(inv.details), g = guest;

  // Already replied: show the answer, with a way to change it.
  if (mode === "personal" && g.status !== "pending" && !draft) {
    el.innerHTML = `<div class="thanks"><h3>${g.status === "yes" ? "See you there!" : "Thank you for letting us know"}</h3>
      <p class="sub">${g.status === "yes" ? `We've saved ${g.coming} ${g.coming === 1 ? "seat" : "seats"} for you.` : "You'll be missed."}</p>
      <button class="btn ghost" id="change">Change my reply</button>
      ${isGroup ? `<button class="linkbtn" id="someoneElse">Not ${esc(g.name)}? Reply for someone else</button>` : ""}</div>`;
    $("change").onclick = () => { draft = { status: g.status, coming: g.coming || 1, dietary: g.dietary || "", note: g.note || "" }; renderRsvp(); };
    if (isGroup) $("someoneElse").onclick = replyForSomeoneElse;
    return;
  }

  const groupForm = mode === "group";
  draft ||= { status: "", coming: groupForm ? 1 : maxSeats, dietary: "", note: "", name: "", phone: "" };
  const seatHint = groupForm ? `(up to ${maxSeats})` : `(${maxSeats} ${maxSeats === 1 ? "seat" : "seats"} reserved for you)`;
  el.innerHTML = `<h3>Will you join us?</h3>
    ${d.rsvpBy ? `<p class="sub" style="margin:0">Please reply by ${esc(fmtDate(d.rsvpBy))}.</p>` : ""}
    ${groupForm ? `
      <label class="f">Your name<input id="rName" maxlength="120" autocomplete="name" value="${esc(draft.name)}" placeholder="e.g. Daniel Tan"></label>
      <label class="f">Your WhatsApp number<input id="rPhone" type="tel" inputmode="tel" maxlength="40" autocomplete="tel" value="${esc(draft.phone)}" placeholder="9123 4567"></label>
      <p class="hint">Your number is only shared with ${esc(hostWord(d))}, so they know who replied. Reply once per household.</p>` : ""}
    <div class="choice"><button type="button" class="y" data-s="yes" aria-pressed="${draft.status === "yes"}">Joyfully accept</button>
      <button type="button" class="n" data-s="no" aria-pressed="${draft.status === "no"}">Regretfully decline</button></div>
    <div ${draft.status === "yes" ? "" : "hidden"} style="display:grid;gap:12px">
      <label class="f">How many of you are coming? <span class="sub">${seatHint}</span>
        <select id="rComing">${Array.from({ length: maxSeats }, (_, i) => `<option ${i + 1 === +draft.coming ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label>
      <label class="f">Dietary needs<input id="rDiet" maxlength="200" value="${esc(draft.dietary)}" placeholder="e.g. vegetarian, no seafood"></label>
    </div>
    <label class="f">A note for ${esc(hostWord(d))} (optional)<textarea id="rNote" maxlength="500">${esc(draft.note)}</textarea></label>
    <p class="form-error" id="rErr" role="alert" hidden></p>
    <button class="btn" id="rSend" ${draft.status && !preview ? "" : "disabled"}>${preview ? "Sending is off in preview" : "Send reply"}</button>`;
  el.querySelector(".choice").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; readDraft(); draft.status = b.dataset.s; renderRsvp(); };
  $("rSend").onclick = groupForm ? sendGroup : send;
}

function readDraft() {
  const v = (id) => $(id)?.value;
  if ($("rComing")) draft.coming = +v("rComing");
  if ($("rDiet")) draft.dietary = v("rDiet");
  if ($("rNote")) draft.note = v("rNote");
  if ($("rName")) draft.name = v("rName");
  if ($("rPhone")) draft.phone = v("rPhone");
}

function showError(msg) { const e = $("rErr"); e.textContent = msg; e.hidden = false; }
function busy(on) { const b = $("rSend"); b.disabled = on; b.textContent = on ? "Sending…" : "Send reply"; }

async function send() {
  if (preview) return;
  readDraft(); busy(true);
  const { data, error } = await sb.rpc("submit_rsvp", {
    p_token: token, p_status: draft.status, p_coming: draft.coming, p_dietary: draft.dietary.trim(), p_note: draft.note.trim(),
  });
  if (error) { busy(false); showError("Couldn't send your reply. Please check your connection and try again."); return; }
  guest = { ...guest, ...data }; draft = null; renderRsvp(); toast("Reply sent. Thank you!");
}

async function sendGroup() {
  if (preview) return;
  readDraft();
  if (!draft.name.trim()) { showError("Please enter your name."); $("rName").focus(); return; }
  if (draft.phone.replace(/\D/g, "").length < 8) { showError("Please enter your WhatsApp number, so the hosts know who replied."); $("rPhone").focus(); return; }
  busy(true);
  const { data, error } = await sb.rpc("submit_group_rsvp", {
    p_token: groupToken, p_name: draft.name.trim(), p_phone: draft.phone.trim(), p_status: draft.status,
    p_coming: draft.coming, p_dietary: draft.dietary.trim(), p_note: draft.note.trim(),
  });
  if (error) {
    busy(false);
    const known = /Please enter|Please choose|reached its limit|not found/i.test(error.message || "");
    showError(known ? error.message.replace("Invitation not found", "This group link has been turned off. Please ask whoever sent it for the current link.")
      : "Couldn't send your reply. Please check your connection and try again.");
    return;
  }
  remember(data.token);
  token = data.token; mode = "personal"; maxSeats = Math.max(1, data.seats || maxSeats);
  guest = { name: data.name, seats: data.seats, status: data.status, coming: data.coming, dietary: data.dietary, note: data.note };
  draft = null; render();
  toast(data.updated ? "You'd already replied, so we've updated your reply." : "Reply sent. Thank you!");
}

function replyForSomeoneElse() {
  forget(); token = ""; guest = null; draft = null; mode = "group";
  sb.rpc("get_group_invite", { p_token: groupToken }).then(({ data }) => {
    if (!data) return notFound(null, true);
    inv = data.invitation; maxSeats = Math.max(1, data.max_seats || 1); render();
    $("rsvp").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/* ---------- opening: an envelope the guest taps, or a gentle fade-in ---------- */
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
// petals or sparkles falling, and stickers blooming in, as the card appears
function celebrate() {
  const d = cleanDetails(inv.details), st = cleanStyle(inv.style);
  playFall(d.fall, [st.accent, st.frameA, st.frameB, st.ink].filter((c, i, a) => a.indexOf(c) === i));
  if (d.bloom === "1") bloom($("card"));
}
function setupOpening() {
  const d = cleanDetails(inv.details);
  if (d.opening === "fade" && !reduceMotion) $("card").classList.add("reveal");
  if (d.opening !== "envelope") { celebrate(); return; }
  const st = cleanStyle(inv.style);
  const ov = document.createElement("div");
  ov.className = "env-overlay";
  ov.style.cssText = `--env-bg:${st.bg};--env-inner:${mix(st.bg, st.ink, 0.1)};--env-flap:${mix(st.bg, st.accent, 0.14)};--env-line:${st.frameA};--env-seal:${st.accent};--env-seal-ink:${st.bg}`;
  ov.innerHTML = `<div class="env-wrap">
      <p class="env-kicker">You're invited</p>
      ${guest?.name ? `<p class="env-for">For ${esc(guest.name)}</p>` : ""}
      <button type="button" class="env" aria-label="Open your invitation">
        <span class="env-back"></span><span class="env-paper"></span><span class="env-front"></span>
        <span class="env-flap"></span><span class="env-seal">${esc(initialsFor(d))}</span>
      </button>
      <p class="env-hint">Tap the envelope to open</p>
    </div>`;
  document.body.append(ov); document.body.classList.add("env-lock");
  // While the envelope is showing, the invitation behind it can't be reached, so Tab goes straight to the envelope.
  const behind = [document.querySelector("main"), document.querySelector(".music-btn")].filter(Boolean);
  behind.forEach((el) => (el.inert = true));
  const btn = ov.querySelector(".env");
  btn.addEventListener("click", () => {
    music?.play();   // a tap is what allows sound to start on phones
    if (reduceMotion) return done();
    ov.classList.add("opening");
    setTimeout(() => ov.classList.add("leaving"), 750);
    setTimeout(done, 1300);
  }, { once: true });
  function done() {
    ov.remove(); document.body.classList.remove("env-lock");
    document.querySelectorAll("[inert]").forEach((el) => (el.inert = false));
    $("card").classList.add("reveal"); $("card").focus({ preventScroll: true });
    celebrate();
  }
}

/* ---------- background music: a play/pause button; it never starts by itself ---------- */
function setupMusic() {
  const d = cleanDetails(inv.details);
  if (!d.music) return;
  const audio = new Audio(musicUrl(d.music));
  audio.loop = true; audio.preload = "none";
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "music-btn"; btn.setAttribute("aria-pressed", "false");
  const ICON = { play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>', pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>' };
  const show = (on) => { btn.innerHTML = (on ? ICON.pause : ICON.play) + `<span>${on ? "Pause music" : "Play music"}</span>`; btn.setAttribute("aria-pressed", String(on)); };
  show(false);
  audio.addEventListener("play", () => show(true)); audio.addEventListener("pause", () => show(false));
  audio.addEventListener("error", () => { btn.remove(); });
  btn.addEventListener("click", () => (audio.paused ? audio.play().catch(() => toast("Couldn't play the music on this device.")) : audio.pause()));
  document.body.append(btn);
  music = { play: () => audio.play().catch(() => { }) };
}