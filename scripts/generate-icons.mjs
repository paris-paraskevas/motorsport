// Generate PWA icons at proper sizes. Pure Node — no deps.
// Run via `node scripts/generate-icons.mjs`.
//
// Design: zinc-950 background with a centered 4x4 checkered-flag pattern
// in red (#e10600) + off-white (#f5f5f5). Maskable variant uses a smaller
// checker so the safe area (inner ~80%) carries the mark.

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

const BG    = [0x0a, 0x0a, 0x0a]; // zinc-950
const BLACK = [0x00, 0x00, 0x00]; // pure black for checker cell
const WHITE = [0xff, 0xff, 0xff]; // pure white for checker cell

function makeCheckerIcon(size, checkerFraction, gridSize, outPath) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 2;      // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const checkerSize = size * checkerFraction;
  const checkerStart = (size - checkerSize) / 2;
  const checkerEnd = checkerStart + checkerSize;
  const cellSize = checkerSize / gridSize;

  const rowLength = 1 + size * 3;
  const raw = Buffer.alloc(rowLength * size);

  for (let y = 0; y < size; y++) {
    raw[y * rowLength] = 0; // PNG filter: None
    for (let x = 0; x < size; x++) {
      let rgb = BG;
      if (x >= checkerStart && x < checkerEnd && y >= checkerStart && y < checkerEnd) {
        const cellX = Math.floor((x - checkerStart) / cellSize);
        const cellY = Math.floor((y - checkerStart) / cellSize);
        rgb = ((cellX + cellY) % 2 === 0) ? BLACK : WHITE;
      }
      const pos = y * rowLength + 1 + x * 3;
      raw[pos] = rgb[0];
      raw[pos + 1] = rgb[1];
      raw[pos + 2] = rgb[2];
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
makeCheckerIcon(192, 0.62, 4, 'public/icons/icon-192.png');
makeCheckerIcon(512, 0.62, 4, 'public/icons/icon-512.png');
// Maskable: tighter so the checker lives inside the safe area (inner ~80%)
makeCheckerIcon(512, 0.46, 4, 'public/icons/icon-512-maskable.png');
