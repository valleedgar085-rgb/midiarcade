import { cloneValue } from "./clone-value.js";
import { evaluateChorusHookRecurrence } from "./chorus-hook-recurrence.js";
import { rolePreferredRegisterWindow } from "./role-register-policy.js";
import { trackGroovePulses } from "./groove-contract.js";

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


const RHYTHM_GRID_BEATS = 0.125;
const MAX_RHYTHM_SHIFT_BEATS = 0.375;
const MIN_RHYTHM_CHANGE_BEATS = 0.09;
const NOTE_SEPARATION_BEATS = 0.015;

function nearSubdivision(beat) {
  return Math.round(beat / RHYTHM_GRID_BEATS) * RHYTHM_GRID_BEATS;
}

function noteEnd(note) {
  return finite(note?.start) + Math.max(0.05, finite(note?.duration, 0.25));
}

function overlapsMelody(track, noteIndex, movedStart, duration) {
  const end = movedStart + duration;
  return (track?.notes ?? []).some((other, index) => {
    if (index === noteIndex) return false;
    const otherStart = finite(other?.start, Infinity);
    if (!Number.isFinite(otherStart)) return false;
    const otherEnd = noteEnd(other);
    return movedStart < otherEnd + NOTE_SEPARATION_BEATS
      && end + NOTE_SEPARATION_BEATS > otherStart;
  });
}

/**
 * A narrow, opt-in rhythmic alternative to the pitch-only hook candidate.
 * Only an existing, unprotected short note inside the later chorus can move.
 * At most one note moves by <= 3/8 beat, to a 1/8-beat subdivision, without
 * overlap or changes to its pitch, duration, velocity, or any other track.
 *
 * This is a PROPOSAL ONLY; normal song generation never calls this helper.
 */
