import assert from "node:assert/strict";
import test from "node:test";

import { runGenerationRequest } from "../src/core/generation-api.js";

function generate(genre, mode) {
  return runGenerationRequest("new", {
    config: {
      seed: `urban-intro-${genre}`,
      genre,
      bars: 32,
      energy: 0.68,
      complexity: 0.62,
      variation: 0.5,
      evolution: 0.62,
      trapIntroMode: mode,
    },
  }).song;
}

function introBars(song) {
  return song.structure.find((section) => section.name === "intro")?.bars ?? 0;
}

function sectionFingerprint(song) {
  return JSON.stringify(song.structure.map(({ name, bars, startBar }) => ({ name, bars, startBar })));
}

test("Trap and Hip-Hop can both explicitly double their intro deterministically", () => {
  for (const genre of ["trap", "hipHop"]) {
    const short = generate(genre, "short");
    const extended = generate(genre, "extended");
    const repeated = generate(genre, "extended");

    assert.ok(introBars(extended) >= introBars(short) * 2, `${genre}: extended intro should provide at least double the short intro room`);
    assert.equal(extended.structure.reduce((sum, section) => sum + section.bars, 0), 32, `${genre}: extended intro must preserve song length`);
    assert.equal(sectionFingerprint(extended), sectionFingerprint(repeated), `${genre}: extended intro must remain deterministic`);
  }
});

test("Urban intro mode does not alter Pop or the conservative default", () => {
  const autoTrap = generate("trap", "auto");
  const shortTrap = generate("trap", "short");
  const autoHipHop = generate("hipHop", "auto");
  const shortHipHop = generate("hipHop", "short");
  const popShort = generate("pop", "short");
  const popExtended = generate("pop", "extended");

  assert.equal(sectionFingerprint(autoTrap), sectionFingerprint(shortTrap));
  assert.equal(sectionFingerprint(autoHipHop), sectionFingerprint(shortHipHop));
  assert.equal(sectionFingerprint(popShort), sectionFingerprint(popExtended), "Pop must ignore the urban intro mode");
});
