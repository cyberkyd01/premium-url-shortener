# Premium URL Shortener — Developer API

Base URL: `https://your-domain.com`

## Authentication

Every `/api/v1` request needs an API key. Create keys in **Dashboard → Settings → API** (each key can be restricted to permissions such as `links.read` or `qr.*`). Send it as a header:

```
Authorization: Bearer YOUR_API_KEY
```

`?key=YOUR_API_KEY` is accepted as a fallback for GET requests. API access must be included in your plan.

## Envelope, errors & pagination

Successful responses return `{ "error": 0, ... }`; failures return `{ "error": 1, "message": "..." }` with a matching HTTP status:

| Status | Meaning |
| --- | --- |
| 400 | Validation error (message explains) |
| 401 | Missing/invalid API key |
| 402 | Plan limit or feature not included |
| 403 | Permission denied (key permission, admin only, inactive account) |
| 404 | Resource not found |
| 409 | Conflict (alias/slug taken) |
| 429 | Rate limit exceeded |
| 503 | API disabled |

List endpoints accept `?page=` and `?limit=` (max 100) and return `{ data: [...], pagination: { page, limit, total, pages } }`.

## Rate limits

Requests are limited per API key per minute (the admin configures the value under Settings → API; default 60). `429` is returned when exceeded. Anonymous `/api/shorten` calls are limited to 20 per minute per IP.

## Permissions

API keys carry a list of permissions. `*` grants everything; `links.*` grants every link permission. Endpoint permissions:

`account.read`, `account.write`, `links.read`, `links.write`, `campaigns.read`, `campaigns.write`, `channels.read`, `channels.write`, `pixels.read`, `pixels.write`, `domains.read`, `domains.write`, `splash.read`, `overlays.read`, `qr.read`, `qr.write`, `bio.read`, `bio.write`, `files.read`, `files.write`, `teams.read`, `users.read`, `users.write`, `plans.read`, `payments.read`

## Account

### GET /api/v1/account

**Get account** — permission `account.read`

Profile, plan, subscription, limits with current usage and feature flags.

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/account" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clx0",
    "username": "jane",
    "email": "jane@example.com",
    "name": "Jane",
    "role": "user",
    "plan": {
      "id": "clxp",
      "name": "Pro",
      "slug": "pro",
      "isFree": false,
      "expires": "2027-01-01T00:00:00.000Z"
    },
    "limits": {
      "links": {
        "limit": -1,
        "used": 240
      },
      "bioPages": {
        "limit": 5,
        "used": 1
      }
    },
    "features": {
      "customAlias": true,
      "api": true
    }
  }
}
```

### PUT /api/v1/account

**Update account** — permission `account.write`

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `name` | string | Display name. |
| `avatar` | string | Avatar URL. |
| `timezone` | string | IANA timezone, e.g. Europe/Paris. |
| `language` | string | Language code. |

Example request:

```bash
curl -X PUT "https://your-domain.com/api/v1/account" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","timezone":"Europe/Paris"}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clx0",
    "username": "jane",
    "name": "Jane Doe",
    "timezone": "Europe/Paris"
  }
}
```

## Links

Create, list, update and analyze short links. Legacy paths `/api/v1/urls`, `POST /api/v1/url`, `/api/v1/stats/:id` and `/api/v1/urls/:id/stats` map to the same handlers.

### GET /api/v1/links

**List links** — permission `links.read`

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `search` | string | Match alias, url or title. |
| `order` | string | date (default) \| clicks \| alias. |
| `campaign` | string | Campaign id. |
| `channel` | string | Channel id. |
| `domain` | string | Domain id/hostname or `main`. |
| `status` | string | active \| pending \| disabled \| blocked \| archived. |
| `page / limit` | number | Pagination (limit max 100). |

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/links?order=clicks&limit=25" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clx1abc",
      "alias": "sale",
      "short": "https://sho.rt/sale",
      "url": "https://example.com/spring-sale",
      "title": "Spring sale",
      "description": null,
      "domain": null,
      "domainId": null,
      "clicks": 128,
      "uniqueClicks": 97,
      "redirectType": "direct",
      "password": false,
      "expiresAt": null,
      "clickLimit": null,
      "campaignId": null,
      "channelId": null,
      "pixels": [],
      "geoTargets": [
        {
          "country": "DE",
          "url": "https://example.de/sale"
        }
      ],
      "deviceTargets": [],
      "langTargets": [],
      "timeTargets": [],
      "conditions": [],
      "abUrls": [],
      "rotatorMode": "none",
      "utm": {
        "source": "newsletter",
        "medium": "email",
        "campaign": "spring"
      },
      "customParams": {},
      "forwardParams": false,
      "deepLink": false,
      "cloaking": false,
      "botBlock": false,
      "inAppBreakout": false,
      "isPublic": true,
      "isArchived": false,
      "isPinned": false,
      "status": "active",
      "notes": null,
      "createdAt": "2026-03-01T10:00:00.000Z",
      "updatedAt": "2026-03-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "pages": 1
  }
}
```

### POST /api/v1/links

