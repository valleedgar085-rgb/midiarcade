import { cloneValue } from "./clone-value.js";
import { evaluateChorusHookRecurrence } from "./chorus-hook-recurrence.js";
import { rolePreferredRegisterWindow } from "./role-register-policy.js";

export const MAX_CHORUS_HOOK_CANDIDATES = 3;

const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const pitchClass = (p) => ((Math.round(p) % 12) + 12) % 12;
const round = (v) => Math.round(finite(v) * 1000) / 1000;
const PROTECTED_ROLES = new Set([
  "motif-core", "memory-landing", "cadential-landing", "motif-recall-anchor",
]);

function melodicTrack(song) {
  return (song?.tracks ?? []).find((track) => track?.id === "melody") ?? null;
}

function sectionById(song, id) {
  return (song?.structure ?? song?.sections ?? []).find((s) => String(s?.id) === String(id));
}

function sectionStart(song, section) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  return finite(section?.startBeat, finite(section?.startBar) * beatsPerBar);
}

function notesAtOpening(song, sectionId, windowBars) {
  const track = melodicTrack(song);
  const section = sectionById(song, sectionId);
  if (!track || !section) return [];
  const start = sectionStart(song, section);
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  return (track.notes ?? []).map((note, index) => ({ note, index }))
    .filter(({ note }) => finite(note.start, -1) >= start - 1e-6
      && finite(note.start, -1) < start + windowBars * beatsPerBar - 1e-6)
    .sort((a, b) => finite(a.note.start) - finite(b.note.start) ||
      finite(a.note.pitch) - finite(b.note.pitch))
    .slice(0, 12);
}

function pitchChoices(song, original, desired) {
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const intervals = song?.meta?.scaleIntervals;
  const keyPc = Number(song?.meta?.keyPc);
  // Without authoritative pitch-class metadata, no note can be verified safe.
  if (!Number.isFinite(keyPc) || !Array.isArray(intervals) || !intervals.length) return [];
  const scale = new Set(intervals.map((step) => pitchClass(keyPc + finite(step))));
  const nearby = [];
  for (let pitch = Math.max(window.min, Math.round(original) - 5);
    pitch <= Math.min(window.max, Math.round(original) + 5); pitch += 1) {
    if (pitch !== Math.round(original) && scale.has(pitchClass(pitch))) nearby.push(pitch);
  }
  return nearby.sort((a, b) =>
    Math.abs(a - desired) - Math.abs(b - desired)
    || Math.abs(a - original) - Math.abs(b - original)
    || a - b).slice(0, 4);
}

function protectedNote(note) {
  return Boolean(note?.ensembleCadenceRole
    || note?.transitionHandoffRole
    || note?.motifHandoffRole
    || note?.finalAssemblyRole
    || note?.motifMemoryCore
    || PROTECTED_ROLES.has(String(note?.phraseIntentRole))
    || PROTECTED_ROLES.has(String(note?.sectionDevelopmentRole))
    || note?.phraseRole === "turnaround");
}

function metricFor(report, sectionId) {
  return report?.comparisons?.find((c) => c.available && String(c.sectionId) === String(sectionId)) ?? null;
}

function feasibleMove(song, source, target, position) {
  if (position === 0 || position >= target.length - 1 || position >= source.length) return [];
  const entry = target[position];
  const previous = target[position - 1]?.note;
  const sourceCurrent = source[position]?.note;
  const sourcePrevious = source[position - 1]?.note;
  if (!entry?.note || !previous || !sourceCurrent || !sourcePrevious) return [];
  if (protectedNote(entry.note) || finite(entry.note.duration, 0.25) >= 0.65) return [];
  const sourceInterval = finite(sourceCurrent.pitch) - finite(sourcePrevious.pitch);
  if (Math.abs(sourceInterval) > 12) return [];
  const desired = Math.round(finite(previous.pitch) + sourceInterval);
  const current = Math.round(finite(entry.note.pitch));
  if (Math.abs(current - desired) < 1) return [];
  return pitchChoices(song, current, desired);
}

/**
 * Optional, candidate-only repair. No source MIDI timing, drum/bass/chord
 * changes, random draws, new notes, or exported MIDI changes until an explicit
 * caller selects a candidate. Excludes verses and sparse choruses, where
 * hallucinating filler notes would destroy intentional vocal space.
 */
export function createChorusHookDevelopmentCandidates(song, {
  maxCandidates = MAX_CHORUS_HOOK_CANDIDATES,
} = {}) {
  const genre = String(song?.meta?.genre ?? song?.genre ?? "");
  if (!["hipHop", "rap", "pop"].includes(genre)) return [];
  const limit = Math.max(0, Math.min(MAX_CHORUS_HOOK_CANDIDATES, Math.floor(finite(maxCandidates, MAX_CHORUS_HOOK_CANDIDATES))));
  if (!limit) return [];

  const before = evaluateChorusHookRecurrence(song);
  if (before.status !== "evaluated" || before.score === null || before.score >= 66) return [];
  const weakest = [...before.comparisons].filter((c) => c.available && c.score < 0.66)
    .sort((a, b) => a.score - b.score || a.sectionId.localeCompare(b.sectionId))[0];
  if (!weakest) return [];
  const source = notesAtOpening(song, weakest.sourceSectionId, weakest.windowBars);
  const target = notesAtOpening(song, weakest.sectionId, weakest.windowBars);
  if (source.length < 4 || target.length < 4) return [];

  const proposals = [];
  const seen = new Set();
  for (let i = 1; i < Math.min(source.length, target.length) - 1; i += 1) {
    for (const proposedPitch of feasibleMove(song, source, target, i)) {
      const candidateSong = cloneValue(song);
      const note = melodicTrack(candidateSong)?.notes?.[target[i].index];
      if (!note) continue;
      note.pitch = proposedPitch;
      note.hookDevelopmentRole = "motif-contour-return";
      const after = evaluateChorusHookRecurrence(candidateSong);
      const targetScore = metricFor(after, weakest.sectionId)?.score;
      if (!Number.isFinite(targetScore)) continue;
      const scoreDelta = round(targetScore - weakest.score);
      if (scoreDelta < 0.035 || after.score < before.score) continue;
      const signature = JSON.stringify(melodicTrack(candidateSong)?.notes?.map((n) =>
        [n.start, n.pitch, n.duration, n.velocity]));
      if (seen.has(signature)) continue;
      seen.add(signature);
      proposals.push({
        id: "restore-hook-contour-" + i + "-" + proposedPitch,
        song: candidateSong,
        targetSectionId: weakest.sectionId,
        sourceSectionId: weakest.sourceSectionId,
        changedNotes: 1,
        changedPitch: proposedPitch,
        originalPitch: Math.round(finite(target[i].note.pitch)),
        beforeScore: before.score,
        afterScore: after.score,
        localScoreDelta: scoreDelta,
        afterReport: after,
      });
    }
  }

  return proposals.sort((a, b) =>
    b.localScoreDelta - a.localScoreDelta
    || b.afterScore - a.afterScore
    || Math.abs(a.changedPitch - a.originalPitch) - Math.abs(b.changedPitch - b.originalPitch)
    || a.id.localeCompare(b.id)).slice(0, limit);
}
