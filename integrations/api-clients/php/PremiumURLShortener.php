<?php
/**
 * Premium URL Shortener — PHP API client (API v1).
 *
 * Mirrors the legacy wrapper (setURL/setKey/shorten/setCustom/setFormat/unshorten/getShort/stats/...) but talks to /api/v1.
 *
 *   require "PremiumURLShortener.php";
 *   $api = new PremiumURLShortener("https://sho.rt", "YOUR_API_KEY");
 *   $api->setCustom("sale");
 *   echo $api->shorten("https://example.com/spring-sale");      // https://sho.rt/sale
 *   print_r($api->stats("clx1abc", 7));
 *
 * Requires PHP 7.4+ with cURL (falls back to file_get_contents when allow_url_fopen is on).
 */
class PremiumURLShortener
{
    /** @var string */
    private $url = "";
    /** @var string */
    private $key = "";
    /** @var string|null */
    private $custom = null;
    /** @var string|null */
    private $domain = null;
    /** @var string */
    private $type = "direct";
    /** @var string|null */
    private $password = null;
    /** @var string|null */
    private $expiry = null;
    /** @var string */
    private $format = "text";
    /** @var array<string,mixed> */
    private $extra = [];
    /** @var array<string,mixed>|null */
    public $lastResponse = null;
    /** @var string|null */
    public $lastError = null;
    /** @var int */
    public $timeout = 15;

    public function __construct(string $url = "", string $key = "")
    {
        if ($url) $this->setURL($url);
        if ($key) $this->setKey($key);
    }

    /** Base URL of your installation, e.g. https://sho.rt */
    public function setURL(string $url): self { $this->url = rtrim($url, "/"); return $this; }
    public function setKey(string $key): self { $this->key = $key; return $this; }
    /** Custom alias used by the next shorten() call. */
    public function setCustom(?string $custom): self { $this->custom = $custom; return $this; }
    /** Domain id or hostname of one of your custom domains. */
    public function setDomain(?string $domain): self { $this->domain = $domain; return $this; }
    /** direct | frame | splash | custom | overlay */
    public function setType(string $type): self { $this->type = $type; return $this; }
    public function setPassword(?string $password): self { $this->password = $password; return $this; }
    /** ISO date or unix timestamp */
    public function setExpiry(?string $expiry): self { $this->expiry = $expiry; return $this; }
    /** "text" → shorten() returns the short URL string; "json" → shorten() returns the decoded response array. */
    public function setFormat(string $format): self { $this->format = strtolower($format) === "json" ? "json" : "text"; return $this; }
    /** Any additional create-link fields (geotarget, devicetarget, utm, params, pixels, campaign, ...). */
    public function setOptions(array $options): self { $this->extra = $options; return $this; }

    // ---------------------------------------------------------------- links

    /** Shortens a URL. Returns the short URL (format=text) or the full response array (format=json); false on error. */
    public function shorten(string $longUrl)
    {
        $body = array_merge($this->extra, ["url" => $longUrl, "type" => $this->type]);
        if ($this->custom) $body["custom"] = $this->custom;
        if ($this->domain) $body["domain"] = $this->domain;
        if ($this->password) $body["password"] = $this->password;
        if ($this->expiry) $body["expiry"] = $this->expiry;
        $res = $this->request("POST", "/api/v1/links", $body);
        $this->custom = null; // one-shot
        if (!$res || !empty($res["error"])) return false;
        return $this->format === "json" ? $res : ($res["short"] ?? ($res["data"]["short"] ?? false));
    }

    /** Alias of shorten() returning only the short URL. */
    public function getShort(string $longUrl)
    {
        $prev = $this->format; $this->format = "text";
        $r = $this->shorten($longUrl);
        $this->format = $prev;
        return $r;
    }

    /** Resolves a short URL/alias to its destination (public endpoint, no key needed). Returns the long URL or false. */
    public function unshorten(string $shortUrl)
    {
        $res = $this->request("GET", "/api/unshorten", null, ["url" => $shortUrl], false);
        if (!$res || !empty($res["error"])) return false;
        return $this->format === "json" ? $res : ($res["url"] ?? false);
    }

