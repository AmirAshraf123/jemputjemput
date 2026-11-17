/* Drag-to-reorder for a list, with a mouse, a finger or the arrow keys.
   Rows can be different heights. While dragging, the row follows the pointer and the others slide out of the way.
   options: handle (selector inside a row), onPreview(from, to) while dragging, onCommit(from, to) when dropped,
            onKey(index, dir) for arrow keys, scrollTop() px of anything pinned at the top of the screen. */
export function makeSortable(list, { handle = ".drag-handle", onPreview, onCommit, onKey, scrollTop = () => 0, scrollBottom = () => innerHeight }) {
  let st = null;
  list.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(handle); if (!h || !list.contains(h) || e.button > 0) return;
    e.preventDefault();
    const items = [...list.children].filter((x) => x.matches("li"));
    const li = h.closest("li"), from = items.indexOf(li);
    const rects = items.map((x) => x.getBoundingClientRect());
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 6;
    h.setPointerCapture(e.pointerId);
    li.classList.add("dragging"); list.classList.add("is-dragging");
    st = { h, li, items, from, to: from, y: e.clientY, startY: e.clientY, scrollY: window.scrollY, step: rects[from].height + gap, mids: rects.map((r) => (r.top + r.bottom) / 2), raf: 0 };
  });
  const move = () => {
    const dy = st.y - st.startY + (window.scrollY - st.scrollY);
    st.li.style.transform = `translateY(${dy}px)`;
    const centre = st.mids[st.from] + dy, to = st.mids.filter((m, i) => i !== st.from && m < centre).length;
    if (to === st.to) return;
    st.to = to;
    st.items.forEach((x, i) => {
      if (x === st.li) return;
      const shift = st.from < to ? (i > st.from && i <= to ? -1 : 0) : (i < st.from && i >= to ? 1 : 0);
      x.style.transform = shift ? `translateY(${shift * st.step}px)` : "";
    });
    onPreview?.(st.from, to);
  };
  const edge = () => {
    if (!st) return;
    const top = scrollTop(), bottom = Math.min(scrollBottom(), innerHeight), y = st.y, E = 60;
    const v = y < top + E ? -Math.ceil((top + E - y) / 6) : y > bottom - E ? Math.ceil((y - bottom + E) / 6) : 0;
    if (v) { const b = window.scrollY; window.scrollBy(0, Math.max(-14, Math.min(14, v))); if (window.scrollY !== b) move(); }
    st.raf = requestAnimationFrame(edge);
  };
  list.addEventListener("pointermove", (e) => { if (!st) return; st.y = e.clientY; move(); if (!st.raf) st.raf = requestAnimationFrame(edge); });
  const end = (cancel) => {
    if (!st) return;
    const { from, to, raf, items, li } = st; cancelAnimationFrame(raf); st = null;
    list.classList.remove("is-dragging"); li.classList.remove("dragging");
    items.forEach((x) => { x.style.transform = ""; });
    onCommit?.(from, cancel ? from : to);
  };
  list.addEventListener("pointerup", () => end(false));
  list.addEventListener("pointercancel", () => end(true));
  list.addEventListener("keydown", (e) => {
    const h = e.target.closest(handle); if (!h || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const items = [...list.children].filter((x) => x.matches("li"));
    onKey?.(items.indexOf(h.closest("li")), e.key === "ArrowUp" ? -1 : 1);
  });
}
/** Moves one entry of an array from one index to another, returning a new array. */
export const moveItem = (arr, from, to) => { const a = [...arr]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };
