import assert from "node:assert/strict";
import test from "node:test";

import { runGenerationRequest } from "../src/core/generation-api.js";

const GENRES = ["trap", "hipHop"];
const BAR_COUNTS = [16, 32, 48, 64];

function sectionNotes(song, section, track) {
  return (track?.notes ?? []).filter((note) => (
    Number(note?.start) >= Number(section?.startBeat ?? 0) - 1e-6
    && Number(note?.start) < Number(section?.endBeat ?? 0) - 1e-6
  ));
}

function grooveMetrics(song) {
  const drums = song.tracks.find((track) => track.id === "drums");
  const sections = (song.structure ?? song.sections ?? []).map((section) => {
    const notes = sectionNotes(song, section, drums);
    const bars = Math.max(1, Number(section.bars) || 1);
    const kicks = notes.filter((note) => Number(note.pitch) === 36).length;
    const snares = notes.filter((note) => [38, 40].includes(Number(note.pitch))).length;
    const hats = notes.filter((note) => [42, 44, 46].includes(Number(note.pitch))).length;
    return {
      id: section.id,
      name: String(section.name ?? section.type ?? "").toLowerCase(),
      bars,
      totalRate: notes.length / bars,
      accentRate: (snares + hats) / bars,
      hatRate: hats / bars,
      kickRate: kicks / bars,
      evolutionHits: notes.filter((note) => note.drumEvolutionRole || note.rhythmicFeature?.includes("bounce")).length,
    };
  });
  return {
    sections,
    active: sections.filter((section) => /^(verse|chorus|prechorus)/.test(section.name)),
    verses: sections.filter((section) => /^verse/.test(section.name)),
    choruses: sections.filter((section) => /^chorus/.test(section.name)),
  };
}

function fingerprint(song) {
  return JSON.stringify(
    song.tracks.find((track) => track.id === "drums")?.notes?.map((note) => [
      note.pitch,
      note.start,
      note.duration,
      note.velocity,
      note.drumEvolutionRole ?? "",
      note.rhythmicFeature ?? "",
    ]) ?? [],
  );
}

function generate(genre, bars) {
  return runGenerationRequest("new", {
    config: {
      seed: `track-c-groove-${genre}-${bars}`,
      genre,
      bars,
      energy: 0.68,
      complexity: 0.72,
      variation: 0.74,
      swing: 0.16,
      humanize: 0.12,
    },
  }).song;
}

test("Trap and Hip-Hop groove contracts stay deterministic and section-aware", () => {
  const summary = new Map();

  for (const genre of GENRES) {
    for (const bars of BAR_COUNTS) {
      const song = generate(genre, bars);
      const repeated = generate(genre, bars);
      const metrics = grooveMetrics(song);
      const repeatedMetrics = grooveMetrics(repeated);

      assert.equal(fingerprint(song), fingerprint(repeated), `${genre}/${bars}: drum generation is not deterministic`);
      assert.ok(metrics.choruses.length > 0, `${genre}/${bars}: missing chorus payoff section`);
      assert.ok(metrics.active.length > 0, `${genre}/${bars}: missing active groove section`);

      const peakChorusAccent = Math.max(...metrics.choruses.map((section) => section.accentRate));
      const peakVerseAccent = Math.max(
        ...metrics.verses.map((section) => section.accentRate),
        0,
      );
      assert.ok(
        peakChorusAccent + 1e-6 >= peakVerseAccent * 0.95,
        `${genre}/${bars}: chorus accent payoff is weaker than the body`,
      );

      const opening = metrics.sections[0];
      const peakSectionRate = Math.max(...metrics.choruses.map((section) => section.totalRate));
      assert.ok(
        opening.totalRate <= peakSectionRate * 1.35 + 1e-6,
        `${genre}/${bars}: opening groove starts too aggressively`,
      );

      summary.set(`${genre}/${bars}`, {
        peakChorusAccent,
        peakVerseAccent,
        openingRate: opening.totalRate,
        peakSectionRate,
        evolutionHits: metrics.sections.reduce((sum, section) => sum + section.evolutionHits, 0),
      });
      assert.deepEqual(metrics, repeatedMetrics, `${genre}/${bars}: repeated groove metrics diverged`);
    }
  }

  for (const bars of BAR_COUNTS) {
    const trap = grooveMetrics(generate("trap", bars));
    const hipHop = grooveMetrics(generate("hipHop", bars));
    const trapHatRate = trap.sections.reduce((sum, section) => sum + section.hatRate * section.bars, 0) / bars;
    const hipHopHatRate = hipHop.sections.reduce((sum, section) => sum + section.hatRate * section.bars, 0) / bars;
    assert.ok(
      trapHatRate > hipHopHatRate,
      `Trap/${bars}: trap hat vocabulary is not distinct from Hip-Hop`,
    );
  }

  assert.ok([...summary.values()].some((entry) => entry.evolutionHits > 0), "section-aware groove evolution never engaged");
});

test("Trap can deterministically double its intro without changing song length or Hip-Hop", () => {
  const base = {
    seed: "trap-intro-build",
    bars: 32,
    energy: 0.68,
    complexity: 0.62,
    variation: 0.5,
    evolution: 0.62,
  };
  const shortTrap = runGenerationRequest("new", {
    config: { ...base, genre: "trap", trapIntroMode: "short" },
  }).song;
  const extendedTrap = runGenerationRequest("new", {
    config: { ...base, genre: "trap", trapIntroMode: "extended" },
  }).song;
  const repeatedExtendedTrap = runGenerationRequest("new", {
    config: { ...base, genre: "trap", trapIntroMode: "extended" },
  }).song;
  const shortHipHop = runGenerationRequest("new", {
    config: { ...base, genre: "hipHop", trapIntroMode: "short" },
  }).song;
  const extendedHipHop = runGenerationRequest("new", {
    config: { ...base, genre: "hipHop", trapIntroMode: "extended" },
  }).song;

  const introBars = (song) => song.structure.find((section) => section.name === "intro")?.bars ?? 0;
  const timelineBars = (song) => song.structure.reduce((sum, section) => sum + section.bars, 0);
  const sectionFingerprint = (song) => JSON.stringify(song.structure.map(({ name, bars, startBar }) => ({ name, bars, startBar })));

  assert.equal(introBars(extendedTrap), introBars(shortTrap) * 2, "extended Trap intro should be exactly twice the short intro");
  assert.equal(timelineBars(extendedTrap), base.bars, "extended Trap intro must fit inside the requested song length");
  assert.equal(sectionFingerprint(extendedTrap), sectionFingerprint(repeatedExtendedTrap), "extended Trap planning must remain deterministic");
  assert.equal(sectionFingerprint(shortHipHop), sectionFingerprint(extendedHipHop), "Trap intro mode must not alter Hip-Hop structure");
  assert.equal(introBars(extendedHipHop), introBars(shortHipHop), "Hip-Hop intro length must remain unchanged");
});

test("Trap auto intro preserves the current default while Extended stays explicit", () => {
  const input = {
    seed: "trap-intro-auto",
    genre: "trap",
    bars: 32,
    energy: 0.68,
    complexity: 0.62,
    variation: 0.5,
  };
  const auto = runGenerationRequest("new", {
    config: { ...input, trapIntroMode: "auto" },
  }).song;
  const extended = runGenerationRequest("new", {
    config: { ...input, trapIntroMode: "extended" },
  }).song;
  assert.equal(auto.structure.find((section) => section.name === "intro")?.bars, 2);
  assert.equal(extended.structure.find((section) => section.name === "intro")?.bars, (auto.structure.find((section) => section.name === "intro")?.bars ?? 0) * 2);
});
