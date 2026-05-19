// Single source of truth for site-wide identity strings. Imported by
// app/layout.tsx, app/robots.ts, and lib/sitemap-data.ts. When the domain
// changes, edit this file only.

export const SITE_URL = 'https://paddock-tracker.com';
export const SITE_TITLE = 'Paddock';
export const SITE_DESCRIPTION =
  'Personal motorsport companion — F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more.';

// IndexNow protocol key. Public by design — the key file at
// `${SITE_URL}/${INDEXNOW_KEY}.txt` proves domain ownership to Bing /
// Yandex / Seznam, so the key being in source is intentional. Regenerating
// is cheap (mint a new UUIDv4, rename the public file, redeploy).
export const INDEXNOW_KEY = '9a3e7f2c-8b4d-4c1a-a5e6-d7f8b9c0e1d2';
export const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
