import assert from "node:assert/strict";
import test from "node:test";

import { applyModalInterchange } from "../src/core/advanced-harmony.js";
import { cloneValue } from "../src/core/clone-value.js";
import { hash32, seededUnit } from "../src/core/deterministic-rng.js";
import { createGenerationFlightRecorder } from "../src/core/generation-flight-recorder.js";
import { normalizeGenreId } from "../src/core/genre-contract.js";
import {
  clampMidiVelocity,
  MIDI_NOTE_VELOCITY_MAX,
} from "../src/core/note-contract.js";
import { createQualityEvaluationContext } from "../src/core/output-quality-stage-runner.js";

test("genre aliases normalize to canonical core ids without rewriting unknown ids", () => {
  assert.equal(normalizeGenreId("HIP-HOP"), "hipHop");
  assert.equal(normalizeGenreId("hip hop"), "hipHop");
  assert.equal(normalizeGenreId("R&B"), "rnbSoul");
  assert.equal(normalizeGenreId("Lo-Fi Hip-Hop"), "loFiHipHop");
  assert.equal(normalizeGenreId("Drum & Bass"), "drumBass");
  assert.equal(normalizeGenreId("customFutureGenre"), "customFutureGenre");
});

test("canonical note contract preserves the final-master velocity ceiling", () => {
  assert.equal(MIDI_NOTE_VELOCITY_MAX, 120);
  assert.equal(clampMidiVelocity(999), 120);
  assert.equal(clampMidiVelocity(-4), 1);
  assert.equal(clampMidiVelocity(88.7), 89);
});

test("shared deterministic helpers remain repeatable", () => {
  assert.equal(hash32("midi-arcade"), hash32("midi-arcade"));
  assert.equal(seededUnit("seed", "salt"), seededUnit("seed", "salt"));
  assert.notEqual(hash32("midi-arcade"), hash32("midi-arcade-2"));
});

test("shared clone helper isolates nested mutation", () => {
  const source = { nested: { values: [1, 2, 3] } };
  const copy = cloneValue(source);
  copy.nested.values.push(4);
  assert.deepEqual(source, { nested: { values: [1, 2, 3] } });
});

test("flight recorder telemetry failures never fail generation diagnostics", () => {
  const recorder = createGenerationFlightRecorder({
    clock: (() => {
      let value = 0;
      return () => ++value;
    })(),
    sink() {
      throw new Error("telemetry unavailable");
    },
  });
  const id = recorder.begin("new", { config: { seed: "safe" } });
  recorder.mark(id, "compose");
  assert.doesNotThrow(() => recorder.complete(id, { id: "song" }));
  assert.equal(recorder.snapshot().at(-1).status, "committed");
});

test("modal interchange is fail-closed outside major/ionian modes", () => {
  const source = [1, 4, 5, 6];
  assert.deepEqual(applyModalInterchange(source, "minor", 12345), source);
  assert.deepEqual(applyModalInterchange(source, "dorian", 12345), source);
});

test("quality evaluation context reuses candidate and release evaluations by song identity", () => {
  let candidateCalls = 0;
  let releaseCalls = 0;
  const context = createQualityEvaluationContext({
    evaluateCandidate(song) {
      candidateCalls += 1;
      return { score: song.score };
    },
    evaluateReleaseGate(_song, evaluation) {
      releaseCalls += 1;
      return { passed: evaluation.score > 0 };
    },
  });
  const song = { score: 90 };
  const first = context.evaluateCandidate(song);
  const second = context.evaluateCandidate(song);
  assert.strictEqual(first, second);
  assert.equal(candidateCalls, 1);
  assert.deepEqual(context.evaluateReleaseGate(song, first), { passed: true });
  assert.deepEqual(context.evaluateReleaseGate(song, first), { passed: true });
  assert.equal(releaseCalls, 1);
});