**Create link** — permission `links.write`

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `url` * | string | Destination URL (http, https, mailto, tel, sms). |
| `custom` | string | Custom alias (letters, numbers, - and _). Alias `alias` is accepted too. Short aliases may require a premium plan. |
| `domain` | string | Domain id or hostname of one of your custom domains (or a public domain). Omit for the main domain. |
| `type` | string | Redirection type: direct \| frame \| splash \| custom \| overlay. |
| `splash` | string | Custom splash page id (sets type=custom). See GET /splash. |
| `overlay` | string | Overlay id (sets type=overlay). See GET /overlays. |
| `password` | string | Password protect the link. |
| `expiry` | string | Expiration date (ISO 8601 or unix timestamp). `expiredUrl` may point visitors elsewhere after expiry. |
| `clickLimit` | number | Maximum number of clicks (`clickLimitUrl` optional). |
| `geotarget` | array|object | `[{country:'US', state?:'CA', url}]` or legacy `{US:'https://…'}`. |
| `devicetarget` | array|object | `[{device:'iphone'\|'android'\|'ipad'\|'mobile'\|'desktop'\|'windows'\|'mac'\|'linux', url}]` or `{iphone:'https://…'}`. |
| `languagetarget` | array|object | `[{lang:'de', url}]` or `{de:'https://…'}`. |
| `timetarget` | array | `[{from:'09:00', to:'17:00', days:[1,2,3,4,5], timezone:'Europe/Berlin', url}]`. |
| `conditions` | array | Advanced rules: `[{match:'all'\|'any', rules:[{field, op, value}], url}]` (fields: country, region, city, device, os, browser, language, referer, ip, hour, day, inapp, bot, param:<name>). |
| `abUrls` | array | A/B variants `[{url, weight?}]`; `rotatorMode`: ab \| rotate \| random. |
| `deeplink` | object|boolean | `{ios:'app://…', android:'intent://…', fallback:'https://…', auto:true}` or `true` to auto-detect. |
| `utm` | object | `{source, medium, campaign, term, content}` appended to the destination. |
| `params` | object | Extra query parameters appended to the destination. `forwardParams:true` forwards the visitor's own query string. |
| `campaign` | string | Campaign id or slug. |
| `channel` | string | Channel id. |
| `pixels` | string[] | Retargeting pixel ids. |
| `title / description / image` | string | Custom meta tags used for social previews. |
| `cloaking / botBlock / inAppBreakout` | boolean | Link cloaking, block bots, break out of in-app browsers. |
| `notes` | string | Private notes. |
| `isPublic` | boolean | Show public stats for this link (default true). |

Example request:

```bash
curl -X POST "https://your-domain.com/api/v1/links" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/spring-sale","custom":"sale","type":"direct","geotarget":[{"country":"DE","url":"https://example.de/sale"}],"utm":{"source":"newsletter","medium":"email","campaign":"spring"}}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clx1abc",
    "alias": "sale",
    "short": "https://sho.rt/sale",
    "url": "https://example.com/spring-sale",
    "title": "Spring sale",
    "description": null,
    "domain": null,
    "domainId": null,
    "clicks": 128,
    "uniqueClicks": 97,
    "redirectType": "direct",
    "password": false,
    "expiresAt": null,
    "clickLimit": null,
    "campaignId": null,
    "channelId": null,
    "pixels": [],
    "geoTargets": [
      {
        "country": "DE",
        "url": "https://example.de/sale"
      }
    ],
    "deviceTargets": [],
    "langTargets": [],
    "timeTargets": [],
    "conditions": [],
    "abUrls": [],
    "rotatorMode": "none",
    "utm": {
      "source": "newsletter",
      "medium": "email",
      "campaign": "spring"
    },
    "customParams": {},
    "forwardParams": false,
    "deepLink": false,
    "cloaking": false,
    "botBlock": false,
    "inAppBreakout": false,
    "isPublic": true,
    "isArchived": false,
    "isPinned": false,
    "status": "active",
    "notes": null,
    "createdAt": "2026-03-01T10:00:00.000Z",
    "updatedAt": "2026-03-01T10:00:00.000Z"
  },
  "id": "clx1abc",
  "alias": "sale",
  "short": "https://sho.rt/sale",
  "url": "https://example.com/spring-sale"
}
```

### GET /api/v1/links/:id

**Get link** — permission `links.read`

`:id` accepts the link id or its alias.

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/links/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clx1abc",
    "alias": "sale",
    "short": "https://sho.rt/sale",
    "url": "https://example.com/spring-sale",
    "title": "Spring sale",
    "description": null,
    "domain": null,
    "domainId": null,
    "clicks": 128,
    "uniqueClicks": 97,
    "redirectType": "direct",
    "password": false,
    "expiresAt": null,
    "clickLimit": null,
    "campaignId": null,
    "channelId": null,
    "pixels": [],
    "geoTargets": [
      {
        "country": "DE",
        "url": "https://example.de/sale"
      }
    ],
    "deviceTargets": [],
    "langTargets": [],
    "timeTargets": [],
    "conditions": [],
    "abUrls": [],
    "rotatorMode": "none",
    "utm": {
      "source": "newsletter",
      "medium": "email",
      "campaign": "spring"
    },
    "customParams": {},
    "forwardParams": false,
    "deepLink": false,
    "cloaking": false,
    "botBlock": false,
    "inAppBreakout": false,
    "isPublic": true,
    "isArchived": false,
    "isPinned": false,
    "status": "active",
    "notes": null,
    "createdAt": "2026-03-01T10:00:00.000Z",
    "updatedAt": "2026-03-01T10:00:00.000Z"
  }
}
```

### PUT /api/v1/links/:id

**Update link** — permission `links.write`

Accepts every field of *Create link* (all optional) plus `archived`, `pinned` and, for admins, `status`.

Example request:

```bash
curl -X PUT "https://your-domain.com/api/v1/links/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/new-destination","password":"secret","expiry":"2026-12-31T23:59:59Z"}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clx1abc",
    "alias": "sale",
    "short": "https://sho.rt/sale",
    "url": "https://example.com/spring-sale",
    "title": "Spring sale",
    "description": null,
    "domain": null,
    "domainId": null,
    "clicks": 128,
    "uniqueClicks": 97,
    "redirectType": "direct",
    "password": true,
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "clickLimit": null,
    "campaignId": null,
    "channelId": null,
    "pixels": [],
    "geoTargets": [
      {
        "country": "DE",
        "url": "https://example.de/sale"
      }
    ],
    "deviceTargets": [],
    "langTargets": [],
    "timeTargets": [],
    "conditions": [],
    "abUrls": [],
    "rotatorMode": "none",
    "utm": {
      "source": "newsletter",
      "medium": "email",
      "campaign": "spring"
    },
    "customParams": {},
    "forwardParams": false,
    "deepLink": false,
    "cloaking": false,
    "botBlock": false,
    "inAppBreakout": false,
    "isPublic": true,
    "isArchived": false,
    "isPinned": false,
    "status": "active",
    "notes": null,
    "createdAt": "2026-03-01T10:00:00.000Z",
    "updatedAt": "2026-03-01T10:00:00.000Z"
  }
}
```

### DELETE /api/v1/links/:id

**Delete link** — permission `links.write`

Example request:

```bash
curl -X DELETE "https://your-domain.com/api/v1/links/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clx1abc",
    "alias": "sale"
  },
  "message": "Link deleted"
}
```

### GET /api/v1/links/:id/stats

**Link statistics** — permission `links.read`

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `days` | number | Window in days (1-365, default 30). |

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/links/clx1abc/stats?days=7" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clx1abc",
    "alias": "sale",
    "days": 7,
    "clicks": 128,
    "uniqueClicks": 97,
    "total": 128,
    "unique": 97,
    "byDay": [
      {
        "date": "2026-03-01",
        "clicks": 12
      }
    ],
    "byHour": [
      {
        "hour": 0,
        "clicks": 3
      }
    ],
    "countries": [
      {
        "label": "US",
        "count": 60
      }
    ],
    "cities": [
      {
        "label": "New York",
        "count": 20
      }
    ],
    "regions": [],
    "referers": [
      {
        "label": "twitter.com",
        "count": 40
      }
    ],
    "browsers": [
      {
        "label": "Chrome",
        "count": 90
      }
    ],
    "os": [
      {
        "label": "iOS",
        "count": 50
      }
    ],
    "devices": [
      {
        "label": "mobile",
        "count": 80
      }
    ],
    "languages": [
      {
        "label": "en",
        "count": 100
      }
    ],
    "targets": [],
    "utmSources": [],
    "utmMediums": [],
    "utmCampaigns": [],
    "heatmap": [
      [
        40.71,
        -74
      ]
    ]
  }
}
```

