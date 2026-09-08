import { describe, expect, it } from 'vitest';
import { sniffImage } from './image-size';

// Headers built by hand, byte by byte, from the three formats' specifications;
// the 1×1 PNG is a real file.
const PNG_1x1 = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
);

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13], 8);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function jpeg(width: number, height: number, progressive = false): Uint8Array {
  // SOI, an APP0 segment of 16 bytes, then SOF0 (or SOF2) with the frame size.
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof = [0xff, progressive ? 0xc2 : 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03];
  return Uint8Array.from([0xff, 0xd8, ...app0, ...sof, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
}

function webp(kind: 'VP8 ' | 'VP8L' | 'VP8X', width: number, height: number): Uint8Array {
  const b = new Uint8Array(40);
  const put = (s: string, at: number) => b.set(s.split('').map(c => c.charCodeAt(0)), at);
  put('RIFF', 0);
  put('WEBP', 8);
  put(kind, 12);
  if (kind === 'VP8 ') {
    b.set([0x9d, 0x01, 0x2a], 23);
    b[26] = width & 0xff;
    b[27] = (width >> 8) & 0x3f;
    b[28] = height & 0xff;
    b[29] = (height >> 8) & 0x3f;
  } else if (kind === 'VP8L') {
    const w = width - 1;
    const h = height - 1;
    b[20] = 0x2f;
    b[21] = w & 0xff;
    b[22] = ((w >> 8) & 0x3f) | ((h & 0x03) << 6);
    b[23] = (h >> 2) & 0xff;
    b[24] = (h >> 10) & 0x0f;
  } else {
    const w = width - 1;
    const h = height - 1;
    b[24] = w & 0xff;
    b[25] = (w >> 8) & 0xff;
    b[26] = (w >> 16) & 0xff;
    b[27] = h & 0xff;
    b[28] = (h >> 8) & 0xff;
    b[29] = (h >> 16) & 0xff;
  }
  return b;
}

describe('sniffImage', () => {
  it('reads a real 1×1 PNG and a hand-built 1920×1080 one', () => {
    expect(sniffImage(PNG_1x1)).toEqual({ type: 'image/png', width: 1, height: 1 });
    expect(sniffImage(png(1920, 1080))).toEqual({ type: 'image/png', width: 1920, height: 1080 });
  });

  it('reads a baseline and a progressive JPEG frame header after an APP0 segment', () => {
    expect(sniffImage(jpeg(640, 480))).toEqual({ type: 'image/jpeg', width: 640, height: 480 });
    expect(sniffImage(jpeg(4032, 3024, true))).toEqual({ type: 'image/jpeg', width: 4032, height: 3024 });
  });

  it('reads the three WebP first chunks', () => {
    expect(sniffImage(webp('VP8 ', 640, 480))).toEqual({ type: 'image/webp', width: 640, height: 480 });
    expect(sniffImage(webp('VP8L', 640, 480))).toEqual({ type: 'image/webp', width: 640, height: 480 });
    expect(sniffImage(webp('VP8X', 3000, 2000))).toEqual({ type: 'image/webp', width: 3000, height: 2000 });
  });

  it('is null for anything else: text, a GIF, a truncated JPEG, an SVG, an empty buffer', () => {
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImage(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(sniffImage(jpeg(640, 480).subarray(0, 22))).toBeNull();
    expect(sniffImage(new Uint8Array(0))).toBeNull();
    // A JPEG whose scan starts before any frame header is refused rather than guessed.
    expect(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });
});