export function createChorusHookRhythmCandidates(song, {
  maxCandidates = MAX_CHORUS_HOOK_CANDIDATES,
} = {}) {
  const genre = String(song?.meta?.genre ?? song?.genre ?? "");
  if (!["pop", "hipHop", "rap"].includes(genre)) return [];
  const limit = Math.max(0, Math.min(MAX_CHORUS_HOOK_CANDIDATES,
    Math.floor(finite(maxCandidates, MAX_CHORUS_HOOK_CANDIDATES))));
  if (!limit) return [];
  const before = evaluateChorusHookRecurrence(song);
  if (before.status !== "evaluated" || !Number.isFinite(before.score) || before.score >= 66) return [];

  const weakest = [...before.comparisons]
    .filter((comparison) => comparison.available && comparison.score < 0.66
      && comparison.rhythm < 0.92)
    .sort((a, b) => a.score - b.score || a.sectionId.localeCompare(b.sectionId))[0];
  if (!weakest) return [];

  const sourceSection = sectionById(song, weakest.sourceSectionId);
  const targetSection = sectionById(song, weakest.sectionId);
  if (!sourceSection || !targetSection) return [];
  const source = notesAtOpening(song, weakest.sourceSectionId, weakest.windowBars);
  const target = notesAtOpening(song, weakest.sectionId, weakest.windowBars);
  if (source.length < 4 || target.length < 4) return [];

  const track = melodicTrack(song);
  const start = sectionStart(song, targetSection);
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const end = Math.min(
    finite(targetSection.endBeat, start + finite(targetSection.bars, 4) * beatsPerBar),
    start + weakest.windowBars * beatsPerBar,
  );
  const sourceStart = sectionStart(song, sourceSection);
  const conductorPulses = trackGroovePulses(
    song?.grooveConductor, "melody", start, end, beatsPerBar,
  );
  const proposals = [];
  const seen = new Set();

  for (let index = 1; index < Math.min(source.length, target.length) - 1; index += 1) {
    const entry = target[index];
    const currentNote = entry?.note;
    if (!currentNote || protectedNote(currentNote)
      || finite(currentNote.duration, 0.25) >= 0.65) continue;

    const previous = target[index - 1]?.note;
    const following = target[index + 1]?.note;
    if (!previous || !following) continue;
    const originalStart = finite(currentNote.start);
    const duration = Math.max(0.05, finite(currentNote.duration, 0.25));
    const previousSource = source[index - 1]?.note;
    const currentSource = source[index]?.note;
    const nextSource = source[index + 1]?.note;
    if (!previousSource || !currentSource || !nextSource) continue;
    const earlierSpacing = finite(currentSource.start) - finite(previousSource.start);
    const laterSpacing = finite(nextSource.start) - finite(currentSource.start);
    const expectedRelative = start + finite(currentSource.start) - sourceStart;
    const possibleBeats = [
      finite(previous.start) + earlierSpacing,
      finite(following.start) - laterSpacing,
      expectedRelative,
      originalStart - 0.25,
      originalStart - 0.125,
      originalStart + 0.125,
      originalStart + 0.25,
    ].map(nearSubdivision);

    const originalPulseDistance = conductorPulses.length
      ? Math.min(...conductorPulses.map((pulse) => Math.abs(originalStart - pulse)))
      : null;

    for (const beat of possibleBeats) {
      if (seen.has(index + ":" + beat)) continue;
      seen.add(index + ":" + beat);
      const shift = Math.abs(beat - originalStart);
      if (shift < MIN_RHYTHM_CHANGE_BEATS || shift > MAX_RHYTHM_SHIFT_BEATS + 1e-7) continue;
      if (beat < start + 1e-6 || beat + duration > end - 0.01) continue;
      if (beat < finite(previous.start) + Math.max(0.05, finite(previous.duration, 0.25))
          + NOTE_SEPARATION_BEATS) continue;
      if (beat + duration + NOTE_SEPARATION_BEATS > finite(following.start)) continue;
      if (overlapsMelody(track, entry.index, beat, duration)) continue;

      if (conductorPulses.length) {
        const pulseDistance = Math.min(...conductorPulses.map((pulse) => Math.abs(beat - pulse)));
        // Never make a groove-lane alignment worse for a stronger numeric hook score.
        if (pulseDistance > 0.135 || pulseDistance > originalPulseDistance + 0.025) continue;
      }
      const candidateSong = cloneValue(song);
      const changedNote = melodicTrack(candidateSong)?.notes?.[entry.index];
      if (!changedNote) continue;
      changedNote.start = round(beat);
      changedNote.hookDevelopmentRole = "motif-rhythm-return";
      const after = evaluateChorusHookRecurrence(candidateSong);
      const compared = metricFor(after, weakest.sectionId);
      if (!compared) continue;
      const rhythmGain = round(compared.rhythm - weakest.rhythm);
      const localScoreDelta = round(compared.score - weakest.score);
      if (rhythmGain < 0.045 || localScoreDelta < 0.018
        || after.score < before.score || compared.contour < weakest.contour - 0.001
        || compared.noteCoverage < weakest.noteCoverage - 0.001) continue;

      proposals.push(Object.freeze({
        id: "restore-hook-rhythm-" + index + "-" + round(beat),
        song: candidateSong,
        sourceSectionId: weakest.sourceSectionId,
        targetSectionId: weakest.sectionId,
        changedNotes: 1,
        originalStart: round(originalStart),
        changedStart: round(beat),
        shiftBeats: round(beat - originalStart),
        beforeScore: before.score,
        afterScore: after.score,
        rhythmGain,
        localScoreDelta,
        afterReport: after,
      }));
    }
  }

  return proposals.sort((a, b) =>
    b.localScoreDelta - a.localScoreDelta
    || b.rhythmGain - a.rhythmGain
    || Math.abs(a.shiftBeats) - Math.abs(b.shiftBeats)
    || a.id.localeCompare(b.id)
  ).slice(0, limit);
}
