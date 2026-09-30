import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "../src/music-engine.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

const GENRES = ["hipHop", "trap", "pop", "house", "neoSoul"];
const BAR_COUNTS = [16, 32];

const QUALITY_CONFIG = Object.freeze({
  arrangementEvolution: false,
  returnDevelopment: false,
  groovePocketRefinement: false,
  densityRefinement: false,
  phraseResolutionRefinement: false,
  repetitionRefinement: false,
  registerHealthRefinement: false,
  fusionPerformanceRefinement: false,
  melodyContinuityRefinement: false,
  melodyPhraseRefinement: false,
  melodySectionDevelopmentRefinement: true,
  bassContinuityRefinement: false,
  ensembleContinuityRefinement: false,
  genreIdentityRefinement: false,
  transitionFxRefinement: false,
});

function melodyFingerprint(song) {
  return JSON.stringify(
    (song?.tracks ?? []).find((track) => track.id === "melody")?.notes?.map((note) => [
      note.pitch,
      note.start,
      note.duration,
      note.velocity,
      note.phraseMemorySourceSectionId ?? null,
      note.sectionDevelopmentRole ?? null,
    ]) ?? [],
  );
}

test("full-song melody memory gauntlet holds determinism, release safety, and return coherence", { timeout: 180_000 }, () => {
  const failures = [];

  for (const genre of GENRES) {
    for (const bars of BAR_COUNTS) {
      const options = {
        seed: `melody-memory-gauntlet-${genre}-${bars}`,
        genre,
        key: "A",
        scale: "minor",
        bars,
        energy: 0.72,
        complexity: 0.74,
        variation: 0.76,
        evolution: 0.72,
        swing: genre === "house" ? 0.08 : 0.16,
        humanize: 0.12,
      };

      const firstComposed = engine.generateNew(options);
      const secondComposed = engine.generateNew(options);
      const first = applySongOutputQualityPipeline(firstComposed, QUALITY_CONFIG);
      const second = applySongOutputQualityPipeline(secondComposed, QUALITY_CONFIG);

      const label = `${genre}/${bars}`;
      if (melodyFingerprint(first.song) !== melodyFingerprint(second.song)) {
        failures.push(`${label}: melody output is not deterministic`);
      }

      const firstMidi = engine.encodeMidi(first.song);
      const secondMidi = engine.encodeMidi(second.song);
      if (!Buffer.from(firstMidi).equals(Buffer.from(secondMidi))) {
        failures.push(`${label}: exported MIDI bytes are not deterministic`);
      }

      const release = engine.evaluateSongReleaseGate(first.song);
      if (!release.passed) {
        failures.push(`${label}: release gate failed: ${(release.failures ?? []).join(", ")}`);
      }

      const memory = first.melodySectionMemoryDiagnostics;
      if (!memory) {
        failures.push(`${label}: final melody section memory audit missing`);
        continue;
      }
      if (memory.status === "evaluated" && !memory.passed) {
        failures.push(`${label}: memory audit failed: ${memory.reason}; score=${memory.score}; weakest=${memory.weakestSection?.sectionId ?? "none"}`);
      }
      if (bars === 32 && memory.status !== "evaluated") {
        failures.push(`${label}: 32-bar song did not expose an evaluable memory relationship (${memory.reason})`);
      }

      const repair = first.melodySectionDevelopmentDiagnostics;
      if (repair?.accepted && repair?.changed) {
        const beforeCount = (firstComposed.tracks ?? []).find((track) => track.id === "melody")?.notes?.length ?? 0;
        const afterCount = (first.song.tracks ?? []).find((track) => track.id === "melody")?.notes?.length ?? 0;
        if (beforeCount !== afterCount) failures.push(`${label}: section repair changed melody topology`);
        for (const id of ["drums", "bass"]) {
          const before = JSON.stringify((firstComposed.tracks ?? []).find((track) => track.id === id)?.notes ?? []);
          const after = JSON.stringify((first.song.tracks ?? []).find((track) => track.id === id)?.notes ?? []);
          if (before !== after) failures.push(`${label}: section repair changed ${id}`);
        }
      }
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});
