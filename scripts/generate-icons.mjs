// Generate PWA icons at proper sizes. Pure Node — no deps.
// Run via `node scripts/generate-icons.mjs`.
//
// Output: zinc-950 background with a red (F1-ish) filled circle in the center.
// Maskable variant uses a smaller circle so the safe area (inner 80%) holds the mark.

import fs from 'node:fs';
import zlib from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makeIcon(size, circleDiameterFraction, outPath) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 2;      // color type RGB
  ihdr[10] = 0;     // compression
  ihdr[11] = 0;     // filter
  ihdr[12] = 0;     // interlace

  const rowLength = 1 + size * 3;
  const raw = Buffer.alloc(rowLength * size);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size * circleDiameterFraction) / 2;
  const r2 = r * r;

  for (let y = 0; y < size; y++) {
    raw[y * rowLength] = 0; // filter byte: None
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const inCircle = (dx * dx + dy * dy) <= r2;
      const pos = y * rowLength + 1 + x * 3;
      if (inCircle) {
        raw[pos] = 0xe1;     // F1 red
        raw[pos + 1] = 0x06;
        raw[pos + 2] = 0x00;
      } else {
        raw[pos] = 0x0a;     // zinc-950
        raw[pos + 1] = 0x0a;
        raw[pos + 2] = 0x0a;
      }
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${size}x${size}, ${png.length} bytes)`);
}

fs.mkdirSync('public/icons', { recursive: true });
makeIcon(192, 0.55, 'public/icons/icon-192.png');
makeIcon(512, 0.55, 'public/icons/icon-512.png');
makeIcon(512, 0.40, 'public/icons/icon-512-maskable.png');
