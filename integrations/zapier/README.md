# Zapier integration

Premium URL Shortener works with Zapier (and any automation tool such as Make, n8n or Pabbly) through two mechanisms:

1. **Webhooks (triggers)** – the shortener calls your Zap when something happens.
2. **REST API (actions)** – your Zap calls the shortener to create links, QR codes, bio pages…

## 1. Triggers: receive events in Zapier

1. In Zapier create a Zap and choose **Webhooks by Zapier → Catch Hook**. Copy the hook URL.
2. In the shortener open **Dashboard → Tools → Webhooks** (plan feature `webhooks`), click *Add webhook*, paste the URL,
   choose a provider of `zapier` and tick the events you want:

| Event | When |
| --- | --- |
| `link.created` | A short link was created (dashboard, API, Slack, bulk import) |
| `link.clicked` | A link received a click (bots excluded) |
| `link.updated` / `link.deleted` | A link was edited / removed |
| `bio.viewed` | A bio page was viewed |
| `qr.scanned` | A dynamic QR code was scanned |

3. Optionally set a **secret**. Every delivery then carries an `X-Signature` header equal to
   `hex(HMAC-SHA256(secret, rawBody))` so you can verify authenticity (Zapier Code step or your own endpoint).
4. Fire a test event (create a link) and map the payload fields in the next Zap steps.

### Payload samples

```json
{ "event": "link.created", "data": { "id": "clx1abc", "alias": "sale", "short": "https://sho.rt/sale", "url": "https://example.com/spring-sale" }, "timestamp": "2026-03-01T10:00:00.000Z" }
```

```json
{ "event": "link.clicked", "data": { "id": "clx1abc", "alias": "sale", "country": "US", "device": "mobile", "referer": "twitter.com" }, "timestamp": "2026-03-02T09:12:00.000Z" }
```

```json
{ "event": "bio.viewed", "data": { "id": "clxb", "alias": "jane", "country": "DE", "device": "desktop" }, "timestamp": "2026-03-02T09:12:00.000Z" }
```

```json
{ "event": "qr.scanned", "data": { "id": "clxq", "alias": "Qx8Ab2Cd", "country": "FR", "device": "mobile" }, "timestamp": "2026-03-02T09:12:00.000Z" }
```

Deliveries time out after 5 seconds and are not retried, so acknowledge quickly (Zapier does this automatically).

## 2. Actions: create links from Zapier

Use **Webhooks by Zapier → Custom Request** (or *POST*):

- URL: `https://YOUR-DOMAIN/api/v1/links`
- Method: `POST`
- Headers: `Authorization: Bearer YOUR_API_KEY`, `Content-Type: application/json`
- Data (raw JSON):

```json
{ "url": "{{long_url_from_previous_step}}", "custom": "{{optional_alias}}", "campaign": "spring", "utm": { "source": "zapier" } }
```

The response contains `short` (the short URL) and `data` (the full link object) which you can use in later steps.
Other useful actions: `POST /api/v1/qr`, `POST /api/v1/bio/:id/blocks`, `GET /api/v1/links/:id/stats`.
See `/developers` on your installation or `docs/API.md` for the full reference.

## Example Zaps

- New WordPress post → create short link → post it to Twitter/X / LinkedIn / Buffer.
- New row in Google Sheets → bulk create links via `POST /api/v1/links/bulk` → write the short URLs back.
- `link.clicked` → append to Google Sheets / send Slack message for high-value campaigns.
- `qr.scanned` → add a lead in your CRM with the scan country.
