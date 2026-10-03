# Deploy Premium URL Shortener on a VPS (over SSH)

At the end you'll have the shortener (Next.js + SQLite) running as a systemd service on `127.0.0.1:3101`. nginx sits in front with a free Let's Encrypt certificate at `https://your-domain`, or serves `http://SERVER_IP:8101` if you have no domain. The background jobs run on a systemd timer every 10 minutes. Updates take one command and roll back on their own if the new version fails, and the database is backed up before every update.

**Works on:** Ubuntu 22.04 / 24.04 LTS or Debian 12, on x86_64 or arm64. Log in as a user with `sudo`, or as root. On a minimal Debian where you are root and `sudo` is missing, run `apt-get install -y sudo` first.

**How to use this guide:** run the blocks in order and copy each one whole. You can safely run any block again. Every block reads its settings from `/etc/shortener/deploy.conf`, so a dropped SSH session costs you nothing: reconnect and carry on.

## At a glance

| | |
|---|---|
| Install directory | `/opt/shortener`: `releases/` holds the builds, `current` points at the live release, `shared/` holds the data |
| System user | `shortener` (no login shell) |
| Services | `shortener.service` (Next.js) and `shortener-cron.timer` → `shortener-cron.service`, which runs `scripts/cron.ts` every 10 minutes |
| Internal port | `127.0.0.1:3101` (never exposed) |
| Public URL | `https://DOMAIN`, or `http://SERVER_IP:8101` without a domain |
| Runtime | Node.js 22 and pnpm 11 in `/opt/shortener/runtime/node`. The system Node is untouched |
| Database | SQLite at `/opt/shortener/shared/data/app.db`. No database server and no Redis |
| Uploads | `/opt/shortener/shared/public/uploads`, served directly by nginx, plus `/opt/shortener/shared/storage` for the app's own backups and imports |
| Configuration | `/etc/shortener/deploy.conf` (deploy settings), `/opt/shortener/shared/.env` (app secrets) |
| Never touches | the system Node, npm or pnpm, other nginx sites, `nginx.conf`, the `default` site, other apps' ports and databases, the firewall policy |

## Requirements

- Ubuntu 22.04 / 24.04 or Debian 12, x86_64 or arm64, with `sudo`.
- At least 1 vCPU, **2 GB RAM** and 5 GB free disk. The Next.js build needs about 2.5 GB of memory: 2 GB of RAM plus the swap file from step 3 works, and so does 1 GB of RAM if you add 3 GB of swap (the build is then slow). 2 vCPU and 4 GB make builds faster.
- Outbound internet access to GitHub, nodejs.org, registry.npmjs.org and binaries.prisma.sh (Prisma downloads its engine).
- **Optional:** a domain or subdomain with a DNS **A record** pointing at the server's IPv4 address. If you also add an AAAA record, it must point at this server too.
- Access to the private GitHub repo `cyberkyd01/premium-url-shortener`. Step 6 sets up a read-only deploy key for it.
- **Optional, any time later:** SMTP credentials (until then, emails are only written to the log), plus OAuth, payment gateway, reCAPTCHA and AI keys. Most of these can also be entered in the admin panel.

## 1. Connect and set your variables

From your own computer:

```bash
ssh youruser@SERVER_IP
```

**Edit `DOMAIN`, `EMAIL` and `ADMIN_EMAIL` in the block below first**, then paste it. You can leave `DOMAIN` empty to use `http://SERVER_IP:8101`. This file is the only place you ever edit settings. The block won't overwrite an existing file. To change a value later, run `sudo nano /etc/shortener/deploy.conf` and re-run the step that uses it.

```bash
sudo mkdir -p /etc/shortener
if [ -f /etc/shortener/deploy.conf ]; then echo "deploy.conf already exists - edit it with: sudo nano /etc/shortener/deploy.conf"; else
sudo tee /etc/shortener/deploy.conf >/dev/null <<'EOF'
# Premium URL Shortener - deployment settings. The ONLY place to edit; every step reads this file.
APP=shortener
APP_USER=shortener
APP_HOME=/opt/shortener
REPO_URL=git@github.com:cyberkyd01/premium-url-shortener.git
BRANCH=main
PORT=3101            # internal port, bound to 127.0.0.1 only
PUBLIC_PORT=8101     # public port, used only when DOMAIN is empty
DOMAIN=""            # e.g. go.example.com - leave empty for http://SERVER_IP:8101
EMAIL=""             # for Let's Encrypt expiry notices (required when DOMAIN is set)
ADMIN_EMAIL=""       # first admin login; empty = EMAIL, or admin@example.com if both are empty
NODE_MAJOR=22        # Node.js major version (the project targets Node 22)
PNPM_VERSION=11      # pnpm major version (the lockfile and pnpm-workspace.yaml come from pnpm 11)
BUILD_MEMORY_MB=2048 # Node heap limit for the build (needs RAM + swap of about 2.5 GB)
EOF
sudo chmod 644 /etc/shortener/deploy.conf; fi
cat /etc/shortener/deploy.conf
```

You should see your values printed back.

## 2. Preflight checks

This block only reads; it changes nothing. Each line it prints starts with `OK`, `WARN` or `STOP`. Fix every `STOP` before you go on.

```bash
( source /etc/shortener/deploy.conf
  ok() { echo "OK    $*"; }; warn() { echo "WARN  $*"; }; stop() { echo "STOP  $*"; }
  . /etc/os-release
  case "$ID-$VERSION_ID" in ubuntu-22.04|ubuntu-24.04|debian-12) ok "OS: $PRETTY_NAME" ;; *) warn "OS: $PRETTY_NAME is not tested by this guide" ;; esac
  case "$(uname -m)" in x86_64|aarch64) ok "CPU: $(uname -m)" ;; *) stop "CPU $(uname -m) is not supported" ;; esac
  MEM=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo); SWAP=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
  if [ $((MEM + SWAP)) -ge 3500 ]; then ok "Memory: ${MEM} MB RAM + ${SWAP} MB swap"; else warn "Memory: ${MEM} MB RAM + ${SWAP} MB swap - do the swap step in step 3 (the build needs ~2.5 GB)"; fi
  DISK=$(df -Pm /opt | awk 'NR==2 {print $4}')
  if [ "$DISK" -ge 5000 ]; then ok "Disk: ${DISK} MB free on /opt"; else stop "Disk: only ${DISK} MB free on /opt (need 5 GB)"; fi
  if ! ss -ltnH "sport = :$PORT" | grep -q .; then ok "Port $PORT is free"
  elif systemctl is-active --quiet "$APP"; then ok "Port $PORT is used by $APP itself (re-run)"
  else stop "Port $PORT is in use by another program - set another PORT in /etc/$APP/deploy.conf (sudo nano)"; fi
  if [ -z "$DOMAIN" ]; then
    if ! sudo ss -ltnH "sport = :$PUBLIC_PORT" | grep -q .; then ok "Public port $PUBLIC_PORT is free"
    elif sudo ss -ltnpH "sport = :$PUBLIC_PORT" | grep -qE '"(nginx|caddy|apache2)"'; then ok "Public port $PUBLIC_PORT is served by the web server (re-run)"
    else stop "Public port $PUBLIC_PORT is in use - set another PUBLIC_PORT in /etc/$APP/deploy.conf"; fi
  fi
  WEB=$(sudo ss -ltnpH '( sport = :80 or sport = :443 )' | grep -oE 'users:\(\("[^"]+"' | cut -d'"' -f2 | sort -u | xargs)
  case "$WEB" in
    "") ok "Ports 80/443 are free - nginx will be installed in step 11" ;;
    nginx) ok "Ports 80/443 are served by nginx - a separate site will be added" ;;
    *) stop "Ports 80/443 are used by '$WEB' - use the Appendix (Caddy / Apache) instead of step 11" ;;
  esac
  if [ -n "$DOMAIN" ]; then
    IP=$(curl -4fsS https://api.ipify.org); DNS=$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u | xargs)
    case " $DNS " in *" $IP "*) ok "DNS: $DOMAIN -> $IP" ;; *) warn "DNS: $DOMAIN -> '${DNS:-nothing}', but this server is $IP (fix before step 11)" ;; esac
    [ -n "$EMAIL" ] && ok "EMAIL is set" || stop "EMAIL is empty - Let's Encrypt needs it (sudo nano /etc/$APP/deploy.conf)"
  else
    ok "No DOMAIN: the site will be http://$(curl -4fsS https://api.ipify.org):$PUBLIC_PORT"
  fi
)
```

