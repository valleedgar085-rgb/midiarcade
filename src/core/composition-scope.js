import { cloneValue } from "./clone-value.js";

const EPSILON = 1e-7;

export function startOf(note) {
  return Number(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time ?? 0);
}

export function durationOf(note) {
  return Math.max(0, Number(note?.duration ?? note?.length ?? note?.durationBeats ?? 0));
}

export function endOf(note) {
  return startOf(note) + durationOf(note);
}

export function tracksOf(song) {
  return Array.isArray(song?.tracks) ? song.tracks : [];
}

export function trackId(track) {
  return String(track?.id ?? track?.role ?? track?.name ?? "");
}

export function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function trackShell(track) {
  if (!track || typeof track !== "object") return track;
  const { notes: _notes, ...shell } = track;
  return shell;
}

export function sectionRange(song, sectionId) {
  const sections = song?.structure ?? song?.sections;
  if (!Array.isArray(sections)) return null;
  const section = sections.find((candidate) => String(candidate?.id) === String(sectionId));
  if (!section) return null;
  const beatsPerBar = Math.max(1, Number(song?.meta?.beatsPerBar ?? 4));
  const start = Number.isFinite(Number(section?.startBeat))
    ? Number(section.startBeat)
    : Number(section?.startBar ?? section?.start ?? 0) * beatsPerBar;
  const end = Number.isFinite(Number(section?.endBeat))
    ? Number(section.endBeat)
    : start + Math.max(1, Number(section?.bars ?? 1)) * beatsPerBar;
  return { section, start, end };
}

export function fullyInside(note, range) {
  const start = startOf(note);
  const end = endOf(note);
  return start >= range.start - EPSILON && end <= range.end + EPSILON;
}

export function noteSort(left, right) {
  return startOf(left) - startOf(right)
    || Number(left?.pitch ?? left?.note ?? 0) - Number(right?.pitch ?? right?.note ?? 0);
}

export function replaceSectionNotes(sourceTrack, candidateTrack, range) {
  const sourceNotes = Array.isArray(sourceTrack?.notes) ? sourceTrack.notes : [];
  const candidateNotes = Array.isArray(candidateTrack?.notes) ? candidateTrack.notes : [];
  const preserved = sourceNotes.filter((note) => !fullyInside(note, range)).map(cloneValue);
  const replacement = candidateNotes.filter((note) => fullyInside(note, range)).map(cloneValue);
  return [...preserved, ...replacement].sort(noteSort);
}

export function notesOutsideRange(track, range) {
  return (track?.notes ?? []).filter((note) => !fullyInside(note, range));
}
