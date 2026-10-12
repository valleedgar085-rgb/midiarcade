import { normalizeGenreId } from "./genre-contract.js";
import { evaluateCrossAuthorityCoherence } from "./cross-authority-coherence.js";
import { proposeCounterpointResponses } from "./counterpoint-response-proposal.js";

// A bounded, opt-in ensemble repair. The critic and release gate, not this
// heuristic, own acceptance. The committed song is never mutated on rejection.
export const MAX_COUNTERPOINT_RESPONSE_CANDIDATES = 4;
const MAX_MOVED_NOTES_PER_CANDIDATE = 4;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value) => Math.round((value + Number.EPSILON) * 10000) / 10000;
const floor = (evaluation) => {
  const scores = Object.values(evaluation?.subscores ?? {}).filter((value) => Number.isFinite(Number(value)));
  return scores.length ? Math.min(...scores.map(Number)) : 0;
};
const skipped = (reason, extra = {}) => Object.freeze({
  attempted: false, accepted: false, changed: false, reason,
  candidateLimit: MAX_COUNTERPOINT_RESPONSE_CANDIDATES, candidatesEvaluated: 0,
  ...extra,
});

function sectionBounds(song, section) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
  const end = finite(section?.endBeat, start + Math.max(1, finite(section?.bars, 1)) * beatsPerBar);
  return { start, end };
}

function conflictCount(melody, answers) {
  // Exactly mirror the critic: one onset penalty and one dissonance penalty
  // per counterpoint note, not one penalty per overlapping lead note.
  return answers.reduce((count, note) => {
    const onset = melody.some((lead) => Math.abs(finite(lead.start) - finite(note.start)) < 0.12);
    const dissonance = melody.some((lead) => {
      const overlapping = finite(note.start) < finite(lead.start) + finite(lead.duration, 0.25)
        && finite(lead.start) < finite(note.start) + finite(note.duration, 0.25);
      const interval = Math.abs(Math.round(finite(note.pitch)) - Math.round(finite(lead.pitch))) % 12;
      return overlapping && [0, 1, 6, 11].includes(interval);
    });
    return count + Number(onset) + Number(dissonance);
  }, 0);
}

function preservesHarmonyWindow(song, before, after) {
  if (before.start === after.start) return true;
  const timeline = [...(song?.harmony ?? [])].sort((a, b) => finite(a?.start) - finite(b?.start));
  const chordIndexAt = (beat) => timeline.reduce((index, chord, current) =>
    finite(chord?.start) <= beat + 1e-6 ? current : index, -1);
  if (chordIndexAt(finite(before.start)) !== chordIndexAt(finite(after.start))) return false;
  // Do not move a support note across a new chord downbeat. A note already
  // crossing a change cannot acquire an additional crossing either.
  return !(song?.harmony ?? []).some((chord) => {
    const boundary = finite(chord?.start, NaN);
    const oldEnd = finite(before.start) + finite(before.duration, 0.25);
    const newEnd = finite(after.start) + finite(after.duration, 0.25);
    return Number.isFinite(boundary)
      && boundary > finite(before.start) + 1e-6
      && boundary < newEnd - 1e-6
      && boundary >= oldEnd - 1e-6;
  });
}