    /** Link details by id or alias. */
    public function getLink(string $id) { return $this->data($this->request("GET", "/api/v1/links/" . rawurlencode($id))); }
    /** Lists links: ['search'=>, 'order'=>'date|clicks', 'campaign'=>, 'page'=>, 'limit'=>]. */
    public function links(array $query = []) { return $this->request("GET", "/api/v1/links", null, $query); }
    public function updateLink(string $id, array $fields) { return $this->data($this->request("PUT", "/api/v1/links/" . rawurlencode($id), $fields)); }
    public function deleteLink(string $id) { $r = $this->request("DELETE", "/api/v1/links/" . rawurlencode($id)); return $r && empty($r["error"]); }
    /** Click statistics for a link over the last $days days. */
    public function stats(string $id, int $days = 30) { return $this->data($this->request("GET", "/api/v1/links/" . rawurlencode($id) . "/stats", null, ["days" => $days])); }
    public function clicks(string $id, int $page = 1, int $limit = 50) { return $this->request("GET", "/api/v1/links/" . rawurlencode($id) . "/clicks", null, ["page" => $page, "limit" => $limit]); }
    /** Bulk create: array of URL strings or link arrays. Returns the full response (data + failed). */
    public function bulk(array $urls, array $defaults = []) { return $this->request("POST", "/api/v1/links/bulk", array_merge($defaults, ["urls" => $urls])); }

    // ---------------------------------------------------------------- other resources

    public function account() { return $this->data($this->request("GET", "/api/v1/account")); }
    public function campaigns(array $query = []) { return $this->request("GET", "/api/v1/campaigns", null, $query); }
    public function createCampaign(array $fields) { return $this->data($this->request("POST", "/api/v1/campaigns", $fields)); }
    public function campaignStats(string $id, int $days = 30) { return $this->data($this->request("GET", "/api/v1/campaigns/" . rawurlencode($id) . "/stats", null, ["days" => $days])); }
    public function domains() { return $this->request("GET", "/api/v1/domains"); }
    public function pixels() { return $this->request("GET", "/api/v1/pixels"); }
    public function qrCodes(array $query = []) { return $this->request("GET", "/api/v1/qr", null, $query); }
    public function createQr(array $fields) { return $this->data($this->request("POST", "/api/v1/qr", $fields)); }
    public function bioPages(array $query = []) { return $this->request("GET", "/api/v1/bio", null, $query); }
    public function createBio(array $fields) { return $this->data($this->request("POST", "/api/v1/bio", $fields)); }

    // ---------------------------------------------------------------- admin

    /** Admin: create a user. $fields = ['username','email','password','planId','planExpires','role','name'] */
    public function createUser(array $fields) { return $this->data($this->request("POST", "/api/v1/users", $fields)); }
    /** Admin: user by id, username or email. */
    public function getUser(string $id) { return $this->data($this->request("GET", "/api/v1/users/" . rawurlencode($id))); }
    public function updateUser(string $id, array $fields) { return $this->data($this->request("PUT", "/api/v1/users/" . rawurlencode($id), $fields)); }
    public function deleteUser(string $id) { $r = $this->request("DELETE", "/api/v1/users/" . rawurlencode($id)); return $r && empty($r["error"]); }
    public function users(array $query = []) { return $this->request("GET", "/api/v1/users", null, $query); }
    public function plans() { return $this->data($this->request("GET", "/api/v1/plans")); }
    public function payments(array $query = []) { return $this->request("GET", "/api/v1/payments", null, $query); }

    // ---------------------------------------------------------------- transport

    /** @return array<string,mixed>|false */
    private function data($res) { return $res && empty($res["error"]) ? ($res["data"] ?? $res) : false; }

    /**
     * Generic request; returns the decoded JSON array or false (see $lastError).
     * @return array<string,mixed>|false
     */
    public function request(string $method, string $path, ?array $body = null, array $query = [], bool $auth = true)
    {
        $this->lastError = null;
        if (!$this->url) { $this->lastError = "Base URL not set"; return false; }
        if ($auth && !$this->key) { $this->lastError = "API key not set"; return false; }
        $endpoint = $this->url . $path . ($query ? "?" . http_build_query($query) : "");
        $headers = ["Accept: application/json", "User-Agent: PremiumURLShortener-PHP/1.0"];
        if ($auth) $headers[] = "Authorization: Bearer " . $this->key;
        $payload = null;
        if ($body !== null) { $headers[] = "Content-Type: application/json"; $payload = json_encode($body); }

        if (function_exists("curl_init")) {
            $ch = curl_init($endpoint);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => $this->timeout, CURLOPT_FOLLOWLOCATION => false,
            ]);
            if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            $raw = curl_exec($ch);
            if ($raw === false) { $this->lastError = curl_error($ch); curl_close($ch); return false; }
            curl_close($ch);
        } else {
            $ctx = stream_context_create(["http" => ["method" => $method, "header" => implode("\r\n", $headers), "content" => $payload ?? "", "timeout" => $this->timeout, "ignore_errors" => true]]);
            $raw = @file_get_contents($endpoint, false, $ctx);
            if ($raw === false) { $this->lastError = "Request failed"; return false; }
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) { $this->lastError = "Invalid JSON response"; return false; }
        $this->lastResponse = $decoded;
        if (!empty($decoded["error"])) $this->lastError = $decoded["message"] ?? "API error";
        return $decoded;
    }
}