## 3. Install system packages

This only adds packages. It never upgrades or removes any. `openssl` is needed by Prisma's engine, and `sqlite3` is used for backups. Neither sharp nor geoip-lite needs a compiler: both come with prebuilt binaries or bundled data.

```bash
sudo bash -euo pipefail <<'EOF'
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_SUSPEND=1   # additive only: needrestart must not restart other services
apt-get update -qq
MISSING_PKGS=""; for p in ca-certificates curl git openssh-client openssl xz-utils sqlite3 iproute2; do dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q 'ok installed' || MISSING_PKGS="$MISSING_PKGS $p"; done
if [ -n "$MISSING_PKGS" ]; then apt-get install -y --no-install-recommends $MISSING_PKGS; fi   # only what's missing - never upgrades installed packages
echo "Packages OK"
EOF
```

**Swap (recommended under 4 GB of RAM).** This adds `/swapfile-shortener`, but only if the server has no swap at all. Anything already set up is left alone.

```bash
sudo bash -euo pipefail <<'EOF'
source /etc/shortener/deploy.conf
MEM=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ -n "$(swapon --show --noheadings)" ]; then echo "Swap already present - nothing to do:"; swapon --show; exit 0; fi
if [ "$MEM" -ge 4000 ]; then echo "${MEM} MB RAM - no swap needed"; exit 0; fi
SIZE_MB=2048; [ "$MEM" -lt 1900 ] && SIZE_MB=3072
SWAPFILE="/swapfile-$APP"
[ -f "$SWAPFILE" ] || { fallocate -l "${SIZE_MB}M" "$SWAPFILE" 2>/dev/null || dd if=/dev/zero of="$SWAPFILE" bs=1M count="$SIZE_MB" status=none; }
chmod 600 "$SWAPFILE"; mkswap "$SWAPFILE" >/dev/null; swapon "$SWAPFILE"
grep -q "^$SWAPFILE " /etc/fstab || echo "$SWAPFILE none swap sw 0 0" >> /etc/fstab
swapon --show
EOF
```

## 4. Create the app user and folders

`/opt/shortener`, its `bin/` folder and the runtime belong to root. The app user can only write to `releases/`, `repo/`, `shared/` and its cache folders. That way the app can never alter the deploy script that root runs. `shared/public/uploads` is world-readable so nginx can serve it; the database and `storage/` are not.

```bash
sudo bash -euo pipefail <<'EOF'
source /etc/shortener/deploy.conf
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --user-group --home-dir "$APP_HOME" --no-create-home --shell /usr/sbin/nologin "$APP_USER"
install -d -m 755 -o root -g root "$APP_HOME" "$APP_HOME/bin" "$APP_HOME/runtime"
install -d -m 755 -o "$APP_USER" -g "$APP_USER" "$APP_HOME/releases" "$APP_HOME/repo" "$APP_HOME/shared" "$APP_HOME/shared/public" "$APP_HOME/shared/public/uploads"
install -d -m 750 -o "$APP_USER" -g "$APP_USER" "$APP_HOME/shared/data" "$APP_HOME/shared/storage" "$APP_HOME/shared/backups" "$APP_HOME/.cache" "$APP_HOME/.local" "$APP_HOME/.config" "$APP_HOME/.npm"
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "$APP_HOME/.ssh"
ls -la "$APP_HOME" "$APP_HOME/shared"
EOF
```

## 5. Install the runtime (isolated)

This downloads the official Node.js 22 build into `/opt/shortener/runtime/node` and checks its SHA-256 checksum. pnpm 11 is installed **into that runtime only**. Any Node, npm or pnpm already on the system is left alone. Re-running the block upgrades to the latest 22.x and 11.x; redeploy afterwards.

```bash
sudo bash -euo pipefail <<'EOF'
source /etc/shortener/deploy.conf
case "$(uname -m)" in x86_64) NARCH=x64 ;; aarch64|arm64) NARCH=arm64 ;; *) echo "Unsupported CPU: $(uname -m)"; exit 1 ;; esac
BASE="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
TARBALL="$(curl -fsSL "$BASE/SHASUMS256.txt" | grep -oE "node-v[0-9.]+-linux-${NARCH}\.tar\.xz" | head -1)"
TMP="$(mktemp -d)"
curl -fsSL "$BASE/$TARBALL" -o "$TMP/$TARBALL"
(cd "$TMP" && curl -fsSL "$BASE/SHASUMS256.txt" | grep " $TARBALL\$" | sha256sum -c -)
rm -rf "$APP_HOME/runtime/node" && mkdir -p "$APP_HOME/runtime/node"
tar -xJf "$TMP/$TARBALL" -C "$APP_HOME/runtime/node" --strip-components=1
export PATH="$APP_HOME/runtime/node/bin:$PATH"
npm install -g "pnpm@$PNPM_VERSION" --prefix "$APP_HOME/runtime/node" --cache "$TMP/npm-cache" --no-audit --no-fund --loglevel=error
rm -rf "$TMP"
chown -R root:root "$APP_HOME/runtime"
echo "node $(node -v), pnpm $(pnpm --version)"
EOF
```

You should see `node v22.x.x, pnpm 11.x.x`. The runtime's own npm installs pnpm into `/opt/shortener/runtime/node`, not into the system.

## 6. Give the server read access to the repo

This creates an SSH key that belongs only to the `shortener` user and prints its public half.

```bash
sudo bash -euo pipefail <<'EOF'
source /etc/shortener/deploy.conf
KEY="$APP_HOME/.ssh/id_ed25519"
[ -f "$KEY" ] || sudo -u "$APP_USER" ssh-keygen -q -t ed25519 -N "" -C "$APP@$(hostname)" -f "$KEY"
touch "$APP_HOME/.ssh/known_hosts"
grep -q "^github.com " "$APP_HOME/.ssh/known_hosts" || ssh-keyscan -t ed25519 github.com 2>/dev/null >> "$APP_HOME/.ssh/known_hosts"
chown "$APP_USER:$APP_USER" "$APP_HOME/.ssh/known_hosts"; chmod 644 "$APP_HOME/.ssh/known_hosts"
echo; echo "Add this deploy key on GitHub:"; echo; cat "$KEY.pub"; echo
EOF
```

1. Open **<https://github.com/cyberkyd01/premium-url-shortener/settings/keys/new>**.
2. Title: `shortener@your-server`. Key: paste the whole `ssh-ed25519 ...` line. **Leave "Allow write access" unticked.** Click **Add key**.
3. Test it:

```bash
sudo -u shortener -H ssh -T git@github.com
```

You should see `Hi cyberkyd01/premium-url-shortener! You've successfully authenticated, but GitHub does not provide shell access.` The exit code of 1 is normal.

*If the repo is ever made public,* you can skip the key and set `REPO_URL=https://github.com/cyberkyd01/premium-url-shortener.git` in `deploy.conf`.

## 7. Configure the app (.env)

Three things load `/opt/shortener/shared/.env` by themselves: Next.js, the Prisma CLI (through `prisma.config.ts`) and the cron script (through `dotenv`). Every release gets a symlink to this one file. The block creates the file **only if it doesn't exist yet**, so secrets are never regenerated. It fills in production values based on `DOMAIN`.

