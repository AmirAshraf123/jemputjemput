// Guests tab: adding many guests at once from a spreadsheet (a CSV file, or rows pasted from Excel or Google Sheets).
import { $, toast } from "./sb.js";
import { esc, clamp } from "./card.js";

let ctx = null;
const guests = () => ctx.guests();
const usesSides = () => ctx.usesSides(), sideText = (s) => ctx.sideText(s);
/** ctx: { inv, guests(), usesSides(), sideText(side), insertGuests(rows), added() after guests are added, NEEDS_UPDATE } */
export function setupImport(c) { ctx = c; }

/* ---------- import guests from a spreadsheet (CSV file, or rows pasted from Excel / Google Sheets) ---------- */
// Splits CSV or tab-separated text into rows of cells, handling "quoted, values" and doubled quotes.
function parseTable(text) {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/).find((l) => l.trim()) || "";
  const sep = first.includes("\t") ? "\t" : (first.split(";").length > first.split(",").length ? ";" : ",");
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"' && !cell) q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}
const normPhone = (p) => { let d = String(p || "").replace(/\D/g, ""); if (d.length === 8) d = "65" + d; return d; };
const normName = (n) => String(n || "").toLowerCase().replace(/\s+/g, "");
// Which column is which: from a heading row if there is one (English or Malay), otherwise Name, Phone, Seats, Side.
function columnsOf(rows) {
  const h = rows[0].map((c) => c.toLowerCase());
  const find = (re) => h.findIndex((c) => re.test(c));
  const cols = { name: find(/^(name|nama|guest|tetamu|household)/), phone: find(/phone|whatsapp|number|telefon|no\.? ?tel|mobile|hp/), seats: find(/seat|pax|tempat|bilangan|people|orang/), side: find(/side|group|pihak|kumpulan/) };
  if (cols.name >= 0) return { cols, start: 1 };
  return { cols: { name: 0, phone: 1, seats: 2, side: 3 }, start: 0 };
}
function sideFrom(v) {
  if (!usesSides()) return String(v || "").slice(0, 40);
  const t = String(v || "").toLowerCase();
  if (/groom|lelaki|\bl\b|husband|male/.test(t)) return "Groom";
  if (/bride|perempuan|\bp\b|wife|female/.test(t)) return "Bride";
  return "Both";
}
let importRows = [];
function readImport() {
  const rows = parseTable($("impText").value);
  importRows = [];
  if (!rows.length) { $("impPreview").innerHTML = ""; $("impGo").disabled = true; $("impDupWrap").hidden = true; return; }
  const { cols, start } = columnsOf(rows);
  const phones = new Set(guests().map((g) => normPhone(g.phone)).filter((p) => p.length >= 8)), names = new Set(guests().map((g) => normName(g.name)));
  let noName = 0;
  for (const r of rows.slice(start)) {
    const name = (r[cols.name] || "").slice(0, 120);
    if (!name) { noName++; continue; }
    const phone = cols.phone >= 0 ? (r[cols.phone] || "").slice(0, 40) : "";
    const seats = Math.round(clamp(parseInt(cols.seats >= 0 ? r[cols.seats] : "", 10) || 2, 1, 50, 2));
    const p = normPhone(phone), n = normName(name);
    const dup = (p.length >= 8 && phones.has(p)) ? "same number as someone on your list" : names.has(n) ? "same name as someone on your list" : "";
    importRows.push({ name, phone, seats, side: sideFrom(cols.side >= 0 ? r[cols.side] : ""), dup });
    if (p.length >= 8) phones.add(p); names.add(n);   // catches repeats inside the file too
  }
  const dups = importRows.filter((x) => x.dup).length, fresh = importRows.length - dups;
  const show = importRows.slice(0, 6);
  $("impPreview").innerHTML = `<p><b>${fresh} ${fresh === 1 ? "household" : "households"} ready to add</b>${dups ? ` · ${dups} possible ${dups === 1 ? "duplicate" : "duplicates"}` : ""}${noName ? ` · ${noName} ${noName === 1 ? "row" : "rows"} without a name skipped` : ""}</p>`
    + (show.length ? `<div class="tablewrap"><table><thead><tr><th>Name</th><th>Number</th><th>Seats</th><th>${usesSides() ? "Side" : "Group"}</th></tr></thead><tbody>${show.map((x) => `<tr${x.dup ? ' class="dup"' : ""}><td>${esc(x.name)}${x.dup ? `<div class="sub">Possible duplicate: ${esc(x.dup)}</div>` : ""}</td><td>${esc(x.phone)}</td><td>${x.seats}</td><td>${esc(sideText(x.side))}</td></tr>`).join("")}</tbody></table></div>${importRows.length > 6 ? `<p class="hint">…and ${importRows.length - 6} more</p>` : ""}` : "");
  $("impDupWrap").hidden = !dups;
  $("impGo").disabled = !(fresh || ($("impDups").checked && dups));
  const n = fresh + ($("impDups").checked ? dups : 0);
  $("impGo").textContent = n ? `Add ${n} ${n === 1 ? "guest" : "guests"}` : "Add guests";
}
$("importBtn").addEventListener("click", () => {
  $("impSideWord").textContent = usesSides() ? "Side (Groom, Bride or Both)" : "Group";
  $("impText").value = ""; readImport(); $("importDlg").showModal(); $("impText").focus();
});
$("impCancel").addEventListener("click", () => $("importDlg").close());
$("impText").addEventListener("input", readImport);
$("impDups").addEventListener("change", readImport);
$("impFile").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (f.size > 2e6) { toast("That file is over 2 MB. Please split it into smaller files."); return; }
  if (/\.xlsx?$/i.test(f.name)) { toast("Please save the spreadsheet as CSV first (File → Download or Save As → CSV), or copy the rows and paste them in."); return; }
  $("impText").value = await f.text(); readImport();
});
$("impTemplate").addEventListener("click", (e) => {
  e.preventDefault();
  const sample = usesSides()
    ? "Name,WhatsApp number,Seats,Side\r\nAuntie Rosnah & family,9123 4567,4,Bride\r\nUncle Lim,9876 5432,2,Groom\r\n"
    : "Name,WhatsApp number,Seats,Group\r\nAuntie Rosnah & family,9123 4567,4,Family\r\nDaniel Tan,9876 5432,1,Work\r\n";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + sample], { type: "text/csv" })); a.download = "jemput-guest-list-sample.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$("impForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const rows = importRows.filter((x) => !x.dup || $("impDups").checked)
    .map(({ name, phone, seats, side }) => ({ invitation_id: ctx.inv.id, name, phone, seats, side }));
  if (!rows.length) return;
  $("impGo").disabled = true; $("impGo").textContent = "Adding…";
  let added = 0, withoutGroup = false;
  for (let i = 0; i < rows.length; i += 100) {
    const res = await ctx.insertGuests(rows.slice(i, i + 100));
    if (res.error) { toast(`Couldn't add all of them (${added} added): ` + res.error.message); break; }
    for (const g of res.data) if (!guests().some((x) => x.id === g.id)) guests().push(g);
    added += res.data.length; withoutGroup ||= res.withoutGroup;
  }
  ctx.added();
  $("importDlg").close();
  if (added) toast(`Added ${added} ${added === 1 ? "guest" : "guests"}. Send each one their link from the list below.` + (withoutGroup ? ctx.NEEDS_UPDATE : ""));
});
