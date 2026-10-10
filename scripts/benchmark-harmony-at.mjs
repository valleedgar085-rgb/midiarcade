import { performance } from "node:perf_hooks";
import { generateNew } from "../src/music-engine.js";

const songs = [
  generateNew({ seed: "benchmark-harmony-1", bars: 32, professionalUpgrade: true }),
  generateNew({ seed: "benchmark-harmony-2", bars: 64, professionalUpgrade: true }),
  generateNew({ seed: "benchmark-harmony-3", bars: 128, professionalUpgrade: true }),
];

console.log("=== Harmony At Benchmark ===");

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

// Original linear implementation from music-engine.js:4108
function harmonyAtLinear(harmony = [], beat = 0) {
  let result = harmony?.[0];
  for (const event of harmony ?? []) {
    if (event.start <= beat + 1e-6) result = event;
    if (beat < event.start + event.duration - 1e-6 && beat >= event.start - 1e-6) return event;
  }
  return result;
}

// Binary search implementation for harmonyAt
function harmonyAtBinary(harmony = [], beat = 0) {
  if (!harmony || harmony.length === 0) return harmony?.[0];
  let low = 0;
  let high = harmony.length - 1;
  let best = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const event = harmony[mid];
    const start = finite(event?.start ?? event?.startBeat, 0);
    if (start <= beat + 1e-6) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (best === -1) {
    return harmony[0];
  }

  const bestEvent = harmony[best];
  const bestStart = finite(bestEvent?.start ?? bestEvent?.startBeat, 0);
  const bestDuration = Math.max(0.01, finite(bestEvent?.duration ?? bestEvent?.durationBeats, 0.25));

  if (beat >= bestStart - 1e-6 && beat < bestStart + bestDuration - 1e-6) {
    return bestEvent;
  }

  return bestEvent;
}

// Original linear implementation for harmonyAtBeat
function harmonyAtBeatLinear(harmony = [], beat = 0) {
  return harmony?.find?.((event) => (
    beat >= event.start - 1e-6 && beat < event.start + event.duration - 1e-6
  )) ?? harmony?.[harmony.length - 1] ?? null;
}

// Binary search implementation for harmonyAtBeat
function harmonyAtBeatBinary(harmony = [], beat = 0) {
  if (!harmony || harmony.length === 0) return harmony?.[harmony.length - 1] ?? null;
  let low = 0;
  let high = harmony.length - 1;
  let best = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const event = harmony[mid];
    const start = finite(event?.start ?? event?.startBeat, 0);
    if (start <= beat + 1e-6) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (best !== -1) {
    const bestEvent = harmony[best];
    const bestStart = finite(bestEvent?.start ?? bestEvent?.startBeat, 0);
    const bestDuration = Math.max(0.01, finite(bestEvent?.duration ?? bestEvent?.durationBeats, 0.25));

    if (beat >= bestStart - 1e-6 && beat < bestStart + bestDuration - 1e-6) {
      return bestEvent;
    }
  }

  return harmony[harmony.length - 1] ?? null;
}

// 1. Edge Case Checks
console.log("Checking edge cases...");

// Empty array
if (harmonyAtLinear([], 5) !== harmonyAtBinary([], 5)) throw new Error("Empty array mismatch");
if (harmonyAtBeatLinear([], 5) !== harmonyAtBeatBinary([], 5)) throw new Error("Empty array mismatch for harmonyAtBeat");

// Null / undefined
if (harmonyAtLinear(null, 5) !== harmonyAtBinary(null, 5)) throw new Error("Null array mismatch");
if (harmonyAtBeatLinear(null, 5) !== harmonyAtBeatBinary(null, 5)) throw new Error("Null array mismatch for harmonyAtBeat");

// Single element
const singleHarmony = [{ start: 0, duration: 4, degree: 1 }];
if (harmonyAtLinear(singleHarmony, 2) !== harmonyAtBinary(singleHarmony, 2)) throw new Error("Single element mismatch inside");
if (harmonyAtLinear(singleHarmony, 10) !== harmonyAtBinary(singleHarmony, 10)) throw new Error("Single element mismatch outside");
if (harmonyAtBeatLinear(singleHarmony, 2) !== harmonyAtBeatBinary(singleHarmony, 2)) throw new Error("Single element mismatch inside for harmonyAtBeat");
if (harmonyAtBeatLinear(singleHarmony, 10) !== harmonyAtBeatBinary(singleHarmony, 10)) throw new Error("Single element mismatch outside for harmonyAtBeat");

// 2. Full Correctness Check on Songs
for (const song of songs) {
  const harmony = song.harmony ?? [];
  const maxBeat = (song.meta?.bars ?? 64) * (song.meta?.beatsPerBar ?? 4);

  for (let beat = -1; beat <= maxBeat + 5; beat += 0.05) {
    const linearRes = harmonyAtLinear(harmony, beat);
    const binaryRes = harmonyAtBinary(harmony, beat);
    if (linearRes !== binaryRes) {
      console.error(`harmonyAt Mismatch at beat ${beat}:`, { linearRes, binaryRes });
      process.exit(1);
    }

    const linearBeatRes = harmonyAtBeatLinear(harmony, beat);
    const binaryBeatRes = harmonyAtBeatBinary(harmony, beat);
    if (linearBeatRes !== binaryBeatRes) {
      console.error(`harmonyAtBeat Mismatch at beat ${beat}:`, { linearBeatRes, binaryBeatRes });
      process.exit(1);
    }
  }
}
console.log("✅ Correctness check PASSED across all song seeds, edge cases and beat steps (100% identical outputs).");

// 3. Performance Benchmark
const beatsToTest = [];
for (const song of songs) {
  const harmony = song.harmony ?? [];
  const maxBeat = (song.meta?.bars ?? 64) * (song.meta?.beatsPerBar ?? 4);
  for (let beat = -0.5; beat <= maxBeat + 2; beat += 0.05) {
    beatsToTest.push({ harmony, beat });
  }
}

const iterations = 2000;
const totalQueries = beatsToTest.length * iterations;

console.log(`\nBenchmarking ${beatsToTest.length} beat points x ${iterations} iterations = ${totalQueries} total calls...`);

// Benchmark Linear
const startLinear = performance.now();
for (let it = 0; it < iterations; it++) {
  for (let i = 0; i < beatsToTest.length; i++) {
    harmonyAtLinear(beatsToTest[i].harmony, beatsToTest[i].beat);
  }
}
const elapsedLinear = performance.now() - startLinear;

// Benchmark Binary
const startBinary = performance.now();
for (let it = 0; it < iterations; it++) {
  for (let i = 0; i < beatsToTest.length; i++) {
    harmonyAtBinary(beatsToTest[i].harmony, beatsToTest[i].beat);
  }
}
const elapsedBinary = performance.now() - startBinary;

const opsSecLinear = (totalQueries / (elapsedLinear / 1000)).toFixed(0);
const opsSecBinary = (totalQueries / (elapsedBinary / 1000)).toFixed(0);
const speedup = (elapsedLinear / elapsedBinary).toFixed(2);
const reduction = ((1 - elapsedBinary / elapsedLinear) * 100).toFixed(1);

console.log(`Linear harmonyAt time: ${elapsedLinear.toFixed(2)} ms (${opsSecLinear} ops/sec)`);
console.log(`Binary harmonyAt time: ${elapsedBinary.toFixed(2)} ms (${opsSecBinary} ops/sec)`);
console.log(`Speedup: ${speedup}x faster (${reduction}% reduction in search execution time)`);
