import test from "node:test";
import * as engine from "../src/music-engine.js";
import { evaluateMelodySectionMemory } from "../src/core/melody-section-memory.js";
import { createMelodySectionDevelopmentCandidates } from "../src/core/melody-section-development-refinement.js";
import { applyMelodySectionDevelopmentRefinement } from "../src/core/output-quality-pipeline-register.js";

const CASES = [
  ["hipHop", 16],
  ["trap", 32],
  ["pop", 32],
  ["house", 32],
  ["neoSoul", 16],
];

function options(genre, bars) {
  return {
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
}

function sectionNotes(song, sectionId) {
  const section = (song.structure ?? []).find((entry) => String(entry.id) === String(sectionId));
  if (!section) return [];
  const beatsPerBar = Number(song?.meta?.beatsPerBar ?? 4);
  const start = Number.isFinite(Number(section.startBeat))
    ? Number(section.startBeat)
    : Number(section.startBar ?? section.start ?? 0) * beatsPerBar;
  const end = Number.isFinite(Number(section.endBeat))
    ? Number(section.endBeat)
    : start + Number(section.bars ?? 1) * beatsPerBar;
  return (song.tracks ?? []).find((track) => track.id === "melody")?.notes
    ?.filter((note) => Number(note.start) >= start - 1e-6 && Number(note.start) < end - 1e-6)
    .map((note) => ({
      start: note.start,
      pitch: note.pitch,
      duration: note.duration,
      protected: Boolean(
        note.ensembleCadenceRole
        || note.transitionHandoffRole
        || note.motifHandoffRole
        || note.finalAssemblyRole
        || note.phraseRole === "turnaround"
      ),
      role: note.sectionDevelopmentRole ?? null,
    })) ?? [];
}

function critic(song) {
  const result = engine.evaluateSongCandidate(song);
  return {
    score: result.score,
    subscores: result.subscores,
  };
}

test("diagnose five remaining memory seeds", { timeout: 180_000 }, () => {
  for (const [genre, bars] of CASES) {
    const song = engine.generateNew(options(genre, bars));
    const before = evaluateMelodySectionMemory(song);
    const weak = before.weakestSection ?? {};
    const beforeCandidates = createMelodySectionDevelopmentCandidates(song);
    const repaired = applyMelodySectionDevelopmentRefinement(
      song,
      { melodySectionDevelopmentRefinement: true },
      engine.evaluateSongCandidate,
      engine.evaluateSongReleaseGate,
    );
    const after = evaluateMelodySectionMemory(repaired.song);
    const afterWeak = after.weakestSection ?? {};
    const afterCandidates = createMelodySectionDevelopmentCandidates(repaired.song);

    console.log("MEMORY_DIAGNOSTIC", JSON.stringify({
      label: `${genre}/${bars}`,
      before: {
        reason: before.reason,
        score: before.score,
        weakest: weak,
        sourceNotes: sectionNotes(song, weak.sourceSectionId),
        targetNotes: sectionNotes(song, weak.sectionId),
        candidates: beforeCandidates.map((candidate) => ({
          id: candidate.id,
          authorityPhase: candidate.authorityPhase,
          changedNotes: candidate.changedNotes,
          memoryScoreDelta: candidate.memoryScoreDelta,
          sectionScoreDelta: candidate.sectionScoreDelta,
          afterWeakest: candidate.afterReport?.weakestSection ?? null,
          critic: critic(candidate.song),
        })),
      },
      repair: repaired.diagnostics,
      after: {
        reason: after.reason,
        score: after.score,
        weakest: afterWeak,
        sourceNotes: sectionNotes(repaired.song, afterWeak.sourceSectionId),
        targetNotes: sectionNotes(repaired.song, afterWeak.sectionId),
        candidates: afterCandidates.map((candidate) => ({
          id: candidate.id,
          authorityPhase: candidate.authorityPhase,
          changedNotes: candidate.changedNotes,
          memoryScoreDelta: candidate.memoryScoreDelta,
          sectionScoreDelta: candidate.sectionScoreDelta,
          afterWeakest: candidate.afterReport?.weakestSection ?? null,
          critic: critic(candidate.song),
        })),
      },
    }));
  }
});
