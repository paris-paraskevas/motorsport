import { describe, it, expect } from 'vitest';
import { sanitizeLinks, validateAuthorProfile, BIO_MIN, LINKS_MAX } from './author-profile';

const bio = 'x'.repeat(BIO_MIN);
const base = { slug: 'jane-doe', displayName: 'Jane Doe', bio, links: [] };

describe('validateAuthorProfile', () => {
  it('accepts and normalizes a valid profile', () => {
    const out = validateAuthorProfile({
      ...base,
      slug: '  Jane-Doe  ',
      displayName: '  Jane   Doe  ',
      bio: `  ${bio}  `,
    });
    expect(out.slug).toBe('jane-doe');
    expect(out.displayName).toBe('Jane Doe');
    expect(out.bio).toBe(bio);
  });

  it.each([
    ['too short', 'ab'],
    ['uppercase', 'Jane_Doe'],
    ['leading hyphen', '-jane'],
    ['trailing hyphen', 'jane-'],
    ['double hyphen', 'jane--doe'],
    ['spaces', 'jane doe'],
    ['non-latin', 'παναγιώτης'],
  ])('rejects a %s slug', (_label, slug) => {
    expect(() => validateAuthorProfile({ ...base, slug })).toThrow(/profile address/i);
  });

  // The thin-content guard: a profile is an indexable page, so a one-line bio
  // must not be publishable.
  it('rejects a bio under the minimum', () => {
    expect(() => validateAuthorProfile({ ...base, bio: 'Writes about F1.' })).toThrow(/bio must be/i);
  });

  it('rejects a link that is not https', () => {
    expect(() =>
      validateAuthorProfile({ ...base, links: [{ label: 'Site', url: 'http://example.com' }] }),
    ).toThrow(/https/i);
  });

  it('rejects a link missing its label rather than dropping it silently', () => {
    expect(() => validateAuthorProfile({ ...base, links: [{ label: '  ', url: 'https://example.com' }] })).toThrow(
      /needs a label/i,
    );
  });

  it('rejects more links than the cap', () => {
    const links = Array.from({ length: LINKS_MAX + 1 }, (_, i) => ({
      label: `L${i}`,
      url: `https://example.com/${i}`,
    }));
    expect(() => validateAuthorProfile({ ...base, links })).toThrow(/up to/i);
  });

  it('keeps valid links in the order given', () => {
    const links = [
      { label: 'X', url: 'https://x.com/jane' },
      { label: 'Site', url: 'https://jane.example' },
    ];
    expect(validateAuthorProfile({ ...base, links }).links).toEqual(links);
  });
});

describe('sanitizeLinks', () => {
  // These land in href AND in Person.sameAs, so the dangerous shapes must not
  // survive a read of an old row written before the form existed.
  it('drops javascript:, protocol-relative, relative and malformed entries', () => {
    expect(
      sanitizeLinks([
        { label: 'bad', url: 'javascript:alert(1)' },
        { label: 'bad', url: '//evil.example' },
        { label: 'bad', url: '/relative' },
        { label: 'bad', url: 'http://insecure.example' },
        'not-an-object',
        null,
        { label: 'ok', url: 'https://good.example' },
      ]),
    ).toEqual([{ label: 'ok', url: 'https://good.example' }]);
  });

  it('returns an empty list for a non-array', () => {
    expect(sanitizeLinks(undefined)).toEqual([]);
    expect(sanitizeLinks({ label: 'x', url: 'https://x.example' })).toEqual([]);
  });
});
