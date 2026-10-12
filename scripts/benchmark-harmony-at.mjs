import { performance } from "node:perf_hooks";
import { generateNew } from "../src/music-engine.js";

const songs = [
  generateNew({ seed: "benchmark-harmony-1", bars: 32, professionalUpgrade: true }),
  generateNew({ seed: "benchmark-harmony-2", bars: 64, professionalUpgrade: true }),
  generateNew({ seed: "benchmark-harmony-3", bars: 128, professionalUpgrade: true }),
];

console.log("=== Harmony At Benchmark & Behavioral Parity Suite ===");

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

// Original linear implementation from music-engine.js:4108
function harmonyAtLinear(harmony = [], beat = 0) {
  let result = harmony?.[0];
  for (const event of harmony ?? []) {
    const start = finite(event?.start ?? event?.startBeat, 0);
    const duration = finite(event?.duration ?? event?.durationBeats, 0);
    if (start <= beat + 1e-6) result = event;
    if (beat < start + duration - 1e-6 && beat >= start - 1e-6) return event;
  }
  return result;
}

function getMaxDuration(harmony) {
  if (!harmony || !harmony.length) return 0;
  if (harmony._maxDuration !== undefined) return harmony._maxDuration;
  let maxD = 0;
  for (let i = 0; i < harmony.length; i++) {
    const d = finite(harmony[i]?.duration ?? harmony[i]?.durationBeats, 0);
    if (d > maxD) maxD = d;
  }
  if (!Object.isFrozen(harmony)) {
    try { Object.defineProperty(harmony, '_maxDuration', { value: maxD, writable: true, configurable: true, enumerable: false }); } catch (_) {}
  }
  return maxD;
}

