import { describe, it, expect } from 'vitest';
import { validateSubmission, base64Bytes, FILE_MAX_BYTES } from './feeder';

// "AAAA" decodes to 3 bytes; repeat to build a known-size base64 payload.
const b64OfBytes = (n: number) => 'A'.repeat(Math.ceil(n / 3) * 4);

describe('base64Bytes', () => {
  it('is 0 for empty', () => expect(base64Bytes('')).toBe(0));
  it('handles no padding', () => expect(base64Bytes('AAAA')).toBe(3));
  it('handles one pad', () => expect(base64Bytes('AAA=')).toBe(2));
  it('handles two pads', () => expect(base64Bytes('AA==')).toBe(1));
});

describe('validateSubmission', () => {
  const base = { seriesName: 'Test Cup', contactEmail: 'a@b.com', dataUrl: 'https://x.com/s' };

  it('accepts a minimal link-only submission', () => {
    const r = validateSubmission(base);
    expect(r.ok).toBe(true);
    expect(r.clean?.series_name).toBe('Test Cup');
    expect(r.clean?.data_url).toBe('https://x.com/s');
    expect(r.clean?.file_data).toBeNull();
  });

  it('requires a series name', () => {
    expect(validateSubmission({ ...base, seriesName: '   ' }).ok).toBe(false);
  });

  it('rejects control chars in the series name (header-injection hygiene)', () => {
    expect(validateSubmission({ ...base, seriesName: 'Cup\nInjected' }).ok).toBe(false);
  });

  it('requires a valid email', () => {
    expect(validateSubmission({ ...base, contactEmail: 'nope' }).ok).toBe(false);
    expect(validateSubmission({ ...base, contactEmail: 'a b@c.com' }).ok).toBe(false);
  });

  it('requires a file OR a link', () => {
    const r = validateSubmission({ seriesName: 'Cup', contactEmail: 'a@b.com' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/file.*or.*link|link to your data/i);
  });

  it('rejects a non-http link', () => {
    expect(validateSubmission({ ...base, dataUrl: 'ftp://x.com/s' }).ok).toBe(false);
  });

  it('accepts an allowed file type and records its size', () => {
    const r = validateSubmission({
      seriesName: 'Cup',
      contactEmail: 'a@b.com',
      file: { name: 'results.csv', type: 'text/csv', dataBase64: 'AAAA' },
    });
    expect(r.ok).toBe(true);
    expect(r.clean?.file_name).toBe('results.csv');
    expect(r.clean?.file_size).toBe(3);
  });

  it('rejects a disallowed file extension', () => {
    const r = validateSubmission({
      ...base,
      file: { name: 'evil.exe', type: 'application/octet-stream', dataBase64: 'AAAA' },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects malformed (non-base64) file data', () => {
    const r = validateSubmission({
      ...base,
      file: { name: 'x.csv', type: 'text/csv', dataBase64: 'data:text/csv;base64,AAAA' },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/malformed/);
  });

  it('rejects a file over the size cap', () => {
    const tooBig = b64OfBytes(FILE_MAX_BYTES + 1024);
    const r = validateSubmission({
      seriesName: 'Cup',
      contactEmail: 'a@b.com',
      file: { name: 'huge.csv', type: 'text/csv', dataBase64: tooBig },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/too large/);
  });

  it('trims optional fields to null and truncates the ref token', () => {
    const r = validateSubmission({ ...base, season: '  ', note: '  ', refToken: 'x'.repeat(300) });
    expect(r.clean?.season).toBeNull();
    expect(r.clean?.note).toBeNull();
    expect(r.clean?.ref_token?.length).toBe(100);
  });
});
