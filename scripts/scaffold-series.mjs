// Scaffold a new series folder under content/series/<slug>/.
// Run via `node scripts/scaffold-series.mjs`.
// Idempotent for existing folders (won't overwrite an existing meta.json,
// so re-running after manual edits is safe).

import fs from 'node:fs';
import path from 'node:path';

const series = [
  {
    slug: 'motogp',
    name: 'MotoGP',
    color: '#fb923c',
    icsUrl: 'https://calendar.google.com/calendar/ical/832vbii8pmrvma356b4vn3v42c%40group.calendar.google.com/public/basic.ics',
  },
  {
    slug: 'wec',
    name: 'FIA WEC',
    color: '#3b82f6',
    icsUrl: 'https://calendar.google.com/calendar/ical/61jccgg4rshh1temqk0dj4lens%40group.calendar.google.com/public/basic.ics',
  },
  {
    slug: 'formula-e',
    name: 'Formula E',
    color: '#06b6d4',
    icsUrl: 'https://calendar.google.com/calendar/ical/vno0ntshopq0nmob26db2pcen8%40group.calendar.google.com/public/basic.ics',
  },
  {
    slug: 'wrc',
    name: 'WRC',
    color: '#eab308',
    icsUrl: 'https://calendar.google.com/calendar/ical/fei68gpe16c85ed3jjdtvrn8ns%40group.calendar.google.com/public/basic.ics',
  },
  {
    slug: 'gt-world',
    name: 'GT World Challenge',
    color: '#a855f7',
    icsUrl: 'https://calendar.google.com/calendar/ical/drne83rrmn7m9baje25qh2248s%40group.calendar.google.com/public/basic.ics',
  },
  {
    slug: 'dtm',
    name: 'DTM',
    color: '#10b981',
    icsUrl: 'https://calendar.google.com/calendar/ical/0urnjij5qqj3ijoht52fdsqk18%40group.calendar.google.com/public/basic.ics',
  },
];

const placeholderMd = (title) => `---
title: ${title}
---

<!-- TODO: author -->
`;

const fallbackIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//motorsport//placeholder//EN
END:VCALENDAR
`;

for (const s of series) {
  const dir = path.join('content', 'series', s.slug);
  const metaPath = path.join(dir, 'meta.json');

  fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(metaPath)) {
    fs.writeFileSync(metaPath, JSON.stringify({
      slug: s.slug,
      name: s.name,
      color: s.color,
      icsUrl: s.icsUrl,
      season: 2026,
    }, null, 2) + '\n');
  }

  const writeIfMissing = (filename, body) => {
    const p = path.join(dir, filename);
    if (!fs.existsSync(p)) fs.writeFileSync(p, body);
  };

  writeIfMissing('overview.md', placeholderMd(`${s.name} — overview`));
  writeIfMissing('drivers.md', placeholderMd(`${s.name} — 2026 lineup`));
  writeIfMissing('significance.md', placeholderMd(`${s.name} — significance`));
  writeIfMissing('significance.json', '{}\n');
  writeIfMissing('fallback.ics', fallbackIcs);

  console.log(`scaffolded ${s.slug}`);
}
