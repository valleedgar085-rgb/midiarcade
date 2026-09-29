import { cloneValue } from "./clone-value.js";
import { evaluateMelodyPhraseIntelligence } from "./melody-phrase-intelligence.js";
import { rolePreferredRegisterWindow } from "./role-register-policy.js";

export const MAX_MELODY_PHRASE_CANDIDATES = 3;

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, finite(value, min)));
}
function mod12(value) {
  return ((Math.round(finite(value)) % 12) + 12) % 12;
}
function melodyTrack(song) {
  return (song?.tracks ?? []).find((track) => track?.id === "melody") ?? null;
}
function sections(song) {
  return Array.isArray(song?.structure) ? song.structure : (song?.sections ?? []);
}
function sectionBounds(song, sectionId) {
  const section = sections(song).find((entry) => String(entry?.id) === String(sectionId));
  if (!section) return null;
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = Number.isFinite(Number(section?.startBeat))
    ? Number(section.startBeat)
    : finite(section?.startBar, 0) * beatsPerBar;
  const end = Number.isFinite(Number(section?.endBeat))
    ? Number(section.endBeat)
    : start + Math.max(1, finite(section?.bars, 1)) * beatsPerBar;
  return { section, start, end, beatsPerBar };
}
function notesInSection(song, sectionId) {
  const range = sectionBounds(song, sectionId);
  const track = melodyTrack(song);
  if (!range || !track) return [];
  return (track.notes ?? [])
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => finite(note?.start) >= range.start - 1e-6 && finite(note?.start) < range.end - 1e-6)
    .sort((a, b) => finite(a.note?.start) - finite(b.note?.start) || finite(a.note?.pitch) - finite(b.note?.pitch));
}
function harmonyAt(song, beat) {
  let result = song?.harmony?.[0] ?? null;
  for (const event of song?.harmony ?? []) {
    const start = finite(event?.start ?? event?.startBeat);
    const duration = Math.max(0.01, finite(event?.duration ?? event?.durationBeats, 0.25));
    if (start <= beat + 1e-6) result = event;
    if (beat >= start - 1e-6 && beat < start + duration - 1e-6) return event;
  }
  return result;
}
function chordPitchClasses(event) {
  if (Array.isArray(event?.tones) && event.tones.length) return [...new Set(event.tones.map(mod12))];
  if (Number.isFinite(Number(event?.rootPc))) return [mod12(event.rootPc)];
  return [];
}
function scalePitchClasses(song) {
  const keyPc = Number(song?.meta?.keyPc);
  const intervals = song?.meta?.scaleIntervals;
  if (!Number.isFinite(keyPc) || !Array.isArray(intervals) || !intervals.length) return null;
  return new Set(intervals.map((interval) => mod12(keyPc + Number(interval))));
}
function nearestPitchWithClass(sourcePitch, classes, { min = 48, max = 84 } = {}) {
  if (!classes?.length) return Math.round(clamp(sourcePitch, min, max));
  const source = Math.round(finite(sourcePitch, 60));
  const candidates = [];
  for (let pitch = min; pitch <= max; pitch += 1) {
    if (classes.includes(mod12(pitch))) candidates.push(pitch);
  }
  return candidates.sort((a, b) => Math.abs(a - source) - Math.abs(b - source) || a - b)[0] ?? source;
}
function sectionLandingCandidate(song, sectionId) {
  const entries = notesInSection(song, sectionId);
  if (!entries.length) return null;
  const candidate = cloneValue(song);
  const target = entries.at(-1);
  const note = melodyTrack(candidate)?.notes?.[target.index];
  if (!note) return null;
  const chord = harmonyAt(candidate, finite(note.start));
  let classes = chordPitchClasses(chord);
  const scale = scalePitchClasses(candidate);
  if (scale?.size) classes = classes.filter((pc) => scale.has(pc));
  if (!classes.length && scale?.size) classes = [...scale];
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const beforePitch = Math.round(finite(note.pitch, 60));
  const afterPitch = nearestPitchWithClass(beforePitch, classes, window);
  note.pitch = afterPitch;
  note.duration = round(clamp(finite(note.duration, 0.5) * 1.16, 0.24, 1.5));
  note.velocity = Math.round(clamp(finite(note.velocity, 84) + 5, 1, 120));
  note.phraseIntentRole = "cadential-landing";
  return { id: "cadential-landing", song: candidate, changedNotes: 1 };
}
function repeatedPitchContourCandidate(song, sectionId) {
  const entries = notesInSection(song, sectionId);
  if (entries.length < 3) return null;
  let target = null;
  for (let index = 1; index < entries.length - 1; index += 1) {
    const previous = Math.round(finite(entries[index - 1].note.pitch));
    const current = Math.round(finite(entries[index].note.pitch));
    const next = Math.round(finite(entries[index + 1].note.pitch));
    if (current === previous || current === next) {
      target = entries[index];
      break;
    }
  }
  if (!target) return null;
  const candidate = cloneValue(song);
  const note = melodyTrack(candidate)?.notes?.[target.index];
  if (!note) return null;
  const sourcePitch = Math.round(finite(note.pitch, 60));
  const scale = scalePitchClasses(candidate);
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const allowed = scale?.size ? [...scale] : Array.from({ length: 12 }, (_, index) => index);
  const direction = (target.index + String(sectionId).length) % 2 === 0 ? 1 : -1;
  const options = [];
  for (let delta = 1; delta <= 5; delta += 1) {
    const pitch = sourcePitch + direction * delta;
    if (pitch >= window.min && pitch <= window.max && allowed.includes(mod12(pitch))) options.push(pitch);
  }
  if (!options.length) return null;
  note.pitch = options[0];
  note.duration = round(clamp(finite(note.duration, 0.25) * 0.9, 0.12, 0.8));
  note.velocity = Math.round(clamp(finite(note.velocity, 84) + 3, 1, 120));
  note.phraseIntentRole = "contour-turn";
  return { id: "contour-turn", song: candidate, changedNotes: 1 };
}
function expressiveArcCandidate(song, sectionId) {
  const entries = notesInSection(song, sectionId);
  if (entries.length < 4) return null;
  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  let changed = 0;
  entries.forEach(({ index }, ordinal) => {
    const note = track?.notes?.[index];
    if (!note) return;
    const phase = ordinal / Math.max(1, entries.length - 1);
    const arc = Math.sin(Math.PI * phase);
    const velocityDelta = Math.round(arc * 8 - (phase > 0.82 ? 2 : 0));
    const durationScale = phase > 0.8 ? 1.12 : (ordinal % 2 === 0 ? 0.92 : 1.04);
    const nextVelocity = Math.round(clamp(finite(note.velocity, 84) + velocityDelta, 1, 120));
    const nextDuration = round(clamp(finite(note.duration, 0.25) * durationScale, 0.12, 1.5));
    if (nextVelocity !== note.velocity || Math.abs(nextDuration - finite(note.duration, 0.25)) > 1e-6) changed += 1;
    note.velocity = nextVelocity;
    note.duration = nextDuration;
    note.phraseIntentRole = note.phraseIntentRole ?? "expressive-arc";
  });
  return changed ? { id: "expressive-arc", song: candidate, changedNotes: changed } : null;
}

