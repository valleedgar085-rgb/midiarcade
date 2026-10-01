import assert from "node:assert/strict";
import test from "node:test";

import {
  applyIntentionalChromaticApproaches,
  applyLicensedHarmonyColor,
  tonalLicenseForChordPitch,
} from "../src/core/licensed-harmony-color.js";
import { candidateSeed, generateNew } from "../src/music-engine.js";

const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];

function baseConfig(overrides = {}) {
  return {
    genre: "jazz",
    seed: "licensed-color",
    key: "C",
    keyPc: 0,
    scale: "major",
    scaleIntervals: C_MAJOR,
    bars: 16,
    complexity: 0.95,
    surprise: 0.78,
    professionalUpgrade: true,
    ...overrides,
  };
}

function sampleHarmony() {
  return [
    { bar: 0, start: 0, duration: 4, degree: 0, root: "C", rootPc: 0, tones: [0, 4, 7], roman: "I", sectionId: "verse" },
    { bar: 1, start: 4, duration: 4, degree: 3, root: "F", rootPc: 5, tones: [5, 9, 0], roman: "IV", sectionId: "verse" },
    { bar: 2, start: 8, duration: 4, degree: 1, root: "D", rootPc: 2, tones: [2, 5, 9], roman: "ii", sectionId: "chorus" },
    { bar: 3, start: 12, duration: 4, degree: 4, root: "G", rootPc: 7, tones: [7, 11, 2], roman: "V", sectionId: "chorus" },
  ];
}

test("licensed harmony color is a soft deterministic behavior, not an every-song rule", () => {
  let colored = 0;
  for (let index = 0; index < 128; index += 1) {
    const result = applyLicensedHarmonyColor(
      sampleHarmony(),
      baseConfig({ seed: `licensed-soft-${index}` }),
    );
    const events = result.filter((event) => event.harmonicLicense);
    if (events.length) colored += 1;
    assert.ok(events.length <= 1, "16-bar color budget should remain restrained");
  }

  assert.ok(colored > 0, "some seeds should receive harmonic color");
  assert.ok(colored < 128, "harmonic color must not appear on every seed");
});

test("colored harmony carries auditable evidence and real outside-scale tones", () => {
  let coloredEvent = null;
  for (let index = 0; index < 256 && !coloredEvent; index += 1) {
    const result = applyLicensedHarmonyColor(
      sampleHarmony(),
      baseConfig({ seed: `licensed-evidence-${index}` }),
    );
    coloredEvent = result.find((event) => event.harmonicLicense) ?? null;
  }

  assert.ok(coloredEvent, "expected to find at least one deterministic colored seed");
  assert.ok(["modalInterchange", "secondaryDominant"].includes(coloredEvent.harmonicLicense));
  assert.ok(coloredEvent.licensedPitchClasses.length >= 1);
  assert.ok(coloredEvent.licensedPitchClasses.some((pitchClass) => !C_MAJOR.includes(pitchClass)));
});

test("licensed chord metadata only follows real outside chord members", () => {
  const config = baseConfig();
  const chord = {
    rootPc: 9,
    tones: [9, 1, 4, 7],
    symbol: "A7",
    harmonicLicense: "secondaryDominant",
  };

  const licensed = tonalLicenseForChordPitch(61, chord, config);
  assert.equal(licensed?.tonalLicense, "secondaryDominantTone");
  assert.equal(tonalLicenseForChordPitch(60, chord, config), null, "non-chord pitch cannot borrow the chord license");
  assert.equal(tonalLicenseForChordPitch(64, chord, config), null, "already in-scale chord tones need no license");
});

test("chromatic approach pass changes pitch color without adding density", () => {
  const notes = [
    { pitch: 60, start: 0.25, duration: 0.25, velocity: 88 },
    { pitch: 62, start: 0.5, duration: 0.4, velocity: 92 },
    { pitch: 64, start: 1.25, duration: 0.25, velocity: 86 },
    { pitch: 65, start: 1.5, duration: 0.4, velocity: 90 },
  ];

  let colored = null;
  for (let index = 0; index < 256 && !colored; index += 1) {
    const result = applyIntentionalChromaticApproaches(
      notes,
      baseConfig({ seed: `chromatic-soft-${index}` }),
      "melody",
    );
    const colorIndex = result.findIndex((note) => note.tonalLicense === "chromaticApproach");
    if (colorIndex >= 0) colored = { result, colorIndex };
  }

  assert.ok(colored, "expected a deterministic seed that licenses an approach tone");
  assert.equal(colored.result.length, notes.length, "chromatic color must not increase note density");
  const note = colored.result[colored.colorIndex];
  const next = colored.result[colored.colorIndex + 1];
  assert.ok(note.duration <= 0.3);
  assert.equal(Math.abs(note.pitch - next.pitch), 1);
  assert.ok(!C_MAJOR.includes(((note.pitch % 12) + 12) % 12));
  assert.equal(note.resolvesToPitch, next.pitch);
});

test("production generation can preserve licensed color while remaining tonally safe", { timeout: 120_000 }, () => {
  let seed = null;
  for (let index = 0; index < 512 && seed == null; index += 1) {
    const candidate = `production-color-${index}`;
    const productionSeed = candidateSeed(candidate, "new", 0);
    const preview = applyLicensedHarmonyColor(
      sampleHarmony(),
      baseConfig({ seed: productionSeed, bars: 4 }),
    );
    if (preview[0]?.harmonicLicense === "secondaryDominant") seed = candidate;
  }
  assert.ok(seed, "expected a deterministic production seed");

  const song = generateNew({
    genre: "jazz",
    seed,
    key: "C",
    mode: "major",
    scaleSelection: "explicit",
    chordPath: "jazz",
    bars: 4,
    professionalUpgrade: true,
    complexity: 0.95,
    surprise: 0.78,
    candidateCount: 1,
  });

  assert.equal(song.seed, candidateSeed(seed, "new", 0), "test preview must use the exact production candidate seed");
    assert.ok(song.harmony.some((event) => event.harmonicLicense), "production harmony should contain a licensed color event");
  assert.equal(song.tonalIntegrity.after.scaleFit, 1, "validated color must remain release-safe");
  assert.equal(song.tonalIntegrity.after.unsafeScaleNotes, 0);
  assert.ok(song.tonalIntegrity.after.licensedColorNotes >= 1, "at least one licensed outside tone should survive to the final song");
  assert.ok(song.tonalIntegrity.after.literalScaleFit < 1, "final song should retain genuine non-diatonic color");
});
