# Paddock

Personal motorsport companion — live calendar, weekend pages, news, weather, and standings across F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more.

Live at https://paddock-tracker.com.

For contributors: see `CONTRIBUTING.md` and `ONBOARDING.md`. Engineering changelog: `CHANGELOG.md`. Public release notes: `RELEASES.md` (rendered at `/changelog`).

## IndexNow — push URLs to Bing / Yandex / Seznam

IndexNow is a free Microsoft-led protocol that pushes URLs to compliant search engines on publish rather than waiting for them to crawl. We use it to accelerate indexing on:

- **Bing** (and everything that consumes Bing's index: DuckDuckGo, Yahoo, Ecosia, Qwant, ChatGPT Search, Copilot)
- **Yandex**
- **Seznam**

**Not** supported by IndexNow:

- **Google** — has its own protocol (Search Console + sitemap ping). IndexNow has zero effect on Google indexing.
- **Brave Search** — has its own crawler with no push protocol; relies on organic discovery + the manual one-time submission at https://search.brave.com/submit-url.

### Key location

The IndexNow key is in `lib/site.ts` (`INDEXNOW_KEY`). The key file is served from `public/<INDEXNOW_KEY>.txt`. IndexNow keys are intentionally public per the protocol spec — the key file at the domain root proves ownership, so leaking the key string itself doesn't allow anyone to impersonate the site.

To rotate: mint a fresh UUIDv4, update `INDEXNOW_KEY` in `lib/site.ts`, rename the file in `public/`, redeploy.

### Manual submission

```bash
npm run indexnow:submit
```

This:

1. Reads the full sitemap via `buildSitemapEntries()` in `lib/sitemap-data.ts`
2. POSTs every URL to `https://api.indexnow.org/IndexNow` in batches of up to 1,000
3. Logs the count submitted plus any per-batch failures
4. Exits 0 on success, 1 on a fatal error (rare — network failures are warned, not raised)

The script is intentionally **not** wired into the build pipeline or any deploy hook. Run it manually after a significant content push (new series, mass round update, blog post) to nudge re-indexing. For routine deploys, the sitemap re-crawl Bing performs on its own cadence is enough.
