import assert from "node:assert/strict";
import test from "node:test";

import {
  generateNew,
  generateSimilar,
} from "../src/music-engine.js";
import { createCompositionCandidate } from "../src/core/blueprint-composer.js";

function sourceSong() {
  return generateNew({
    genre: "hipHop",
    seed: "scoped-groove-authority-source",
    bars: 16,
    candidateCount: 1,
    adaptiveCandidates: false,
    targetedRepair: false,
  });
}

test("generateSimilar can compose against an explicit inherited groove authority", () => {
  const source = sourceSong();
  const authority = structuredClone(source.grooveConductor);
  const related = generateSimilar(source, {
    seed: "scoped-groove-authority-related",
    targetTrack: "melody",
    grooveAuthority: authority,
    candidateCount: 1,
    adaptiveCandidates: false,
    targetedRepair: false,
  });

  assert.deepEqual(related.grooveConductor, authority);
  assert.notStrictEqual(related.grooveConductor, authority);
});

test("scoped Director composition forwards source groove authority to the Composer", () => {
  const source = sourceSong();
  const section = source.structure.find((entry) => entry.name !== "intro") ?? source.structure[0];
  let received = null;

  createCompositionCandidate(
    source,
    {
      target: "section-track",
      sectionId: section.id,
      trackId: "melody",
    },
    { seed: "scoped-director-groove-authority" },
    {
      composer(song, input) {
        received = input.grooveAuthority;
        return structuredClone(song);
      },
    },
  );

  assert.deepEqual(received, source.grooveConductor);
  assert.notStrictEqual(received, source.grooveConductor);
});