### GET /api/v1/links/:id/clicks

**Recent clicks** — permission `links.read`

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `page / limit` | number | Pagination (default limit 50). |

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/links/clx1abc/clicks" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clk1",
      "country": "United States",
      "countryCode": "US",
      "city": "New York",
      "refererHost": "twitter.com",
      "browser": "Chrome",
      "os": "iOS",
      "device": "mobile",
      "language": "en",
      "unique": true,
      "createdAt": "2026-03-02T09:12:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "pages": 1
  }
}
```

### POST /api/v1/links/bulk

**Bulk create** — permission `links.write`

Up to 100 links per request. Items can be URL strings or objects with the same fields as *Create link*. Top-level fields act as defaults for every item.

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `urls` * | array | URLs or link objects. |

Example request:

```bash
curl -X POST "https://your-domain.com/api/v1/links/bulk" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://example.com/a",{"url":"https://example.com/b","custom":"b-link"}],"campaign":"spring"}'
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clx1abc",
      "alias": "sale",
      "short": "https://sho.rt/sale",
      "url": "https://example.com/spring-sale",
      "title": "Spring sale",
      "description": null,
      "domain": null,
      "domainId": null,
      "clicks": 128,
      "uniqueClicks": 97,
      "redirectType": "direct",
      "password": false,
      "expiresAt": null,
      "clickLimit": null,
      "campaignId": null,
      "channelId": null,
      "pixels": [],
      "geoTargets": [
        {
          "country": "DE",
          "url": "https://example.de/sale"
        }
      ],
      "deviceTargets": [],
      "langTargets": [],
      "timeTargets": [],
      "conditions": [],
      "abUrls": [],
      "rotatorMode": "none",
      "utm": {
        "source": "newsletter",
        "medium": "email",
        "campaign": "spring"
      },
      "customParams": {},
      "forwardParams": false,
      "deepLink": false,
      "cloaking": false,
      "botBlock": false,
      "inAppBreakout": false,
      "isPublic": true,
      "isArchived": false,
      "isPinned": false,
      "status": "active",
      "notes": null,
      "createdAt": "2026-03-01T10:00:00.000Z",
      "updatedAt": "2026-03-01T10:00:00.000Z"
    }
  ],
  "failed": [
    {
      "url": "https://example.com/b",
      "message": "This alias is already taken"
    }
  ],
  "created": 1,
  "total": 2
}
```

### POST /api/v1/links/:id/archive

**Archive / restore** — permission `links.write`

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `archived` | boolean | Default true; send false to restore. |

Example request:

```bash
curl -X POST "https://your-domain.com/api/v1/links/clx1abc/archive" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"archived":true}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clx1abc",
    "alias": "sale",
    "short": "https://sho.rt/sale",
    "url": "https://example.com/spring-sale",
    "title": "Spring sale",
    "description": null,
    "domain": null,
    "domainId": null,
    "clicks": 128,
    "uniqueClicks": 97,
    "redirectType": "direct",
    "password": false,
    "expiresAt": null,
    "clickLimit": null,
    "campaignId": null,
    "channelId": null,
    "pixels": [],
    "geoTargets": [
      {
        "country": "DE",
        "url": "https://example.de/sale"
      }
    ],
    "deviceTargets": [],
    "langTargets": [],
    "timeTargets": [],
    "conditions": [],
    "abUrls": [],
    "rotatorMode": "none",
    "utm": {
      "source": "newsletter",
      "medium": "email",
      "campaign": "spring"
    },
    "customParams": {},
    "forwardParams": false,
    "deepLink": false,
    "cloaking": false,
    "botBlock": false,
    "inAppBreakout": false,
    "isPublic": true,
    "isArchived": true,
    "isPinned": false,
    "status": "active",
    "notes": null,
    "createdAt": "2026-03-01T10:00:00.000Z",
    "updatedAt": "2026-03-01T10:00:00.000Z"
  },
  "message": "Link archived"
}
```

## Campaigns

### GET /api/v1/campaigns

**List campaigns** — permission `campaigns.read`

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/campaigns" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clxc",
      "name": "Spring",
      "slug": "spring",
      "color": "#6366f1",
      "isRotator": false,
      "isPublic": false,
      "links": 12,
      "createdAt": "2026-02-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "pages": 1
  }
}
```

### POST /api/v1/campaigns

**Create campaign** — permission `campaigns.write`

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `name` * | string | Campaign name. |
| `slug` | string | Public slug (auto-generated). |
| `description / color` | string | Optional. |
| `isPublic` | boolean | Publish the campaign page. |
| `isRotator` | boolean | Enable the link rotator; `rotatorAlias` + `rotatorMode` (sequential \| random \| weighted). |

Example request:

```bash
curl -X POST "https://your-domain.com/api/v1/campaigns" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Spring","isRotator":true,"rotatorMode":"random"}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxc",
    "name": "Spring",
    "slug": "spring",
    "isRotator": true,
    "rotatorAlias": "k3Qz9a",
    "rotatorUrl": "https://sho.rt/k3Qz9a",
    "rotatorMode": "random"
  }
}
```

