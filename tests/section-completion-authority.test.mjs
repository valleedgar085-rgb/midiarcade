import assert from "node:assert/strict";
import test from "node:test";

import { generateNew } from "../src/music-engine.js";
import {
  createSectionCompletionContracts,
  evaluateSectionCompletionAuthority,
} from "../src/core/section-completion-authority.js";

test("section completion contracts describe exits, arrivals, breaths, and the final stop", () => {
  const structure = [
    { id: "verse-1", name: "verse", startBeat: 0, endBeat: 16, bars: 4, intent: { cadence: "lift" } },
    { id: "chorus-1", name: "chorus", startBeat: 16, endBeat: 32, bars: 4, intent: { cadence: "resolve" } },
    { id: "outro-1", name: "outro", startBeat: 32, endBeat: 40, bars: 2, intent: { cadence: "resolve" } },
  ];
  const songBlueprint = {
    sectionPlans: [
      { sectionId: "verse-1", cadence: "lift" },
      { sectionId: "chorus-1", cadence: "resolve" },
      { sectionId: "outro-1", cadence: "resolve" },
    ],
    transitions: [
      {
        fromSectionId: "verse-1",
        toSectionId: "chorus-1",
        type: "drop-out",
        strength: 0.85,
        pickupBeats: 0.5,
      },
      {
        fromSectionId: "chorus-1",
        toSectionId: "outro-1",
        type: "release",
        strength: 0.7,
        pickupBeats: 0.5,
      },
    ],
  };

  const contracts = createSectionCompletionContracts({ structure, songBlueprint, beatsPerBar: 4 });

  assert.equal(contracts.length, 3);
  assert.equal(contracts[0].exitMode, "launch");
  assert.equal(contracts[0].arrivalMode, "impact");
  assert.ok(contracts[0].breathBeats >= 0.25);
  assert.equal(contracts[1].arrivalMode, "settle");
  assert.equal(contracts[2].isFinal, true);
  assert.equal(contracts[2].exitMode, "final");
  assert.equal(contracts[2].arrivalMode, "stop");
});

test("generated songs finish section seams after tonal and final assembly passes", () => {
  const input = {
    genre: "pop",
    seed: "section-completion-proof",
    bars: 16,
    candidateCount: 1,
    targetedRepair: false,
    energy: 0.76,
    complexity: 0.68,
    variation: 0.72,
  };

  const song = generateNew(input);
  const repeated = generateNew(input);
  assert.deepEqual(repeated, song, "section completion must preserve deterministic generation");

  assert.equal(song.sectionCompletion.phase, 77);
  assert.equal(song.sectionCompletion.authority, "section-completion-v1.1");
  assert.equal(song.sectionCompletion.boundaryCount, song.structure.length);
  assert.ok(song.sectionCompletion.score >= 70, JSON.stringify(song.sectionCompletion));
  assert.ok(song.sectionCompletion.finalBoundary, "the final section must have an explicit ending contract");
  assert.ok(song.sectionCompletion.finalBoundary.endingFit >= 0.6, JSON.stringify(song.sectionCompletion.finalBoundary));
  assert.ok(
    song.generationPhases.some((phase) => phase.id === "section-completion-authority"),
    "the post-final completion phase should be recorded",
  );
});

test("completion critic falls when section landings are clipped and arrivals drift late", () => {
  const song = generateNew({
    genre: "pop",
    seed: "section-completion-damage-proof",
    bars: 16,
    candidateCount: 1,
    targetedRepair: false,
    energy: 0.8,
    complexity: 0.72,
  });
  const healthy = evaluateSectionCompletionAuthority(song);
  const damaged = structuredClone(song);

  const byId = new Map(damaged.tracks.map((track) => [track.id, track]));
  for (const section of damaged.structure) {
    for (const trackId of ["bass", "melody"]) {
      const notes = (byId.get(trackId)?.notes ?? [])
        .filter((note) => note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6)
        .sort((left, right) => left.start - right.start);
      const last = notes.at(-1);
      if (!last) continue;
      last.duration = 0.04;
      last.pitch += 1;
    }
  }

  for (let index = 1; index < damaged.structure.length; index += 1) {
    const boundary = damaged.structure[index].startBeat;
    for (const trackId of ["bass", "chords"]) {
      const track = byId.get(trackId);
      const arrival = (track?.notes ?? [])
        .filter((note) => note.start >= boundary - 0.03 && note.start <= boundary + 0.12)
        .sort((left, right) => Math.abs(left.start - boundary) - Math.abs(right.start - boundary))[0];
      if (arrival) arrival.start = boundary + 0.24;
    }
    const drums = byId.get("drums");
    const kick = (drums?.notes ?? [])
      .filter((note) => [35, 36].includes(note.pitch) && note.start >= boundary - 0.03 && note.start <= boundary + 0.12)
      .sort((left, right) => Math.abs(left.start - boundary) - Math.abs(right.start - boundary))[0];
    if (kick) kick.start = boundary + 0.18;
  }

  const broken = evaluateSectionCompletionAuthority(damaged);
  assert.ok(
    broken.score <= healthy.score - 8,
    `damaged boundary score ${broken.score} should be materially below healthy ${healthy.score}`,
  );
  assert.ok(
    broken.finalBoundary.endingFit < healthy.finalBoundary.endingFit
      || broken.finalBoundary.cadenceFit < healthy.finalBoundary.cadenceFit,
    "the final ending should visibly degrade when its landing is damaged",
  );
});
