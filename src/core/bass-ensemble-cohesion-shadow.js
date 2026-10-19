import { cloneValue } from "./clone-value.js";
import { analyzeBassEnsembleCohesion } from "./bass-ensemble-cohesion-audit.js";

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const pc = (pitch) => ((Math.round(pitch) % 12) + 12) % 12;
const track = (song, id) => song?.tracks?.find((entry) => entry.id === id);
const protectedNote = (note) => Boolean(
  note.phraseAnchor || note.motifMemoryCore || note.ensembleCadenceRole ||
  note.motifHandoffRole || note.transitionHandoffRole || note.preserveTiming ||
  note.bassCadenceRole || note.grooveAuthorityLock || note.bassRegisterRole === "upper-harmonic"
);
const activeChord = (song, beat) => (song?.harmony ?? []).find((chord) => {
  const start = finite(chord.start);
  return beat >= start - 1e-6 && beat < start + Math.max(0.05, finite(chord.duration, 0.25)) - 1e-6;
});
const nearestRoot = (pitch, rootPc) => {
  const root = pc(rootPc), current = Math.round(pitch);
  return [root + 24, root + 36, root + 48, root + 60]
    .filter((candidate) => candidate >= 28 && candidate <= 55)
    .sort((a, b) => Math.abs(a - current) - Math.abs(b - current) || a - b)[0] ?? current;
};
function eligible(song, note, beat) {
  if (protectedNote(note) || !Number.isFinite(Number(note.pitch))) return false;
  const section = (song?.structure ?? []).find((entry) => (
    beat >= finite(entry.startBeat, -1) && beat < finite(entry.endBeat, -1)
  ));
  if (!section || !/^(verse|chorus|hook|idea)/i.test(String(section.name ?? section.type ?? ""))) return false;
  const sectionId = String(section.id ?? "");
  if (song?.producerIntent?.scenes?.some((scene) => String(scene.sectionId) === sectionId && scene.roles?.bass === "rest")) return false;
  const presence = song?.orchestrationMatrix?.find((lane) => String(lane.sectionId) === sectionId)?.lanes?.bass?.presence;
  return presence == null || finite(presence, 1) >= 0.42;
}
function candidate(song, profile) {
  const next = cloneValue(song);
  const bass = track(next, "bass")?.notes;
  if (!Array.isArray(bass) || !bass.length) return null;
  const kicks = (track(next, "drums")?.notes ?? [])
    .filter((n) => [35, 36].includes(Math.round(finite(n.pitch, -1))))
    .map((n) => finite(n.start));
  const beatsPerBar = Math.max(1, finite(next?.meta?.beatsPerBar, 4));
  const maxChanges = Math.min(8, Math.max(1, Math.ceil(finite(next?.meta?.bars, 8) / 4)));
  const usedBars = new Set();
  let changes = 0;
  const ordered = bass.map((note, index) => ({ note, index })).sort((a, b) =>
    finite(a.note.start) - finite(b.note.start) || a.index - b.index);
  for (const { note, index } of ordered) {
    if (changes >= maxChanges) break;
    const beat = finite(note.start, -1);
    if (beat < 0 || !eligible(next, note, beat)) continue;
    const bar = Math.floor(beat / beatsPerBar);
    if (usedBars.has(bar)) continue;
    const chord = activeChord(next, beat);
    if (!chord || chord.rootPc == null || !Number.isFinite(Number(chord.rootPc))) continue;
    const root = pc(chord.rootPc);
    const oldPitch = Math.round(finite(note.pitch));
    if (profile === "foundation" || profile === "groove") {
      const isStrong = Math.abs(beat - Math.round(beat)) <= 0.08;
      const nearKick = kicks.some((k) => Math.abs(k - beat) <= 0.1);
      if (profile === "foundation" && !isStrong) continue;
      if (profile === "groove" && !nearKick) continue;
      const desired = nearestRoot(oldPitch, root);
      if (pc(oldPitch) === root || Math.abs(desired - oldPitch) > 5) continue;
      note.pitch = desired;
    } else if (profile === "motif") {
      // Reuse the nearest preceding same-beat-position pitch only if that pitch
      // belongs to the active chord and the edit stays within five semitones.
      const previous = ordered.slice(0, ordered.findIndex((entry) => entry.index === index))
        .map((entry) => entry.note).reverse().find((other) =>
          Math.abs((finite(other.start) % beatsPerBar) - (beat % beatsPerBar)) <= 0.08 &&
          beat - finite(other.start) >= beatsPerBar - 0.1
        );
      if (!previous) continue;
      const targetPitch = Math.round(finite(previous.pitch));
      const classes = chord.pitchClasses ?? chord.chordPitchClasses;
      if (!Array.isArray(classes) || !classes.some((pitch) => pc(pitch) === pc(targetPitch)) ||
        Math.abs(targetPitch - oldPitch) > 5 || targetPitch === oldPitch) continue;
      note.pitch = targetPitch;
    }
    usedBars.add(bar);
    changes++;
  }
  if (!changes) return null;
  return {
    id: `bass-cohesion-${profile}`, song: next, changedNotes: changes,
    before: analyzeBassEnsembleCohesion(song),
    after: analyzeBassEnsembleCohesion(next),
    gate: "shadow-only",
  };
}

/** Exactly the existing three-candidate limit; not wired into normal generation. */
export function createBassEnsembleCohesionCandidates(song, options = {}) {
  if (options.bassEnsembleCohesionShadow !== true || !song ||
    song?.meta?.secondaryGenre || song?.secondaryGenre) return [];
  return ["foundation", "groove", "motif"].map((profile) => candidate(song, profile))
    .filter(Boolean).slice(0, 3);
}