### GET /api/v1/campaigns/:id

**Get campaign** — permission `campaigns.read`

Includes up to 100 links.

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/campaigns/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxc",
    "name": "Spring",
    "slug": "spring",
    "links": [
      {
        "id": "clx1abc",
        "alias": "sale",
        "short": "https://sho.rt/sale",
        "url": "https://example.com/spring-sale",
        "title": "Spring sale",
        "description": null,
        "domain": null,
        "domainId": null,
        "clicks": 128,
        "uniqueClicks": 97,
        "redirectType": "direct",
        "password": false,
        "expiresAt": null,
        "clickLimit": null,
        "campaignId": null,
        "channelId": null,
        "pixels": [],
        "geoTargets": [
          {
            "country": "DE",
            "url": "https://example.de/sale"
          }
        ],
        "deviceTargets": [],
        "langTargets": [],
        "timeTargets": [],
        "conditions": [],
        "abUrls": [],
        "rotatorMode": "none",
        "utm": {
          "source": "newsletter",
          "medium": "email",
          "campaign": "spring"
        },
        "customParams": {},
        "forwardParams": false,
        "deepLink": false,
        "cloaking": false,
        "botBlock": false,
        "inAppBreakout": false,
        "isPublic": true,
        "isArchived": false,
        "isPinned": false,
        "status": "active",
        "notes": null,
        "createdAt": "2026-03-01T10:00:00.000Z",
        "updatedAt": "2026-03-01T10:00:00.000Z"
      }
    ]
  }
}
```

### PUT /api/v1/campaigns/:id

**Update campaign** — permission `campaigns.write`

Example request:

```bash
curl -X PUT "https://your-domain.com/api/v1/campaigns/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Spring 2026","color":"#10b981"}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxc",
    "name": "Spring 2026",
    "color": "#10b981"
  }
}
```

### DELETE /api/v1/campaigns/:id

**Delete campaign** — permission `campaigns.write`

Example request:

```bash
curl -X DELETE "https://your-domain.com/api/v1/campaigns/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxc"
  },
  "message": "Campaign deleted. Links were kept."
}
```

### POST /api/v1/campaigns/:id/links

**Add links** — permission `campaigns.write`

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `links` * | string[] | Link ids to attach. Send the same body with DELETE to detach. |

Example request:

```bash
curl -X POST "https://your-domain.com/api/v1/campaigns/clx1abc/links" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"links":["clx1abc","clx2def"]}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "campaignId": "clxc",
    "added": 2
  }
}
```

### GET /api/v1/campaigns/:id/stats

**Campaign statistics** — permission `campaigns.read`

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `days` | number | Window in days. |

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/campaigns/clx1abc/stats" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxc",
    "name": "Spring",
    "days": 30,
    "links": 12,
    "clicks": 1400,
    "uniqueClicks": 900,
    "topLinks": [
      {
        "id": "clx1abc",
        "alias": "sale",
        "clicks": 128,
        "uniqueClicks": 97
      }
    ],
    "total": 128,
    "unique": 97,
    "byDay": [
      {
        "date": "2026-03-01",
        "clicks": 12
      }
    ],
    "byHour": [
      {
        "hour": 0,
        "clicks": 3
      }
    ],
    "countries": [
      {
        "label": "US",
        "count": 60
      }
    ],
    "cities": [
      {
        "label": "New York",
        "count": 20
      }
    ],
    "regions": [],
    "referers": [
      {
        "label": "twitter.com",
        "count": 40
      }
    ],
    "browsers": [
      {
        "label": "Chrome",
        "count": 90
      }
    ],
    "os": [
      {
        "label": "iOS",
        "count": 50
      }
    ],
    "devices": [
      {
        "label": "mobile",
        "count": 80
      }
    ],
    "languages": [
      {
        "label": "en",
        "count": 100
      }
    ],
    "targets": [],
    "utmSources": [],
    "utmMediums": [],
    "utmCampaigns": [],
    "heatmap": [
      [
        40.71,
        -74
      ]
    ]
  }
}
```

## Channels

### GET /api/v1/channels

**List channels** — permission `channels.read`

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/channels" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clxch",
      "name": "Social",
      "color": "#6366f1",
      "starred": true,
      "counts": {
        "links": 5,
        "bio": 1,
        "qr": 2
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "pages": 1
  }
}
```

### POST /api/v1/channels

**Create channel** — permission `channels.write`

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `name` * | string | Channel name. |
| `color` | string | Hex color. |
| `starred` | boolean | Pin to top. |

Example request:

```bash
curl -X POST "https://your-domain.com/api/v1/channels" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Social","color":"#ec4899"}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxch",
    "name": "Social",
    "color": "#ec4899",
    "starred": false
  }
}
```

### PUT /api/v1/channels/:id

**Update channel** — permission `channels.write`

Example request:

```bash
curl -X PUT "https://your-domain.com/api/v1/channels/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"starred":true}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxch",
    "name": "Social",
    "starred": true
  }
}
```

### DELETE /api/v1/channels/:id

**Delete channel** — permission `channels.write`

Example request:

```bash
curl -X DELETE "https://your-domain.com/api/v1/channels/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxch"
  },
  "message": "Channel deleted"
}
```

### POST /api/v1/channels/:id/assign

**Assign resources** — permission `channels.write`

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `links` | string[] | Link ids. |
| `qr` | string[] | QR code ids. |
| `bio` | string[] | Bio page ids. |

Example request:

```bash
curl -X POST "https://your-domain.com/api/v1/channels/clx1abc/assign" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"links":["clx1abc"],"qr":["clxq"]}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "channelId": "clxch",
    "assigned": {
      "links": 1,
      "qr": 1,
      "bio": 0
    }
  }
}
```

## Pixels

### GET /api/v1/pixels

**List pixels** — permission `pixels.read`

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/pixels" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clxpx",
      "name": "FB main",
      "provider": "facebook",
      "pixelId": "123456789",
      "links": 4
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "pages": 1
  }
}
```

### POST /api/v1/pixels

