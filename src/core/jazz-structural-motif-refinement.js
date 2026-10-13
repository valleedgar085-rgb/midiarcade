import { cloneValue } from "./clone-value.js";
import { normalizeGenreId } from "./genre-contract.js";
import { evaluateCrossAuthorityCoherence } from "./cross-authority-coherence.js";
import { analyzeJazzDrumExpression } from "./jazz-drum-expression.js";

// One-note Jazz ornament repair: borrow a rhythmic *relationship*, not a
// bar, MIDI note, sound sample, or performance. Groove Conductor timekeepers,
// kick/snare accents, and the existing user-approved Jazz default are sacred.
const CYMBALS = new Set([42, 44, 46, 51, 53, 59]);
const MAX_CANDIDATES = 4;
const MAX_MOVED_NOTES = 1;
const MAX_SHIFT_BEATS = 0.28;
const QUANTIZATION = 12; // 1/12 beat: captures swing triplets without jitter
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, places = 6) => Number(finite(value).toFixed(places));
const quant = (value) => Math.round(value * QUANTIZATION) / QUANTIZATION;
const jazz = (song) => normalizeGenreId(song?.genre ?? song?.meta?.genre) === "jazz";
const beatInBar = (beat, beatsPerBar) => ((beat % beatsPerBar) + beatsPerBar) % beatsPerBar;
const barIndex = (beat, beatsPerBar) => Math.floor((beat + 1e-8) / beatsPerBar);
const drumNotes = (song) => (song?.tracks ?? []).find((track) => track.id === "drums")?.notes ?? [];
const sectionStart = (section, beatsPerBar) => finite(section?.startBeat,
  finite(section?.startBar, 0) * beatsPerBar);
const sectionEnd = (section, beatsPerBar) => finite(section?.endBeat,
  sectionStart(section, beatsPerBar) + finite(section?.bars, 0) * beatsPerBar);
function isProtected(note) {
  const feature = String(note?.rhythmicFeature ?? "");
  return Boolean(
    note?.drumFillId || note?.transitionFeature || note?.transitionHandoffRole
    || note?.transitionHandoffId || note?.ensembleAccent || note?.phraseAnchor
    || note?.resolutionRole || note?.memoryRole || note?.motifHandoffRole
    || note?.finalAssemblyRole || note?.jazzMemoryPocketRecall
    || note?.jazzMemoryColorRecall || note?.jazzMemoryGlobalRecall
    || feature.includes("fill") || feature.includes("roll")
  );
}
function protectedBar(song, bar, beatsPerBar, notes) {
  const total = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  if (bar <= 0 || bar >= total - 1) return true;
  const barNotes = notes.filter((note) => barIndex(finite(note.start), beatsPerBar) === bar);
  // A fill or transition protects the whole bar. Ordinary phrase/memory notes
  // are individually protected, not grounds to suppress all Jazz candidates.
  if (barNotes.some((note) => note?.drumFillId || note?.transitionFeature
    || note?.transitionHandoffRole || note?.transitionHandoffId
    || String(note?.rhythmicFeature ?? "").includes("fill")
    || String(note?.rhythmicFeature ?? "").includes("roll"))) return true;
  return (song?.structure ?? song?.sections ?? []).some((section) => {
    const first = Math.floor(sectionStart(section, beatsPerBar) / beatsPerBar + 1e-6);
    const last = Math.max(first,
      Math.ceil(sectionEnd(section, beatsPerBar) / beatsPerBar - 1e-6) - 1);
    return bar === first || bar === last;
  });
}
function relatedSectionPairs(song) {
  const sections = song?.structure ?? song?.sections ?? [];
  const byId = new Map(sections.map((section) => [String(section?.id), section]));
  const mapped = (song?.memoryMap ?? []).filter((entry) =>
    ["return", "recall"].includes(String(entry?.relationship)))
    .map((entry) => ({
      source: byId.get(String(entry.originSectionId)),
      target: byId.get(String(entry.sectionId)),
    }))
    .filter(({ source, target }) => source && target && source !== target);
  if (mapped.length) return mapped;
  const seen = new Map(), fallback = [];
  for (const section of sections) {
    const role = String(section?.name ?? section?.type ?? section?.id ?? "")
      .toLowerCase().replace(/[^a-z]/g, "");
    if (!role) continue;
    if (seen.has(role)) fallback.push({ source: seen.get(role), target: section });
    else seen.set(role, section);
  }
  return fallback;
}
function barsWithin(section, beatsPerBar) {
  const first = Math.floor(sectionStart(section, beatsPerBar) / beatsPerBar + 1e-6);
  const last = Math.ceil(sectionEnd(section, beatsPerBar) / beatsPerBar - 1e-6) - 1;
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => first + i);
}
function ornament(note, bar, beatsPerBar, phraseStart) {
  if (!CYMBALS.has(Number(note?.pitch)) || isProtected(note)) return false;
  const local = finite(note.start) - bar * beatsPerBar;
  if (local < phraseStart + 1e-6 || local >= phraseStart + 2 - 1e-6) return false;
  // Ride quarter notes form the clock; never move a timekeeper/anchor beat.
  return Math.abs(local - Math.round(local)) > 0.14;
}
function matches(source, target, sourceBar, targetBar, beatsPerBar, phraseStart) {
  const left = source.filter((note) => ornament(note, sourceBar, beatsPerBar, phraseStart));
  const right = target.filter((note) => ornament(note, targetBar, beatsPerBar, phraseStart));
  const used = new Set();
  let total = 0;
  for (const note of left) {
    const sig = quant(beatInBar(finite(note.start), beatsPerBar));
    const index = right.findIndex((candidate, i) =>
      !used.has(i) && Number(candidate.pitch) === Number(note.pitch)
      && Math.abs(quant(beatInBar(finite(candidate.start), beatsPerBar)) - sig) < 1e-6);
    if (index >= 0) {
      used.add(index);
      total += 1;
    }
  }
  return { total, sourceCount: left.length, targetCount: right.length };
}

