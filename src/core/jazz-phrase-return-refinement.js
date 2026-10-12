import { cloneValue } from "./clone-value.js";
import { normalizeGenreId } from "./genre-contract.js";
import { evaluateCrossAuthorityCoherence } from "./cross-authority-coherence.js";

// Jazz phrase recall transfers a short, relative cymbal accent *contour*
// between related sections. It never copies source notes, alters onsets, adds
// hits, changes kit voices, or shifts the kick/snare/ride timing foundation.
// Off by default after the previous Jazz-memory playback rollback.
const CYMBALS = new Set([42, 44, 46, 51, 53, 59]);
const MAX_ACCENT_EDITS = 4;
const MAX_CANDIDATES = 3;
const MAX_VELOCITY_DELTA = 8;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, places = 4) => Number(finite(value).toFixed(places));
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const avg = (array) => array.length ? array.reduce((sum, value) => sum + value, 0) / array.length : 0;
const jazz = (song) => normalizeGenreId(song?.genre ?? song?.meta?.genre) === "jazz";
const drumNotes = (song) => song?.tracks?.find((track) => track.id === "drums")?.notes ?? [];
const sectionsOf = (song) => song?.structure ?? song?.sections ?? [];
const sectionStart = (section, beatsPerBar) => finite(section?.startBeat,
  finite(section?.startBar, 0) * beatsPerBar);
const sectionEnd = (section, beatsPerBar) => finite(section?.endBeat,
  sectionStart(section, beatsPerBar) + finite(section?.bars, 0) * beatsPerBar);
const barOf = (note, beatsPerBar) => Math.floor(finite(note?.start) / beatsPerBar);
const local = (note, bar, beatsPerBar) => finite(note.start) - bar * beatsPerBar;

function protectedEvent(note) {
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
function barProtected(song, bar, beatsPerBar, all) {
  const bars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  if (bar <= 0 || bar >= bars - 1) return true;
  if (all.some((note) => barOf(note, beatsPerBar) === bar && protectedEvent(note))) return true;
  return sectionsOf(song).some((section) => {
    const first = Math.floor(sectionStart(section, beatsPerBar) / beatsPerBar + 1e-6);
    const last = Math.max(first,
      Math.ceil(sectionEnd(section, beatsPerBar) / beatsPerBar - 1e-6) - 1);
    return bar === first || bar === last;
  });
}
function mappedSections(song) {
  const sections = sectionsOf(song);
  const byId = new Map(sections.map((s) => [String(s.id), s]));
  const mapped = (song?.memoryMap ?? []).filter((item) =>
    ["return", "recall"].includes(String(item?.relationship)))
    .map((item) => ({
      source: byId.get(String(item.originSectionId)),
      target: byId.get(String(item.sectionId)),
    })).filter(({ source, target }) => source && target && source !== target);
  if (mapped.length) return mapped;
  const first = new Map(), pairs = [];
  for (const section of sections) {
    const label = String(section?.name ?? section?.type ?? section?.id ?? "")
      .toLowerCase().replace(/[^a-z]/g, "");
    if (!label) continue;
    if (first.has(label)) pairs.push({ source: first.get(label), target: section });
    else first.set(label, section);
  }
  return pairs;
}
function barsWithin(section, beatsPerBar) {
  const first = Math.floor(sectionStart(section, beatsPerBar) / beatsPerBar + 1e-6);
  const last = Math.ceil(sectionEnd(section, beatsPerBar) / beatsPerBar - 1e-6) - 1;
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => first + i);
}
function matchedCymbals(sourceNotes, targetNotes, sourceBar, targetBar, beatsPerBar, from) {
  const bounds = (note, bar) => {
    const at = local(note, bar, beatsPerBar);
    return at >= from - 1e-6 && at < from + 2 - 1e-6;
  };
  const sources = sourceNotes.map((note, index) => ({ note, index }))
    .filter(({ note }) => CYMBALS.has(Number(note.pitch)) && !protectedEvent(note)
      && bounds(note, sourceBar));
  const targets = targetNotes.map((note, index) => ({ note, index }))
    .filter(({ note }) => CYMBALS.has(Number(note.pitch)) && !protectedEvent(note)
      && bounds(note, targetBar));
  const pairs = [], used = new Set();
  for (const target of targets) {
    const best = sources.map((source) => ({
      source, distance: Math.abs(
        local(source.note, sourceBar, beatsPerBar)
        - local(target.note, targetBar, beatsPerBar),
      ),
    })).filter(({ source, distance }) => !used.has(source.index) && distance <= 0.115)
      .sort((a, b) => a.distance - b.distance || a.source.index - b.source.index)[0];
    if (best) {
      pairs.push({ source: best.source.note, target: target.note, targetIndex: target.index });
      used.add(best.source.index);
    }
  }
  return pairs;
}
function contourError(pairs, targetVelocities) {
  const source = pairs.map(({ source }) => finite(source.velocity, 80));
  const sourceMean = avg(source), targetMean = avg(targetVelocities);
  return avg(source.map((velocity, i) =>
    Math.abs((velocity - sourceMean) - (targetVelocities[i] - targetMean))));
}
function proposeContour(pairs) {
  if (pairs.length < 3 || pairs.length > MAX_ACCENT_EDITS) return null;
  const source = pairs.map(({ source }) => finite(source.velocity, 80));
  const original = pairs.map(({ target }) => Math.round(finite(target.velocity, 80)));
  const sourceMean = avg(source);
  if (Math.max(...source) - Math.min(...source) < 7) return null;
  const targetMean = avg(original);
  const beforeError = contourError(pairs, original);
  if (beforeError < 3) return null;
  const proposed = original.map((old, i) => {
    const contourGoal = targetMean + (source[i] - sourceMean) * 0.8;
    const newVelocity = Math.round(old + (contourGoal - old) * 0.72);
    return clamp(newVelocity, Math.max(30, old - MAX_VELOCITY_DELTA),
      Math.min(112, old + MAX_VELOCITY_DELTA));
  });
  const changed = proposed.filter((value, index) => value !== original[index]).length;
  if (changed < 2) return null;
  const afterError = contourError(pairs, proposed);
  const benefit = beforeError - afterError;
  const meanShift = Math.abs(avg(proposed) - targetMean);
  if (benefit < 1.25 || meanShift > 2.5) return null;
  return { proposed, changed, beforeError, afterError, benefit, meanShift };
}

