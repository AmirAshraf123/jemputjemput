// Editor: saving the card as a picture (1080 px wide) or as a print-ready PDF with bleed and crop marks.
import { $, toast } from "./sb.js";
import { cardHTML, eventTitle, fontCSSUrl, cardFontKeys } from "./card.js";
import { curLang } from "./edit-languages.js";

let inv = null, phone = matchMedia("(max-width: 880px)");
/** ctx: { inv: the invitation being edited, phone: the media query for phone layouts } */
export function setupExport(ctx) { ({ inv, phone } = ctx); }

/* Save the card as a picture: 1080px wide, ready for Instagram, Status or printing.
   On phones that can share files, it opens the share sheet (Save Image, Instagram, WhatsApp…); otherwise it downloads. */
const IMAGE_LIB = "https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm";
// The picture is drawn without the page's stylesheets, so the card's fonts are embedded directly.
// Only font files covering characters on the card are fetched (Chinese fonts are split into many files).
async function embeddedFontCSS(text) {
  const url = fontCSSUrl(cardFontKeys(inv)); if (!url) return "";
  const css = await (await fetch(url)).text();
  const used = new Set([...text].map((ch) => ch.codePointAt(0)));
  const covers = (range) => range.split(",").some((r) => {
    const [a, b] = r.trim().replace(/^U\+/i, "").split("-").map((h) => parseInt(h.replace(/\?/g, "0"), 16));
    const hi = b ?? (r.includes("?") ? parseInt(r.trim().replace(/^U\+/i, "").replace(/\?/g, "F"), 16) : a);
    for (const cp of used) if (cp >= a && cp <= hi) return true;
    return false;
  });
  const blocks = css.match(/@font-face\s*{[^}]*}/g) || [];
  const keep = blocks.filter((blk) => { const m = blk.match(/unicode-range:\s*([^;]+);/); return !m || covers(m[1]); });
  const toData = async (u) => { const blob = await (await fetch(u)).blob(); return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); };
  const out = [];
  for (const blk of keep) {
    const m = blk.match(/url\(([^)]+)\)/); if (!m) continue;
    out.push(blk.replace(m[0], `url(${await toData(m[1].replace(/["']/g, ""))})`));
  }
  return out.join("\n");
}
// Draws the card off-screen at a given width in pixels, with its fonts and pictures, and returns a canvas.
async function renderCardCanvas(widthPx) {
  const host = document.createElement("div");
  host.className = "export-host";
  try {
    const { toCanvas } = await import(IMAGE_LIB);
    host.innerHTML = cardHTML(inv, null, curLang());
    document.body.append(host);
    await document.fonts.ready;
    await Promise.all([...host.querySelectorAll("img")].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
    const node = host.firstElementChild;
    const fontEmbedCSS = await embeddedFontCSS(host.textContent + "&");
    return await toCanvas(node, { pixelRatio: widthPx / node.offsetWidth, cacheBust: true, fontEmbedCSS });
  } finally { host.remove(); }
}
const fileBase = () => eventTitle(inv.details).replace(/[^\w\s-]+/g, "").trim().replace(/\s+/g, "-") || "invitation";
async function deliver(blob, name, type, savedMsg) {
  const file = new File([blob], name, { type });
  if (phone.matches && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: eventTitle(inv.details) }).catch(() => { });
  } else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(savedMsg);
  }
}
async function saveImage(btn) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = "Preparing…";
  try {
    const canvas = await renderCardCanvas(1080);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("empty image");
    await deliver(blob, fileBase() + ".png", "image/png", "Image saved to your downloads");
  } catch (err) {
    console.error(err);
    toast("Couldn't create the image. Check your connection and try again, or take a screenshot of the full-size preview.");
  } finally { btn.disabled = false; btn.textContent = label; }
}

/* Print-ready PDF: the card 127 mm (5 inches) wide at 300 dpi, with 3 mm bleed on every side (the edge colours
   carried outwards, so nothing white shows if the cut is slightly off) and crop marks showing where to cut. */
const PDF_LIB = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";
const TRIM_W = 127, BLEED = 3, SLUG = 8;
async function savePDF(btn) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = "Preparing…";
  try {
    const card = await renderCardCanvas(1500);   // 1500 px across 127 mm ≈ 300 dpi
    const W = card.width, H = card.height, pxPerMm = W / TRIM_W, b = Math.round(BLEED * pxPerMm);
    const c = document.createElement("canvas"); c.width = W + 2 * b; c.height = H + 2 * b;
    const g = c.getContext("2d");
    g.fillStyle = inv.style.frame === "none" ? inv.style.bg : inv.style.frameA; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(card, b, b);
    // stretch the outermost row and column of pixels into the bleed
    g.drawImage(card, 0, 0, 1, H, 0, b, b, H); g.drawImage(card, W - 1, 0, 1, H, W + b, b, b, H);
    g.drawImage(card, 0, 0, W, 1, b, 0, W, b); g.drawImage(card, 0, H - 1, W, 1, b, H + b, W, b);
    for (const [sx, sy, dx, dy] of [[0, 0, 0, 0], [W - 1, 0, W + b, 0], [0, H - 1, 0, H + b], [W - 1, H - 1, W + b, H + b]]) g.drawImage(card, sx, sy, 1, 1, dx, dy, b, b);
    const trimH = H / pxPerMm, pw = TRIM_W + 2 * (BLEED + SLUG), ph = trimH + 2 * (BLEED + SLUG);
    const { jsPDF } = await import(PDF_LIB);
    const pdf = new jsPDF({ unit: "mm", format: [pw, ph], orientation: pw > ph ? "landscape" : "portrait", compress: true });
    pdf.addImage(c.toDataURL("image/jpeg", 0.95), "JPEG", SLUG, SLUG, TRIM_W + 2 * BLEED, trimH + 2 * BLEED);
    // crop marks: short lines in the margin, in line with the trim edges, stopping before the bleed
    pdf.setLineWidth(0.25); pdf.setDrawColor(0);
    const x0 = SLUG + BLEED, x1 = x0 + TRIM_W, y0 = SLUG + BLEED, y1 = y0 + trimH, gap = BLEED + 1, len = SLUG - 2;
    for (const x of [x0, x1]) { pdf.line(x, y0 - gap - len, x, y0 - gap); pdf.line(x, y1 + gap, x, y1 + gap + len); }
    for (const y of [y0, y1]) { pdf.line(x0 - gap - len, y, x0 - gap, y); pdf.line(x1 + gap, y, x1 + gap + len, y); }
    pdf.setFontSize(6); pdf.setTextColor(90);
    pdf.text(`${eventTitle(inv.details)} · trim ${TRIM_W} × ${trimH.toFixed(1)} mm · ${BLEED} mm bleed · made with Jemput`, pw / 2, ph - 2.5, { align: "center" });
    pdf.setProperties({ title: eventTitle(inv.details), creator: "Jemput" });
    await deliver(pdf.output("blob"), fileBase() + "-print.pdf", "application/pdf", "Print PDF saved to your downloads");
  } catch (err) {
    console.error(err);
    toast("Couldn't create the PDF. Check your connection and try again.");
  } finally { btn.disabled = false; btn.textContent = label; }
}
$("pvDownload").addEventListener("click", (e) => saveImage(e.currentTarget));
$("pvFullDownload").addEventListener("click", (e) => saveImage(e.currentTarget));
$("pvPdf").addEventListener("click", (e) => savePDF(e.currentTarget));
$("pvFullPdf").addEventListener("click", (e) => savePDF(e.currentTarget));
