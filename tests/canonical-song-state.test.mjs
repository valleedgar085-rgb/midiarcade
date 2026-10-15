import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_SONG_AUTHORITY_KEYS,
  createCanonicalSongState,
} from "../src/core/canonical-song-state.js";

function sourceSong() {
  return {
    id: "accepted-song",
    seed: "fixed-source-seed",
    structure: [{ id: "chorus-1", intent: { role: "payoff" } }],
    harmony: [{ start: 0, rootPc: 4, chordTones: [4, 7, 11] }],
    grooveConductor: { bars: [{ bar: 0, anchors: [0, 2], bassPulses: [0.5, 2.5] }] },
    songBlueprint: { sectionPlans: [{ sectionId: "chorus-1", cadence: "resolve" }] },
    producerIntent: { sectionContracts: [{ id: "chorus-1", featuredTrack: "melody" }] },
    tracks: [{ id: "melody", notes: [{ start: 0.5, pitch: 64, duration: 0.5, velocity: 88 }] }],
  };
}

test("canonical authority snapshot isolates and deeply freezes the shared musical contracts", () => {
  const source = sourceSong();
  const original = structuredClone(source);
  const snapshot = createCanonicalSongState(source);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.sourceSongId, source.id);
  assert.equal(snapshot.sourceSeed, source.seed);
  for (const key of CANONICAL_SONG_AUTHORITY_KEYS) {
    if (source[key] !== undefined) assert.deepEqual(snapshot[key], source[key], key);
  }
  assert.notStrictEqual(snapshot.harmony[0], source.harmony[0]);
  assert.notStrictEqual(snapshot.grooveConductor.bars[0].anchors, source.grooveConductor.bars[0].anchors);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.harmony));
  assert.ok(Object.isFrozen(snapshot.harmony[0]));
  assert.ok(Object.isFrozen(snapshot.harmony[0].chordTones));
  assert.ok(Object.isFrozen(snapshot.grooveConductor.bars[0].bassPulses));
  assert.throws(() => { snapshot.harmony[0].rootPc = 11; }, TypeError);
  assert.throws(() => { snapshot.structure[0].intent.role = "intro"; }, TypeError);
  assert.throws(() => { snapshot.grooveConductor.bars[0].anchors.push(3); }, TypeError);
  assert.deepEqual(source, original, "freezing snapshot must not freeze or mutate accepted song");
  source.harmony[0].rootPc = 9;
  assert.equal(snapshot.harmony[0].rootPc, 4);
});

test("snapshot is deterministic and has no track-note ownership", () => {
  const source = sourceSong();
  assert.deepEqual(createCanonicalSongState(source), createCanonicalSongState(source));
  assert.equal(Object.hasOwn(createCanonicalSongState(source), "tracks"), false);
});

test("invalid inputs cannot silently create an empty canonical authority", () => {
  for (const invalid of [null, undefined, 0, "song"]) {
    assert.throws(() => createCanonicalSongState(invalid), TypeError);
  }
});
