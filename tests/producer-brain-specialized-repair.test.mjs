import assert from "node:assert/strict";
import test from "node:test";
import { generateNew } from "../src/music-engine.js";

test("density weakness uses focused pitched support lanes with signed local diagnostics", () => {
  const song = generateNew({
    seed: "surgical-accept-jazz-8-0",
    bars: 8,
    genre: "jazz",
    energy: 0.05,
    complexity: 0.05,
  });
  const repair = song.meta?.scoreDetails?.criticRepair;
  const densityAttempt = repair?.acceptanceHistory?.find((entry) => entry.dimension === "density");

  assert.ok(densityAttempt, "expected the verified seed to expose a density repair attempt");
  assert.match(densityAttempt.repairStrategyId ?? "", /^density-(build|thin)$/);
  assert.ok(densityAttempt.surgicalTracks.includes("bass"));
  assert.ok(densityAttempt.surgicalTracks.length >= 2 && densityAttempt.surgicalTracks.length <= 4);
  assert.ok(!densityAttempt.surgicalTracks.includes("drums"), "density critic measures pitched-note density, not drums");
  assert.ok(!densityAttempt.surgicalTracks.includes("melody"), "density repair should preserve the hook lane");
  assert.ok(densityAttempt.surgicalWindow?.bars >= 2 && densityAttempt.surgicalWindow?.bars <= 8);
  assert.ok(Number.isFinite(densityAttempt.surgicalWindow?.diagnostics?.density));
  assert.ok(Number.isFinite(densityAttempt.surgicalWindow?.diagnostics?.densityTarget));
  assert.ok(Number.isFinite(densityAttempt.surgicalWindow?.diagnostics?.densityDelta));
});

test("specialized repair metadata is deterministic and remains bounded by the existing repair budget", () => {
  const input = {
    seed: "surgical-accept-jazz-8-0",
    bars: 8,
    genre: "jazz",
    energy: 0.05,
    complexity: 0.05,
  };
  const first = generateNew(input);
  const second = generateNew(input);
  const firstRepair = first.meta?.scoreDetails?.criticRepair;
  const secondRepair = second.meta?.scoreDetails?.criticRepair;

  assert.deepEqual(firstRepair, secondRepair);
  assert.ok(firstRepair.attempts <= 2, `repair attempts exceeded policy: ${firstRepair.attempts}`);
  assert.ok(first.meta.scoreDetails.candidatesEvaluated <= 12);
  assert.ok(firstRepair.acceptanceHistory.every((entry) => (
    !entry.repairStrategyId || typeof entry.repairStrategyId === "string"
  )));
});

test("precision repair routes transitions and performance while preserving cadence surgery", () => {
  const targets = new Map([
    ["transitions", "transition-boundary"],
    ["performance", "performance-dynamics"],
    ["phraseResolution", "phrase-cadence"],
  ]);
  const observed = new Map();
  const genres = ["techno", "drumBass", "jazz", "hipHop", "trap", "popRadio", "house", "afrobeats"];
  const profiles = [
    ["sparse", 0.12, 0.18],
    ["balanced", 0.55, 0.55],
    ["dense", 0.88, 0.82],
  ];

  outer: for (const seedId of ["repair-cal-01", "repair-cal-02"]) {
    for (const genre of genres) {
      for (const [profile, energy, complexity] of profiles) {
        const song = generateNew({
          genre,
          seed: seedId + ":" + genre + ":" + profile,
          bars: 8,
          energy,
          complexity,
        });
        for (const entry of song.meta?.scoreDetails?.criticRepair?.acceptanceHistory ?? []) {
          if (targets.has(entry.dimension) && !observed.has(entry.dimension)) observed.set(entry.dimension, entry);
        }
        if (observed.size === targets.size) break outer;
      }
    }
  }

  for (const [dimension, strategyId] of targets) {
    const entry = observed.get(dimension);
    assert.ok(entry, "expected calibration matrix to expose " + dimension);
    assert.equal(entry.repairStrategyId, strategyId);
    assert.ok(["improved-target", "improved-balance", "rejected-no-gain", "rejected-regression"].includes(entry.outcome));
  }
  assert.equal(observed.get("transitions").surgicalAttempted, false);
  assert.equal(observed.get("performance").surgicalAttempted, true);
  assert.equal(observed.get("phraseResolution").surgicalAttempted, true);
});

test("phrase cadence precision preserves the source while whole repair remains a scored fallback", () => {
  const song = generateNew({
    genre: "jazz",
    seed: "repair-cal-02:jazz:sparse",
    bars: 8,
    energy: 0.12,
    complexity: 0.18,
  });
  const entry = song.meta?.scoreDetails?.criticRepair?.acceptanceHistory
    ?.find((attempt) => attempt.dimension === "phraseResolution");

  assert.ok(entry, "expected the verified seed to expose phrase-resolution repair");
  assert.equal(entry.repairStrategyId, "phrase-cadence");
  assert.equal(entry.surgicalAttempted, true);
  assert.equal(entry.surgicalAccepted, true);
  assert.equal(entry.wholeAccepted, false);
  assert.equal(entry.selectedRepairMode, "surgical-window");
  assert.equal(entry.selectionReason, "accepted-over-rejected");
  assert.ok(entry.weaknessGain >= 0.5);
  assert.ok(entry.surgicalWindow?.bars >= 2 && entry.surgicalWindow?.bars <= 8);
});

test("song-level statistical weaknesses do not consume local surgical repair attempts", () => {
  const globalDimensions = new Set(["memory", "repetition", "drumVariety"]);
  const inputs = [
    { genre: "techno", profile: "sparse", energy: 0.12, complexity: 0.18 },
    { genre: "hipHop", profile: "balanced", energy: 0.55, complexity: 0.55 },
    { genre: "house", profile: "dense", energy: 0.88, complexity: 0.82 },
  ];
  const songs = inputs.map((input) => generateNew({
    genre: input.genre,
    seed: `repair-cal-01:${input.genre}:${input.profile}`,
    bars: 8,
    energy: input.energy,
    complexity: input.complexity,
  }));
  const repairs = songs.map((song) => song.meta?.scoreDetails?.criticRepair ?? {});
  const skips = repairs.flatMap((repair) => repair.skippedGlobalDimensions ?? []);

  assert.ok(skips.length > 0, "calibration seeds should expose at least one song-level weakness");
  assert.ok(skips.every((skip) => globalDimensions.has(skip.dimension)));
  assert.ok(repairs.every((repair) => (repair.acceptanceHistory ?? []).every((entry) => (
    !globalDimensions.has(entry.dimension)
  ))));
  assert.ok(repairs.every((repair) => repair.attempts <= 2));
  assert.ok(songs.every((song) => song.meta.scoreDetails.candidatesEvaluated <= 12));
});