export const JAZZ_PHRASE_RETURN_LIMITS = Object.freeze({
  candidateLimit: MAX_CANDIDATES,
  maxAccentEdits: MAX_ACCENT_EDITS,
  maxVelocityDelta: MAX_VELOCITY_DELTA,
  phraseBeats: 2,
});

export function createJazzPhraseReturnCandidates(song) {
  if (!jazz(song)) return [];
  const all = drumNotes(song);
  const beatsPerBar = finite(song?.meta?.beatsPerBar, 4);
  if (!all.length || beatsPerBar !== 4) return [];
  const collected = [];
  for (const { source, target } of mappedSections(song)) {
    const fromBars = barsWithin(source, beatsPerBar).filter((bar) =>
      !barProtected(song, bar, beatsPerBar, all));
    const toBars = barsWithin(target, beatsPerBar).filter((bar) =>
      !barProtected(song, bar, beatsPerBar, all));
    for (const targetBar of toBars) {
      const targetNotes = all.filter((note) => barOf(note, beatsPerBar) === targetBar);
      for (const sourceBar of fromBars) {
        if (sourceBar >= targetBar - 1) continue;
        const sourceNotes = all.filter((note) => barOf(note, beatsPerBar) === sourceBar);
        for (const phraseStart of [0, 1, 2]) {
          const pairs = matchedCymbals(
            sourceNotes, targetNotes, sourceBar, targetBar, beatsPerBar, phraseStart,
          );
          const proposal = proposeContour(pairs);
          if (!proposal) continue;
          const selected = new Map();
          pairs.forEach(({ targetIndex }, i) => {
            if (proposal.proposed[i] !== Math.round(finite(targetNotes[targetIndex]?.velocity, 80))) {
              selected.set(targetNotes[targetIndex], proposal.proposed[i]);
            }
          });
          if (selected.size < 2 || selected.size > MAX_ACCENT_EDITS) continue;
          const candidateSong = cloneValue(song);
          const drum = candidateSong.tracks.find((track) => track.id === "drums");
          // Keep the original array/order and every onset/pitch/duration/role.
          for (let i = 0; i < all.length; i += 1) {
            const velocity = selected.get(all[i]);
            if (velocity != null) drum.notes[i].velocity = velocity;
          }
          collected.push({
            id: `jazz-phrase-return:${sourceBar}->${targetBar}:${phraseStart}`,
            song: candidateSong, sourceBar, targetBar, phraseStart,
            changedNotes: selected.size,
            beforeContourError: round(proposal.beforeError),
            afterContourError: round(proposal.afterError),
            contourImprovement: round(proposal.benefit),
            meanVelocityShift: round(proposal.meanShift),
          });
        }
      }
    }
  }
  collected.sort((a, b) =>
    b.contourImprovement - a.contourImprovement || a.changedNotes - b.changedNotes
    || a.targetBar - b.targetBar || a.sourceBar - b.sourceBar
    || a.phraseStart - b.phraseStart);
  // No stateful RNG and no source performance/MIDI data is copied into output.
  return collected.slice(0, MAX_CANDIDATES);
}

