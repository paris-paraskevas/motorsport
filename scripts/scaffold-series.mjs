// Canonical series registry + scaffolder.
// Run via `node scripts/scaffold-series.mjs`.
//
// - Always writes meta.json from the registry below (source of truth).
// - Only writes placeholder .md / .json / .ics files when missing.
// - Safe to re-run after adding a new series to the registry.

import fs from 'node:fs';
import path from 'node:path';

const series = [
  {
    slug: 'f1',
    name: 'Formula 1',
    color: '#e10600',
    icsUrl: 'https://better-f1-calendar.vercel.app/api/calendar.ics',
    season: 2026,
    category: 'formula',
    wikipediaPage: 'Formula_One',
    championsPage: 'List_of_Formula_One_World_Champions',
    seasonPage: '2026_Formula_One_World_Championship',
    officialStandingsUrl: 'https://www.formula1.com/en/results.html/2026/drivers.html',
    officialSite: 'https://www.formula1.com/',
  },
  {
    slug: 'f2',
    name: 'Formula 2',
    color: '#38bdf8',
    icsUrl: 'https://calendar.google.com/calendar/ical/rttoqh7u6m247f2ub6c05m4pe4%40group.calendar.google.com/public/basic.ics',
    season: 2026,
    category: 'formula',
    wikipediaPage: 'FIA_Formula_2_Championship',
    championsPage: 'List_of_FIA_Formula_2_Championship_drivers',
    seasonPage: '2026_FIA_Formula_2_Championship',
    officialStandingsUrl: 'https://www.fiaformula2.com/Standings',
    officialSite: 'https://www.fiaformula2.com/',
  },
  {
    slug: 'f3',
    name: 'Formula 3',
    color: '#818cf8',
    icsUrl: 'https://calendar.google.com/calendar/ical/sorhedtr7q5qmea6f0hvf20864%40group.calendar.google.com/public/basic.ics',
    season: 2026,
    category: 'formula',
    wikipediaPage: 'FIA_Formula_3_Championship',
    championsPage: 'List_of_FIA_Formula_3_Championship_drivers',
    seasonPage: '2026_FIA_Formula_3_Championship',
    officialStandingsUrl: 'https://www.fiaformula3.com/Standings',
    officialSite: 'https://www.fiaformula3.com/',
  },
  {
    slug: 'formula-e',
    name: 'Formula E',
    color: '#06b6d4',
    icsUrl: 'https://calendar.google.com/calendar/ical/vno0ntshopq0nmob26db2pcen8%40group.calendar.google.com/public/basic.ics',
    season: 2026,
    category: 'formula',
    wikipediaPage: 'Formula_E',
    championsPage: 'List_of_Formula_E_champions',
    seasonPage: '2025%E2%80%9326_Formula_E_World_Championship',
    officialStandingsUrl: 'https://www.fiaformulae.com/en/standings',
    officialSite: 'https://www.fiaformulae.com/',
  },
  {
    slug: 'indycar',
    name: 'IndyCar',
    color: '#f43f5e',
    icsUrl: 'https://calendar.google.com/calendar/ical/hlskhf7l8ce7btind39bb9kf1o%40group.calendar.google.com/public/basic.ics',
    season: 2026,
    category: 'formula',
    wikipediaPage: 'IndyCar_Series',
    seasonPage: '2026_IndyCar_Series',
    officialStandingsUrl: 'https://www.indycar.com/Standings',
    officialSite: 'https://www.indycar.com/',
  },
  {
    slug: 'wec',
    name: 'FIA WEC',
    color: '#3b82f6',
    icsUrl: 'https://calendar.google.com/calendar/ical/61jccgg4rshh1temqk0dj4lens%40group.calendar.google.com/public/basic.ics',
    season: 2026,
    category: 'endurance',
    wikipediaPage: 'FIA_World_Endurance_Championship',
    seasonPage: '2026_FIA_World_Endurance_Championship',
    officialStandingsUrl: 'https://www.fiawec.com/en/standings',
    officialSite: 'https://www.fiawec.com/',
  },
  {
    slug: 'nls',
    name: 'NLS Nürburgring',
    color: '#fbbf24',
    icsUrl: 'https://calendar.google.com/calendar/ical/f7ubn1ltpc4p7amil7kefgj754%40group.calendar.google.com/public/basic.ics',
    season: 2026,
    category: 'endurance',
    wikipediaPage: 'Nürburgring_Langstrecken-Serie',
    seasonPage: '2026_Nürburgring_Langstrecken-Serie',
    officialSite: 'https://nls-langstrecke.de/',
  },
  {
    slug: 'imsa',
    name: 'IMSA',
    color: '#2dd4bf',
    icsUrl: 'https://calendar.google.com/calendar/ical/njulhksvo83qeoruc3nhend9js%40group.calendar.google.com/public/basic.ics',
    season: 2026,
    category: 'endurance',
    wikipediaPage: 'IMSA_SportsCar_Championship',
    championsPage: 'List_of_IMSA_SportsCar_Championship_champions',
    seasonPage: '2026_IMSA_SportsCar_Championship',
    officialStandingsUrl: 'https://www.imsa.com/standings',
    officialSite: 'https://www.imsa.com/',
  },
  {
    slug: 'gt-world',
    name: 'GT World Challenge',
    color: '#a855f7',
    icsUrl: 'https://calendar.google.com/calendar/ical/drne83rrmn7m9baje25qh2248s%40group.calendar.google.com/public/basic.ics',
    season: 2026,
    category: 'gt',
    wikipediaPage: 'GT_World_Challenge_Europe',
    seasonPage: '2026_GT_World_Challenge_Europe',
    officialStandingsUrl: 'https://www.gt-world-challenge-europe.com/standings',
    officialSite: 'https://www.gt-world-challenge-europe.com/',
  },
  {
    slug: 'dtm',
    name: 'DTM',
    color: '#10b981',
    icsUrl: 'https://calendar.google.com/calendar/ical/0urnjij5qqj3ijoht52fdsqk18%40group.calendar.google.com/public/basic.ics',
    season: 2026,
    category: 'gt',
    wikipediaPage: 'Deutsche_Tourenwagen_Masters',
    seasonPage: '2026_Deutsche_Tourenwagen_Masters',
    officialStandingsUrl: 'https://www.dtm.com/en/live/standings',
    officialSite: 'https://www.dtm.com/',
  },
  {
    slug: 'motogp',
    name: 'MotoGP',
    color: '#fb923c',
    icsUrl: 'https://calendar.google.com/calendar/ical/832vbii8pmrvma356b4vn3v42c%40group.calendar.google.com/public/basic.ics',
    season: 2026,
    category: 'motorcycle',
    wikipediaPage: 'MotoGP',
    championsPage: 'List_of_Grand_Prix_motorcycle_racing_World_champions',
    seasonPage: '2026_MotoGP_World_Championship',
    officialStandingsUrl: 'https://www.motogp.com/en/standings',
    officialSite: 'https://www.motogp.com/',
  },
  {
    slug: 'wsbk',
    name: 'WorldSBK',
    color: '#f59e0b',
    icsUrl: 'https://calendar.google.com/calendar/ical/0rts2iu5gd88eis52c084ltlhc%40group.calendar.google.com/public/basic.ics',
    season: 2026,
    category: 'motorcycle',
    wikipediaPage: 'Superbike_World_Championship',
    seasonPage: '2026_Superbike_World_Championship',
    officialStandingsUrl: 'https://www.worldsbk.com/en/standings',
    officialSite: 'https://www.worldsbk.com/',
  },
  {
    slug: 'wrc',
    name: 'WRC',
    color: '#eab308',
    icsUrl: 'https://calendar.google.com/calendar/ical/fei68gpe16c85ed3jjdtvrn8ns%40group.calendar.google.com/public/basic.ics',
    season: 2026,
    category: 'rally',
    wikipediaPage: 'World_Rally_Championship',
    seasonPage: '2026_World_Rally_Championship',
    officialStandingsUrl: 'https://www.wrc.com/en/championship/standings/',
    officialSite: 'https://www.wrc.com/',
  },
  {
    slug: 'nascar-cup',
    name: 'NASCAR Cup',
    color: '#a3e635',
    icsUrl: 'https://calendar.google.com/calendar/ical/db8c47ne2bt9qbld2mhdabm0u8%40group.calendar.google.com/public/basic.ics',
    season: 2026,
    category: 'stock',
    wikipediaPage: 'NASCAR_Cup_Series',
    championsPage: 'List_of_NASCAR_Cup_Series_champions',
    seasonPage: '2026_NASCAR_Cup_Series',
    officialStandingsUrl: 'https://www.nascar.com/standings/',
    officialSite: 'https://www.nascar.com/',
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

let created = 0;
let updated = 0;

for (const s of series) {
  const dir = path.join('content', 'series', s.slug);
  const metaPath = path.join(dir, 'meta.json');
  const existed = fs.existsSync(dir);

  fs.mkdirSync(dir, { recursive: true });

  // meta.json: write only when missing. The checked-in meta.json files are
  // the source of truth — they carry curated fixes (F1 championsPage, WEC
  // standings URL) the registry above has drifted from; rewriting here would
  // silently revert curated production content (audit 4-1).
  if (!fs.existsSync(metaPath)) {
    fs.writeFileSync(metaPath, JSON.stringify(s, null, 2) + '\n');
  }

  // Placeholders: only write when missing
  const writeIfMissing = (filename, body) => {
    const p = path.join(dir, filename);
    if (!fs.existsSync(p)) fs.writeFileSync(p, body);
  };

  writeIfMissing('overview.md', placeholderMd(`${s.name} — overview`));
  writeIfMissing('drivers.md', placeholderMd(`${s.name} — 2026 lineup`));
  writeIfMissing('significance.md', placeholderMd(`${s.name} — significance`));
  writeIfMissing('significance.json', '{}\n');
  writeIfMissing('fallback.ics', fallbackIcs);

  if (existed) {
    updated++;
    console.log(`updated ${s.slug}`);
  } else {
    created++;
    console.log(`created ${s.slug}`);
  }
}

console.log(`\n${created} new, ${updated} updated, ${series.length} total`);
