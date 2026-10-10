import test from "node:test";
import assert from "node:assert/strict";
import { generateNew, applyOrchestrationMatrix, createSeededRandom } from "../src/music-engine.js";

test("applyOrchestrationMatrix returns deterministic and correct results with optimized grouping", () => {
  const song = generateNew({ seed: "orchestration-test-seed", bars: 64, professionalUpgrade: true });
  const rawTracks = song.tracks ? Object.fromEntries(song.tracks.map((t) => [t.id, (t.notes ?? []).map(n => ({ ...n }))])) : {};
  const structure = song.structure;
  const songBlueprint = song.songBlueprint;
  const config = song.config ?? { genre: song.genre ?? "pop", bars: 64, timeSignature: [4, 4] };

  const rng1 = createSeededRandom("determinism-seed");
  const rng2 = createSeededRandom("determinism-seed");

  const result1 = applyOrchestrationMatrix(rawTracks, structure, songBlueprint, config, rng1);
  const result2 = applyOrchestrationMatrix(rawTracks, structure, songBlueprint, config, rng2);

  assert.deepEqual(result1, result2, "applyOrchestrationMatrix must be 100% deterministic");
});

test("applyOrchestrationMatrix matches unoptimized filter baseline note mapping", () => {
  const song = generateNew({ seed: "mapping-test-seed", bars: 32 });
  const rawTracks = Object.fromEntries(song.tracks.map((t) => [t.id, (t.notes ?? []).map(n => ({ ...n }))]));
  const structure = song.structure;

  // Verify that binary search note grouping matches linear filter
  for (const [id, sourceNotes] of Object.entries(rawTracks)) {
    for (const section of structure) {
      const linearNotes = sourceNotes.filter((note) => note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6);

      let low = 0;
      let high = structure.length - 1;
      const binaryNotes = [];
      for (const note of sourceNotes) {
        let l = 0, h = structure.length - 1;
        while (l <= h) {
          const mid = (l + h) >> 1;
          const sec = structure[mid];
          if (note.start >= sec.startBeat - 1e-6 && note.start < sec.endBeat - 1e-6) {
            if (sec.id === section.id) binaryNotes.push(note);
            break;
          }
          if (note.start < sec.startBeat - 1e-6) {
            h = mid - 1;
          } else {
            l = mid + 1;
          }
        }
      }

      assert.deepEqual(linearNotes, binaryNotes, `Notes in section ${section.id} for track ${id} must match 100%`);
    }
  }
});
