/**
 * Premium URL Shortener — Node.js API client (API v1). Zero dependencies (Node 18+ fetch).
 *
 *   const { PremiumURLShortener } = require("./client");
 *   const api = new PremiumURLShortener({ baseUrl: "https://sho.rt", apiKey: "YOUR_API_KEY" });
 *   const link = await api.links.create({ url: "https://example.com", custom: "sale" });
 *   console.log(link.short);
 *   const stats = await api.links.stats(link.id, { days: 7 });
 *
 * Every method resolves with the `data` part of the API envelope (or the whole envelope for paginated lists)
 * and rejects with an `ApiError` ({ status, message, body }) when `error: 1` is returned.
 */
"use strict";

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

class PremiumURLShortener {
  /**
   * @param {{ baseUrl: string, apiKey?: string, timeoutMs?: number, fetch?: typeof fetch }} options
   */
  constructor(options) {
    if (!options || !options.baseUrl) throw new Error("baseUrl is required");
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey || "";
    this.timeoutMs = options.timeoutMs || 15000;
    this.fetch = options.fetch || globalThis.fetch;
    if (!this.fetch) throw new Error("fetch is not available; pass options.fetch or use Node 18+");

    const enc = encodeURIComponent;
    const self = this;
    const list = (path) => (query) => self.request("GET", path, { query });
    const crud = (base) => ({
      list: list(base),
      get: (id) => self.request("GET", `${base}/${enc(id)}`).then(unwrap),
      create: (fields) => self.request("POST", base, { body: fields }).then(unwrap),
      update: (id, fields) => self.request("PUT", `${base}/${enc(id)}`, { body: fields }).then(unwrap),
      delete: (id) => self.request("DELETE", `${base}/${enc(id)}`).then(unwrap),
    });

    this.account = {
      get: () => self.request("GET", "/api/v1/account").then(unwrap),
      update: (fields) => self.request("PUT", "/api/v1/account", { body: fields }).then(unwrap),
    };
    this.links = Object.assign(crud("/api/v1/links"), {
      /** Shorthand: returns the short URL string. */
      shorten: (url, fields) => self.request("POST", "/api/v1/links", { body: Object.assign({ url }, fields || {}) }).then((r) => r.short || (r.data && r.data.short)),
      stats: (id, query) => self.request("GET", `/api/v1/links/${enc(id)}/stats`, { query }).then(unwrap),
      clicks: (id, query) => self.request("GET", `/api/v1/links/${enc(id)}/clicks`, { query }),
      bulk: (urls, defaults) => self.request("POST", "/api/v1/links/bulk", { body: Object.assign({}, defaults || {}, { urls }) }),
      archive: (id, archived = true) => self.request("POST", `/api/v1/links/${enc(id)}/archive`, { body: { archived } }).then(unwrap),
    });
    this.campaigns = Object.assign(crud("/api/v1/campaigns"), {
      addLinks: (id, links) => self.request("POST", `/api/v1/campaigns/${enc(id)}/links`, { body: { links } }).then(unwrap),
      removeLinks: (id, links) => self.request("DELETE", `/api/v1/campaigns/${enc(id)}/links`, { body: { links } }).then(unwrap),
      stats: (id, query) => self.request("GET", `/api/v1/campaigns/${enc(id)}/stats`, { query }).then(unwrap),
    });
    this.channels = Object.assign(crud("/api/v1/channels"), {
      assign: (id, { links, qr, bio }) => self.request("POST", `/api/v1/channels/${enc(id)}/assign`, { body: { links, qr, bio } }).then(unwrap),
    });
    this.pixels = crud("/api/v1/pixels");
    this.domains = crud("/api/v1/domains");
    this.splash = { list: list("/api/v1/splash") };
    this.overlays = { list: list("/api/v1/overlays") };
    this.qr = Object.assign(crud("/api/v1/qr"), {
      stats: (id, query) => self.request("GET", `/api/v1/qr/${enc(id)}/stats`, { query }).then(unwrap),
      imageUrl: (id, format = "svg") => `${self.baseUrl}/api/v1/qr/${enc(id)}/image?format=${enc(format)}&key=${enc(self.apiKey)}`,
    });
    this.bio = Object.assign(crud("/api/v1/bio"), {
      stats: (id, query) => self.request("GET", `/api/v1/bio/${enc(id)}/stats`, { query }).then(unwrap),
      blocks: {
        list: (id) => self.request("GET", `/api/v1/bio/${enc(id)}/blocks`).then(unwrap),
        create: (id, block) => self.request("POST", `/api/v1/bio/${enc(id)}/blocks`, { body: block }).then(unwrap),
        update: (id, blockId, fields) => self.request("PUT", `/api/v1/bio/${enc(id)}/blocks/${enc(blockId)}`, { body: fields }).then(unwrap),
        delete: (id, blockId) => self.request("DELETE", `/api/v1/bio/${enc(id)}/blocks/${enc(blockId)}`).then(unwrap),
      },
    });
    this.files = { list: list("/api/v1/files"), get: (id) => self.request("GET", `/api/v1/files/${enc(id)}`).then(unwrap), delete: (id) => self.request("DELETE", `/api/v1/files/${enc(id)}`).then(unwrap) };
    this.teams = { list: () => self.request("GET", "/api/v1/teams").then(unwrap) };
    this.users = crud("/api/v1/users"); // admin only
    this.plans = { list: () => self.request("GET", "/api/v1/plans").then(unwrap) }; // admin only
    this.payments = { list: list("/api/v1/payments") }; // admin only
  }

  /** Public: resolve a short URL or alias to its destination. */
  async unshorten(url) {
    return this.request("GET", "/api/unshorten", { query: { url }, auth: false });
  }

  /**
   * Low-level request. Resolves with the parsed envelope; rejects with ApiError on `error: 1` or network failure.
   * @param {"GET"|"POST"|"PUT"|"DELETE"} method
   * @param {string} path
   * @param {{ query?: Record<string, any>, body?: any, auth?: boolean }} [opts]
   */
  async request(method, path, opts = {}) {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query || {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    const headers = { accept: "application/json", "user-agent": "PremiumURLShortener-Node/1.0" };
    if (opts.auth !== false) {
      if (!this.apiKey) throw new ApiError("apiKey is required for this call", 401, null);
      headers.authorization = `Bearer ${this.apiKey}`;
    }
    let body;
    if (opts.body !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.body); }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res;
    try {
      res = await this.fetch(url.toString(), { method, headers, body, signal: controller.signal, redirect: "manual" });
    } catch (e) {
      throw new ApiError(e && e.name === "AbortError" ? "Request timed out" : (e && e.message) || "Network error", 0, null);
    } finally { clearTimeout(timer); }
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { error: res.ok ? 0 : 1, message: text }; }
    if (!res.ok || json.error) throw new ApiError(json.message || `HTTP ${res.status}`, res.status, json);
    return json;
  }
}

function unwrap(r) { return r && r.data !== undefined ? r.data : r; }

module.exports = { PremiumURLShortener, ApiError };
module.exports.default = PremiumURLShortener;
