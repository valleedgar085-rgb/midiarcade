import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseElementProgram,
  elementProgramCandidates,
} from "../src/core/elemental-program-policy.js";

const PALETTE = [4, 5, 17, 61, 62, 81, 89, 90, 95];

test("elemental program policy keeps every choice inside the supplied role-safe palette", () => {
  for (const elementId of ["fire", "electric", "drip"]) {
    const program = chooseElementProgram({
      trackId: "chords",
      elementId,
      intensity: 0.86,
      palette: PALETTE,
      seed: "safe-palette",
      currentProgram: 4,
    });
    assert.ok(PALETTE.includes(program), `${elementId} chose ${program} outside the palette`);
  }
});

test("elemental program choices are deterministic and avoid the current program when alternatives exist", () => {
  const input = {
    trackId: "melody",
    elementId: "electric",
    intensity: 0.8,
    palette: [80, 81, 82, 84, 85],
    seed: "deterministic-electric",
    currentProgram: 82,
  };
  const first = chooseElementProgram(input);
  const second = chooseElementProgram(input);
  assert.equal(first, second);
  assert.notEqual(first, 82);
});

test("Fire, Electric and Drip order the same chord palette by distinct timbral priorities", () => {
  const fire = elementProgramCandidates("chords", "fire", PALETTE);
  const electric = elementProgramCandidates("chords", "electric", PALETTE);
  const drip = elementProgramCandidates("chords", "drip", PALETTE);
  assert.notDeepEqual(fire.slice(0, 4), electric.slice(0, 4));
  assert.notDeepEqual(electric.slice(0, 4), drip.slice(0, 4));
  assert.notDeepEqual(fire.slice(0, 4), drip.slice(0, 4));
});

test("unknown or empty palettes fail safely without inventing a program", () => {
  assert.equal(chooseElementProgram({ trackId: "bass", elementId: "fire", palette: [], currentProgram: 38 }), 38);
  assert.equal(chooseElementProgram({ trackId: "bass", elementId: "fire", palette: [] }), null);
});
