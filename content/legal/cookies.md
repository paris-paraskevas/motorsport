# Cookie Policy

_Last updated: 2026-05-19_

This Cookie Policy explains what cookies and similar local-storage technologies Paddock uses, why they are used, and how you can control them.

For a broader explanation of how we handle your personal data, see the [Privacy Policy](/privacy).

## What are cookies?

Cookies are small text files placed on your device when you visit a website. Similar technologies — such as `localStorage` and `sessionStorage` — store data in your browser without sending it back automatically. We treat both under the same consent framework.

## Categories we use

| Category | Consent required | Description |
|---|---|---|
| **Strictly necessary** | No | Required for the Site to work: authentication, security, your preferences. |
| **Functional** | Implicit (essential to features you turn on) | Things you opt into, like push notifications. |
| **Analytics** | Yes | Aggregate usage measurement (Google Analytics). Disabled by default. |
| **Marketing** | Yes | Advertising via Google AdSense. Disabled by default. |

## Cookies and storage we set or allow

### Strictly necessary
| Name | Owner | Purpose | Duration |
|---|---|---|---|
| `__cf_bm`, `_cfuvid` | Cloudflare (via Clerk) | Bot mitigation on auth requests | Session / 1 year |
| `__client`, `__client_uat`, `__session_*`, `__refresh_*`, `__clerk_db_jwt_*`, `clerk_active_context` | Clerk | Authentication session | Up to 1 year |
| `paddock:consent` (localStorage) | Paddock | Your cookie-consent choice | Until you clear it |
| `paddock:followed-series`, `paddock:theme`, and similar (localStorage) | Paddock | Your in-app preferences | Until you clear them |

### Functional
| Name | Owner | Purpose | Duration |
|---|---|---|---|
| Push subscription record (Vercel KV) | Paddock | Sending race notifications when you've enabled them | Until you disable notifications |

### Analytics (only after you grant consent)
| Name | Owner | Purpose | Duration |
|---|---|---|---|
| `_ga`, `_ga_DDMJ2NMBWC` | Google Analytics | Pseudonymous usage measurement | Up to 24 months |

### Marketing (only after you grant consent)
| Name | Owner | Purpose | Duration |
|---|---|---|---|
| `__gads`, `__gpi`, `IDE` (and others set by Google ad servers) | Google AdSense | Ad delivery and frequency capping | Up to 24 months |

### Third-party cookies set by Clerk on `.clerk.com`
Clerk uses its own product analytics (Segment, PostHog) and an ad-conversion identifier when you sign in. These cookies (`ajs_anonymous_id`, `ajs_user_id`, `_gcl_au`, `ph_phc_*`) are set on `clerk.com`, not on `paddock-tracker.com`, and are governed by Clerk's own privacy policy. We mention them here for transparency.

## How to control them

### In our banner
The first time you visit, a banner appears at the bottom of the page with three choices: **Accept all**, **Reject non-essential**, and **Customize** (per-category toggles).

If you reject non-essential cookies (or simply do nothing), only strictly-necessary cookies are set. Analytics and advertising scripts still load on the page but Google Consent Mode v2 is set to `denied`, so they suppress cookies and use cookieless pings only.

### Changing your mind later
There is a **"Cookie preferences"** link in the page footer that re-opens the banner. You can change your choice at any time, and we update the consent signals immediately.

### Global Privacy Control
If your browser sends the **Global Privacy Control** signal (e.g. Firefox setting, the Privacy Badger extension), we treat it as a "Reject non-essential" choice. You do not need to interact with the banner.

### Browser controls
You can also block or delete cookies from your browser settings. This may break authentication and stop us from remembering your preferences.

## Consent record

When you make a choice in the banner, we store a record (timestamp, categories chosen, consent version, anonymous identifier) both in your browser's local storage and on our server, for **24 months**, so we can demonstrate that you consented. We do not store your IP address with this record.

## Changes to this policy

The list above will change as we add or remove services. The "Last updated" date reflects the most recent change. Material changes are noted in the [release notes](/changelog).

## Contact

**pparaskevas.dev@gmail.com**
