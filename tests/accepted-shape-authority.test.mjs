import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  acceptShapeCandidate,
  createShapeCandidate,
  rejectShapeCandidate,
} from "../src/core/shape-director-engine.js";
import { createGenerationRunner } from "../src/core/generation-runner.js";
import { generateProducerVariationSet } from "../src/core/producer-variation-set.js";

function note(id, start, pitch, velocity = 88, duration = 0.5) {
  return { id, start, pitch, velocity, duration };
}

function sourceSong() {
  return {
    id: "shape-authority-parent",
    title: "Shape Authority",
    seed: "shape-authority-parent",
    meta: { key: "A", mode: "minor", tempo: 96, bars: 4, beatsPerBar: 4, totalBeats: 16 },
    settings: { bars: 4, chordPath: "Am-F-C-G" },
    structure: [
      { id: "verse", name: "Verse", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "chorus", name: "Chorus", startBeat: 8, endBeat: 16, bars: 2 },
    ],
    tracks: [
      { id: "drums", program: 16, settings: { program: 16 }, notes: [note("d1", 0, 36, 105, 0.25), note("d2", 1, 38, 100, 0.25)] },
      { id: "bass", program: 38, settings: { program: 38 }, notes: [note("b1", 0, 45), note("b2", 2, 48)] },
      { id: "chords", program: 61, settings: { program: 61 }, notes: [note("c1", 0, 57, 78, 2), note("c2", 4, 53, 80, 2)] },
      {
        id: "melody",
        program: 81,
        settings: { program: 81 },
        notes: [
          note("m1", 0, 69, 84), note("m2", 1, 72, 86), note("m3", 2, 76, 88), note("m4", 3, 72, 90),
          note("m5", 4, 69, 85), note("m6", 5, 72, 87), note("m7", 6, 76, 89), note("m8", 7, 72, 91),
          note("m9", 8, 76, 96), note("m10", 9, 79, 99),
        ],
      },
      { id: "counterpoint", program: 86, settings: { program: 86 }, notes: [note("cp1", 4, 76, 76)] },
      { id: "pad", program: 90, settings: { program: 90 }, notes: [note("p1", 0, 57, 68, 4)] },
    ],
  };
}

function qualityCandidate(id, source) {
  return {
    ...structuredClone(source),
    id,
    seed: id,
    meta: {
      ...structuredClone(source.meta),
      scoreDetails: {
        totalScore: 92,
        subscores: {
          groove: 92,
          transitions: 91,
          harmony: 93,
          phraseResolution: 92,
          hook: 92,
          arrangement: 91,
          production: 92,
          performance: 92,
        },
        balance: { balanceScore: 92 },
        releaseGate: { passed: true },
      },
    },
  };
}

function shapedTransaction() {
  return createShapeCandidate(sourceSong(), {
    selection: { target: "track", sectionId: "verse", trackId: "melody" },
    size: "reshape",
    direction: "harder",
  }, { seed: "accepted-shape-authority" });
}

test("Shape Accept produces the exact snapshot that Similar receives as its source", async () => {
  const transaction = shapedTransaction();
  assert.equal(transaction.status, "candidate");
  const accepted = acceptShapeCandidate(transaction);
  const original = transaction.before;
  assert.notDeepEqual(accepted, original);

  let receivedSource = null;
  const runner = createGenerationRunner({
    generateNew: () => qualityCandidate("new", accepted),
    generateSimilar(source) {
      receivedSource = source;
      return qualityCandidate("similar-from-shape", source);
    },
  });

  const result = await runner.generate("similar", { sourceSong: accepted, config: { seed: "similar-after-shape" } });
  assert.equal(result.status, "committed");
  assert.equal(receivedSource, accepted, "Similar must receive the accepted Shape snapshot, not the pre-Shape parent");
  assert.deepEqual(receivedSource.tracks.find((track) => track.id === "melody").notes, accepted.tracks.find((track) => track.id === "melody").notes);
  assert.notDeepEqual(receivedSource.tracks.find((track) => track.id === "melody").notes, original.tracks.find((track) => track.id === "melody").notes);
});

test("new Fire/Electric/Drip family auditions from the accepted Shape snapshot", () => {
  const transaction = shapedTransaction();
  const accepted = acceptShapeCandidate(transaction);
  const receivedSources = [];

  const variations = generateProducerVariationSet(accepted, {
    seed: "elements-after-shape",
    candidatesPerVariation: 1,
  }, {
    generateSimilar(source, config) {
      receivedSources.push(source);
      return qualityCandidate(config.seed, source);
    },
  });

  assert.equal(variations.length, 3);
  assert.equal(receivedSources.length, 3);
  assert.ok(receivedSources.every((source) => source === accepted), "every Element audition must branch from the accepted Shape song");
  assert.deepEqual(variations.map((song) => song.variationSet.element.id), ["fire", "electric", "drip"]);
});

test("discarded Shape never becomes generation authority", async () => {
  const transaction = shapedTransaction();
  const restored = rejectShapeCandidate(transaction);
  assert.deepEqual(restored, transaction.before);

  let receivedSource = null;
  const runner = createGenerationRunner({
    generateNew: () => qualityCandidate("new", restored),
    generateSimilar(source) {
      receivedSource = source;
      return qualityCandidate("similar-after-discard", source);
    },
  });
  await runner.generate("similar", { sourceSong: restored, config: { seed: "discard-source" } });
  assert.deepEqual(receivedSource, transaction.before);
  assert.notDeepEqual(receivedSource, transaction.after);
});

test("application commit and generation wiring keep current state.song authoritative", () => {
  const appSource = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(appSource, /state\.song\s*=\s*deepClone\(transaction\.after\)/);
  assert.match(appSource, /const sourceSong\s*=\s*options\.sourceSong\s*\?\?\s*state\.song/);
  assert.match(appSource, /generationExecutor\.run\(kind,\s*\{\s*sourceSong,\s*config\s*\}\)/);
  assert.match(appSource, /generateSongVariations\(sourceSong,\s*config\)/);
});
