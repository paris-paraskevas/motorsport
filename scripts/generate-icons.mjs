// Generate PWA icons at proper sizes. Pure Node — no deps.
// Run via `node scripts/generate-icons.mjs`.
//
// Design: two intersecting black + white checkered flags on a dark canvas.
// Classic motorsport iconography. Maskable variant tightens the inset so
// the design lives inside the inner ~80% safe area.

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

const BG    = [0x0a, 0x0a, 0x0a];
const BLACK = [0x00, 0x00, 0x00];
const WHITE = [0xff, 0xff, 0xff];
const POLE  = [0x52, 0x52, 0x52]; // zinc-600 for the flagpoles

function rotatedCheckerCell(
  px, py,
  centerX, centerY,
  width, height,
  angleRad,
  cellsX, cellsY,
) {
  const dx = px - centerX;
  const dy = py - centerY;
  const cos = Math.cos(-angleRad);
  const sin = Math.sin(-angleRad);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  if (Math.abs(lx) > width / 2) return null;
  if (Math.abs(ly) > height / 2) return null;
  const cellW = width / cellsX;
  const cellH = height / cellsY;
  const cellX = Math.floor((lx + width / 2) / cellW);
  const cellY = Math.floor((ly + height / 2) / cellH);
  return (cellX + cellY) % 2;
}

function inRotatedThinRect(px, py, x1, y1, x2, y2, halfWidth) {
  // Distance from point (px,py) to line segment (x1,y1)-(x2,y2)
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return false;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const distSq = (px - projX) ** 2 + (py - projY) ** 2;
  return distSq <= halfWidth * halfWidth;
}

function makeCrossedFlagsIcon(size, fraction, outPath) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const designSize = size * fraction;
  const cx = size / 2;
  const cy = size / 2;

  // Flag fabric dimensions
  const flagW = designSize * 0.62;
  const flagH = designSize * 0.40;
  const cellsX = 4;
  const cellsY = 3;
  const angleDeg = 24;
  const angle = (angleDeg * Math.PI) / 180;

  // Flag fabrics offset slightly so they read as two distinct flags
  const offsetX = designSize * 0.10;
  const offsetY = designSize * 0.06;
  // Flag 1: lower-left flag fabric (drawn behind), rotated -angle
  const f1cx = cx - offsetX;
  const f1cy = cy + offsetY;
  // Flag 2: upper-right flag fabric (drawn on top), rotated +angle
  const f2cx = cx + offsetX;
  const f2cy = cy - offsetY;

  // Flag poles cross from upper-corner to lower-opposite-corner of each flag
  // Pole 1 (for flag 1, which is lower-left, rotated -angle): goes from
  // lower-right of fabric down past the canvas to upper-left.
  // For a crossed-flags icon, poles meet near the bottom-center.
  const poleHalfW = Math.max(1, designSize * 0.012);
  const poleTipDistance = designSize * 0.46;
  const poleBase = { x: cx, y: cy + designSize * 0.42 };
  // Pole 1 tilts to the upper-left (carries flag 2 on its right side)
  const pole1Tip = {
    x: cx - Math.sin(angle) * poleTipDistance,
    y: poleBase.y - Math.cos(angle) * poleTipDistance,
  };
  // Pole 2 tilts to the upper-right (carries flag 1)
  const pole2Tip = {
    x: cx + Math.sin(angle) * poleTipDistance,
    y: poleBase.y - Math.cos(angle) * poleTipDistance,
  };

  const rowLength = 1 + size * 3;
  const raw = Buffer.alloc(rowLength * size);

  for (let y = 0; y < size; y++) {
    raw[y * rowLength] = 0;
    for (let x = 0; x < size; x++) {
      let rgb = BG;

      // Poles first (behind everything)
      if (
        inRotatedThinRect(x, y, poleBase.x, poleBase.y, pole1Tip.x, pole1Tip.y, poleHalfW) ||
        inRotatedThinRect(x, y, poleBase.x, poleBase.y, pole2Tip.x, pole2Tip.y, poleHalfW)
      ) {
        rgb = POLE;
      }

      // Flag 2 (rotated +angle, drawn behind flag 1)
      const cell2 = rotatedCheckerCell(
        x, y, f2cx, f2cy, flagW, flagH, angle, cellsX, cellsY,
      );
      if (cell2 !== null) rgb = cell2 === 0 ? BLACK : WHITE;

      // Flag 1 (rotated -angle, drawn on top)
      const cell1 = rotatedCheckerCell(
        x, y, f1cx, f1cy, flagW, flagH, -angle, cellsX, cellsY,
      );
      if (cell1 !== null) rgb = cell1 === 0 ? BLACK : WHITE;

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
makeCrossedFlagsIcon(192, 0.95, 'public/icons/icon-192.png');
makeCrossedFlagsIcon(512, 0.95, 'public/icons/icon-512.png');
// Maskable: tighter inset so the design lives inside the ~80% safe area
makeCrossedFlagsIcon(512, 0.72, 'public/icons/icon-512-maskable.png');
