import { describe, expect, it } from 'vitest';
import { DESCRIPTION_TAIL, SITE_TITLE, TITLE_SUFFIX, fitDescription, fitTitle, shortTitle, textWidth } from './site';

// X10 (the Seobility crawl of 1 October): the title and description rules every template calls. Seobility measures a title
// in Arial at 20 px and flags one over 580 px (the crawl's "Formula 2 champions — full list, year by year — Paddock Tracker"
// measured 586; the model here gives 582), a description in Arial at 14 px over 1,000 px (161 characters measured 1,019),
// and a word used twice in a title whatever its length. The budgets keep a margin: 570 px with the suffix, 985 px, a floor
// of 440 px under which a tail is appended.

describe('fitTitle', () => {
  it('drops a “· round” stub when the cut lands between the word and its number (the second reviewer’s finding)', () => {
    expect(fitTitle(['Indianapolis 500 Top 12 Qualifying · round 7'])).toBe('Indianapolis 500 Top 12 Qualifying');
  });
  it('takes the first variant that fits, and only when none does cuts the last one at a word', () => {
    expect(fitTitle(['Sprint Race, Barcelona Sprint — GT World Challenge', 'Sprint Race, Barcelona Sprint'])).toBe('Sprint Race, Barcelona Sprint');
    expect(fitTitle(['Race, Azerbaijan Grand Prix — Formula 1'])).toBe('Race, Azerbaijan Grand Prix — Formula 1');
    expect(fitTitle(['Practice 1, Sonsio Grand Prix at the Brickyard — IndyCar', 'Practice 1 · IndyCar round 6'])).toBe('Practice 1 · IndyCar round 6');
    expect(fitTitle(['a title that is far too long for the browser tab and the search result'])).toBe('a title that is far too long for the browser tab');
    expect(fitTitle(['x'.repeat(50)])).toBe('x'.repeat(38));
    expect(fitTitle(['short'], 220)).toBe('sho');
    expect(fitTitle([' padded  '])).toBe('padded');
    // A cut never leaves a separator behind (23 live titles ended in “·” when the last variant was cut before “round n”).
    expect(fitTitle(['Indianapolis 500 Fast Friday Practice and more words · round 6'])).toBe('Indianapolis 500 Fast Friday Practice');
    expect(fitTitle(['Some session with a very long name indeed | round 6'])).not.toMatch(/[·|/&,:;–—-]\s*$/);
    // An unclosed parenthesis at the start is not a reason to return nothing.
    expect(fitTitle(['(' + 'x'.repeat(60)])).not.toBe('');
    // A word the suffix carries counts as a repeat: the variant without it wins.
    expect(fitTitle(['Predictions and the paddock', 'Predictions'])).toBe('Predictions');
  });
});

describe('shortTitle', () => {
  it('keeps the longest clause before a delimiter that fits, the whole headline when it fits, a word cut otherwise', () => {
    expect(shortTitle('F1 Italian GP 2026: FP3 - Russell makes it two from two, and the top eight are covered by half a second')).toBe('F1 Italian GP 2026: FP3');
    expect(shortTitle('Norris takes the last Dutch Grand Prix, and Zandvoort loses Verstappen on lap one')).toBe('Norris takes the last Dutch Grand Prix');
    expect(shortTitle('Belgian Grand Prix 2026, lap by lap: the Spa race in order')).toBe('Belgian Grand Prix 2026');
    expect(shortTitle('Car killer on Friday, cure for insomnia on Sunday: what the Madring’s first weekend actually told us')).toBe('Car killer on Friday');
    expect(shortTitle('McLaren let him go in November. Madrid made him champion: Ugo Ugochukwu’s fifteen-point turnaround')).toBe('McLaren let him go in November');
    expect(shortTitle('Six seconds in hand and the pit entry behind him: Norris loses Madrid to a rule, and Antonelli says so')).toBe('Six seconds in hand and the pit entry');
    expect(shortTitle('Write for Paddock')).toBe('Write for Paddock');
    expect(shortTitle('A: B')).toBe('A: B');
    expect(shortTitle('Why is the Azerbaijan Grand Prix on a Saturday this year?')).toBe('Why is the Azerbaijan Grand Prix');
    // X10b: Greek capitals measured as capitals (667), the cut lands one word earlier and the whole stays under 580 px in Arial.
    expect(shortTitle('ΜΙΑ ALPINE ΣΤΗΝ POLE ΚΑΙ ΕΝΑ ΙΤΑΛΙΚΟ ΠΑΡΑΛΗΡΗΜΑ: Όλα όσα έγιναν στην monza αυτό το σαββατοκύριακο.')).toBe('ΜΙΑ ALPINE ΣΤΗΝ POLE ΚΑΙ ΕΝΑ');
  });
});

