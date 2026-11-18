// Colour theme: "auto" follows the device, or the visitor can pick light or dark.
// Loaded in <head> (not as a module) so the right colours apply before the page appears.
(function () {
  var KEY = "jemput.theme";
  function saved() { try { return localStorage.getItem(KEY) || "auto"; } catch (e) { return "auto"; } }
  function apply(v) {
    var root = document.documentElement;
    if (v === "light" || v === "dark") root.setAttribute("data-theme", v);
    else root.removeAttribute("data-theme");
  }
  apply(saved());

  document.addEventListener("DOMContentLoaded", function () {
    setupMenu();
    var inFooter = false;
    var host = document.querySelector("header.top .hdr-right");
    if (!host) { host = document.querySelector(".foot-note"); inFooter = true; }
    if (!host) return;
    var label = document.createElement("label");
    label.className = "theme-pick" + (inFooter ? " in-footer" : "");
    label.innerHTML =
      '<span class="vh">Colour theme</span>' +
      '<select id="themePick">' +
      '<option value="auto">Theme: match device</option>' +
      '<option value="light">Theme: light</option>' +
      '<option value="dark">Theme: dark</option>' +
      "</select>";
    if (inFooter) host.appendChild(label); else host.insertBefore(label, host.firstChild);
    var sel = label.querySelector("select");
    sel.value = saved();
    sel.addEventListener("change", function () {
      apply(sel.value);
      try { localStorage.setItem(KEY, sel.value); } catch (e) { }
    });
  });

  // On phones the header shrinks to one row: the logo and a Menu button. The menu holds
  // whatever sits on the right of the header on wider screens (theme, sign out and so on).
  function setupMenu() {
    var wrap = document.querySelector("header.top .wrap");
    if (!wrap) return;
    var right = wrap.querySelector(".hdr-right");
    if (!right) { right = document.createElement("div"); right.className = "hdr-right"; wrap.appendChild(right); }
    right.id = "hdrMenu";
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "menu-btn"; btn.textContent = "Menu";
    btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", "hdrMenu");
    wrap.insertBefore(btn, right);
    var header = wrap.parentElement;
    function setOpen(open) {
      header.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Close" : "Menu";
    }
    btn.addEventListener("click", function () { setOpen(!header.classList.contains("menu-open")); });
    document.addEventListener("click", function (e) {
      if (header.classList.contains("menu-open") && !right.contains(e.target) && e.target !== btn) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("menu-open")) { setOpen(false); btn.focus(); }
    });
  }
})();

// ⓘ buttons: show or hide the extra detail they point to
document.addEventListener("click", function (e) {
  var b = e.target.closest && e.target.closest("button.info[aria-controls]");
  if (!b) return;
  var box = document.getElementById(b.getAttribute("aria-controls"));
  if (!box) return;
  var open = b.getAttribute("aria-expanded") !== "true";
  b.setAttribute("aria-expanded", String(open));
  box.hidden = !open;
});

// Offline support: keeps a copy of the site on the phone (see sw.js). Only on real hosting or this computer.
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { }); });
}