Warning: truncated output (original token count: 146823)
Total output lines: 13412

/**
 * MIDI Arcade music engine.
 *
 * Dependency-free, deterministic (when a seed is supplied), and deliberately
 * independent of any UI framework. Timing values in the JSON song model are
 * expressed in quarter-note beats; MIDI conversion happens only in encodeMidi.
 */

import {
  cadentialHarmonyDegree,
  phraseLandingProfile,
  phraseLandingRole,
} from "./core/phrase-architecture.js";
import {
  createPhraseMemoryContract,
  phraseMemoryForSection,
  phrasePerformanceAdjustment,
  renderPhrasePerformance,
} from "./core/phrase-memory.js";
import {
  createSongDNA as createDeterministicSongDNA,
} from "./core/song-dna.js";
import {
  curateTrackProgramPalette,
  mergeTrackProgramPalettes,
} from "./core/instrument-program-policy.js";
import {
  fusedGenreArrangementProfile,
  genreArrangementProfile,
  legatoIntervalBias,
  layerDensityMode,
  moodFromEnergy,
  pickGenreRhythmTemplate,
  progressionGoalsFor,
} from "./core/genre-arrangement-profile.js";
import { refineTonalIntegrity } from "./core/tonal-integrity.js";
import { canonicalMidiPitch } from "./core/pitch-contract.js";
import { refineRoleRegisters } from "./core/role-register-refinement.js";

export const PPQ = 480;

export const SCALES = deepFreeze({
  // Diatonic & Modes
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],

  // Harmonic & Melodic Variations
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  harmonicMajor: [0, 2, 4, 5, 7, 8, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  lydianDominant: [0, 2, 4, 6, 7, 9, 10],
  altered: [0, 1, 3, 4, 6, 8, 10],

  // Exotic & Regional
  doubleHarmonic: [0, 1, 4, 5, 7, 8, 11],
  hirajoshi: [0, 2, 3, 7, 8],
  hungarianMinor: [0, 2, 3, 6, 7, 8, 11],
  inSen: [0, 1, 5, 7, 10],
  persian: [0, 1, 4, 5, 6, 8, 11],
  iwato: [0, 1, 5, 6, 10],

  // Pentatonic & Blues
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  pentatonicNeutral: [0, 2, 5, 7, 10],
  egyptianPentatonic: [0, 2, 5, 7, 9],

  // Jazz & Synthetic
  bebopMajor: [0, 2, 4, 5, 7, 8, 9, 11],
  bebopDominant: [0, 2, 4, 5, 7, 9, 10, 11],
  wholeTone: [0, 2, 4, 6, 8, 10],
  diminishedHalfWhole: [0, 1, 3, 4, 6, 7, 9, 10],
  diminishedWholeHalf: [0, 2, 3, 5, 6, 8, 9, 11],
  enigmatic: [0, 1, 4, 6, 8, 10, 11],
});

export const TRACK_DEFINITIONS = deepFreeze({
  drums: {
    name: "Drums",
    type: "drums",
    channel: 9,
    program: 0,
    octave: 0,
    density: 0.72,
    variation: 0.58,
    volume: 0.92,
    velocity: 1,
    pan: 0,
    reverb: 0.12,
    cutoff: 8000,
    resonance: 0.2,
    gate: 0.85,
    humanize: 1,
    feel: 1,
  },
  bass: {
    name: "Bass",
    type: "bass",
    channel: 0,
    program: 33,
    octave: 2,
    density: 0.62,
    variation: 0.4,
    volume: 0.88,
    velocity: 0.94,
    pan: -0.08,
    reverb: 0.08,
    cutoff: 8000,
    resonance: 0.2,
    gate: 0.82,
    humanize: 0.8,
    feel: 0.9,
  },
  chords: {
    name: "Chords",
    type: "chords",
    channel: 1,
    program: 4,
    octave: 4,
    density: 0.58,
    variation: 0.38,
    volume: 0.78,
    velocity: 0.82,
    pan: -0.18,
    reverb: 0.3,
    cutoff: 8000,
    resonance: 0.2,
    gate: 0.9,
    humanize: 0.55,
    feel: 0.7,
  },
  melody: {
    name: "Melody",
    type: "melody",
    channel: 2,
    program: 80,
    octave: 5,
    density: 0.64,
    variation: 0.5,
    volume: 0.86,
    velocity: 0.92,
    pan: 0.12,
    reverb: 0.28,
    cutoff: 8000,
    resonance: 0.2,
    gate: 0.88,
    humanize: 0.72,
    feel: 0.62,
  },
  counterpoint: {
    name: "Counterpoint",
    type: "counterpoint",
    channel: 3,
    program: 73,
    octave: 5,
    density: 0.38,
    variation: 0.55,
    volume: 0.66,
    velocity: 0.76,
    pan: 0.32,
    reverb: 0.36,
    cutoff: 8000,
    resonance: 0.2,
    gate: 0.94,
    humanize: 0.58,
    feel: 0.5,
  },
  pad: {
    name: "Pad",
    type: "pad",
    channel: 4,
    program: 89,
    octave: 3,
    density: 0.82,
    variation: 0.28,
    volume: 0.58,
    velocity: 0.68,
    pan: 0.04,
    reverb: 0.58,
    cutoff: 8000,
    resonance: 0.2,
    gate: 1,
    humanize: 0.16,
    feel: 0.1,
  },
});

/** Genre writing ranges and deterministic General MIDI sound palettes. */
export const GENRE_PROFILES = deepFreeze({
  neoSoul: {
    id: "neoSoul", label: "Neo Soul / R&B", bpm: { min: 68, max: 96, default: 84 },
    preferredScales: ["dorian", "minor", "major", "mixolydian"],
    grooveWeights: {
      drumGroove: { backbeat: 4.2, halfTime: 1.4, breakbeat: 0.8, electro: 0.6, fourFloor: 0.15 },
      bassGroove: { syncopated: 3.4, rootFifth: 2, walking: 1.8, pulse: 0.45 },
      chordMotion: { offbeat: 2.8, sustained: 2.2, arpeggio: 1.2, pulse: 0.7 },
    },
    swing: 0.28, syncopation: 0.58, humanize: 0.34, chordExtensions: 0.82, harmonicRhythm: 0.42,
    instrumentPrograms: { drums: [0, 8], bass: [33, 35, 36], chords: [4, 5, 16, 17], melody: [26, 73, 80, 81], counterpoint: [25, 53, 73, 85], pad: [88, 89, 91] },
    tripletChance: 0.16, snareRollChance: 0.12, halfTime: false,
    arrangement: { form: "verse-chorus", chorusLift: 0.18, fillFrequency: 0.32, phraseBars: 4 },
  },
  hipHop: {
    id: "hipHop", label: "Hip-Hop", bpm: { min: 82, max: 108, default: 94 },
    preferredScales: ["minor", "dorian", "minorPentatonic", "majorPentatonic"],
    grooveWeights: {
      drumGroove: { backbeat: 3.5, halfTime: 2.5, breakbeat: 1.7, electro: 0.8, fourFloor: 0.1 },
      bassGroove: { syncopated: 3.2, rootFifth: 2.2, pulse: 1.1, walking: 0.55 },
      chordMotion: { sustained: 2.6, offbeat: 1.7, pulse: 1.1, arpeggio: 0.55 },
    },
    swing: 0.2, syncopation: 0.54, humanize: 0.3, chordExtensions: 0.46, harmonicRhythm: 0.27,
    instrumentPrograms: { drums: [0, 8, 24, 25], bass: [38, 39, 33, 34], chords: [4, 5, 16, 89], melody: [54, 73, 80, 81], counterpoint: [25, 53, 73, 85], pad: [88, 89, 91, 92] },
    tripletChance: 0.38, snareRollChance: 0.24, halfTime: false,
    arrangement: { form: "verse-chorus", chorusLift: 0.14, fillFrequency: 0.4, phraseBars: 4 },
  },
  rap: {
    id: "rap", label: "Rap", bpm: { min: 76, max: 104, default: 90 },
    preferredScales: ["minorPentatonic", "minor", "dorian", "majorPentatonic"],
    grooveWeights: {
      drumGroove: { backbeat: 4.4, breakbeat: 2.2, halfTime: 1.4, electro: 0.45, fourFloor: 0.05 },
      bassGroove: { syncopated: 3.5, rootFifth: 2.8, pulse: 0.75, walking: 0.35 },
      chordMotion: { sustained: 3.1, offbeat: 1.25, pulse: 0.8, arpeggio: 0.35 },
    },
    swing: 0.16, syncopation: 0.6, humanize: 0.27, chordExtensions: 0.34, harmonicRhythm: 0.22,
    instrumentPrograms: { drums: [0, 8, 24, 25], bass: [38, 39, 33, 36], chords: [0, 4, 5, 16], melody: [26, 54, 73, 80], counterpoint: [25, 53, 73, 80], pad: [88, 89, 91, 92] },
    tripletChance: 0.24, snareRollChance: 0.18, halfTime: false,
    arrangement: { form: "verse-chorus", chorusLift: 0.12, fillFrequency: 0.34, phraseBars: 4 },
  },
  trap: {
    id: "trap", label: "Trap", bpm: { min: 130, max: 150, default: 140 },
    preferredScales: ["minor", "harmonicMinor", "phrygian", "minorPentatonic"],
    grooveWeights: {
      drumGroove: { halfTime: 6, backbeat: 1.1, electro: 0.9, breakbeat: 0.45, fourFloor: 0.05 },
      bassGroove: { syncopated: 4.6, rootFifth: 2, pulse: 1.5, walking: 0.1 },
      chordMotion: { sustained: 3.6, arpeggio: 1.8, pulse: 0.8, offbeat: 0.65 },
    },
    swing: 0.06, syncopation: 0.66, humanize: 0.14, chordExtensions: 0.28, harmonicRhythm: 0.2,
    instrumentPrograms: { drums: [25, 24], bass: [38, 39, 33], chords: [0, 4, 48, 89], melody: [80, 81, 82, 85], counterpoint: [48, 73, 80, 85], pad: [88, 89, 90, 92] },
    tripletChance: 0.76, snareRollChance: 0.68, halfTime: true,
    arrangement: { form: "trap-song", chorusLift: 0.22, fillFrequency: 0.72, phraseBars: 4 },
  },
  house: {
    id: "house", label: "House", bpm: { min: 115, max: 130, default: 124 },
    preferredScales: ["minor", "dorian", "major", "mixolydian"],
    grooveWeights: {
      drumGroove: { fourFloor: 7, electro: 1.1, backbeat: 0.65, breakbeat: 0.15, halfTime: 0.05 },
      bassGroove: { pulse: 3.8, syncopated: 2.7, rootFifth: 1.1, walking: 0.35 },
      chordMotion: { offbeat: 4.4, pulse: 2.2, sustained: 0.85, arpeggio: 0.7 },
    },
    swing: 0.08, syncopation: 0.48, humanize: 0.12, chordExtensions: 0.42, harmonicRhythm: 0.5,
    instrumentPrograms: { drums: [24, 25, 16], bass: [38, 39, 33, 36], chords: [4, 5, 16, 17], melody: [81, 82, 85, 86], counterpoint: [80, 81, 84, 85], pad: [89, 90, 95] },
    tripletChance: 0.07, snareRollChance: 0.14, halfTime: false,
    arrangement: { form: "club", chorusLift: 0.2, fillFrequency: 0.38, phraseBars: 8 },
  },
  techno: {
    id: "techno", label: "Techno", bpm: { min: 120, max: 132, default: 126 },
    preferredScales: ["minor", "phrygian", "dorian", "minorPentatonic"],
    grooveWeights: {
      drumGroove: { fourFloor: 7.5, electro: 1.4, breakbeat: 0.3, backbeat: 0.25, halfTime: 0.05 },
      bassGroove: { pulse: 4.5, syncopated: 2.1, rootFifth: 0.8, walking: 0.1 },
      chordMotion: { pulse: 3.4, offbeat: 2.5, arpeggio: 1.8, sustained: 0.65 },
    },
    swing: 0.03, syncopation: 0.36, humanize: 0.07, chordExtensions: 0.2, harmonicRhythm: 0.38,
    instrumentPrograms: { drums: [24, 25, 16], bass: [38, 39, 87], chords: [81, 89, 90, 95], melody: [81, 82, 84, 87], counterpoint: [80, 81, 84, 86], pad: [89, 91, 95, 99] },
    tripletChance: 0.1, snareRollChance: 0.18, halfTime: false,
    arrangement: { form: "rave", chorusLift: 0.22, fillFrequency: 0.42, phraseBars: 8 },
  },
  drumBass: {
    id: "drumBass", label: "Drum & Bass", bpm: { min: 160, max: 180, default: 174 },
    preferredScales: ["minor", "dorian", "phrygian", "minorPentatonic"],
    grooveWeights: {
      drumGroove: { breakbeat: 7, electro: 1.4, backbeat: 0.6, fourFloor: 0.1, halfTime: 0.2 },
      bassGroove: { syncopated: 4.2, pulse: 2.4, rootFifth: 1.3, walking: 0.25 },
      chordMotion: { sustained: 2.2, offbeat: 1.7, arpeggio: 1.5, pulse: 1 },
    },
    swing: 0.04, syncopation: 0.7, humanize: 0.13, chordExtensions: 0.36, harmonicRhythm: 0.32,
    instrumentPrograms: { drums: [0, 8, 16, 24], bass: [38, 39, 87, 88], chords: [4, 5, 89, 90], melody: [80, 81, 84, 85], counterpoint: [48, 73, 80, 84], pad: [89, 90, 91, 95] },
    tripletChance: 0.48, snareRollChance: 0.46, halfTime: false,
    arrangement: { form: "breaks", chorusLift: 0.25, fillFrequency: 0.68, phraseBars: 4 },
  },
  synthwave: {
    id: "synthwave", label: "Synthwave", bpm: { min: 84, max: 118, default: 100 },
    preferredScales: ["minor", "harmonicMinor", "dorian", "major"],
    grooveWeights: {
      drumGroove: { backbeat: 3.2, fourFloor: 2.4, electro: 1.4, halfTime: 0.5, breakbeat: 0.2 },
      bassGroove: { pulse: 4, rootFifth: 2.1, syncopated: 1.1, walking: 0.1 },
      chordMotion: { arpeggio: 3.6, sustained: 2, pulse: 1.4, offbeat: 0.55 },
    },
    swing: 0.03, syncopation: 0.28, humanize: 0.1, chordExtensions: 0.3, harmonicRhythm: 0.3,
    instrumentPrograms: { drums: [24, 25, 16], bass: [38, 39, 33], chords: [81, 89, 90, 95], melody: [81, 82, 85, 87], counterpoint: [80, 81, 84, 85], pad: [89, 90, 95, 99] },
    tripletChance: 0.09, snareRollChance: 0.12, halfTime: false,
    arrangement: { form: "cinematic-pop", chorusLift: 0.24, fillFrequency: 0.34, phraseBars: 4 },
  },
  pop: {
    id: "pop", label: "Pop", bpm: { min: 92, max: 128, default: 112 },
    preferredScales: ["major", "minor", "mixolydian", "dorian"],
    grooveWeights: {
      drumGroove: { backbeat: 3.8, fourFloor: 2, electro: 1.1, halfTime: 0.45, breakbeat: 0.35 },
      bassGroove: { rootFifth: 2.5, pulse: 2.2, syncopated: 1.6, walking: 0.25 },
      chordMotion: { pulse: 2.2, sustained: 1.8, offbeat: 1.4, arpeggio: 1.1 },
    },
    swing: 0.1, syncopation: 0.34, humanize: 0.2, chordExtensions: 0.34, harmonicRhythm: 0.36,
    instrumentPrograms: { drums: [0, 8, 16], bass: [33, 34, 38], chords: [0, 4, 5, 25], melody: [73, 80, 81, 85], counterpoint: [25, 53, 73, 80], pad: [48, 88, 89, 90] },
    tripletChance: 0.13, snareRollChance: 0.16, halfTime: false,
    arrangement: { form: "pop", chorusLift: 0.2, fillFrequency: 0.38, phraseBars: 4 },
  },

  // ─── NEW GENRES (v2.0) ────────────────────────────────────────────────────

  loFiHipHop: {
    id: "loFiHipHop", label: "Lo-Fi Hip-Hop", bpm: { min: 70, max: 92, default: 82 },
    preferredScales: ["dorian", "minorPentatonic", "minor", "majorPentatonic"],
    grooveWeights: {
      drumGroove: { backbeat: 3.8, halfTime: 3, breakbeat: 1.6, electro: 0.4, fourFloor: 0.1 },
      bassGroove: { syncopated: 2.8, rootFifth: 2.6, walking: 1.2, pulse: 0.3 },
      chordMotion: { sustained: 4, offbeat: 1.8, arpeggio: 0.8, pulse: 0.4 },
    },
    swing: 0.38, syncopation: 0.44, humanize: 0.55, chordExtensions: 0.78, harmonicRhythm: 0.22,
    instrumentPrograms: { drums: [8, 0], bass: [35, 33, 36], chords: [4, 5, 0, 17], melody: [73, 26, 80, 11], counterpoint: [11, 10, 73, 25], pad: [88, 89, 91, 48] },
    tripletChance: 0.22, snareRollChance: 0.1, halfTime: false,
    arrangement: { form: "loop", chorusLift: 0.08, fillFrequency: 0.2, phraseBars: 4 },
  },

  rnbSoul: {
    id: "rnbSoul", label: "R&B / Soul", bpm: { min: 60, max: 85, default: 72 },
    preferredScales: ["minor", "dorian", "mixolydian", "majorPentatonic"],
    grooveWeights: {
      drumGroove: { backbeat: 4.5, halfTime: 2.2, breakbeat: 0.8, electro: 0.3, fourFloor: 0.1 },
      bassGroove: { syncopated: 3.6, walking: 2.4, rootFifth: 1.8, pulse: 0.4 },
      chordMotion: { sustained: 3.2, offbeat: 2.4, arpeggio: 1.0, pulse: 0.5 },
    },
    swing: 0.3, syncopation: 0.62, humanize: 0.42, chordExtensions: 0.88, harmonicRhythm: 0.38,
    instrumentPrograms: { drums: [0, 8], bass: [33, 35, 36], chords: [4, 5, 16, 17], melody: [85, 73, 54, 26], counterpoint: [53, 25, 73, 85], pad: [89, 91, 92, 88] },
    tripletChance: 0.2, snareRollChance: 0.14, halfTime: false,
    arrangement: { form: "verse-chorus", chorusLift: 0.16, fillFrequency: 0.28, phraseBars: 4 },
  },

  drill: {
    id: "drill", label: "Drill", bpm: { min: 138, max: 150, default: 144 },
    preferredScales: ["minor", "phrygian", "harmonicMinor", "minorPentatonic"],
    grooveWeights: {
      drumGroove: { halfTime: 7, backbeat: 1.2, electro: 0.8, breakbeat: 0.4, fourFloor: 0.04 },
      bassGroove: { syncopated: 5.2, rootFifth: 1.8, pulse: 1.2, walking: 0.05 },
      chordMotion: { sustained: 4.2, arpeggio: 1.4, pulse: 0.6, offbeat: 0.5 },
    },
    swing: 0.03, syncopation: 0.72, humanize: 0.1, chordExtensions: 0.22, harmonicRhythm: 0.16,
    instrumentPrograms: { drums: [25, 24], bass: [38, 39, 87], chords: [0, 81, 89, 90], melody: [80, 81, 82, 87], counterpoint: [80, 48, 81, 85], pad: [89, 90, 95, 92] },
    tripletChance: 0.82, snareRollChance: 0.74, halfTime: true,
    arrangement: { form: "half-time", chorusLift: 0.24, fillFrequency: 0.78, phraseBars: 4 },
  },

  reggaeton: {
    id: "reggaeton", label: "Reggaeton", bpm: { min: 88, max: 102, default: 96 },
    preferredScales: ["minor", "dorian", "mixolydian", "minorPentatonic"],
    grooveWeights: {
      drumGroove: { electro: 7, backbeat: 1.4, fourFloor: 0.45, breakbeat: 0.35, halfTime: 0.1 },
      bassGroove: { pulse: 4.2, syncopated: 3.0, rootFifth: 1.2, walking: 0.2 },
      chordMotion: { offbeat: 4.8, sustained: 2.0, pulse: 1.0, arpeggio: 0.6 },
    },
    swing: 0.05, syncopation: 0.52, humanize: 0.16, chordExtensions: 0.3, harmonicRhythm: 0.44,
    instrumentPrograms: { drums: [24, 25, 16], bass: [38, 39, 33], chords: [81, 4, 89, 90], melody: [81, 85, 54, 80], counterpoint: [80, 81, 84, 85], pad: [89, 90, 95, 99] },
    tripletChance: 0.08, snareRollChance: 0.16, halfTime: false,
    arrangement: { form: "club", chorusLift: 0.2, fillFrequency: 0.42, phraseBars: 8 },
  },

  afrobeats: {
    id: "afrobeats", label: "Afrobeats", bpm: { min: 98, max: 116, default: 108 },
    preferredScales: ["major", "dorian", "majorPentatonic", "mixolydian"],
    grooveWeights: {
      drumGroove: { electro: 5.4, backbeat: 2.8, fourFloor: 0.75, breakbeat: 1.2, halfTime: 0.2 },
      bassGroove: { syncopated: 4.0, rootFifth: 2.2, pulse: 1.8, walking: 0.4 },
      chordMotion: { offbeat: 3.8, sustained: 2.0, pulse: 1.4, arpeggio: 0.8 },
    },
    swing: 0.14, syncopation: 0.62, humanize: 0.28, chordExtensions: 0.38, harmonicRhythm: 0.46,
    instrumentPrograms: { drums: [0, 8, 16, 24], bass: [33, 36, 38], chords: [4, 5, 25, 89], melody: [73, 85, 54, 26], counterpoint: [25, 73, 53, 85], pad: [48, 88, 89, 91] },
    tripletChance: 0.2, snareRollChance: 0.18, halfTime: false,
    arrangement: { form: "verse-chorus", chorusLift: 0.18, fillFrequency: 0.44, phraseBars: 4 },
  },

  jazz: {
    id: "jazz", label: "Jazz", bpm: { min: 108, max: 200, default: 140 },
    preferredScales: ["dorian", "mixolydian", "major", "melodicMinor"],
    grooveWeights: {
      drumGroove: { backbeat: 3.2, breakbeat: 2.8, halfTime: 0.6, electro: 0.15, fourFloor: 0.1 },
      bassGroove: { walking: 5.5, syncopated: 2.2, rootFifth: 1.0, pulse: 0.4 },
      chordMotion: { offbeat: 3.8, sustained: 2.4, arpeggio: 2.0, pulse: 0.6 },
    },
    swing: 0.55, syncopation: 0.68, humanize: 0.46, chordExtensions: 0.96, harmonicRhythm: 0.7,
    instrumentPrograms: { drums: [8, 0], bass: [43, 33, 35], chords: [0, 4, 16, 17], melody: [26, 73, 68, 66], counterpoint: [25, 53, 11, 73], pad: [48, 88, 89, 91] },
    tripletChance: 0.55, snareRollChance: 0.34, halfTime: false,
    arrangement: { form: "head-solos", chorusLift: 0.14, fillFrequency: 0.58, phraseBars: 8 },
  },

  ambient: {
    id: "ambient", label: "Ambient", bpm: { min: 58, max: 80, default: 68 },
    preferredScales: ["lydian", "major", "dorian", "mixolydian"],
    grooveWeights: {
      drumGroove: { halfTime: 4, backbeat: 2.2, electro: 0.8, breakbeat: 0.3, fourFloor: 0.1 },
      bassGroove: { pulse: 3.8, rootFifth: 3.0, syncopated: 0.8, walking: 0.4 },
      chordMotion: { sustained: 6.5, arpeggio: 2.2, offbeat: 0.5, pulse: 0.3 },
    },
    swing: 0.06, syncopation: 0.18, humanize: 0.22, chordExtensions: 0.72, harmonicRhythm: 0.18,
    instrumentPrograms: { drums: [0, 8], bass: [88, 89, 33], chords: [89, 90, 91, 94], melody: [73, 88, 82, 85], counterpoint: [14, 94, 98, 73], pad: [92, 94, 95, 99] },
    tripletChance: 0.06, snareRollChance: 0.06, halfTime: false,
    arrangement: { form: "evolving", chorusLift: 0.1, fillFrequency: 0.14, phraseBars: 8 },
  },

  funk: {
    id: "funk", label: "Funk", bpm: { min: 88, max: 112, default: 100 },
    preferredScales: ["dorian", "minor", "mixolydian", "minorPentatonic"],
    grooveWeights: {
      drumGroove: { backbeat: 5.0, fourFloor: 1.4, breakbeat: 1.0, halfTime: 0.4, electro: 0.2 },
      bassGroove: { syncopated: 5.5, rootFifth: 2.0, pulse: 1.0, walking: 0.8 },
      chordMotion: { offbeat: 5.0, pulse: 2.0, sustained: 1.0, arpeggio: 0.8 },
    },
    swing: 0.2, syncopation: 0.76, humanize: 0.36, chordExtensions: 0.54, harmonicRhythm: 0.54,
    instrumentPrograms: { drums: [0, 8, 16], bass: [36, 33, 35], chords: [4, 5, 16, 17], melody: [26, 73, 80, 81], counterpoint: [25, 73, 85, 53], pad: [48, 88, 89, 91] },
    tripletChance: 0.28, snareRollChance: 0.22, halfTime: false,
    arrangement: { form: "groove", chorusLift: 0.16, fillFrequency: 0.52, phraseBars: 4 },
  },
  country: {
    id: "country", label: "Country", bpm: { min: 82, max: 126, default: 104 },
    preferredScales: ["major", "mixolydian", "majorPentatonic", "minorPentatonic"],
    grooveWeights: {
      drumGroove: { backbeat: 5.8, breakbeat: 1.1, halfTime: 0.55, fourFloor: 0.35, electro: 0.05 },
      bassGroove: { rootFifth: 5.2, walking: 2.5, pulse: 1.4, syncopated: 0.7 },
      chordMotion: { pulse: 3.8, offbeat: 2.6, sustained: 1.4, arpeggio: 1.8 },
    },
    swing: 0.16, syncopation: 0.3, humanize: 0.36, chordExtensions: 0.2, harmonicRhythm: 0.5,
    instrumentPrograms: {
      drums: [0, 8], bass: [32, 33, 34], chords: [24, 25, 0, 16],
      melody: [25, 40, 56, 73], counterpoint: [25, 40, 71, 73], pad: [48, 51, 88],
    },
    tripletChance: 0.13, snareRollChance: 0.2, halfTime: false,
    arrangement: { form: "story-song", chorusLift: 0.2, fillFrequency: 0.38, phraseBars: 4 },
  },
  rock: {
    id: "rock", label: "Rock", bpm: { min: 92, max: 148, default: 120 },
    preferredScales: ["minorPentatonic", "mixolydian", "major", "minor"],
    grooveWeights: {
      drumGroove: { backbeat: 6.4, breakbeat: 1.5, halfTime: 0.8, fourFloor: 0.6, electro: 0.04 },
      bassGroove: { rootFifth: 4.2, pulse: 3.2, syncopated: 1.3, walking: 0.55 },
      chordMotion: { pulse: 4.8, sustained: 2.1, offbeat: 1.4, arpeggio: 0.75 },
    },
    swing: 0.05, syncopation: 0.34, humanize: 0.28, chordExtensions: 0.12, harmonicRhythm: 0.48,
    instrumentPrograms: {
      drums: [0, 16, 8], bass: [33, 34, 36], chords: [29, 30, 27, 16],
      melody: [29, 30, 26, 40], counterpoint: [27, 29, 40, 56], pad: [48, 51, 89],
    },
    tripletChance: 0.1, snareRollChance: 0.3, halfTime: false,
    arrangement: { form: "anthem", chorusLift: 0.26, fillFrequency: 0.56, phraseBars: 4 },
  },
  popRadio: {
    id: "popRadio", label: "Pop Radio", bpm: { min: 112, max: 128, default: 120 },
    preferredScales: ["major", "minor", "mixolydian", "majorPentatonic"],
    grooveWeights: {
      drumGroove: { backbeat: 5.2, fourFloor: 2.1, electro: 1.4, halfTime: 0.4, breakbeat: 0.2 },
      bassGroove: { pulse: 4.2, syncopated: 3.2, rootFifth: 1.8, walking: 0.2 },
      chordMotion: { offbeat: 3.8, pulse: 2.8, sustained: 1.8, arpeggio: 1.2 },
    },
    swing: 0.04, syncopation: 0.46, humanize: 0.16, chordExtensions: 0.38, harmonicRhythm: 0.5,
    instrumentPrograms: { drums: [0, 8, 24], bass: [38, 39, 33, 34], chords: [4, 5, 16, 89], melody: [80, 81, 85, 26], counterpoint: [80, 81, 84, 85], pad: [88, 89, 90, 92] },
    tripletChance: 0.12, snareRollChance: 0.18, halfTime: false,
    arrangement: { form: "verse-chorus", chorusLift: 0.26, fillFrequency: 0.45, phraseBars: 4 },
  },
  synthPopRadio: {
    id: "synthPopRadio", label: "Synthpop Radio", bpm: { min: 118, max: 134, default: 124 },
    preferredScales: ["minor", "major", "dorian", "mixolydian"],
    grooveWeights: {
      drumGroove: { fourFloor: 5.5, backbeat: 3.8, electro: 2.2, breakbeat: 0.4, halfTime: 0.1 },
      bassGroove: { pulse: 5.0, syncopated: 2.8, rootFifth: 1.2, walking: 0.1 },
      chordMotion: { pulse: 4.2, offbeat: 3.2, arpeggio: 2.4, sustained: 1.2 },
    },
    swing: 0.02, syncopation: 0.42, humanize: 0.1, chordExtensions: 0.32, harmonicRhythm: 0.5,
    instrumentPrograms: { drums: [24, 25, 16], bass: [38, 39, 87], chords: [81, 89, 90, 95], melody: [80, 81, 82, 87], counterpoint: [80, 81, 84, 86], pad: [88, 89, 91, 95] },
    tripletChance: 0.08, snareRollChance: 0.22, halfTime: false,
    arrangement: { form: "verse-chorus", chorusLift: 0.28, fillFrequency: 0.48, phraseBars: 4 },
  },
});