describe('the width model (X10b: measured against the Arial file by the reviewer)', () => {
  it('reproduces Seobility’s own rows within one per cent and derives the suffix from the site title', () => {
    expect(textWidth('Formula 2 champions — full list, year by year — Paddock Tracker', 20)).toBeGreaterThan(578);
    expect(textWidth('Formula 2 champions — full list, year by year — Paddock Tracker', 20)).toBeLessThan(590);
    expect(TITLE_SUFFIX).toBe(` — ${SITE_TITLE}`);
    // 58 characters with the suffix measure 584 px: the answer page keeps such a question whole and drops the suffix.
    expect(textWidth('Who won the 2020 Formula 1 championship?' + TITLE_SUFFIX, 20)).toBeGreaterThan(570);
    expect(textWidth('Who won the 2020 F1 title?' + TITLE_SUFFIX, 20)).toBeLessThan(570);
  });

  it('gives the glyphs the table lacks a capital’s width when they are capitals, and the odd Latin letters their own', () => {
    expect(textWidth('Ω', 20)).toBeCloseTo(13.34, 1);
    expect(textWidth('ω', 20)).toBeCloseTo(11.12, 1);
    expect(textWidth('·', 20)).toBeCloseTo(6.66, 1);
    expect(textWidth('æ', 20)).toBeCloseTo(17.78, 1);
    expect(textWidth('ø', 20)).toBeCloseTo(12.22, 1);
    expect(textWidth('ß', 20)).toBeCloseTo(12.22, 1);
    expect(textWidth('í', 20)).toBeCloseTo(5.56, 1);
    // The Greek headline the first model kept under the budget measures over it in Arial.
    expect(textWidth('ΜΙΑ ALPINE ΣΤΗΝ POLE ΚΑΙ ΕΝΑ ΙΤΑΛΙΚΟ' + TITLE_SUFFIX, 20)).toBeGreaterThan(570);
  });
});

describe('fitDescription', () => {
  const driver =
    'Kimi Antonelli — Mercedes in Formula 1. Season form and race-by-race results with championship position after every round, points, podiums, the next session countdown and the latest news mentions.';
  const answer =
    'MotoGP, Moto2 and Moto3 are the three classes of the Grand Prix motorcycle world championship. Moto3 is the entry class on 250cc single-cylinder bikes, Moto2 is a spec middleweight class where everyone shares a 765cc Triumph triple engine, and MotoGP is the prototype pinnacle on roughly 1,000cc manufacturer machines.';

  it('leaves a description between the floor and the ceiling alone, and trims its spaces', () => {
    const ok = 'The 24 Hours of Le Mans runs three classes at the same time, and the fastest Hypercar wins outright.';
    expect(fitDescription(ok)).toBe(ok);
    expect(fitDescription(`  ${ok}  `)).toBe(ok);
    expect(fitDescription('x'.repeat(140))).toBe('x'.repeat(140));
  });

  it('appends the tail under the floor, with the default tail or the one given', () => {
    expect(fitDescription('The first redesign.', { tail: 'Paddock’s release notes, update by update.' })).toBe('The first redesign. Paddock’s release notes, update by update.');
    expect(fitDescription('Paddock is out of early access.')).toBe('Paddock is out of early access. A sourced Paddock Tracker explainer.');
    expect(fitDescription('')).toBe(DESCRIPTION_TAIL);
    expect(fitDescription('Paddock is out of early access.', { tail: '' })).toBe('Paddock is out of early access.');
    expect(fitDescription('A sentence of about seventy characters is left alone by the rule here, as it is.')).toHaveLength(80);
  });

  it('cuts a long description at the last sentence end that is long enough, else at a word with an ellipsis', () => {
    expect(fitDescription(answer)).toBe('MotoGP, Moto2 and Moto3 are the three classes of the Grand Prix motorcycle world championship.');
    const cut = fitDescription(driver);
    expect(cut.length).toBeLessThanOrEqual(155);
    expect(textWidth(cut, 14)).toBeLessThanOrEqual(985);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut).toBe('Kimi Antonelli — Mercedes in Formula 1. Season form and race-by-race results with championship position after every round, points, podiums, the next…');
    const question = 'What is the difference between Formula 1 and IndyCar? F1 is a global championship where each team builds its own car and races mostly on road and street circuits; IndyCar is a US-based series.';
    expect(fitDescription(question)).toBe('What is the difference between Formula 1 and IndyCar? F1 is a global championship where each team builds its own car and races mostly on road…');
    expect(fitDescription(`${'x'.repeat(100)}. ${'y'.repeat(100)}.`)).toBe(`${'x'.repeat(100)}.`);
  });

  it('takes the first of several variants that fits, else cuts the last at a word with an ellipsis', () => {
    const long = 'Winward Racing Team Ravenol #80 (SP9 Pro), NLS Nürburgring: season form, every result with the championship position after each round, points, podiums and the next session.';
    const medium = 'Winward Racing Team Ravenol #80 (SP9 Pro), NLS Nürburgring: every result and the championship position after each round.';
    expect(fitDescription([long, medium])).toBe(medium);
    expect(fitDescription(['short one.', long])).toBe('short one.');
    const cut = fitDescription([long]);
    expect(cut.endsWith('…')).toBe(true);
    expect(textWidth(cut, 14)).toBeLessThanOrEqual(985);
  });
});