export function createCounterpointResponseCandidates(song) {
  const melody = song?.tracks?.find((track) => track.id === "melody")?.notes ?? [];
  const counterTrack = song?.tracks?.find((track) => track.id === "counterpoint");
  const answers = counterTrack?.notes ?? [];
  if (!melody.length || !answers.length) return [];

  const sections = (song?.structure ?? []).map((section) => {
    const bounds = sectionBounds(song, section);
    const lead = melody.filter((note) => finite(note.start) < bounds.end - 1e-6
      && finite(note.start) + finite(note.duration, 0.25) > bounds.start + 1e-6);
    const indexed = answers.map((note, index) => ({ note, index })).filter(({ note }) =>
      finite(note.start) >= bounds.start - 1e-6 && finite(note.start) < bounds.end - 1e-6);
    return { id: String(section?.id ?? ""), bounds, lead, indexed,
      conflicts: conflictCount(lead, indexed.map(({ note }) => note)) };
  }).filter((section) => section.conflicts > 0 && section.lead.length && section.indexed.length)
    .sort((a, b) => b.conflicts - a.conflicts || a.bounds.start - b.bounds.start);
  if (!sections.length) return [];

  const results = [];
  // If the weakest section has no safe move, try the next weakest rather
  // than incorrectly concluding that the entire song is unrepairable.
  for (const section of sections.slice(0, 3)) {
    for (const maxShiftBeats of [0.5, 1]) {
      const proposal = proposeCounterpointResponses(
        section.lead, section.indexed.map(({ note }) => note),
        {
          maxShiftBeats, stepBeats: 0.125,
          sectionStartBeat: section.bounds.start,
          sectionEndBeat: section.bounds.end,
        },
      );
      const changedIndices = [];
      const replacements = new Map();
      proposal.proposals.forEach((entry, index) => {
        if (changedIndices.length >= MAX_MOVED_NOTES_PER_CANDIDATE || !entry.changed) return;
        if (!preservesHarmonyWindow(song, entry.original, entry.proposed)) return;
        const originalIndex = section.indexed[index].index;
        changedIndices.push(originalIndex);
        replacements.set(originalIndex, entry.proposed);
      });
      if (!changedIndices.length) continue;
      const changedNotes = answers.map((note, index) => replacements.get(index) ?? { ...note })
        .sort((a, b) => finite(a.start) - finite(b.start) || finite(a.pitch) - finite(b.pitch));
      const sectionAnswers = changedNotes.filter((note) => finite(note.start) >= section.bounds.start
        && finite(note.start) < section.bounds.end);
      const afterConflicts = conflictCount(section.lead, sectionAnswers);
      if (afterConflicts >= section.conflicts) continue;
      results.push({
        id: `counterpoint-response:${section.id}:${maxShiftBeats}`,
        sectionId: section.id,
        maxShiftBeats,
        changedNotes: changedIndices.length,
        beforeConflicts: section.conflicts,
        afterConflicts,
        song: {
          ...song,
          tracks: song.tracks.map((track) => track.id === "counterpoint"
            ? { ...track, notes: changedNotes }
            : track),
        },
      });
      if (results.length >= MAX_COUNTERPOINT_RESPONSE_CANDIDATES) return results;
    }
  }
  return results.slice(0, MAX_COUNTERPOINT_RESPONSE_CANDIDATES);
}

