/* Service worker: context menus "Shorten this page" / "Shorten this link" + install defaults. */

const MENU_PAGE = "pus-shorten-page";
const MENU_LINK = "pus-shorten-link";
const MENU_SELECTION = "pus-shorten-selection";
const HISTORY_MAX = 10;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_PAGE, title: "Shorten this page", contexts: ["page"] });
    chrome.contextMenus.create({ id: MENU_LINK, title: "Shorten this link", contexts: ["link"] });
    chrome.contextMenus.create({ id: MENU_SELECTION, title: "Shorten selected URL", contexts: ["selection"] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let url = "";
  if (info.menuItemId === MENU_LINK) url = info.linkUrl || "";
  else if (info.menuItemId === MENU_SELECTION) url = (info.selectionText || "").trim();
  else url = info.pageUrl || (tab && tab.url) || "";
  if (!url) return;
  if (info.menuItemId === MENU_SELECTION && !/^https?:\/\//i.test(url)) url = "https://" + url;
  await shortenAndNotify(url, tab);
});

async function shortenAndNotify(url, tab) {
  const { siteUrl, apiKey } = await chrome.storage.sync.get({ siteUrl: "", apiKey: "" });
  if (!siteUrl || !apiKey) { chrome.runtime.openOptionsPage(); return; }
  const base = siteUrl.replace(/\/$/, "");
  const { lastDomain } = await chrome.storage.local.get({ lastDomain: "" });
  try {
    const body = { url };
    if (lastDomain) body.domain = lastDomain;
    const r = await fetch(base + "/api/v1/links", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({ error: 1, message: "Invalid response (HTTP " + r.status + ")" }));
    if (j.error) throw new Error(j.message || "Request failed");
    const short = j.short || (j.data && j.data.short);
    const entry = { id: j.id || (j.data && j.data.id), short, url, at: Date.now() };
    const { history = [] } = await chrome.storage.local.get({ history: [] });
    await chrome.storage.local.set({ history: [entry, ...history.filter((h) => h.short !== short)].slice(0, HISTORY_MAX) });
    await copyToClipboard(short, tab);
    notify("Short link copied", short);
  } catch (e) {
    notify("Could not shorten", (e && e.message) || "Unknown error");
  }
}

/** Service workers have no DOM clipboard; write it through the active tab when possible, else via the offscreen-less fallback (popup shows it anyway). */
async function copyToClipboard(text, tab) {
  try {
    if (tab && tab.id != null && /^https?:/.test(tab.url || "")) {
      await chrome.scripting?.executeScript?.({ target: { tabId: tab.id }, func: (t) => navigator.clipboard.writeText(t), args: [text] });
      return;
    }
  } catch { /* fall through */ }
  await chrome.storage.local.set({ pendingCopy: text });
}

function notify(title, message) {
  chrome.notifications.create({ type: "basic", iconUrl: "icons/icon128.png", title, message: String(message).slice(0, 200) }, () => void chrome.runtime.lastError);
}
