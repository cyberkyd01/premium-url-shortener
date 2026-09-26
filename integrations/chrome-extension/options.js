/* Options page: stores the site URL and API key in chrome.storage.sync and verifies them against /api/v1/account. */
(async function () {
  const siteUrl = document.getElementById("siteUrl");
  const apiKey = document.getElementById("apiKey");
  const status = document.getElementById("status");
  const saved = await chrome.storage.sync.get({ siteUrl: "", apiKey: "" });
  siteUrl.value = saved.siteUrl;
  apiKey.value = saved.apiKey;

  document.getElementById("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const base = siteUrl.value.trim().replace(/\/$/, "");
    const key = apiKey.value.trim();
    status.className = ""; status.textContent = "Testing…";
    try {
      const r = await fetch(base + "/api/v1/account", { headers: { Authorization: "Bearer " + key } });
      const j = await r.json().catch(() => ({ error: 1, message: "Invalid response (HTTP " + r.status + ")" }));
      if (j.error) throw new Error(j.message || "Could not authenticate");
      await chrome.storage.sync.set({ siteUrl: base, apiKey: key });
      await chrome.storage.local.remove(["domains", "domainsAt"]);
      status.className = "ok";
      status.textContent = "Saved. Connected as " + (j.data.username || j.data.email) + (j.data.plan ? " (" + j.data.plan.name + " plan)" : "") + ".";
    } catch (err) {
      status.className = "error";
      status.textContent = err.message || "Connection failed";
    }
  });
})();
