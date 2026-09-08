// The kind and the pixel size of an image, read from its first bytes. The
// Worker has no image library (workerd cannot run sharp), and the designer's
// Assets step needs two things from a photo before it is stored: that it really
// is a JPEG, a PNG or a WebP whatever the browser said, and its width and
// height for the row. Both live in the headers, so a few dozen bytes are enough.
// Pure and dependency-free; anything it does not recognise is null.

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageInfo {
  type: ImageType;
  width: number;
  height: number;
}

const be16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const be32 = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const le16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const le24 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

const sized = (type: ImageType, width: number, height: number): ImageInfo | null =>
  width > 0 && height > 0 ? { type, width, height } : null;

/** JPEG frame headers (SOF0 to SOF15, without the DHT/JPG/DAC markers that share the range). */
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export function sniffImage(b: Uint8Array): ImageInfo | null {
  // PNG: the eight-byte signature, then the IHDR chunk with width and height big-endian.
  if (
    b.length >= 24 &&
    b[0] === 0x89 &&
    ascii(b, 1, 3) === 'PNG' &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a &&
    ascii(b, 12, 4) === 'IHDR'
  ) {
    return sized('image/png', be32(b, 16), be32(b, 20));
  }

  // JPEG: FF D8, then segments until a frame header (height at +5, width at +7).
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 <= b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xff) {
        i += 1;
        continue;
      }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        i += 2;
        continue;
      }
      if (m === 0xd9 || m === 0xda) return null;
      const len = be16(b, i + 2);
      if (len < 2) return null;
      if (JPEG_SOF.has(m)) return sized('image/jpeg', be16(b, i + 7), be16(b, i + 5));
      i += 2 + len;
    }
    return null;
  }

  // WebP: RIFF....WEBP, then one of three first chunks, each with its own size fields.
  if (b.length >= 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const chunk = ascii(b, 12, 4);
    if (chunk === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return sized('image/webp', le16(b, 26) & 0x3fff, le16(b, 28) & 0x3fff);
    }
    if (chunk === 'VP8L' && b[20] === 0x2f) {
      const b0 = b[21];
      const b1 = b[22];
      const b2 = b[23];
      const b3 = b[24];
      const width = 1 + (b0 | ((b1 & 0x3f) << 8));
      const height = 1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10));
      return sized('image/webp', width, height);
    }
    if (chunk === 'VP8X') return sized('image/webp', 1 + le24(b, 24), 1 + le24(b, 27));
  }

  return null;
}