**Create pixel** — permission `pixels.write`

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `name` * | string | Label. |
| `provider` * | string | facebook \| twitter \| bing \| google-ads \| gtm \| ga \| snapchat \| reddit \| quora \| pinterest \| tiktok \| linkedin \| adroll \| hotjar \| clarity \| matomo \| custom |
| `pixelId` * | string | The pixel/tag id (or full snippet for custom). |

Example request:

```bash
curl -X POST "https://your-domain.com/api/v1/pixels" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"FB main","provider":"facebook","pixelId":"123456789"}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxpx",
    "name": "FB main",
    "provider": "facebook",
    "pixelId": "123456789"
  }
}
```

### PUT /api/v1/pixels/:id

**Update pixel** — permission `pixels.write`

Example request:

```bash
curl -X PUT "https://your-domain.com/api/v1/pixels/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"FB retargeting"}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxpx",
    "name": "FB retargeting"
  }
}
```

### DELETE /api/v1/pixels/:id

**Delete pixel** — permission `pixels.write`

Example request:

```bash
curl -X DELETE "https://your-domain.com/api/v1/pixels/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxpx"
  },
  "message": "Pixel deleted"
}
```

## Domains

### GET /api/v1/domains

**List domains** — permission `domains.read`

Your custom domains plus public domains provided by the site.

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/domains" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clxd",
      "domain": "go.example.com",
      "status": "active",
      "isPublic": false,
      "own": true,
      "links": 40
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "pages": 1
  },
  "main": "sho.rt"
}
```

### POST /api/v1/domains

**Add domain** — permission `domains.write`

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `domain` * | string | Hostname, e.g. go.example.com (point an A/CNAME record to the main domain). |
| `rootRedirect` | string | Where the bare domain redirects. |
| `notFoundRedirect` | string | Fallback for unknown aliases. |

Example request:

```bash
curl -X POST "https://your-domain.com/api/v1/domains" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain":"go.example.com","rootRedirect":"https://example.com"}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxd",
    "domain": "go.example.com",
    "status": "active"
  },
  "dns": {
    "type": "A or CNAME",
    "target": "sho.rt",
    "txtVerification": null
  }
}
```

### DELETE /api/v1/domains/:id

**Delete domain** — permission `domains.write`

Example request:

```bash
curl -X DELETE "https://your-domain.com/api/v1/domains/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxd",
    "domain": "go.example.com"
  },
  "message": "Domain deleted. Links on it now use the main domain."
}
```

## Splash pages & overlays

### GET /api/v1/splash

**List splash pages** — permission `splash.read`

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/splash" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clxs",
      "name": "Promo splash",
      "title": "Wait for it",
      "countdown": 5,
      "isDefault": false,
      "links": 3
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "pages": 1
  }
}
```

### GET /api/v1/overlays

**List overlays** — permission `overlays.read`

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/overlays" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clxo",
      "name": "Newsletter CTA",
      "type": "newsletter",
      "position": "bottom-left",
      "links": 2
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "pages": 1
  }
}
```

## QR codes

### GET /api/v1/qr

**List QR codes** — permission `qr.read`

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `search / type / channel` | string | Filters. |

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/qr" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clxq",
      "name": "Menu",
      "type": "url",
      "data": {
        "url": "https://example.com/menu"
      },
      "content": "https://sho.rt/Qx8Ab2Cd",
      "target": "https://example.com/menu",
      "dynamic": true,
      "alias": "Qx8Ab2Cd",
      "scanUrl": "https://sho.rt/Qx8Ab2Cd",
      "image": "https://sho.rt/api/qr/clxq/download?format=svg",
      "scans": 12
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "pages": 1
  }
}
```

### POST /api/v1/qr

**Create QR code** — permission `qr.write`

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `type` * | string | url \| text \| email \| phone \| sms \| wifi \| vcard \| location \| event \| app \| crypto \| whatsapp \| paypal \| link \| bio |
| `data` * | object|string | Type specific: url→{url}; text→{text}; email→{email,subject,body}; phone→{phone}; sms→{phone,message}; wifi→{ssid,password,encryption:WPA\|WEP\|nopass,hidden}; vcard→{firstName,lastName,phone,mobile,email,org,title,website,street,city,state,zip,country,note}; location→{lat,lng}; event→{title,start,end,location,description,url}; app→{url,ios,android,fallback}; crypto→{coin,address,amount,label}; whatsapp→{phone,message}; paypal→{username,amount,currency}; link→{linkId}; bio→{bioPageId}. A plain string is accepted for url/text. |
| `name` | string | Label. |
| `style` | object | {dots: square\|rounded\|dots\|classy\|classy-rounded\|extra-rounded, corners: square\|extra-rounded\|dot, cornerDots: square\|dot, color, gradient:{type,rotation,from,to}, bg, logo, logoSize, frame: none\|simple\|label-bottom\|label-top\|badge, frameText, frameColor, margin, size, ecLevel, template} — requires advanced QR. |
| `dynamic` | boolean | Dynamic (trackable, editable) code that encodes a short tracking URL; default per plan. Only url, link, bio, app, whatsapp, paypal style types can be dynamic. |
| `channel` | string | Channel id. |

Example request:

```bash
curl -X POST "https://your-domain.com/api/v1/qr" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"wifi","name":"Office Wi-Fi","data":{"ssid":"Office","password":"s3cret","encryption":"WPA"},"dynamic":false,"style":{"color":"#111827","dots":"rounded"}}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxq",
    "name": "Office Wi-Fi",
    "type": "wifi",
    "data": {
      "ssid": "Office",
      "password": "s3cret",
      "encryption": "WPA"
    },
    "content": "WIFI:T:WPA;S:Office;P:s3cret;;",
    "dynamic": false,
    "image": "https://sho.rt/api/qr/clxq/download?format=svg",
    "scans": 0
  }
}
```

### GET /api/v1/qr/:id

