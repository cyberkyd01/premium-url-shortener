/*! Premium URL Shortener conversion tracker
 * Embed: <script src="https://your-domain/conv.js" data-link="ALIAS" data-goal="signup" data-value="10" async></script>
 * Manual: add data-manual="1" and call window.pus('convert', { goal: 'purchase', value: 49.99 })
 * Attribution: an explicit clickId (?pus_c= in the page URL, or the pus_click cookie) is used when present;
 * otherwise the server attributes to the visitor's most recent click on the link within 7 days.
 */
(function () {
  if (window.pus && window.pus.__loaded) return;
  var script = document.currentScript || (function () { var s = document.getElementsByTagName("script"); for (var i = s.length - 1; i >= 0; i--) if (/\/conv\.js(\?|$)/.test(s[i].src)) return s[i]; return null; })();
  var base = "";
  try { base = script ? new URL(script.src).origin : ""; } catch (e) { base = ""; }
  var defaults = { link: script && (script.getAttribute("data-link") || script.getAttribute("data-alias")), linkId: script && script.getAttribute("data-link-id"), goal: script && script.getAttribute("data-goal"), value: script && script.getAttribute("data-value") };
  var manual = !!(script && script.getAttribute("data-manual"));

  function clickId() {
    try {
      var m = /[?&]pus_c=([^&#]+)/.exec(window.location.search);
      if (m) return decodeURIComponent(m[1]);
      var c = document.cookie.split(";");
      for (var i = 0; i < c.length; i++) {
        var kv = c[i].trim().split("=");
        if (kv[0] === "pus_click") { var v = JSON.parse(decodeURIComponent(kv.slice(1).join("="))); return v && v.c ? v.c : null; }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  var sent = {};
  function convert(opts) {
    opts = opts || {};
    var payload = {
      alias: opts.link || opts.alias || defaults.link || null,
      linkId: opts.linkId || defaults.linkId || null,
      goal: opts.goal || defaults.goal || "conversion",
      value: Number(opts.value != null ? opts.value : defaults.value) || 0,
      clickId: opts.clickId || clickId(),
      meta: opts.meta || { page: window.location.href.slice(0, 500), title: (document.title || "").slice(0, 200) },
    };
    if (!payload.alias && !payload.linkId) { if (window.console) console.warn("[pus] conv.js: missing data-link (alias) or data-link-id"); return; }
    var key = payload.alias + "|" + payload.goal + "|" + payload.value;
    if (sent[key] && !opts.force) return;
    sent[key] = true;
    var url = base + "/api/conv";
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
    } catch (e) { /* fall through */ }
    try {
      if (window.fetch) { fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body, keepalive: true, mode: "cors", credentials: "omit" }).catch(function () {}); return; }
    } catch (e) { /* fall through */ }
    var img = new Image(1, 1);
    img.src = base + "/api/conv/pixel.gif?" + "alias=" + encodeURIComponent(payload.alias || "") + "&linkId=" + encodeURIComponent(payload.linkId || "") + "&goal=" + encodeURIComponent(payload.goal) + "&value=" + payload.value + (payload.clickId ? "&clickId=" + encodeURIComponent(payload.clickId) : "");
  }

  var queue = window.pus && window.pus.q ? window.pus.q : [];
  function pus(cmd, arg) {
    if (cmd === "convert" || cmd === "track") convert(arg);
    else if (cmd === "config") { for (var k in arg || {}) defaults[k] = arg[k]; }
  }
  pus.__loaded = true;
  window.pus = pus;
  for (var i = 0; i < queue.length; i++) pus.apply(null, queue[i]);
  if (!manual && (defaults.link || defaults.linkId)) {
    if (document.readyState === "complete" || document.readyState === "interactive") convert();
    else document.addEventListener("DOMContentLoaded", function () { convert(); });
  }
})();
