import { Note, Scale } from "tonal";
import { GENRE_PROFILES, SCALES, generateNew } from "../src/music-engine.js";

const TONAL_VERSION = "6.4.3";
const ROOTS = Object.freeze(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]);

// Names resolve to Tonal's independent scale catalog. Two MIDI Arcade labels use
// equivalent Tonal catalog names so the pitch-class authority stays independent
// without forcing a public-label migration in this shadow-only phase.
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
  doubleHarmonic: "double harmonic major",
  hirajoshi: "hirajoshi",
  hungarianMinor: "hungarian minor",
  inSen: "in-sen",
  persian: "persian",
  iwato: "iwato",
  majorPentatonic: "major pentatonic",
  minorPentatonic: "minor pentatonic",
  blues: "minor blues",
  pentatonicNeutral: "egyptian",
  egyptianPentatonic: "ritusen",
  bebopMajor: "bebop major",
  bebopDominant: "bebop",
  wholeTone: "whole tone",
  diminishedHalfWhole: "half-whole diminished",
  diminishedWholeHalf: "diminished",
  enigmatic: "enigmatic",
});

function pitchClassFromMidi(pitch) {
  const midi = Math.max(0, Math.min(127, Math.round(Number(pitch))));
  return Note.chroma(Note.fromMidi(midi));
}

function sortedPitchClasses(values) {
  return [...new Set(values.map((value) => ((Number(value) % 12) + 12) % 12))].sort((a, b) => a - b);
}

function tonalScaleFor(key, scaleId) {
  const tonalScaleName = SCALE_NAMES[scaleId];
  if (!tonalScaleName) return null;
  const scale = Scale.get(`${key} ${tonalScaleName}`);
  return scale.empty ? null : scale;
}

function catalogParityReport() {
  const midiArcadeScaleIds = Object.keys(SCALES);
  const mappedScaleIds = Object.keys(SCALE_NAMES);
  const missingMappings = midiArcadeScaleIds.filter((scaleId) => !mappedScaleIds.includes(scaleId));
  const staleMappings = mappedScaleIds.filter((scaleId) => !midiArcadeScaleIds.includes(scaleId));
  const cases = [];
  const mismatches = [];

  for (const scaleId of midiArcadeScaleIds) {
    for (const root of ROOTS) {
      const tonalScale = tonalScaleFor(root, scaleId);
      const rootPc = Note.chroma(root);
      const expected = sortedPitchClasses((SCALES[scaleId] ?? []).map((interval) => rootPc + interval));
      const actual = tonalScale
        ? sortedPitchClasses(tonalScale.notes.map((note) => Note.chroma(note)))
        : [];
      const matches = Boolean(tonalScale) && JSON.stringify(actual) === JSON.stringify(expected);
      const entry = {
        scale: scaleId,
        root,
        tonalScale: tonalScale?.name ?? null,
        expected,
        actual,
        matches,
      };
      cases.push(entry);
      if (!matches) mismatches.push(entry);
    }
  }

  return { cases, missingMappings, staleMappings, mismatches };
}