```bash
sudo bash -euo pipefail <<'EOF'
source /etc/shortener/deploy.conf
ENV_FILE="$APP_HOME/shared/.env"
if [ -s "$ENV_FILE" ]; then
  echo "Keeping the existing $ENV_FILE (secrets are never regenerated)."
else
  SERVER_IP="$(curl -4fsS --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"
  if [ -n "$DOMAIN" ]; then URL="https://$DOMAIN"; MAIL_DOMAIN="$DOMAIN"; else URL="http://$SERVER_IP:$PUBLIC_PORT"; MAIL_DOMAIN="example.com"; fi
  umask 077
  cat > "$ENV_FILE" <<ENV
# Premium URL Shortener - production settings. Loaded by Next.js, Prisma and scripts/cron.ts.
NODE_ENV=production
APP_URL="$URL"
NEXTAUTH_URL="$URL"
AUTH_SECRET="$(openssl rand -hex 32)"
AUTH_TRUST_HOST=true
DATABASE_URL="file:$APP_HOME/shared/data/app.db"
CRON_SECRET="$(openssl rand -hex 32)"
SERVER_IP="$SERVER_IP"

# Email - empty SMTP_HOST means emails are only logged. Can also be set in Admin -> Settings.
MAIL_FROM="no-reply@$MAIL_DOMAIN"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""

# Optional keys - leave empty until you need them (see the table in DEPLOY.md step 7).
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
FACEBOOK_CLIENT_ID=""
FACEBOOK_CLIENT_SECRET=""
TWITTER_CLIENT_ID=""
TWITTER_CLIENT_SECRET=""
RECAPTCHA_SITE_KEY=""
RECAPTCHA_SECRET_KEY=""
OPENAI_API_KEY=""
GEMINI_API_KEY=""
ANTHROPIC_API_KEY=""
GOOGLE_WEBRISK_API_KEY=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
PAYPAL_CLIENT_ID=""
PAYPAL_CLIENT_SECRET=""
PAYPAL_MODE="sandbox"
ENV
  chown "$APP_USER:$APP_USER" "$ENV_FILE"; chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE"
fi
grep -E '^(APP_URL|NEXTAUTH_URL|DATABASE_URL|SERVER_IP)=' "$ENV_FILE"
EOF
```

To edit the file later, run `sudo nano /opt/shortener/shared/.env`, then `sudo systemctl restart shortener`. Changes to `APP_URL` take full effect only after a redeploy (`sudo /opt/shortener/bin/deploy.sh`).

These are the variables the code actually reads:

| Variable | Required | Meaning |
|---|---|---|
| `APP_URL`, `NEXTAUTH_URL` | yes | The public URL. Used for short links, emails, OAuth callbacks, and the `Secure` session cookie (set only when the URL starts with `https`). Must match the address you open in the browser. |
| `AUTH_SECRET` | yes | Signs sessions and share/bio/link cookies, and is also the fallback key for encrypted hosted files. `NEXTAUTH_SECRET` is accepted as an alias. **Never change it**: everyone would be logged out and some encrypted files could become unreadable. |
| `CRON_SECRET` | yes | Protects `/api/cron/*`, and is the first-choice key for encrypting hosted files. The cron timer reads it from this file. **Never change it** once files have been uploaded. |
| `DATABASE_URL` | yes | `file:/opt/shortener/shared/data/app.db`. It must be an absolute path: a relative one would land inside a release folder and vanish on the next update. |
| `AUTH_TRUST_HOST` | yes | `true`. Lets Auth.js trust the `Host` header from nginx. |
| `NODE_ENV` | yes | `production`. The systemd unit sets it too. |
| `SERVER_IP` | recommended | This server's public IPv4. Used to verify users' custom domains and shown on `/domain-check`. |
| `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | for email | Outgoing mail. Admin → Settings overrides these. With no host, emails are only written to the log. |
| `GOOGLE_*`, `FACEBOOK_*`, `TWITTER_*` `_CLIENT_ID` / `_CLIENT_SECRET` | optional | Social login. The button appears only when the ID is set. The callback URL is `APP_URL/api/auth/callback/google` (or `facebook`, `twitter`). |
| `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` | optional | Captcha. You can also set them in Admin → Settings. |
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` | optional | AI Copilot. |
| `GOOGLE_WEBRISK_API_KEY`, `GOOGLE_SAFEBROWSING_API_KEY` | optional | Malicious-URL checks. |
| `SLACK_SIGNING_SECRET`, `SLACK_VERIFICATION_TOKEN` | optional | Slack integration. The admin settings take priority. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_MODE` | optional | Fallbacks used when a gateway isn't configured in **Admin → Payments**, which is the recommended place. Fallbacks also exist for Paddle, Paystack, Razorpay, Mollie, Crypto.com, CoinPayments, Midtrans, Lemon Squeezy, Iyzico and MercadoPago (`<GATEWAY>_...` names in `src/lib/payments/*.ts`). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | seed only | Read only by the one-time seed in step 10, which passes them in for you. Don't put them in `.env`. |

`APP_NAME` from `.env.example` isn't read by the code. Set the site name in **Admin → Settings**.

## 8. Database

You don't need to install anything. SQLite lives in the single file `/opt/shortener/shared/data/app.db`. The project has no migrations folder, so `deploy.sh` runs `prisma db push` on every deploy. That creates the database the first time and applies schema changes on updates. Before each push, `deploy.sh` saves a copy to `shared/backups/pre-deploy-*.db` (the last 5 are kept). If a schema change would delete data, the push stops and the update is cancelled; see [Troubleshooting](#troubleshooting). The demo data and first admin are created once in step 10.

The schema also supports MySQL or PostgreSQL, but switching means editing `provider` in `prisma/schema.prisma`, which is a code change and outside this guide.

## 9. Run it as a service

This creates three units:

- `shortener.service` runs `next start` bound to `127.0.0.1:3101`.
- `shortener-cron.service` runs the job runner `scripts/cron.ts` once. That covers plan expiry, link expiry, cleanup, subscriptions, reminders, imports, AI credits, storage sync and backups. It calls the app directly on `127.0.0.1`, not through nginx.
- `shortener-cron.timer` starts the job runner every 10 minutes, the interval the README and docker-compose use.

```bash
sudo bash -euo pipefail <<'EOF'
source /etc/shortener/deploy.conf
cat > "/etc/systemd/system/$APP.service" <<UNIT
[Unit]
Description=Premium URL Shortener (Next.js, 127.0.0.1:$PORT)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_HOME/current
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
Environment=PATH=$APP_HOME/runtime/node/bin:/usr/bin:/bin
ExecStart=$APP_HOME/runtime/node/bin/node $APP_HOME/current/node_modules/next/dist/bin/next start -H 127.0.0.1 -p $PORT
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=$APP_HOME

[Install]
WantedBy=multi-user.target
UNIT
cat > "/etc/systemd/system/$APP-cron.service" <<UNIT
[Unit]
Description=Premium URL Shortener background jobs (scripts/cron.ts)
After=$APP.service

[Service]
Type=oneshot
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_HOME/current
Environment=NODE_ENV=production
Environment=APP_URL=http://127.0.0.1:$PORT
Environment=PATH=$APP_HOME/runtime/node/bin:/usr/bin:/bin
ExecStart=$APP_HOME/runtime/node/bin/node $APP_HOME/current/node_modules/tsx/dist/cli.mjs scripts/cron.ts
TimeoutStartSec=30min
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=$APP_HOME
UNIT
cat > "/etc/systemd/system/$APP-cron.timer" <<UNIT
[Unit]
Description=Run Premium URL Shortener background jobs every 10 minutes

[Timer]
OnCalendar=*:0/10
RandomizedDelaySec=30
Persistent=true

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable "$APP.service"
if [ -L "$APP_HOME/current" ]; then systemctl restart "$APP.service"; echo "Restarted $APP"; fi
systemctl is-enabled "$APP.service"
EOF
```

You should see `enabled`. The first deploy in the next step starts the service. The timer is switched on after the first deploy.

In the cron unit, `APP_URL=http://127.0.0.1:$PORT` only changes **where the job runner sends its requests**. dotenv never overrides a variable that is already set. The app itself keeps using the public `APP_URL` from `.env`.

## 10. Create the deploy script and deploy

`/opt/shortener/bin/deploy.sh` does both the first install and every update:

1. Fetches the branch into a new `releases/<timestamp>-<sha>` folder.
2. Links `.env`, `public/uploads` and `storage` to `shared/`.
3. Runs `pnpm install --frozen-lockfile`.
4. Backs up the database and runs `prisma db push`.
5. Runs `pnpm build` (`prisma generate && next build`).
6. Switches the `current` symlink and restarts the service.

If `/` doesn't answer within 90 seconds after the restart, the script **switches back automatically**. It keeps the last 3 releases.

Project-specific details in the script:

- **`--node-linker=hoisted`.** With pnpm's default symlinked `node_modules`, the `Collecting build traces` step of `next build` follows sharp's links in circles and needs more than 7 GB of RAM; it dies on a normal VPS. With a flat (npm-style) `node_modules`, the same build needs about 2.5 GB. This is a command-line option only; the lockfile and versions are identical.
- **The schema is pushed before the build.** Some pages (`/offline`, `/_not-found`) read settings from the database while `next build` runs, so the tables must already exist.
- **Prisma is run as `./node_modules/.bin/prisma`,** as the project expects.

```bash
sudo tee /opt/shortener/bin/deploy.sh >/dev/null <<'DEPLOY'
#!/usr/bin/env bash
# Deploys the latest commit of $BRANCH. First install and every update. Safe to re-run.
set -Eeuo pipefail
source /etc/shortener/deploy.conf
[ "$(id -u)" -eq 0 ] || { echo "Run with: sudo $0"; exit 1; }
cd /   # the app user may not be allowed into the directory you ran this from

RELEASES="$APP_HOME/releases"; SHARED="$APP_HOME/shared"; REPO="$APP_HOME/repo"
export PATH="$APP_HOME/runtime/node/bin:/usr/local/bin:/usr/bin:/bin"
as_app() {
  sudo -u "$APP_USER" -H env HOME="$APP_HOME" PATH="$PATH" NEXT_TELEMETRY_DISABLED=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 CHECKPOINT_DISABLE=1 bash -euo pipefail -c "$1"
}

# --- project settings ---
SHARED_FILES=(.env)
SHARED_DIRS=(public/uploads storage)     # release path -> $SHARED/<path>
SERVICES=(shortener)
HEALTH_URL="http://127.0.0.1:$PORT/"
DB_FILE="$SHARED/data/app.db"
PUSH_FLAGS="--skip-generate"                                   # sudo deploy.sh --accept-data-loss
if [ "${1:-}" = "--accept-data-loss" ]; then PUSH_FLAGS="$PUSH_FLAGS --accept-data-loss"; fi

on_error() {
  echo "!! Deploy failed (line $1). The previous release, if any, is still live." >&2
  if [ -n "${NEW:-}" ] && [ -d "$NEW" ] && [ "$(readlink -f "$APP_HOME/current" 2>/dev/null)" != "$NEW" ]; then rm -rf "$NEW"; fi
}
trap 'on_error $LINENO' ERR
[ -s "$SHARED/.env" ] || { echo "Missing $SHARED/.env - run step 7 first"; exit 1; }

echo "==> Fetching $BRANCH"
if [ ! -d "$REPO/.git" ]; then as_app "git clone --quiet '$REPO_URL' '$REPO'"; fi
as_app "cd '$REPO' && git fetch --quiet --prune origin '$BRANCH' && git reset --quiet --hard 'origin/$BRANCH'"
SHA="$(as_app "cd '$REPO' && git rev-parse --short HEAD")"
NEW="$RELEASES/$(date +%Y%m%d%H%M%S)-$SHA"
as_app "mkdir -p '$NEW' && cd '$REPO' && git archive HEAD | tar -x -C '$NEW'"

echo "==> Linking shared files"
for f in "${SHARED_FILES[@]}"; do as_app "touch '$SHARED/$f' && ln -sfn '$SHARED/$f' '$NEW/$f'"; done
for d in "${SHARED_DIRS[@]}"; do as_app "mkdir -p '$SHARED/$d' && rm -rf '$NEW/$d' && mkdir -p \"\$(dirname '$NEW/$d')\" && ln -sfn '$SHARED/$d' '$NEW/$d'"; done

echo "==> Installing dependencies (pnpm, flat node_modules)"
as_app "cd '$NEW' && pnpm install --frozen-lockfile --node-linker=hoisted --store-dir '$APP_HOME/.local/share/pnpm/store'"

if [ -s "$DB_FILE" ]; then
  echo "==> Backing up the database"
  as_app "sqlite3 '$DB_FILE' \".backup '$SHARED/backups/pre-deploy-$(date +%Y%m%d%H%M%S).db'\""
  as_app "ls -1t '$SHARED'/backups/pre-deploy-*.db | tail -n +6 | xargs -r rm -f"   # keep last 5
fi

echo "==> Syncing the database schema (prisma db push)"
as_app "cd '$NEW' && ./node_modules/.bin/prisma db push $PUSH_FLAGS"

echo "==> Building (prisma generate && next build)"
as_app "cd '$NEW' && NODE_OPTIONS=--max-old-space-size=${BUILD_MEMORY_MB:-2048} pnpm build"

echo "==> Switching to $NEW"
PREV="$(readlink -f "$APP_HOME/current" 2>/dev/null || true)"
ln -sfn "$NEW" "$APP_HOME/current.new" && mv -Tf "$APP_HOME/current.new" "$APP_HOME/current"
systemctl restart "${SERVICES[@]}" || true

echo "==> Health check $HEALTH_URL"
for i in $(seq 1 45); do
  if curl -fs -o /dev/null --max-time 5 "$HEALTH_URL"; then
    echo "==> Deployed $SHA"
    as_app "ls -1dt '$RELEASES'/*/ | tail -n +4 | xargs -r rm -rf"   # keep last 3
    exit 0
  fi
  sleep 2
done
echo "!! Health check failed - rolling back" >&2
journalctl -u "${SERVICES[0]}" -n 40 --no-pager >&2 || true
if [ -n "$PREV" ] && [ -d "$PREV" ]; then
  ln -sfn "$PREV" "$APP_HOME/current.new" && mv -Tf "$APP_HOME/current.new" "$APP_HOME/current"
  systemctl restart "${SERVICES[@]}" || true
  rm -rf "$NEW"
  echo "!! Rolled back to $PREV" >&2
fi
exit 1
DEPLOY
sudo chmod 750 /opt/shortener/bin/deploy.sh
```

Now the first deploy. It takes 3 to 10 minutes, depending on CPU and swap:

```bash
sudo /opt/shortener/bin/deploy.sh
```

You should see `==> Deployed <commit>`.

**Seed the database. Run this only once.** It creates the plans, roles, templates, pages, languages, themes and payment gateways, plus the first admin. The admin uses `ADMIN_EMAIL` from `deploy.conf` and a **random password** instead of the well-known `admin1234`. The block leaves a marker file so it never runs twice. A second run could otherwise recreate a default admin if you later change the admin's email.

```bash
sudo bash -euo pipefail <<'EOF'
source /etc/shortener/deploy.conf
MARK="$APP_HOME/shared/.seeded"; CREDS="/etc/$APP/initial-admin.txt"
if [ -e "$MARK" ]; then echo "Already seeded on $(cat "$MARK") - skipping (the seed must run only once)."; exit 0; fi
if [ -f "$CREDS" ]; then ADMIN="$(awk '/^email:/ {print $2}' "$CREDS")"; PASS="$(awk '/^password:/ {print $2}' "$CREDS")"
else
  ADMIN="${ADMIN_EMAIL:-${EMAIL:-admin@example.com}}"; PASS="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | cut -c1-20)"
  ( umask 077; printf 'Premium URL Shortener - first admin (delete this file after changing the password)\nemail: %s\npassword: %s\n' "$ADMIN" "$PASS" > "$CREDS" )
