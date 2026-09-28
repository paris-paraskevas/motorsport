import { describe, expect, it } from 'vitest';
import { commonsSrcSet, commonsThumb } from './commons-thumb';

// The Commons thumbnail rule (R13 PR C): an original or an existing thumb at one of the widths the service renders, the query
// dropped; anything else left alone.

const ORIGINAL = 'https://upload.wikimedia.org/wikipedia/commons/4/4b/FIA_F1_Austria_2026_Nr._12_Antonelli_%281%29.jpg';
const THUMB = (w: number) => `https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/FIA_F1_Austria_2026_Nr._12_Antonelli_%281%29.jpg/${w}px-FIA_F1_Austria_2026_Nr._12_Antonelli_%281%29.jpg`;

describe('commonsThumb', () => {
  it('turns a Commons original into the bucket’s thumb, the encoded name kept, the query dropped', () => {
    expect(commonsThumb(ORIGINAL, 960)).toBe(THUMB(960));
    expect(commonsThumb(`${ORIGINAL}?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original`, 500)).toBe(THUMB(500));
    for (const w of [120, 250, 500, 960, 1280, 1920] as const) expect(commonsThumb(ORIGINAL, w)).toBe(THUMB(w));
  });

  it('rebuckets an existing thumb, whatever its width, and keeps JPEG, upper-case extensions and PNG', () => {
    expect(commonsThumb(THUMB(1920), 500)).toBe(THUMB(500));
    expect(commonsThumb(THUMB(1280), 1280)).toBe(THUMB(1280));
    expect(commonsThumb('https://upload.wikimedia.org/wikipedia/commons/8/88/Pierre_Gasly.JPEG', 250)).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Pierre_Gasly.JPEG/250px-Pierre_Gasly.JPEG');
    expect(commonsThumb('https://upload.wikimedia.org/wikipedia/commons/f/fd/2022_French_Grand_Prix_(midcrop).png', 500)).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/2022_French_Grand_Prix_(midcrop).png/500px-2022_French_Grand_Prix_(midcrop).png');
  });

  it('leaves another host, an SVG, a Commons page and a bare path alone', () => {
    for (const src of ['https://img.example/monza.jpg', 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Logo.svg', 'https://commons.wikimedia.org/wiki/File:Example.jpg', '/covers/monza.jpg', '']) {
      expect(commonsThumb(src, 960)).toBe(src);
    }
  });
});

describe('commonsSrcSet', () => {
  it('lists the buckets as candidates for a Commons picture and is empty for any other address', () => {
    expect(commonsSrcSet(ORIGINAL, [500, 960, 1280])).toBe(`${THUMB(500)} 500w, ${THUMB(960)} 960w, ${THUMB(1280)} 1280w`);
    expect(commonsSrcSet(THUMB(1920), [500, 960])).toBe(`${THUMB(500)} 500w, ${THUMB(960)} 960w`);
    expect(commonsSrcSet('https://img.example/monza.jpg', [500, 960])).toBe('');
  });
});
