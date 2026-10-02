import { describe, expect, it } from 'vitest';
import { fitDescription, fitTitle, shortTitle, textWidth, titleFits } from './site';

// X10 (the Seobility crawl of 1 October): the title and description rules every template calls. Seobility measures a title
// in Arial at 20 px and flags one over 580 px (the crawl's "Formula 2 champions — full list, year by year — Paddock Tracker"
// measured 586; the model here gives 582), a description in Arial at 14 px over 1,000 px (161 characters measured 1,019),
// and a word used twice in a title whatever its length. The budgets keep a margin: 570 px with the suffix, 985 px, a floor
// of 440 px under which a tail is appended.

describe('fitTitle', () => {
  it('takes the first variant that fits, and only when none does cuts the last one at a word', () => {
    expect(fitTitle(['Sprint Race, Barcelona Sprint — GT World Challenge', 'Sprint Race, Barcelona Sprint'])).toBe('Sprint Race, Barcelona Sprint');
    expect(fitTitle(['Race, Azerbaijan Grand Prix — Formula 1'])).toBe('Race, Azerbaijan Grand Prix — Formula 1');
    expect(fitTitle(['Practice 1, Sonsio Grand Prix at the Brickyard — IndyCar', 'Practice 1 · IndyCar round 6'])).toBe('Practice 1 · IndyCar round 6');
    expect(fitTitle(['a title that is far too long for the browser tab and the search result'])).toBe('a title that is far too long for the browser tab');
    expect(fitTitle(['x'.repeat(50)])).toBe('x'.repeat(38));
    expect(fitTitle(['short'], 220)).toBe('sho');
    expect(fitTitle([' padded  '])).toBe('padded');
  });
});

describe('shortTitle', () => {
  it('keeps the longest clause before a delimiter that fits, the whole headline when it fits, a word cut otherwise', () => {
    expect(shortTitle('F1 Italian GP 2026: FP3 - Russell makes it two from two, and the top eight are covered by half a second')).toBe('F1 Italian GP 2026: FP3');
    expect(shortTitle('Norris takes the last Dutch Grand Prix, and Zandvoort loses Verstappen on lap one')).toBe('Norris takes the last Dutch Grand Prix');
    expect(shortTitle('Belgian Grand Prix 2026, lap by lap: the Spa race in order')).toBe('Belgian Grand Prix 2026');
    expect(shortTitle('Car killer on Friday, cure for insomnia on Sunday: what the Madring’s first weekend actually told us')).toBe('Car killer on Friday');
    expect(shortTitle('Six seconds in hand and the pit entry behind him: Norris loses Madrid to a rule, and Antonelli says so')).toBe('Six seconds in hand and the pit entry');
    expect(shortTitle('Write for Paddock')).toBe('Write for Paddock');
    expect(shortTitle('A: B')).toBe('A: B');
    expect(shortTitle('Why is the Azerbaijan Grand Prix on a Saturday this year?')).toBe('Why is the Azerbaijan Grand Prix');
    expect(shortTitle('ΜΙΑ ALPINE ΣΤΗΝ POLE ΚΑΙ ΕΝΑ ΙΤΑΛΙΚΟ ΠΑΡΑΛΗΡΗΜΑ: Όλα όσα έγιναν στην monza αυτό το σαββατοκύριακο.')).toBe('ΜΙΑ ALPINE ΣΤΗΝ POLE ΚΑΙ ΕΝΑ ΙΤΑΛΙΚΟ');
  });
});

describe('titleFits', () => {
  it('measures the whole title with the suffix', () => {
    expect(titleFits('Who won the 2020 F1 title?')).toBe(true);
    // 58 characters with the suffix measure 584 px: the answer page keeps the question whole and drops the suffix.
    expect(titleFits('Who won the 2020 Formula 1 championship?')).toBe(false);
    expect(titleFits('What is the difference between MotoGP, Moto2 and Moto3?')).toBe(false);
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
});
