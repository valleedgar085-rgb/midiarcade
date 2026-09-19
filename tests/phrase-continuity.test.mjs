import assert from "node:assert/strict";
import test from "node:test";

import { phraseContinuityAnchorIndexes } from "../src/core/phrase-continuity.js";

function motif(eventCount = 9, lengthBeats = 8) {
  return {
    lengthBeats,
    events: Array.from({ length: eventCount }, (_, index) => ({
      offset: Number((index * (lengthBeats - 0.5) / Math.max(1, eventCount - 1)).toFixed(3)),
      degree: index % 5,
      duration: 0.5,
    })),
  };
}

test("ordinary melody phrases retain an evenly distributed continuity floor", () => {
  const source = motif();
  const indexes = phraseContinuityAnchorIndexes(source, {
    beatsPerBar: 4,
    density: 0.64,
    intensity: 0.8,
  });

  assert.equal(indexes.length, 4);
  assert.equal(indexes[0], 0);
  assert.equal(indexes.at(-1), source.events.length - 1);

  const offsets = indexes.map((index) => source.events[index].offset);
  const gaps = offsets.slice(1).map((offset, index) => offset - offsets[index]);
  assert.ok(Math.max(...gaps) <= 3);
});

test("high-energy sections keep more melody activity than low-energy sections", () => {
  const source = motif();
  const intro = phraseContinuityAnchorIndexes(source, {
    beatsPerBar: 4,
    density: 0.64,
    intensity: 0.58,
  });
  const chorus = phraseContinuityAnchorIndexes(source, {
    beatsPerBar: 4,
    density: 0.64,
    intensity: 1.12,
  });

  assert.equal(intro.length, 3);
  assert.equal(chorus.length, 5);
  assert.ok(chorus.length > intro.length);
});

test("counterpoint stays an answering voice instead of becoming a second lead", () => {
  assert.deepEqual(phraseContinuityAnchorIndexes(motif(), {
    counterpoint: true,
  }), []);
});
