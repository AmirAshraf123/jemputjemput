// Guests tab: check-in on the day. Scan guests' entry passes with the camera, or find them by name.
import { $, sb, toast } from "./sb.js";
import { esc } from "./card.js";

let ctx = null;
const guests = () => ctx.guests();
/** ctx: { guests(), renderGuests() } */
export function setupCheckin(c) { ctx = c; }

/* ---------- check-in on the day: scan entry passes, or find guests by name ---------- */
const JSQR_LIB = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/+esm";
export const clock = (t) => new Date(t).toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" });
let camStream = null, scanTimer = null, scanPause = 0;
function renderCheckin() {
  const coming = guests().filter((g) => g.status === "yes"), here = guests().filter((g) => g.checked_in_at);
  const people = here.reduce((a, g) => a + (g.status === "yes" ? g.coming : g.seats || 1), 0), expected = coming.reduce((a, g) => a + g.coming, 0);
  $("ckCount").innerHTML = `<b>${here.length}</b> of ${coming.length} households here · <b>${people}</b> of ${expected} people`;
  const q = $("ckSearch").value.trim().toLowerCase();
  const list = q ? guests().filter((g) => g.name.toLowerCase().includes(q)).slice(0, 8) : [];
  $("ckList").innerHTML = list.map((g) => `<li><div><b>${esc(g.name)}</b><div class="sub">${g.status === "yes" ? `Coming · ${g.coming} ${g.coming === 1 ? "seat" : "seats"}` : g.status === "no" ? "Said they can't make it" : "Hasn't replied"}</div></div>
    ${g.checked_in_at ? `<span class="arrived">Arrived ${esc(clock(g.checked_in_at))}</span><button type="button" class="btn sm ghost" data-ck-undo="${g.id}">Undo</button>`
      : `<button type="button" class="btn sm" data-ck="${g.id}">Check in</button>`}</li>`).join("") || (q ? `<li class="hint">No one called "${esc(q)}" on the list.</li>` : "");
}
async function setArrived(g, on) {
  const at = on ? new Date().toISOString() : null;
  const { error } = await sb.from("guests").update({ checked_in_at: at }).eq("id", g.id);
  if (error) {
    toast(/checked_in_at/.test(error.message) ? "Check-in needs a one-time database update: run supabase/006_safety_and_checkin.sql in Supabase's SQL Editor." : "Couldn't save the check-in: " + error.message);
    return false;
  }
  g.checked_in_at = at; renderCheckin(); ctx.renderGuests(); return true;
}
function showResult(kind, html) { $("ckResult").className = "ck-result " + kind; $("ckResult").innerHTML = html; }
// a scanned code: the guest's own link (or just its code)
async function onScan(text) {
  const tok = (String(text).match(/#?([a-f0-9]{32})(?:\/preview)?\s*$/i) || [])[1];
  const g = tok && guests().find((x) => x.token === tok);
  if (!g) { showResult("bad", "<b>Not on this guest list.</b> Try finding them by name."); navigator.vibrate?.([60, 60, 60]); return; }
  if (g.checked_in_at) { showResult("warn", `<b>${esc(g.name)}</b> already checked in at ${esc(clock(g.checked_in_at))}.`); return; }
  if (await setArrived(g, true)) {
    navigator.vibrate?.(120);
    showResult("ok", `<b>Welcome, ${esc(g.name)}!</b> ${g.status === "yes" ? `${g.coming} ${g.coming === 1 ? "seat" : "seats"}` : g.status === "no" ? "They'd said they couldn't come." : "They hadn't replied."}${g.dietary ? ` · ${esc(g.dietary)}` : ""} <button type="button" class="btn sm ghost" data-ck-undo="${g.id}">Undo</button>`);
  }
}
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { toast("This browser can't use the camera. Find guests by name instead."); return; }
  try { camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }); }
  catch { toast("Camera not available. Allow camera access for this site, or find guests by name."); return; }
  const v = $("ckVideo"); v.srcObject = camStream; await v.play().catch(() => { });
  $("ckStart").hidden = true; v.classList.add("on");
  // the phone's own QR reader where there is one, otherwise a small library
  let detect;
  if ("BarcodeDetector" in window && (await BarcodeDetector.getSupportedFormats?.().catch(() => []) || []).includes("qr_code")) {
    const bd = new BarcodeDetector({ formats: ["qr_code"] });
    detect = async () => (await bd.detect(v))[0]?.rawValue;
  } else {
    const { default: jsQR } = await import(JSQR_LIB);
    const c = document.createElement("canvas"), g = c.getContext("2d", { willReadFrequently: true });
    detect = async () => {
      if (!v.videoWidth) return null;
      const k = Math.min(1, 640 / v.videoWidth); c.width = v.videoWidth * k; c.height = v.videoHeight * k;
      g.drawImage(v, 0, 0, c.width, c.height);
      return jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data;
    };
  }
  scanTimer = setInterval(async () => {
    if (Date.now() < scanPause || !camStream) return;
    const code = await detect().catch(() => null);
    if (code) { scanPause = Date.now() + 2500; onScan(code); }   // a short pause so one pass isn't read twice
  }, 250);
}
function stopCamera() {
  clearInterval(scanTimer); scanTimer = null;
  camStream?.getTracks().forEach((t) => t.stop()); camStream = null;
  $("ckVideo").classList.remove("on"); $("ckStart").hidden = false;
}
$("checkinBtn").addEventListener("click", () => { $("ckSearch").value = ""; showResult("", ""); renderCheckin(); $("checkDlg").showModal(); $("ckStart").focus(); });
$("ckStart").addEventListener("click", startCamera);
$("ckClose").addEventListener("click", () => $("checkDlg").close());
$("checkDlg").addEventListener("close", stopCamera);
$("ckSearch").addEventListener("input", renderCheckin);
$("checkDlg").addEventListener("click", async (e) => {
  const a = e.target.closest("[data-ck]"), u = e.target.closest("[data-ck-undo]");
  const g = guests().find((x) => x.id === (a || u)?.dataset[a ? "ck" : "ckUndo"]); if (!g) return;
  if (a) { if (await setArrived(g, true)) showResult("ok", `<b>${esc(g.name)}</b> checked in.`); }
  else if (await setArrived(g, false)) showResult("", `${esc(g.name)} is no longer checked in.`);
});
