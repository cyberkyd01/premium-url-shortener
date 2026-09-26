/* Popup: shortens the current tab (or any URL) through POST /api/v1/links and keeps the last 10 results. */
(async function () {
  const $ = (id) => document.getElementById(id);
  const form = $("form"), urlInput = $("url"), aliasInput = $("alias"), domainSelect = $("domain"), submit = $("submit");
  const result = $("result"), shortEl = $("short"), status = $("status"), historyEl = $("history"), setup = $("setup");
  const HISTORY_MAX = 10;

  const settings = await chrome.storage.sync.get({ siteUrl: "", apiKey: "" });
  const configured = !!(settings.siteUrl && settings.apiKey);
  const openOptions = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };
  $("open-options").addEventListener("click", openOptions);
  $("open-options-2").addEventListener("click", openOptions);
  if (!configured) { setup.style.display = "block"; form.style.display = "none"; }

  const base = (settings.siteUrl || "").replace(/\/$/, "");
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + settings.apiKey };

  function setStatus(msg, kind) { status.textContent = msg || ""; status.className = kind || ""; }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok; }
  }

  // Prefill with the current tab (or a URL handed over by the context menu).
  const { pendingUrl } = await chrome.storage.local.get({ pendingUrl: "" });
  if (pendingUrl) { urlInput.value = pendingUrl; chrome.storage.local.remove("pendingUrl"); }
  else {
    try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (tab && /^https?:/.test(tab.url || "")) urlInput.value = tab.url; } catch { /* ignore */ }
  }

  // Domains for the select (cached for an hour).
  async function loadDomains() {
    if (!configured) return;
    const cache = await chrome.storage.local.get({ domains: null, domainsAt: 0 });
    let domains = cache.domains;
    if (!domains || Date.now() - cache.domainsAt > 3600e3) {
      try {
        const r = await fetch(base + "/api/v1/domains?limit=100", { headers });
        const j = await r.json();
        domains = j.error ? [] : j.data;
        chrome.storage.local.set({ domains, domainsAt: Date.now() });
      } catch { domains = []; }
    }
    for (const d of domains || []) {
      if (d.status !== "active") continue;
      const opt = document.createElement("option");
      opt.value = d.id; opt.textContent = d.domain;
      domainSelect.appendChild(opt);
    }
    const { lastDomain } = await chrome.storage.local.get({ lastDomain: "" });
    if (lastDomain) domainSelect.value = lastDomain;
  }
  loadDomains();

  async function renderHistory() {
    const { history = [] } = await chrome.storage.local.get({ history: [] });
    historyEl.innerHTML = "";
    if (!history.length) { historyEl.innerHTML = '<li style="color:var(--muted)">Nothing shortened yet.</li>'; return; }
    for (const h of history) {
      const li = document.createElement("li");
      li.innerHTML = '<div class="meta"><div class="s"></div><div class="l"></div></div><button type="button" class="ghost">Copy</button>';
      li.querySelector(".s").textContent = h.short;
      li.querySelector(".l").textContent = h.url;
      li.querySelector(".l").title = h.url;
      li.querySelector("button").addEventListener("click", async () => { await copyText(h.short); setStatus("Copied " + h.short, "ok"); });
      li.querySelector(".s").addEventListener("click", () => chrome.tabs.create({ url: h.short }));
      li.querySelector(".s").style.cursor = "pointer";
      historyEl.appendChild(li);
    }
  }
  renderHistory();
  $("clear").addEventListener("click", async () => { await chrome.storage.local.set({ history: [] }); renderHistory(); });

  let current = null;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!configured) return;
    const url = urlInput.value.trim();
    if (!url) return;
    submit.disabled = true; setStatus("Shortening…");
    result.style.display = "none";
    try {
      const body = { url };
      if (aliasInput.value.trim()) body.custom = aliasInput.value.trim();
      if (domainSelect.value) body.domain = domainSelect.value;
      chrome.storage.local.set({ lastDomain: domainSelect.value });
      const r = await fetch(base + "/api/v1/links", { method: "POST", headers, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({ error: 1, message: "Invalid response (HTTP " + r.status + ")" }));
      if (j.error) throw new Error(j.message || "Request failed");
      current = { id: j.id || j.data.id, short: j.short || j.data.short, url: j.url || j.data.url, at: Date.now() };
      shortEl.textContent = current.short;
      result.style.display = "block";
      const copied = await copyText(current.short);
      setStatus(copied ? "Copied to clipboard" : "Short link created", "ok");
      const { history = [] } = await chrome.storage.local.get({ history: [] });
      await chrome.storage.local.set({ history: [current, ...history.filter((h) => h.short !== current.short)].slice(0, HISTORY_MAX) });
      renderHistory();
      aliasInput.value = "";
    } catch (err) {
      setStatus(err.message || "Could not shorten this URL", "error");
    } finally {
      submit.disabled = false;
    }
  });

  $("copy").addEventListener("click", async () => { if (current) { await copyText(current.short); setStatus("Copied to clipboard", "ok"); } });
  $("open").addEventListener("click", () => { if (current) chrome.tabs.create({ url: current.short }); });
  $("qr").addEventListener("click", () => { if (current) chrome.tabs.create({ url: base + "/dashboard/links/" + encodeURIComponent(current.id) + "?tab=qr" }); });
})();
