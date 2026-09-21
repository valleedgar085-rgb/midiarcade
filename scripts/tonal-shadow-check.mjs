import { Chord, Note, Scale } from "tonal";
import { generateNew } from "../src/music-engine.js";

const SCALE_NAMES = Object.freeze({
  major: "major",
  minor: "minor",
  dorian: "dorian",
  phrygian: "phrygian",
  lydian: "lydian",
  mixolydian: "mixolydian",
  locrian: "locrian",
  harmonicMinor: "harmonic minor",
  melodicMinor: "melodic minor",
  harmonicMajor: "harmonic major",
  phrygianDominant: "phrygian dominant",
  lydianDominant: "lydian dominant",
  altered: "altered",
  majorPentatonic: "major pentatonic",
  minorPentatonic: "minor pentatonic",
  blues: "minor blues",
  wholeTone: "whole tone",
});

const CASES = Object.freeze([
  { genre: "trap", key: "A", scale: "harmonicMinor" },
  { genre: "hipHop", key: "A", scale: "minor" },
  { genre: "pop", key: "C", scale: "major" },
  { genre: "neoSoul", key: "D", scale: "dorian" },
  { genre: "jazz", key: "G", scale: "mixolydian" },
  { genre: "afrobeats", key: "E", scale: "minorPentatonic" },
]);

function pitchClassFromMidi(pitch) {
  const noteName = Note.fromMidi(Math.max(0, Math.min(127, Math.round(Number(pitch)))));
  return Note.chroma(noteName);
}

function tonalScaleFor(song) {
  const tonalScaleName = SCALE_NAMES[song?.meta?.scale];
  if (!tonalScaleName) return null;
  const scale = Scale.get(`${song.meta.key} ${tonalScaleName}`);
  return scale.empty ? null : scale;
}

function inspectSong(song) {
  const scale = tonalScaleFor(song);
  if (!scale) {
    return {
      status: "unsupported-scale",
      genre: song.genre,
      key: song.meta.key,
      scale: song.meta.scale,
      noteViolations: [],
      harmonyViolations: [],
    };
  }

  const allowed = new Set(scale.notes.map((note) => Note.chroma(note)));
  const noteViolations = [];
  const harmonyViolations = [];

  for (const track of song.tracks ?? []) {
    if (track.id === "drums") continue;
    for (const note of track.notes ?? []) {
      const pitchClass = pitchClassFromMidi(note.pitch);
      if (!allowed.has(pitchClass)) {
        noteViolations.push({
          track: track.id,
          pitch: note.pitch,
          note: Note.fromMidi(note.pitch),
          start: note.start,
        });
      }
    }
  }

  for (const event of song.harmony ?? []) {
    for (const tone of event.tones ?? []) {
      const pitchClass = pitchClassFromMidi(tone);
      if (!allowed.has(pitchClass)) {
        harmonyViolations.push({
          symbol: event.symbol ?? event.roman ?? "unknown",
          tone,
          pitchClass,
        });
      }
    }

    const chordNames = (event.tones ?? []).length >= 3
      ? Chord.detect((event.tones ?? []).map((tone) => Note.fromMidi(60 + (Number(tone) % 12))))
      : [];
    if (chordNames.length) event.tonalShadowDetectedChord = chordNames[0];
  }

  return {
    status: "checked",
    genre: song.genre,
    key: song.meta.key,
    scale: song.meta.scale,
    tonalScale: scale.name,
    noteViolations,
    harmonyViolations,
    midiArcadeScaleFit: song.tonalIntegrity?.after?.scaleFit ?? null,
    midiArcadeScaleSafe: song.meta?.qualityGate?.scaleSafe ?? null,
  };
}

const reports = [];
for (const spec of CASES) {
  for (const seedIndex of [0, 1]) {
    const song = generateNew({
      ...spec,
      seed: `tonal-shadow-${spec.genre}-${seedIndex}`,
      bars: 16,
      professionalUpgrade: true,
      variation: 0.76,
      complexity: 0.72,
      surprise: 0.48,
    });
    reports.push(inspectSong(song));
  }
}

const checked = reports.filter((report) => report.status === "checked");
const unsupported = reports.filter((report) => report.status !== "checked");
const noteViolations = checked.flatMap((report) => report.noteViolations.map((violation) => ({ ...violation, genre: report.genre })));
const harmonyViolations = checked.flatMap((report) => report.harmonyViolations.map((violation) => ({ ...violation, genre: report.genre })));
const authorityDisagreements = checked.filter((report) => (
  report.midiArcadeScaleFit === 1
  && report.midiArcadeScaleSafe === true
  && (report.noteViolations.length > 0 || report.harmonyViolations.length > 0)
));

console.log(JSON.stringify({
  checker: "tonal@6.4.3-shadow-authority",
  cases: reports.length,
  checked: checked.length,
  unsupportedScales: unsupported.map(({ genre, key, scale }) => ({ genre, key, scale })),
  noteViolations: noteViolations.slice(0, 20),
  harmonyViolations: harmonyViolations.slice(0, 20),
  authorityDisagreements: authorityDisagreements.map((report) => ({
    genre: report.genre,
    key: report.key,
    scale: report.scale,
    tonalScale: report.tonalScale,
    noteViolations: report.noteViolations.length,
    harmonyViolations: report.harmonyViolations.length,
  })),
}, null, 2));

if (unsupported.length) {
  console.warn(`Tonal shadow audit skipped ${unsupported.length} unsupported scale cases.`);
}
if (authorityDisagreements.length) {
  throw new Error(`Tonal shadow authority found ${authorityDisagreements.length} disagreement(s) with MIDI Arcade scale safety.`);
}
