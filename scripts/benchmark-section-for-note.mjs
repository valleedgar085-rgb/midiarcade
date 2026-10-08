import { performance } from "node:perf_hooks";
import { generateNew } from "../src/music-engine.js";

const song = generateNew({ seed: "benchmark-seed-1", bars: 64, professionalUpgrade: true });
const structure = song.structure;
const tracks = song.tracks;

const notes = [];
for (let i = 0; i < 20; i++) {
  for (const track of tracks) {
    for (const note of (track.notes ?? [])) {
      notes.push({ ...note });
    }
  }
}

console.log(`Structure section count: ${structure.length}`);
console.log(`Total notes tested per iteration: ${notes.length}`);

const sectionForNoteLinear = (note) => structure.find((section) => (
  note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6
));

const sectionForNoteBinary = (note) => {
  if (!structure || structure.length === 0) return undefined;
  let low = 0;
  let high = structure.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const section = structure[mid];
    if (note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6) {
      return section;
    }
    if (note.start < section.startBeat - 1e-6) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return undefined;
};

// Verify correctness
for (let i = 0; i < notes.length; i++) {
  const linearRes = sectionForNoteLinear(notes[i]);
  const binaryRes = sectionForNoteBinary(notes[i]);
  if (linearRes !== binaryRes) {
    console.error(`Mismatch at index ${i}: linear=${linearRes?.id}, binary=${binaryRes?.id}`);
    process.exit(1);
  }
}
console.log("Correctness check passed: Linear and Binary search results are 100% identical.");

const iterations = 500;

// Benchmark Linear
const startLinear = performance.now();
for (let it = 0; it < iterations; it++) {
  for (let i = 0; i < notes.length; i++) {
    sectionForNoteLinear(notes[i]);
  }
}
const elapsedLinear = performance.now() - startLinear;

// Benchmark Binary
const startBinary = performance.now();
for (let it = 0; it < iterations; it++) {
  for (let i = 0; i < notes.length; i++) {
    sectionForNoteBinary(notes[i]);
  }
}
const elapsedBinary = performance.now() - startBinary;

console.log(`Linear sectionForNote total time (${iterations} x ${notes.length} = ${iterations * notes.length} ops): ${elapsedLinear.toFixed(2)} ms (${((iterations * notes.length) / (elapsedLinear / 1000)).toFixed(0)} ops/s)`);
console.log(`Binary sectionForNote total time (${iterations} x ${notes.length} = ${iterations * notes.length} ops): ${elapsedBinary.toFixed(2)} ms (${((iterations * notes.length) / (elapsedBinary / 1000)).toFixed(0)} ops/s)`);
console.log(`Speedup: ${(elapsedLinear / elapsedBinary).toFixed(2)}x faster (${((1 - elapsedBinary / elapsedLinear) * 100).toFixed(1)}% reduction in search time)`);
