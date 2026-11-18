import { sb, isConfigured, $, showSetupNotice } from "./sb.js";
import { cardHTML, thumbHTML, PRESETS, presetById, OCCASIONS, defaultDetailsFor, initialsFor, esc } from "./card.js";

/* ---------- try it: a live card that updates as you type, kept for after sign-in ---------- */
const DRAFT = "jemput.draft";
let draft = { occasion: "wedding", name1: "", name2: "", date: "", template: "" };
try { Object.assign(draft, JSON.parse(localStorage.getItem(DRAFT) || "{}")); } catch { }
if (!OCCASIONS[draft.occasion]) draft.occasion = "wedding";
$("tOcc").innerHTML = Object.entries(OCCASIONS).map(([k, o]) => `<option value="${k}">${esc(o.label)}</option>`).join("");
function looks() { const occ = OCCASIONS[draft.occasion]; return [presetById(occ.template), ...PRESETS.filter((p) => p.id !== occ.template)].filter(Boolean).slice(0, 6); }
function renderTry() {
  const occ = OCCASIONS[draft.occasion];
  if (!draft.template || !presetById(draft.template)) draft.template = occ.template;
  $("tOcc").value = draft.occasion;
  $("tl1").textContent = occ.l1; $("tl2").textContent = occ.l2;
  $("tName1").placeholder = occ.two ? "e.g. Hakim" : occ.ph1; $("tName2").placeholder = occ.two ? "e.g. Nadia" : (occ.ex2 || "");
  $("tName1").value = draft.name1; $("tName2").value = draft.name2; $("tDate").value = draft.date;
  const d = { ...defaultDetailsFor(draft.occasion), name1: draft.name1, name2: draft.name2, date: draft.date, start: "11:00", end: "16:00", venue: "Your venue" };
  $("tTpls").innerHTML = looks().map((p) => `<button type="button" class="tpl" role="radio" data-t="${p.id}" aria-checked="${p.id === draft.template}" tabindex="${p.id === draft.template ? 0 : -1}">${thumbHTML(p.style, p.name, initialsFor(d))}</button>`).join("");
  $("sample").innerHTML = cardHTML({ details: d, style: presetById(draft.template).style }, "Auntie Rosnah & family");
}
const keep = () => { try { localStorage.setItem(DRAFT, JSON.stringify(draft)); } catch { } };
$("try").addEventListener("input", (e) => {
  const map = { tName1: "name1", tName2: "name2", tDate: "date" };
  if (map[e.target.id]) { draft[map[e.target.id]] = e.target.value; keep(); renderTryCard(); }
});
function renderTryCard() {   // just the card, so typing isn't interrupted
  const d = { ...defaultDetailsFor(draft.occasion), name1: draft.name1, name2: draft.name2, date: draft.date, start: "11:00", end: "16:00", venue: "Your venue" };
  $("sample").innerHTML = cardHTML({ details: d, style: presetById(draft.template).style }, "Auntie Rosnah & family");
}
$("tOcc").addEventListener("change", (e) => {
  if (OCCASIONS[draft.occasion].two !== OCCASIONS[e.target.value].two) draft.name2 = "";   // "Second name" and "Which birthday" mean different things
  draft.occasion = e.target.value; draft.template = ""; keep(); renderTry();
});
$("tTpls").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; draft.template = b.dataset.t; keep(); renderTry(); $("tTpls").querySelector(`[data-t="${draft.template}"]`)?.focus(); });
$("tTpls").addEventListener("keydown", (e) => {
  const list = [...$("tTpls").children], i = list.indexOf(document.activeElement); if (i < 0) return;
  const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key]; if (j === undefined) return;
  e.preventDefault(); list[(j + list.length) % list.length].click();
});
$("try").addEventListener("submit", async (e) => {
  e.preventDefault(); draft.ready = true; keep();
  const { data: { session } } = await sb.auth.getSession();
  if (session) { location.href = "app.html"; return; }   // signed in already: the dashboard picks the card up
  $("draftNote").hidden = false;
  $("signinWrap").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  $("google").focus({ preventScroll: true });
});
renderTry();

if (!isConfigured) showSetupNotice();

// Already signed in? Offer the way back in.
sb.auth.getSession().then(({ data: { session } }) => { if (session) { $("goApp").hidden = false; $("goSignin").hidden = true; } });

// Google sign-in: needs the Google provider turned on in Supabase (README step 6, option A).
$("google").addEventListener("click", async () => {
  const btn = $("google"), note = $("signinNote");
  btn.disabled = true; note.textContent = "Opening Google…";
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: new URL("app.html", location.href).href },
  });
  if (error) {
    btn.disabled = false;
    note.textContent = /not enabled|unsupported provider/i.test(error.message)
      ? "Google sign-in isn't switched on for this site yet. Use your email instead."
      : `Couldn't open Google sign-in: ${error.message}`;
  }
});

$("signin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("email").value.trim();
  const btn = $("sendLink"), note = $("signinNote");
  btn.disabled = true; note.textContent = "Sending…";
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: new URL("app.html", location.href).href },
  });
  btn.disabled = false;
  note.textContent = error
    ? `Couldn't send the link: ${error.message}`
    : `Check ${email} for your link. It may take a minute, or land in spam.`;
});