export function applyCounterpointResponseRefinement(song, config = {}, evaluateCandidate, evaluateReleaseGate) {
  if (config.counterpointResponseRefinement !== true) return {
    song, diagnostics: skipped("disabled"),
  };
  if (normalizeGenreId(song?.genre ?? song?.meta?.genre ?? config?.genre) !== "rnbSoul") {
    return { song, diagnostics: skipped("genre-not-targeted") };
  }
  if (typeof evaluateCandidate !== "function" || typeof evaluateReleaseGate !== "function") {
    throw new TypeError("counterpoint response requires the existing critic and release evaluators");
  }

  const before = evaluateCandidate(song);
  const beforeSeparation = finite(before?.subscores?.separation);
  if (beforeSeparation >= 72) return {
    song, diagnostics: skipped("separation-already-safe", { beforeSeparation }),
  };
  const candidates = createCounterpointResponseCandidates(song);
  if (!candidates.length) return {
    song, diagnostics: skipped("no-safe-response-window", { beforeSeparation }),
  };
  const beforeFloor = floor(before);
  const beforeCoherence = evaluateCrossAuthorityCoherence(song);
  const assessments = candidates.map((candidate) => {
    const after = evaluateCandidate(candidate.song);
    const release = evaluateReleaseGate(candidate.song, after);
    const afterCoherence = evaluateCrossAuthorityCoherence(candidate.song);
    const separationDelta = finite(after?.subscores?.separation) - beforeSeparation;
    const scoreDelta = finite(after?.score) - finite(before?.score);
    const floorDelta = floor(after) - beforeFloor;
    const protectedDeltas = Object.fromEntries(Object.keys(before?.subscores ?? {})
      .filter((key) => key !== "separation")
      .map((key) => [key, finite(after?.subscores?.[key]) - finite(before?.subscores?.[key])]));
    const protectedSafe = Object.values(protectedDeltas).every((delta) => delta >= -1e-9);
    const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
    const grooveSafe = !beforeCoherence?.checks?.grooveTimingStable
      || afterCoherence?.checks?.grooveTimingStable === true;
    const negativeSpaceSafe = !beforeCoherence?.checks?.protectedNegativeSpace
      || afterCoherence?.checks?.protectedNegativeSpace === true;
    const coherenceSafe = (!beforeCoherence?.passed || afterCoherence?.passed)
      && grooveSafe && negativeSpaceSafe;
    const accepted = Boolean(
      release?.passed && scaleSafe && coherenceSafe && protectedSafe
      && candidate.afterConflicts < candidate.beforeConflicts
      && separationDelta >= 1 && scoreDelta >= -1e-9 && floorDelta >= -1e-9
    );
    return {
      ...candidate, accepted, after, release, scoreDelta, floorDelta, separationDelta,
      protectedDeltas, protectedSafe, scaleSafe, coherenceSafe,
      reason: !release?.passed ? "release-gate"
        : !scaleSafe ? "scale-safety"
          : !coherenceSafe ? "coherence-or-groove-violation"
            : !protectedSafe ? "protected-dimension-regression"
              : candidate.afterConflicts >= candidate.beforeConflicts ? "no-collision-improvement"
                : separationDelta < 1 ? "separation-not-improved"
                  : scoreDelta < -1e-9 || floorDelta < -1e-9 ? "overall-quality-regression"
                    : "accepted-separation-win",
    };
  });
  const sorted = [...assessments].sort((a, b) => (
    Number(b.accepted) - Number(a.accepted)
    || b.separationDelta - a.separationDelta
    || b.scoreDelta - a.scoreDelta
    || a.changedNotes - b.changedNotes
    || a.maxShiftBeats - b.maxShiftBeats
  ));
  const selected = sorted[0];
  const diagnostics = Object.freeze({
    attempted: true, accepted: selected.accepted,
    changed: selected.accepted, reason: selected.reason,
    candidateLimit: MAX_COUNTERPOINT_RESPONSE_CANDIDATES,
    candidatesEvaluated: assessments.length,
    candidateIds: assessments.map((item) => item.id),
    selectedId: selected.id, sectionId: selected.sectionId,
    changedNotes: selected.changedNotes, maxShiftBeats: selected.maxShiftBeats,
    beforeSeparation, afterSeparation: finite(selected.after?.subscores?.separation),
    separationDelta: selected.separationDelta,
    beforeScore: round(finite(before?.score)), afterScore: round(finite(selected.after?.score)),
    scoreDelta: round(selected.scoreDelta), floorDelta: round(selected.floorDelta),
    protectedSafe: selected.protectedSafe,
    scaleSafe: selected.scaleSafe, coherenceSafe: selected.coherenceSafe,
    candidates: assessments.map((entry) => ({
      id: entry.id, reason: entry.reason, accepted: entry.accepted,
      changedNotes: entry.changedNotes, separationDelta: entry.separationDelta,
      scoreDelta: round(entry.scoreDelta), floorDelta: round(entry.floorDelta),
    })),
  });
  if (!selected.accepted) return { song, diagnostics };
  const repaired = selected.song;
  repaired.outputQualityEvolution = {
    ...(repaired.outputQualityEvolution ?? {}),
    counterpointResponseRefinement: {
      accepted: true, changedNotes: diagnostics.changedNotes,
      separationDelta: diagnostics.separationDelta, sectionId: diagnostics.sectionId,
    },
  };
  return { song: repaired, diagnostics };
}