/**
 * Builds a tiny deterministic candidate set for the weakest melody section.
 * It never changes rhythm-section tracks, note topology, or canonical timing.
 */
export function createMelodyPhraseCandidates(song, {
  maxCandidates = MAX_MELODY_PHRASE_CANDIDATES,
} = {}) {
  const before = evaluateMelodyPhraseIntelligence(song);
  const sectionId = before?.weakestSection?.sectionId;
  if (!sectionId) return [];
  const raw = [
    sectionLandingCandidate(song, sectionId),
    repeatedPitchContourCandidate(song, sectionId),
    expressiveArcCandidate(song, sectionId),
  ].filter(Boolean);
  const seen = new Set();
  return raw.slice(0, Math.max(0, Math.min(MAX_MELODY_PHRASE_CANDIDATES, Math.floor(finite(maxCandidates, MAX_MELODY_PHRASE_CANDIDATES)))))
    .map((candidate, candidateIndex) => {
      const after = evaluateMelodyPhraseIntelligence(candidate.song);
      const signature = JSON.stringify(melodyTrack(candidate.song)?.notes?.map((note) => [
        round(note.start), Math.round(finite(note.pitch)), round(note.duration), Math.round(finite(note.velocity, 84)),
      ]) ?? []);
      if (seen.has(signature)) return null;
      seen.add(signature);
      return {
        ...candidate,
        candidateIndex,
        weakestSectionId: sectionId,
        beforePhraseScore: before.score,
        afterPhraseScore: after.score,
        phraseScoreDelta: after.score - before.score,
        beforeReport: before,
        afterReport: after,
      };
    })
    .filter(Boolean)
    .filter((candidate) => candidate.phraseScoreDelta > 0);
}