fi
cd "$APP_HOME/current"
sudo -u "$APP_USER" -H env HOME="$APP_HOME" PATH="$APP_HOME/runtime/node/bin:/usr/bin:/bin" ADMIN_EMAIL="$ADMIN" ADMIN_PASSWORD="$PASS" \
  "$APP_HOME/runtime/node/bin/node" node_modules/tsx/dist/cli.mjs prisma/seed.ts
date -u +%Y-%m-%dT%H:%M:%SZ > "$MARK"; chown "$APP_USER:$APP_USER" "$MARK"
echo; cat "$CREDS"
EOF
```

You should see `Seeded. Admin login: ...` followed by the email and password. They're also saved in `/etc/shortener/initial-admin.txt`, readable by root only. Change the password at first login (step 12), then delete that file.

Turn on the background jobs:

```bash
sudo systemctl enable --now shortener-cron.timer && systemctl list-timers shortener-cron.timer --no-pager
```

You should see the timer with its next run within 10 minutes.

## 11. Put it on your domain (nginx + HTTPS)

This first block installs nginx if it's missing. It writes the shared proxy rules to `/etc/shortener/nginx-locations.conf` and adds **only** its own site: `/etc/nginx/sites-available/shortener` plus its symlink, or `/etc/nginx/conf.d/shortener.conf` on nginx.org packages. It tests the config with `nginx -t` and reloads nginx; it never restarts it. If the test fails, the block puts everything back the way it was. With no `DOMAIN`, nginx listens on port `8101` instead.

Why nginx serves `/uploads/` directly: `next start` only serves files that were already in `public/` when it started. Logos, avatars, QR logos and hosted files uploaded later would otherwise return 404 until the next restart. nginx reads them straight from `shared/public/uploads`. The live click stream (`/api/stream/`, server-sent events) is proxied without buffering.

```bash
sudo bash -euo pipefail <<'EOF'
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_SUSPEND=1   # additive only: needrestart must not restart other services
source /etc/shortener/deploy.conf
WEB="$(ss -ltnpH '( sport = :80 or sport = :443 )' | grep -oE 'users:\(\("[^"]+"' | cut -d'"' -f2 | sort -u | xargs || true)"
case "$WEB" in ""|nginx) ;; *) echo "STOP: ports 80/443 are used by '$WEB', not nginx. Use the Appendix (Caddy / Apache)."; exit 1 ;; esac
export DEBIAN_FRONTEND=noninteractive
command -v nginx >/dev/null || { apt-get update -qq; apt-get install -y --no-install-recommends nginx; }
if [ -d /etc/nginx/sites-available ]; then CONF="/etc/nginx/sites-available/$APP"; LINK="/etc/nginx/sites-enabled/$APP"
else CONF="/etc/nginx/conf.d/$APP.conf"; LINK=""; fi
LOC="/etc/$APP/nginx-locations.conf"
if [ -n "$DOMAIN" ]; then L=80; NAME="server_name $DOMAIN;"; else L="$PUBLIC_PORT"; NAME="# no domain: reached as http://SERVER_IP:$PUBLIC_PORT"; fi
LISTEN="listen $L;"; if [ -e /proc/net/if_inet6 ]; then LISTEN="$LISTEN listen [::]:$L;"; fi
for f in "$CONF" "$LOC"; do if [ -f "$f" ]; then cp -p "$f" "$f.bak"; fi; done
cat > "$LOC" <<NGINX
# Premium URL Shortener - proxy rules, included by every shortener server block (DEPLOY.md step 11)
client_max_body_size 25m;

# Uploaded files live outside the release; next start would not see files added after it started.
location /uploads/ {
    alias $APP_HOME/shared/public/uploads/;
    add_header X-Content-Type-Options nosniff;
    expires 7d;
}

# Live click stream (server-sent events): no buffering, long timeout.
location /api/stream/ {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$http_host;
    proxy_set_header X-Forwarded-Host \$http_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
}

location / {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$http_host;
    proxy_set_header X-Forwarded-Host \$http_host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 300s;
}
NGINX
cat > "$CONF" <<NGINX
# Premium URL Shortener - written by DEPLOY.md step 11 (safe to re-run)
server {
    $LISTEN
    $NAME
    include $LOC;
}
NGINX
if [ -n "$LINK" ]; then ln -sfn "$CONF" "$LINK"; fi
if ! nginx -t; then
  echo "STOP: nginx -t failed - restoring the previous state"
  if [ -f "$LOC.bak" ]; then mv -f "$LOC.bak" "$LOC"; fi
  if [ -f "$CONF.bak" ]; then mv -f "$CONF.bak" "$CONF"; else rm -f "$CONF"; if [ -n "$LINK" ]; then rm -f "$LINK"; fi; fi
  exit 1
fi
rm -f "$CONF.bak" "$LOC.bak"
if systemctl is-active --quiet nginx; then systemctl reload nginx; else systemctl enable --now nginx; fi
if ufw status 2>/dev/null | grep -q "Status: active"; then
  if [ -n "$DOMAIN" ]; then ufw allow 80/tcp; ufw allow 443/tcp; else ufw allow "$PUBLIC_PORT/tcp"; fi
fi
echo "nginx site OK: $CONF"
EOF
```

**With a domain**, add HTTPS next. The block first checks that the domain points at this server. Certbot changes only the `shortener` server block, adds the HTTP→HTTPS redirect and renews the certificate on its own:

```bash
sudo bash -euo pipefail <<'EOF'
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_SUSPEND=1   # additive only: needrestart must not restart other services
source /etc/shortener/deploy.conf
if [ -z "$DOMAIN" ]; then echo "No DOMAIN set - skipping HTTPS. Your site: http://$(curl -4fsS https://api.ipify.org):$PUBLIC_PORT"; exit 0; fi
[ -n "$EMAIL" ] || { echo "STOP: set EMAIL in /etc/$APP/deploy.conf"; exit 1; }
IP="$(curl -4fsS https://api.ipify.org || true)"
DNS="$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u | xargs || true)"
case " $DNS " in *" $IP "*) echo "OK: $DOMAIN -> $IP" ;; *) echo "STOP: $DOMAIN resolves to '${DNS:-nothing}', this server is $IP. Fix the A record, wait a few minutes, re-run."; exit 1 ;; esac
if ! command -v certbot >/dev/null || ! dpkg -s python3-certbot-nginx >/dev/null 2>&1; then
  apt-get update -qq; DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends certbot python3-certbot-nginx
