import { cloneValue } from "./clone-value.js";
import { rolePreferredRegisterWindow } from "./role-register-policy.js";

const GENRES = new Set(["pop", "hipHop", "rap"]);
const PROTECTED_ROLES = new Set(["motif-core", "memory-landing", "cadential-landing", "motif-recall-anchor"]);

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const pc = (pitch) => ((Math.round(pitch) % 12) + 12) % 12;
const melodyTrack = (song) => (song?.tracks ?? []).find((track) => track?.id === "melody") ?? null;

function protectedNote(note) {
  return Boolean(note?.motifMemoryCore || note?.ensembleCadenceRole
    || note?.transitionHandoffRole || note?.motifHandoffRole || note?.finalAssemblyRole
    || note?.phraseRole === "turnaround"
    || PROTECTED_ROLES.has(String(note?.phraseIntentRole))
    || PROTECTED_ROLES.has(String(note?.sectionDevelopmentRole)));
}

function harmonyAt(song, beat) {
  return (song?.harmony ?? []).find((event) => {
    const start = event?.start ?? event?.startBeat;
    const duration = event?.duration ?? event?.durationBeats;
    return finite(start) && finite(duration) && duration > 0
      && beat >= start - 1e-6 && beat < start + duration - 1e-6;
  }) ?? null;
}

/**
 * A melody answer specialist for an explicitly selected four-bar-or-longer
 * chorus. It only corrects an existing final answer pitch when a rising
 * question has an unresolved response. No events are added or retimed.
 *
 * Without authoritative scale and harmony, fail closed rather than guessing
 * a resolution. This is a proposal for Shape's Before/After audition only.
 */
export function createMelodyQuestionAnswerCandidate(song, { sectionId } = {}) {
  const genre = String(song?.meta?.genre ?? song?.genre ?? "");
  if (!GENRES.has(genre) || sectionId == null) return null;

  const section = (song?.structure ?? song?.sections ?? [])
    .find((entry) => String(entry?.id) === String(sectionId));
  const role = String(section?.role ?? section?.name ?? section?.id ?? "").toLowerCase();
  if (!section || !/chorus|hook/.test(role)) return null;

  const beatsPerBar = song?.meta?.beatsPerBar ?? 4;
  if (!finite(beatsPerBar) || beatsPerBar < 1) return null;
  const start = finite(section.startBeat) ? section.startBeat
    : finite(section.startBar) ? section.startBar * beatsPerBar : null;
  const end = finite(section.endBeat) ? section.endBeat
    : start !== null && finite(section.bars) ? start + section.bars * beatsPerBar : null;
  if (start === null || end === null || end - start < beatsPerBar * 4 - 1e-6) return null;

  const keyPc = song?.meta?.keyPc;
  const intervals = song?.meta?.scaleIntervals;
  if (!finite(keyPc) || !Array.isArray(intervals) || !intervals.length
    || !intervals.every(finite)) return null;
  const scale = new Set(intervals.map((offset) => pc(keyPc + offset)));

  const track = melodyTrack(song);
  if (!track || !Array.isArray(track.notes)) return null;
  const midpoint = start + (end - start) / 2;
  const entries = track.notes.map((note, index) => ({ note, index }))
    .filter(({ note }) => finite(note?.start) && finite(note?.pitch)
      && note.start >= start - 1e-6 && note.start < end - 1e-6)
    .sort((a, b) => a.note.start - b.note.start
      || a.note.pitch - b.note.pitch || a.index - b.index);
  const question = entries.filter(({ note }) => note.start < midpoint - 1e-6);
  const answer = entries.filter(({ note }) => note.start >= midpoint - 1e-6);
  if (question.length < 3 || answer.length < 3) return null;

  const askPrev = question.at(-2).note;
  const askLast = question.at(-1).note;
  const rise = askLast.pitch - askPrev.pitch;
  if (rise < 1 || rise > 7 || askLast.start < midpoint - beatsPerBar * 1.5) return null;

  const entry = answer.at(-1);
  const landing = entry.note;
  const prev = answer.at(-2).note;
  if (protectedNote(landing) || landing.start < end - beatsPerBar * 1.5
    || !finite(prev.pitch)) return null;

  const chord = harmonyAt(song, landing.start);
  if (!Array.isArray(chord?.tones) || !chord.tones.length
    || !chord.tones.every(finite)) return null;
  const tones = new Set(chord.tones.map(pc).filter((tone) => scale.has(tone)));
  if (!tones.size) return null;

  const window = rolePreferredRegisterWindow("melody");
  if (!window || landing.pitch < window.min || landing.pitch > window.max) return null;

  const resolved = tones.has(pc(landing.pitch))
    && landing.pitch < prev.pitch && prev.pitch - landing.pitch <= 7;
  if (resolved) return null;

  const choices = [];
  for (let pitch = Math.max(window.min, Math.round(landing.pitch) - 5);
    pitch <= Math.min(window.max, Math.round(landing.pitch) + 5); pitch += 1) {
    if (pitch === Math.round(landing.pitch) || !tones.has(pc(pitch))) continue;
    const interval = prev.pitch - pitch;
    if (interval < 1 || interval > 7) continue;
    if (interval > Math.max(7, Math.abs(prev.pitch - landing.pitch))) continue;
    choices.push(pitch);
  }
  if (!choices.length) return null;
  choices.sort((a, b) => Math.abs(a - landing.pitch) - Math.abs(b - landing.pitch)
    || Math.abs(prev.pitch - a) - Math.abs(prev.pitch - b) || a - b);
  const selectedPitch = choices[0];

  const next = cloneValue(song);
  const edited = melodyTrack(next)?.notes?.[entry.index];
  if (!edited) return null;
  edited.pitch = selectedPitch;
  edited.questionAnswerRole = "answer-landing";

  return Object.freeze({
    id: "answer-landing:" + String(sectionId) + ":" + entry.index + ":" + selectedPitch,
    sectionId: String(sectionId),
    changedNoteIndex: entry.index,
    originalPitch: landing.pitch,
    changedPitch: selectedPitch,
    changedNotes: 1,
    song: next,
  });
}