**Get QR code** — permission `qr.read`

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/qr/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxq",
    "name": "Menu",
    "type": "url",
    "data": {
      "url": "https://example.com/menu"
    },
    "content": "https://sho.rt/Qx8Ab2Cd",
    "dynamic": true,
    "scans": 12
  }
}
```

### PUT /api/v1/qr/:id

**Update QR code** — permission `qr.write`

Same fields as create. Changing `data` of a dynamic code updates where scans go without reprinting.

Example request:

```bash
curl -X PUT "https://your-domain.com/api/v1/qr/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"data":{"url":"https://example.com/menu-v2"}}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxq",
    "data": {
      "url": "https://example.com/menu-v2"
    },
    "target": "https://example.com/menu-v2"
  }
}
```

### DELETE /api/v1/qr/:id

**Delete QR code** — permission `qr.write`

Example request:

```bash
curl -X DELETE "https://your-domain.com/api/v1/qr/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxq"
  },
  "message": "QR code deleted"
}
```

### GET /api/v1/qr/:id/stats

**QR statistics** — permission `qr.read`

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `days` | number | Window in days. |

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/qr/clx1abc/stats" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxq",
    "name": "Menu",
    "dynamic": true,
    "days": 30,
    "scans": 12,
    "total": 128,
    "unique": 97,
    "byDay": [
      {
        "date": "2026-03-01",
        "clicks": 12
      }
    ],
    "byHour": [
      {
        "hour": 0,
        "clicks": 3
      }
    ],
    "countries": [
      {
        "label": "US",
        "count": 60
      }
    ],
    "cities": [
      {
        "label": "New York",
        "count": 20
      }
    ],
    "regions": [],
    "referers": [
      {
        "label": "twitter.com",
        "count": 40
      }
    ],
    "browsers": [
      {
        "label": "Chrome",
        "count": 90
      }
    ],
    "os": [
      {
        "label": "iOS",
        "count": 50
      }
    ],
    "devices": [
      {
        "label": "mobile",
        "count": 80
      }
    ],
    "languages": [
      {
        "label": "en",
        "count": 100
      }
    ],
    "targets": [],
    "utmSources": [],
    "utmMediums": [],
    "utmCampaigns": [],
    "heatmap": [
      [
        40.71,
        -74
      ]
    ]
  }
}
```

### GET /api/v1/qr/:id/image

**QR image** — permission `qr.read`

Responds with a 302 redirect to the rendered image at `/api/qr/:id/download`.

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `format` | string | svg (default) \| png \| jpg \| webp \| pdf |
| `size` | number | Pixel size for raster formats. |

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/qr/clx1abc/image?format=png&size=600" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
302 Location: https://sho.rt/api/qr/clxq/download?format=png&size=600
```

## Bio pages

### GET /api/v1/bio

**List bio pages** — permission `bio.read`

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/bio" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clxb",
      "alias": "jane",
      "url": "https://sho.rt/jane",
      "name": "Jane",
      "theme": "default",
      "views": 340,
      "uniqueViews": 200,
      "blockCount": 6
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "pages": 1
  }
}
```

### POST /api/v1/bio

**Create bio page** — permission `bio.write`

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `alias` * | string | Page alias. |
| `name / bio / avatar / cover` | string | Profile fields. |
| `theme` | string | Theme slug. |
| `layout / buttonStyle / font / colors / socials / seo` | mixed | Design options (see Update). |
| `domain` | string | Custom domain id/hostname (plan feature). |
| `blocks` | array | `[{type, title, url, content}]` created in order. |

Example request:

```bash
curl -X POST "https://your-domain.com/api/v1/bio" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"alias":"jane","name":"Jane Doe","bio":"Designer & maker","theme":"sunset","blocks":[{"type":"link","title":"Portfolio","url":"https://jane.design"},{"type":"youtube","title":"Latest video","url":"https://youtube.com/watch?v=abc"}]}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxb",
    "alias": "jane",
    "url": "https://sho.rt/jane",
    "name": "Jane Doe",
    "blocks": [
      {
        "id": "blk1",
        "type": "link",
        "title": "Portfolio",
        "url": "https://jane.design",
        "order": 0,
        "clicks": 0,
        "enabled": true
      }
    ]
  }
}
```

### GET /api/v1/bio/:id

**Get bio page** — permission `bio.read`

Includes blocks.

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/bio/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxb",
    "alias": "jane",
    "blocks": []
  }
}
```

### PUT /api/v1/bio/:id

**Update bio page** — permission `bio.write`

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `alias, name, bio, avatar, cover, theme` | string | Profile & theme. |
| `layout` | string | centered \| left \| split \| card \| grid |
| `buttonStyle` | string | rounded \| square \| pill \| outline \| shadow \| frosted \| hard-shadow |
| `colors` | object | {bg, bgGradient, text, button, buttonText, link, animation} |
| `socials` | array | [{network, url}] |
| `seo` | object | {title, description, image, noindex} |
| `password / ageGate / sensitive / nsfwWarning / newsletterGate / hideBranding / status` | mixed | Access & misc. |

Example request:

```bash
curl -X PUT "https://your-domain.com/api/v1/bio/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"theme":"midnight","socials":[{"network":"instagram","url":"https://instagram.com/jane"}]}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxb",
    "theme": "midnight"
  }
}
```

### DELETE /api/v1/bio/:id

**Delete bio page** — permission `bio.write`

Example request:

```bash
curl -X DELETE "https://your-domain.com/api/v1/bio/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxb",
    "alias": "jane"
  },
  "message": "Bio page deleted"
}
```

### GET /api/v1/bio/:id/stats

**Bio statistics** — permission `bio.read`

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/bio/clx1abc/stats" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxb",
    "alias": "jane",
    "days": 30,
    "views": 340,
    "uniqueViews": 200,
    "blocks": [
      {
        "id": "blk1",
        "type": "link",
        "title": "Portfolio",
        "clicks": 80
      }
    ],
    "total": 128,
    "unique": 97,
    "byDay": [
      {
        "date": "2026-03-01",
        "clicks": 12
      }
    ],
    "byHour": [
      {
        "hour": 0,
        "clicks": 3
      }
    ],
    "countries": [
      {
        "label": "US",
        "count": 60
      }
    ],
    "cities": [
      {
        "label": "New York",
        "count": 20
      }
    ],
    "regions": [],
    "referers": [
      {
        "label": "twitter.com",
        "count": 40
      }
    ],
    "browsers": [
      {
        "label": "Chrome",
        "count": 90
      }
    ],
    "os": [
      {
        "label": "iOS",
        "count": 50
      }
    ],
    "devices": [
      {
        "label": "mobile",
        "count": 80
      }
    ],
    "languages": [
      {
        "label": "en",
        "count": 100
      }
    ],
    "targets": [],
    "utmSources": [],
    "utmMediums": [],
    "utmCampaigns": [],
    "heatmap": [
      [
        40.71,
        -74
      ]
    ]
  }
}
```