fi
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect --keep-until-expiring
nginx -t && systemctl reload nginx
echo "HTTPS OK: https://$DOMAIN"
EOF
```

**Adding a domain later**, or moving to a different one, takes three steps:

1. Set `DOMAIN` and `EMAIL` with `sudo nano /etc/shortener/deploy.conf`.
2. Update the URLs in `.env` with the block below.
3. Re-run both blocks of step 11 and step 12.

```bash
sudo bash -euo pipefail <<'EOF'
source /etc/shortener/deploy.conf
[ -n "$DOMAIN" ] || { echo "Set DOMAIN in /etc/$APP/deploy.conf first"; exit 1; }
sed -i -E "s|^APP_URL=.*|APP_URL=\"https://$DOMAIN\"|; s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=\"https://$DOMAIN\"|; s|^MAIL_FROM=\"no-reply@example.com\"|MAIL_FROM=\"no-reply@$DOMAIN\"|" "$APP_HOME/shared/.env"
grep -E '^(APP_URL|NEXTAUTH_URL|MAIL_FROM)=' "$APP_HOME/shared/.env"
/opt/shortener/bin/deploy.sh
EOF
```

If you no longer want the old no-domain port, remove its firewall rule with `sudo ufw delete allow 8101/tcp`.

## 12. Verify

```bash
( source /etc/shortener/deploy.conf
  echo "service:   $(systemctl is-active "$APP")"
  echo "timer:     $(systemctl is-active "$APP-cron.timer")"
  echo "listening: $(sudo ss -ltnH "sport = :$PORT" | awk '{print $4}' | xargs)"
  curl -sS -o /dev/null -w "local:     HTTP %{http_code}\n" "http://127.0.0.1:$PORT/"
  if [ -n "$DOMAIN" ]; then URL="https://$DOMAIN"; else URL="http://$(curl -4fsS https://api.ipify.org):$PUBLIC_PORT"; fi
  curl -sS -o /dev/null -w "public:    HTTP %{http_code}  ($URL)\n" "$URL/"
  echo ok | sudo -u "$APP_USER" tee "$APP_HOME/shared/public/uploads/deploy-check.txt" >/dev/null
  curl -sS -o /dev/null -w "uploads:   HTTP %{http_code}\n" "$URL/uploads/deploy-check.txt"
  sudo rm -f "$APP_HOME/shared/public/uploads/deploy-check.txt"
  sudo systemctl start "$APP-cron.service" && sudo journalctl -u "$APP-cron.service" -n 1 --no-pager -o cat
)
```

Expected:

```text
service:   active
timer:     active
listening: 127.0.0.1:3101
local:     HTTP 200
public:    HTTP 200  (https://your-domain)
uploads:   HTTP 200
[cron] done, 9 ok, 0 failed
```

Then in a browser:

1. Open the public URL and go to `/login`. Sign in with the admin email and password from step 10. To see them again, run `sudo cat /etc/shortener/initial-admin.txt`.
2. **Change the password right away** under **Dashboard → Settings → Security**. Then delete the saved copy with `sudo rm /etc/shortener/initial-admin.txt`.
3. In **Admin → Settings**, set the site name, support email and mail (SMTP) settings, then send yourself a test, for example a password reset.
4. Shorten a link on the homepage and open it. The click should appear in its stats.
5. The cron URLs listed in **Admin → Cron Jobs** are already covered by the timer; don't add a second scheduler.

## Custom domains for your users (optional)

Users can add branded domains (Dashboard → Custom Domains) and point an A record at this server. The app checks the A record against `SERVER_IP`. nginx only answers for domains it knows, so add each approved domain with this block. **Set `CUSTOM_DOMAIN` on the first line** first. The block reuses the same proxy rules, gets a certificate if the domain already points here, and is safe to re-run:

```bash
CUSTOM_DOMAIN="links.customer-domain.com"
sudo bash -euo pipefail -s "$CUSTOM_DOMAIN" <<'EOF'
CUSTOM_DOMAIN="$1"
source /etc/shortener/deploy.conf
[ -f "/etc/$APP/nginx-locations.conf" ] || { echo "Run step 11 first"; exit 1; }
if [ -d /etc/nginx/sites-available ]; then CONF="/etc/nginx/sites-available/$APP-domain-$CUSTOM_DOMAIN"; LINK="/etc/nginx/sites-enabled/$APP-domain-$CUSTOM_DOMAIN"
else CONF="/etc/nginx/conf.d/$APP-domain-$CUSTOM_DOMAIN.conf"; LINK=""; fi
LISTEN="listen 80;"; if [ -e /proc/net/if_inet6 ]; then LISTEN="$LISTEN listen [::]:80;"; fi
if [ ! -f "$CONF" ]; then
  printf 'server {\n    %s\n    server_name %s;\n    include /etc/%s/nginx-locations.conf;\n}\n' "$LISTEN" "$CUSTOM_DOMAIN" "$APP" > "$CONF"
  if [ -n "$LINK" ]; then ln -sfn "$CONF" "$LINK"; fi
  if ! nginx -t; then rm -f "$CONF"; if [ -n "$LINK" ]; then rm -f "$LINK"; fi; echo "STOP: nginx -t failed - removed $CONF"; exit 1; fi
  systemctl reload nginx
fi
IP="$(curl -4fsS https://api.ipify.org)"
if getent ahostsv4 "$CUSTOM_DOMAIN" | awk '{print $1}' | grep -qxF "$IP"; then
  certbot --nginx -d "$CUSTOM_DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect --keep-until-expiring
  nginx -t && systemctl reload nginx
else
  echo "nginx site added; $CUSTOM_DOMAIN does not point at $IP yet - re-run this block for HTTPS once it does."
fi
EOF
```

To remove one, delete the `shortener-domain-<domain>` file(s) in `sites-available`/`sites-enabled` (or `conf.d`), run `sudo certbot delete --cert-name <domain>`, then `sudo nginx -t && sudo systemctl reload nginx`.

## Updating

Push to `main` (or whatever `BRANCH` is set to), then on the server run:

```bash
sudo /opt/shortener/bin/deploy.sh
```

It's the same script as the first deploy: it installs, backs up the database, pushes schema changes, builds, switches and health-checks. If anything fails before the switch, the old version keeps running untouched. If the new version fails its health check, the script switches back on its own. Don't run the seed again.

## Rolling back

`deploy.sh` rolls back automatically when the health check fails. To go back by hand, for example after a bug you spot later, run this block. It switches to the newest release other than the live one. Running `sudo /opt/shortener/bin/deploy.sh` later brings you back to the latest code:

```bash
sudo bash -euo pipefail <<'EOF'
source /etc/shortener/deploy.conf
CUR="$(readlink -f "$APP_HOME/current")"
PREV="$(ls -1dt "$APP_HOME"/releases/*/ | sed 's:/$::' | grep -vxF "$CUR" | sed -n 1p || true)"
[ -n "$PREV" ] || { echo "No older release to roll back to"; exit 1; }
ln -sfn "$PREV" "$APP_HOME/current.new" && mv -Tf "$APP_HOME/current.new" "$APP_HOME/current"
systemctl restart "$APP"
echo "Now running: $PREV"
EOF
```

Rolling back the code doesn't roll back the database schema. Columns that `prisma db push` added stay, and older code ignores them. If an update changed or removed data you need, restore the matching `shared/backups/pre-deploy-<time>.db` (see below).

## Logs, status, restart

```bash
systemctl status shortener --no-pager                 # app state and last output
sudo journalctl -u shortener -f                       # live app log
sudo journalctl -u shortener-cron -n 30 --no-pager    # last background-job runs
systemctl list-timers shortener-cron.timer --no-pager # when the jobs run next
sudo systemctl restart shortener
sudo systemctl start shortener-cron.service           # run all background jobs now
ls -1dt /opt/shortener/releases/*/ && readlink -f /opt/shortener/current   # releases and the live one
```

## Backups and restore

What to back up:

- `shared/data/app.db`, the database. `sqlite3 .backup` copies it safely while the app runs.
- `shared/public/uploads`, the user uploads.
- `shared/storage`, which holds the app's own JSON backups from the `backup` job and import files.
- `shared/.env`, the secrets. `AUTH_SECRET` and `CRON_SECRET` are needed to read encrypted hosted files.

The code can be rebuilt from Git. `deploy.sh` also keeps the last 5 pre-update database copies in `/opt/shortener/shared/backups/`.

**Back up** to a file in your login user's home directory:

```bash
sudo bash -euo pipefail <<'EOF'
source /etc/shortener/deploy.conf
DEST_USER="${SUDO_USER:-root}"; DEST="$(getent passwd "$DEST_USER" | cut -d: -f6)"
STAMP="$(date +%Y%m%d-%H%M%S)"; WORK="$(mktemp -d)"; chown "$APP_USER" "$WORK"
sudo -u "$APP_USER" sqlite3 "$APP_HOME/shared/data/app.db" ".backup '$WORK/app.db'"
cp "$APP_HOME/shared/.env" "$WORK/env"
tar -czf "$DEST/$APP-backup-$STAMP.tar.gz" -C "$WORK" app.db env -C "$APP_HOME/shared" public/uploads storage
rm -rf "$WORK"; chown "$DEST_USER": "$DEST/$APP-backup-$STAMP.tar.gz"; chmod 600 "$DEST/$APP-backup-$STAMP.tar.gz"
echo "Backup written: $DEST/$APP-backup-$STAMP.tar.gz"
EOF
```

Copy it off the server from your own computer, for example with `scp youruser@SERVER_IP:~/shortener-backup-*.tar.gz .`.

**Restore.** Put the archive on the server and **set `BACKUP=` to its full path** on the first line of the block. The block stops the app and the jobs, puts the database, uploads, storage and `.env` back, then starts everything again:

```bash
BACKUP="/home/youruser/shortener-backup-YYYYMMDD-HHMMSS.tar.gz"
sudo bash -euo pipefail -s "$BACKUP" <<'EOF'
BACKUP="$1"
source /etc/shortener/deploy.conf
[ -f "$BACKUP" ] || { echo "Not found: $BACKUP"; exit 1; }
WORK="$(mktemp -d)"; tar -C "$WORK" -xzf "$BACKUP"
systemctl stop "$APP-cron.timer" "$APP"
rm -f "$APP_HOME/shared/data/app.db-journal"
install -m 640 -o "$APP_USER" -g "$APP_USER" "$WORK/app.db" "$APP_HOME/shared/data/app.db"
if [ -f "$WORK/env" ]; then install -m 600 -o "$APP_USER" -g "$APP_USER" "$WORK/env" "$APP_HOME/shared/.env"; fi
for d in public/uploads storage; do
  if [ -d "$WORK/$d" ]; then mkdir -p "$APP_HOME/shared/$d"; cp -a "$WORK/$d/." "$APP_HOME/shared/$d/"; chown -R "$APP_USER:$APP_USER" "$APP_HOME/shared/$d"; fi
done
rm -rf "$WORK"
systemctl start "$APP" "$APP-cron.timer"
systemctl is-active "$APP"
EOF
```

To go back to a pre-update copy instead, stop the app with `sudo systemctl stop shortener`. Copy `/opt/shortener/shared/backups/pre-deploy-<time>.db` over `/opt/shortener/shared/data/app.db`, keeping owner `shortener` (for example with `sudo install -m 640 -o shortener -g shortener <src> <dst>`), and start the app again.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Preflight: `STOP Port 3101 is in use` | Another program uses the port | Set another `PORT` with `sudo nano /etc/shortener/deploy.conf`, then re-run steps 9 and 11 and run `deploy.sh` |
| `Permission denied (publickey)` during deploy | Deploy key missing, or added to the wrong repo | Redo step 6 and paste the key at `github.com/cyberkyd01/premium-url-shortener/settings/keys/new` |
| Build ends with `JavaScript heap out of memory`, or just `Killed` | Not enough RAM + swap | Do the swap step in step 3. On a 1 GB server you need 3 GB of swap. Re-run `deploy.sh` |
| `deploy.sh` shows no new output after `==> Building` for more than 20 minutes | The build ran out of memory and a worker process hung | Press Ctrl+C; the live site is unaffected. Add swap (step 3), check with `free -m`, then re-run `deploy.sh` |
| Build stalls for minutes at `Collecting build traces` and then runs out of memory | `node_modules` was installed with pnpm's default symlinked layout | Make sure the install line in `deploy.sh` contains `--node-linker=hoisted` (re-create the script from step 10) |
| `The table main.Setting does not exist` during the build | The schema wasn't pushed before `next build` | Use the `deploy.sh` from step 10, which runs `prisma db push` before building |
| Deploy stops at `prisma db push` with a data-loss warning; the live site is unchanged | A schema change would drop or alter a column or table | Read which columns are listed. Make a backup (see above), then run `sudo /opt/shortener/bin/deploy.sh --accept-data-loss` |
| `!! Health check failed - rolling back` | The new build crashed on start | Read the log printed under the message, or run `sudo journalctl -u shortener -n 80 --no-pager` |
| nginx shows **502 Bad Gateway** | The app isn't running, or the port differs | `systemctl status shortener`; make sure `PORT` is the same in the unit (`systemctl cat shortener`) and in `/etc/shortener/nginx-locations.conf`; re-run steps 9 and 11 |
| `nginx -t` fails in step 11 | Usually another site's config is broken; the block restored its own files | Read the error. If it names a file that isn't `shortener`, fix that site first, then re-run |
| Certbot: DNS problem or `unauthorized` | The A or AAAA record doesn't point here yet, or port 80 is blocked by the provider's firewall | Check with `getent ahostsv4 your-domain`, wait for DNS, open ports 80/443 in your cloud provider's firewall, re-run |
| Uploaded images return 404 | nginx can't read the folder, or the `/uploads/` location is missing | `ls -ld /opt/shortener /opt/shortener/shared /opt/shortener/shared/public/uploads` should show `drwxr-xr-x`; re-run step 4 and step 11 |
| Login loops back to `/login`, or OAuth reports a callback mismatch | `APP_URL` / `NEXTAUTH_URL` differ from the URL in the browser (http vs https, domain vs IP) | Fix both in `.env` (see "Adding a domain later" in step 11), then run `sudo /opt/shortener/bin/deploy.sh` |
| Forms fail with `Invalid Server Actions request` | A proxy dropped the port or host from the `Host` header | Keep `proxy_set_header Host $http_host;` (nginx) or `ProxyPreserveHost On` (Apache) |
| Live click stats don't update | The event stream is buffered | Keep the `/api/stream/` location from step 11 |
| Cron log: `CRON_SECRET is not set` or `401 Invalid cron secret` | `CRON_SECRET` missing or changed in `.env` | Check `sudo grep CRON_SECRET /opt/shortener/shared/.env`, then run `sudo systemctl restart shortener` |
| No emails arrive | No SMTP configured, so emails are only logged | Set SMTP in Admin → Settings or `.env`; see `sudo journalctl -u shortener` for the logged mails |
| Prisma error about `libssl` or `openssl` | `openssl` package missing | Re-run step 3 and then `deploy.sh` |

## Uninstall

This removes only what this guide created: the services and timer, the nginx site(s), the certificate(s), the firewall rule for the no-domain port, `/opt/shortener` (**including the database and uploads**), `/etc/shortener` and the user. It removes no packages and leaves shared ports 80/443 alone. **Make a backup first.**

```bash
sudo bash -euo pipefail <<'EOF'
source /etc/shortener/deploy.conf
systemctl disable --now "$APP-cron.timer" "$APP.service" 2>/dev/null || true
rm -f "/etc/systemd/system/$APP.service" "/etc/systemd/system/$APP-cron.service" "/etc/systemd/system/$APP-cron.timer"
systemctl daemon-reload
for f in /etc/nginx/sites-available/"$APP"-domain-* /etc/nginx/conf.d/"$APP"-domain-*.conf; do
  [ -e "$f" ] || continue
  D="$(basename "$f" .conf)"; D="${D#"$APP"-domain-}"
  if command -v certbot >/dev/null; then certbot delete --cert-name "$D" --non-interactive || true; fi
  rm -f "$f" "/etc/nginx/sites-enabled/$APP-domain-$D"
done
rm -f "/etc/nginx/sites-enabled/$APP" "/etc/nginx/sites-available/$APP" "/etc/nginx/conf.d/$APP.conf"
if command -v nginx >/dev/null && systemctl is-active --quiet nginx; then nginx -t && systemctl reload nginx; fi
if [ -n "$DOMAIN" ] && command -v certbot >/dev/null; then certbot delete --cert-name "$DOMAIN" --non-interactive || true; fi
if [ -z "$DOMAIN" ] && ufw status 2>/dev/null | grep -q "Status: active"; then ufw delete allow "$PUBLIC_PORT/tcp" || true; fi
rm -rf "$APP_HOME" "/etc/$APP"
id -u "$APP_USER" >/dev/null 2>&1 && userdel "$APP_USER" || true
echo "Removed $APP"
EOF
```

If step 3 created the swap file and no other app needs it, remove it too:

```bash
sudo bash -euo pipefail <<'EOF'
source /etc/shortener/deploy.conf
SWAPFILE="/swapfile-$APP"
if [ -f "$SWAPFILE" ]; then swapoff "$SWAPFILE" || true; rm -f "$SWAPFILE"; fi
sed -i "\|^$SWAPFILE |d" /etc/fstab
swapon --show
EOF
```

Also delete the deploy key at <https://github.com/cyberkyd01/premium-url-shortener/settings/keys>.

## Appendix: Caddy / Apache instead of nginx

Use this appendix only if preflight reported that ports 80/443 belong to another web server (a `STOP` about ports 80/443 is expected in that case; the other checks still apply). Do steps 1–10, skip step 11, then add **one** of the following. The app still listens only on `127.0.0.1:3101`. Both snippets serve `/uploads/` from disk, for the reason explained in step 11.

**Caddy** (it gets the HTTPS certificate on its own). This block uses `DOMAIN` from `deploy.conf`, or serves `http://SERVER_IP:8101` when it's empty, just like step 11. It doesn't edit your existing sites:

- If your Caddyfile already imports a folder of site files (a line like `import /etc/caddy/sites/*.caddy`), the shortener gets its own `shortener.caddy` in that folder and the Caddyfile isn't touched.
- Otherwise it writes `/etc/caddy/shortener.caddy` and appends one `import` line for it to the Caddyfile.

It runs `caddy validate` before reloading, and if validation fails it puts both files back exactly as they were. The reload is graceful, so your other sites keep running. Safe to re-run.

```bash
sudo bash -euo pipefail <<'EOF'
source /etc/shortener/deploy.conf
CADDYFILE=/etc/caddy/Caddyfile
command -v caddy >/dev/null && [ -f "$CADDYFILE" ] || { echo "STOP: Caddy or $CADDYFILE not found"; exit 1; }
# Reuse a folder the Caddyfile already imports (e.g. "import /etc/caddy/sites/*.caddy"); otherwise add one import line.
DIR="$(grep -oE '^[[:space:]]*import[[:space:]]+[^[:space:]]+/\*\.caddy' "$CADDYFILE" | awk '{print $2}' | head -1 | xargs -r dirname || true)"
if [ -n "$DIR" ]; then SITE="$DIR/$APP.caddy"; ADD_IMPORT=""; else SITE="$(dirname "$CADDYFILE")/$APP.caddy"; ADD_IMPORT="import $SITE"; fi
if [ -n "$DOMAIN" ]; then
  IP="$(curl -4fsS https://api.ipify.org || true)"; DNS="$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u | xargs || true)"
  case " $DNS " in *" $IP "*) echo "OK: $DOMAIN -> $IP" ;; *) echo "STOP: $DOMAIN resolves to '${DNS:-nothing}', this server is $IP. Fix the A record, wait a few minutes, re-run."; exit 1 ;; esac
  ADDR="$DOMAIN"
else
  ADDR="http://:$PUBLIC_PORT"
fi
cp -p "$CADDYFILE" "$CADDYFILE.bak-$APP"; [ -f "$SITE" ] && cp -p "$SITE" "$SITE.bak"
cat > "$SITE" <<CADDY
# Premium URL Shortener - written by DEPLOY.md (Appendix: Caddy). Safe to re-run; edit deploy.conf, not this file.
$ADDR {
    request_body {
        max_size 25MB
    }
    # Uploaded files live outside the release; next start would not see files added after it started.
    handle_path /uploads/* {
        root * $APP_HOME/shared/public/uploads
        header X-Content-Type-Options nosniff
        file_server
    }
    # flush_interval -1 keeps the live click stream (/api/stream/) unbuffered.
    reverse_proxy 127.0.0.1:$PORT {
        flush_interval -1
    }
}
CADDY
if [ -n "$ADD_IMPORT" ] && ! grep -qxF "$ADD_IMPORT" "$CADDYFILE"; then printf '\n# Premium URL Shortener (DEPLOY.md)\n%s\n' "$ADD_IMPORT" >> "$CADDYFILE"; fi
if ! caddy validate --config "$CADDYFILE" --adapter caddyfile >/tmp/$APP-caddy-validate.log 2>&1; then
  echo "STOP: caddy validate failed - restoring the previous state"; tail -5 /tmp/$APP-caddy-validate.log
  mv -f "$CADDYFILE.bak-$APP" "$CADDYFILE"
  if [ -f "$SITE.bak" ]; then mv -f "$SITE.bak" "$SITE"; else rm -f "$SITE"; fi
  exit 1
fi
rm -f "$CADDYFILE.bak-$APP" "$SITE.bak"
systemctl reload caddy
if [ -z "$DOMAIN" ] && ufw status 2>/dev/null | grep -q "Status: active"; then ufw allow "$PUBLIC_PORT/tcp" comment "$APP"; fi
echo "Caddy site OK: $SITE"
if [ -n "$DOMAIN" ]; then echo "Caddy is getting the certificate now - https://$DOMAIN works in about a minute."; else echo "Site: http://$(curl -4fsS https://api.ipify.org):$PUBLIC_PORT"; fi
EOF
```

To **connect a domain later** with Caddy, point the domain's A record at the server, set `DOMAIN` in `deploy.conf`, run the `.env` block from "Adding a domain later" in step 11 (it updates the URLs and redeploys), then run the block above again. Caddy replaces the `:8101` site with the domain and gets the certificate itself; no certbot needed. Remove the old port's firewall rule with `sudo ufw delete allow 8101/tcp`.

**Apache.** Create `/etc/apache2/sites-available/shortener.conf` with your domain:

```apache
<VirtualHost *:80>
    ServerName go.example.com
    LimitRequestBody 26214400

    Alias /uploads/ /opt/shortener/shared/public/uploads/
    <Directory /opt/shortener/shared/public/uploads>
        Options -Indexes
        Require all granted
        Header set X-Content-Type-Options nosniff
    </Directory>

    ProxyPreserveHost On
    ProxyPass /uploads/ !
    ProxyPass /api/stream/ http://127.0.0.1:3101/api/stream/ flushpackets=on
    ProxyPass / http://127.0.0.1:3101/
    ProxyPassReverse / http://127.0.0.1:3101/
</VirtualHost>
```

Then enable it (these commands only add modules and a site) and get the certificate:

```bash
sudo a2enmod proxy proxy_http headers && sudo a2ensite shortener && sudo apache2ctl configtest && sudo systemctl reload apache2
sudo env DEBIAN_FRONTEND=noninteractive NEEDRESTART_SUSPEND=1 apt-get install -y --no-install-recommends python3-certbot-apache && sudo certbot --apache -d go.example.com
```

For uninstall, instead of the nginx lines: on Apache run `sudo a2dissite shortener && sudo systemctl reload apache2`. On Caddy, delete the `shortener.caddy` file the block printed, remove the `import .../shortener.caddy` line from the Caddyfile if the block added one, then `sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy`.
