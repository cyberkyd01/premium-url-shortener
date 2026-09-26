# Integrations

Ready-made integrations for a Premium URL Shortener installation. Every integration talks to the REST API
(`/api/v1`, documented at `/developers` on your site and in `docs/API.md`) using an API key created under
**Dashboard → Settings → API**.

| Folder | What it is |
| --- | --- |
| `wordpress/premium-url-shortener/` | WordPress plugin: settings page (site URL + API key), `[shortlink]` shortcode, automatic short links when posts are published (stored in post meta), `wp_get_shortlink()` override, side meta box with a create/regenerate button, `pus_shorten()` template helper. Zip the folder and upload it under Plugins → Add New. |
| `chrome-extension/` | Chrome / Edge / Brave extension (Manifest V3): popup that shortens the current tab with optional alias and domain, history of the last 10 links with copy, context menu "Shorten this page / link / selected URL", options page storing site URL + API key. Add icons (see `icons/README.md`), then *Load unpacked* at `chrome://extensions`. |
| `api-clients/php/PremiumURLShortener.php` | Dependency-free PHP class mirroring the legacy wrapper (`setURL`, `setKey`, `setCustom`, `setFormat`, `shorten`, `getShort`, `unshorten`, `stats`, `account`, `createUser`, `getUser`, …). |
| `api-clients/node/client.js` | Zero-dependency Node.js (18+) client with `links`, `campaigns`, `channels`, `pixels`, `domains`, `qr`, `bio`, `files`, `teams`, `users`, `plans`, `payments` namespaces. |
| `zapier/README.md` | How to receive webhook events in Zapier (and Make/n8n) and how to create links from a Zap. |
| `../public/bookmarklet.js` | Bookmarklet served by the app at `/bookmarklet.js`: shortens the current page via `GET /api/shorten?format=text` with the visitor's session and copies the result. |

## Slack

Enable Slack under **Admin → Settings → Integrations** (signing secret or verification token), create a Slack app with a
slash command (for example `/shorten`) whose *Request URL* is `https://YOUR-DOMAIN/api/webhook/slack`, and let users
connect their Slack identity under **Dashboard → Tools** (they paste the team and user ids that the command replies with;
this stores a `Webhook` row with provider `slack`, url `slack` and secret `TEAM_ID:USER_ID`). Then `/shorten <url> [alias]`.

## Docker & cron

`Dockerfile` and `docker-compose.yml` in the project root run the app plus a cron sidecar that calls every
`/api/cron/<job>` endpoint every 10 minutes (`pnpm cron --loop 10`). For classic crontab use:

```
*/10 * * * * cd /path/to/app && pnpm cron >> storage/cron.log 2>&1
```