const diagnostics = (reason, fields = {}) => Object.freeze({
  attempted: false, accepted: false, changed: false,
  candidateLimit: MAX_CANDIDATES, candidatesEvaluated: 0, reason, ...fields,
});
const criticFloor = (evaluation) => Math.min(
  ...Object.values(evaluation?.subscores ?? {}).map((score) => finite(score, 0)),
);
function assessCandidate(candidate, baseline, scoreBefore, coherenceBefore, evaluate, releaseGate) {
  const after = evaluate(candidate.song);
  const release = releaseGate(candidate.song, after);
  const coherenceAfter = evaluateCrossAuthorityCoherence(candidate.song);
  const dimensions = Object.fromEntries(Object.keys(baseline?.subscores ?? {}).map((key) => [
    key, round(finite(after?.subscores?.[key]) - finite(baseline?.subscores?.[key])),
  ]));
  const criticSafe = Object.values(dimensions).every((value) => value >= -1e-9)
    && finite(after?.score) >= scoreBefore - 1e-9
    && criticFloor(after) >= criticFloor(baseline) - 1e-9;
  const introducedIssues = (coherenceAfter?.issues ?? []).filter(
    (issue) => !(coherenceBefore?.issues ?? []).includes(issue));
  const coherenceSafe = introducedIssues.length === 0
    && finite(coherenceAfter?.score) >= finite(coherenceBefore?.score)
    && finite(coherenceAfter?.grooveLock?.timingViolations)
      <= finite(coherenceBefore?.grooveLock?.timingViolations)
    && finite(coherenceAfter?.grooveLock?.protectedSpaceViolations)
      <= finite(coherenceBefore?.grooveLock?.protectedSpaceViolations);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const accepted = Boolean(
    release?.passed && criticSafe && coherenceSafe && scaleSafe
    && candidate.contourImprovement >= 1.25 && candidate.meanVelocityShift <= 2.5,
  );
  return {
    ...candidate, accepted, after, release, criticSafe, coherenceSafe, scaleSafe, dimensions,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : !coherenceSafe ? "groove-or-coherence-regression"
          : !criticSafe ? "critic-regression"
            : accepted ? "phrase-contour-return" : "insufficient-phrase-identity",
  };
}

export function applyJazzPhraseReturnRefinement(song, config = {}, evaluate, releaseGate) {
  if (config.jazzPhraseReturnRefinement !== true) {
    return { song, diagnostics: diagnostics("disabled") };
  }
  if (!jazz(song)) return { song, diagnostics: diagnostics("jazz-only") };
  if (typeof evaluate !== "function" || typeof releaseGate !== "function") {
    throw new TypeError("Jazz phrase return requires the existing critic and release evaluators");
  }
  const candidates = createJazzPhraseReturnCandidates(song);
  if (!candidates.length) return {
    song, diagnostics: diagnostics("no-safe-related-phrase-match"),
  };
  const before = evaluate(song), scoreBefore = finite(before?.score);
  const coherenceBefore = evaluateCrossAuthorityCoherence(song);
  const evaluations = candidates.map((candidate) =>
    assessCandidate(candidate, before, scoreBefore, coherenceBefore, evaluate, releaseGate));
  const accepted = evaluations.find((item) => item.accepted);
  const selected = accepted ?? evaluations[0];
  const report = Object.freeze({
    attempted: true, accepted: Boolean(accepted), changed: Boolean(accepted),
    reason: selected.reason, candidatesEvaluated: evaluations.length,
    candidateLimit: MAX_CANDIDATES,
    candidateIds: evaluations.map((entry) => entry.id),
    selectedId: selected.id, sourceBar: selected.sourceBar, targetBar: selected.targetBar,
    phraseStart: selected.phraseStart,
    changedNotes: selected.changedNotes,
    beforeContourError: selected.beforeContourError,
    afterContourError: selected.afterContourError,
    contourImprovement: selected.contourImprovement,
    meanVelocityShift: selected.meanVelocityShift,
    beforeScore: finite(before?.score), afterScore: finite(selected.after?.score),
    protectedDeltas: selected.dimensions,
    scaleSafe: selected.scaleSafe, coherenceSafe: selected.coherenceSafe,
    candidates: evaluations.map((entry) => ({
      id: entry.id, reason: entry.reason, accepted: entry.accepted,
      changeCount: entry.changedNotes, contourImprovement: entry.contourImprovement,
    })),
  });
  if (!accepted) return { song, diagnostics: report };
  accepted.song.outputQualityEvolution = {
    ...(accepted.song.outputQualityEvolution ?? {}),
    jazzPhraseReturnRefinement: {
      accepted: true, sourceBar: accepted.sourceBar, targetBar: accepted.targetBar,
      contourImprovement: accepted.contourImprovement,
    },
  };
  return { song: accepted.song, diagnostics: report };
}
