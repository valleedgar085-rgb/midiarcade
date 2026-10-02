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
function protectedPhraseAnchor(note) {
  return Boolean(
    note?.phraseAnchor
    || note?.resolutionRole
    || note?.ensembleCadenceRole
    || note?.transitionRole
    || note?.transitionFeature
    || note?.transitionHandoffRole
    || note?.motifHandoffRole
    || note?.finalAssemblyRole
  );
}
function contourOutlierCandidate(song, sectionId) {
  const entries = notesInSection(song, sectionId);
  if (entries.length < 3) return null;

  let target = null;
  for (let ordinal = 1; ordinal < entries.length - 1; ordinal += 1) {
    const entry = entries[ordinal];
    if (protectedPhraseAnchor(entry.note)) continue;

    const previous = Math.round(finite(entries[ordinal - 1].note.pitch));
    const current = Math.round(finite(entry.note.pitch));
    const next = Math.round(finite(entries[ordinal + 1].note.pitch));
    const left = Math.abs(current - previous);
    const right = Math.abs(next - current);
    const direct = Math.abs(next - previous);
    const isolatedSpike = left >= 7 && right >= 7 && direct <= 5;
    const extremeTurn = Math.max(left, right) > 10 && direct <= 7;
    if (!isolatedSpike && !extremeTurn) continue;

    const severity = left + right - direct * 0.5;
    if (!target || severity > target.severity) target = { entry, ordinal, severity };
  }

  if (!target) return null;
  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  const note = track?.notes?.[target.entry.index];
  const previous = track?.notes?.[entries[target.ordinal - 1].index];
  const next = track?.notes?.[entries[target.ordinal + 1].index];
  if (!note || !previous || !next) return null;

  const sourcePitch = Math.round(finite(note.pitch, 60));
  const previousPitch = Math.round(finite(previous.pitch, sourcePitch));
  const nextPitch = Math.round(finite(next.pitch, sourcePitch));
  const midpoint = (previousPitch + nextPitch) / 2;
  const scale = scalePitchClasses(candidate);
  const chord = harmonyAt(candidate, finite(note.start));
  const chordClasses = chordPitchClasses(chord);
  const strongLanding = finite(note.duration, 0.25) >= 0.65
    || Math.abs(finite(note.start) - Math.round(finite(note.start))) <= 0.08;

  let allowed = strongLanding && chordClasses.length ? chordClasses : (scale?.size ? [...scale] : chordClasses);
  if (scale?.size && allowed.length) allowed = allowed.filter((pitchClass) => scale.has(pitchClass));
  if (!allowed.length && scale?.size) allowed = [...scale];
  if (!allowed.length) allowed = Array.from({ length: 12 }, (_, index) => index);

  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const originalSpan = Math.max(
    Math.abs(sourcePitch - previousPitch),
    Math.abs(nextPitch - sourcePitch),
  );
  const options = [];
  for (let pitch = window.min; pitch <= window.max; pitch += 1) {
    if (pitch === sourcePitch || !allowed.includes(mod12(pitch))) continue;
    const span = Math.max(Math.abs(pitch - previousPitch), Math.abs(nextPitch - pitch));
    if (span >= originalSpan) continue;
    const score = Math.abs(pitch - midpoint) * 2
      + Math.abs(pitch - previousPitch) * 0.35
      + Math.abs(nextPitch - pitch) * 0.35
      + Math.abs(pitch - sourcePitch) * 0.08;
    options.push({ pitch, span, score });
  }
  options.sort((left, right) => left.score - right.score || left.span - right.span || left.pitch - right.pitch);
  const selected = options[0];
  if (!selected) return null;

  note.pitch = selected.pitch;
  const neighborVelocity = Math.round((finite(previous.velocity, 84) + finite(next.velocity, 84)) / 2);
  note.velocity = Math.round(clamp(
    finite(note.velocity, 84) * 0.45 + neighborVelocity * 0.55,
    1,
    120,
  ));
  note.phraseIntentRole = "contour-outlier-repair";
  return { id: "contour-outlier-repair", song: candidate, changedNotes: 1 };
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
    contourOutlierCandidate(song, sectionId),
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