// Binary search implementation for harmonyAt with 100% first-active-event parity
function harmonyAtBinary(harmony = [], beat = 0) {
  if (!harmony || harmony.length === 0) return harmony?.[0];
  let low = 0;
  let high = harmony.length - 1;
  let maxIdx = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const event = harmony[mid];
    const start = finite(event?.start ?? event?.startBeat, 0);
    if (start <= beat + 1e-6) {
      maxIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (maxIdx === -1) {
    return harmony[0];
  }

  const maxDuration = getMaxDuration(harmony);
  const cutoff = beat - maxDuration - 1e-6;

  let firstMatch = -1;
  for (let i = maxIdx; i >= 0; i--) {
    const event = harmony[i];
    const start = finite(event?.start ?? event?.startBeat, 0);
    if (start < cutoff) break;
    const duration = finite(event?.duration ?? event?.durationBeats, 0);
    if (beat >= start - 1e-6 && beat < start + duration - 1e-6) {
      firstMatch = i;
    }
  }

  if (firstMatch !== -1) {
    return harmony[firstMatch];
  }

  return harmony[maxIdx];
}

// Original linear implementation for harmonyAtBeat
function harmonyAtBeatLinear(harmony = [], beat = 0) {
  return harmony?.find?.((event) => {
    const start = finite(event?.start ?? event?.startBeat, 0);
    const duration = finite(event?.duration ?? event?.durationBeats, 0);
    return beat >= start - 1e-6 && beat < start + duration - 1e-6;
  }) ?? harmony?.[harmony.length - 1] ?? null;
}

// Binary search implementation for harmonyAtBeat
function harmonyAtBeatBinary(harmony = [], beat = 0) {
  if (!harmony || harmony.length === 0) return harmony?.[harmony.length - 1] ?? null;
  let low = 0;
  let high = harmony.length - 1;
  let maxIdx = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const event = harmony[mid];
    const start = finite(event?.start ?? event?.startBeat, 0);
    if (start <= beat + 1e-6) {
      maxIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (maxIdx === -1) {
    return harmony[harmony.length - 1] ?? null;
  }

  const maxDuration = getMaxDuration(harmony);
  const cutoff = beat - maxDuration - 1e-6;

  let firstMatch = -1;
  for (let i = maxIdx; i >= 0; i--) {
    const event = harmony[i];
    const start = finite(event?.start ?? event?.startBeat, 0);
    if (start < cutoff) break;
    const duration = finite(event?.duration ?? event?.durationBeats, 0);
    if (beat >= start - 1e-6 && beat < start + duration - 1e-6) {
      firstMatch = i;
    }
  }

  if (firstMatch !== -1) {
    return harmony[firstMatch];
  }

  return harmony[harmony.length - 1] ?? null;
}

// 1. Specific Regression Edge Cases Test Suite
console.log("Running PR comment edge cases & regression test suite...");

// Case A: PR Comment Minimal Case (Overlapping events)
const overlapHarmony = [
  { id: 'long', start: 0, duration: 8 },
  { id: 'overlap', start: 4, duration: 4 },
];
const linearOverlapRes = harmonyAtLinear(overlapHarmony, 5);
const binaryOverlapRes = harmonyAtBinary(overlapHarmony, 5);
if (linearOverlapRes !== binaryOverlapRes) {
  throw new Error(`Minimal overlap case failed! Expected ${linearOverlapRes?.id}, got ${binaryOverlapRes?.id}`);
}
if (binaryOverlapRes?.id !== 'long') {
  throw new Error(`Minimal overlap case did not select first active 'long', got ${binaryOverlapRes?.id}`);
}
console.log("  ✓ PR comment minimal overlap case passed ('long' returned at beat 5)");

// Case B: Duplicate starts
const dupStartHarmony = [
  { id: 'first', start: 4, duration: 4 },
  { id: 'second', start: 4, duration: 2 },
];
if (harmonyAtLinear(dupStartHarmony, 5) !== harmonyAtBinary(dupStartHarmony, 5)) {
  throw new Error("Duplicate start case failed for harmonyAt");
}
if (harmonyAtBeatLinear(dupStartHarmony, 5) !== harmonyAtBeatBinary(dupStartHarmony, 5)) {
  throw new Error("Duplicate start case failed for harmonyAtBeat");
}
console.log("  ✓ Duplicate starts case passed");

// Case C: Exact boundaries & epsilon float tolerances
const boundaryHarmony = [
  { id: 'ch1', start: 0, duration: 4 },
  { id: 'ch2', start: 4, duration: 4 },
];
if (harmonyAtLinear(boundaryHarmony, 3.9999999) !== harmonyAtBinary(boundaryHarmony, 3.9999999)) {
  throw new Error("Boundary epsilon case (3.9999999) failed");
}
if (harmonyAtLinear(boundaryHarmony, 4.0) !== harmonyAtBinary(boundaryHarmony, 4.0)) {
  throw new Error("Boundary exact start (4.0) failed");
}
console.log("  ✓ Boundary & epsilon float tolerances passed");

// Case D: Gaps between events
const gapHarmony = [
  { id: 'a', start: 0, duration: 4 },
  { id: 'b', start: 8, duration: 4 },
];
if (harmonyAtLinear(gapHarmony, 5) !== harmonyAtBinary(gapHarmony, 5)) {
  throw new Error("Gap case failed");
}
console.log("  ✓ Gap handling passed");

// Case E: Empty array and null/undefined
if (harmonyAtLinear([], 5) !== harmonyAtBinary([], 5)) throw new Error("Empty array mismatch");
if (harmonyAtBeatLinear([], 5) !== harmonyAtBeatBinary([], 5)) throw new Error("Empty array mismatch for harmonyAtBeat");
if (harmonyAtLinear(null, 5) !== harmonyAtBinary(null, 5)) throw new Error("Null mismatch");
if (harmonyAtBeatLinear(null, 5) !== harmonyAtBeatBinary(null, 5)) throw new Error("Null mismatch for harmonyAtBeat");
console.log("  ✓ Empty array & null handling passed");

// 2. Full Correctness Check on Generated Song Harmony
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
console.log("✅ All behavioral parity checks PASSED with 100% functional equality.");

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
