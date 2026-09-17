// Sirius.X font picker — reader chooses between Fraunces (Silent Mode
// family — editorial serif, default) and Ubuntu (Bitcoin Cash brand
// font — humanist sans). Persisted in localStorage under 'sirius-font'.
//
// The runtime attribute goes on <html> — pages that want to opt out
// simply omit the include. The actual font-swap CSS is defined per
// page (in each page's <style> block) so it can override the page's
// own font-family declarations at high specificity; this script only
// toggles the attribute and paints the picker UI.

(function () {
  var KEY = "sirius-font";
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  var initial = saved === "ubuntu" ? "ubuntu" : "fraunces";
  if (initial === "ubuntu") document.documentElement.setAttribute("data-font-cmp", "ubuntu");

  // Inject the picker into the topnav's right side when one exists.
  // Falls back to a fixed-position pill (bottom-right) for pages without
  // a topnav, so the choice is always available.
  function paintPicker() {
    var nav = document.querySelector(".topnav");
    var host = nav || document.body;
    var mount = document.createElement("div");
    mount.className = "font-picker";
    mount.setAttribute("role", "group");
    mount.setAttribute("aria-label", "Reading font");
    mount.innerHTML =
      '<button data-font="fraunces" title="Silent Mode family (Fraunces)">Fraunces</button>' +
      '<button data-font="ubuntu" title="Bitcoin Cash brand font (Ubuntu)">Ubuntu</button>';
    if (nav) {
      // Put it just before the sign-in link if present, else append.
      var portalLink = nav.querySelector("a.portal");
      if (portalLink) nav.insertBefore(mount, portalLink);
      else nav.appendChild(mount);
    } else {
      mount.classList.add("font-picker-float");
      host.appendChild(mount);
    }
    var btns = mount.querySelectorAll("button");
    function refresh(v) {
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle("active", btns[i].dataset.font === v);
      }
    }
    refresh(initial);
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function (e) {
        var v = e.currentTarget.dataset.font;
        if (v === "ubuntu") document.documentElement.setAttribute("data-font-cmp", "ubuntu");
        else document.documentElement.removeAttribute("data-font-cmp");
        try { localStorage.setItem(KEY, v); } catch (e2) { /* ignore */ }
        refresh(v);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", paintPicker);
  } else {
    paintPicker();
  }
})();
