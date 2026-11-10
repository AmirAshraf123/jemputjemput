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
    var inFooter = false;
    var host = document.querySelector("header.top .hdr-right") || document.querySelector("header.top .wrap");
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
      try { localStorage.setItem(KEY, sel.value); } catch (e) {}
    });
  });
})();
