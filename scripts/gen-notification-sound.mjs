// Generates public/sounds/paddock-chime.wav — Paddock's original notification
// cue. Replaces the previous F1-team-radio mp3 (unclear licensing) with a
// fully synthesized, unambiguously original asset.
//
// Design: a two-tone "pad-dock" chime — G5 (784 Hz) answered a perfect fifth
// up by D6 (~1174.7 Hz) — each tone a sine fundamental with soft 2nd/3rd
// harmonics, a 5 ms attack and an exponential decay. ~0.55 s total, 44.1 kHz
// 16-bit PCM mono (~48 KB). Pure Node, no dependencies.
//
// Run: node scripts/gen-notification-sound.mjs
// Commit the regenerated wav alongside any change to this script.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44100;
const DURATION_S = 0.55;
const ATTACK_S = 0.005; // soft click-free onset per tone
const FADE_OUT_S = 0.03; // master fade so the file ends at true silence
const PEAK = 0.85; // headroom after normalization (PushSoundPlayer plays at 1.0)

const TONES = [
  // { freq (Hz), start (s), decay tau (s), amplitude }
  { freq: 784.0, start: 0.0, tau: 0.13, amp: 0.55 }, // G5 — "pad"
  { freq: 1174.66, start: 0.13, tau: 0.2, amp: 0.62 }, // D6 — "dock"
];

const totalSamples = Math.round(SAMPLE_RATE * DURATION_S);
const samples = new Float64Array(totalSamples);

for (const { freq, start, tau, amp } of TONES) {
  const startSample = Math.round(start * SAMPLE_RATE);
  for (let i = startSample; i < totalSamples; i++) {
    const t = (i - startSample) / SAMPLE_RATE; // seconds since tone onset
    // Cosine-shaped attack ramp, then exponential decay.
    const attack = t >= ATTACK_S ? 1 : 0.5 * (1 - Math.cos((Math.PI * t) / ATTACK_S));
    const decay = Math.exp(-t / tau);
    // Fundamental + gentle harmonics (harmonics decay faster → bell-like).
    const w = 2 * Math.PI * freq * t;
    const partials =
      Math.sin(w) +
      0.3 * Math.exp(-t / (tau * 0.6)) * Math.sin(2 * w + 0.7) +
      0.1 * Math.exp(-t / (tau * 0.35)) * Math.sin(3.01 * w);
    samples[i] += amp * attack * decay * partials;
  }
}

// Master fade-out over the final FADE_OUT_S.
const fadeSamples = Math.round(FADE_OUT_S * SAMPLE_RATE);
for (let i = 0; i < fadeSamples; i++) {
  const idx = totalSamples - 1 - i;
  samples[idx] *= i / fadeSamples;
}

// Normalize to PEAK.
let max = 0;
for (const s of samples) max = Math.max(max, Math.abs(s));
const gain = max > 0 ? PEAK / max : 1;

// 16-bit PCM mono WAV.
const dataBytes = totalSamples * 2;
const buf = Buffer.alloc(44 + dataBytes);
buf.write('RIFF', 0, 'ascii');
buf.writeUInt32LE(36 + dataBytes, 4);
buf.write('WAVE', 8, 'ascii');
buf.write('fmt ', 12, 'ascii');
buf.writeUInt32LE(16, 16); // fmt chunk size
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(1, 22); // mono
buf.writeUInt32LE(SAMPLE_RATE, 24);
buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate (mono 16-bit)
buf.writeUInt16LE(2, 32); // block align
buf.writeUInt16LE(16, 34); // bits per sample
buf.write('data', 36, 'ascii');
buf.writeUInt32LE(dataBytes, 40);
for (let i = 0; i < totalSamples; i++) {
  const v = Math.max(-1, Math.min(1, samples[i] * gain));
  buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'sounds', 'paddock-chime.wav');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buf);
console.log(`wrote ${out} (${(buf.length / 1024).toFixed(1)} KB, ${DURATION_S}s @ ${SAMPLE_RATE} Hz mono)`);