export const DEFAULT_CONFIG = deepFreeze({
  seed: "midi-arcade",
  genre: "pop",
  chordPath: "pop",
  key: "C",
  scale: "minor",
  tempo: 112,
  bars: 32,
  timeSignature: [4, 4],
  energy: 0.7,
  complexity: 0.58,
  variation: 0.48,
  evolution: 0.58,
  surprise: 0.28,
  similarity: 0.82,
  swing: 0.12,
  humanize: 0.28,
  syncopation: 0.38,
  harmonicRhythm: 0.32,
  chordExtensions: 0.34,
  melodicRange: 16,
  drumFills: 0.52,
  tripletAmount: 0.13,
  rollAmount: 0.16,
  registerSpread: 0.34,
  tracks: Object.fromEntries(
    Object.entries(TRACK_DEFINITIONS).map(([id, track]) => [id, { ...track }]),
  ),
});

const NOTE_TO_PC = {
  C: 0,
  "C#": 1,
  DB: 1,
  D: 2,
  "D#": 3,
  EB: 3,
  E: 4,
  FB: 4,
  "E#": 5,
  F: 5,
  "F#": 6,
  GB: 6,
  G: 7,
  "G#": 8,
  AB: 8,
  A: 9,
  "A#": 10,
  BB: 10,
  B: 11,
  CB: 11,
};

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const TRACK_IDS = Object.keys(TRACK_DEFINITIONS);

const GENRE_ALIASES = {
  neosoul: "neoSoul",
  rnb: "neoSoul",
  rhythmandblues: "neoSoul",
  hiphop: "hipHop",
  rap: "rap",
  trap: "trap",
  house: "house",
  techno: "techno",
  drumbass: "drumBass",
  drumandbass: "drumBass",
  dnb: "drumBass",
  jungle: "drumBass",
  synthwave: "synthwave",
  retrowave: "synthwave",
  pop: "pop",
  // v2.0 genres
  lofi: "loFiHipHop",
  lofihiphop: "loFiHipHop",
  loFiHipHop: "loFiHipHop",
  chillhop: "loFiHipHop",
  rnbsoul: "rnbSoul",
  soul: "rnbSoul",
  slowjam: "rnbSoul",
  drill: "drill",
  ukdrill: "drill",
  reggaeton: "reggaeton",
  dembow: "reggaeton",
  afrobeats: "afrobeats",
  afropop: "afrobeats",
  jazz: "jazz",
  swing: "jazz",
  ambient: "ambient",
  chillout: "ambient",
  downtempo: "ambient",
  funk: "funk",
  groove: "funk",
  country: "country",
  americana: "country",
  rock: "rock",
  altrock: "rock",
  alternativerock: "rock",
  popradio: "popRadio",
  popRadio: "popRadio",
  synthpopradio: "synthPopRadio",
  synthPopRadio: "synthPopRadio",
};

const SCALE_ALIASES = {
  ionian: "major",
  major: "major",
  aeolian: "minor",
  naturalminor: "minor",
  minor: "minor",
  dorian: "dorian",
  phrygian: "phrygian",
  lydian: "lydian",
  mixolydian: "mixolydian",
  locrian: "locrian",
  harmonicminor: "harmonicMinor",
  melodicminor: "melodicMinor",
  harmonicmajor: "harmonicMajor",
  phrygiandominant: "phrygianDominant",
  lydiandominant: "lydianDominant",
  altered: "altered",
  superlocrian: "altered",
  doubleharmonic: "doubleHarmonic",
  arabic: "doubleHarmonic",
  byzantine: "doubleHarmonic",
  hirajoshi: "hirajoshi",
  japanesehirajoshi: "hirajoshi",
  hungarianminor: "hungarianMinor",
  gypsyminor: "hungarianMinor",
  insen: "inSen",
  persian: "persian",
  iwato: "iwato",
  majorpentatonic: "majorPentatonic",
  pentatonicmajor: "majorPentatonic",
  minorpentatonic: "minorPentatonic",
  pentatonicminor: "minorPentatonic",
  blues: "blues",
  bluesscale: "blues",
  pentatonicneutral: "pentatonicNeutral",
  egyptianpentatonic: "egyptianPentatonic",
  bebopmajor: "bebopMajor",
  bebopdominant: "bebopDominant",
  wholetone: "wholeTone",
  diminishedhalfwhole: "diminishedHalfWhole",
  diminishedwholehalf: "diminishedWholeHalf",
  enigmatic: "enigmatic",
};

const CHORD_PATH_ALIASES = {
  soul: "soul",
  soulful: "soul",
  pop: "pop",
  anthem: "pop",
  jazz: "jazz",
  turnaround: "jazz",
  trap: "trap",
  darktrap: "trap",
  house: "house",
  club: "house",
  stabs: "house",
};

const STYLE_CHOICES = {
  drumGroove: ["backbeat", "fourFloor", "breakbeat", "halfTime", "electro"],
  bassGroove: ["rootFifth", "pulse", "syncopated", "walking"],
  chordMotion: ["sustained", "pulse", "offbeat", "arpeggio"],
  melodyShape: ["arch", "rising", "falling", "wave"],
  counterMotion: ["contrary", "echo", "answer"],
  padMotion: ["held", "bloom"],
};

const PROGRESSIONS = {
  major: {
    intro: [
      [0, 4, 5, 3], [0, 3, 5, 4], [0, 5, 1, 4], [3, 0, 5, 4],
      [0, 2, 3, 4], [0, 5, 3, 3]
    ],
    verse: [
      [0, 5, 3, 4], [5, 3, 0, 4], [0, 2, 5, 3], [0, 3, 5, 4],
      [0, 4, 1, 3], [5, 1, 0, 4], [0, 1, 3, 4], [0, 3, 1, 4]
    ],
    prechorus: [
      [1, 3, 0, 4], [3, 4, 2, 5], [5, 3, 1, 4], [1, 4, 5, 3],
      [3, 1, 4, 4]
    ],
    chorus: [
      [0, 4, 5, 3], [5, 3, 0, 4], [0, 3, 5, 4], [3, 4, 0, 5],
      [0, 5, 1, 4], [0, 3, 4, 5]
    ],
    bridge: [
      [5, 1, 3, 0], [1, 5, 3, 4], [3, 5, 1, 4], [1, 4, 2, 5],
      [5, 4, 3, 4]
    ],
    outro: [
      [3, 4, 0, 0], [5, 3, 0, 0], [1, 4, 0, 0], [0, 3, 4, 0]
    ],
    idea: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 5, 4]],
    theme: [[0, 3, 4, 0], [0, 5, 3, 4]],
  },
  minor: {
    intro: [
      [0, 5, 2, 6], [0, 6, 5, 6], [0, 3, 5, 4], [0, 2, 5, 6],
      [0, 5, 6, 5], [0, 3, 6, 5]
    ],
    verse: [
      [0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 2, 5], [0, 2, 3, 6],
      [0, 5, 3, 6], [5, 2, 0, 6], [0, 4, 5, 6], [0, 3, 2, 6]
    ],
    prechorus: [
      [5, 6, 0, 4], [2, 5, 6, 4], [3, 6, 5, 4], [5, 2, 6, 4],
      [2, 3, 5, 6]
    ],
    chorus: [
      [0, 5, 2, 6], [0, 2, 5, 6], [5, 2, 0, 6], [0, 6, 3, 5],
      [0, 3, 5, 6], [0, 5, 6, 4]
    ],
    bridge: [
      [3, 6, 2, 5], [5, 2, 0, 4], [2, 5, 3, 6], [6, 5, 3, 2],
      [3, 5, 2, 6]
    ],
    outro: [
      [5, 6, 0, 0], [2, 6, 0, 0], [3, 5, 0, 0], [0, 6, 5, 0]
    ],
    idea: [[0, 5, 2, 6], [0, 3, 5, 6], [0, 6, 2, 5]],
    theme: [[0, 2, 6, 0], [0, 5, 6, 0]],
  },
  modal: {
    intro: [
      [0, 3, 5, 0], [0, 6, 3, 0], [0, 2, 5, 0], [0, 4, 3, 0]
    ],
    verse: [
      [0, 2, 3, 0], [0, 5, 3, 6], [0, 3, 2, 5], [0, 6, 2, 3],
      [0, 4, 2, 5], [0, 3, 6, 5]
    ],
    prechorus: [
      [3, 5, 6, 4], [1, 3, 5, 0], [2, 5, 3, 4], [5, 3, 6, 0]
    ],
    chorus: [
      [0, 3, 5, 6], [0, 6, 3, 0], [0, 5, 2, 3], [0, 2, 6, 5],
      [0, 3, 6, 4]
    ],
    bridge: [
      [2, 5, 0, 3], [5, 3, 1, 0], [3, 6, 2, 5], [1, 4, 3, 0]
    ],
    outro: [
      [3, 6, 0, 0], [5, 3, 0, 0], [2, 5, 0, 0]
    ],
    idea: [[0, 3, 5, 0], [0, 6, 3, 0]],
    theme: [[0, 5, 3, 0], [0, 2, 3, 0]],
  },
};

/**
 * Genre-specific harmonic vocabulary layered over the broad tonal families.
 * Degrees remain scale-relative, so every progression is safe in every key.
 */
export const GENRE_PROGRESSION_GRAMMARS = deepFreeze({
  neoSoul: { verse: [[0, 3, 1, 4], [1, 4, 0, 5]], chorus: [[3, 4, 0, 5], [0, 2, 1, 4]], bridge: [[5, 1, 3, 4]], cadence: [1, 4] },
  hipHop: { verse: [[0, 5, 3, 6], [0, 2, 5, 3]], chorus: [[0, 3, 5, 4], [5, 3, 0, 4]], bridge: [[2, 5, 0, 6]], cadence: [6, 4] },
  rap: { verse: [[0, 5, 0, 6], [0, 2, 3, 5]], chorus: [[0, 3, 0, 5], [5, 3, 0, 6]], bridge: [[2, 3, 5, 0]], cadence: [6, 0] },
  trap: { verse: [[0, 5, 6, 5], [0, 2, 5, 6]], chorus: [[0, 6, 3, 5], [0, 5, 2, 6]], bridge: [[3, 6, 2, 5]], cadence: [6, 4] },
  house: { verse: [[0, 5, 3, 4], [0, 3, 5, 4]], chorus: [[0, 4, 5, 3], [5, 3, 0, 4]], bridge: [[1, 5, 3, 4]], cadence: [3, 4] },
  techno: { verse: [[0, 0, 5, 6], [0, 3, 0, 6]], chorus: [[0, 5, 2, 3], [0, 6, 3, 0]], bridge: [[2, 5, 0, 3]], cadence: [6, 0] },
  drumBass: { verse: [[0, 5, 2, 6], [0, 3, 5, 6]], chorus: [[0, 2, 5, 6], [5, 2, 0, 6]], bridge: [[3, 6, 2, 5]], cadence: [6, 4] },
  synthwave: { verse: [[0, 5, 3, 6], [0, 6, 5, 3]], chorus: [[0, 3, 5, 4], [5, 2, 0, 6]], bridge: [[3, 6, 2, 5]], cadence: [6, 4] },
  pop: { verse: [[0, 5, 3, 4], [5, 3, 0, 4]], chorus: [[0, 4, 5, 3], [0, 3, 5, 4]], bridge: [[1, 5, 3, 4]], cadence: [1, 4] },
  loFiHipHop: { verse: [[1, 4, 0, 5], [0, 3, 1, 4]], chorus: [[3, 4, 0, 5], [0, 5, 1, 4]], bridge: [[5, 1, 3, 4]], cadence: [1, 4] },
  rnbSoul: { verse: [[0, 3, 1, 4], [5, 1, 0, 4]], chorus: [[3, 4, 0, 5], [0, 2, 1, 4]], bridge: [[5, 2, 3, 4]], cadence: [1, 4] },
  drill: { verse: [[0, 6, 5, 6], [0, 2, 5, 6]], chorus: [[0, 5, 2, 6], [0, 6, 3, 5]], bridge: [[6, 5, 3, 2]], cadence: [6, 4] },
  reggaeton: { verse: [[0, 5, 2, 6], [0, 3, 5, 4]], chorus: [[0, 5, 3, 4], [5, 3, 0, 4]], bridge: [[3, 6, 2, 5]], cadence: [3, 4] },
  afrobeats: { verse: [[0, 3, 5, 4], [0, 5, 3, 4]], chorus: [[0, 4, 5, 3], [3, 4, 0, 5]], bridge: [[1, 5, 3, 4]], cadence: [3, 4] },
  jazz: { verse: [[1, 4, 0, 5], [2, 5, 1, 4]], chorus: [[3, 6, 1, 4], [1, 4, 0, 5]], bridge: [[5, 1, 3, 4]], cadence: [1, 4] },
  ambient: { verse: [[0, 3, 5, 0], [0, 2, 5, 0]], chorus: [[0, 5, 2, 3], [0, 6, 3, 0]], bridge: [[2, 5, 0, 3]], cadence: [3, 0] },
  funk: { verse: [[0, 3, 0, 4], [0, 5, 3, 4]], chorus: [[0, 3, 5, 4], [3, 4, 0, 5]], bridge: [[1, 3, 5, 4]], cadence: [3, 4] },
  country: { verse: [[0, 3, 0, 4], [0, 4, 3, 0]], chorus: [[0, 3, 4, 0], [0, 4, 5, 3]], bridge: [[5, 3, 0, 4]], cadence: [3, 4] },
  rock: { verse: [[0, 5, 6, 3], [0, 3, 6, 4]], chorus: [[0, 3, 4, 0], [5, 3, 0, 4]], bridge: [[2, 5, 3, 4]], cadence: [3, 4] },
  popRadio: { verse: [[0, 5, 3, 4], [5, 3, 0, 4]], chorus: [[0, 4, 5, 3], [0, 3, 5, 4]], bridge: [[1, 5, 3, 4]], cadence: [1, 4] },
  synthPopRadio: { verse: [[0, 5, 3, 6], [0, 6, 5, 3]], chorus: [[0, 3, 5, 4], [5, 2, 0, 6]], bridge: [[3, 6, 2, 5]], cadence: [6, 4] },
});

export const CHORD_PATH_PROGRESSION_GRAMMARS = deepFreeze({
  soul: {
    verse: [[0, 3, 1, 4], [1, 4, 0, 5], [5, 1, 0, 4]],
    chorus: [[3, 4, 0, 5], [0, 2, 1, 4]],
    bridge: [[5, 1, 3, 4], [2, 5, 1, 4]],
    cadence: [1, 4],
  },
  pop: {
    verse: [[0, 5, 3, 4], [5, 3, 0, 4], [0, 3, 5, 4]],
    chorus: [[0, 4, 5, 3], [0, 3, 4, 0]],
    bridge: [[1, 5, 3, 4], [5, 1, 3, 0]],
    cadence: [3, 4],
  },
  jazz: {
    verse: [[1, 4, 0, 5], [2, 5, 1, 4], [3, 6, 1, 4]],
    chorus: [[3, 6, 1, 4], [1, 4, 0, 5]],
    bridge: [[5, 1, 3, 4], [2, 5, 3, 6]],
    cadence: [1, 4],
  },
  trap: {
    verse: [[0, 6, 5, 6], [0, 2, 5, 6], [0, 5, 6, 5]],
    chorus: [[0, 5, 2, 6], [0, 6, 3, 5]],
    bridge: [[6, 5, 3, 2], [3, 6, 2, 5]],
    cadence: [6, 4],
  },
  house: {
    verse: [[0, 5, 3, 4], [0, 3, 5, 4], [0, 4, 5, 3]],
    chorus: [[0, 4, 5, 3], [5, 3, 0, 4]],
    bridge: [[1, 5, 3, 4], [3, 4, 0, 5]],
    cadence: [3, 4],
  },
});

/**
 * Listening targets for Critic 6.0. These values let sparse Ambient writing,
 * dense Jazz motion, straight Rock backbeats, and syncopated Funk be judged by
 * their own musical intent instead of one universal average.
 */
export const GENRE_CRITIC_PROFILES = deepFreeze({
  neoSoul: { density: 25, repetition: 0.62, syncopation: 0.58, backbeats: 2, bassLock: 0.62 },
  hipHop: { density: 21, repetition: 0.7, syncopation: 0.54, backbeats: 2, bassLock: 0.68 },
  rap: { density: 20, repetition: 0.72, syncopation: 0.6, backbeats: 2, bassLock: 0.74 },
  trap: { density: 22, repetition: 0.72, syncopation: 0.66, backbeats: 1, bassLock: 0.72 },
  house: { density: 27, repetition: 0.68, syncopation: 0.48, backbeats: 2, bassLock: 0.8 },
  techno: { density: 23, repetition: 0.78, syncopation: 0.36, backbeats: 2, bassLock: 0.82 },
  drumBass: { density: 34, repetition: 0.6, syncopation: 0.7, backbeats: 2, bassLock: 0.72 },
  synthwave: { density: 25, repetition: 0.7, syncopation: 0.28, backbeats: 2, bassLock: 0.76 },
  pop: { density: 25, repetition: 0.68, syncopation: 0.34, backbeats: 2, bassLock: 0.72 },
  loFiHipHop: { density: 17, repetition: 0.74, syncopation: 0.44, backbeats: 2, bassLock: 0.62 },
  rnbSoul: { density: 23, repetition: 0.62, syncopation: 0.62, backbeats: 2, bassLock: 0.6 },
  drill: { density: 23, repetition: 0.72, syncopation: 0.72, backbeats: 1, bassLock: 0.7 },
  reggaeton: { density: 27, repetition: 0.74, syncopation: 0.52, backbeats: 2, bassLock: 0.82 },
  afrobeats: { density: 30, repetition: 0.62, syncopation: 0.62, backbeats: 2, bassLock: 0.72 },
  jazz: { density: 36, repetition: 0.46, syncopation: 0.68, backbeats: 2, bassLock: 0.46 },
  ambient: { density: 12, repetition: 0.76, syncopation: 0.18, backbeats: 0.5, bassLock: 0.4 },
  funk: { density: 34, repetition: 0.58, syncopation: 0.76, backbeats: 2, bassLock: 0.82 },
  country: { density: 23, repetition: 0.68, syncopation: 0.3, backbeats: 2, bassLock: 0.76 },
  rock: { density: 28, repetition: 0.7, syncopation: 0.34, backbeats: 2, bassLock: 0.82 },
  popRadio: { density: 26, repetition: 0.72, syncopation: 0.44, backbeats: 2, bassLock: 0.76 },
  synthPopRadio: { density: 28, repetition: 0.74, syncopation: 0.4, backbeats: 2, bassLock: 0.8 },
});

/** Genre phrase vocabularies used before note rendering and performance feel. */
export const GENRE_MELODY_GRAMMARS = deepFreeze({
  neoSoul: { phraseShapes: ["questionAnswer", "syncopatedLoop"], contours: ["arch", "wave", "fallRebound"], restBias: 0.08, leapChance: 0.2, ornamentChance: 0.2, durationScale: 1.05 },
  hipHop: { phraseShapes: ["syncopatedLoop", "sparseEcho"], contours: ["pedalLaunch", "wave"], restBias: 0.11, leapChance: 0.16, ornamentChance: 0.1, durationScale: 0.9 },
  rap: { phraseShapes: ["sparseEcho", "questionAnswer"], contours: ["pedalLaunch", "fallRebound"], restBias: 0.2, leapChance: 0.12, ornamentChance: 0.06, durationScale: 0.8 },
  trap: { phraseShapes: ["sparseEcho", "staircase"], contours: ["pedalLaunch", "fallRebound"], restBias: 0.14, leapChance: 0.24, ornamentChance: 0.08, durationScale: 0.78 },
  house: { phraseShapes: ["syncopatedLoop", "staircase"], contours: ["wave", "climbFall"], restBias: 0.04, leapChance: 0.18, ornamentChance: 0.08, durationScale: 0.82 },
  techno: { phraseShapes: ["staircase", "syncopatedLoop"], contours: ["pedalLaunch", "wave"], restBias: 0.03, leapChance: 0.12, ornamentChance: 0.04, durationScale: 0.72 },
  drumBass: { phraseShapes: ["syncopatedLoop", "staircase"], contours: ["climbFall", "fallRebound"], restBias: 0.06, leapChance: 0.3, ornamentChance: 0.12, durationScale: 0.7 },
  synthwave: { phraseShapes: ["staircase", "longShort"], contours: ["climbFall", "arch", "pedalLaunch"], restBias: 0.05, leapChance: 0.28, ornamentChance: 0.08, durationScale: 0.94 },
  pop: { phraseShapes: ["questionAnswer", "syncopatedLoop"], contours: ["arch", "climbFall"], restBias: 0.04, leapChance: 0.24, ornamentChance: 0.1, durationScale: 0.92 },
  loFiHipHop: { phraseShapes: ["sparseEcho", "questionAnswer"], contours: ["wave", "fallRebound"], restBias: 0.16, leapChance: 0.12, ornamentChance: 0.14, durationScale: 1.12 },
  rnbSoul: { phraseShapes: ["questionAnswer", "longShort"], contours: ["arch", "wave", "fallRebound"], restBias: 0.12, leapChance: 0.18, ornamentChance: 0.24, durationScale: 1.14 },
  drill: { phraseShapes: ["sparseEcho", "staircase"], contours: ["fallRebound", "pedalLaunch"], restBias: 0.15, leapChance: 0.3, ornamentChance: 0.06, durationScale: 0.72 },
  reggaeton: { phraseShapes: ["syncopatedLoop", "questionAnswer"], contours: ["wave", "arch"], restBias: 0.05, leapChance: 0.18, ornamentChance: 0.12, durationScale: 0.84 },
  afrobeats: { phraseShapes: ["syncopatedLoop", "questionAnswer"], contours: ["wave", "climbFall"], restBias: 0.06, leapChance: 0.2, ornamentChance: 0.16, durationScale: 0.82 },
  jazz: { phraseShapes: ["longShort", "syncopatedLoop"], contours: ["wave", "fallRebound", "climbFall"], restBias: 0.09, leapChance: 0.38, ornamentChance: 0.3, durationScale: 0.88 },
  ambient: { phraseShapes: ["sparseEcho", "longShort"], contours: ["arch", "wave"], restBias: 0.2, leapChance: 0.12, ornamentChance: 0.06, durationScale: 1.32 },
  funk: { phraseShapes: ["syncopatedLoop", "staircase"], contours: ["pedalLaunch", "wave"], restBias: 0.05, leapChance: 0.22, ornamentChance: 0.18, durationScale: 0.68 },
  country: { phraseShapes: ["questionAnswer", "longShort"], contours: ["arch", "fallRebound"], restBias: 0.1, leapChance: 0.16, ornamentChance: 0.12, durationScale: 1.08 },
  rock: { phraseShapes: ["staircase", "longShort"], contours: ["climbFall", "pedalLaunch"], restBias: 0.04, leapChance: 0.34, ornamentChance: 0.08, durationScale: 0.86 },
  popRadio: { phraseShapes: ["questionAnswer", "staircase"], contours: ["arch", "climbFall"], restBias: 0.08, leapChance: 0.2, ornamentChance: 0.16, durationScale: 0.88 },
  synthPopRadio: { phraseShapes: ["staircase", "syncopatedLoop"], contours: ["wave", "climbFall"], restBias: 0.06, leapChance: 0.24, ornamentChance: 0.18, durationScale: 0.82 },
});

/**
 * Native rhythm sentences for the ensemble conductor. These describe how a
 * genre answers its opening kick cell and approaches a phrase boundary; they
 * are shared by drums and bass instead of being isolated drum probabilities.
 */
