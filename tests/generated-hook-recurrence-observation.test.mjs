import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "../src/music-engine.js";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";
import { createChorusHookDevelopmentCandidates, createChorusHookRhythmCandidates } from "../src/core/chorus-hook-development.js";

const STYLES = ["pop", "hipHop", "rap"];

/**
 * Observation-only baseline for Phase 4. These are real deterministic songs,
 * not synthetic "perfect-hook" fixtures. A low score is a finding, not a
 * reason to silently alter MIDI or block releases during calibration.
 */
test("real generated pop/hip-hop/rap songs produce deterministic read-only hook audits", { timeout: 120_000 }, () => {
  for (const genre of STYLES) {
    for (const variation of [0, 1, 2]) {
    const config = {
      seed: "phase4-hook-audit-" + genre + "-32" + (variation ? "-v" + variation : ""),
      genre,
      key: "E",
      scale: "minor",
      bars: 32,
      energy: 0.64,
      complexity: 0.58,
      variation: 0.62,
      swing: 0.14,
      humanize: 0.10,
    };
    const song = engine.generateNew(config);
    const notes = song.tracks.find((track) => track.id === "melody")?.notes ?? [];
    const before = JSON.stringify(notes);
    const report = evaluateChorusHookRecurrence(song);
    const candidateSummaries = createChorusHookDevelopmentCandidates(song).map((candidate) => ({
      id: candidate.id, localScoreDelta: candidate.localScoreDelta,
      beforeScore: candidate.beforeScore, afterScore: candidate.afterScore,
      changedNotes: candidate.changedNotes,
    }));
    const rhythmCandidateSummaries = createChorusHookRhythmCandidates(song).map((candidate) => ({
      id: candidate.id, localScoreDelta: candidate.localScoreDelta,
      rhythmGain: candidate.rhythmGain, shiftBeats: candidate.shiftBeats,
      beforeScore: candidate.beforeScore, afterScore: candidate.afterScore,
    }));
    assert.equal(JSON.stringify(notes), before, genre + ": audit/proposals changed actual MIDI notes");
    assert.deepEqual(report, evaluateChorusHookRecurrence(song));
    assert.equal(report.mode, "read-only");
    assert.ok(["unavailable", "incomplete", "evaluated"].includes(report.status));
    assert.ok(report.score === null || (report.score >= 0 && report.score <= 100));
    if (genre === "rap" && report.score !== null && report.score < 66) {
      const comparisons = report.comparisons.map((pair) => {
        const sections = song.structure ?? song.sections ?? [];
        const a = sections.find((section) => String(section.id) === String(pair.sourceSectionId));
        const b = sections.find((section) => String(section.id) === String(pair.sectionId));
        const beatsPerBar = Number(song.meta?.beatsPerBar ?? 4);
        function opening(section) {
          const start = Number(section?.startBeat ?? Number(section?.startBar ?? 0) * beatsPerBar);
          const end = start + pair.windowBars * beatsPerBar;
          const values = notes.filter((note) => note.start >= start && note.start < end)
            .sort((left, right) => left.start - right.start || left.pitch - right.pitch)
            .slice(0, 12).map((note) => ({
              at: Math.round((note.start - start) * 1000) / 1000,
              duration: note.duration,
              pitch: note.pitch,
              protected: Boolean(note.motifMemoryCore || note.ensembleCadenceRole
                || note.transitionHandoffRole || note.motifHandoffRole || note.finalAssemblyRole),
            }));
          return {
            start, notes: values,
            leadPulses: (song.grooveConductor?.bars ?? [])
              .filter((bar) => bar.bar >= Math.floor(start / beatsPerBar)
                && bar.bar < Math.ceil(end / beatsPerBar))
              .map((bar) => ({ bar: bar.bar, pulses: bar.leadPulses })),
          };
        }
        return { score: pair.score, rhythm: pair.rhythm,
          contour: pair.contour, source: opening(a), returning: opening(b) };
      });
      console.log("PHASE4_WEAK_RAP_PHRASES", JSON.stringify({ seed: config.seed, comparisons }));
    }
    console.log("PHASE4_HOOK_BASELINE", JSON.stringify({
      genre,
      seed: config.seed,
      status: report.status,
      score: report.score,
      reason: report.reason,
      candidateSummaries,
      rhythmCandidateSummaries,
      chorusesCompared: report.comparisons.length,
      returns: report.comparisons.map((comparison) => ({
        sectionId: comparison.sectionId,
        windowBars: comparison.windowBars,
        score: comparison.score,
        contour: comparison.contour,
        rhythm: comparison.rhythm,
        interval: comparison.interval,
        duration: comparison.duration,
        noteCoverage: comparison.noteCoverage,
        literalRepeat: comparison.literalRepeat,
      })),
      verseRest: report.verses.map((verse) => ({
        sectionId: verse.sectionId,
        notesPerBar: verse.notesPerBar,
        leadRestFraction: verse.leadRestFraction,
      })),
    }));
    }
  }
});
