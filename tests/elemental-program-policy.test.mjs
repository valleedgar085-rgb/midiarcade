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

test("strong elemental passes occupy distinct canonical sound lanes when the palette supports them", () => {
  const palettes = {
    drums: [0, 8, 16, 24, 25],
    bass: [33, 34, 35, 36, 38, 39, 43, 87, 88],
    chords: [4, 5, 17, 29, 30, 61, 62, 81, 89, 90, 95],
    melody: [24, 26, 29, 30, 40, 56, 65, 71, 73, 80, 81, 82, 84, 85, 86, 87],
    counterpoint: [10, 11, 29, 48, 53, 56, 65, 71, 73, 80, 81, 82, 84, 85, 86, 98],
    pad: [88, 89, 90, 91, 92, 93, 94, 95, 96, 99],
  };

  for (const [trackId, palette] of Object.entries(palettes)) {
    const choices = ["fire", "electric", "drip"].map((elementId) => chooseElementProgram({
      trackId,
      elementId,
      intensity: 0.9,
      palette,
      seed: "strong-lanes",
    }));
    assert.equal(new Set(choices).size, 3, `${trackId} should expose three audibly distinct strong-element programs`);
  }
});

test("unknown or empty palettes fail safely without inventing a program", () => {
  assert.equal(chooseElementProgram({ trackId: "bass", elementId: "fire", palette: [], currentProgram: 38 }), 38);
  assert.equal(chooseElementProgram({ trackId: "bass", elementId: "fire", palette: [] }), null);
});
