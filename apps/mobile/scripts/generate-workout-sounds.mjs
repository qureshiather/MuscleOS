/**
 * Generates short mono 16-bit WAV tones for bundled workout UI sounds.
 * Run: node scripts/generate-workout-sounds.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../assets/sounds');

const SAMPLE_RATE = 44100;

function writeWav(filepath, durationSec, frequencyHz, { volume = 0.22 } = {}) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, i / (SAMPLE_RATE * 0.004));
    const release = Math.min(1, (numSamples - i) / (SAMPLE_RATE * 0.06));
    const env = attack * release;
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * volume * env;
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), 44 + i * 2);
  }

  fs.writeFileSync(filepath, buffer);
}

function writeDualToneWav(filepath, durationSec, f1, f2, opts) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  const { volume = 0.18 } = opts ?? {};

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, i / (SAMPLE_RATE * 0.008));
    const release = Math.min(1, (numSamples - i) / (SAMPLE_RATE * 0.12));
    const env = attack * release;
    const a =
      0.55 * Math.sin(2 * Math.PI * f1 * t) + 0.45 * Math.sin(2 * Math.PI * f2 * t);
    const sample = a * volume * env;
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), 44 + i * 2);
  }

  fs.writeFileSync(filepath, buffer);
}

fs.mkdirSync(outDir, { recursive: true });

// Rest countdown: short tick (880 Hz, ~70ms)
writeWav(path.join(outDir, 'rest-tick.wav'), 0.07, 880, { volume: 0.2 });
// Rest ended: slightly lower, ~120ms
writeWav(path.join(outDir, 'rest-end.wav'), 0.12, 660, { volume: 0.24 });
// Set complete: pleasant ding (two partials)
writeDualToneWav(path.join(outDir, 'set-complete.wav'), 0.18, 523.25, 784.0, { volume: 0.2 });
// Workout complete: brighter chord-ish
writeDualToneWav(path.join(outDir, 'workout-complete.wav'), 0.35, 392.0, 523.25, { volume: 0.22 });

console.log('Wrote WAV files to', outDir);