### POST /api/v1/bio/:id/blocks

**Add block** — permission `bio.write`

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `type` * | string | link \| heading \| text \| image \| gallery \| video \| youtube \| spotify \| tiktok \| twitter \| instagram \| email \| phone \| vcard \| contact \| newsletter \| faq \| poll \| countdown \| map \| calendly \| divider \| html \| product \| paypal \| file \| … (see schema) |
| `title / url` | string | Label and target. |
| `content` | object | Block-specific config. |
| `order / enabled / scheduleStart / scheduleEnd / countries / languages / sensitive / gated / animation` | mixed | Optional. |

Example request:

```bash
curl -X POST "https://your-domain.com/api/v1/bio/clx1abc/blocks" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"link","title":"Shop","url":"https://shop.example.com"}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "blk2",
    "type": "link",
    "title": "Shop",
    "url": "https://shop.example.com",
    "order": 1,
    "clicks": 0,
    "enabled": true
  }
}
```

### PUT /api/v1/bio/:id/blocks/:blockId

**Update block** — permission `bio.write`

Example request:

```bash
curl -X PUT "https://your-domain.com/api/v1/bio/clx1abc/blocks/blk2" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Shop now","enabled":false}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "blk2",
    "title": "Shop now",
    "enabled": false
  }
}
```

### DELETE /api/v1/bio/:id/blocks/:blockId

**Delete block** — permission `bio.write`

Example request:

```bash
curl -X DELETE "https://your-domain.com/api/v1/bio/clx1abc/blocks/blk2" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "blk2"
  },
  "message": "Block deleted"
}
```

## Files

### GET /api/v1/files

**List hosted files** — permission `files.read`

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/files" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clxf",
      "alias": "brochure",
      "url": "https://sho.rt/f/brochure",
      "name": "brochure.pdf",
      "size": 204800,
      "mime": "application/pdf",
      "downloads": 15
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "pages": 1
  },
  "storageUsed": 204800,
  "storageLimitMb": 500
}
```

### DELETE /api/v1/files/:id

**Delete file** — permission `files.write`

Example request:

```bash
curl -X DELETE "https://your-domain.com/api/v1/files/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clxf"
  },
  "message": "File deleted"
}
```

## Teams

### GET /api/v1/teams

**List teams** — permission `teams.read`

Teams you own and teams you belong to, with members and permissions.

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/teams" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "owned": [
      {
        "id": "clxt",
        "name": "Marketing",
        "role": "owner",
        "members": [
          {
            "userId": "clx9",
            "username": "bob",
            "role": "member",
            "permissions": {
              "links": [
                "view",
                "create"
              ]
            }
          }
        ]
      }
    ],
    "memberOf": [],
    "activeTeamId": null
  }
}
```

## Admin

Only API keys belonging to administrators can call these endpoints.

### GET /api/v1/users

**List users** — permission `users.read` — *admin only*

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `search / plan / status / role` | string | Filters (status: active \| banned \| pending). |

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/users" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clx0",
      "username": "jane",
      "email": "jane@example.com",
      "role": "user",
      "status": "active",
      "plan": {
        "id": "clxp",
        "name": "Pro",
        "slug": "pro"
      },
      "planExpires": "2027-01-01T00:00:00.000Z",
      "lastLoginAt": "2026-03-01T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "pages": 1
  }
}
```

### POST /api/v1/users

**Create user** — permission `users.write` — *admin only*

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `email` * | string | Email. |
| `password` * | string | Min 6 chars. |
| `username` | string | Letters and numbers; derived from the email when omitted. |
| `planId` | string | Plan id or slug (free plan by default). |
| `planExpires` | string | ISO date. |
| `role` | string | user \| admin \| custom role slug. |
| `name` | string | Display name. |

Example request:

```bash
curl -X POST "https://your-domain.com/api/v1/users" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"S3cret!!","username":"bob","planId":"pro","planExpires":"2027-01-01"}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clx9",
    "username": "bob",
    "email": "bob@example.com",
    "role": "user",
    "plan": {
      "slug": "pro"
    },
    "apiKey": "pus_…"
  }
}
```

### GET /api/v1/users/:id

**Get user** — permission `users.read` — *admin only*

`:id` accepts id, username or email.

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/users/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clx9",
    "username": "bob",
    "counts": {
      "links": 3,
      "bio": 0,
      "qr": 1,
      "payments": 1
    }
  }
}
```

### PUT /api/v1/users/:id

**Update user** — permission `users.write` — *admin only*

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `name, email, password, planId, planExpires, role, status, verified, aiCredits` | mixed | Any subset. |

Example request:

```bash
curl -X PUT "https://your-domain.com/api/v1/users/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"planId":"pro","planExpires":"2027-06-01","status":"active"}'
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clx9",
    "plan": {
      "slug": "pro"
    },
    "planExpires": "2027-06-01T00:00:00.000Z"
  }
}
```

### DELETE /api/v1/users/:id

**Delete user** — permission `users.write` — *admin only*

Example request:

```bash
curl -X DELETE "https://your-domain.com/api/v1/users/clx1abc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": {
    "id": "clx9",
    "username": "bob"
  },
  "message": "User deleted with all their data"
}
```

### GET /api/v1/plans

