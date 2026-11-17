/* Movement when a guest opens the card: falling petals, sparkles, confetti or hearts, and stickers that bloom in one by one.
   Nothing moves for people who have asked their device to reduce motion. */
export const FALLS = { none: "Nothing", petals: "Falling petals", sparkles: "Sparkles", confetti: "Confetti", hearts: "Little hearts" };
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Drops a short shower of shapes over `host` (the whole page by default). colours: array of hex colours. */
export function playFall(kind, colours, host = document.body, { count = 30, seconds = 6 } = {}) {
  if (!FALLS[kind] || kind === "none" || reduce()) return;
  host.querySelector(":scope > .fx-fall")?.remove();
  const box = document.createElement("div");
  box.className = "fx-fall" + (host === document.body ? "" : " in-box");
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span"), size = kind === "sparkles" ? 8 + Math.random() * 12 : 9 + Math.random() * 10;
    s.className = "fx " + kind;
    s.style.cssText = `left:${Math.random() * 100}%;--s:${size.toFixed(1)}px;--c:${colours[i % colours.length]};--d:${(seconds * (0.6 + Math.random() * 0.5)).toFixed(2)}s;--w:${(Math.random() * 1.6).toFixed(2)}s;--x:${(Math.random() * 80 - 40).toFixed(0)}px;--r:${(Math.random() * 720 - 360).toFixed(0)}deg`;
    box.append(s);
  }
  host.append(box);
  setTimeout(() => box.remove(), seconds * 1000 + 2500);
}

/** Fades and grows the card's stickers and text boxes in, one after another. */
export function bloom(cardEl) {
  if (!cardEl || reduce()) return;
  const items = cardEl.querySelectorAll(".ly");
  if (!items.length) return;
  items.forEach((el, i) => el.style.setProperty("--i", i));
  cardEl.classList.remove("fx-bloom"); void cardEl.offsetWidth; cardEl.classList.add("fx-bloom");
  setTimeout(() => cardEl.classList.remove("fx-bloom"), 900 + items.length * 140);
}
