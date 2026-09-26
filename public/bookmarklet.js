/*
 * Premium URL Shortener bookmarklet.
 * Install: drag this to your bookmarks bar (or create a bookmark with the URL below):
 *   javascript:(function(){var s=document.createElement('script');s.src='https://YOUR-DOMAIN/bookmarklet.js?'+Date.now();document.body.appendChild(s);})();
 * It shortens the current page through GET /api/shorten?url=&format=text using your logged-in session
 * (anonymous shortening works too when the site allows it) and shows a small panel with a copy button.
 */
(function () {
  var script = document.currentScript || (function () { var s = document.getElementsByTagName("script"); return s[s.length - 1]; })();
  var base = "";
  try { base = new URL(script.src).origin; } catch (e) { base = window.location.origin; }
  var pageUrl = window.location.href;
  var ID = "pus-bookmarklet-panel";
  var old = document.getElementById(ID);
  if (old) old.parentNode.removeChild(old);

  var panel = document.createElement("div");
  panel.id = ID;
  panel.setAttribute("style", "position:fixed;top:16px;right:16px;z-index:2147483647;width:340px;max-width:calc(100vw - 32px);background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:16px;box-sizing:border-box");
  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
    '<strong style="font-size:15px">Shorten this page</strong>' +
    '<button id="pus-close" style="border:0;background:transparent;font-size:18px;cursor:pointer;color:#64748b">&times;</button></div>' +
    '<div id="pus-status" style="color:#64748b">Shortening&hellip;</div>' +
    '<div id="pus-result" style="display:none;margin-top:8px">' +
    '<input id="pus-short" readonly style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;color:#0f172a;background:#f8fafc" />' +
    '<div style="display:flex;gap:8px;margin-top:10px">' +
    '<button id="pus-copy" style="flex:1;padding:8px 12px;border:0;border-radius:8px;background:#6366f1;color:#fff;font-weight:600;cursor:pointer">Copy</button>' +
    '<a id="pus-open" target="_blank" rel="noopener" style="flex:1;text-align:center;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;color:#0f172a;text-decoration:none;font-weight:600">Open</a>' +
    '</div></div>';
  document.body.appendChild(panel);

  var status = document.getElementById("pus-status");
  var result = document.getElementById("pus-result");
  var input = document.getElementById("pus-short");
  var copyBtn = document.getElementById("pus-copy");
  var openLink = document.getElementById("pus-open");
  document.getElementById("pus-close").onclick = function () { panel.parentNode.removeChild(panel); };

  function fail(msg) { status.style.color = "#ef4444"; status.textContent = msg; }
  function copy() {
    var done = function () { copyBtn.textContent = "Copied!"; setTimeout(function () { copyBtn.textContent = "Copy"; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(input.value).then(done, function () { input.select(); document.execCommand("copy"); done(); });
    else { input.select(); document.execCommand("copy"); done(); }
  }
  copyBtn.onclick = copy;

  var endpoint = base + "/api/shorten?format=text&url=" + encodeURIComponent(pageUrl);
  fetch(endpoint, { credentials: "include", headers: { "X-Requested-With": "bookmarklet" } })
    .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, text: t }; }); })
    .then(function (r) {
      if (!r.ok || /^Error:/i.test(r.text) || !/^https?:\/\//.test(r.text.trim())) return fail(r.text.replace(/^Error:\s*/i, "") || "Could not shorten this page.");
      var short = r.text.trim();
      status.textContent = "Your short link is ready:";
      status.style.color = "#10b981";
      input.value = short;
      openLink.href = short;
      result.style.display = "block";
      copy();
    })
    .catch(function () {
      // Fallback for sites with a strict Content-Security-Policy: open the shortener in a popup.
      window.open(base + "/?url=" + encodeURIComponent(pageUrl), "pus_popup", "width=640,height=520");
      fail("Opened the shortener in a new window.");
    });
})();