**List plans** — permission `plans.read` — *admin only*

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/plans" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clxp",
      "name": "Pro",
      "slug": "pro",
      "priceMonthly": 29,
      "priceYearly": 290,
      "limits": {
        "limitLinks": -1,
        "limitDomains": -1
      },
      "features": {
        "api": true
      },
      "users": 42
    }
  ]
}
```

### GET /api/v1/payments

**List payments** — permission `payments.read` — *admin only*

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `user / status / gateway` | string | Filters. |

Example request:

```bash
curl -X GET "https://your-domain.com/api/v1/payments" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
{
  "error": 0,
  "data": [
    {
      "id": "clxpay",
      "userId": "clx9",
      "user": {
        "username": "bob"
      },
      "plan": {
        "slug": "pro"
      },
      "gateway": "stripe",
      "amount": 29,
      "currency": "USD",
      "interval": "monthly",
      "status": "completed",
      "invoiceNumber": "INV-…",
      "createdAt": "2026-03-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "pages": 1
  }
}
```

## Public & session endpoints

These endpoints power the homepage, bookmarklet and browser extension. They accept an API key, a logged-in browser session, or (when the site allows it) anonymous requests.

### POST /api/shorten

**Quick shorten** — API key, session or anonymous

Anonymous callers are limited to 20 requests per minute per IP.

Body parameters:

| Name | Type | Description |
| --- | --- | --- |
| `url` * | string | Destination. |
| `alias` | string | Custom alias. |
| `domainId` | string | Domain id. |
| `redirectType` | string | direct \| frame \| splash. |
| `captcha` | string | Captcha token — required for anonymous requests when the admin enabled captcha on shorten. |

Example request:

```bash
curl -X POST "https://your-domain.com/api/shorten" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/very/long/path"}'
```

Example response:

```json
{
  "error": 0,
  "id": "clx1abc",
  "alias": "k3Qz9a",
  "short": "https://sho.rt/k3Qz9a",
  "url": "https://example.com/very/long/path",
  "status": "active",
  "anonymous": true
}
```

### GET /api/shorten

**Quick shorten (GET)** — API key, session or anonymous

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `url` * | string | Destination. |
| `alias` | string | Custom alias. |
| `format` | string | json (default) \| text — text returns only the short URL. |

Example request:

```bash
curl -X GET "https://your-domain.com/api/shorten?url=https%3A%2F%2Fexample.com&format=text" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Example response:

```json
https://sho.rt/k3Qz9a
```

### GET /api/unshorten

**Unshorten** — public

Query parameters:

| Name | Type | Description |
| --- | --- | --- |
| `url` * | string | Short URL or alias. |

Example request:

```bash
curl -X GET "https://your-domain.com/api/unshorten?url=https%3A%2F%2Fsho.rt%2Fsale"
```

Example response:

```json
{
  "error": 0,
  "alias": "sale",
  "short": "https://sho.rt/sale",
  "url": "https://example.com/spring-sale",
  "title": "Spring sale",
  "description": null,
  "expired": false,
  "createdAt": "2026-03-01T10:00:00.000Z"
}
```

## Webhooks (Zapier & custom)

Create webhooks under **Dashboard → Tools → Webhooks** (or connect Zapier and pick the events). Each event is delivered as `POST` JSON with a `X-Signature` header containing `hex(HMAC-SHA256(secret, body))` when a secret is set.

### link.created

A short link was created (dashboard, API, Slack, import).

```json
{
  "event": "link.created",
  "data": {
    "id": "clx1abc",
    "alias": "sale",
    "short": "https://sho.rt/sale",
    "url": "https://example.com/spring-sale"
  },
  "timestamp": "2026-03-01T10:00:00.000Z"
}
```

### link.clicked

A visitor clicked one of your links (bots excluded).

```json
{
  "event": "link.clicked",
  "data": {
    "id": "clx1abc",
    "alias": "sale",
    "country": "US",
    "device": "mobile",
    "referer": "twitter.com"
  },
  "timestamp": "2026-03-02T09:12:00.000Z"
}
```

### bio.viewed

A bio page was viewed.

```json
{
  "event": "bio.viewed",
  "data": {
    "id": "clxb",
    "alias": "jane",
    "country": "DE",
    "device": "desktop"
  },
  "timestamp": "2026-03-02T09:12:00.000Z"
}
```

### qr.scanned

A dynamic QR code was scanned.

```json
{
  "event": "qr.scanned",
  "data": {
    "id": "clxq",
    "alias": "Qx8Ab2Cd",
    "country": "FR",
    "device": "mobile"
  },
  "timestamp": "2026-03-02T09:12:00.000Z"
}
```

### link.updated / link.deleted

A link was edited or removed.

```json
{
  "event": "link.deleted",
  "data": {
    "id": "clx1abc",
    "alias": "sale",
    "url": "https://example.com/spring-sale"
  },
  "timestamp": "2026-03-03T09:12:00.000Z"
}
```

## Slack

Admins enable Slack under Settings → Integrations and add a slash command whose Request URL is `https://your-domain.com/api/webhook/slack`. Users connect their Slack account under Dashboard → Tools (a `Webhook` row with provider `slack`, url `slack` and secret `TEAM_ID:USER_ID`) and then run `/shorten https://example.com [alias]`.

## Cron

Scheduled jobs live under `/api/cron/<job>` and are protected by `Authorization: Bearer $CRON_SECRET` (or `?secret=`). Jobs: `expire-plans`, `expire-links`, `cleanup`, `subscriptions`, `notify-expiring`, `imports`, `reset-ai-credits`, `storage-sync`, `backup`. `GET /api/cron` runs them all. `pnpm cron` (scripts/cron.ts) calls every job; use `pnpm cron --loop 10` for a sidecar loop.

## Client libraries & integrations

### PHP

Path: `integrations/api-clients/php/PremiumURLShortener.php`

```
require "PremiumURLShortener.php";
$api = new PremiumURLShortener("https://sho.rt", "YOUR_API_KEY");
$api->setCustom("sale");
echo $api->shorten("https://example.com/spring-sale"); // https://sho.rt/sale
print_r($api->stats("clx1abc", 7));
```

### Node.js

Path: `integrations/api-clients/node/client.js`

```
const { PremiumURLShortener } = require("./client");
const api = new PremiumURLShortener({ baseUrl: "https://sho.rt", apiKey: "YOUR_API_KEY" });
const link = await api.links.create({ url: "https://example.com", custom: "sale" });
console.log(link.short);
```

### WordPress plugin

Path: `integrations/wordpress/premium-url-shortener`

```
[shortlink url="https://example.com/post"]  // shortcode
// Auto-shortens on publish and serves wp_get_shortlink() from your domain.
```

### Chrome extension

Path: `integrations/chrome-extension`

```
Load unpacked → set Site URL + API key in Options → click the toolbar icon or right-click "Shorten this page/link".
```

### Bookmarklet

Path: `public/bookmarklet.js`

```
javascript:(function(){var s=document.createElement('script');s.src='https://sho.rt/bookmarklet.js?'+Date.now();document.body.appendChild(s);})();
```