export const GENRE_RHYTHM_GRAMMARS = deepFreeze({
  neoSoul: { phrase: "elastic-pocket", responseDelay: 0.75, answerKick: 3.25, turnaround: 3.75, bassAnswer: 2.75 },
  hipHop: { phrase: "sample-pocket", responseDelay: 0.25, answerKick: 2.75, turnaround: 3.5, bassAnswer: 3.25 },
  rap: { phrase: "vocal-space-pocket", responseDelay: 0.5, answerKick: 3.25, turnaround: 3.75, bassAnswer: 2.75 },
  trap: { phrase: "half-time-808", responseDelay: 0.25, answerKick: 3.25, turnaround: 3.75, bassAnswer: 3.5 },
  house: { phrase: "four-floor-lift", responseDelay: 0.5, answerKick: 2.75, turnaround: 3.75, bassAnswer: 3.5 },
  techno: { phrase: "machine-evolution", responseDelay: 0.5, answerKick: 1.75, turnaround: 3.75, bassAnswer: 2.5 },
  drumBass: { phrase: "breakbeat-reply", responseDelay: 0.25, answerKick: 2.75, turnaround: 3.5, bassAnswer: 3.25 },
  synthwave: { phrase: "motorik-lift", responseDelay: 0.5, answerKick: 2.5, turnaround: 3.5, bassAnswer: 3 },
  pop: { phrase: "hook-pocket", responseDelay: 0.5, answerKick: 2.75, turnaround: 3.5, bassAnswer: 3.25 },
  loFiHipHop: { phrase: "dusty-drag", responseDelay: 0.75, answerKick: 2.75, turnaround: 3.25, bassAnswer: 3 },
  rnbSoul: { phrase: "vocal-pocket", responseDelay: 0.75, answerKick: 3.25, turnaround: 3.75, bassAnswer: 2.75 },
  drill: { phrase: "sliding-half-time", responseDelay: 0.25, answerKick: 2.75, turnaround: 3.75, bassAnswer: 3.5 },
  reggaeton: { phrase: "dembow-reply", responseDelay: 0.5, answerKick: 2.5, turnaround: 3.5, bassAnswer: 3.25 },
  afrobeats: { phrase: "cross-rhythm", responseDelay: 0.75, answerKick: 2.75, turnaround: 3.75, bassAnswer: 3.25 },
  jazz: { phrase: "ride-conversation", responseDelay: 0.75, answerKick: 2.5, turnaround: 3.5, bassAnswer: 3 },
  ambient: { phrase: "slow-breath", responseDelay: 1, answerKick: 2.5, turnaround: 3.5, bassAnswer: 3 },
  funk: { phrase: "sixteenth-pocket", responseDelay: 0.25, answerKick: 2.75, turnaround: 3.75, bassAnswer: 3.25 },
  country: { phrase: "train-beat", responseDelay: 0.5, answerKick: 2.5, turnaround: 3.5, bassAnswer: 3 },
  rock: { phrase: "live-backbeat", responseDelay: 0.5, answerKick: 2.75, turnaround: 3.5, bassAnswer: 3.25 },
  popRadio: { phrase: "radio-hook-pulse", responseDelay: 0.5, answerKick: 2.75, turnaround: 3.5, bassAnswer: 3.25 },
  synthPopRadio: { phrase: "synth-drive", responseDelay: 0.5, answerKick: 2.5, turnaround: 3.5, bassAnswer: 3.0 },
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function unit(value, fallback) {
  let number = finite(value, fallback);
  if (number > 1 && number <= 100) number /= 100;
  return clamp(number, 0, 1);
}

function round(value, places = 6) {
  const power = 10 ** places;
  return Math.round((value + Number.EPSILON) * power) / power;
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function hashSeed(seed) {
  const text = String(seed ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
}

/** Create a small deterministic random source with forkable sub-streams. */
export function createSeededRandom(seed) {
  const rootSeed = String(seed ?? "midi-arcade");
  let state = hashSeed(rootSeed) || 0x6d2b79f5;

  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed: rootSeed,
    float: random,
    int(min, max) {
      const low = Math.ceil(Math.min(min, max));
      const high = Math.floor(Math.max(min, max));
      return low + Math.floor(random() * (high - low + 1));
    },
    bool(probability = 0.5) {
      return random() < clamp(probability, 0, 1);
    },
    pick(values) {
      if (!Array.isArray(values) || values.length === 0) return undefined;
      return values[Math.floor(random() * values.length)];
    },
    weighted(entries) {
      const usable = entries.filter((entry) => entry && finite(entry[1], 0) > 0);
      if (!usable.length) return undefined;
      const total = usable.reduce((sum, entry) => sum + entry[1], 0);
      let cursor = random() * total;
      for (const [value, weight] of usable) {
        cursor -= weight;
        if (cursor <= 0) return value;
      }
      return usable[usable.length - 1][0];
    },
    shuffle(values) {
      const result = [...values];
      for (let index = result.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [result[index], result[other]] = [result[other], result[index]];
      }
      return result;
    },
    fork(label) {
      return createSeededRandom(`${rootSeed}::${String(label)}`);
    },
  };
}

function randomSeed() {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.getRandomValues) {
    const words = new Uint32Array(3);
    cryptoObject.getRandomValues(words);
    return `arcade-${Array.from(words, (word) => word.toString(36)).join("-")}`;
  }
  return `arcade-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function normalizeKey(value) {
  if (Number.isFinite(Number(value)) && String(value).trim() !== "") {
    const pc = mod(Math.round(Number(value)), 12);
    return { name: SHARP_NAMES[pc], pc };
  }
  const raw = String(value ?? "C").trim().replace(/♯/g, "#").replace(/♭/g, "b");
  const formatted = raw ? `${raw[0].toUpperCase()}${raw.slice(1)}` : "C";
  const lookup = formatted.toUpperCase();
  const pc = NOTE_TO_PC[lookup] ?? 0;
  const name = Object.prototype.hasOwnProperty.call(NOTE_TO_PC, lookup) ? formatted : "C";
  return { name, pc };
}

function normalizeScale(value) {
  const token = String(value ?? "minor").replace(/[\s_-]/g, "").toLowerCase();
  return SCALE_ALIASES[token] ?? "minor";
}

const CREATIVE_MOTIF_MUTATIONS = new Set([
  "literal-recall",
  "answer",
  "rhythmic-mutation",
  "truncate-expand",
  "instrument-handoff",
  "contour-rewrite",
]);
const CREATIVE_SPOTLIGHT_ROTATIONS = new Set([
  "lead-led",
  "bass-to-lead",
  "chords-to-lead",
  "counterpoint-to-hook",
  "section-rotation",
]);

function normalizeCreativeStrategyToken(value, allowed) {
  const token = String(value ?? "").trim();
  return allowed.has(token) ? token : null;
}

function normalizeCreativeMotifMutation(value) {
  return normalizeCreativeStrategyToken(value, CREATIVE_MOTIF_MUTATIONS);
}

function normalizeCreativeSpotlightRotation(value) {
  return normalizeCreativeStrategyToken(value, CREATIVE_SPOTLIGHT_ROTATIONS);
}

export function defaultChordPathForGenre(genre) {
  if (["neoSoul", "hipHop", "loFiHipHop", "rnbSoul", "afrobeats"].includes(genre)) return "soul";
  if (["jazz", "ambient"].includes(genre)) return "jazz";
  if (["rap", "trap", "drill"].includes(genre)) return "trap";
  if (["house", "techno", "drumBass", "synthwave", "reggaeton"].includes(genre)) return "house";
  return "pop";
}

function normalizeChordPath(value, fallback = DEFAULT_CONFIG.chordPath) {
  const token = String(value ?? fallback).replace(/[\s_-]/g, "").toLowerCase();
  return CHORD_PATH_ALIASES[token] ?? fallback;
}

function normalizeGenre(value) {
  const token = String(value ?? DEFAULT_CONFIG.genre).replace(/[\s_&/+-]/g, "").toLowerCase();
  return GENRE_ALIASES[token] ?? DEFAULT_CONFIG.genre;
}

function normalizeTimeSignature(value) {
  let numerator = 4;
  let denominator = 4;
  if (Array.isArray(value)) {
    [numerator, denominator] = value;
  } else if (typeof value === "string" && value.includes("/")) {
    [numerator, denominator] = value.split("/");
  } else if (value && typeof value === "object") {
    numerator = value.numerator ?? value.beats ?? 4;
    denominator = value.denominator ?? value.beatUnit ?? 4;
  }
  numerator = clamp(Math.round(finite(numerator, 4)), 2, 12);
  denominator = [2, 4, 8, 16].includes(Number(denominator)) ? Number(denominator) : 4;
  return [numerator, denominator];
}

function normalizeTrack(id, input = {}, profile = GENRE_PROFILES[DEFAULT_CONFIG.genre], rng = null) {
  input = input && typeof input === "object" ? input : {};
  const defaults = TRACK_DEFINITIONS[id];
  const explicitlyProgrammed = Object.prototype.hasOwnProperty.call(input, "program") && input.program != null;
  const palette = curateTrackProgramPalette(id, profile.instrumentPrograms[id] ?? [defaults.program], {
    limit: (profile.instrumentPrograms[id] ?? []).length || 1,
  });
  const paletteProgram = rng?.pick(palette) ?? palette[0] ?? defaults.program;
  const program = clamp(Math.round(finite(explicitlyProgrammed ? input.program : paletteProgram, defaults.program)), 0, 127);
  return {
    name: String(input.name ?? defaults.name).slice(0, 80),
    type: defaults.type,
    channel: defaults.channel,
    program,
    octave: id === "drums"
      ? 0
      : clamp(Math.round(finite(input.octave, defaults.octave)), 0, 8),
    density: unit(input.density, defaults.density),
    variation: unit(input.variation, defaults.variation),
    volume: unit(input.volume, defaults.volume),
    velocity: clamp(finite(input.velocity, defaults.velocity), 0.1, 1.5),
    pan: clamp(finite(input.pan, defaults.pan), -1, 1),
    reverb: unit(input.reverb, defaults.reverb),
    cutoff: clamp(finite(input.cutoff, defaults.cutoff), 1000, 14000),
    resonance: unit(input.resonance, defaults.resonance),
    gate: clamp(finite(input.gate, defaults.gate), 0.08, 1.5),
    humanize: unit(input.humanize, defaults.humanize),
    feel: unit(input.feel, defaults.feel),
    mute: Boolean(input.mute),
    solo: Boolean(input.solo),
  };
}

export function createFusedGenreProfile(primaryGenreId, secondaryGenreId, blendRatio = 0.5) {
  const primary = GENRE_PROFILES[normalizeGenre(primaryGenreId)] || GENRE_PROFILES[DEFAULT_CONFIG.genre];
  if (!secondaryGenreId || normalizeGenre(secondaryGenreId) === primary.id) {
    return primary;
  }
  const secondary = GENRE_PROFILES[normalizeGenre(secondaryGenreId)] || primary;
  const ratio = clamp(Number(blendRatio), 0, 1);
  const blend = (a, b) => a * (1 - ratio) + b * ratio;

  const minBpm = Math.round(blend(primary.bpm.min, secondary.bpm.min));
  const maxBpm = Math.round(blend(primary.bpm.max, secondary.bpm.max));
  const defaultBpm = Math.round(blend(primary.bpm.default, secondary.bpm.default));

  const preferredScales = Array.from(new Set([...(primary.preferredScales || []), ...(secondary.preferredScales || [])]));

  const blendWeights = (primaryWeights = {}, secondaryWeights = {}) => {
    const keys = new Set([...Object.keys(primaryWeights), ...Object.keys(secondaryWeights)]);
    const result = {};
    for (const key of keys) {
      const p = primaryWeights[key] ?? 0;
      const s = secondaryWeights[key] ?? 0;
      result[key] = Number((p * (1 - ratio * 0.6) + s * (ratio * 0.6)).toFixed(3));
    }
    return result;
  };

  const grooveWeights = {
    drumGroove: blendWeights(primary.grooveWeights?.drumGroove, secondary.grooveWeights?.drumGroove),
    bassGroove: blendWeights(primary.grooveWeights?.bassGroove, secondary.grooveWeights?.bassGroove),
    chordMotion: blendWeights(primary.grooveWeights?.chordMotion, secondary.grooveWeights?.chordMotion),
  };

  const instrumentPrograms = {};
  for (const trackId of ["drums", "bass", "chords", "melody", "counterpoint", "pad"]) {
    const pProgs = primary.instrumentPrograms?.[trackId] ?? [];
    const sProgs = secondary.instrumentPrograms?.[trackId] ?? [];
    const orderedProgs = ratio >= 0.6 ? [...sProgs, ...pProgs] : [...pProgs, ...sProgs];
    instrumentPrograms[trackId] = mergeTrackProgramPalettes(trackId, orderedProgs);
  }

  return {
    id: `${primary.id}_${secondary.id}`,
    label: `${primary.label} / ${secondary.label}`,
    isFusion: true,
    primaryGenre: primary.id,
    secondaryGenre: secondary.id,
    blendRatio: ratio,
    bpm: { min: minBpm, max: maxBpm, default: defaultBpm },
    preferredScales,
    grooveWeights,
    swing: Number(blend(primary.swing, secondary.swing).toFixed(3)),
    syncopation: Number(blend(primary.syncopation, secondary.syncopation).toFixed(3)),
    humanize: Number(blend(primary.humanize, secondary.humanize).toFixed(3)),
    chordExtensions: Number(blend(primary.chordExtensions, secondary.chordExtensions).toFixed(3)),
    harmonicRhythm: Number(blend(primary.harmonicRhythm, secondary.harmonicRhythm).toFixed(3)),
    instrumentPrograms,
    tripletChance: Number(blend(primary.tripletChance, secondary.tripletChance).toFixed(3)),
    snareRollChance: Number(blend(primary.snareRollChance, secondary.snareRollChance).toFixed(3)),
    halfTime: ratio >= 0.6 ? secondary.halfTime : primary.halfTime,
    arrangement: {
      form: ratio >= 0.6 ? secondary.arrangement.form : primary.arrangement.form,
      chorusLift: Number(blend(primary.arrangement.chorusLift, secondary.arrangement.chorusLift).toFixed(3)),
      fillFrequency: Number(blend(primary.arrangement.fillFrequency, secondary.arrangement.fillFrequency).toFixed(3)),
      phraseBars: Math.round(blend(primary.arrangement.phraseBars, secondary.arrangement.phraseBars)),
    },
  };
}

/** Normalize permissive UI values into the engine's stable configuration. */
export function normalizeConfig(input = {}) {
  const seed = String(input.seed ?? DEFAULT_CONFIG.seed);
  const primaryGenre = normalizeGenre(input.genre ?? input.styleGenre ?? DEFAULT_CONFIG.genre);
  const secondaryGenre = input.secondaryGenre ? normalizeGenre(input.secondaryGenre) : null;
  const genre = primaryGenre;
  const fusionBlend = clamp(finite(input.fusionBlend, 0.5), 0, 1);
  const profile = (secondaryGenre && secondaryGenre !== primaryGenre)
    ? createFusedGenreProfile(primaryGenre, secondaryGenre, fusionBlend)
    : GENRE_PROFILES[primaryGenre];
  const professionalUpgrade = Boolean(input.professionalUpgrade);
  const arrangementProfile = (secondaryGenre && secondaryGenre !== primaryGenre)
    ? fusedGenreArrangementProfile(primaryGenre, secondaryGenre, fusionBlend)
    : genreArrangementProfile(primaryGenre);
  const key = normalizeKey(input.key ?? DEFAULT_CONFIG.key);
  const suppliedScale = input.scale ?? input.mode;
  const scaleDefault = profile.preferredScales[hashSeed(`${seed}::${genre}::scale`) % profile.preferredScales.length];
  const scale = normalizeScale(suppliedScale ?? scaleDefault);
  const chordPath = normalizeChordPath(input.chordPath, defaultChordPathForGenre(primaryGenre));
  const timeSignature = normalizeTimeSignature(input.timeSignature ?? DEFAULT_CONFIG.timeSignature);
  const providedTracks = input.tracks ?? input.trackSettings ?? input.instruments ?? {};
  const tracks = {};
  const paletteRng = createSeededRandom(`${seed}::${genre}::palette`);
  for (const id of TRACK_IDS) tracks[id] = normalizeTrack(id, providedTracks[id], profile, paletteRng.fork(id));
  const averageTrackDensity = TRACK_IDS.reduce((sum, id) => sum + finite(tracks[id]?.density, 0.5), 0) / TRACK_IDS.length;
  const mood = typeof input.mood === "string" && ["calm", "neutral", "intense"].includes(input.mood)
    ? input.mood
    : moodFromEnergy(unit(input.energy, DEFAULT_CONFIG.energy));
  const layeringMode = String(input.layeringMode ?? input.layering ?? input.arrangementLayering ?? (professionalUpgrade ? "auto" : "off"));
  const layeringDensity = layerDensityMode(layeringMode, unit(input.variation, DEFAULT_CONFIG.variation), averageTrackDensity);
  const phraseBars = professionalUpgrade
    ? (arrangementProfile.phraseBars[
      hashSeed(`${seed}::${genre}::phrase-bars`) % arrangementProfile.phraseBars.length
    ] ?? profile.arrangement.phraseBars)
    : profile.arrangement.phraseBars;
  const creativeMotifMutation = normalizeCreativeMotifMutation(input.creativeMotifMutation);
  const creativeSpotlightRotation = normalizeCreativeSpotlightRotation(input.creativeSpotlightRotation);
  const creativeMotifStrength = clamp(finite(input.creativeMotifStrength, 0), 0, 1.3);
  const creativeMotifMaxEvents = clamp(Math.round(finite(input.creativeMotifMaxEvents, 0)), 0, 2);

  return {
    seed,
    genre,
    secondaryGenre,
    fusionBlend,
    isFusion: Boolean(profile.isFusion),
    professionalUpgrade,
    genreLabel: profile.label,
    arrangementProfileId: arrangementProfile.id,
    chordPath,
    key: key.name,
    keyPc: key.pc,
    scale,
    scaleIntervals: [...SCALES[scale]],
    tempo: clamp(round(finite(input.tempo == null || input.tempo === "" ? profile.bpm.default : input.tempo, profile.bpm.default), 3), 30, 300),
    bars: clamp(Math.round(finite(input.bars, DEFAULT_CONFIG.bars)), 1, 128),
    phraseBars: clamp(Math.round(finite(input.phraseBars, phraseBars)), 2, 8),
    timeSignature,
    mood,
    energy: unit(input.energy, DEFAULT_CONFIG.energy),
    complexity: unit(input.complexity, DEFAULT_CONFIG.complexity),
    variation: unit(input.variation, DEFAULT_CONFIG.variation),
    evolution: unit(input.evolution, DEFAULT_CONFIG.evolution),
    surprise: unit(input.surprise, DEFAULT_CONFIG.surprise),
    similarity: unit(input.similarity, DEFAULT_CONFIG.similarity),
    swing: unit(input.swing, profile.swing),
    humanize: unit(input.humanize, profile.humanize),
    syncopation: unit(input.syncopation, profile.syncopation),
    harmonicRhythm: unit(input.harmonicRhythm, profile.harmonicRhythm),
    chordExtensions: unit(input.chordExtensions, profile.chordExtensions),
    melodicRange: clamp(Math.round(finite(input.melodicRange, DEFAULT_CONFIG.melodicRange)), 5, 36),
    drumFills: unit(input.drumFills, DEFAULT_CONFIG.drumFills),
    tripletAmount: unit(input.tripletAmount, profile.tripletChance),
    rollAmount: unit(input.rollAmount, profile.snareRollChance),
    registerSpread: unit(input.registerSpread, DEFAULT_CONFIG.registerSpread),
    arrangementLayers: {
      mode: layeringMode,
      density: round(layeringDensity),
      enabled: professionalUpgrade && layeringDensity > 0.01,
    },
    oneShotKitId: input.oneShotKitId == null && input.soundKitId == null
      ? null
      : String(input.oneShotKitId ?? input.soundKitId).slice(0, 80),
    excludeOneShotKitIds: [...new Set(
      (Array.isArray(input.excludeOneShotKitIds) ? input.excludeOneShotKitIds : [])
        .map((id) => String(id))
        .filter(Boolean),
    )].slice(0, 32),
    title: input.title == null ? null : String(input.title).slice(0, 100),
    ...(creativeMotifMutation ? { creativeMotifMutation } : {}),
    ...(creativeSpotlightRotation ? { creativeSpotlightRotation } : {}),
    ...(creativeMotifMutation || creativeSpotlightRotation ? {
      creativeMotifStrength,
      creativeMotifMaxEvents,
    } : {}),
    tracks,
  };
}

function arrangementProfileForConfig(config = {}) {
  const primaryGenre = String(config.genre ?? DEFAULT_CONFIG.genre);
  const secondaryGenre = config.secondaryGenre ? String(config.secondaryGenre) : null;
  return secondaryGenre && secondaryGenre !== primaryGenre
    ? fusedGenreArrangementProfile(primaryGenre, secondaryGenre, config.fusionBlend)
    : genreArrangementProfile(primaryGenre);
}

function beatsPerBar(config) {
  return config.timeSignature[0] * (4 / config.timeSignature[1]);
}

function allocateBars(items, bars) {
  if (items.length === 1) return [bars];
  const minimum = items.map(() => 1);
  let remaining = Math.max(0, bars - items.length);
  const weightTotal = items.reduce((sum, item) => sum + item.weight, 0);
  const exact = items.map((item) => (remaining * item.weight) / weightTotal);
  const result = minimum.map((value, index) => value + Math.floor(exact[index]));
  remaining -= exact.reduce((sum, value) => sum + Math.floor(value), 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remaining; index += 1) result[order[index % order.length].index] += 1;
  return result;
}

// Keep major sections on a phrase-sized grid when the song is long enough to
// support a real song form. Transition sections may be two bars; verse and
// hook sections get four-bar minimum cells and grow in four-bar increments.
function allocatePhraseGridBars(items, bars) {
  const transitionNames = new Set(["intro", "prechorus", "build", "bridge", "breakdown", "outro"]);
  const minimum = items.map((item) => transitionNames.has(item.name) ? 2 : 4);
  const minimumTotal = minimum.reduce((sum, value) => sum + value, 0);
  const remaining = bars - minimumTotal;
  if (remaining < 0 || remaining % 2 !== 0) return allocateBars(items, bars);

  const result = [...minimum];
  const increments = Math.floor(remaining / 4);
  if (!increments) return result;

  const weightTotal = items.reduce((sum, item) => sum + item.weight, 0);
  const exact = items.map((item) => (increments * item.weight) / Math.max(0.001, weightTotal));
  const whole = exact.map((value) => Math.floor(value));
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const unassigned = increments - whole.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < unassigned; index += 1) whole[order[index % order.length].index] += 1;
  for (let index = 0; index < result.length; index += 1) result[index] += whole[index] * 4;
  if (remaining % 4 === 2) {
    const transitionIndex = items
      .map((item, index) => ({ index, weight: item.weight, transition: transitionNames.has(item.name) }))
      .filter((item) => item.transition)
      .sort((a, b) => b.weight - a.weight || a.index - b.index)[0]?.index;
    if (transitionIndex === undefined) return allocateBars(items, bars);
    result[transitionIndex] += 2;
  }
  return result;
}

const SPECIAL_FORM_LAYOUTS = deepFreeze({
  "trap-song": {
    short: [{ name: "verse", weight: 1 }, { name: "chorus", weight: 1.2 }],
    compact: [
      { name: "intro", weight: 0.6 }, { name: "verse", weight: 1.8 },
      { name: "chorus", weight: 1.8 }, { name: "outro", weight: 0.6 },
    ],
    medium: [
      { name: "intro", weight: 0.6 }, { name: "chorus", weight: 1.2 },
      { name: "verse", weight: 1.6 }, { name: "chorus", weight: 1.2 },
      { name: "outro", weight: 0.5 },
    ],
    full: [
      { name: "intro", weight: 0.6 }, { name: "verse", weight: 2.4 },
      { name: "prechorus", weight: 0.7 }, { name: "chorus", weight: 2.4 },
      { name: "verse", weight: 1.8 }, { name: "bridge", weight: 0.8 },
      { name: "chorus", weight: 2.2 }, { name: "outro", weight: 0.6 },
    ],
  },
  "half-time": {
    short: [{ name: "chorus", weight: 1.2 }, { name: "verse", weight: 1 }],
    medium: [
      { name: "intro", weight: 0.6 }, { name: "chorus", weight: 1.2 },
      { name: "verse", weight: 1.6 }, { name: "chorus", weight: 1.2 },
      { name: "outro", weight: 0.5 },
    ],
    full: [
      { name: "intro", weight: 0.7 }, { name: "chorus", weight: 1.5 },
      { name: "verse", weight: 2.5 }, { name: "chorus", weight: 1.5 },
      { name: "bridge", weight: 1.2 }, { name: "verse", weight: 2 },
      { name: "chorus", weight: 1.8 }, { name: "outro", weight: 0.7 },
    ],
  },
  loop: {
    short: [{ name: "idea", weight: 2 }, { name: "breakdown", weight: 1 }],
    medium: [
      { name: "intro", weight: 0.8 }, { name: "idea", weight: 2.4 },
      { name: "breakdown", weight: 1 }, { name: "idea", weight: 2 },
      { name: "outro", weight: 0.8 },
    ],
    full: [
      { name: "intro", weight: 0.8 }, { name: "idea", weight: 2.8 },
      { name: "breakdown", weight: 1.2 }, { name: "idea", weight: 2.5 },
      { name: "bridge", weight: 1.4 }, { name: "idea", weight: 2.8 },
      { name: "outro", weight: 0.8 },
    ],
  },
  "head-solos": {
    short: [{ name: "theme", weight: 1.2 }, { name: "solo", weight: 1.8 }],
    medium: [
      { name: "intro", weight: 0.6 }, { name: "theme", weight: 1.2 },
      { name: "solo", weight: 2.4 }, { name: "theme", weight: 1.2 },
      { name: "outro", weight: 0.6 },
    ],
    full: [
      { name: "intro", weight: 0.7 }, { name: "theme", weight: 1.4 },
      { name: "solo", weight: 2.4 }, { name: "solo", weight: 2.4 },
      { name: "bridge", weight: 1.2 }, { name: "theme", weight: 1.5 },
      { name: "outro", weight: 0.7 },
    ],
  },
  evolving: {
    short: [{ name: "idea", weight: 1.4 }, { name: "breakdown", weight: 1 }],
    medium: [
      { name: "intro", weight: 1.3 }, { name: "idea", weight: 2 },
      { name: "breakdown", weight: 1.5 }, { name: "theme", weight: 1.8 },
      { name: "outro", weight: 1.3 },
    ],
    full: [
      { name: "intro", weight: 1.5 }, { name: "idea", weight: 2.2 },
      { name: "breakdown", weight: 1.8 }, { name: "theme", weight: 2.4 },
      { name: "breakdown", weight: 1.5 }, { name: "idea", weight: 2 },
      { name: "outro", weight: 1.5 },
    ],
  },
  "story-song": {
    short: [{ name: "verse", weight: 1.4 }, { name: "chorus", weight: 1 }],
    medium: [
      { name: "intro", weight: 0.6 }, { name: "verse", weight: 2 },
      { name: "chorus", weight: 1.2 }, { name: "verse", weight: 1.8 },
      { name: "outro", weight: 0.6 },
    ],
    full: [
      { name: "intro", weight: 0.6 }, { name: "verse", weight: 2.3 },
      { name: "chorus", weight: 1.4 }, { name: "verse", weight: 2.3 },
      { name: "bridge", weight: 1.3 }, { name: "verse", weight: 2.1 },
      { name: "chorus", weight: 1.6 }, { name: "outro", weight: 0.6 },
    ],
  },
  anthem: {
    short: [{ name: "verse", weight: 1 }, { name: "chorus", weight: 1.4 }],
    medium: [
      { name: "intro", weight: 0.6 }, { name: "verse", weight: 1.6 },
      { name: "chorus", weight: 2 }, { name: "bridge", weight: 1 },
      { name: "chorus", weight: 1.8 }, { name: "outro", weight: 0.6 },
    ],
    full: [
      { name: "intro", weight: 0.7 }, { name: "verse", weight: 2 },
      { name: "chorus", weight: 2.2 }, { name: "verse", weight: 1.8 },
      { name: "bridge", weight: 1.3 }, { name: "chorus", weight: 2.3 },
      { name: "chorus", weight: 1.5 }, { name: "outro", weight: 0.7 },
    ],
  },
  groove: {
    short: [{ name: "verse", weight: 1.5 }, { name: "chorus", weight: 1 }],
    medium: [
      { name: "intro", weight: 0.6 }, { name: "verse", weight: 2.1 },
      { name: "chorus", weight: 1.3 }, { name: "verse", weight: 1.8 },
      { name: "outro", weight: 0.6 },
    ],
    full: [
      { name: "intro", weight: 0.6 }, { name: "verse", weight: 2.4 },
      { name: "chorus", weight: 1.4 }, { name: "verse", weight: 2.2 },
      { name: "bridge", weight: 1.3 }, { name: "verse", weight: 2 },
      { name: "chorus", weight: 1.5 }, { name: "outro", weight: 0.6 },
    ],
  },
});

function specialFormLayout(form, bars) {
  const template = SPECIAL_FORM_LAYOUTS[form];
  if (!template || bars <= 4) return null;
  return clone(bars <= 8 ? template.short : bars <= 12 && template.compact ? template.compact : bars <= 16 ? template.medium : template.full);
}

function createStructure(config, rng) {
  const bars = config.bars;
  const form = GENRE_PROFILES[config.genre].arrangement.form;
  // Reggaeton also has a club-ready profile, but its verse/chorus form must not
  // be mistaken for a House/Techno build-drop arrangement.
  const electronic = ["house", "techno", "drumBass"].includes(config.genre);
  const phraseGridGenre = ["trap", "hipHop", "pop", "neoSoul"].includes(config.genre);
  let layout = specialFormLayout(form, bars);
  if (layout) {
    // The selected form is scaled below by allocateBars().
  } else if (bars <= 2) layout = [{ name: "theme", weight: 1 }];
  else if (bars <= 4) layout = [{ name: "idea", weight: 1 }];
  else if (bars <= 7) layout = electronic
    ? [{ name: "build", weight: 1 }, { name: "drop", weight: 1.5 }]
    : [{ name: "verse", weight: 1 }, { name: "chorus", weight: 1 }];
  else if (bars <= 12) {
    layout = electronic
      ? [{ name: "intro", weight: 1 }, { name: "build", weight: 1 }, { name: "drop", weight: 2.5 }, { name: "outro", weight: 1 }]
      : [{ name: "intro", weight: 1 }, { name: "verse", weight: 2 }, { name: "chorus", weight: 2 }, { name: "outro", weight: 1 }];
  } else if (bars <= 20) {
    layout = electronic
      ? [{ name: "intro", weight: 1 }, { name: "build", weight: 1 }, { name: "drop", weight: 2.5 }, { name: "breakdown", weight: 1.5 }, { name: "drop", weight: 2.5 }, { name: "outro", weight: 1 }]
      : bars >= 18
        ? [
            { name: "intro", weight: 0.75 }, { name: "verse", weight: 2 },
            { name: "prechorus", weight: 0.75 }, { name: "chorus", weight: 1.65 },
            { name: "verse", weight: 1.5 }, { name: "bridge", weight: 1 },
            { name: "chorus", weight: 1.75 }, { name: "outro", weight: 0.6 },
          ]
        : [
            { name: "intro", weight: 0.7 }, { name: "verse", weight: 1.8 },
            { name: "prechorus", weight: 0.7 }, { name: "chorus", weight: 1.6 },
            { name: "bridge", weight: 0.9 }, { name: "chorus", weight: 1.8 },
            { name: "outro", weight: 0.6 },
          ];
  } else {
    const alternate = rng.bool(form === "half-time" ? 0.58 : 0.35);
    layout = electronic
      ? [
          { name: "intro", weight: 1 }, { name: "build", weight: 1 }, { name: "drop", weight: 3 },
          { name: "breakdown", weight: 2 }, { name: "build", weight: 1 }, { name: "drop", weight: 3 },
          { name: "outro", weight: 1 },
        ]
      : alternate
      ? [
          { name: "intro", weight: 1 },
          { name: "verse", weight: 3 },
          { name: "chorus", weight: 3 },
          { name: "verse", weight: 3 },
          { name: "bridge", weight: 2 },
          { name: "chorus", weight: 3 },
          { name: "outro", weight: 1 },
        ]
      : [
          { name: "intro", weight: 1 },
          { name: "verse", weight: 3 },
          { name: "prechorus", weight: 1 },
          { name: "chorus", weight: 3 },
          { name: "verse", weight: 3 },
          { name: "bridge", weight: 2 },
          { name: "chorus", weight: 3 },
          { name: "outro", weight: 1 },
        ];
  }

  if (bars < layout.length) layout = layout.slice(0, bars);
  const sizes = bars >= 16 && !electronic && phraseGridGenre
    ? allocatePhraseGridBars(layout, bars)
    : allocateBars(layout, bars);
  const occurrences = {};
  const barBeats = beatsPerBar(config);
  let startBar = 0;
  return layout.map((item, index) => {
    occurrences[item.name] = (occurrences[item.name] ?? 0) + 1;
    const section = {
      id: `${item.name}-${occurrences[item.name]}`,
      name: item.name,
      startBar,
      bars: sizes[index],
      startBeat: round(startBar * barBeats),
      endBeat: round((startBar + sizes[index]) * barBeats),
      intensity: sectionIntensity(item.name),
    };
    startBar += sizes[index];
    return section;
  });
}

function adaptStructure(source, config) {
  if (!Array.isArray(source) || source.length === 0) return null;
  const valid = source
    .map((section) => ({
      name: String(section.name ?? "idea").toLowerCase(),
      bars: Math.max(1, Math.round(finite(section.bars, 1))),
    }))
    .filter((section) => section.bars > 0);
  if (!valid.length) return null;
  let selected = valid;
  if (config.bars < selected.length) selected = selected.slice(0, config.bars);
  const sourceTotal = selected.reduce((sum, item) => sum + item.bars, 0);
  const sizes = sourceTotal === config.bars
    ? selected.map((item) => item.bars)
    : allocateBars(selected.map((item) => ({ ...item, weight: item.bars })), config.bars);
  const occurrences = {};
  const barBeats = beatsPerBar(config);
  let startBar = 0;
  return selected.map((item, index) => {
    occurrences[item.name] = (occurrences[item.name] ?? 0) + 1;
    const result = {
      id: `${item.name}-${occurrences[item.name]}`,
      name: item.name,
      startBar,
      bars: sizes[index],
      startBeat: round(startBar * barBeats),
      endBeat: round((startBar + sizes[index]) * barBeats),
      intensity: sectionIntensity(item.name),
    };
    startBar += sizes[index];
    return result;
  });
}

function sectionIntensity(name) {
  return ({ intro: 0.58, verse: 0.78, prechorus: 0.93, chorus: 1.12, bridge: 0.88, build: 0.96, drop: 1.18, breakdown: 0.64, outro: 0.55, idea: 0.9, theme: 0.9, solo: 1.02 })[name] ?? 0.82;
}

const SONG_NARRATIVES = deepFreeze([
  { id: "lift-release", label: "Lift and release", weight: 3.2 },
  { id: "slow-burn", label: "Slow burn", weight: 2.2 },
  { id: "call-response", label: "Call and response", weight: 1.8 },
  { id: "pulse-bloom", label: "Pulse into bloom", weight: 1.6 },
]);

export const COMPOSITION_ROUTES = deepFreeze([
  {
    id: "harmony-first",
    label: "Harmony first",
    priority: "Chord movement leads the melody",
  },
  {
    id: "groove-first",
    label: "Groove first",
    priority: "The shared pocket leads every entrance",
  },
  {
    id: "hook-first",
    label: "Hook first",
    priority: "A concise hook shapes the arrangement",
  },
]);

function validCompositionRouteId(value) {
  const id = String(value ?? "");
  return COMPOSITION_ROUTES.some((route) => route.id === id) ? id : null;
}

function compositionRoute(id) {
  const selected = COMPOSITION_ROUTES.find((route) => route.id === id) ?? COMPOSITION_ROUTES[0];
  return clone(selected);
}

function candidateCompositionRoute(baseSeed, index, preferred = null) {
  const requested = validCompositionRouteId(preferred);
  if (requested) return requested;
  const offset = hashSeed(`${baseSeed}:composition-route`) % COMPOSITION_ROUTES.length;
  return COMPOSITION_ROUTES[(offset + index) % COMPOSITION_ROUTES.length].id;
}

const PERFORMANCE_FEELS = deepFreeze([
  { id: "tight", label: "Tight pocket", weight: 2.4, timing: 0.42, velocity: 0.56 },
  { id: "laid-back", label: "Laid-back pocket", weight: 2, timing: 0.68, velocity: 0.66 },
  { id: "live", label: "Live push and pull", weight: 1.35, timing: 0.86, velocity: 0.82 },
]);

function sectionOccurrence(structure, index) {
  const name = structure[index]?.name;
  return structure.slice(0, index + 1).filter((section) => section.name === name).length;
}

function motifTransformForSection(section, index, structure, peakSectionId) {
  const occurrence = sectionOccurrence(structure, index);
  const last = index === structure.length - 1;
  if (last || section.name === "outro") return "resolution";
  if (section.id === peakSectionId) return "climax";
  if (section.name === "intro") return "fragment";
  if (["bridge", "breakdown"].includes(section.name)) return "inversion";
  if (section.name === "solo") return occurrence > 1 ? "climax" : "sequence";
  if (["prechorus", "build"].includes(section.name)) return "sequence";
  if (["chorus", "drop"].includes(section.name)) return occurrence > 1 ? "climax" : "answer";
  if (section.name === "verse") return occurrence > 1 ? "answer" : "statement";
  return index === 0 ? "statement" : "sequence";
}

function developmentPathForTransform(transform) {
  return {
    statement: ["answer", "rhythm", "contour"],
    fragment: ["sequence", "answer", "rhythm"],
    sequence: ["sequence", "contour", "octaveLift"],
    answer: ["answer", "rhythm", "contour"],
    inversion: ["inversion", "rest", "answer"],
    climax: ["climax", "octaveLift", "answer"],
    resolution: ["resolution", "rest", "resolution"],
  }[transform] ?? ["answer", "rhythm", "contour"];
}

function narrativeEnergy(narrativeId, base, progress, index) {
  if (narrativeId === "slow-burn") return clamp(base * 0.78 + progress * 0.28, 0.24, 1);
  if (narrativeId === "call-response") return clamp(base * 0.88 + (index % 2 ? 0.08 : -0.03), 0.24, 1);
  if (narrativeId === "pulse-bloom") return clamp(base * 0.82 + Math.sin(progress * Math.PI) * 0.2, 0.24, 1);
  return clamp(base * 0.9 + (progress < 0.7 ? progress * 0.13 : (1 - progress) * 0.08), 0.24, 1);
}

function harmonicStoryForSection(section, role, cadence, narrativeId, index, last) {
  if (last || role === "release") return { role: "release", color: "grounded", startDegree: 0, goalDegree: 0 };
  if (cadence === "lift") return { role: "tension", color: "dominant", startDegree: index % 2 ? 1 : 3, goalDegree: 4 };
  if (["bridge", "breakdown"].includes(section.name)) {
    return { role: "contrast", color: narrativeId === "slow-burn" ? "shadow" : "modal", startDegree: 5, goalDegree: cadence === "suspend" ? 3 : 4 };
  }
  if (role === "peak") return { role: "climax", color: "radiant", startDegree: 0, goalDegree: cadence === "resolve" ? 0 : 4 };
  if (role === "hook") return { role: "home", color: "open", startDegree: 0, goalDegree: cadence === "resolve" ? 0 : 4 };
  if (index === 0 || role === "statement") return { role: "home", color: "stable", startDegree: 0, goalDegree: cadence === "open" ? 5 : 0 };
  return { role: "departure", color: "wandering", startDegree: index % 2 ? 5 : 3, goalDegree: cadence === "open" ? 1 : 4 };
}

function transitionType(from, to) {
  const delta = to.energy - from.energy;
  if (["bridge", "breakdown"].includes(to.sectionName) || delta < -0.18) return "drop-out";
  if (to.role === "peak" || (["chorus", "drop"].includes(to.sectionName) && delta > 0.04)) return "launch";
  if (from.cadence === "lift" || delta > 0.12) return "build";
  if (to.role === "release" || to.cadence === "resolve") return "resolve";
  return "turnaround";
}

function createPerformanceProfile(config, style, rng, source = null) {
  const sourceFeelId = String(source?.feel?.id ?? "");
  const timingPocket = String(style?.rhythmIdentity?.timingPocket ?? "centered");
  const selected = PERFORMANCE_FEELS.find((feel) => feel.id === sourceFeelId)
    ?? rng.weighted(PERFORMANCE_FEELS.map((feel) => {
      const genreBonus = feel.id === "tight" && ["techno", "house", "synthwave"].includes(config.genre) ? 1.3
        : feel.id === "laid-back" && ["neoSoul", "hipHop", "rap", "loFiHipHop"].includes(config.genre) ? 1.45
          : feel.id === "live" && ["jazz", "funk", "rock", "country"].includes(config.genre) ? 1.4
            : feel.id === "laid-back" && ["rnbSoul", "ambient"].includes(config.genre) ? 1.1
              : feel.id === "tight" && ["trap", "drill", "drumBass"].includes(config.genre) ? 1.1 : 0;
      const pocketBonus = timingPocket === "laidBack" && feel.id === "laid-back" ? 1.1
        : timingPocket === "pushed" && feel.id === "tight" ? 0.8
          : timingPocket === "elastic" && feel.id === "live" ? 0.9 : 0;
      return [feel, feel.weight + genreBonus + pocketBonus];
    }));
  const humanAmount = clamp(config.humanize, 0, 1);
  const timingJitter = round(humanAmount * (0.004 + 0.026 * selected.timing));
  const velocityVariance = round(2 + humanAmount * 10 * selected.velocity);
  const laidBack = selected.id === "laid-back";
  const live = selected.id === "live";
  const pocket = round((0.004 + humanAmount * 0.018) * (laidBack ? 1 : live ? 0.55 : 0.25));
  const phraseOffset = timingPocket === "laidBack" ? pocket
    : timingPocket === "pushed" ? -pocket
      : timingPocket === "elastic" ? round(pocket * 0.55) : 0;
  return {
    version: 1,
    feel: { id: selected.id, label: selected.label },
    timingPocket,
    timingJitter,
    velocityVariance,
    trackOffsets: {
      drums: 0,
      // Bass attacks stay phase-locked to the kick; the surrounding instruments
      // carry the timing pocket so low-frequency transients remain clean.
      bass: 0,
      chords: round((laidBack ? pocket : live ? pocket * 0.45 : 0) + phraseOffset * 0.45),
      melody: round((laidBack ? pocket * 0.72 : live ? pocket * 0.3 : 0) + phraseOffset),
      counterpoint: round((laidBack ? pocket * 0.52 : live ? -pocket * 0.2 : 0) - phraseOffset * 0.55),
      pad: round((laidBack ? pocket * 0.8 : 0) + Math.max(0, phraseOffset) * 0.7),
    },
    articulation: selected.id === "tight" ? "defined" : selected.id === "laid-back" ? "relaxed" : "expressive",
  };
}

const ORCHESTRATION_SHAPES = deepFreeze({
  intro: { drums: 0.52, bass: 0.38, chords: 0.68, melody: 0.48, counterpoint: 0.24, pad: 0.88 },
  verse: { drums: 0.82, bass: 0.78, chords: 0.62, melody: 0.88, counterpoint: 0.34, pad: 0.5 },
  prechorus: { drums: 0.9, bass: 0.84, chords: 0.8, melody: 0.9, counterpoint: 0.42, pad: 0.72 },
  chorus: { drums: 1, bass: 0.96, chords: 0.9, melody: 1, counterpoint: 0.56, pad: 0.82 },
  bridge: { drums: 0.62, bass: 0.58, chords: 0.78, melody: 0.7, counterpoint: 0.72, pad: 0.9 },
  build: { drums: 0.94, bass: 0.8, chords: 0.84, melody: 0.82, counterpoint: 0.42, pad: 0.78 },
  drop: { drums: 1, bass: 1, chords: 0.76, melody: 0.92, counterpoint: 0.5, pad: 0.68 },
  breakdown: { drums: 0.34, bass: 0.38, chords: 0.66, melody: 0.62, counterpoint: 0.68, pad: 0.96 },
  outro: { drums: 0.4, bass: 0.46, chords: 0.62, melody: 0.58, counterpoint: 0.32, pad: 0.78 },
  idea: { drums: 0.82, bass: 0.76, chords: 0.72, melody: 0.9, counterpoint: 0.46, pad: 0.64 },
  theme: { drums: 0.76, bass: 0.8, chords: 0.78, melody: 0.96, counterpoint: 0.42, pad: 0.58 },
  solo: { drums: 0.88, bass: 0.9, chords: 0.7, melody: 0.72, counterpoint: 1, pad: 0.48 },
});

function creativeReturnFeaturedTrack(section, config, occurrence) {
  if (occurrence <= 0 || !["verse", "chorus", "theme", "idea"].includes(section.name)) return null;
  if (config.creativeSpotlightRotation === "lead-led") return "melody";
  if (config.creativeSpotlightRotation === "bass-to-lead") return occurrence % 2 ? "bass" : "melody";
  if (config.creativeSpotlightRotation === "chords-to-lead") return occurrence % 2 ? "chords" : "melody";
  if (config.creativeSpotlightRotation === "counterpoint-to-hook") return occurrence % 2 ? "counterpoint" : "melody";
  return null;
}

function featuredTrackForSection(section, plan, config, occurrence = 0) {
  if (section.name === "intro" || ["breakdown", "outro"].includes(section.name)) return "pad";
  if (section.name === "bridge") return "counterpoint";
  if (section.name === "solo") return occurrence % 2 ? "melody" : "counterpoint";
  if (section.name === "drop") return plan.role === "peak" ? "bass" : "drums";
  if (["prechorus", "build"].includes(section.name)) return "chords";
  const creativeReturn = creativeReturnFeaturedTrack(section, config, occurrence);
  if (creativeReturn) return creativeReturn;
  if (occurrence > 0) {
    const candidates = ["house", "techno", "drumBass", "trap", "drill", "funk", "rock"].includes(config.genre)
      ? ["bass", "drums", "counterpoint"]
      : ["neoSoul", "rnbSoul", "jazz", "loFiHipHop"].includes(config.genre)
        ? ["chords", "counterpoint", "bass"]
        : ["counterpoint", "bass", "chords"];
    return candidates[hashSeed(`${config.seed}|${section.name}|feature-return|${occurrence}`) % candidates.length];
  }
  return "melody";
}

function createOrchestrationMatrix(config, structure, sectionPlans, source = null) {
  const occurrences = new Map();
  return structure.map((section, index) => {
    const plan = sectionPlans[index];
    const occurrence = occurrences.get(section.name) ?? 0;
    occurrences.set(section.name, occurrence + 1);
    const inherited = source?.orchestrationMatrix?.find((entry) => entry.sectionId === section.id)
      ?? source?.orchestrationMatrix?.find((entry) => entry.sectionName === section.name);
    const creativeReturn = occurrence > 0
      && Boolean(config.creativeSpotlightRotation)
      && ["verse", "chorus", "theme", "idea"].includes(section.name);
    if (inherited?.lanes && !creativeReturn) return clone(inherited);
    const shape = ORCHESTRATION_SHAPES[section.name] ?? ORCHESTRATION_SHAPES.idea;
    const featuredTrack = featuredTrackForSection(section, plan, config, occurrence);
    const lanes = Object.fromEntries(TRACK_IDS.map((id) => {
      const base = finite(shape[id], 0.7);
      const energyFactor = 0.82 + plan.energy * 0.24;
      const featured = id === featuredTrack;
      const presence = round(clamp(base * energyFactor + (featured ? 0.08 : 0), 0.18, 1));
      const registerShift = ["melody", "counterpoint", "chords", "pad"].includes(id)
        ? (featured ? plan.registerLift : 0)
        : 0;
      return [id, {
        presence,
        velocity: round(clamp(0.82 + plan.energy * 0.18 + (featured ? 0.06 : 0), 0.72, 1.08)),
        registerShift,
        role: featured ? "feature" : ["drums", "bass"].includes(id) ? "foundation" : presence < 0.46 ? "space" : "support",
      }];
    }));
    return {
      sectionId: section.id,
      sectionName: section.name,
      featuredTrack,
      featureOccurrence: occurrence,
      lanes,
    };
  });
}

const PRODUCER_PURPOSES = deepFreeze({
  intro: "establish",
  verse: "develop",
  prechorus: "build",
  chorus: "payoff",
  bridge: "contrast",
  build: "build",
  drop: "payoff",
  breakdown: "reset",
  outro: "resolve",
  idea: "establish",
  theme: "payoff",
  solo: "spotlight",
});

function answerTrackForForeground(foregroundTrack, section, config) {
  if (foregroundTrack === "melody") return "counterpoint";
  if (foregroundTrack === "counterpoint") return "melody";
  if (["bass", "drums"].includes(foregroundTrack)) {
    return ["house", "techno", "drumBass", "trap", "drill"].includes(config.genre)
      ? "chords"
      : "melody";
  }
  if (foregroundTrack === "chords") return "melody";
  return ["breakdown", "outro"].includes(section.name) ? "counterpoint" : "melody";
}

/**
 * Create one compact creative brief shared by every generator. Local track
 * rules can still express the genre, but they must agree on who owns the
 * listener's attention and where the arrangement intentionally leaves room.
 */
function createProducerIntentContract(
  config,
  structure,
  sectionPlans,
  orchestrationMatrix,
  narrative,
  hookSectionId,
  peakSectionId,
  songDNA = null,
) {
  const matrixBySection = new Map(orchestrationMatrix.map((entry) => [entry.sectionId, entry]));
  const returnAxes = ["rhythm", "density", "register", "dialogue"];
  const scenes = structure.map((section, index) => {
    const plan = sectionPlans[index];
    const matrix = matrixBySection.get(section.id);
    const foregroundTrack = matrix?.featuredTrack ?? "melody";
    const answerTrack = answerTrackForForeground(foregroundTrack, section, config);
    const purpose = PRODUCER_PURPOSES[section.name]
      ?? (plan.role === "peak" ? "payoff" : plan.role === "release" ? "resolve" : "develop");
    const returnIndex = finite(matrix?.featureOccurrence, 0);
    const developmentAxis = returnIndex > 0
      ? returnAxes[hashSeed(`${config.seed}|${section.name}|${returnIndex}|development-axis`) % returnAxes.length]
      : purpose === "build" ? "tension"
        : purpose === "payoff" ? "hook"
          : purpose === "reset" ? "space"
            : purpose === "resolve" ? "release"
              : "statement";
    const silenceBudget = round(clamp(
      purpose === "reset" ? 0.34
        : purpose === "establish" ? 0.24
          : purpose === "resolve" ? 0.28
            : purpose === "contrast" ? 0.2
              : purpose === "payoff" ? 0.07
                : 0.13,
      0.05,
      0.4,
    ));
    const roles = Object.fromEntries(TRACK_IDS.map((id) => {
      const lane = matrix?.lanes?.[id];
      let role = "support";
      if (id === foregroundTrack) role = "foreground";
      else if (id === answerTrack) role = "answer";
      else if (["drums", "bass"].includes(id)) role = "foundation";
      else if (id === "pad") role = lane?.presence < 0.5 || purpose === "payoff" ? "texture" : "support";
      if (
        role === "support"
        && lane?.presence < 0.47
        && finite(matrix?.featureOccurrence, 0) === 0
        && !["build", "payoff"].includes(purpose)
      ) role = "rest";
      if (
        id === "counterpoint"
        && role === "answer"
        && purpose === "establish"
        && index === 0
      ) role = "rest";
      return [id, role];
    }));
    return {
      sectionId: section.id,
      sectionName: section.name,
      purpose,
      returnIndex,
      developmentAxis,
      foregroundTrack,
      answerTrack: roles[answerTrack] === "answer" ? answerTrack : null,
      silenceBudget,
      densityCeiling: round(clamp(0.64 + plan.energy * 0.3 - silenceBudget * 0.12, 0.58, 0.96)),
      roles,
    };
  });
  const featuredCounts = new Map();
  for (const scene of scenes) {
    featuredCounts.set(scene.foregroundTrack, (featuredCounts.get(scene.foregroundTrack) ?? 0) + 1);
  }
  const signatureTrack = [...featuredCounts.entries()]
    .sort((left, right) => right[1] - left[1] || TRACK_IDS.indexOf(left[0]) - TRACK_IDS.indexOf(right[0]))[0]?.[0]
    ?? "melody";
  return {
    version: 1,
    identity: {
      narrative: narrative.id,
      hookSectionId: hookSectionId ?? null,
      peakSectionId: peakSectionId ?? null,
      signatureTrack,
      songDNAId: songDNA?.id ?? null,
      songDNAFamilyId: songDNA?.familyId ?? null,
      signatureBias: songDNA?.identity?.signatureBias ?? "hook",
      grooveIdentity: ["house", "techno", "drumBass", "trap", "drill", "funk"].includes(config.genre)
        ? "rhythm-led"
        : "phrase-led",
      structuralArc: scenes.map((scene) => `${scene.purpose}:${scene.developmentAxis}`),
    },
    rules: {
      maxForegroundVoices: 1,
      protectFoundation: true,
      separateAnswers: true,
      preserveCadences: true,
    },
    scenes,
  };
}

const HOOK_MEMORY_GENRES = new Set(["pop", "hipHop", "rap", "trap"]);
const HOOK_SECTION_NAMES = new Set(["chorus", "drop", "theme", "idea"]);

export function hookReturnRecallStrength({
  genre,
  bars,
  sectionName,
  relationship,
  isHookReturn = false,
  baseStrength = 0.78,
  hookMemory = 0.78,
} = {}) {
  const base = clamp(finite(baseStrength, 0.78), 0, 1);
  if (
    !HOOK_MEMORY_GENRES.has(String(genre ?? ""))
    || finite(bars, 0) < 12
    || !HOOK_SECTION_NAMES.has(String(sectionName ?? "").toLowerCase())
    || !["recall", "return"].includes(String(relationship ?? ""))
    || !isHookReturn
  ) return round(base);

  const memory = clamp(finite(hookMemory, 0.78), 0, 1);
  const dnaTarget = clamp(0.78 + memory * 0.14, base, 0.92);
  return round(Math.max(base, dnaTarget));
}

function createMemoryMap(structure, sectionPlans, hookSectionId, source = null, config = null, songDNA = null) {
  const firstByName = new Map();
  return structure.map((section, index) => {
    const inherited = source?.memoryMap?.find((entry) => entry.sectionId === section.id);
    if (inherited) return clone(inherited);
    const plan = sectionPlans[index];
    const origin = firstByName.get(section.name);
    if (!origin) firstByName.set(section.name, section);
    const contrastAxis = ["rhythm", "register", "density", "harmony"][index % 4];
    if (origin) {
      const relationship = plan.role === "peak" ? "return" : "recall";
      const baseRecallStrength = plan.role === "peak" ? 0.88 : 0.78;
      return {
        sectionId: section.id,
        originSectionId: origin.id,
        relationship,
        recallStrength: hookReturnRecallStrength({
          genre: config?.genre,
          bars: config?.bars,
          sectionName: section.name,
          relationship,
          isHookReturn: origin.id === hookSectionId,
          baseStrength: baseRecallStrength,
          hookMemory: songDNA?.melodic?.hookMemory,
        }),
        contrastAxis,
      };
    }
    if (["bridge", "breakdown"].includes(section.name) && hookSectionId && hookSectionId !== section.id) {
      return {
        sectionId: section.id,
        originSectionId: hookSectionId,
        relationship: "contrast",
        recallStrength: 0.42,
        contrastAxis,
      };
    }
    return {
      sectionId: section.id,
      originSectionId: section.id,
      relationship: index === 0 ? "introduction" : "statement",
      recallStrength: 1,
      contrastAxis: "none",
    };
  });
}

function createSongBlueprint(config, structure, style, rng, source = null) {
  const sourceNarrativeId = String(source?.narrative?.id ?? "");
  const narrative = SONG_NARRATIVES.find((item) => item.id === sourceNarrativeId)
    ?? rng.weighted(SONG_NARRATIVES.map((item) => [item, item.weight]));
  const hookCandidates = structure.filter((section) => ["chorus", "drop", "theme", "idea"].includes(section.name));
  const hookSection = hookCandidates[0] ?? structure[Math.min(1, structure.length - 1)] ?? structure[0];
  const peakCandidates = structure.filter((section) => ["chorus", "drop"].includes(section.name));
  const peakSection = peakCandidates.at(-1)
    ?? [...structure].sort((left, right) => right.intensity - left.intensity)[0]
    ?? structure[0];
  const dnaMelodicDirection = rng.bool(0.58) ? 1 : -1;
  const songDNA = createDeterministicSongDNA({
    genre: config.genre,
    bpm: config.tempo,
    key: config.key,
    scale: config.scale,
    seed: config.seed,
    narrativeId: narrative.id,
    styleAnchor: {
      drumGroove: style.drumGroove,
      bassGroove: style.bassGroove,
      chordMotion: style.chordMotion,
      melodyShape: style.melodyShape,
    },
    structure,
    sourceDNA: source?.songDNA ?? null,
    syncopation: config.syncopation,
    swing: config.swing,
    melodicRange: config.melodicRange,
    melodicDirection: dnaMelodicDirection,
    phraseBars: clamp(
      Math.round(finite(style.rhythmIdentity?.phraseCycle, GENRE_PROFILES[config.genre].arrangement.phraseBars)),
      2,
      8,
    ),
  });
  const direction = songDNA.melodic.direction;
  const sectionPlans = structure.map((section, index) => {
    const progress = structure.length <= 1 ? 1 : index / (structure.length - 1);
    const baseEnergy = clamp(sectionIntensity(section.name) / 1.18, 0.2, 1);
    const energy = narrativeEnergy(narrative.id, baseEnergy, progress, index);
    const motifTransform = motifTransformForSection(section, index, structure, peakSection?.id);
    const cadence = index === structure.length - 1 || section.name === "outro"
      ? "resolve"
      : ["prechorus", "build"].includes(section.name)
        ? "lift"
        : ["bridge", "breakdown"].includes(section.name)
          ? "suspend"
          : ["chorus", "drop"].includes(section.name)
            ? "resolve"
            : "open";
    const role = section.id === peakSection?.id
      ? "peak"
      : section.id === hookSection?.id
        ? "hook"
        : motifTransform === "resolution"
          ? "release"
          : motifTransform === "statement"
            ? "statement"
            : "development";
    const harmonicStory = harmonicStoryForSection(
      section,
      role,
      cadence,
      narrative.id,
      index,
      index === structure.length - 1,
    );
    const sourcePlan = source?.sectionPlans?.find((plan) => plan.sectionId === section.id)
      ?? source?.sectionPlans?.find((plan) => plan.sectionName === section.name);
    const baseDevelopmentPath = developmentPathForTransform(motifTransform);
    const patternVariant = Number.isFinite(Number(sourcePlan?.patternVariant))
      ? mod(Math.round(sourcePlan.patternVariant), baseDevelopmentPath.length)
      : rng.int(0, Math.max(0, baseDevelopmentPath.length - 1));
    const developmentPath = [
      ...baseDevelopmentPath.slice(patternVariant),
      ...baseDevelopmentPath.slice(0, patternVariant),
    ];
    const tension = round(clamp(energy * 0.72 + (cadence === "lift" ? 0.22 : cadence === "suspend" ? 0.12 : 0), 0, 1));
    const inheritedEnvelope = sourcePlan?.tensionEnvelope;
    const tensionEnvelope = inheritedEnvelope
      ? clone(inheritedEnvelope)
      : (() => {
        const release = role === "release" || cadence === "resolve" && section.name === "outro";
        const lifting = cadence === "lift";
        const suspended = cadence === "suspend";
        const peak = role === "peak";
        const start = release ? Math.max(0.28, tension * 0.72)
          : lifting ? tension * 0.56
            : suspended ? tension * 0.62
              : peak ? Math.max(0.58, tension * 0.76)
                : tension * 0.68;
        const crest = release ? Math.max(start, tension * 0.82)
          : lifting ? tension + 0.12
            : suspended ? tension + 0.1
              : peak ? tension + 0.18
                : tension + 0.08;
        const end = release ? Math.min(0.24, tension * 0.34)
          : lifting ? crest - 0.015
            : suspended ? crest - 0.04
              : cadence === "resolve" ? tension * 0.48
                : tension * 0.82;
        return {
          start: round(clamp(start, 0.08, 1)),
          peak: round(clamp(crest, 0.12, 1)),
          end: round(clamp(end, 0.08, 1)),
          peakAt: release ? 0.28 : lifting ? 0.88 : peak ? 0.68 : 0.62,
          phraseBars: clamp(Math.round(finite(style.rhythmIdentity?.phraseCycle, 2)), 2, config.professionalUpgrade ? 8 : 4),
          phraseLift: round(clamp(0.035 + config.evolution * 0.075, 0.035, 0.11)),
          shape: release ? "release" : lifting ? "rise" : suspended ? "suspend" : peak ? "crest" : "arc",
        };
      })();
    return {
      sectionId: section.id,
      sectionName: section.name,
      role,
      energy: round(energy),
      tension,
      tensionEnvelope,
      density: round(clamp(0.28 + energy * 0.58 + config.complexity * 0.1, 0.24, 1)),
      registerLift: role === "peak" ? 1 : motifTransform === "resolution" ? -1 : 0,
      harmonicActivity: round(clamp(0.25 + config.harmonicRhythm * 0.45 + energy * 0.24, 0.2, 1)),
      cadence,
      motifTransform,
      patternVariant,
      developmentPath,
      direction,
      harmonicRole: sourcePlan?.harmonicRole ?? harmonicStory.role,
      harmonicColor: sourcePlan?.harmonicColor ?? harmonicStory.color,
      harmonicStartDegree: sourcePlan?.harmonicStartDegree ?? harmonicStory.startDegree,
      harmonicGoalDegree: sourcePlan?.harmonicGoalDegree ?? harmonicStory.goalDegree,
    };
  });
  const transitions = sectionPlans.slice(0, -1).map((from, index) => {
    const to = sectionPlans[index + 1];
    const sourceTransition = source?.transitions?.find((transition) => (
      transition.fromSectionId === from.sectionId && transition.toSectionId === to.sectionId
    ));
    const type = sourceTransition?.type ?? transitionType(from, to);
    const energyDelta = to.energy - from.energy;
    const strength = sourceTransition?.strength ?? round(clamp(
      0.42 + Math.abs(energyDelta) * 1.5 + (["launch", "drop-out"].includes(type) ? 0.18 : 0),
      0.38,
      1,
    ));
    return {
      fromSectionId: from.sectionId,
      toSectionId: to.sectionId,
      type,
      strength,
      pickupBeats: sourceTransition?.pickupBeats ?? (strength > 0.72 ? 1 : 0.5),
    };
  });
  const orchestrationMatrix = createOrchestrationMatrix(config, structure, sectionPlans, source);
  const producerIntent = createProducerIntentContract(
    config,
    structure,
    sectionPlans,
    orchestrationMatrix,
    narrative,
    hookSection?.id,
    peakSection?.id,
    songDNA,
  );
  const memoryMap = createMemoryMap(structure, sectionPlans, hookSection?.id, source, config, songDNA);
  const phraseMemory = createPhraseMemoryContract({
    structure,
    sectionPlans,
    memoryMap,
    songDNA,
  });
  return {
    version: 6,
    narrative: { id: narrative.id, label: narrative.label },
    songDNA,
    hookSectionId: hookSection?.id ?? null,
    peakSectionId: peakSection?.id ?? null,
    tensionCurve: sectionPlans.map(({ sectionId, tension, tensionEnvelope }) => ({
      sectionId,
      tension,
      ...clone(tensionEnvelope),
    })),
    qualityTargets: {
      repetition: round(clamp(0.62 + (1 - config.surprise) * 0.12, 0.5, 0.82)),
      sectionContrast: round(clamp(0.28 + config.evolution * 0.38, 0.24, 0.72)),
      chordToneAnchors: round(clamp(0.68 + (1 - config.surprise) * 0.16, 0.62, 0.88)),
      grooveLock: round(clamp(0.68 …96823 tokens truncated…Variation, 0, 1) * 34 + (1 - adjacentCopies) * 18), 25, 100);
}

function repairWindowMemoryScore(song, window) {
  const memory = song?.songBlueprint?.memoryMap?.find((entry) => (
    entry.sectionId === window.sectionId
    && !["introduction", "statement"].includes(entry.relationship)
  ));
  if (!memory) return 100;
  const recalled = ["melody", "bass", "counterpoint"].map((trackId) => (
    song?.tracks?.find((track) => track.id === trackId)?.notes?.some((note) => (
      note.memoryRole === memory.relationship
      && note.memoryOriginSectionId === memory.originSectionId
      && note.start >= window.startBeat - 1e-6
      && note.start < window.endBeat - 1e-6
    ))
  ));
  if (memory.relationship === "contrast") return recalled[0] ? 100 : 50;
  return round(recalled.filter(Boolean).length / recalled.length * 100);
}

function repairWindowPhraseResolutionScore(song, window) {
  const section = song?.structure?.find((candidate) => candidate.id === window.sectionId);
  if (!section || window.endBeat < section.endBeat - 0.05) return 100;
  const melody = [...(song?.tracks?.find((track) => track.id === "melody")?.notes ?? [])]
    .filter((note) => note.start < section.endBeat - 0.01 && note.start >= section.endBeat - finite(song?.meta?.beatsPerBar, 4) * 1.25)
    .sort((left, right) => left.start - right.start);
  const landing = melody.at(-1);
  if (!landing) return 55;
  const chord = harmonyAt(song?.harmony ?? [], landing.start);
  const pitchClass = mod(landing.pitch, 12);
  const chordTone = chord?.tones?.includes(pitchClass);
  const tonicLanding = pitchClass === finite(song?.meta?.keyPc, 0);
  const held = landing.duration >= finite(song?.meta?.beatsPerBar, 4) * 0.35;
  return round(clamp(0.38 + Number(chordTone) * 0.32 + Number(tonicLanding) * 0.18 + Number(held) * 0.12, 0, 1) * 100);
}

function repairWindowRepetitionScore(song, window) {
  const section = song?.structure?.find((candidate) => candidate.id === window.sectionId);
  if (!section) return 70;
  const melody = [...(song?.tracks?.find((track) => track.id === "melody")?.notes ?? [])]
    .filter((note) => note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6)
    .sort((left, right) => left.start - right.start);
  const profile = GENRE_CRITIC_PROFILES[song?.genre] ?? GENRE_CRITIC_PROFILES.pop;
  const ratio = phraseRepetition({ ...song, structure: [section] }, melody);
  const target = average([
    finite(song?.songBlueprint?.qualityTargets?.repetition, profile.repetition),
    profile.repetition,
  ], profile.repetition);
  return clamp(Math.round(100 - Math.abs(ratio - target) * 125), 30, 100);
}

function nearestRepairPitch(pitch, pitchClasses, minimum = 36, maximum = 108) {
  const goals = new Set((pitchClasses ?? []).map((value) => mod(value, 12)));
  if (!goals.size) return pitch;
  const candidates = [];
  for (let candidate = minimum; candidate <= maximum; candidate += 1) {
    if (goals.has(mod(candidate, 12))) candidates.push(candidate);
  }
  return candidates.sort((left, right) => Math.abs(left - pitch) - Math.abs(right - pitch) || left - right)[0] ?? pitch;
}

function reinforceRepairMemory(song, config) {
  const rawTracks = Object.fromEntries((song?.tracks ?? []).map((track) => [
    track.id,
    (track.notes ?? []).map((note) => ({ ...note })),
  ]));
  const remembered = applyMusicalMemory(
    rawTracks,
    song.structure ?? [],
    song.harmony ?? [],
    song.songBlueprint,
    song.motifs?.melody?.lengthBeats,
    finite(config?.bars, song?.meta?.bars ?? song?.bars ?? 1) * beatsPerBar(config),
  );
  const repaired = clone(song);
  repaired.tracks = repaired.tracks.map((track) => ({
    ...track,
    notes: (remembered?.[track.id] ?? track.notes ?? []).map((note) => ({ ...note })),
  }));
  return repaired;
}

function reinforceRepairPhraseResolution(song, config, window) {
  const repaired = clone(song);
  const melodyTrack = repaired.tracks?.find((track) => track.id === "melody");
  const counterTrack = repaired.tracks?.find((track) => track.id === "counterpoint");
  if (!melodyTrack) return repaired;
  const barBeats = beatsPerBar(config);
  const tonic = finite(repaired.meta?.keyPc, config?.keyPc ?? 0);
  const sections = (repaired.structure ?? []).filter((section) => (
    !window
    || (section.endBeat > window.startBeat + 1e-6 && section.startBeat < window.endBeat - 1e-6)
  ));
  let edits = 0;
  for (const section of sections) {
    if (window && window.endBeat < section.endBeat - 0.05) continue;
    const phraseNotes = melodyTrack.notes
      .filter((note) => note.start < section.endBeat - 0.01 && note.start >= section.endBeat - barBeats * 1.25)
      .sort((left, right) => left.start - right.start);
    const landing = phraseNotes.at(-1);
    if (!landing) continue;
    const chord = harmonyAt(repaired.harmony ?? [], landing.start);
    const plan = blueprintPlanForSection(repaired.songBlueprint, section);
    const finalSection = section.id === repaired.structure?.at(-1)?.id;
    const preferTonic = finalSection || plan?.cadence === "resolve";
    const chordTones = chord?.tones?.length ? chord.tones : [tonic];
    const pitchClasses = [...new Set(preferTonic ? [tonic, ...chordTones] : [...chordTones, tonic])];
    const currentDuration = Math.max(0.05, finite(landing.duration, 0.25));
    const counterNotes = counterTrack?.notes ?? [];
    const collisionCount = (pitch, duration) => counterNotes.filter((note) => {
      if (note.start >= landing.start + duration - 1e-6 || landing.start >= note.start + note.duration - 1e-6) return false;
      return [0, 1, 6, 11].includes(mod(Math.abs(pitch - note.pitch), 12));
    }).length;
    const candidates = pitchClasses.map((pitchClass, priority) => {
      const pitch = nearestRepairPitch(landing.pitch, [pitchClass]);
      const pitchClassAtLanding = mod(pitch, 12);
      const chordTone = Boolean(chord?.tones?.includes(pitchClassAtLanding));
      const tonicCandidate = pitchClassAtLanding === tonic;
      return {
        pitch,
        priority,
        collisions: collisionCount(pitch, currentDuration),
        resolutionValue: Number(chordTone) * 0.32 + Number(tonicCandidate) * 0.18,
        distance: Math.abs(pitch - landing.pitch),
      };
    }).sort((left, right) => (
      left.collisions - right.collisions
      || right.resolutionValue - left.resolutionValue
      || left.priority - right.priority
      || left.distance - right.distance
      || left.pitch - right.pitch
    ));
    const chosen = candidates[0];
    if (chosen && chosen.pitch !== landing.pitch) {
      landing.pitch = chosen.pitch;
      edits += 1;
    }
    const minimumDuration = barBeats * 0.36;
    const availableDuration = Math.max(0.05, section.endBeat - landing.start);
    const desiredDuration = Math.max(currentDuration, Math.min(minimumDuration, availableDuration));
    if (desiredDuration > currentDuration + 1e-6
      && collisionCount(landing.pitch, desiredDuration) <= collisionCount(landing.pitch, currentDuration)) {
      landing.duration = round(desiredDuration);
      edits += 1;
    }
    const pitchClass = mod(landing.pitch, 12);
    landing.resolutionRole = pitchClass === tonic ? "tonic-landing" : "chord-landing";
    landing.phraseBoundary = round(section.endBeat);
    landing.preserveTiming = true;
    landing.producerRepair = "phrase-cadence-precision";
  }
  repaired.precisionRepair = {
    ...(repaired.precisionRepair ?? {}),
    cadence: { version: 2, edits, windowId: window?.id ?? null },
  };
  melodyTrack.notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  return repaired;
}

function reinforceRepairTransitions(song, config) {
  const repaired = clone(song);
  const transitions = repaired.arrangementTransitions ?? repaired.songBlueprint?.transitions ?? [];
  const drums = repaired.tracks?.find((track) => track.id === "drums");
  let edits = 0;
  for (const transition of transitions) {
    const from = repaired.structure?.find((section) => section.id === transition.fromSectionId);
    if (!from) continue;
    const boundary = finite(from.endBeat, 0);
    const pickup = clamp(finite(transition.pickupBeats, 0.5), 0.25, 2);
    if (transition.type === "drop-out") {
      const preserve = [];
      for (const track of repaired.tracks ?? []) {
        for (const note of track.notes ?? []) {
          if (note.start >= boundary - pickup - 1e-6 && note.start < boundary - 1e-6 && note.resolutionRole) {
            preserve.push({ track, note });
          }
        }
      }
      preserve.sort((left, right) => right.note.start - left.note.start || right.note.velocity - left.note.velocity);
      const keep = preserve[0]?.note ?? null;
      for (const track of repaired.tracks ?? []) {
        const before = track.notes?.length ?? 0;
        track.notes = (track.notes ?? []).filter((note) => (
          note === keep
          || note.start < boundary - pickup - 1e-6
          || note.start >= boundary - 1e-6
        ));
        edits += before - track.notes.length;
      }
      continue;
    }

    const candidates = (repaired.tracks ?? []).flatMap((track) => (track.notes ?? [])
      .filter((note) => note.start >= boundary - pickup - 0.08 && note.start <= boundary + 0.08)
      .map((note) => ({ track, note })))
      .sort((left, right) => (
        Math.abs(left.note.start - boundary) - Math.abs(right.note.start - boundary)
        || Number(right.track.id === "drums") - Number(left.track.id === "drums")
        || finite(right.note.velocity, 0) - finite(left.note.velocity, 0)
      ));
    for (const entry of candidates.slice(0, 3)) {
      entry.note.transitionFeature = transition.type;
      edits += 1;
    }
    const hit = candidates.find((entry) => Math.abs(entry.note.start - boundary) <= 0.08);
    if (hit) {
      hit.note.velocity = Math.max(94, Math.round(finite(hit.note.velocity, 80)));
      hit.note.transitionFeature = transition.type;
      edits += 1;
    } else if (drums) {
      drums.notes.push({
        start: round(boundary),
        duration: round(Math.min(0.35, beatsPerBar(config) * 0.12)),
        pitch: 49,
        velocity: 96,
        transitionFeature: transition.type,
        producerRepair: "transition-boundary",
      });
      drums.notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
      edits += 1;
    }
  }
  repaired.precisionRepair = {
    ...(repaired.precisionRepair ?? {}),
    transitions: { version: 1, edits },
  };
  return repaired;
}

function rebalanceRepairPerformance(song) {
  const repaired = clone(song);
  const profile = clone(repaired.performanceProfile ?? {});
  profile.timingJitter = Math.min(0.035, Math.abs(finite(profile.timingJitter, 0)));
  profile.trackOffsets = Object.fromEntries(
    Object.entries(profile.trackOffsets ?? {}).map(([id, offset]) => [id, clamp(finite(offset, 0), -0.045, 0.045)]),
  );
  repaired.performanceProfile = profile;

  const pitchedTracks = (repaired.tracks ?? []).filter((track) => track.id !== "drums");
  const notes = pitchedTracks.flatMap((track) => track.notes ?? []);
  if (!notes.length) return repaired;
  const velocities = notes.map((note) => finite(note.velocity, 80));
  const mean = average(velocities, 80);
  const variance = average(velocities.map((velocity) => (velocity - mean) ** 2), 0);
  const spread = Math.sqrt(variance);
  const target = clamp(10 + finite(profile.velocityVariance, 5) * 1.2, 8, 28);
  let index = 0;
  for (const track of pitchedTracks) {
    for (const note of track.notes ?? []) {
      const current = finite(note.velocity, mean);
      const normalized = spread > 0.75
        ? (current - mean) / spread
        : (((index % 5) - 2) / 2);
      note.velocity = clamp(Math.round(mean + normalized * target), 24, 124);
      note.performanceRepair = "dynamic-spread";
      index += 1;
    }
  }
  repaired.precisionRepair = {
    ...(repaired.precisionRepair ?? {}),
    performance: {
      version: 1,
      spreadBefore: round(spread),
      targetSpread: round(target),
    },
  };
  return repaired;
}

function sectionRepairTarget(song, section, dimension) {
  const plan = blueprintPlanForSection(song.songBlueprint, section);
  if (dimension === "tensionFollow") {
    return clamp(finite(
      section.plannedTension
        ?? section.tension
        ?? section.intent?.tension
        ?? plan?.tension
        ?? section.energy,
      0.5,
    ), 0, 1);
  }
  return clamp(finite(plan?.energy ?? section.energy, 0.5), 0, 1);
}

function rebalanceRepairArrangementArc(song, dimension) {
  const repaired = clone(song);
  const sections = repaired.structure ?? [];
  if (sections.length < 2) return repaired;
  const targets = sections.map((section) => sectionRepairTarget(repaired, section, dimension));
  const center = average(targets, 0.5);
  let velocityEdits = 0;
  let densityEdits = 0;
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];
    const target = targets[sectionIndex];
    const notes = (repaired.tracks ?? []).flatMap((track) => (track.notes ?? [])
      .filter((note) => note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6)
      .map((note) => ({ track, note })));
    if (!notes.length) continue;
    const mean = average(notes.map(({ note }) => finite(note.velocity, 80)), 80);
    const desired = clamp(52 + target * 62, 48, 114);
    const shift = clamp((desired - mean) * 0.72, -18, 18);
    for (const { note } of notes) {
      const next = clamp(Math.round(finite(note.velocity, mean) + shift), 22, 124);
      if (next !== note.velocity) velocityEdits += 1;
      note.velocity = next;
      note.producerRepair = "arrangement-energy-arc";
    }

    const supportTracks = (repaired.tracks ?? []).filter((track) => ["pad", "chords", "counterpoint"].includes(track.id));
    if (target > center + 0.07) {
      const candidates = supportTracks.flatMap((track) => (track.notes ?? [])
        .filter((note) => note.start >= section.startBeat - 1e-6
          && note.start < section.endBeat - 1e-6
          && finite(note.duration, 0) >= 0.5)
        .map((note) => ({ track, note })))
        .sort((left, right) => finite(right.note.duration, 0) - finite(left.note.duration, 0));
      for (const { track, note } of candidates.slice(0, 1)) {
        const duration = finite(note.duration, 0);
        const half = round(duration / 2);
        if (half < 0.12) continue;
        note.duration = half;
        track.notes.push({
          ...clone(note),
          start: round(note.start + half),
          duration: round(duration - half),
          velocity: clamp(Math.round(finite(note.velocity, 80) - 2), 22, 124),
          producerRepair: "arrangement-energy-arc",
        });
        densityEdits += 1;
      }
    } else if (target < center - 0.07) {
      const candidates = supportTracks.flatMap((track) => (track.notes ?? [])
        .filter((note) => note.start >= section.startBeat - 1e-6
          && note.start < section.endBeat - 1e-6
          && !note.resolutionRole
          && !note.transitionFeature
          && !note.memoryRole)
        .map((note) => ({ track, note })))
        .sort((left, right) => finite(left.note.velocity, 80) - finite(right.note.velocity, 80)
          || finite(left.note.duration, 0) - finite(right.note.duration, 0));
      const remove = candidates[0];
      if (remove && (remove.track.notes?.length ?? 0) > 2) {
        remove.track.notes = remove.track.notes.filter((note) => note !== remove.note);
        densityEdits += 1;
      }
    }
  }
  for (const track of repaired.tracks ?? []) {
    track.notes?.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  }
  repaired.precisionRepair = {
    ...(repaired.precisionRepair ?? {}),
    arrangementArc: { version: 1, dimension, velocityEdits, densityEdits },
  };
  return repaired;
}

function rebalanceRepairDensity(song, strategy, window) {
  const repaired = clone(song);
  const build = strategy?.id === "density-build";
  const startBeat = Number.isFinite(Number(window?.startBeat)) ? Number(window.startBeat) : 0;
  const endBeat = Number.isFinite(Number(window?.endBeat))
    ? Number(window.endBeat)
    : finite(repaired.meta?.bars, repaired.bars ?? 1) * finite(repaired.meta?.beatsPerBar, 4);
  const allowed = new Set(strategy?.trackIds ?? ["chords", "pad", "counterpoint"]);
  const barsInWindow = Math.max(1, (endBeat - startBeat) / Math.max(1, finite(repaired.meta?.beatsPerBar, 4)));
  const editBudget = clamp(Math.ceil(barsInWindow * 2), 2, 6);
  let edits = 0;
  if (build) {
    const candidates = (repaired.tracks ?? []).filter((track) => allowed.has(track.id) && track.id !== "bass")
      .flatMap((track) => (track.notes ?? [])
        .filter((note) => note.start >= startBeat - 1e-6
          && note.start < endBeat - 1e-6
          && finite(note.duration, 0) >= 0.28
          && !note.transitionFeature)
        .map((note) => ({ track, note })))
      .sort((left, right) => finite(right.note.duration, 0) - finite(left.note.duration, 0)
        || finite(right.note.velocity, 0) - finite(left.note.velocity, 0));
    for (const { track, note } of candidates.slice(0, editBudget)) {
      const duration = finite(note.duration, 0);
      const first = round(duration / 2);
      const second = round(duration - first);
      if (first < 0.1 || second < 0.1) continue;
      note.duration = first;
      note.producerRepair = "density-precision";
      track.notes.push({
        ...clone(note),
        start: round(note.start + first),
        duration: second,
        velocity: clamp(Math.round(finite(note.velocity, 80) - 3), 20, 124),
        producerRepair: "density-precision",
      });
      edits += 1;
    }
  } else {
    const candidates = (repaired.tracks ?? []).filter((track) => allowed.has(track.id) && track.id !== "bass")
      .flatMap((track) => (track.notes ?? [])
        .filter((note) => note.start >= startBeat - 1e-6
          && note.start < endBeat - 1e-6
          && !note.resolutionRole
          && !note.transitionFeature
          && !note.memoryRole)
        .map((note) => ({ track, note })))
      .sort((left, right) => finite(left.note.velocity, 80) - finite(right.note.velocity, 80)
        || finite(left.note.duration, 0) - finite(right.note.duration, 0));
    for (const { track, note } of candidates) {
      if (edits >= editBudget) break;
      if ((track.notes?.length ?? 0) <= 2) continue;
      track.notes = track.notes.filter((candidate) => candidate !== note);
      edits += 1;
    }
  }
  for (const track of repaired.tracks ?? []) {
    track.notes?.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  }
  repaired.precisionRepair = {
    ...(repaired.precisionRepair ?? {}),
    density: { version: 1, direction: build ? "build" : "thin", edits, startBeat: round(startBeat), endBeat: round(endBeat) },
  };
  return repaired;
}

function directSpecializedRepairSource(sourceSong, strategy, config, window = null) {
  const dimension = String(strategy?.dimension ?? "");
  if (dimension === "transitions") return reinforceRepairTransitions(sourceSong, config);
  if (dimension === "performance") return clone(sourceSong);
  if (dimension === "density") return rebalanceRepairDensity(sourceSong, strategy, window);
  if (["storyArc", "tensionFollow"].includes(dimension)) return rebalanceRepairArrangementArc(sourceSong, dimension);
  return null;
}

function applySpecializedRepairMaterial(song, strategy, config, window) {
  if (!song || !strategy) return song;
  if (strategy.dimension === "memory" && strategy.trackIds.some((id) => ["melody", "bass", "counterpoint"].includes(id))) {
    return reinforceRepairMemory(song, config);
  }
  if (strategy.dimension === "phraseResolution" && strategy.trackIds.includes("melody")) {
    return reinforceRepairPhraseResolution(song, config, window);
  }
  return song;
}

function spliceNotesInSurgicalWindow(sourceNotes = [], repairedNotes = [], window = {}) {
  const startBeat = finite(window.startBeat, 0);
  const endBeat = Math.max(startBeat, finite(window.endBeat, startBeat));
  const outside = sourceNotes.filter((note) => note.start < startBeat - 1e-6 || note.start >= endBeat - 1e-6);
  const inside = repairedNotes.filter((note) => note.start >= startBeat - 1e-6 && note.start < endBeat - 1e-6);
  return [...outside.map(clone), ...inside.map(clone)]
    .sort((left, right) => left.start - right.start || left.pitch - right.pitch);
}

function timedEventBeat(event) {
  const value = Number(event?.startBeat ?? event?.start);
  return Number.isFinite(value) ? value : null;
}

function spliceTimedEventsInSurgicalWindow(sourceEvents = [], repairedEvents = [], window = {}) {
  const startBeat = finite(window.startBeat, 0);
  const endBeat = Math.max(startBeat, finite(window.endBeat, startBeat));
  if (![...sourceEvents, ...repairedEvents].some((event) => timedEventBeat(event) != null)) {
    return clone(sourceEvents);
  }
  const outside = sourceEvents.filter((event) => {
    const beat = timedEventBeat(event);
    return beat == null || beat < startBeat - 1e-6 || beat >= endBeat - 1e-6;
  });
  const inside = repairedEvents.filter((event) => {
    const beat = timedEventBeat(event);
    return beat != null && beat >= startBeat - 1e-6 && beat < endBeat - 1e-6;
  });
  return [...outside.map(clone), ...inside.map(clone)]
    .sort((left, right) => finite(timedEventBeat(left), 0) - finite(timedEventBeat(right), 0));
}

function applySurgicalRepairWindow(sourceSong, repairedSong, config, diagnosis, sourceCandidate, window, repairStrategy = null) {
  const trackIds = repairStrategy?.trackIds ?? repairStrategy?.tracks ?? targetedRepairTrackIds(sourceCandidate, diagnosis);
  const repairedById = new Map((repairedSong.tracks ?? []).map((track) => [track.id, track]));
  const song = clone(sourceSong);
  song.id = repairedSong.id;
  song.seed = repairedSong.seed;
  song.settings = clone(repairedSong.settings ?? sourceSong.settings);
  song.tracks = sourceSong.tracks.map((track) => {
    if (!trackIds.includes(track.id)) return clone(track);
    const repairedTrack = repairedById.get(track.id) ?? track;
    return {
      ...clone(track),
      notes: spliceNotesInSurgicalWindow(track.notes ?? [], repairedTrack.notes ?? [], window),
    };
  });
  if (diagnosis?.group === "harmony") {
    song.harmony = spliceTimedEventsInSurgicalWindow(
      sourceSong.harmony ?? [],
      repairedSong.harmony ?? [],
      window,
    );
  } else {
    song.harmony = clone(sourceSong.harmony ?? []);
  }
  const sourceInterlock = clone(sourceSong.generationInterlock ?? repairedSong.generationInterlock ?? {});
  song.generationInterlock = {
    ...sourceInterlock,
    version: 2,
    reconciliation: {
      phase: 40,
      repairGroup: diagnosis.group,
      source: "actual-repaired-song",
    },
  };
  const preInterlockTracks = song.tracks.map(clone);
  const surgicalNotesById = Object.fromEntries(
    preInterlockTracks.map((track) => [track.id, track.notes ?? []]),
  );
  const reconnected = applyGenerationInterlocks(
    surgicalNotesById,
    song.generationInterlock,
    song.structure,
    config,
    { adjustVelocity: false },
  );
  const surgicalTrackSet = new Set(trackIds);
  song.tracks = preInterlockTracks.map((track) => {
    if (!surgicalTrackSet.has(track.id)) return track;
    return {
      ...track,
      notes: spliceNotesInSurgicalWindow(
        track.notes ?? [],
        reconnected[track.id] ?? track.notes ?? [],
        window,
      ),
    };
  });
  song.meta = { ...sourceSong.meta, ideaFingerprint: null };
  const rescoredWindows = evaluatePhraseWindows(
    song.tracks,
    song.structure,
    song.harmony,
    config,
    song.grooveConductor,
  );
  const affectedWindows = rescoredWindows.filter((candidate) => (
    candidate.startBeat < window.endBeat - 1e-6 && candidate.endBeat > window.startBeat + 1e-6
  ));
  const scoreAfter = round(average(affectedWindows.map((candidate) => candidate.score), window.scoreBefore));
  song.phraseCritic = {
    ...(sourceSong.phraseCritic ?? {}),
    phase: 41,
    version: 1,
    status: "complete",
    analyzedWindows: rescoredWindows.length,
    weakestScore: rescoredWindows.length ? Math.min(...rescoredWindows.map((candidate) => candidate.score)) : 100,
    windows: rescoredWindows,
    repairs: [
      ...clone(sourceSong.phraseCritic?.repairs ?? []),
      {
        windowId: window.id,
        scoreBefore: window.scoreBefore,
        scoreAfter,
        tracks: clone(trackIds),
        actions: ["producer-brain-regeneration"],
      },
    ],
  };
  song.idea = createIdeaAnalysis(
    config,
    song.structure,
    song.harmony,
    song.style,
    song.tracks,
    song.oneShotKit,
    song.songBlueprint,
    song.performanceProfile,
  );
  song.idea.rhythmicFeatures.push(
    `Producer Brain surgical repair · bars ${window.startBar + 1}-${window.endBar}`,
  );
  song.criticRepair = {
    ...(repairedSong.criticRepair ?? {}),
    mode: "surgical-window",
    surgicalWindow: {
      ...clone(window),
      scoreAfter,
    },
    surgicalTracks: clone(trackIds),
  };
  return song;
}

function finishRepairedSong(song, config, diagnosis, sourceCandidate, attempt, repairStrategy = null) {
  reconcileRepairedGenerationInterlock(song, config, diagnosis);
  const produced = runProducerPass(song.tracks, song.structure, song.songBlueprint);
  const perceptualMix = runPerceptualMixPass(produced.tracks, song.structure);
  const connectedById = Object.fromEntries(
    perceptualMix.tracks.map((track) => [track.id, track.notes]),
  );
  const connected = applyGenerationInterlocks(
    connectedById,
    song.generationInterlock,
    song.structure,
    config,
    { adjustVelocity: false },
  );
  const reconnectedTracks = perceptualMix.tracks.map((track) => ({
    ...track,
    notes: connected[track.id] ?? track.notes,
  }));
  const spectrumPlan = song.spectrumPlan ?? createSpectrumPlan(config, song.structure, song.songBlueprint);
  const spectral = applySpectrumPlan(reconnectedTracks, song.structure, spectrumPlan, config);
  spectrumPlan.metrics = spectral.metrics;
  const scaleSafety = enforceScaleSafety(spectral.tracks, config);
  const creativePolish = runCreativePolishPasses(
    scaleSafety.tracks,
    song.structure,
    song.harmony,
    song.songBlueprint,
    config,
  );
  const finalAssemblyRepair = runFinalAssemblyPass(
    creativePolish.tracks,
    scaleSafety.tracks,
    song.structure,
    song.songBlueprint,
  );
  const finalMaster = runFinalMasterPass(
    finalAssemblyRepair.tracks,
    song.structure,
    song.songBlueprint,
    config,
  );
  produced.report.repairs.scaleCorrections = scaleSafety.corrections;
  produced.report.repairs.scaleCorrectionsByTrack = scaleSafety.correctionsByTrack;
  produced.report.metrics.scaleFit = scaleSafety.scaleFit;
  produced.report.metrics.perceptualMaskingPairs = perceptualMix.report.maskingPairs;
  produced.report.metrics.perceptualDynamicRange = perceptualMix.report.dynamicRange;
  produced.report.metrics.spectralSpan = spectral.metrics.span;
  produced.report.checks.scaleSafety = scaleSafety.passed;
  const producerIntentAudit = auditProducerIntentContract(
    finalMaster.tracks,
    song.structure,
    song.songBlueprint?.producerIntent,
  );
  const postIntentAssembly = runFinalAssemblyPass(
    producerIntentAudit.tracks,
    finalAssemblyRepair.tracks,
    song.structure,
    song.songBlueprint,
  );
  const finalProducerIntentAudit = auditProducerIntentContract(
    postIntentAssembly.tracks,
    song.structure,
    song.songBlueprint?.producerIntent,
  );
  const repairedGrooveMemoryTracks = sourceCandidate.targetTrack
    ? finalProducerIntentAudit.tracks
    : applyFinalGrooveMemory(
      finalProducerIntentAudit.tracks,
      config,
      song.structure,
      song.songBlueprint,
      song.grooveConductor,
    );
  const repairedGrooveRhythmLock = lockFinalBassToSurvivingKicks(
    repairedGrooveMemoryTracks,
    config.genre,
    config.bars * beatsPerBar(config),
  );
  const repairedPostGrooveIntentAudit = auditProducerIntentContract(
    repairedGrooveRhythmLock.tracks,
    song.structure,
    song.songBlueprint?.producerIntent,
  );
  const repairedFinalGrooveAssembly = runFinalAssemblyPass(
    repairedPostGrooveIntentAudit.tracks,
    finalProducerIntentAudit.tracks,
    song.structure,
    song.songBlueprint,
  );
  const repairedTonalIntegrity = refineTonalIntegrity(
    repairedFinalGrooveAssembly.tracks,
    song.harmony,
    {
      keyPc: config.keyPc,
      scaleIntervals: config.scaleIntervals,
      beatsPerBar: beatsPerBar(config),
    },
    song.structure,
  );
  song.tracks = repairedTonalIntegrity.tracks;
  song.tonalIntegrity = repairedTonalIntegrity.report;
  produced.report.repairs.finalScaleCorrections = repairedTonalIntegrity.report.scaleCorrections;
  produced.report.repairs.tonalOutlierCorrections = repairedTonalIntegrity.report.chordCorrections;
  produced.report.metrics.finalScaleFit = repairedTonalIntegrity.report.after.scaleFit;
  produced.report.metrics.strongChordFit = repairedTonalIntegrity.report.after.strongChordFit;
  produced.report.checks.finalScaleSafety = repairedTonalIntegrity.report.after.scaleFit >= 0.999999;
  if (repairStrategy?.dimension === "performance") {
    const performanceRepair = rebalanceRepairPerformance(song);
    song.tracks = performanceRepair.tracks;
    song.performanceProfile = performanceRepair.performanceProfile;
    song.precisionRepair = performanceRepair.precisionRepair;
  }
  finalMaster.report.repairs.finalRhythmLock = repairedGrooveRhythmLock.repairs;
  song.finalRhythmLock = { status: "complete", repairs: repairedGrooveRhythmLock.repairs };
  song.finalAssembly = createFinalAssemblyReport(
    song.tracks,
    song.structure,
    song.songBlueprint,
    {
      featuredAnchorsRestored: finalAssemblyRepair.repairs.featuredAnchorsRestored
        + postIntentAssembly.repairs.featuredAnchorsRestored
        + repairedFinalGrooveAssembly.repairs.featuredAnchorsRestored,
      transitionEventsTagged: finalAssemblyRepair.repairs.transitionEventsTagged
        + postIntentAssembly.repairs.transitionEventsTagged
        + repairedFinalGrooveAssembly.repairs.transitionEventsTagged,
    },
  );
  song.sectionContrast = createSectionContrastReport(
    song.tracks,
    song.structure,
    song.songBlueprint.orchestrationMatrix,
  );
  song.producerPass = produced.report;
  song.perceptualMix = perceptualMix.report;
  song.spectrumPlan = spectrumPlan;
  song.voiceLeading = creativePolish.voiceLeading;
  song.pocketCohesion = creativePolish.pocketCohesion;
  song.negativeSpace = creativePolish.negativeSpace;
  song.vocalSpace = creativePolish.vocalSpace;
  song.ensembleCadence = creativePolish.ensembleCadence;
  song.transitionHandoff = creativePolish.transitionHandoff;
  song.producerIntent = clone(song.songBlueprint?.producerIntent);
  song.producerIntentReport = repairedPostGrooveIntentAudit.report;
  song.finalMaster = finalMaster.report;
  song.drumFillVocabulary = createDrumFillVocabularyReport(song.tracks, config.genre);
  song.rhythmTurnaroundConversation = createRhythmTurnaroundReport(song.tracks);
  song.meta = {
    ...song.meta,
    ideaFingerprint: null,
  };
  song.idea = createIdeaAnalysis(
    config,
    song.structure,
    song.harmony,
    song.style,
    song.tracks,
    song.oneShotKit,
    song.songBlueprint,
    song.performanceProfile,
  );
  song.idea.rhythmicFeatures.push(
    `Phase 20 ${diagnosis.group} repair · ${diagnosis.weakestDimension}`,
  );
  song.criticRepair = {
    phase: 20,
    version: 1,
    status: "awaiting-critic",
    attempt: attempt + 1,
    group: diagnosis.group,
    weakestDimension: diagnosis.weakestDimension,
    weakestScoreBefore: diagnosis.weakestScore,
    sourceCandidate: sourceCandidate.index,
    repairStrategy: specializedRepairSummary(repairStrategy),
  };
  return song;
}

function repairCandidateSong(sourceCandidate, diagnosis, seed, attempt, surgicalWindow = null, strategyWindow = surgicalWindow) {
  const sourceSong = sourceCandidate.song;
  const sourceTargetTrack = TRACK_DEFINITIONS[sourceCandidate.targetTrack] ? sourceCandidate.targetTrack : null;
  const sourceContextTracks = sourceCandidate.contextTracks ?? {};
  const baseConfig = normalizeConfig({
    ...configFromSong(sourceSong),
    seed,
    oneShotKitId: sourceSong.oneShotKit?.id ?? null,
  });
  const repairStrategy = createSpecializedRepairStrategy(
    sourceCandidate,
    diagnosis,
    strategyWindow,
    baseConfig,
  );
  const config = specializedRepairConfig(baseConfig, repairStrategy);
  const arrangementRepair = diagnosis.group === "arrangement";
  const harmonyRepair = diagnosis.group === "harmony";
  const motifRepair = diagnosis.group === "motif";
  const performanceRepair = diagnosis.group === "performance";
  const directRepair = directSpecializedRepairSource(
    sourceSong,
    repairStrategy,
    config,
    strategyWindow,
  );
  if (directRepair) {
    directRepair.id = "song-" + hashSeed(String(sourceSong.id ?? sourceSong.seed) + "|" + seed + "|" + repairStrategy.id).toString(36);
    directRepair.seed = seed;
    directRepair.settings = publicSettings(config);
    directRepair.title = sourceSong.title;
    directRepair.generationInterlock = clone(sourceSong.generationInterlock);
    const finishedDirect = finishRepairedSong(
      directRepair,
      config,
      diagnosis,
      sourceCandidate,
      attempt,
      repairStrategy,
    );
    return surgicalWindow && !arrangementRepair
      ? applySurgicalRepairWindow(
        sourceSong,
        finishedDirect,
        config,
        diagnosis,
        sourceCandidate,
        surgicalWindow,
        repairStrategy,
      )
      : finishedDirect;
  }
  const options = {
    generation: sourceSong.generation,
    revision: sourceSong.revision,
    parentId: sourceSong.parentId,
    style: sourceSong.style,
    oneShotKit: sourceSong.oneShotKit,
    compositionRoute: diagnosis.route ?? sourceSong.compositionRoute?.id,
    ...(arrangementRepair ? {} : {
      structure: sourceSong.structure,
      songBlueprint: sourceSong.songBlueprint,
    }),
    ...(harmonyRepair || arrangementRepair ? {} : { harmonyBlueprint: sourceSong.harmony }),
    ...(motifRepair || arrangementRepair ? {} : { motifs: sourceSong.motifs }),
    ...(performanceRepair || arrangementRepair ? {} : {
      performanceProfile: sourceSong.performanceProfile,
    }),
    ...(sourceTargetTrack ? {
      targetTrack: sourceTargetTrack,
      contextTracks: sourceContextTracks,
    } : harmonyRepair ? {
      targetTrack: "bass",
      contextTracks: {
        drums: sourceSong.tracks.find((track) => track.id === "drums"),
      },
    } : {}),
  };
  let variant = compose(config, options);
  variant = applySpecializedRepairMaterial(variant, repairStrategy, config, strategyWindow);
  let repaired;

  if (sourceTargetTrack) {
    repaired = clone(sourceSong);
    repaired.id = variant.id;
    repaired.seed = variant.seed;
    repaired.settings = variant.settings;
    repaired.compositionRoute = variant.compositionRoute;
    repaired.grooveConductor = variant.grooveConductor;
    repaired.tracks = replaceSongTracks(
      sourceSong.tracks,
      variant.tracks,
      repairStrategy.trackIds,
    );
  } else if (arrangementRepair) {
    repaired = variant;
  } else {
    repaired = clone(sourceSong);
    repaired.id = variant.id;
    repaired.seed = variant.seed;
    repaired.settings = variant.settings;
    repaired.compositionRoute = variant.compositionRoute;
    if (harmonyRepair) {
      repaired.harmony = variant.harmony;
      repaired.motifs = variant.motifs;
      repaired.grooveConductor = variant.grooveConductor;
      repaired.tracks = replaceSongTracks(
        sourceSong.tracks,
        variant.tracks,
        repairStrategy.trackIds,
      );
    } else if (diagnosis.group === "groove") {
      repaired.grooveConductor = variant.grooveConductor;
      repaired.tracks = replaceSongTracks(
        sourceSong.tracks,
        variant.tracks,
        repairStrategy.trackIds,
      );
    } else if (motifRepair) {
      repaired.motifs = variant.motifs;
      repaired.grooveConductor = variant.grooveConductor;
      repaired.tracks = replaceSongTracks(
        sourceSong.tracks,
        variant.tracks,
        repairStrategy.trackIds,
      );
    } else {
      repaired.performanceProfile = variant.performanceProfile;
      repaired.tracks = clone(variant.tracks);
    }
  }

  repaired.generationInterlock = clone(variant.generationInterlock);
  repaired.title = sourceSong.title;
  const finished = finishRepairedSong(
    repaired,
    config,
    diagnosis,
    sourceCandidate,
    attempt,
    repairStrategy,
  );
  return surgicalWindow && !arrangementRepair
    ? applySurgicalRepairWindow(sourceSong, finished, config, diagnosis, sourceCandidate, surgicalWindow, repairStrategy)
    : finished;
}

function qualityGateForEvaluation(evaluation) {
  const critical = ["harmonic", "groove", "separation", "production", "genreAuthenticity"];
  const criticalFloor = Math.min(...critical.map((name) => finite(evaluation?.subscores?.[name], 0)));
  const threshold = 62;
  const scaleFit = finite(evaluation?.diagnostics?.scaleFit, 0);
  const scaleSafe = scaleFit >= 1 - 1e-9;
  return {
    phase: 9,
    threshold,
    criticalFloor: 45,
    passed: finite(evaluation?.score, 0) >= threshold && criticalFloor >= 45 && scaleSafe,
    totalScore: finite(evaluation?.score, 0),
    lowestCriticalScore: criticalFloor,
    scaleFit,
    scaleSafe,
  };
}

export function evaluateSongReleaseGate(song, evaluation = evaluateSongCandidate(song)) {
  const subscores = evaluation?.subscores ?? {};
  const minimums = {
    total: 78,
    harmonic: 68,
    groove: 62,
    motif: 55,
    voiceLeading: 68,
    separation: 72,
    phraseResolution: 58,
    production: 68,
    stageInterlock: 68,
    genreAuthenticity: 58,
  };
  const failures = [];
  if (finite(evaluation?.score, 0) < minimums.total) failures.push(`total:${round(finite(evaluation?.score, 0))}<${minimums.total}`);
  for (const [dimension, floor] of Object.entries(minimums)) {
    if (dimension === "total") continue;
    const value = finite(subscores[dimension], 0);
    if (value < floor) failures.push(`${dimension}:${round(value)}<${floor}`);
  }
  const finalChecks = {
    ...(song?.finalMaster?.checks ?? {}),
    ...(song?.finalAssembly?.checks ?? {}),
  };
  if (!Object.keys(finalChecks).length || !Object.values(finalChecks).every(Boolean)) failures.push("final-contract");
  let exportReport = null;
  try {
    exportReport = createMidiExportReport(song);
    if (!Object.values(exportReport.checks).every(Boolean)) failures.push("midi-export");
  } catch {
    failures.push("midi-export");
  }
  return {
    version: 1,
    passed: failures.length === 0,
    minimums,
    failures,
    totalScore: finite(evaluation?.score, 0),
    exportChecks: exportReport?.checks ?? null,
  };
}

function rankCandidates(candidates) {
  return [...candidates]
    .filter((candidate) => evaluateCandidateOutcome(candidate).repairAccepted)
    .sort((left, right) => {
      const leftOutcome = evaluateCandidateOutcome(left);
      const rightOutcome = evaluateCandidateOutcome(right);
      return Number(rightOutcome.releasePassed) - Number(leftOutcome.releasePassed)
        || Number(rightOutcome.qualityPassed) - Number(leftOutcome.qualityPassed)
        || Number(rightOutcome.balancePassed) - Number(leftOutcome.balancePassed)
        || Number(rightOutcome.diversityPassed) - Number(leftOutcome.diversityPassed)
        || Number(rightOutcome.sectionOutcomePassed) - Number(leftOutcome.sectionOutcomePassed)
        || finite(right.selectionScore, right.evaluation.score) - finite(left.selectionScore, left.evaluation.score)
        || right.evaluation.score - left.evaluation.score
        || (Boolean(right.repair) - Boolean(left.repair))
        || left.index - right.index;
    });
}

function commitCandidate(candidates, search = {}) {
  const ranked = rankCandidates(candidates);
  const selected = ranked[0];
  if (!selected) throw new Error("Generation produced no candidates.");
  const qualityGate = qualityGateForEvaluation(selected.evaluation);
  const releaseGate = candidateReleaseGate(selected);
  const balance = evaluateCandidateBalance(selected.evaluation);
  const diversity = selected.diversity ?? diversityReportFromNovelty(selected.novelty, selected.song.generation);
  const sectionOutcome = selected.sectionOutcome ?? evaluateSectionOutcomeQuality(selected.song);
  selected.sectionOutcome = sectionOutcome;
  const outputOutcome = evaluateCandidateOutcome(selected, selected.song.generation);
  const criticRepair = search.criticRepair ?? {
    phase: 20,
    enabled: Boolean(search.targetedRepair),
    attempts: 0,
    groups: [],
    targetReached: false,
    reason: search.targetedRepair ? "not-needed" : "disabled",
  };
  const selectedFromRepair = Boolean(selected.repair);
  const repairStatus = criticRepair.attempts
    ? (selectedFromRepair && criticRepair.targetReached ? "passed" : "best-available")
    : "not-needed";
  const composedCandidates = candidates.filter((candidate) => !candidate.repair).length;
  const targetReached = candidates.some((candidate) => candidateMeetsAdaptiveTarget(
    candidate,
    selected.song.generation,
  ));

  selected.song.meta.scoreDetails = {
    criticVersion: selected.evaluation.version ?? 1,
    totalScore: selected.evaluation.score,
    selectionScore: selected.selectionScore,
    subscores: selected.evaluation.subscores,
    diagnostics: selected.evaluation.diagnostics ?? {},
    releaseGate,
    novelty: selected.novelty,
    diversity,
    sectionOutcome,
    outputOutcome,
    candidatesEvaluated: candidates.length,
    selectedCandidate: selected.index,
    balance,
    candidateSearch: {
      thinkingDepth: search.thinkingDepth ?? "standard",
      adaptive: Boolean(search.adaptive),
      weaknessAwareSearch: Boolean(search.weaknessAwareSearch),
      baseCandidateCount: finite(search.baseCandidateCount, candidates.length),
      maxCandidateCount: finite(search.maxCandidateCount, candidates.length),
      candidatesEvaluated: candidates.length,
      expandedBy: Math.max(0, composedCandidates - finite(search.baseCandidateCount, composedCandidates)),
      targetReached,
      focusGroup: search.weaknessFocus?.group ?? null,
      focusDimension: search.weaknessFocus?.weakestDimension ?? null,
      focusRoute: search.weaknessFocus?.route ?? null,
      focusScore: search.weaknessFocus?.weakestScore ?? null,
      focusHistory: clone(search.weaknessHistory ?? []),
    },
    criticRepair: {
      ...criticRepair,
      status: repairStatus,
      selectedFromRepair,
      selectedGroup: selected.repair?.group ?? null,
    },
    candidateScores: candidates.map((candidate) => {
      const { index, evaluation, novelty, selectionScore, song } = candidate;
      const diversity = candidate.diversity ?? diversityReportFromNovelty(novelty, song.generation);
      const sectionOutcome = candidate.sectionOutcome ?? evaluateSectionOutcomeQuality(song);
      const candidateBalance = evaluateCandidateBalance(evaluation);
      const outcome = evaluateCandidateOutcome({ ...candidate, sectionOutcome }, song.generation);
      return {
        index,
        score: evaluation.score,
        selectionScore,
        balanceScore: candidateBalance.balanceScore,
        creativeFloor: candidateBalance.creativeFloor,
        passedBalanceGate: candidateBalance.passed,
        noveltyScore: novelty?.score ?? 75,
        maxSimilarity: novelty?.maxSimilarity ?? 0,
        immediateSimilarity: novelty?.immediateSimilarity ?? 0,
        backToBackRepeat: Boolean(novelty?.backToBackRepeat),
        diversityPassed: outcome.diversityPassed,
        diversityIdentitySimilarity: diversity.identitySimilarity,
        nearCloneDimensions: clone(diversity.nearCloneDimensions ?? []),
        sectionOutcomePassed: outcome.sectionOutcomePassed,
        sectionOutcomeScore: outcome.sectionOutcomeScore,
        sectionAverageContrast: outcome.sectionAverageContrast,
        sectionWeakestContrast: outcome.sectionWeakestContrast,
        sectionWeakestPair: clone(outcome.sectionWeakestPair),
        outcomePassed: outcome.passed,
        outcomeStatus: outcome.status,
        adaptiveTarget: outcome.adaptiveTarget,
        compositionRoute: song.compositionRoute?.id ?? null,
        passedPhase9: qualityGateForEvaluation(evaluation).passed,
        passedReleaseGate: candidateReleaseGate(candidate).passed,
        repairGroup: song.criticRepair?.group ?? null,
        repairSourceCandidate: song.criticRepair?.sourceCandidate ?? null,
        repairAccepted: candidate.repairAccepted ?? null,
        repairAcceptanceReasons: clone(song.criticRepair?.acceptance?.reasons ?? []),
        repairMode: song.criticRepair?.mode ?? null,
        repairWindowId: song.criticRepair?.surgicalWindow?.id ?? null,
        repairWindowBars: song.criticRepair?.surgicalWindow?.bars ?? null,
        repairStrategyId: song.criticRepair?.repairStrategy?.id ?? null,
      };
    }),
  };
  selected.song.meta.novelty = selected.novelty;
  selected.song.meta.diversity = diversity;
  selected.song.meta.sectionOutcome = sectionOutcome;
  selected.song.meta.outputOutcome = outputOutcome;
  selected.song.meta.ideaFingerprint = createSongFingerprint(selected.song);
  if (selected.novelty?.compared) {
    selected.song.idea?.rhythmicFeatures?.push(`Compared with ${selected.novelty.compared} recent ${selected.novelty.compared === 1 ? "idea" : "ideas"}`);
  }
  selected.song.meta.qualityGate = qualityGate;
  selected.song.producerPass = {
    ...(selected.song.producerPass ?? { phase: 9, version: 1 }),
    status: outputOutcome.passed ? "passed" : "best-available",
    qualityGate,
    outputOutcome,
  };
  selected.song.criticRepair = {
    ...criticRepair,
    ...(selected.song.criticRepair ?? {}),
    phase: 20,
    status: repairStatus,
    selectedFromRepair,
    selectedGroup: selected.repair?.group ?? null,
  };
  selected.song.generationPhases = (selected.song.generationPhases ?? []).map((phase) => (
    phase.phase === 9
      ? { ...phase, status: qualityGate.passed ? "passed" : "best-available" }
      : phase
  ));
  selected.song.ideaEnginePhases = [
    { id: "composition-routes", status: "complete", route: selected.song.compositionRoute?.id ?? "harmony-first" },
    { id: "comparative-novelty", status: "complete", compared: selected.novelty?.compared ?? 0 },
    {
      id: "balanced-candidate-search",
      status: balance.passed ? "passed" : "best-available",
      candidatesEvaluated: candidates.length,
      expandedBy: selected.song.meta.scoreDetails.candidateSearch.expandedBy,
      balanceScore: balance.balanceScore,
      creativeFloor: balance.creativeFloor,
    },
    {
      id: "output-diversity-qc",
      status: outputOutcome.diversityPassed ? "passed" : "best-available",
      score: diversity.score,
      identitySimilarity: diversity.identitySimilarity,
      nearCloneDimensions: clone(diversity.nearCloneDimensions ?? []),
    },
    {
      id: "section-outcome-qc",
      status: outputOutcome.sectionOutcomePassed ? "passed" : "best-available",
      score: sectionOutcome.score,
      averageContrast: sectionOutcome.averageContrast,
      weakestContrast: sectionOutcome.weakestContrast,
      weakestPair: clone(sectionOutcome.weakestPair),
    },
    {
      id: "targeted-critic-repair",
      phase: 20,
      status: repairStatus,
      attempts: criticRepair.attempts,
      accepted: criticRepair.accepted ?? 0,
      rejected: criticRepair.rejected ?? 0,
      surgicalAttempts: criticRepair.surgicalAttempts ?? 0,
      groups: criticRepair.groups,
      selectedGroup: selected.repair?.group ?? null,
    },
  ];
  const committedRegister = refineRoleRegisters(selected.song.tracks, selected.song.structure, {
    releaseMelodyMax: 70,
    releaseCounterpointMax: 68,
  });
  selected.song.tracks = committedRegister.tracks;
  selected.song.registerIntegrity = committedRegister.report;
  selected.song.producerPass = {
    ...(selected.song.producerPass ?? { phase: 9, version: 1 }),
    repairs: {
      ...(selected.song.producerPass?.repairs ?? {}),
      registerCorrections: committedRegister.report.corrections,
      registerCorrectionsByTrack: committedRegister.report.correctionsByTrack,
      registerSeparationCorrections: committedRegister.report.separationCorrections ?? 0,
    },
  };
  const committedRegisterEvaluation = evaluateSongCandidate(selected.song);
  const committedRegisterRelease = evaluateSongReleaseGate(selected.song, committedRegisterEvaluation);
  selected.song.meta.scoreDetails.registerIntegrity = {
    corrections: committedRegister.report.corrections,
    hardViolations: committedRegister.report.after.hardViolations,
    preferredViolations: committedRegister.report.after.preferredViolations,
    registerHealth: committedRegisterEvaluation.subscores?.registerHealth ?? null,
    separation: committedRegisterEvaluation.subscores?.separation ?? null,
    releasePassed: committedRegisterRelease.passed,
    releaseFailures: clone(committedRegisterRelease.failures ?? []),
  };
  selected.song.meta.ideaFingerprint = createSongFingerprint(selected.song);
  return selected.song;
}

function candidateSelectionScore(evaluation, novelty, generation) {
  const balance = evaluateCandidateBalance(evaluation);
  const replayPenalty = generation === "new" && novelty?.backToBackRepeat ? 200 : 0;
  if (!novelty?.compared) {
    return round(evaluation.score * 0.8 + balance.balanceScore * 0.12 + balance.creativeFloor * 0.08 - replayPenalty);
  }
  const weights = generation === "similar"
    ? { quality: 0.68, balance: 0.12, floor: 0.08, novelty: 0.12 }
    : { quality: 0.7, balance: 0.12, floor: 0.08, novelty: 0.1 };
  return round(
    evaluation.score * weights.quality
    + balance.balanceScore * weights.balance
    + balance.creativeFloor * weights.floor
    + novelty.score * weights.novelty
    - replayPenalty,
  );
}

function melodicDialogueMetrics(song) {
  const melody = song?.tracks?.find((track) => track.id === "melody")?.notes ?? [];
  const counterpoint = song?.tracks?.find((track) => track.id === "counterpoint")?.notes ?? [];
  if (!counterpoint.length || !melody.length) {
    return {
      counterpointNotes: counterpoint.length,
      simultaneousRatio: 0,
      underLeadRatio: 0,
    };
  }
  const simultaneous = counterpoint.filter((note) => (
    melody.some((lead) => Math.abs(lead.start - note.start) < 0.00001)
  )).length;
  const underLead = counterpoint.filter((note) => (
    melody.some((lead) => (
      note.start > lead.start - 0.04
      && note.start < lead.start + lead.duration + 0.08
    ))
  )).length;
  return {
    counterpointNotes: counterpoint.length,
    simultaneousRatio: round(simultaneous / counterpoint.length, 4),
    underLeadRatio: round(underLead / counterpoint.length, 4),
  };
}

function evaluateMelodicDialoguePreservation(sourceSong, repairedSong, diagnosis = {}) {
  const thresholds = { simultaneousRatio: 0.1, underLeadRatio: 0.25 };
  const applies = String(diagnosis?.weakestDimension ?? "") === "registerHealth";
  if (!applies || !sourceSong || !repairedSong) {
    return {
      applies,
      preserved: true,
      sourceHealthy: null,
      repairedHealthy: null,
      source: null,
      repaired: null,
      thresholds,
    };
  }
  const sourceMetrics = melodicDialogueMetrics(sourceSong);
  const repairedMetrics = melodicDialogueMetrics(repairedSong);
  const healthy = (metrics) => (
    metrics.simultaneousRatio <= thresholds.simultaneousRatio + 1e-9
    && metrics.underLeadRatio <= thresholds.underLeadRatio + 1e-9
  );
  const sourceHealthy = healthy(sourceMetrics);
  const repairedHealthy = healthy(repairedMetrics);
  return {
    applies,
    // A register-health repair may relocate pitch/register, but it must not turn
    // an already-clean melodic conversation into stacked lead/counterpoint attacks.
    // Other dimensions (notably phrase resolution) retain their own cadence and
    // interlock acceptance contracts instead of being judged by this extra veto.
    preserved: !sourceHealthy || repairedHealthy,
    sourceHealthy,
    repairedHealthy,
    source: sourceMetrics,
    repaired: repairedMetrics,
    thresholds,
  };
}

export function evaluateRepairAcceptance(
  sourceEvaluation = {},
  repairedEvaluation = {},
  diagnosis = {},
  {
    sourceReleasePassed = null,
    repairedReleasePassed = null,
    sourceSong = null,
    repairedSong = null,
  } = {},
) {
  const dimension = String(diagnosis?.weakestDimension ?? "");
  const sourceSubscores = sourceEvaluation?.subscores ?? {};
  const repairedSubscores = repairedEvaluation?.subscores ?? {};
  const weakestScoreBefore = clamp(
    finite(sourceSubscores[dimension], diagnosis?.weakestScore ?? 0),
    0,
    100,
  );
  const weakestScoreAfter = clamp(
    finite(repairedSubscores[dimension], weakestScoreBefore),
    0,
    100,
  );
  const weaknessGain = round(weakestScoreAfter - weakestScoreBefore);
  const totalDelta = round(
    finite(repairedEvaluation?.score, 0) - finite(sourceEvaluation?.score, 0),
  );
  const sourceBalance = evaluateCandidateBalance(sourceEvaluation);
  const repairedBalance = evaluateCandidateBalance(repairedEvaluation);
  const balanceDelta = repairedBalance.balanceScore - sourceBalance.balanceScore;
  const creativeFloorDelta = repairedBalance.creativeFloor - sourceBalance.creativeFloor;
  const criticalDimensions = ["harmonic", "groove", "separation", "production", "genreAuthenticity"];
  const criticalRegressions = Object.fromEntries(
    criticalDimensions.map((name) => [
      name,
      round(Math.max(
        0,
        clamp(finite(sourceSubscores[name], 70), 0, 100)
          - clamp(finite(repairedSubscores[name], 70), 0, 100),
      )),
    ]),
  );
  const maxCriticalRegression = Math.max(0, ...Object.values(criticalRegressions));
  const sourceQuality = qualityGateForEvaluation(sourceEvaluation);
  const repairedQuality = qualityGateForEvaluation(repairedEvaluation);
  const scaleSafetyPreserved = !sourceQuality.scaleSafe || repairedQuality.scaleSafe;
  const phase9Preserved = !sourceQuality.passed || repairedQuality.passed;
  const releasePreserved = sourceReleasePassed !== true || repairedReleasePassed === true;
  const melodicDialogue = evaluateMelodicDialoguePreservation(sourceSong, repairedSong, diagnosis);
  const thresholds = {
    minimumWeaknessGain: 0.5,
    maximumTotalRegression: 1,
    maximumBalanceRegression: 2,
    maximumCreativeFloorRegression: 2,
    maximumCriticalRegression: 3,
  };
  const reasons = [];
  if (!dimension) reasons.push("missing-diagnosis");
  if (weaknessGain < thresholds.minimumWeaknessGain) reasons.push("weakness-not-improved");
  if (totalDelta < -thresholds.maximumTotalRegression) reasons.push("total-score-regression");
  if (balanceDelta < -thresholds.maximumBalanceRegression) reasons.push("balance-regression");
  if (creativeFloorDelta < -thresholds.maximumCreativeFloorRegression) reasons.push("creative-floor-regression");
  if (maxCriticalRegression > thresholds.maximumCriticalRegression) reasons.push("critical-dimension-regression");
  if (!scaleSafetyPreserved) reasons.push("scale-safety-regression");
  if (!phase9Preserved) reasons.push("quality-gate-regression");
  if (!releasePreserved) reasons.push("release-gate-regression");
  if (!melodicDialogue.preserved) reasons.push("melodic-dialogue-regression");
  const regressionReasons = reasons.filter((reason) => reason.includes("regression"));
  const supportingGains = Object.keys(repairedSubscores)
    .filter((name) => name !== dimension)
    .map((name) => round(
      clamp(finite(repairedSubscores[name], 70), 0, 100)
        - clamp(finite(sourceSubscores[name], 70), 0, 100),
    ));
  const bestSupportingGain = Math.max(0, ...supportingGains);
  const outcome = reasons.length
    ? regressionReasons.length ? "rejected-regression" : "rejected-no-gain"
    : (bestSupportingGain >= 1 ? "improved-balance" : "improved-target");
  return {
    version: 2,
    accepted: reasons.length === 0,
    outcome,
    bestSupportingGain: round(bestSupportingGain),
    dimension: dimension || null,
    weakestScoreBefore: round(weakestScoreBefore),
    weakestScoreAfter: round(weakestScoreAfter),
    weaknessGain,
    totalDelta,
    balanceDelta,
    creativeFloorDelta,
    maxCriticalRegression,
    criticalRegressions,
    scaleSafetyPreserved,
    phase9Preserved,
    releasePreserved,
    melodicDialoguePreserved: melodicDialogue.preserved,
    melodicDialogue,
    thresholds,
    reasons,
  };
}

function repairAssessmentUtility(assessment) {
  if (!assessment) return -Infinity;
  const acceptance = assessment.acceptance ?? {};
  return round(
    Number(Boolean(acceptance.accepted)) * 1000
      + Number(Boolean(assessment.repairedReleaseGate?.passed)) * 100
      + finite(acceptance.weaknessGain, 0) * 4
      + finite(acceptance.totalDelta, 0) * 2
      + finite(acceptance.balanceDelta, 0)
      + finite(acceptance.creativeFloorDelta, 0) * 0.5
      - finite(acceptance.maxCriticalRegression, 0) * 1.5,
  );
}

/**
 * Compare the already-generated surgical and whole-candidate repair options.
 * Accepted repairs always beat rejected repairs. When both are acceptable,
 * surgical locality wins close calls; a whole rewrite must be materially better
 * to justify touching more of the song.
 */
export function selectPreferredRepairAssessment(surgicalAssessment = null, wholeAssessment = null) {
  if (!surgicalAssessment && !wholeAssessment) {
    return { assessment: null, mode: null, reason: "no-repair-assessment", utilityDelta: 0 };
  }
  if (!surgicalAssessment) {
    return {
      assessment: wholeAssessment,
      mode: "whole-candidate",
      reason: "whole-only",
      utilityDelta: null,
    };
  }
  if (!wholeAssessment) {
    return {
      assessment: surgicalAssessment,
      mode: "surgical-window",
      reason: "surgical-only",
      utilityDelta: null,
    };
  }

  const surgicalAccepted = Boolean(surgicalAssessment.acceptance?.accepted);
  const wholeAccepted = Boolean(wholeAssessment.acceptance?.accepted);
  if (surgicalAccepted !== wholeAccepted) {
    const chooseWhole = wholeAccepted;
    return {
      assessment: chooseWhole ? wholeAssessment : surgicalAssessment,
      mode: chooseWhole ? "whole-candidate" : "surgical-window",
      reason: "accepted-over-rejected",
      utilityDelta: round(repairAssessmentUtility(wholeAssessment) - repairAssessmentUtility(surgicalAssessment)),
    };
  }

  const surgicalUtility = repairAssessmentUtility(surgicalAssessment);
  const wholeUtility = repairAssessmentUtility(wholeAssessment);
  const utilityDelta = round(wholeUtility - surgicalUtility);
  const wholeMateriallyBetter = utilityDelta > 2;
  if (wholeMateriallyBetter) {
    return {
      assessment: wholeAssessment,
      mode: "whole-candidate",
      reason: wholeAccepted ? "whole-materially-better" : "whole-less-regressive",
      utilityDelta,
    };
  }
  return {
    assessment: surgicalAssessment,
    mode: "surgical-window",
    reason: surgicalAccepted ? "surgical-locality-tiebreak" : "surgical-less-regressive",
    utilityDelta,
  };
}

const SONG_LEVEL_REPAIR_DIMENSIONS = new Set([
  "memory",
  "repetition",
  "drumVariety",
  "stageInterlock",
]);

function localTargetedRepairEligible(diagnosis = {}) {
  return !SONG_LEVEL_REPAIR_DIMENSIONS.has(String(diagnosis?.weakestDimension ?? ""));
}

function runTargetedCriticRepair(candidates, {
  search,
  generation,
  recentSongs,
  baseSeed,
} = {}) {
  const summary = {
    phase: 20,
    version: 1,
    enabled: Boolean(search?.targetedRepair),
    attempts: 0,
    accepted: 0,
    rejected: 0,
    surgicalAttempts: 0,
    surgicalWindows: [],
    groups: [],
    acceptanceHistory: [],
    skippedGlobalDimensions: [],
    targetReached: candidates.some((candidate) => candidateMeetsAdaptiveTarget(candidate, generation)),
    reason: null,
  };
  search.criticRepair = summary;

  if (!search?.targetedRepair || search.repairAttempts <= 0) {
    summary.reason = "disabled";
    return summary;
  }
  if (summary.targetReached) {
    summary.reason = "initial-target-reached";
    return summary;
  }

  const attemptedGroups = [];
  let attempt = 0;
  let diagnosticPasses = 0;
  while (
    attempt < search.repairAttempts
    && candidates.length < MAX_CANDIDATE_COUNT
    && diagnosticPasses < 8
  ) {
    const sourceCandidate = rankCandidates(candidates)[0];
    const diagnosis = diagnoseCandidateRepair(sourceCandidate.evaluation, attemptedGroups);
    if (!diagnosis) {
      summary.reason = "no-repair-group";
      break;
    }
    diagnosticPasses += 1;
    attemptedGroups.push(diagnosis.group);
    if (!localTargetedRepairEligible(diagnosis)) {
      summary.skippedGlobalDimensions.push({
        group: diagnosis.group,
        dimension: diagnosis.weakestDimension,
        score: diagnosis.weakestScore,
        reason: "song-level-search-owned",
      });
      continue;
    }
    const seed = candidateSeed(baseSeed, `repair-${diagnosis.group}`, attempt);
    const surgicalWindow = diagnosis.group === "arrangement"
      ? null
      : diagnoseSurgicalRepairWindow(sourceCandidate.song, diagnosis);
    const repairConfig = normalizeConfig({
      ...configFromSong(sourceCandidate.song),
      seed,
      oneShotKitId: sourceCandidate.song.oneShotKit?.id ?? null,
    });
    const wholeRepairSong = repairCandidateSong(sourceCandidate, diagnosis, seed, attempt, null, surgicalWindow);
    let surgicalRepairSource = wholeRepairSong;
    let surgicalRepairStrategy = wholeRepairSong.criticRepair?.repairStrategy ?? null;
    if (surgicalWindow && diagnosis.weakestDimension === "phraseResolution") {
      surgicalRepairSource = reinforceRepairPhraseResolution(
        sourceCandidate.song,
        repairConfig,
        surgicalWindow,
      );
      surgicalRepairSource.id = wholeRepairSong.id;
      surgicalRepairSource.seed = wholeRepairSong.seed;
      surgicalRepairSource.settings = clone(wholeRepairSong.settings ?? sourceCandidate.song.settings);
      surgicalRepairSource.criticRepair = clone(wholeRepairSong.criticRepair);
    }
    const surgicalSong = surgicalWindow
      ? applySurgicalRepairWindow(
        sourceCandidate.song,
        surgicalRepairSource,
        repairConfig,
        diagnosis,
        sourceCandidate,
        surgicalWindow,
        surgicalRepairStrategy,
      )
      : null;
    if (surgicalSong?.criticRepair?.surgicalWindow) {
      summary.surgicalAttempts += 1;
      summary.surgicalWindows.push(clone(surgicalSong.criticRepair.surgicalWindow));
    }
    const assessRepair = (candidateSong) => {
      const identitySong = normalizedSongForIdentity(candidateSong, {
        releaseMelodyMax: 76,
        releaseCounterpointMax: 74,
      });
      candidateSong.meta.ideaFingerprint = createSongFingerprint(identitySong);
      const evaluation = evaluateSongCandidate(candidateSong);
      const novelty = evaluateSongNovelty(identitySong, recentSongs, generation);
      const diversity = diversityReportFromNovelty(novelty, generation);
      const sectionOutcome = evaluateSectionOutcomeQuality(candidateSong);
      candidateSong.criticRepair.weakestScoreAfter = finite(
        evaluation.subscores?.[diagnosis.weakestDimension],
        diagnosis.weakestScore,
      );
      candidateSong.criticRepair.totalScoreBefore = sourceCandidate.evaluation.score;
      candidateSong.criticRepair.totalScoreAfter = evaluation.score;
      const repairedReleaseGate = evaluateSongReleaseGate(candidateSong, evaluation);
      const acceptance = evaluateRepairAcceptance(
        sourceCandidate.evaluation,
        evaluation,
        diagnosis,
        {
          sourceReleasePassed: candidateReleaseGate(sourceCandidate).passed,
          repairedReleasePassed: repairedReleaseGate.passed,
          sourceSong: sourceCandidate.song,
          repairedSong: candidateSong,
        },
      );
      candidateSong.criticRepair.acceptance = acceptance;
      return {
        song: candidateSong,
        evaluation,
        novelty,
        diversity,
        sectionOutcome,
        repairedReleaseGate,
        acceptance,
      };
    };
    const surgicalAssessment = surgicalSong ? assessRepair(surgicalSong) : null;
    const wholeAssessment = assessRepair(wholeRepairSong);
    const repairSelection = selectPreferredRepairAssessment(surgicalAssessment, wholeAssessment);
    const assessment = repairSelection.assessment ?? wholeAssessment;
    const wholeFallbackUsed = Boolean(
      surgicalAssessment
      && !surgicalAssessment.acceptance.accepted
      && wholeAssessment.acceptance.accepted
      && assessment === wholeAssessment
    );
    const { song, evaluation, novelty, diversity, sectionOutcome, repairedReleaseGate, acceptance } = assessment;
    const candidate = {
      index: candidates.length,
      song,
      evaluation,
      novelty,
      diversity,
      sectionOutcome,
      repair: song.criticRepair,
      repairAccepted: acceptance.accepted,
      releaseGate: repairedReleaseGate,
      targetTrack: sourceCandidate.targetTrack ?? null,
      contextTracks: sourceCandidate.contextTracks ?? null,
      selectionScore: candidateSelectionScore(evaluation, novelty, generation),
    };
    candidate.repairFallback = {
      surgicalAttempted: Boolean(surgicalAssessment),
      surgicalAccepted: surgicalAssessment?.acceptance.accepted ?? null,
      wholeAccepted: wholeAssessment.acceptance.accepted,
      surgicalOutcome: surgicalAssessment?.acceptance.outcome ?? null,
      wholeOutcome: wholeAssessment.acceptance.outcome ?? null,
      wholeFallbackUsed,
      selectedMode: repairSelection.mode,
      selectionReason: repairSelection.reason,
      selectionUtilityDelta: repairSelection.utilityDelta,
    };
    candidates.push(candidate);
    summary.attempts += 1;
    summary.groups.push(diagnosis.group);
    if (acceptance.accepted) summary.accepted += 1;
    else summary.rejected += 1;
    summary.acceptanceHistory.push({
      attempt: attempt + 1,
      group: diagnosis.group,
      sourceCandidate: sourceCandidate.index,
      accepted: acceptance.accepted,
      outcome: acceptance.outcome,
      dimension: acceptance.dimension,
      weaknessGain: acceptance.weaknessGain,
      totalDelta: acceptance.totalDelta,
      maxCriticalRegression: acceptance.maxCriticalRegression,
      repairMode: song.criticRepair?.mode ?? "whole-candidate",
      surgicalWindow: clone(song.criticRepair?.surgicalWindow ?? surgicalSong?.criticRepair?.surgicalWindow ?? null),
      surgicalTracks: clone(song.criticRepair?.surgicalTracks ?? surgicalSong?.criticRepair?.surgicalTracks ?? []),
      surgicalAttempted: Boolean(surgicalAssessment),
      surgicalAccepted: surgicalAssessment?.acceptance.accepted ?? null,
      wholeAccepted: wholeAssessment.acceptance.accepted,
      wholeFallbackUsed,
      selectedRepairMode: repairSelection.mode,
      selectionReason: repairSelection.reason,
      selectionUtilityDelta: repairSelection.utilityDelta,
      repairStrategyId: song.criticRepair?.repairStrategy?.id
        ?? surgicalSong?.criticRepair?.repairStrategy?.id
        ?? null,
      reasons: clone(acceptance.reasons),
    });
    attempt += 1;
    summary.targetReached = candidateMeetsAdaptiveTarget(candidate, generation);
    if (summary.targetReached) {
      summary.reason = "repair-target-reached";
      break;
    }
  }

  if (!summary.reason) {
    summary.reason = candidates.length >= MAX_CANDIDATE_COUNT
      ? "candidate-budget-reached"
      : attempt >= search.repairAttempts
        ? "repair-budget-reached"
        : summary.skippedGlobalDimensions.length
          ? "song-level-weakness-search-owned"
          : "no-repair-group";
  }
  return summary;
}

/**
 * Generate an entirely new arrangement. Supplying the same config.seed returns
 * byte-for-byte equivalent JSON; omit seed when a fresh random idea is desired.
 *
 * Generation is deliberately phased:
 * 1. Establish one root seed and a bounded candidate count.
 * 2. Compose a deterministic pool of distinct candidates.
 * 3. Score every candidate with the shared musical-quality equation.
 * 4. Expand the pool only when its balanced musical target is still unmet.
 * 5. Commit the strongest all-around candidate with a stable index tie-break.
 */
export function generateNew(input = {}) {
  const baseSeed = input.seed == null ? randomSeed() : String(input.seed);
  const search = candidateSearchPlan(input);
  const recentSongs = normalizeRecentSongs(input.recentSongs);
  const candidates = [];
  const composeCandidate = (index, preferredRoute = input.compositionRoute) => {
    const seed = candidateSeed(baseSeed, "new", index);
    const config = normalizeConfig({ ...input, seed });
    const routeId = candidateCompositionRoute(baseSeed, index, preferredRoute);
    const candidateSong = compose(config, {
      generation: "new",
      revision: 0,
      compositionRoute: routeId,
    });
    const identitySong = normalizedSongForIdentity(candidateSong);
    candidateSong.meta.ideaFingerprint = createSongFingerprint(identitySong);
    const evaluation = evaluateSongCandidate(candidateSong);
    const novelty = evaluateSongNovelty(identitySong, recentSongs, "new");
    const sectionOutcome = evaluateSectionOutcomeQuality(candidateSong);
    candidates.push({
      index,
      song: candidateSong,
      evaluation,
      novelty,
      sectionOutcome,
      selectionScore: candidateSelectionScore(evaluation, novelty, "new"),
    });
  };

  for (let index = 0; index < search.maxCandidateCount; index += 1) {
    const focus = index >= search.baseCandidateCount
      ? updateCandidateSearchFocus(search, candidates, "new")
      : null;
    composeCandidate(index, input.compositionRoute ?? focus?.route ?? null);
    if (candidates.length >= search.baseCandidateCount) {
      const targetReached = candidates.some((candidate) => candidateMeetsAdaptiveTarget(candidate, "new"));
      if (!search.adaptive || targetReached) break;
      updateCandidateSearchFocus(search, candidates, "new");
    }
  }

  // A fresh request must never settle for the immediately previous musical
  // identity. Search a few more deterministic routes even when the normal
  // candidate budget was explicitly small, but remain inside the global cap.
  while (
    recentSongs.length
    && candidates.length < MAX_CANDIDATE_COUNT
    && candidates.every((candidate) => candidate.novelty?.backToBackRepeat)
  ) {
    composeCandidate(candidates.length);
  }

  runTargetedCriticRepair(candidates, {
    search,
    generation: "new",
    recentSongs,
    baseSeed,
  });
  return commitCandidate(candidates, search);
}

/**
 * Generate a related arrangement from the current song's musical DNA.
 */
export function generateSimilar(current, input = {}) {
  if (!current || !Array.isArray(current.tracks) || !current.meta) {
    throw new TypeError("generateSimilar requires a generated song JSON object");
  }
  const base = configFromSong(current);
  const revision = Math.max(0, Math.round(finite(current.revision, 0))) + 1;
  const baseSeed = input.seed == null
    ? `${current.seed ?? current.id ?? "song"}:similar:${revision}`
    : String(input.seed);

  const search = candidateSearchPlan(input);
  const recentSongs = normalizeRecentSongs([current, ...(input.recentSongs ?? [])]);
  const candidates = [];

  for (let index = 0; index < search.maxCandidateCount; index += 1) {
    const focus = index >= search.baseCandidateCount
      ? updateCandidateSearchFocus(search, candidates, "similar")
      : null;
    const seed = candidateSeed(baseSeed, "similar", index);
    const requestedKitId = input.oneShotKitId ?? input.soundKitId ?? null;
    const previousKitId = current.oneShotKit?.id;
    const merged = {
      ...base,
      ...input,
      seed,
      oneShotKitId: requestedKitId,
      excludeOneShotKitIds: requestedKitId
        ? input.excludeOneShotKitIds
        : [previousKitId, ...(input.excludeOneShotKitIds ?? [])].filter(Boolean),
      tracks: mergeTrackInputs(base.tracks, input.tracks ?? input.trackSettings ?? input.instruments),
    };
    const config = normalizeConfig(merged);
    const rng = createSeededRandom(config.seed);
    const structure = adaptStructure(current.structure, config)
      ?? createStructure(config, rng.fork("structure"));
    const style = varyStyle(current.style, config, rng.fork("style-variation"));
    const motifs = varyMotifs(current.motifs, config, style, rng.fork("motif-variation"));
    const targetTrack = TRACK_DEFINITIONS[input.targetTrack] ? input.targetTrack : null;
    const routeId = candidateCompositionRoute(
      baseSeed,
      index,
      input.compositionRoute ?? (targetTrack ? current.compositionRoute?.id : focus?.route ?? null),
    );
    const inheritedContext = normalizeContextTracks(current.tracks, config);
    const suppliedContext = normalizeContextTracks(input.contextTracks, config);
    const targetContextTracks = { ...inheritedContext, ...suppliedContext };

    const candidateSong = compose(config, {
      generation: "similar",
      revision,
      parentId: current.id ?? null,
      structure,
      style,
      motifs,
      harmonyBlueprint: current.harmony,
      songBlueprint: current.songBlueprint,
      performanceProfile: current.performanceProfile,
      compositionRoute: routeId,
      targetTrack,
      contextTracks: targetContextTracks,
    });

    const identitySong = normalizedSongForIdentity(candidateSong);
    candidateSong.meta.ideaFingerprint = createSongFingerprint(identitySong);
    const evaluation = evaluateSongCandidate(candidateSong);
    const novelty = evaluateSongNovelty(identitySong, recentSongs, "similar");
    const sectionOutcome = evaluateSectionOutcomeQuality(candidateSong);
    candidates.push({
      index,
      song: candidateSong,
      evaluation,
      novelty,
      sectionOutcome,
      targetTrack,
      contextTracks: targetContextTracks,
      selectionScore: candidateSelectionScore(evaluation, novelty, "similar"),
    });
    if (candidates.length >= search.baseCandidateCount) {
      const targetReached = candidates.some((candidate) => candidateMeetsAdaptiveTarget(candidate, "similar"));
      if (!search.adaptive || targetReached) break;
      updateCandidateSearchFocus(search, candidates, "similar");
    }
  }

  runTargetedCriticRepair(candidates, {
    search,
    generation: "similar",
    recentSongs,
    baseSeed,
  });
  return commitCandidate(candidates, search);
}

export const SONG_VARIATION_DIRECTIONS = deepFreeze([
  {
    id: "pocket",
    label: "Pocket",
    description: "A stronger drum-and-bass conversation with more rhythmic lift.",
    route: "groove-first",
    variationDelta: 0.08,
    evolutionDelta: 0.03,
    surpriseDelta: -0.04,
    syncopationDelta: 0.1,
  },
  {
    id: "hook",
    label: "Hook",
    description: "A clearer lead motif, stronger callbacks, and more breathing room.",
    route: "hook-first",
    variationDelta: 0.06,
    evolutionDelta: 0.09,
    surpriseDelta: 0.02,
    syncopationDelta: 0,
  },
  {
    id: "journey",
    label: "Journey",
    description: "A wider section arc with richer harmony and more dramatic returns.",
    route: "harmony-first",
    variationDelta: 0.1,
    evolutionDelta: 0.14,
    surpriseDelta: 0.05,
    syncopationDelta: 0.02,
  },
]);

/**
 * Compose three recognizably related versions from one source song. Each
 * direction auditions a small candidate pair in the worker, so the set hears
 * six complete arrangements without blocking the interface or cloning one
 * result three times.
 */
export function generateSongVariations(current, input = {}) {
  if (!current || !Array.isArray(current.tracks) || !current.meta) {
    throw new TypeError("generateSongVariations requires a generated song JSON object");
  }
  const count = clamp(Math.round(finite(input.count, 3)), 1, 3);
  const candidatesPerVariation = clamp(Math.round(finite(input.candidatesPerVariation, 2)), 1, 4);
  const sourceSeed = String(input.seed ?? current.seed ?? current.id ?? "song");
  const setId = `variation-set-${hashSeed(`${sourceSeed}|${current.id ?? "song"}`).toString(36)}`;
  const baseVariation = clamp(finite(input.variation, current.settings?.variation ?? 0.42), 0, 1);
  const baseEvolution = clamp(finite(input.evolution, current.settings?.evolution ?? 0.58), 0, 1);
  const baseSurprise = clamp(finite(input.surprise, current.settings?.surprise ?? 0.28), 0, 1);
  const baseSyncopation = clamp(finite(input.syncopation, current.settings?.syncopation ?? 0.38), 0, 1);
  const variations = [];

  for (const [index, direction] of SONG_VARIATION_DIRECTIONS.slice(0, count).entries()) {
    const variation = generateSimilar(current, {
      ...input,
      count: undefined,
      candidatesPerVariation: undefined,
      seed: `${sourceSeed}:whole-song:${direction.id}`,
      candidateCount: candidatesPerVariation,
      adaptiveCandidates: false,
      targetedRepair: false,
      compositionRoute: direction.route,
      variation: clamp(baseVariation + direction.variationDelta, 0, 1),
      evolution: clamp(baseEvolution + direction.evolutionDelta, 0, 1),
      surprise: clamp(baseSurprise + direction.surpriseDelta, 0, 1),
      syncopation: clamp(baseSyncopation + direction.syncopationDelta, 0, 1),
      recentSongs: [current, ...variations, ...(input.recentSongs ?? [])],
      excludeOneShotKitIds: [
        current.oneShotKit?.id,
        ...variations.map((song) => song.oneShotKit?.id),
        ...(input.excludeOneShotKitIds ?? []),
      ].filter(Boolean),
    });
    variation.title = current.title;
    variation.parentId = current.id ?? null;
    variation.generation = "song-variation";
    variation.variationSet = {
      version: 1,
      id: setId,
      index,
      total: count,
      sourceSongId: current.id ?? null,
      sourceSeed: current.seed ?? null,
      candidatesAuditioned: candidatesPerVariation,
      direction: {
        id: direction.id,
        label: direction.label,
        description: direction.description,
      },
    };
    variations.push(variation);
  }
  return variations;
}

/**
 * Build bounded alternatives for one section while preserving every note,
 * harmony event, sound choice, and lock outside that section.
 */
export function generateSectionVariations(current, sectionId, input = {}) {
  if (!current?.meta || !Array.isArray(current.tracks)) {
    throw new TypeError("generateSectionVariations requires a generated song JSON object");
  }
  const section = (current.structure ?? current.sections ?? []).find((candidate) => String(candidate.id) === String(sectionId));
  if (!section) throw new RangeError(`Unknown section: ${sectionId}`);
  const count = clamp(Math.round(finite(input.count, 3)), 1, 3);
  const locked = new Set(Array.isArray(input.lockedTrackIds) ? input.lockedTrackIds.map(String) : []);
  const start = finite(section.startBeat, 0);
  const end = finite(section.endBeat, start + finite(section.bars, 1) * finite(current.meta.beatsPerBar, 4));

  return Array.from({ length: count }, (_, index) => {
    const candidate = generateSimilar(current, {
      ...input,
      seed: `${input.seed ?? current.seed ?? current.id}:section:${section.id}:${index}`,
      candidateCount: 1,
      maxCandidateCount: 1,
      adaptive: false,
      recentSongs: [],
    });
    const variation = clone(current);
    variation.id = `${current.id ?? "song"}-section-${section.id}-${index + 1}`;
    variation.parentId = current.id ?? null;
    variation.generation = "section-variation";
    variation.revision = Math.max(0, Math.round(finite(current.revision, 0))) + 1;
    variation.seed = candidate.seed;
    variation.title = current.title;
    variation.tracks = current.tracks.map((track) => {
      if (locked.has(String(track.id))) return clone(track);
      const replacement = candidate.tracks.find((entry) => entry.id === track.id);
      if (!replacement) return clone(track);
      return {
        ...clone(track),
        notes: [
          ...(track.notes ?? []).filter((note) => note.start < start - 1e-6 || note.start >= end - 1e-6),
          ...(replacement.notes ?? []).filter((note) => note.start >= start - 1e-6 && note.start < end - 1e-6),
        ].sort((left, right) => left.start - right.start || left.pitch - right.pitch),
        automation: [
          ...(track.automation ?? []).filter((event) => event.beat < start - 1e-6 || event.beat >= end - 1e-6),
          ...(replacement.automation ?? []).filter((event) => event.beat >= start - 1e-6 && event.beat < end - 1e-6),
        ].sort((left, right) => left.beat - right.beat),
      };
    });
    variation.harmony = [
      ...(current.harmony ?? []).filter((event) => event.start < start - 1e-6 || event.start >= end - 1e-6),
      ...(candidate.harmony ?? []).filter((event) => event.start >= start - 1e-6 && event.start < end - 1e-6),
    ].sort((left, right) => left.start - right.start);
    const candidateContract = candidate.generationInterlock?.sectionContracts
      ?.find((contract) => contract.sectionId === section.id);
    variation.generationInterlock = {
      ...clone(current.generationInterlock ?? candidate.generationInterlock),
      sectionContracts: (current.generationInterlock?.sectionContracts
        ?? candidate.generationInterlock?.sectionContracts
        ?? [])
        .map((contract) => (
          contract.sectionId === section.id && candidateContract
            ? clone(candidateContract)
            : clone(contract)
        )),
    };
    const evaluation = evaluateSongCandidate(variation);
    variation.meta.score = evaluation.score;
    variation.meta.scoreDetails = {
      criticVersion: evaluation.version,
      totalScore: evaluation.score,
      subscores: evaluation.subscores,
      diagnostics: evaluation.diagnostics,
    };
    variation.sectionVariation = {
      version: 1,
      sectionId: section.id,
      option: index + 1,
      preservedOutsideSection: true,
      lockedTrackIds: [...locked],
    };
    return variation;
  });
}


function utf8(text) {
  const bytes = [];
  for (const symbol of String(text)) {
    const code = symbol.codePointAt(0);
    if (code <= 0x7f) bytes.push(code);
    else if (code <= 0x7ff) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code <= 0xffff) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return bytes;
}

function variableLength(value) {
  let buffer = Math.max(0, Math.round(value)) & 0x0fffffff;
  const bytes = [buffer & 0x7f];
  while ((buffer >>= 7)) bytes.unshift((buffer & 0x7f) | 0x80);
  return bytes;
}

function u16(value) {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function u32(value) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function ascii(text) {
  return Array.from(text, (character) => character.charCodeAt(0));
}

function meta(type, payload) {
  return [0xff, type, ...variableLength(payload.length), ...payload];
}

function textMeta(type, text) {
  return meta(type, utf8(text));
}

function systemExclusive(payload) {
  return [0xf0, ...variableLength(payload.length), ...payload];
}

function eventOrder(event) {
  return event.order ?? 10;
}

function encodeTrack(events, endTick) {
  const sorted = [...events, { tick: endTick, order: 99, data: meta(0x2f, []) }]
    .sort((a, b) => a.tick - b.tick || eventOrder(a) - eventOrder(b));
  const bytes = [];
  let previousTick = 0;
  for (const event of sorted) {
    const tick = Math.max(previousTick, Math.round(event.tick));
    bytes.push(...variableLength(tick - previousTick), ...event.data);
    previousTick = tick;
  }
  return [...ascii("MTrk"), ...u32(bytes.length), ...bytes];
}

function keySignature(song) {
  // MIDI stores a key signature plus a major/minor hint, not a full mode.
  // Encode each mode's relative-major accidental set so modal exports retain
  // the pitches musicians actually see (for example C Dorian = two flats).
  const signatureByMajorPitchClass = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];
  const relativeMajorShift = {
    major: 0,
    majorPentatonic: 0,
    minor: 3,
    harmonicMinor: 3,
    melodicMinor: 3,
    minorPentatonic: 3,
    dorian: -2,
    phrygian: -4,
    lydian: 7,
    mixolydian: -5,
  };
  const mode = normalizeScale(song.meta.scale);
  const tonic = Number.isFinite(Number(song.meta.keyPc))
    ? mod(Math.round(Number(song.meta.keyPc)), 12)
    : normalizeKey(song.meta.key).pc;
  const relativeMajor = mod(tonic + (relativeMajorShift[mode] ?? 0), 12);
  const minorMode = ["minor", "harmonicMinor", "melodicMinor", "minorPentatonic", "dorian", "phrygian"].includes(mode);
  const signature = clamp(signatureByMajorPitchClass[relativeMajor] ?? 0, -7, 7);
  return [signature & 0xff, minorMode ? 1 : 0];
}

function conductorTrack(song, ppq) {
  const events = [];
  const totalTicks = Math.round(song.meta.totalBeats * ppq);
  events.push({ tick: 0, order: 0, data: textMeta(0x03, "Conductor") });
  events.push({ tick: 0, order: 1, data: systemExclusive([0x7e, 0x7f, 0x09, 0x03, 0xf7]) });
  events.push({ tick: 0, order: 2, data: textMeta(0x01, `MIDI Arcade · General MIDI 2 sound-ready export · ${song.title ?? "Untitled"} · ${song.genre ?? song.meta.genre ?? "song"}`) });
  events.push({ tick: 0, order: 2, data: textMeta(0x02, "Created with MIDI Arcade") });
  const microseconds = clamp(Math.round(60000000 / clamp(finite(song.meta.tempo, 120), 30, 300)), 1, 0xffffff);
  events.push({ tick: 0, order: 3, data: meta(0x51, [(microseconds >> 16) & 0xff, (microseconds >> 8) & 0xff, microseconds & 0xff]) });
  const [numerator, denominator] = normalizeTimeSignature(song.meta.timeSignature);
  const denominatorPower = Math.round(Math.log2(denominator));
  const metronome = denominator === 8 && numerator % 3 === 0 ? 36 : 24;
  const beatsPerBar = Math.max(0.01, finite(song.meta.beatsPerBar, numerator));
  events.push({ tick: 0, order: 4, data: meta(0x58, [numerator, denominatorPower, metronome, 8]) });
  events.push({ tick: 0, order: 5, data: meta(0x59, keySignature(song)) });
  for (const [index, section] of (song.structure ?? []).entries()) {
    const startBar = Math.max(0, Math.round(finite(section.startBar, finite(section.startBeat, 0) / beatsPerBar))) + 1;
    const endBar = startBar + Math.max(1, Math.round(finite(section.bars, 1))) - 1;
    events.push({
      tick: Math.round(finite(section.startBeat, 0) * ppq),
      order: 5,
      data: textMeta(0x06, `${String(index + 1).padStart(2, "0")} ${String(section.name ?? "Section").toUpperCase()} · bars ${startBar}-${endBar}`),
    });
  }
  for (const chord of song.harmony ?? []) {
    events.push({
      tick: clamp(Math.round(finite(chord.start, 0) * ppq), 0, totalTicks),
      order: 6,
      data: textMeta(0x07, String(chord.symbol ?? chord.roman ?? chord.root ?? "Chord")),
    });
  }
  return encodeTrack(events, totalTicks);
}

function cutoffControllerValue(value) {
  const cutoff = clamp(finite(value, 8000), 1000, 14000);
  return clamp(Math.round((cutoff - 1000) / 13000 * 127), 0, 127);
}

function musicalTrack(track, song, ppq, audible, trackIndex = 0, exportChannel = null) {
  const channel = track.id === "drums" ? 9 : clamp(Math.round(finite(exportChannel, track.channel ?? 0)), 0, 15);
  const defaults = TRACK_DEFINITIONS[track.id] ?? {};
  const settings = track.settings ?? {};
  const trackLabel = `${String(trackIndex + 1).padStart(2, "0")} ${track.name ?? track.id}`;
  const instrumentLabel = track.id === "drums"
    ? song.oneShotKit?.name
      ? `${song.oneShotKit.name} (General MIDI drum map)`
      : GM2_DRUM_KIT_NAMES[track.program] ?? "General MIDI Drum Kit"
    : programName(track.program);
  const events = [
    { tick: 0, order: 0, data: textMeta(0x03, trackLabel) },
    { tick: 0, order: 1, data: textMeta(0x04, instrumentLabel) },
    {
      tick: 0,
      order: 2,
      data: textMeta(
        0x01,
        `MIDI Arcade | ${audible ? "audible" : "muted"} | program ${clamp(Math.round(finite(track.program, 0)), 0, 127) + 1} ${instrumentLabel} | velocity ${Math.round(clamp(finite(settings.velocity, 1), 0.1, 1.5) * 100)}% | gate ${Math.round(clamp(finite(settings.gate, 1), 0.08, 1.5) * 100)}%`,
      ),
    },
  ];
  events.push({ tick: 0, order: 3, data: [0xb0 | channel, 0, track.id === "drums" ? 120 : 121] });
  events.push({ tick: 0, order: 4, data: [0xb0 | channel, 32, 0] });
  if (track.program != null) {
    events.push({ tick: 0, order: 5, data: [0xc0 | channel, clamp(Math.round(track.program), 0, 127)] });
  }
  events.push({ tick: 0, order: 6, data: [0xb0 | channel, 7, clamp(Math.round(unit(settings.volume, 0.8) * 127), 0, 127)] });
  events.push({ tick: 0, order: 7, data: [0xb0 | channel, 10, clamp(Math.round((clamp(finite(settings.pan, 0), -1, 1) + 1) * 63.5), 0, 127)] });
  events.push({ tick: 0, order: 8, data: [0xb0 | channel, 91, clamp(Math.round(unit(settings.reverb, 0.2) * 127), 0, 127)] });
  events.push({ tick: 0, order: 9, data: [0xb0 | channel, 74, cutoffControllerValue(settings.cutoff)] });
  events.push({ tick: 0, order: 10, data: [0xb0 | channel, 71, clamp(Math.round(unit(settings.resonance, 0.2) * 127), 0, 127)] });
  // Declare a conventional ±2-semitone bend range so pitch automation opens
  // consistently in DAWs and hardware instead of inheriting a device default.
  events.push({ tick: 0, order: 10, data: [0xb0 | channel, 101, 0] });
  events.push({ tick: 0, order: 10, data: [0xb0 | channel, 100, 0] });
  events.push({ tick: 0, order: 10, data: [0xb0 | channel, 6, 2] });
  events.push({ tick: 0, order: 10, data: [0xb0 | channel, 38, 0] });
  events.push({ tick: 0, order: 10, data: [0xb0 | channel, 101, 127] });
  events.push({ tick: 0, order: 10, data: [0xb0 | channel, 100, 127] });
  events.push({ tick: 0, order: 10, data: [0xe0 | channel, 0, 64] });
  const automation = Array.isArray(track.automation)
    ? track.automation.filter((event) => (
      event
      && ["cc", "pitchBend"].includes(event.type)
      && Number.isFinite(Number(event.beat))
      && Number.isFinite(Number(event.value))
      && (event.type !== "cc" || Number.isFinite(Number(event.controller)))
    ))
    : [];
  if (!automation.some((event) => Math.round(event.controller) === 11 && Math.abs(event.beat) < 1e-6)) {
    events.push({ tick: 0, order: 11, data: [0xb0 | channel, 11, 127] });
  }
  for (const automationEvent of automation) {
    if (automationEvent.type === "pitchBend") {
      const value = clamp(Math.round(automationEvent.value), 0, 16383);
      events.push({
        tick: clamp(Math.round(clamp(finite(automationEvent.beat, 0), 0, song.meta.totalBeats) * ppq), 0, Math.round(song.meta.totalBeats * ppq)),
        order: 13,
        data: [0xe0 | channel, value & 0x7f, (value >> 7) & 0x7f],
      });
      continue;
    }
    events.push({
      tick: clamp(Math.round(clamp(finite(automationEvent.beat, 0), 0, song.meta.totalBeats) * ppq), 0, Math.round(song.meta.totalBeats * ppq)),
      order: 12,
      data: [
        0xb0 | channel,
        clamp(Math.round(automationEvent.controller), 0, 127),
        clamp(Math.round(automationEvent.value), 0, 127),
      ],
    });
  }

  if (audible) {
    const velocityScale = Math.sqrt(
      clamp(finite(settings.velocity, defaults.velocity ?? 1), 0.1, 1.5)
      / Math.max(0.1, finite(defaults.velocity, settings.velocity ?? 1)),
    );
    const gateScale = clamp(Math.sqrt(
      clamp(finite(settings.gate, defaults.gate ?? 1), 0.08, 1.5)
      / Math.max(0.08, finite(defaults.gate, settings.gate ?? 1)),
    ), 0.65, 1.4);
    const totalTicks = Math.round(song.meta.totalBeats * ppq);
    for (const note of track.notes ?? []) {
      const phrasePerformance = renderPhrasePerformance(note);
      const pitch = canonicalMidiPitch(note.pitch);
      const velocity = clamp(Math.round(
        (finite(note.velocity, 90) + phrasePerformance.velocityDelta) * velocityScale,
      ), 1, 127);
      const onTick = clamp(Math.round(finite(note.start, 0) * ppq), 0, Math.max(0, totalTicks - 1));
      const offTick = clamp(
        Math.max(onTick + 1, Math.round((
          finite(note.start, 0)
          + finite(note.duration, 0.25) * gateScale * phrasePerformance.durationScale
        ) * ppq)),
        1,
        totalTicks,
      );
      events.push({ tick: onTick, order: 20, data: [0x90 | channel, pitch, velocity] });
      events.push({ tick: offTick, order: 10, data: [0x80 | channel, pitch, 0] });
    }
  }
  const endTick = Math.round(song.meta.totalBeats * ppq);
  events.push({ tick: endTick, order: 80, data: [0xb0 | channel, 64, 0] });
  events.push({ tick: endTick, order: 81, data: [0xe0 | channel, 0, 64] });
  events.push({ tick: endTick, order: 82, data: [0xb0 | channel, 123, 0] });
  return encodeTrack(events, endTick);
}

/**
 * Encode a song as a Standard MIDI File type 1 Uint8Array. The first track is a
 * conductor track; every instrument receives its own named MIDI track.
 */
function selectedExportTracks(song, options = {}) {
  if (!Array.isArray(options.trackIds)) return song.tracks;
  const requested = new Set(options.trackIds.map(String));
  const selected = song.tracks.filter((track) => requested.has(String(track.id)));
  if (!selected.length) throw new RangeError("encodeMidi trackIds did not match any song tracks");
  return selected;
}

function resolveExportChannels(tracks) {
  const used = new Set();
  const channels = new Map();
  for (const track of tracks) {
    if (track.id === "drums") {
      channels.set(track, 9);
      used.add(9);
      continue;
    }
    const preferred = clamp(Math.round(finite(track.channel, 0)), 0, 15);
    const channel = preferred !== 9 && !used.has(preferred)
      ? preferred
      : Array.from({ length: 16 }, (_, index) => index).find((candidate) => candidate !== 9 && !used.has(candidate));
    if (!Number.isFinite(channel)) throw new RangeError("MIDI export has more melodic tracks than available channels");
    channels.set(track, channel);
    used.add(channel);
  }
  return channels;
}

export function createMidiExportReport(song, options = {}) {
  if (!song?.meta || !Array.isArray(song.tracks)) throw new TypeError("createMidiExportReport requires a song JSON object");
  const tracks = selectedExportTracks(song, options);
  const channels = resolveExportChannels(tracks);
  const soloed = tracks.filter((track) => track.settings?.solo);
  const includeMuted = Boolean(options.includeMuted);
  const alwaysIncluded = new Set(Array.isArray(options.alwaysIncludeTrackIds) ? options.alwaysIncludeTrackIds.map(String) : []);
  const trackReports = tracks.map((track) => {
    const audible = includeMuted
      || alwaysIncluded.has(String(track.id))
      || (!track.settings?.mute && (!soloed.length || track.settings?.solo));
    return {
      id: String(track.id),
      name: String(track.name ?? track.id),
      channel: channels.get(track) + 1,
      program: clamp(Math.round(finite(track.program, 0)), 0, 127),
      audible,
      notes: audible ? (track.notes ?? []).length : 0,
      automationEvents: Array.isArray(track.automation) ? track.automation.length : 0,
      channelReassigned: track.id !== "drums" && channels.get(track) !== clamp(Math.round(finite(track.channel, 0)), 0, 15),
    };
  });
  const warnings = [];
  if (trackReports.some((track) => !track.audible)) warnings.push("Muted or non-soloed tracks are retained as named empty shells");
  if (trackReports.some((track) => track.channelReassigned)) warnings.push("Conflicting MIDI channels were reassigned safely");
  return {
    version: 1,
    format: 1,
    ppq: clamp(Math.round(finite(options.ppq, song.meta.ppq ?? PPQ)), 24, 32767),
    tracks: trackReports,
    trackCount: trackReports.length,
    noteCount: trackReports.reduce((sum, track) => sum + track.notes, 0),
    sectionMarkers: (song.structure ?? []).length,
    chordCues: (song.harmony ?? []).length,
    tempo: clamp(finite(song.meta.tempo, 120), 30, 300),
    timeSignature: normalizeTimeSignature(song.meta.timeSignature),
    keySignature: keySignature(song),
    warnings,
    checks: {
      type1: true,
      conductorTrack: true,
      uniqueChannels: new Set(trackReports.map((track) => track.channel)).size === trackReports.length,
      drumChannel10: trackReports.every((track) => track.id !== "drums" || track.channel === 10),
      boundedNotes: tracks.every((track) => (track.notes ?? []).every((note) => (
        Number.isFinite(note.pitch)
        && Number.isFinite(note.start)
        && Number.isFinite(note.duration)
        && note.pitch >= 0 && note.pitch <= 127
        && note.start >= 0 && note.duration > 0
        && note.start + note.duration <= song.meta.totalBeats + 1e-6
      ))),
    },
  };
}

export function encodeMidi(song, options = {}) {
  if (!song?.meta || !Array.isArray(song.tracks)) throw new TypeError("encodeMidi requires a song JSON object");
  const ppq = clamp(Math.round(finite(options.ppq, song.meta.ppq ?? PPQ)), 24, 32767);
  const tracks = selectedExportTracks(song, options);
  const channels = resolveExportChannels(tracks);
  const report = createMidiExportReport(song, options);
  if (!Object.values(report.checks).every(Boolean)) throw new RangeError("MIDI export preflight rejected invalid song or channel data");
  const soloed = tracks.filter((track) => track.settings?.solo);
  const includeMuted = Boolean(options.includeMuted);
  const alwaysIncluded = new Set(Array.isArray(options.alwaysIncludeTrackIds) ? options.alwaysIncludeTrackIds.map(String) : []);
  const chunks = [conductorTrack(song, ppq)];
  for (const [trackIndex, track] of tracks.entries()) {
    const audible = includeMuted
      || alwaysIncluded.has(String(track.id))
      || (!track.settings?.mute && (!soloed.length || track.settings?.solo));
    chunks.push(musicalTrack(track, song, ppq, audible, trackIndex, channels.get(track)));
  }
  const header = [
    ...ascii("MThd"),
    ...u32(6),
    ...u16(1),
    ...u16(chunks.length),
    ...u16(ppq),
  ];
  return new Uint8Array([...header, ...chunks.flat()]);
}

/** Create a browser Blob containing the type-1 MIDI file. */
export function createMidiBlob(song, options = {}) {
  if (typeof Blob === "undefined") throw new Error("Blob is not available in this environment");
  return new Blob([encodeMidi(song, options)], { type: "audio/midi" });
}

/** Trigger a browser download and return the final filename. */
export function downloadMidi(song, filename = null, options = {}) {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("downloadMidi is available only in a browser; use encodeMidi in Node.js");
  }
  const base = String(filename ?? song.title ?? "midi-arcade-song")
    .replace(/\.mid$/i, "")
    .replace(/[^a-z0-9 _-]+/gi, "")
    .trim()
    .replace(/\s+/g, "-") || "midi-arcade-song";
  const finalName = `${base}.mid`;
  const url = URL.createObjectURL(createMidiBlob(song, options));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = finalName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return finalName;
}