/**
 * Returns up to four one-note options. Existing offbeat cymbal subnotes in a
 * returning phrase are aligned to an earlier phrase's rhythmic position.
 * Preserve the target's own timing jitter and its exact velocity/duration.
 * Never align a quarter-note ride, cross a chord/section edge, or create
 * closely-spaced same-voice cymbal collisions.
 */
export function createJazzStructuralMotifCandidates(song) {
  if (!jazz(song) || finite(song?.meta?.beatsPerBar, 4) !== 4) return [];
  const all = drumNotes(song);
  if (!all.length) return [];
  const beatsPerBar = 4, candidates = [];
  const perBar = new Map();
  const allBars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  for (let bar = 0; bar < allBars; bar += 1) {
    perBar.set(bar, all.filter((note) => barIndex(finite(note.start), beatsPerBar) === bar));
  }
  const seen = new Set();
  for (const { source, target } of relatedSectionPairs(song)) {
    const sources = barsWithin(source, beatsPerBar)
      .filter((bar) => !protectedBar(song, bar, beatsPerBar, all));
    const targets = barsWithin(target, beatsPerBar)
      .filter((bar) => !protectedBar(song, bar, beatsPerBar, all));
    for (const targetBar of targets) {
      const targetNotes = perBar.get(targetBar) ?? [];
      for (const sourceBar of sources) {
        if (sourceBar >= targetBar - 1) continue;
        const sourceNotes = perBar.get(sourceBar) ?? [];
        for (const phraseStart of [0, 2]) {
          const old = matches(sourceNotes, targetNotes, sourceBar, targetBar, beatsPerBar, phraseStart);
          if (old.sourceCount < 2 || old.targetCount < 2 || old.total < 1
            || old.total === old.sourceCount) continue;

          const sourceOrnaments = sourceNotes.filter((note) =>
            ornament(note, sourceBar, beatsPerBar, phraseStart));
          const targetOrnaments = targetNotes.filter((note) =>
            ornament(note, targetBar, beatsPerBar, phraseStart));
          for (const origin of sourceOrnaments) {
            const originPosition = beatInBar(finite(origin.start), beatsPerBar);
            for (const targetNote of targetOrnaments) {
              if (Number(origin.pitch) !== Number(targetNote.pitch)) continue;
              const targetPosition = beatInBar(finite(targetNote.start), beatsPerBar);
              const originalCell = quant(targetPosition);
              const sourceCell = quant(originPosition);
              if (Math.abs(originalCell - sourceCell) < 1e-6) continue;
              const residual = targetPosition - originalCell;
              const proposedLocal = sourceCell + residual;
              if (proposedLocal <= phraseStart + 1e-6
                || proposedLocal >= phraseStart + 2 - 1e-6
                || Math.abs(proposedLocal - Math.round(proposedLocal)) <= 0.14) continue;
              const shift = proposedLocal - targetPosition;
              if (Math.abs(shift) > MAX_SHIFT_BEATS + 1e-8) continue;
              const revisedStart = round(targetBar * beatsPerBar + proposedLocal);
              if (targetNotes.some((note) => note !== targetNote
                && Number(note.pitch) === Number(targetNote.pitch)
                && Math.abs(finite(note.start) - revisedStart) < 0.145)) continue;

              const replacement = { ...targetNote, start: revisedStart };
              const newTarget = targetNotes.map((note) =>
                note === targetNote ? replacement : note);
              const next = matches(sourceNotes, newTarget,
                sourceBar, targetBar, beatsPerBar, phraseStart);
              if (next.total <= old.total || next.total < 2) continue;

              const key = [sourceBar, targetBar, phraseStart,
                round(finite(targetNote.start)), revisedStart, Number(targetNote.pitch)].join(":");
              if (seen.has(key)) continue;
              seen.add(key);
              const candidate = cloneValue(song);
              const index = all.indexOf(targetNote);
              candidate.tracks.find((track) => track.id === "drums").notes[index].start = revisedStart;
              candidates.push({
                id: `jazz-motif-echo:${sourceBar}->${targetBar}:${phraseStart}:${index}`,
                song: candidate, sourceBar, targetBar, phraseStart,
                sourceRhythmHits: old.sourceCount, targetRhythmHits: old.targetCount,
                beforeMatches: old.total, afterMatches: next.total,
                motifGain: next.total - old.total,
                changedNotes: 1, shiftBeats: round(shift),
                positionBefore: round(finite(targetNote.start)),
                positionAfter: revisedStart,
              });
            }
          }
        }
      }
    }
  }
  candidates.sort((a, b) =>
    b.motifGain - a.motifGain
    || a.changedNotes - b.changedNotes
    || Math.abs(a.shiftBeats) - Math.abs(b.shiftBeats)
    || a.targetBar - b.targetBar || a.sourceBar - b.sourceBar
    || a.phraseStart - b.phraseStart || a.positionBefore - b.positionBefore);
  return candidates.slice(0, MAX_CANDIDATES);
}

