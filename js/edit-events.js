// Editor: separate events (for example an akad nikah in the morning and a reception at night).
// Each event has its own name, date, time and place. Guests answer each one; the Guests tab says who's invited to which.
import { $ } from "./sb.js";
import { esc, cleanDetails, EVENT_NAMES, MAX_EVENTS } from "./card.js";

/** ctx: { inv() → the invitation, change(details) → saves new details, refresh() → redraws what depends on events } */
export function setupEvents(ctx) {
  $("evNames").innerHTML = EVENT_NAMES.map((n) => `<option value="${esc(n.en)}"></option>`).join("");

  const newId = (list) => { let n = list.length + 1; while (list.some((e) => e.id === "e" + n)) n++; return "e" + n; };
  // the first two events an occasion usually has
  const firstNames = (occ) => (occ === "wedding" ? ["Akad nikah", "Reception"] : occ === "engagement" ? ["Ceremony", "Dinner"] : ["", ""]);

  function fill() {
    const d = ctx.inv().details, on = !!d.multi;
    $("multiOn").checked = on;
    $("singleBox").hidden = on;
    $("eventsBox").hidden = !on;
    if (on) render();
  }
  function render() {
    const list = ctx.inv().details.events;
    if ($("evList").contains(document.activeElement) && document.activeElement.dataset.e) return;   // don't redraw under the cursor
    $("evList").innerHTML = list.map((e, i) => {
      const n = i + 1, lab = e.name.trim() || `Event ${n}`;
      return `<li class="ev-card" data-i="${i}">
        <div class="ev-head">
          <span class="ev-num" aria-hidden="true">${n}</span>
          <label class="f ev-name">Event ${n} name<input id="evName${i}" data-e="name" data-i="${i}" list="evNames" maxlength="60" placeholder="e.g. Reception" value="${esc(e.name)}"></label>
          <div class="ev-tools">
            ${i > 0 ? `<button type="button" class="btn sm ghost" data-evup="${i}" aria-label="Move ${esc(lab)} up">↑</button>` : ""}
            <button type="button" class="btn sm ghost" data-evdel="${i}" aria-label="Remove ${esc(lab)}"${list.length <= 1 ? " disabled" : ""}>Remove</button>
          </div>
        </div>
        <div class="row">
          <label class="f">Date<input type="date" data-e="date" data-i="${i}" value="${esc(e.date)}"></label>
          <label class="f">Starts<input type="time" data-e="start" data-i="${i}" value="${esc(e.start)}"></label>
          <label class="f">Ends<input type="time" data-e="end" data-i="${i}" value="${esc(e.end)}"></label>
        </div>
        <label class="f">Venue<input data-e="venue" data-i="${i}" maxlength="120" value="${esc(e.venue)}"></label>
        <label class="f">Address<input data-e="address" data-i="${i}" maxlength="200" value="${esc(e.address)}"></label>
      </li>`;
    }).join("");
    $("addEvent").disabled = list.length >= MAX_EVENTS;
    $("addEvent").textContent = list.length >= MAX_EVENTS ? `Up to ${MAX_EVENTS} events` : "Add an event";
  }
  const save = (patch, redraw = true) => { ctx.change(cleanDetails({ ...ctx.inv().details, ...patch })); if (redraw) render(); ctx.refresh(); };

  $("multiOn").addEventListener("change", () => {
    const d = ctx.inv().details;
    if ($("multiOn").checked) {
      // start from the card's own date and place, so nothing typed is lost
      let events = d.events;
      if (!events.length) {
        const [a, b] = firstNames(d.occasion), base = { date: d.date, start: d.start, end: d.end, venue: d.venue, address: d.address };
        events = [{ id: "e1", name: a, ...base }, { id: "e2", name: b, ...base }];
      }
      save({ multi: "1", events });
      fill();
      $("evName0")?.focus();
    } else {
      // back to one event: the first event's date and place fill the card if it has none
      const e = d.events[0], patch = { multi: "" };
      if (e && !d.date && !d.venue) Object.assign(patch, { date: e.date, start: e.start, end: e.end, venue: e.venue, address: e.address });
      save(patch, false);
      fill();
      if (patch.date !== undefined) for (const k of ["date", "start", "end", "venue", "address"]) $(k).value = ctx.inv().details[k];
    }
  });
  $("evList").addEventListener("input", (e) => {
    const t = e.target; if (!t.dataset.e) return;
    const events = ctx.inv().details.events.map((x) => ({ ...x }));
    const ev = events[+t.dataset.i];
    // a new name means any saved translation of the old one no longer fits
    if (t.dataset.e === "name" && ev.tr && ev.tr.src !== t.value) delete ev.tr;
    ev[t.dataset.e] = t.value;
    save({ events }, false);
  });
  $("evList").addEventListener("focusout", () => setTimeout(() => { if (!$("evList").contains(document.activeElement)) render(); }, 0));
  $("evList").addEventListener("click", (e) => {
    const del = e.target.closest("[data-evdel]"), up = e.target.closest("[data-evup]");
    const events = [...ctx.inv().details.events];
    if (del) {
      const i = +del.dataset.evdel; events.splice(i, 1);
      save({ events });
      ($(`evName${Math.max(0, i - 1)}`) || $("addEvent")).focus();
    } else if (up) {
      const i = +up.dataset.evup; [events[i - 1], events[i]] = [events[i], events[i - 1]];
      save({ events });
      document.querySelector(`[data-evup="${i - 1}"]`)?.focus() || $(`evName${i - 1}`)?.focus();
    }
  });
  $("addEvent").addEventListener("click", () => {
    const events = ctx.inv().details.events, last = events[events.length - 1] || {};
    // a new event usually shares the day and place of the one before it
    save({ events: [...events, { id: newId(events), name: "", date: last.date || "", start: "", end: "", venue: last.venue || "", address: last.address || "" }] });
    $(`evName${events.length}`)?.focus();
  });

  return { fill };
}