function inspectSong(song) {
  const scaleId = song?.meta?.scale;
  const scale = tonalScaleFor(song?.meta?.key, scaleId);
  if (!scale) {
    return {
      status: "unsupported-scale",
      genre: song?.genre,
      key: song?.meta?.key,
      scale: scaleId,
      noteViolations: [],
      harmonyViolations: [],
    };
  }

  const allowed = new Set(scale.notes.map((note) => Note.chroma(note)));
  const noteViolations = [];
  const harmonyViolations = [];

  for (const track of song?.tracks ?? []) {
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

  for (const event of song?.harmony ?? []) {
    for (const tone of event.tones ?? []) {
      const pitchClass = pitchClassFromMidi(tone);
      if (!allowed.has(pitchClass)) {
        harmonyViolations.push({
          symbol: event.symbol ?? event.roman ?? "unknown",
          tone,
          note: Note.fromMidi(tone),
          pitchClass,
        });
      }
    }
  }

  const midiArcadeScaleFit = Number(song?.tonalIntegrity?.after?.scaleFit);
  const midiArcadeScaleSafe = song?.meta?.qualityGate?.scaleSafe ?? null;
  const externalViolationCount = noteViolations.length + harmonyViolations.length;
  const authorityDisagreement = (
    midiArcadeScaleFit >= 0.999
    && midiArcadeScaleSafe === true
    && externalViolationCount > 0
  );

  return {
    status: "checked",
    genre: song.genre,
    key: song.meta.key,
    scale: scaleId,
    tonalScale: scale.name,
    noteViolations,
    harmonyViolations,
    midiArcadeScaleFit: Number.isFinite(midiArcadeScaleFit) ? midiArcadeScaleFit : null,
    midiArcadeScaleSafe,
    authorityDisagreement,
  };
}

function generatedCases() {
  const cases = [];
  for (const [genre, profile] of Object.entries(GENRE_PROFILES)) {
    const scales = [...new Set(profile.preferredScales ?? [])];
    for (const scale of scales) {
      cases.push({ genre, scale });
    }
  }
  return cases;
}

const catalog = catalogParityReport();
const reports = [];

for (const spec of generatedCases()) {
  const root = ROOTS[
    Math.abs([...spec.genre, ...spec.scale].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % ROOTS.length
  ];
  const song = generateNew({
    genre: spec.genre,
    key: root,
    scale: spec.scale,
    mode: spec.scale,
    scaleSelection: "explicit",
    seed: `tonal-shadow-${spec.genre}-${spec.scale}`,
    bars: 12,
    professionalUpgrade: true,
    variation: 0.76,
    complexity: 0.72,
    surprise: 0.48,
  });
  reports.push(inspectSong(song));
}

const checked = reports.filter((report) => report.status === "checked");
const unsupported = reports.filter((report) => report.status !== "checked");
const authorityDisagreements = checked.filter((report) => report.authorityDisagreement);
const noteViolationCount = checked.reduce((sum, report) => sum + report.noteViolations.length, 0);
const harmonyViolationCount = checked.reduce((sum, report) => sum + report.harmonyViolations.length, 0);

const summary = {
  checker: `tonal@${TONAL_VERSION}-shadow-authority`,
  mode: "read-only-non-destructive",
  catalog: {
    midiArcadeScales: Object.keys(SCALES).length,
    roots: ROOTS.length,
    cases: catalog.cases.length,
    missingMappings: catalog.missingMappings,
    staleMappings: catalog.staleMappings,
    mismatches: catalog.mismatches.slice(0, 20),
  },
  generated: {
    cases: reports.length,
    checked: checked.length,
    unsupportedScales: unsupported.map(({ genre, key, scale }) => ({ genre, key, scale })),
    noteViolationCount,
    harmonyViolationCount,
    authorityDisagreements: authorityDisagreements.map((report) => ({
      genre: report.genre,
      key: report.key,
      scale: report.scale,
      tonalScale: report.tonalScale,
      noteViolations: report.noteViolations.length,
      harmonyViolations: report.harmonyViolations.length,
    })),
  },
};

console.log(JSON.stringify(summary, null, 2));

if (catalog.missingMappings.length || catalog.staleMappings.length) {
  throw new Error("Tonal shadow scale catalog mapping is incomplete or stale.");
}
if (catalog.mismatches.length) {
  throw new Error(`Tonal shadow catalog found ${catalog.mismatches.length} pitch-class definition mismatch(es).`);
}
if (unsupported.length) {
  throw new Error(`Tonal shadow could not resolve ${unsupported.length} generated scale case(s).`);
}
if (authorityDisagreements.length) {
  throw new Error(`Tonal shadow authority found ${authorityDisagreements.length} disagreement(s) with MIDI Arcade scale safety.`);
}