export const JAZZ_STRUCTURAL_MOTIF_LIMITS = Object.freeze({
  candidateLimit: MAX_CANDIDATES,
  maxMovedNotes: MAX_MOVED_NOTES,
  maxShiftBeats: MAX_SHIFT_BEATS,
  phraseBeats: 2,
});
const denied = (reason, fields = {}) => Object.freeze({
  attempted: false, accepted: false, changed: false, reason,
  candidateLimit: MAX_CANDIDATES, candidatesEvaluated: 0, ...fields,
});
const criticFloor = (result) => Math.min(...Object.values(result?.subscores ?? {}).map((v) => finite(v)));
export function applyJazzStructuralMotifRefinement(song, config = {}, evaluate, releaseGate) {
  if (config.jazzStructuralMotifRefinement !== true) return {
    song, diagnostics: denied("disabled"),
  };
  if (!jazz(song)) return { song, diagnostics: denied("jazz-only") };
  if (typeof evaluate !== "function" || typeof releaseGate !== "function") {
    throw new TypeError("Jazz motif return requires the existing critic and release evaluators");
  }
  const candidates = createJazzStructuralMotifCandidates(song);
  if (!candidates.length) return {
    song, diagnostics: denied("no-safe-structural-echo"),
  };
  const before = evaluate(song);
  const coherenceBefore = evaluateCrossAuthorityCoherence(song);
  const drumBefore = analyzeJazzDrumExpression(song);
  const assessed = candidates.map((candidate) => {
    const after = evaluate(candidate.song);
    const release = releaseGate(candidate.song, after);
    const coherenceAfter = evaluateCrossAuthorityCoherence(candidate.song);
    const drumAfter = analyzeJazzDrumExpression(candidate.song);
    const protectedDeltas = Object.fromEntries(Object.keys(before?.subscores ?? {}).map((key) =>
      [key, finite(after?.subscores?.[key]) - finite(before?.subscores?.[key])]));
    const criticSafe = Object.values(protectedDeltas).every((v) => v >= -1e-9)
      && finite(after?.score) >= finite(before?.score) - 1e-9
      && criticFloor(after) >= criticFloor(before) - 1e-9;
    const newIssues = (coherenceAfter?.issues ?? []).filter((issue) =>
      !(coherenceBefore?.issues ?? []).includes(issue));
    const coherenceSafe = newIssues.length === 0
      && finite(coherenceAfter?.score) >= finite(coherenceBefore?.score)
      && finite(coherenceAfter?.grooveLock?.timingViolations)
        <= finite(coherenceBefore?.grooveLock?.timingViolations)
      && finite(coherenceAfter?.grooveLock?.protectedSpaceViolations)
        <= finite(coherenceBefore?.grooveLock?.protectedSpaceViolations);
    const bassRideSafe = drumAfter.bassCymbalCoincidence + 1e-9 >= drumBefore.bassCymbalCoincidence;
    const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
    const accepted = Boolean(release?.passed && criticSafe && coherenceSafe
      && bassRideSafe && scaleSafe && candidate.motifGain >= 1);
    return {
      ...candidate, after, accepted, criticSafe, coherenceSafe, bassRideSafe,
      scaleSafe, protectedDeltas,
      reason: !release?.passed ? "release-gate"
        : !scaleSafe ? "scale-safety"
          : !coherenceSafe ? "groove-authority-regression"
            : !bassRideSafe ? "bass-ride-interlock-regression"
              : !criticSafe ? "critic-regression"
                : accepted ? "bounded-structural-echo" : "no-structural-gain",
    };
  });
  const winner = assessed.find((item) => item.accepted);
  const selected = winner ?? assessed[0];
  const report = Object.freeze({
    attempted: true, accepted: Boolean(winner), changed: Boolean(winner),
    reason: selected.reason, selectedId: selected.id,
    candidatesEvaluated: assessed.length, candidateLimit: MAX_CANDIDATES,
    candidateIds: assessed.map((item) => item.id),
    sourceBar: selected.sourceBar, targetBar: selected.targetBar,
    phraseStart: selected.phraseStart, changedNotes: selected.changedNotes,
    shiftBeats: selected.shiftBeats, beforeMatches: selected.beforeMatches,
    afterMatches: selected.afterMatches, motifGain: selected.motifGain,
    beforeScore: finite(before?.score), afterScore: finite(selected.after?.score),
    scaleSafe: selected.scaleSafe, coherenceSafe: selected.coherenceSafe,
    bassRideSafe: selected.bassRideSafe, protectedDeltas: selected.protectedDeltas,
    candidates: assessed.map((item) => ({
      id: item.id, accepted: item.accepted, reason: item.reason,
      motifGain: item.motifGain, shiftBeats: item.shiftBeats,
    })),
  });
  if (!winner) return { song, diagnostics: report };
  winner.song.outputQualityEvolution = {
    ...(winner.song.outputQualityEvolution ?? {}),
    jazzStructuralMotifRefinement: {
      accepted: true, motifGain: winner.motifGain,
      movedNotes: winner.changedNotes,
    },
  };
  return { song: winner.song, diagnostics: report };
}
