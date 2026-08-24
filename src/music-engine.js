/**
 * MIDI Arcade music engine.
 *
 * Dependency-free, deterministic (when a seed is supplied), and deliberately
 * independent of any UI framework. Timing values in the JSON song model are
 * expressed in quarter-note beats; MIDI conversion happens only in encodeMidi.
 */

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
    arrangement: { form: "half-time", chorusLift: 0.22, fillFrequency: 0.72, phraseBars: 4 },
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
  const palette = profile.instrumentPrograms[id] ?? [defaults.program];
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
    instrumentPrograms[trackId] = Array.from(new Set(orderedProgs));
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

  return {
    seed,
    genre,
    secondaryGenre,
    fusionBlend,
    isFusion: Boolean(profile.isFusion),
    genreLabel: profile.label,
    chordPath,
    key: key.name,
    keyPc: key.pc,
    scale,
    scaleIntervals: [...SCALES[scale]],
    tempo: clamp(round(finite(input.tempo == null || input.tempo === "" ? profile.bpm.default : input.tempo, profile.bpm.default), 3), 30, 300),
    bars: clamp(Math.round(finite(input.bars, DEFAULT_CONFIG.bars)), 1, 128),
    timeSignature,
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
    oneShotKitId: input.oneShotKitId == null && input.soundKitId == null
      ? null
      : String(input.oneShotKitId ?? input.soundKitId).slice(0, 80),
    excludeOneShotKitIds: [...new Set(
      (Array.isArray(input.excludeOneShotKitIds) ? input.excludeOneShotKitIds : [])
        .map((id) => String(id))
        .filter(Boolean),
    )].slice(0, 32),
    title: input.title == null ? null : String(input.title).slice(0, 100),
    tracks,
  };
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

const SPECIAL_FORM_LAYOUTS = deepFreeze({
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
  return clone(bars <= 7 ? template.short : bars <= 16 ? template.medium : template.full);
}

function createStructure(config, rng) {
  const bars = config.bars;
  const form = GENRE_PROFILES[config.genre].arrangement.form;
  // Reggaeton also has a club-ready profile, but its verse/chorus form must not
  // be mistaken for a House/Techno build-drop arrangement.
  const electronic = ["house", "techno", "drumBass"].includes(config.genre);
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
        : [{ name: "intro", weight: 1 }, { name: "verse", weight: 2 }, { name: "prechorus", weight: 1 }, { name: "chorus", weight: 2 }, { name: "outro", weight: 1 }];
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
  const sizes = allocateBars(layout, bars);
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

function featuredTrackForSection(section, plan, config, occurrence = 0) {
  if (section.name === "intro" || ["breakdown", "outro"].includes(section.name)) return "pad";
  if (section.name === "bridge") return "counterpoint";
  if (section.name === "solo") return occurrence % 2 ? "melody" : "counterpoint";
  if (section.name === "drop") return plan.role === "peak" ? "bass" : "drums";
  if (["prechorus", "build"].includes(section.name)) return "chords";
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
    const inherited = source?.orchestrationMatrix?.find((entry) => entry.sectionId === section.id)
      ?? source?.orchestrationMatrix?.find((entry) => entry.sectionName === section.name);
    if (inherited?.lanes) return clone(inherited);
    const shape = ORCHESTRATION_SHAPES[section.name] ?? ORCHESTRATION_SHAPES.idea;
    const occurrence = occurrences.get(section.name) ?? 0;
    occurrences.set(section.name, occurrence + 1);
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

function createMemoryMap(structure, sectionPlans, hookSectionId, source = null) {
  const firstByName = new Map();
  return structure.map((section, index) => {
    const inherited = source?.memoryMap?.find((entry) => entry.sectionId === section.id);
    if (inherited) return clone(inherited);
    const plan = sectionPlans[index];
    const origin = firstByName.get(section.name);
    if (!origin) firstByName.set(section.name, section);
    const contrastAxis = ["rhythm", "register", "density", "harmony"][index % 4];
    if (origin) {
      return {
        sectionId: section.id,
        originSectionId: origin.id,
        relationship: plan.role === "peak" ? "return" : "recall",
        recallStrength: plan.role === "peak" ? 0.88 : 0.78,
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
  const direction = rng.bool(0.58) ? 1 : -1;
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
          phraseBars: clamp(Math.round(finite(style.rhythmIdentity?.phraseCycle, 2)), 2, 4),
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
      developmentPath: developmentPathForTransform(motifTransform),
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
  const memoryMap = createMemoryMap(structure, sectionPlans, hookSection?.id, source);
  return {
    version: 5,
    narrative: { id: narrative.id, label: narrative.label },
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
      grooveLock: round(clamp(0.68 + config.energy * 0.18, 0.62, 0.9)),
      transitionClarity: round(clamp(0.62 + config.evolution * 0.24, 0.58, 0.9)),
      harmonicJourney: round(clamp(0.64 + config.complexity * 0.18, 0.6, 0.88)),
      orchestrationContrast: round(clamp(0.58 + config.evolution * 0.3, 0.56, 0.9)),
      memoryRecall: round(clamp(0.7 + (1 - config.surprise) * 0.14, 0.66, 0.88)),
    },
    styleAnchor: {
      drumGroove: style.drumGroove,
      bassGroove: style.bassGroove,
      chordMotion: style.chordMotion,
      melodyShape: style.melodyShape,
    },
    sectionPlans,
    transitions,
    orchestrationMatrix,
    memoryMap,
  };
}

function applySongBlueprint(structure, blueprint) {
  const plans = new Map((blueprint?.sectionPlans ?? []).map((plan) => [plan.sectionId, plan]));
  const incoming = new Map((blueprint?.transitions ?? []).map((transition) => [transition.toSectionId, transition]));
  const outgoing = new Map((blueprint?.transitions ?? []).map((transition) => [transition.fromSectionId, transition]));
  const orchestration = new Map((blueprint?.orchestrationMatrix ?? []).map((entry) => [entry.sectionId, entry]));
  const memories = new Map((blueprint?.memoryMap ?? []).map((entry) => [entry.sectionId, entry]));
  return structure.map((section) => {
    const plan = plans.get(section.id);
    if (!plan) return section;
    return {
      ...section,
      intensity: round(clamp(sectionIntensity(section.name) * (0.84 + plan.energy * 0.22), 0.32, 1.25)),
      intent: {
        role: plan.role,
        energy: plan.energy,
        tension: plan.tension,
        density: plan.density,
        cadence: plan.cadence,
        motifTransform: plan.motifTransform,
        harmonicRole: plan.harmonicRole,
        harmonicColor: plan.harmonicColor,
        transitionIn: incoming.get(section.id)?.type ?? null,
        transitionOut: outgoing.get(section.id)?.type ?? null,
        featuredTrack: orchestration.get(section.id)?.featuredTrack ?? null,
        memoryRelationship: memories.get(section.id)?.relationship ?? "statement",
      },
    };
  });
}

function blueprintPlanForSection(blueprint, section) {
  return blueprint?.sectionPlans?.find((plan) => plan.sectionId === section.id)
    ?? blueprint?.sectionPlans?.find((plan) => plan.sectionName === section.name)
    ?? null;
}

function plannedTensionAtBeat(blueprint, section, beat, barBeats = 4) {
  const plan = blueprintPlanForSection(blueprint, section);
  if (!plan) return clamp(finite(section?.intensity, 0.8) / 1.25, 0, 1);
  const envelope = plan.tensionEnvelope;
  if (!envelope) return clamp(finite(plan.tension, 0.5), 0, 1);
  const duration = Math.max(0.001, section.endBeat - section.startBeat);
  const progress = clamp((beat - section.startBeat) / duration, 0, 1);
  const peakAt = clamp(finite(envelope.peakAt, 0.62), 0.1, 0.95);
  const smooth = (value) => value * value * (3 - 2 * value);
  const base = progress <= peakAt
    ? finite(envelope.start, plan.tension)
      + (finite(envelope.peak, plan.tension) - finite(envelope.start, plan.tension)) * smooth(progress / peakAt)
    : finite(envelope.peak, plan.tension)
      + (finite(envelope.end, plan.tension) - finite(envelope.peak, plan.tension))
        * smooth((progress - peakAt) / (1 - peakAt));
  const phraseBeats = Math.max(barBeats * 2, barBeats * Math.round(finite(envelope.phraseBars, 2)));
  const phraseProgress = mod(Math.max(0, beat - section.startBeat), phraseBeats) / phraseBeats;
  const phraseLift = smooth(phraseProgress) * finite(envelope.phraseLift, 0);
  return round(clamp(base + phraseLift, 0, 1));
}

function transitionFromSection(blueprint, section) {
  return blueprint?.transitions?.find((transition) => transition.fromSectionId === section?.id) ?? null;
}

function transitionIntoSection(blueprint, section) {
  return blueprint?.transitions?.find((transition) => transition.toSectionId === section?.id) ?? null;
}

function sectionForBar(structure, bar) {
  return structure.find((section) => bar >= section.startBar && bar < section.startBar + section.bars)
    ?? structure[structure.length - 1];
}

const RHYTHM_IDENTITY_WORDS = {
  neoSoul: ["Velvet drag", "Pocket weave", "Side-street swing", "Late-night push"],
  hipHop: ["Head-nod stagger", "Concrete bounce", "Dusty switch", "Corner-pocket knock"],
  rap: ["Verse-first knock", "Cipher pocket", "Bar-line bounce", "Vocal-space break"],
  trap: ["Triplet recoil", "Midnight rattle", "Half-time pressure", "Chrome stutter"],
  house: ["Warehouse lift", "Mirrorball skip", "Club pulse", "Afterhours drive"],
  techno: ["Machine torque", "Tunnel pressure", "Steel hypnosis", "Circuit stride"],
  drumBass: ["Jungle chase", "Airbreak sprint", "Two-step rush", "Broken-beat flight"],
  synthwave: ["Neon motor", "Night-drive pulse", "Arcade stride", "Chrome horizon"],
  pop: ["Hook-step bounce", "Radio lift", "Bright pocket", "Snapback drive"],
  loFiHipHop: ["Tape-worn nod", "Rainy-window drift", "Dust-loop sway", "Soft-focus knock"],
  rnbSoul: ["Silk-pocket pull", "Slow-bloom sway", "Vocal-space drift", "After-dark glide"],
  drill: ["Sliding pressure", "Cold-step recoil", "Shadow bounce", "Streetlight stagger"],
  reggaeton: ["Dembow turn", "Coastal bounce", "Night-market sway", "Palm-lit drive"],
  afrobeats: ["Highlife skip", "Sunset interlock", "Palm-wine lift", "Cross-rhythm glow"],
  jazz: ["Brush-step conversation", "Blue-note spring", "Late-set swing", "Corner-table pulse"],
  ambient: ["Tidal breath", "Cloud-drift cycle", "Slow-orbit bloom", "Weightless echo"],
  funk: ["Pocket snap", "Rubber-band stride", "Clavinet switch", "Backbeat strut"],
  country: ["Front-porch train", "Two-lane shuffle", "Bootheel pocket", "Open-road backbeat"],
  rock: ["Amp-room drive", "Crash-line charge", "Garage backbeat", "Arena push"],
};

function createRhythmIdentity(config, drumGroove, rng) {
  const labels = RHYTHM_IDENTITY_WORDS[config.genre] ?? RHYTHM_IDENTITY_WORDS.pop;
  const nativeIdentity = {
    house: { hats: ["offbeat", "steady"], percussion: ["shaker", "tambourine"], pockets: ["centered", "pushed"] },
    techno: { hats: ["steady", "rising"], percussion: ["cowbell", "shaker"], pockets: ["centered", "pushed"] },
    drumBass: { hats: ["skip", "alternating"], percussion: ["ride", "shaker"], pockets: ["pushed", "centered"] },
    trap: { hats: ["rising", "skip", "alternating"], percussion: ["shaker", "cowbell"], pockets: ["centered", "pushed"] },
    drill: { hats: ["skip", "rising", "alternating"], percussion: ["shaker", "cowbell"], pockets: ["centered", "pushed"] },
    reggaeton: { hats: ["offbeat", "alternating"], percussion: ["shaker", "cowbell"], pockets: ["centered", "laidBack"] },
    afrobeats: { hats: ["skip", "offbeat", "alternating"], percussion: ["shaker", "cowbell"], pockets: ["laidBack", "elastic"] },
    jazz: { hats: ["skip", "alternating"], percussion: ["ride"], pockets: ["elastic", "laidBack"] },
    ambient: { hats: ["steady", "sparse"], percussion: ["ride", "shaker"], pockets: ["elastic", "laidBack"] },
    funk: { hats: ["alternating", "skip"], percussion: ["cowbell", "tambourine"], pockets: ["laidBack", "elastic"] },
    country: { hats: ["alternating", "steady"], percussion: ["tambourine", "ride"], pockets: ["live", "centered"] },
    rock: { hats: ["steady", "rising"], percussion: ["tambourine", "ride"], pockets: ["live", "pushed"] },
  }[config.genre] ?? {};
  const hatMotions = nativeIdentity.hats ?? ["steady", "offbeat", "skip", "rising", "alternating"];
  const percussionVoices = nativeIdentity.percussion ?? ["ride", "tambourine", "cowbell", "shaker"];
  const phraseCycles = config.complexity > 0.7 ? [2, 3, 4] : [2, 4];
  const phraseShapes = ["questionAnswer", "syncopatedLoop", "longShort", "staircase", "sparseEcho"];
  const contourShapes = ["arch", "valley", "wave", "climbFall", "fallRebound", "pedalLaunch"];
  const timingPockets = nativeIdentity.pockets ?? ["centered", "laidBack", "pushed", "elastic"];
  const motifBarChoices = config.bars >= 8 && config.complexity > 0.72
    ? [1, 2, 2, 3]
    : [1, 2, 2];
  const signature = hashSeed(`${rng.seed}|${config.genre}|${drumGroove}`).toString(36).slice(0, 5).toUpperCase();
  return {
    id: `${config.genre}-${signature.toLowerCase()}`,
    label: rng.pick(labels),
    signature,
    kickRotation: rng.int(0, 3),
    accentRotation: rng.int(0, 3),
    hatMotion: rng.pick(hatMotions),
    percussionVoice: rng.pick(percussionVoices),
    phraseCycle: rng.pick(phraseCycles),
    phraseShape: rng.pick(phraseShapes),
    contourShape: rng.pick(contourShapes),
    motifBars: rng.pick(motifBarChoices),
    timingPocket: rng.pick(timingPockets),
    cadenceGap: rng.pick([0, 0.25, 0.5, 0.75]),
    ghostBias: round(clamp(0.22 + config.syncopation * 0.38 + rng.float() * 0.28, 0.18, 0.86), 3),
    mutationBias: round(clamp(0.18 + config.variation * 0.42 + config.surprise * 0.28 + rng.float() * 0.18, 0.16, 0.92), 3),
  };
}

function createStyle(config, rng) {
  const profile = GENRE_PROFILES[config.genre];
  const drumWeights = profile.grooveWeights.drumGroove;
  const bassWeights = profile.grooveWeights.bassGroove;
  const chordWeights = profile.grooveWeights.chordMotion;
  const genreDrumAnchor = {
    trap: "halfTime", drill: "halfTime", house: "fourFloor", techno: "fourFloor",
    drumBass: "breakbeat", reggaeton: "electro", afrobeats: "electro",
    jazz: "breakbeat", ambient: "halfTime", funk: "backbeat", country: "backbeat", rock: "backbeat",
  }[config.genre];
  const styleWeighted = (weights, bonusFor) => {
    const exponent = 1.35 - config.surprise * 0.9;
    return rng.weighted(Object.entries(weights).map(([name, weight]) => [
      name,
      Math.pow(Math.max(0.01, weight + bonusFor(name)), exponent),
    ]));
  };
  const style = {
    drumGroove: genreDrumAnchor ?? styleWeighted(drumWeights, (name) => (
      name === "fourFloor" ? config.energy * 0.7
        : name === "breakbeat" ? config.complexity * 0.8
          : name === "electro" ? config.syncopation * 0.45 : 0
    )),
    bassGroove: styleWeighted(bassWeights, (name) => (
      name === "syncopated" ? config.syncopation * 0.8
        : name === "pulse" ? config.energy * 0.55
          : name === "walking" ? config.complexity * 0.6 : 0
    )),
    chordMotion: styleWeighted(chordWeights, (name) => (
      name === "offbeat" ? config.syncopation * 0.65
        : name === "arpeggio" ? config.complexity * 0.65
          : name === "pulse" ? config.energy * 0.4 : 0
    )),
    melodyShape: rng.pick(STYLE_CHOICES.melodyShape),
    counterMotion: rng.pick(STYLE_CHOICES.counterMotion),
    padMotion: rng.pick(STYLE_CHOICES.padMotion),
  };
  style.rhythmIdentity = createRhythmIdentity(config, style.drumGroove, rng.fork("rhythm-identity"));
  return style;
}

function varyStyle(source, config, rng) {
  const result = source && typeof source === "object" ? clone(source) : createStyle(config, rng);
  const profileStyle = createStyle(config, rng.fork("genre-anchor"));
  const amount = (1 - config.similarity) * 0.45 + config.variation * 0.08 + config.surprise * 0.16;
  const genreChoices = (field, choices) => {
    const weights = GENRE_PROFILES[config.genre]?.grooveWeights?.[field];
    if (!weights) return choices;
    const strongest = Math.max(...Object.values(weights));
    const compatible = choices.filter((choice) => finite(weights[choice], 0) >= strongest * 0.18);
    return compatible.length > 1 ? compatible : choices;
  };
  for (const [field, allChoices] of Object.entries(STYLE_CHOICES)) {
    const choices = genreChoices(field, allChoices);
    if (!choices.includes(result[field])) result[field] = profileStyle[field] ?? rng.pick(choices);
    if (rng.bool(amount)) result[field] = profileStyle[field] === result[field]
      ? rng.pick(choices.filter((choice) => choice !== result[field]))
      : profileStyle[field];
  }
  const inheritedIdentity = result.rhythmIdentity && typeof result.rhythmIdentity === "object"
    ? clone(result.rhythmIdentity)
    : null;
  const freshIdentity = createRhythmIdentity(config, result.drumGroove, rng.fork("rhythm-identity"));
  result.rhythmIdentity = !inheritedIdentity || rng.bool(clamp(amount + config.variation * 0.24, 0.2, 0.82))
    ? freshIdentity
    : {
      ...inheritedIdentity,
      signature: freshIdentity.signature,
      id: freshIdentity.id,
      kickRotation: mod(finite(inheritedIdentity.kickRotation, 0) + 1 + freshIdentity.kickRotation, 4),
      accentRotation: freshIdentity.accentRotation,
      mutationBias: round((finite(inheritedIdentity.mutationBias, 0.4) + freshIdentity.mutationBias) / 2, 3),
    };
  return result;
}

function progressionFamily(scale) {
  if (scale === "major" || scale === "lydian" || scale === "majorPentatonic") return "major";
  if (["minor", "harmonicMinor", "melodicMinor", "minorPentatonic"].includes(scale)) return "minor";
  return "modal";
}

function genreProgressionChoices(config, harmonicSection, familyChoices) {
  const grammar = GENRE_PROGRESSION_GRAMMARS[config.genre];
  const chordPathGrammar = CHORD_PATH_PROGRESSION_GRAMMARS[config.chordPath];
  const grammarSection = ["chorus", "drop", "prechorus", "build"].includes(harmonicSection)
    ? "chorus"
    : ["bridge", "breakdown"].includes(harmonicSection)
      ? "bridge"
      : "verse";
  const genreChoices = grammar?.[grammarSection] ?? grammar?.verse ?? [];
  const pathChoices = chordPathGrammar?.[grammarSection] ?? [];
  if (!genreChoices.length && !pathChoices.length) return familyChoices;
  // Weight genre and requested harmonic-path vocabulary ahead of the broader tonal fallback.
  return [...genreChoices, ...genreChoices, ...pathChoices, ...pathChoices, ...familyChoices];
}

function genreCadenceApproach(config, rng) {
  const pathChoices = CHORD_PATH_PROGRESSION_GRAMMARS[config.chordPath]?.cadence;
  const choices = pathChoices?.length ? pathChoices : GENRE_PROGRESSION_GRAMMARS[config.genre]?.cadence;
  return Array.isArray(choices) && choices.length ? rng.pick(choices) : 4;
}

function chordQuality(tones, rootPc) {
  const intervals = tones.slice(1, 3).map((tone) => mod(tone - rootPc, 12));
  if (intervals[0] === 4 && intervals[1] === 7) return "major";
  if (intervals[0] === 3 && intervals[1] === 7) return "minor";
  if (intervals[0] === 3 && intervals[1] === 6) return "diminished";
  if (intervals[0] === 4 && intervals[1] === 8) return "augmented";
  if (intervals[0] === 5 && intervals[1] === 7) return "sus4";
  if (intervals[0] === 2 && intervals[1] === 7) return "sus2";
  return "modal";
}

function romanNumeral(degree, quality, extension) {
  const symbols = ["I", "II", "III", "IV", "V", "VI", "VII"];
  let symbol = symbols[mod(degree, 7)] ?? String(degree + 1);
  if (["minor", "diminished"].includes(quality)) symbol = symbol.toLowerCase();
  if (quality === "diminished") symbol += "°";
  if (extension) symbol += String(extension === true ? "7" : extension);
  return symbol;
}

function pitchName(pc, preferFlats = false) {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod(pc, 12)];
}

function harmonyEvent(config, degree, start, duration, bar, rng, forceExtension = null, metadata = null) {
  const scale = config.scaleIntervals;
  const length = scale.length;
  const degreePc = (offset) => {
    const index = degree + offset;
    return mod(config.keyPc + scale[mod(index, length)], 12);
  };
  const rootPc = degreePc(0);
  const tones = [degreePc(0), degreePc(2), degreePc(4)];
  let extension = forceExtension;
  const extensionDisabled = forceExtension === false;
  if (extension === true) extension = "7";
  if (extension === false) extension = null;
  if (!extensionDisabled && extension == null && length >= 7 && rng.bool(config.chordExtensions)) {
    const richHarmony = ["neoSoul", "hipHop", "rap"].includes(config.genre);
    extension = richHarmony && rng.bool(0.25 + config.complexity * 0.48) ? "9" : "7";
    if (config.genre === "neoSoul" && config.complexity > 0.72 && rng.bool(0.2)) extension = "11";
  }
  if (extension) tones.push(degreePc(6));
  if (extension === "9" || extension === "11") tones.push(degreePc(8));
  if (extension === "11") tones.push(degreePc(10));
  const quality = chordQuality(tones, rootPc);
  const preferFlats = config.key.includes("b");
  const root = pitchName(rootPc, preferFlats);
  const suffix = {
    major: extension ? `maj${extension}` : "",
    minor: extension ? `m${extension}` : "m",
    diminished: extension ? "m7b5" : "dim",
    augmented: "aug",
    sus4: "sus4",
    sus2: "sus2",
    modal: extension ? "7" : "5",
  }[quality];
  return {
    bar,
    start: round(start),
    duration: round(duration),
    degree: mod(Math.round(degree), length),
    roman: romanNumeral(degree, quality, extension),
    root,
    rootPc,
    quality,
    symbol: `${root}${suffix}`,
    tones,
    extension,
    genreGrammar: config.genre,
    ...(metadata && typeof metadata === "object" ? metadata : {}),
  };
}

function plannedHarmonyDegree(plan, localBar, sectionBars, degree, atBarStart, atBarEnd, finalSongEvent, rng) {
  if (!plan) return finalSongEvent ? 0 : degree;
  if (finalSongEvent) return 0;
  if (atBarEnd && localBar === sectionBars - 1) {
    if (plan.cadence === "resolve") return 0;
    if (plan.cadence === "lift") return 4;
    if (plan.cadence === "suspend") return [3, 5].includes(plan.harmonicGoalDegree)
      ? plan.harmonicGoalDegree
      : rng.pick([3, 5]);
    if (Number.isFinite(plan.harmonicGoalDegree)) return plan.harmonicGoalDegree;
  }
  if (atBarStart && localBar === 0 && Number.isFinite(plan.harmonicStartDegree)) {
    return plan.harmonicStartDegree;
  }
  return degree;
}

function harmonicStoryMetadata(plan, section, position = "motion", plannedTension = null) {
  if (!plan) return {};
  return {
    sectionId: section.id,
    harmonicRole: plan.harmonicRole,
    harmonicColor: plan.harmonicColor,
    harmonicPosition: position,
    plannedTension: round(clamp(finite(plannedTension, plan.tension), 0, 1)),
  };
}

function harmonicExtensionForTension(config, plan, tension, atResolution = false) {
  if (atResolution && plan?.cadence === "resolve") return false;
  if (tension < 0.5) return false;
  if (config.chordPath === "trap") return tension >= 0.72 ? "7" : false;
  if (config.chordPath === "house" && tension < 0.7) return false;
  if (tension < 0.68) {
    return plan?.harmonicRole === "tension" || tension >= 0.6 && config.chordExtensions >= 0.55
      ? "7"
      : false;
  }
  const colorful = ["neoSoul", "rnbSoul", "jazz", "hipHop", "rap", "loFiHipHop"].includes(config.genre)
    || ["soul", "jazz"].includes(config.chordPath);
  if (tension >= 0.88 && colorful && config.complexity >= 0.72) return config.genre === "neoSoul" ? "11" : "9";
  if (tension >= 0.76 && colorful) return "9";
  return "7";
}

function createHarmony(config, structure, rng, blueprint = null, songBlueprint = null) {
  const barBeats = beatsPerBar(config);
  const harmony = [];
  if (Array.isArray(blueprint) && blueprint.length) {
    const sourceBars = Math.max(1, ...blueprint.map((event) => Math.round(finite(event.bar, 0)) + 1));
    for (let bar = 0; bar < config.bars; bar += 1) {
      const section = sectionForBar(structure, bar);
      const sectionPlan = blueprintPlanForSection(songBlueprint, section);
      const localBar = Math.max(0, bar - section.startBar);
      const sourceBar = mod(bar, sourceBars);
      let events = blueprint.filter((event) => Math.round(finite(event.bar, 0)) === sourceBar);
      if (!events.length) events = [blueprint[bar % blueprint.length]];
      events = [...events].sort((a, b) => finite(a.start, 0) - finite(b.start, 0));
      const sourceStart = sourceBar * barBeats;
      for (let index = 0; index < events.length; index += 1) {
        const event = events[index];
        const localStart = clamp(finite(event.start, sourceStart) - sourceStart, 0, barBeats - 0.125);
        const nextLocal = index + 1 < events.length
          ? clamp(finite(events[index + 1].start, sourceStart) - sourceStart, localStart + 0.125, barBeats)
          : barBeats;
        let degree = Math.round(finite(event.degree, 0));
        const mutationChance = (1 - config.similarity) * config.variation * 0.5 + config.surprise * 0.12;
        if (bar !== config.bars - 1 && rng.bool(mutationChance)) {
          degree += rng.pick([-2, -1, 1, 2]);
        }
        const finalSongEvent = bar === config.bars - 1 && index === events.length - 1;
        degree = plannedHarmonyDegree(
          sectionPlan,
          localBar,
          section.bars,
          degree,
          index === 0,
          index === events.length - 1,
          finalSongEvent,
          rng,
        );
        const position = localBar === 0 && index === 0 ? "departure"
          : localBar === section.bars - 1 && index === events.length - 1 ? "goal"
            : "motion";
        const eventStart = bar * barBeats + localStart;
        const eventTension = plannedTensionAtBeat(songBlueprint, section, eventStart, barBeats);
        harmony.push(harmonyEvent(
          config,
          degree,
          eventStart,
          nextLocal - localStart,
          bar,
          rng,
          event.extension ?? (
            Array.isArray(event.tones)
              ? event.tones.length > 3
              : harmonicExtensionForTension(config, sectionPlan, eventTension, position === "goal")
          ),
          harmonicStoryMetadata(sectionPlan, section, position, eventTension),
        ));
      }
    }
    return harmony;
  }

  const family = PROGRESSIONS[progressionFamily(config.scale)];
  for (const section of structure) {
    const sectionPlan = blueprintPlanForSection(songBlueprint, section);
    const harmonicSection = section.name === "drop" ? "chorus"
      : section.name === "build" ? "prechorus"
        : section.name === "breakdown" ? "bridge" : section.name;
    const familyChoices = family[harmonicSection] ?? family.idea;
    const choices = genreProgressionChoices(config, harmonicSection, familyChoices);
    const progRng = rng.fork(`progression-${section.id}-${rng.int(1, 9999)}`);
    const progression = progRng.pick(choices);
    for (let localBar = 0; localBar < section.bars; localBar += 1) {
      const bar = section.startBar + localBar;
      let degree = progression[localBar % progression.length];
      if (sectionPlan?.cadence === "resolve" && section.bars > 1 && localBar === section.bars - 2) {
        degree = genreCadenceApproach(config, progRng);
      }
      degree = plannedHarmonyDegree(
        sectionPlan,
        localBar,
        section.bars,
        degree,
        true,
        true,
        bar === config.bars - 1,
        progRng,
      );
      const start = bar * barBeats;
      const openingTension = plannedTensionAtBeat(songBlueprint, section, start, barBeats);
      const closingTension = plannedTensionAtBeat(songBlueprint, section, start + barBeats - 0.05, barBeats);
      const activity = sectionPlan?.harmonicActivity ?? config.harmonicRhythm;
      const splitChance = activity * (0.18 + config.complexity * 0.52);
      const canSplit = barBeats >= 2 && bar !== config.bars - 1 && rng.bool(splitChance);
      if (canSplit) {
        const half = barBeats / 2;
        harmony.push(harmonyEvent(
          config,
          degree,
          start,
          half,
          bar,
          rng,
          harmonicExtensionForTension(config, sectionPlan, openingTension, false),
          harmonicStoryMetadata(sectionPlan, section, localBar === 0 ? "departure" : "motion", openingTension),
        ));
        const nextDegree = progression[(localBar + 1) % progression.length];
        let passingDegree = rng.bool(0.7) ? nextDegree : degree + rng.pick([-1, 1]);
        passingDegree = plannedHarmonyDegree(
          sectionPlan,
          localBar,
          section.bars,
          passingDegree,
          false,
          true,
          bar === config.bars - 1,
          progRng,
        );
        harmony.push(harmonyEvent(
          config,
          passingDegree,
          start + half,
          half,
          bar,
          rng,
          harmonicExtensionForTension(config, sectionPlan, closingTension, localBar === section.bars - 1),
          harmonicStoryMetadata(sectionPlan, section, localBar === section.bars - 1 ? "goal" : "motion", closingTension),
        ));
      } else {
        harmony.push(harmonyEvent(
          config,
          degree,
          start,
          barBeats,
          bar,
          rng,
          harmonicExtensionForTension(config, sectionPlan, openingTension, localBar === section.bars - 1),
          harmonicStoryMetadata(
            sectionPlan,
            section,
            localBar === 0 ? "departure" : localBar === section.bars - 1 ? "goal" : "motion",
            localBar === section.bars - 1 ? closingTension : openingTension,
          ),
        ));
      }
    }
  }
  return harmony;
}

function degreeMotion(shape, progress) {
  if (shape === "rising") return progress < 0.75 ? 1 : -1;
  if (shape === "falling") return progress < 0.75 ? -1 : 1;
  if (shape === "arch") return progress < 0.5 ? 1 : -1;
  return Math.sin(progress * Math.PI * 4) >= 0 ? 1 : -1;
}

function counterMotifFromMelody(melody, style, barBeats) {
  const counterEvents = melody.events
    .filter((_, index) => index % 2 === 0)
    .map((event, index) => ({
      offset: round(mod(event.offset + barBeats / 2, melody.lengthBeats)),
      duration: round(Math.min(event.duration * 1.15, barBeats)),
      degree: style.counterMotion === "contrary" ? -event.degree + 2 : event.degree - 2,
      accent: round(event.accent * 0.78),
      order: index,
    }))
    .sort((a, b) => a.offset - b.offset)
    .map(({ order: _order, ...event }) => event);
  return {
    lengthBeats: melody.lengthBeats,
    phraseShape: "answer",
    genreGrammar: melody.genreGrammar,
    events: counterEvents,
  };
}

function relatedMotif(source, role, config, style, rng) {
  const lengthBeats = source.lengthBeats;
  const events = source.events.map((event) => ({ ...event }));
  const maximumDegree = Math.max(3, Math.ceil(config.melodicRange / 2));
  if (role === "APrime") {
    for (let index = 1; index < events.length; index += 1) {
      if (index % 3 === 2 || index === events.length - 1) {
        events[index].degree = clamp(events[index].degree + (index === events.length - 1 ? -Math.sign(events[index].degree || 1) : rng.pick([-1, 1])), -maximumDegree, maximumDegree);
      }
      if (index % 4 === 1) events[index].duration = round(clamp(events[index].duration * 0.82, 0.2, 4));
    }
  } else if (role === "B") {
    const rotation = events.length > 4 ? Math.max(1, Math.floor(events.length / 3)) : 1;
    const degrees = events.map((event) => event.degree);
    for (let index = 0; index < events.length; index += 1) {
      const sourceDegree = degrees[(index + rotation) % degrees.length];
      events[index].degree = clamp(sourceDegree + (index % 2 === 0 ? 2 : 1), -maximumDegree, maximumDegree);
      events[index].accent = round(clamp(events[index].accent * (index % 3 === 0 ? 1.18 : 1.03), 0.45, 1.2));
      if (index > 0 && index % 3 === 0) events[index].offset = round(clamp(events[index].offset + 0.25, 0, lengthBeats - 0.125));
    }
  } else if (role === "C") {
    for (let index = 0; index < events.length; index += 1) {
      events[index].degree = clamp(-events[index].degree + (index % 3) - 1, -maximumDegree, maximumDegree);
      if (index % 2 === 1) {
        events[index].offset = round(clamp(events[index].offset + 0.25, 0, lengthBeats - 0.125));
        events[index].duration = round(clamp(events[index].duration * 0.72, 0.2, 4));
      }
    }
  }
  events.sort((a, b) => a.offset - b.offset);
  for (let index = events.length - 2; index >= 0; index -= 1) {
    if (events[index + 1].offset - events[index].offset < 0.125) events.splice(index + 1, 1);
  }
  return {
    lengthBeats,
    phraseShape: role === "B" ? "hook" : role === "C" ? "contrast" : "answer",
    genreGrammar: source.genreGrammar,
    events,
  };
}

function hookDistinctivenessMetrics(motif) {
  const events = motif?.events ?? [];
  const uniqueDegrees = new Set(events.map((event) => Math.round(finite(event.degree, 0)))).size;
  const gaps = events.slice(1).map((event, index) => round(event.offset - events[index].offset, 3));
  const uniqueGaps = new Set(gaps).size;
  let contourTurns = 0;
  for (let index = 2; index < events.length; index += 1) {
    const previous = Math.sign(events[index - 1].degree - events[index - 2].degree);
    const current = Math.sign(events[index].degree - events[index - 1].degree);
    if (previous && current && previous !== current) contourTurns += 1;
  }
  const syncopated = events.filter((event) => Math.abs(event.offset - Math.round(event.offset)) > 0.05).length;
  const score = clamp(
    0.2
      + Math.min(0.28, uniqueDegrees * 0.07)
      + Math.min(0.22, uniqueGaps * 0.055)
      + Math.min(0.16, contourTurns * 0.08)
      + Math.min(0.14, syncopated * 0.035),
    0,
    1,
  );
  return { eventCount: events.length, uniqueDegrees, uniqueGaps, contourTurns, syncopated, score: round(score) };
}

function refineWeakHookMotif(source, config, rng) {
  const motif = clone(source);
  const before = hookDistinctivenessMetrics(motif);
  const auditedWeakGenre = ["drumBass", "loFiHipHop", "country"].includes(config.genre);
  const weak = motif.events.length >= 4 && (auditedWeakGenre || before.score <= 0.52) && (
    before.uniqueDegrees < 3
    || before.uniqueGaps < 2
    || before.contourTurns === 0 && before.uniqueDegrees < 4
  );
  if (!weak) return { motif, report: { phase: 70, version: 1, status: "complete", repaired: false, before, after: before } };
  const maximumDegree = Math.max(3, Math.ceil(config.melodicRange / 2));
  if (before.uniqueDegrees < 3) {
    const index = Math.min(motif.events.length - 2, Math.max(1, Math.floor(motif.events.length / 2)));
    motif.events[index].degree = clamp(
      motif.events[index].degree + rng.pick([-2, 2]),
      -maximumDegree,
      maximumDegree,
    );
  }
  if (before.uniqueGaps < 2 && motif.events.length > 3) {
    const index = Math.min(motif.events.length - 2, 2);
    motif.events[index].offset = round(clamp(
      motif.events[index].offset + 0.25,
      motif.events[index - 1].offset + 0.125,
      motif.events[index + 1].offset - 0.125,
    ));
    motif.events[index].duration = round(clamp(motif.events[index].duration * 0.72, 0.2, 4));
  }
  const interim = hookDistinctivenessMetrics(motif);
  if (interim.contourTurns === 0 && motif.events.length > 3) {
    const index = motif.events.length - 2;
    const direction = Math.sign(motif.events[index - 1].degree - motif.events[index - 2].degree) || 1;
    motif.events[index].degree = clamp(
      motif.events[index - 1].degree - direction * 2,
      -maximumDegree,
      maximumDegree,
    );
  }
  motif.events.sort((left, right) => left.offset - right.offset);
  return {
    motif,
    report: {
      phase: 70,
      version: 1,
      status: "complete",
      repaired: true,
      before,
      after: hookDistinctivenessMetrics(motif),
    },
  };
}

function motifIdForSection(section, index, songBlueprint = null) {
  const plan = blueprintPlanForSection(songBlueprint, section);
  if (section.name === "intro") return "A";
  if (["chorus", "drop"].includes(section.name) || ["climax", "hook"].includes(plan?.motifTransform)) return "B";
  if (
    ["prechorus", "build", "bridge", "breakdown"].includes(section.name)
    || ["inversion", "sequence", "fragment"].includes(plan?.motifTransform)
  ) return "C";
  if (section.name === "outro" || plan?.motifTransform === "answer") return "APrime";
  return index % 2 === 0 ? "A" : "APrime";
}

function assignMotifFamily(structure, songBlueprint = null) {
  return structure.map((section, index) => {
    const motifId = motifIdForSection(section, index, songBlueprint);
    return {
      sectionId: section.id,
      sectionName: section.name,
      motifId,
      relationship: motifId === "A" ? "statement"
        : motifId === "APrime" ? "answer"
          : motifId === "B" ? "hook"
            : "contrast",
    };
  });
}

function createMotif(config, style, rng, structure = [], songBlueprint = null) {
  const barBeats = beatsPerBar(config);
  const melodyGrammar = GENRE_MELODY_GRAMMARS[config.genre] ?? GENRE_MELODY_GRAMMARS.pop;
  const rhythmIdentity = style.rhythmIdentity
    ?? createRhythmIdentity(config, style.drumGroove, rng.fork("fallback-rhythm-identity"));
  const motifBars = clamp(Math.round(finite(rhythmIdentity.motifBars, 2)), 1, config.bars >= 8 ? 3 : 2);
  const lengthBeats = Math.min(config.bars * barBeats, barBeats * motifBars);
  const fine = config.complexity > 0.58;
  const phraseShape = rng.pick(melodyGrammar.phraseShapes);
  const contourShape = rng.pick(melodyGrammar.contours);
  const contourProfiles = {
    arch: [0, 0.35, 0.72, 1, 0.48, 0],
    valley: [0, -0.42, -0.78, -0.28, 0.34, 0],
    wave: [0, 0.58, 0.12, 0.76, 0.22, 0],
    climbFall: [0, 0.18, 0.44, 0.72, 1, 0.18],
    fallRebound: [0, -0.38, -0.72, -0.2, 0.46, 0],
    pedalLaunch: [0, 0.08, 0, 0.18, 0.88, 0.24],
  };
  const contourProfile = contourProfiles[contourShape] ?? contourProfiles.arch;
  const contourAt = (progress) => {
    const position = clamp(progress, 0, 1) * (contourProfile.length - 1);
    const left = Math.floor(position);
    const right = Math.min(contourProfile.length - 1, left + 1);
    const blend = position - left;
    return contourProfile[left] + (contourProfile[right] - contourProfile[left]) * blend;
  };
  const rhythmCells = {
    questionAnswer: fine ? [0.5, 0.5, 0.75, 0.25, 1, 0.5, 0.5] : [1, 0.5, 0.5, 1, 1],
    syncopatedLoop: fine ? [0.75, 0.25, 0.5, 0.75, 0.25, 0.5, 1] : [0.75, 0.75, 0.5, 1, 1],
    longShort: fine ? [1.25, 0.25, 0.5, 1, 0.25, 0.75] : [1.5, 0.5, 1, 0.5, 0.5],
    staircase: fine ? [0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5] : [0.5, 0.5, 1, 0.5, 1, 0.5],
    sparseEcho: fine ? [1, 0.5, 1.5, 0.25, 0.75, 1] : [1, 1, 1.5, 0.5],
  };
  const durations = rhythmCells[phraseShape] ?? rhythmCells.questionAnswer;
  const maximumDegree = Math.max(3, Math.ceil(config.melodicRange / 2));
  const events = [];
  let cursor = 0;
  let degree = rng.pick([0, 2, 4]);
  const homeDegree = degree;
  let previousMotion = 0;
  while (cursor < lengthBeats - 0.125 && events.length < 20) {
    const cellIndex = events.length % durations.length;
    const duration = Math.min(durations[cellIndex] * melodyGrammar.durationScale, lengthBeats - cursor);
    const progress = cursor / Math.max(lengthBeats, 0.001);
    const phraseMidpoint = Math.abs(cursor - lengthBeats / 2) < Math.max(0.26, duration * 0.6);
    const intentionalBreath = phraseShape === "questionAnswer" && phraseMidpoint
      || phraseShape === "sparseEcho" && cellIndex % 3 === 1;
    const isRest = events.length > 1 && (
      intentionalBreath
      || rng.bool(0.04 + melodyGrammar.restBias + (1 - config.tracks.melody.density) * 0.18 + (phraseShape === "sparseEcho" ? 0.1 : 0))
    );
    if (!isRest) {
      const offbeat = Math.abs(mod(cursor, 1) - 0.5) < 0.01 || Math.abs(mod(cursor, 1) - 0.75) < 0.01;
      events.push({
        offset: round(cursor),
        duration: round(Math.max(0.2, duration * rng.pick([0.78, 0.9, 1]))),
        degree,
        accent: cursor % barBeats < 0.01 ? 1 : offbeat && phraseShape === "syncopatedLoop" ? 0.9 : rng.bool(0.22) ? 0.86 : 0.72,
      });
    }
    const nextProgress = clamp((cursor + duration) / Math.max(lengthBeats, 0.001), 0, 1);
    const contourTarget = clamp(
      homeDegree + Math.round(contourAt(nextProgress) * Math.max(2, maximumDegree * 0.78)),
      -maximumDegree,
      maximumDegree,
    );
    const shapeDirection = degreeMotion(style.melodyShape, progress);
    const targetDirection = Math.sign(contourTarget - degree);
    const recoveringFromLeap = Math.abs(previousMotion) >= 2;
    const direction = recoveringFromLeap
      ? -Math.sign(previousMotion)
      : targetDirection || shapeDirection || rng.pick([-1, 1]);
    const distance = Math.abs(contourTarget - degree);
    const leap = !recoveringFromLeap && distance > 1 && rng.bool(melodyGrammar.leapChance + config.complexity * 0.2)
      ? Math.min(distance, rng.pick([2, 2, 3]))
      : 1;
    const ornamentalTurn = !recoveringFromLeap && rng.bool(melodyGrammar.ornamentChance + config.surprise * 0.08)
      ? rng.pick([-1, 1])
      : 0;
    const nextDegree = clamp(degree + direction * leap + ornamentalTurn, -maximumDegree, maximumDegree);
    previousMotion = nextDegree - degree;
    degree = nextDegree;
    cursor += duration;
    const finalCell = cursor >= lengthBeats - 0.5;
    if (!finalCell && rng.bool(0.04 + config.syncopation * 0.1)) cursor += fine ? 0.25 : 0.5;
  }
  const cadenceGap = clamp(finite(rhythmIdentity.cadenceGap, 0), 0, Math.max(0, lengthBeats - 1));
  if (cadenceGap > 0 && events.length > 3) {
    const cutoff = lengthBeats - cadenceGap;
    while (events.length > 3 && events[events.length - 1].offset >= cutoff) events.pop();
  }
  if (events.length < 3) {
    events.push(
      { offset: 0, duration: 0.8, degree: 0, accent: 1 },
      { offset: barBeats / 2, duration: 0.8, degree: 2, accent: 0.76 },
      { offset: Math.max(barBeats, lengthBeats - 1), duration: 0.9, degree: 0, accent: 0.9 },
    );
  }

  const melody = {
    lengthBeats: round(lengthBeats),
    phraseShape,
    contourShape,
    genreGrammar: config.genre,
    events,
  };
  const family = {};
  const hookRefinement = refineWeakHookMotif(
    relatedMotif(melody, "B", config, style, rng.fork("motif-b")),
    config,
    rng.fork("motif-b-distinctiveness"),
  );
  const familyMelodies = {
    A: melody,
    APrime: relatedMotif(melody, "APrime", config, style, rng.fork("motif-a-prime")),
    B: hookRefinement.motif,
    C: relatedMotif(melody, "C", config, style, rng.fork("motif-c")),
  };
  for (const [id, familyMelody] of Object.entries(familyMelodies)) {
    family[id] = {
      id: id === "APrime" ? "A′" : id,
      role: id === "A" ? "statement" : id === "APrime" ? "answer" : id === "B" ? "hook" : "contrast",
      melody: familyMelody,
      counterpoint: counterMotifFromMelody(familyMelody, style, barBeats),
    };
  }
  return {
    melody: clone(family.A.melody),
    counterpoint: clone(family.A.counterpoint),
    family,
    hookDistinctiveness: hookRefinement.report,
    sectionAssignments: assignMotifFamily(structure, songBlueprint),
  };
}

function validMotif(motif) {
  return motif && finite(motif.lengthBeats, 0) > 0 && Array.isArray(motif.events) && motif.events.length > 0;
}

function nearestDegreeForChord(degree, chord, config) {
  if (!chord?.tones?.length) return Math.round(finite(degree, 0));
  const source = Math.round(finite(degree, 0));
  const candidates = [];
  for (let candidate = source - 7; candidate <= source + 7; candidate += 1) {
    if (chord.tones.includes(mod(midiForDegree(config, candidate, 4), 12))) candidates.push(candidate);
  }
  candidates.sort((left, right) => Math.abs(left - source) - Math.abs(right - source) || Math.abs(left) - Math.abs(right));
  return candidates[0] ?? source;
}

function repeatHookCell(motif) {
  if (!validMotif(motif)) return motif;
  const half = motif.lengthBeats / 2;
  let source = motif.events.filter((event) => event.offset < half - 0.01);
  if (source.length < 2) source = motif.events.slice(0, Math.min(3, motif.events.length));
  const repeated = [
    ...source.map((event, index) => ({
      ...event,
      accent: round(clamp(event.accent * (index === 0 ? 1.16 : 1.04), 0.45, 1.2)),
    })),
    ...source.map((event, index) => ({
      ...event,
      offset: round(event.offset + half),
      degree: event.degree + (index === source.length - 1 ? -Math.sign(event.degree || 1) : 0),
      accent: round(clamp(event.accent * (index === 0 ? 1.08 : 0.96), 0.4, 1.15)),
    })).filter((event) => event.offset < motif.lengthBeats - 0.01),
  ].sort((left, right) => left.offset - right.offset);
  return { ...motif, phraseShape: "hook", events: repeated.length >= 3 ? repeated : motif.events };
}

/**
 * Preserve a recognizable contour after motif-family and composition-route
 * transforms. Those transforms happen after the initial contour composer, so
 * without this pass they can accidentally stack into an unmusical second leap.
 */
function smoothMotifFlow(motif, role = "statement") {
  if (!validMotif(motif)) return motif;
  const result = clone(motif);
  result.events.sort((left, right) => left.offset - right.offset);
  let previousMotion = 0;
  let repairedLeaps = 0;
  let repairedContinuations = 0;

  for (let index = 1; index < result.events.length; index += 1) {
    const previous = Math.round(finite(result.events[index - 1].degree, 0));
    let current = Math.round(finite(result.events[index].degree, previous));
    let motion = current - previous;
    if (Math.abs(motion) > 3) {
      current = previous + Math.sign(motion) * 3;
      motion = current - previous;
      repairedLeaps += 1;
    }
    if (Math.abs(previousMotion) >= 3 && Math.sign(motion) === Math.sign(previousMotion)) {
      current = previous - Math.sign(previousMotion);
      motion = current - previous;
      repairedContinuations += 1;
    }
    result.events[index].degree = current;
    previousMotion = motion;
  }

  // Give each phrase a clear landing while allowing hooks and contrast motifs
  // to retain a small open-ended color around the tonal center.
  const final = result.events.at(-1);
  const cadenceRadius = role === "hook" || role === "contrast" ? 2 : 1;
  const beforeCadence = Math.round(finite(final.degree, 0));
  final.degree = clamp(beforeCadence, -cadenceRadius, cadenceRadius);
  const cadenceRepaired = final.degree !== beforeCadence;
  // Pull the approach into the landing from right to left. This keeps the
  // cadence itself from creating the very leap the forward pass removed.
  for (let index = result.events.length - 2; index >= 0; index -= 1) {
    const current = result.events[index];
    const next = result.events[index + 1];
    const distance = current.degree - next.degree;
    if (Math.abs(distance) > 3) {
      current.degree = next.degree + Math.sign(distance) * 3;
      repairedLeaps += 1;
    }
  }
  result.flow = {
    version: 1,
    maxDegreeStep: 3,
    repairedLeaps,
    repairedContinuations,
    cadenceRepaired,
  };
  return result;
}

function shapeRenderedMelodicFlow(sourceTracks, structure) {
  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: track.notes.map((note) => ({ ...note })),
  }));
  const melody = tracks.find((track) => track.id === "melody");
  if (!melody?.notes.length) {
    return { tracks, report: { status: "complete", adjustedNotes: 0, maximumLeapBefore: 0, maximumLeapAfter: 0 } };
  }
  melody.notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  let adjustedNotes = 0;
  let maximumLeapBefore = 0;
  let maximumLeapAfter = 0;
  let previous = null;
  let previousMotion = 0;
  let previousSectionId = null;

  for (const note of melody.notes) {
    const section = structure.find((candidate) => (
      note.start >= candidate.startBeat - 1e-6 && note.start < candidate.endBeat - 1e-6
    ));
    const sameSection = section?.id && section.id === previousSectionId;
    const phraseConnected = previous
      && sameSection
      && note.start > previous.start + 1e-6
      && note.start - (previous.start + previous.duration) <= 2.01;
    if (!phraseConnected) {
      previous = note;
      previousMotion = 0;
      previousSectionId = section?.id ?? null;
      continue;
    }

    const originalPitch = note.pitch;
    const originalMotion = originalPitch - previous.pitch;
    maximumLeapBefore = Math.max(maximumLeapBefore, Math.abs(originalMotion));
    const protectedLanding = Boolean(note.ensembleCadenceRole || note.transitionHandoffRole);
    const plannedRegisterShift = Math.round(finite(section?.intent?.registerLift, 0));
    const intentionalRegisterArc = plannedRegisterShift !== 0
      || ["peak", "release"].includes(section?.intent?.role);
    if (Math.abs(originalMotion) <= 7 || protectedLanding || intentionalRegisterArc) {
      maximumLeapAfter = Math.max(maximumLeapAfter, Math.abs(originalMotion));
      previousMotion = originalMotion;
      previous = note;
      previousSectionId = section?.id ?? null;
      continue;
    }
    const candidates = [-24, -12, 0, 12, 24]
      .map((offset) => originalPitch + offset)
      .filter((pitch) => pitch >= 48 && pitch <= 96);
    candidates.sort((left, right) => {
      const score = (pitch) => {
        const motion = pitch - previous.pitch;
        const leapPenalty = Math.max(0, Math.abs(motion) - 7) * 5;
        const repeatedDirectionPenalty = Math.abs(previousMotion) >= 5
          && Math.sign(motion) === Math.sign(previousMotion)
          ? Math.abs(motion) * 1.8
          : 0;
        const originalRegisterPenalty = Math.abs(pitch - originalPitch) * (protectedLanding ? 0.34 : 0.12);
        return Math.abs(motion) + leapPenalty + repeatedDirectionPenalty + originalRegisterPenalty;
      };
      return score(left) - score(right) || Math.abs(left - originalPitch) - Math.abs(right - originalPitch);
    });
    const selected = candidates[0] ?? originalPitch;
    if (selected !== originalPitch) {
      note.pitch = selected;
      note.melodicFlowRepair = "octave-continuity";
      adjustedNotes += 1;
    }
    const motion = note.pitch - previous.pitch;
    maximumLeapAfter = Math.max(maximumLeapAfter, Math.abs(motion));
    previousMotion = motion;
    previous = note;
    previousSectionId = section?.id ?? null;
  }
  return {
    tracks,
    report: {
      status: "complete",
      version: 1,
      adjustedNotes,
      maximumLeapBefore,
      maximumLeapAfter,
      scaleDegreesPreserved: true,
    },
  };
}

function shapeMotifsForCompositionRoute(motifs, route, harmony, config, style) {
  if (!motifs?.family) return motifs;
  const result = clone(motifs);
  if (route.id === "harmony-first") {
    for (const member of Object.values(result.family)) {
      member.melody.events = member.melody.events.map((event) => {
        const strong = Math.abs(event.offset - Math.round(event.offset)) < 0.04;
        if (!strong) return event;
        return {
          ...event,
          degree: nearestDegreeForChord(event.degree, harmonyAt(harmony, event.offset), config),
          accent: round(clamp(event.accent * 1.08, 0.45, 1.2)),
        };
      });
      member.counterpoint = counterMotifFromMelody(member.melody, style, beatsPerBar(config));
    }
  } else if (route.id === "hook-first") {
    result.family.B.melody = repeatHookCell(result.family.B.melody);
    result.family.B.counterpoint = counterMotifFromMelody(result.family.B.melody, style, beatsPerBar(config));
  }
  for (const [memberId, member] of Object.entries(result.family)) {
    // Family B receives its distinctiveness repair after route shaping. Keep
    // its raw contour here so that audit can measure and improve the hook.
    if (memberId === "B") continue;
    member.melody = smoothMotifFlow(member.melody, member.role);
    member.counterpoint = smoothMotifFlow(member.counterpoint, "answer");
  }
  result.melody = clone(result.family.A.melody);
  result.counterpoint = clone(result.family.A.counterpoint);
  return result;
}

function varyMotifs(source, config, style, rng) {
  if (!source || !validMotif(source.melody)) return createMotif(config, style, rng);
  const result = clone(source);
  const targets = result.family
    ? Object.values(result.family).flatMap((member) => [
      ["melody", member.melody],
      ["counterpoint", member.counterpoint],
    ])
    : [["melody", result.melody], ["counterpoint", result.counterpoint]];
  for (const [id, motif] of targets) {
    if (!validMotif(motif)) continue;
    const events = motif.events;
    const probability = (1 - config.similarity) * 0.38 + config.tracks[id].variation * 0.09;
    let changes = 0;
    for (let index = 1; index < events.length; index += 1) {
      if (rng.bool(probability)) {
        events[index].degree = Math.round(finite(events[index].degree, 0)) + rng.pick([-2, -1, 1, 2]);
        if (rng.bool(0.35)) events[index].duration = round(clamp(finite(events[index].duration, 0.5) * rng.pick([0.75, 1.25]), 0.125, 4));
        if (rng.bool(0.32 + config.syncopation * 0.28)) {
          const previous = finite(events[index - 1]?.offset, 0);
          const next = finite(events[index + 1]?.offset, motif.lengthBeats);
          const shifted = round(finite(events[index].offset, 0) + rng.pick([-0.25, 0.25]));
          if (shifted > previous + 0.124 && shifted < next - 0.124) events[index].offset = shifted;
        }
        changes += 1;
      }
    }
    if (changes === 0 && events.length > 2 && config.tracks[id].variation > 0) {
      const index = rng.int(1, events.length - 1);
      events[index].degree = Math.round(finite(events[index].degree, 0)) + rng.pick([-1, 1]);
    }
  }
  if (result.family?.A) {
    result.melody = clone(result.family.A.melody);
    result.counterpoint = clone(result.family.A.counterpoint);
  }
  return result;
}

function harmonyAt(harmony, beat) {
  let result = harmony[0];
  for (const event of harmony) {
    if (event.start <= beat + 1e-6) result = event;
    if (beat < event.start + event.duration - 1e-6 && beat >= event.start - 1e-6) return event;
  }
  return result;
}

function midiForDegree(config, degree, octave) {
  const scale = config.scaleIntervals;
  const octaveShift = Math.floor(degree / scale.length);
  const scaleIndex = mod(degree, scale.length);
  return (octave + 1) * 12 + config.keyPc + scale[scaleIndex] + octaveShift * 12;
}

function scalePitchClasses(config) {
  const normalizedKey = Number.isFinite(Number(config?.keyPc))
    ? mod(Math.round(Number(config.keyPc)), 12)
    : normalizeKey(config?.key).pc;
  const intervals = Array.isArray(config?.scaleIntervals) && config.scaleIntervals.length
    ? config.scaleIntervals
    : SCALES[normalizeScale(config?.scale)];
  return new Set(intervals.map((interval) => mod(normalizedKey + Math.round(finite(interval, 0)), 12)));
}

function pitchFitsScale(pitch, config, allowed = scalePitchClasses(config)) {
  return allowed.has(mod(Math.round(finite(pitch, 60)), 12));
}

function nearestScalePitch(pitch, config, direction = 0, allowed = scalePitchClasses(config)) {
  const source = clamp(Math.round(finite(pitch, 60)), 0, 127);
  if (allowed.has(mod(source, 12))) return source;

  for (let distance = 1; distance <= 12; distance += 1) {
    const down = source - distance;
    const up = source + distance;
    const candidates = direction > 0
      ? [up, down]
      : direction < 0
        ? [down, up]
        : [down, up];
    for (const candidate of candidates) {
      if (candidate >= 0 && candidate <= 127 && allowed.has(mod(candidate, 12))) return candidate;
    }
  }
  return source;
}

function nearestChordTone(pitch, chord, direction = 0) {
  const candidates = [];
  for (let octave = -2; octave <= 2; octave += 1) {
    for (const pc of chord.tones) {
      candidates.push(Math.floor(pitch / 12) * 12 + pc + octave * 12);
    }
  }
  candidates.sort((a, b) => {
    const aPenalty = Math.abs(a - pitch) + (direction && Math.sign(a - pitch) !== direction ? 1.5 : 0);
    const bPenalty = Math.abs(b - pitch) + (direction && Math.sign(b - pitch) !== direction ? 1.5 : 0);
    return aPenalty - bPenalty;
  });
  return candidates[0];
}

function addNote(notes, pitch, start, duration, velocity, totalBeats, metadata = null) {
  const safeStart = clamp(finite(start, 0), 0, Math.max(0, totalBeats - 0.02));
  const safeDuration = clamp(finite(duration, 0.25), 0.02, Math.max(0.02, totalBeats - safeStart));
  notes.push({
    pitch: clamp(Math.round(finite(pitch, 60)), 0, 127),
    start: safeStart,
    duration: safeDuration,
    velocity: clamp(Math.round(finite(velocity, 90)), 1, 127),
    ...(metadata && typeof metadata === "object" ? metadata : {}),
  });
}

function eventVelocity(config, settings, intensity, rng, accent = 1) {
  const base = 46 + config.energy * 43 + intensity * 12;
  return clamp(Math.round((base + (rng.float() - 0.5) * 12) * settings.velocity * accent), 1, 127);
}

function phraseEvolutionForBar(config, structure, bar, trackId, rng, rhythmIdentity = null) {
  const profile = GENRE_PROFILES[config.genre];
  const section = sectionForBar(structure, bar);
  const phraseBars = Math.max(2, Math.round(finite(rhythmIdentity?.phraseCycle, profile.arrangement.phraseBars)));
  const localBar = Math.max(0, bar - section.startBar);
  const phraseIndex = Math.floor(localBar / phraseBars);
  const barInPhrase = localBar % phraseBars;
  const barsInPhrase = Math.min(phraseBars, section.bars - phraseIndex * phraseBars);
  const progress = barsInPhrase <= 1 ? 1 : barInPhrase / (barsInPhrase - 1);
  const phraseRng = rng.fork(`${trackId}-phrase-${section.id}-${phraseIndex}`);
  return {
    section,
    phraseBars,
    phraseIndex,
    barInPhrase,
    barsInPhrase,
    progress,
    phraseEnd: barInPhrase === barsInPhrase - 1,
    grammarBar: barInPhrase,
    phraseRng,
    // The arc moves a few percent across the whole phrase instead of jumping
    // randomly from bar to bar.
    dynamic: 0.95 - config.evolution * 0.035 + progress * (0.035 + config.evolution * 0.095),
  };
}

function buildEvolutionSegments(config, structure, trackId, rng) {
  const phraseBars = Math.max(2, GENRE_PROFILES[config.genre].arrangement.phraseBars);
  const segments = [];
  let previousTarget = trackId === "pad" ? 0.94 : 0.97;
  for (const section of structure) {
    for (let localBar = 0, phraseIndex = 0; localBar < section.bars; localBar += phraseBars, phraseIndex += 1) {
      const bars = Math.min(phraseBars, section.bars - localBar);
      const local = rng.fork(`${trackId}-${section.id}-${phraseIndex}`);
      const movement = 0.35 + config.evolution * 0.9;
      const sectionDirection = ["prechorus", "build", "chorus", "drop"].includes(section.name) ? 0.025 * movement
        : ["breakdown", "outro"].includes(section.name) ? -0.025 * movement : 0;
      const target = clamp(previousTarget + sectionDirection + (local.float() - 0.5) * (0.025 + config.evolution * 0.06), 0.86, 1.12);
      segments.push({
        start: section.startBeat + localBar * beatsPerBar(config),
        end: section.startBeat + (localBar + bars) * beatsPerBar(config),
        from: previousTarget,
        to: target,
      });
      previousTarget = target;
    }
  }
  return segments;
}

/** Apply a gentle phrase envelope without moving any onset. */
function applyGradualEvolution(notes, trackId, config, structure, rng) {
  if (!notes.length) return notes;
  const totalBeats = config.bars * beatsPerBar(config);
  const segments = buildEvolutionSegments(config, structure, trackId, rng);
  return notes.map((note) => {
    const segment = segments.find((candidate) => note.start >= candidate.start - 1e-6 && note.start < candidate.end - 1e-6)
      ?? segments[segments.length - 1];
    const linear = clamp((note.start - segment.start) / Math.max(0.001, segment.end - segment.start), 0, 1);
    const smooth = linear * linear * (3 - 2 * linear);
    const factor = segment.from + (segment.to - segment.from) * smooth;
    const exactSubdivision = typeof note.rhythmicFeature === "string";
    const durationFactor = exactSubdivision || trackId === "drums" ? 1 : 0.985 + factor * 0.02;
    return {
      ...note,
      duration: Math.min(note.duration * durationFactor, Math.max(0.02, totalBeats - note.start)),
      velocity: clamp(Math.round(note.velocity * factor), 1, 127),
    };
  });
}

function genreKickOffsets(config, style, barBeats, bar = 0) {
  if (barBeats < 3.75) return [0, barBeats / 2];
  if (style.drumGroove === "fourFloor" || ["house", "techno"].includes(config.genre)) return [0, 1, 2, 3];
  const patterns = {
    neoSoul: [[0, 0.75, 2.5, 3.25], [0, 1.5, 2.75], [0, 0.5, 2.25, 3.5], [0, 1.25, 2.5, 3.75]],
    hipHop: [[0, 0.75, 2, 2.75, 3.5], [0, 1.5, 2.5, 3.25], [0, 0.5, 2.25, 3], [0, 1.75, 2.75, 3.5]],
    rap: [[0, 1.5, 2.25, 3.25], [0, 0.75, 2.5, 3.5], [0, 1.75, 2.75], [0, 0.5, 2, 3.25]],
    trap: [[0, 0.75, 1.75, 2.5, 3.25, 3.75], [0, 1.5, 2.75, 3.5], [0, 0.5, 1.75, 2.25, 3.5], [0, 1.25, 2.5, 3.25, 3.75]],
    drumBass: [[0, 2, 2.75], [0, 1.75, 2.5, 3.5], [0, 1.5, 2.25, 3.25], [0, 0.75, 2, 3.5]],
    synthwave: [[0, 1, 2, 3], [0, 1.5, 2, 3.5], [0, 0.75, 2, 2.75], [0, 1, 2.5, 3.25]],
    pop: [[0, 2, 2.75], [0, 1.5, 2.5], [0, 0.75, 2, 3.25], [0, 1.25, 2.75, 3.5]],
    loFiHipHop: [[0, 1.5, 2.75], [0, 0.75, 2.5, 3.25], [0, 1.75, 3], [0, 1.25, 2.25, 3.5]],
    rnbSoul: [[0, 1.5, 2.75, 3.5], [0, 0.75, 2.5], [0, 1.25, 2.25, 3.25], [0, 0.5, 2.75, 3.75]],
    drill: [[0, 1.5, 2.75, 3.5], [0, 0.75, 2.5, 3.25], [0, 1.75, 2.25, 3.75], [0, 0.5, 2.75, 3.5]],
    reggaeton: [[0, 1.5, 2.5, 3.25], [0, 0.75, 2, 3.5], [0, 1.25, 2.75, 3.5], [0, 0.5, 2.25, 3.25]],
    afrobeats: [[0, 0.75, 2, 2.75], [0, 1.5, 2.5, 3.5], [0, 0.5, 1.75, 3], [0, 1.25, 2.25, 3.75]],
    jazz: [[0, 1.5, 2.75], [0, 0.75, 2.25, 3.5], [0, 1.25, 2.5], [0, 0.5, 2, 3.25]],
    ambient: [[0, 2.5], [0, 1.5, 3], [0, 2], [0, 1.25, 3.25]],
    funk: [[0, 0.75, 2.25, 3.5], [0, 1.5, 2.5, 3.25], [0, 0.5, 2, 2.75], [0, 1.25, 2.25, 3.75]],
    country: [[0, 2.5], [0, 1.5, 2.75], [0, 2, 3.5], [0, 1.75, 2.5], [0, 0.75, 2.75], [0, 2.25, 3.25]],
    rock: [[0, 2, 2.75], [0, 1.5, 2, 3.5], [0, 0.75, 2.5], [0, 2, 3.25], [0, 1.25, 2.75, 3.5], [0, 1.75, 2.5]],
  };
  const family = patterns[config.genre] ?? patterns.pop;
  const rotation = Math.max(0, Math.round(finite(style.rhythmIdentity?.kickRotation, 0)));
  const developed = [...family[(bar + rotation) % family.length]];
  const patternHash = hashSeed(`${config.seed}:${config.genre}:kick-development:${bar}:${rotation}`);
  const mutation = finite(config.variation, 0.48) + finite(config.surprise, 0.28) * 0.35;
  const candidates = [0.5, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.5, 3.75]
    .filter((offset) => offset < barBeats - 0.01 && !developed.includes(offset));
  if (candidates.length && mutation >= 0.34 && patternHash % 100 < mutation * 72) {
    developed.push(candidates[(patternHash >>> 4) % candidates.length]);
  }
  if (developed.length > 3 && mutation >= 0.58 && (patternHash >>> 9) % 5 === 0) {
    developed.splice(1 + ((patternHash >>> 12) % (developed.length - 1)), 1);
  }
  return uniqueGrooveOffsets(developed, barBeats);
}

function uniqueGrooveOffsets(values, barBeats) {
  return [...new Set(values
    .map((value) => round(value))
    .filter((value) => value >= 0 && value < barBeats - 0.01))]
    .sort((a, b) => a - b);
}

function grooveBar(conductor, bar) {
  return conductor?.bars?.[bar] ?? null;
}

function createGrooveConductor(config, structure, style, motifs, rng, route = null) {
  const barBeats = beatsPerBar(config);
  const rhythmIdentity = style.rhythmIdentity
    ?? createRhythmIdentity(config, style.drumGroove, rng.fork("fallback-rhythm-identity"));
  const genreGrammar = GENRE_RHYTHM_GRAMMARS[config.genre] ?? GENRE_RHYTHM_GRAMMARS.pop;
  const responseDelay = genreGrammar.responseDelay;
  const bars = [];
  for (let bar = 0; bar < config.bars; bar += 1) {
    const section = sectionForBar(structure, bar);
    const assignment = motifs?.sectionAssignments?.find((entry) => entry.sectionId === section.id);
    // Recurring verses, choruses, and drops share a groove family. The section
    // ID remains unique for arrangement bookkeeping, but no longer randomizes
    // the rhythmic foundation of a musical return.
    const sectionFamilyId = `${section.name}:${assignment?.motifId ?? "A"}`;
    const grammarCycle = clamp(Math.round(finite(rhythmIdentity.phraseCycle, 2)), 2, 4);
    const phrasePosition = mod(bar - section.startBar, grammarCycle);
    const role = phrasePosition === 0 ? "statement"
      : phrasePosition === grammarCycle - 1 ? "turnaround"
        : phrasePosition === 1 ? "answer"
          : "development";
    const local = rng.fork(`groove-family-${sectionFamilyId}-${phrasePosition}`);
    const sectionRotation = hashSeed(`${config.seed}:${config.genre}:${sectionFamilyId}:groove`) % 4;
    let anchors = genreKickOffsets(config, style, barBeats, phrasePosition + sectionRotation);
    const fourFloor = style.drumGroove === "fourFloor" || ["house", "techno"].includes(config.genre);
    if (route?.id === "groove-first") {
      const candidates = [0.5, 0.75, 1.5, 2.25, 2.75, 3.5]
        .filter((offset) => offset < barBeats - 0.05 && !anchors.some((anchor) => Math.abs(anchor - offset) < 0.01));
      if (candidates.length) anchors.push(local.pick(candidates));
    }
    if (role === "answer" && anchors.length > 2 && local.bool(0.42 + config.variation * 0.28)) {
      if (fourFloor) {
        const pickups = [1.75, 2.75, 3.75].filter((offset) => offset < barBeats - 0.05);
        if (pickups.length) anchors.push(local.pick(pickups));
      } else {
        const movable = local.int(1, anchors.length - 1);
        anchors[movable] = clamp(anchors[movable] + local.pick([-0.25, 0.25]), 0.25, barBeats - 0.25);
      }
    }
    if (
      role === "answer"
      && genreGrammar.answerKick < barBeats - 0.01
      && !anchors.some((anchor) => Math.abs(anchor - genreGrammar.answerKick) < 0.01)
      && local.bool(0.42 + config.variation * 0.36)
    ) {
      anchors.push(genreGrammar.answerKick);
    }
    if (role === "development") {
      const candidates = [0.5, 0.75, 1.25, 2.25, 2.75, 3.5]
        .filter((offset) => offset < barBeats - 0.05 && !anchors.some((anchor) => Math.abs(anchor - offset) < 0.01));
      if (candidates.length && local.bool(0.48 + config.syncopation * 0.34)) anchors.push(local.pick(candidates));
      if (!fourFloor && anchors.length > 4 && local.bool(0.34)) anchors.splice(local.int(1, anchors.length - 2), 1);
    }
    if (role === "turnaround" && local.bool(0.54 + config.evolution * 0.24)) {
      const pickup = genreGrammar.turnaround < barBeats
        ? genreGrammar.turnaround
        : barBeats - local.pick([0.25, 0.5, 0.75]);
      if (!anchors.some((anchor) => Math.abs(anchor - pickup) < 0.01)) anchors.push(pickup);
    }
    anchors = uniqueGrooveOffsets([0, ...anchors], barBeats);
    const answers = uniqueGrooveOffsets(anchors.map((offset) => offset + responseDelay), barBeats)
      .filter((offset) => !anchors.includes(offset));
    const gridStep = config.complexity > 0.62 ? 0.25 : 0.5;
    const occupied = new Set([...anchors, ...answers].map((offset) => round(offset)));
    const available = [];
    for (let offset = gridStep; offset < barBeats - 0.01; offset += gridStep) {
      if (!occupied.has(round(offset))) available.push(round(offset));
    }
    const spaces = available.length
      ? uniqueGrooveOffsets([
        local.pick(available),
        role === "turnaround" || route?.id === "harmony-first" ? available[available.length - 1] : -1,
      ], barBeats)
      : [];
    const bassResponsePulses = ["answer", "development", "turnaround"].includes(role)
      ? answers.slice(0, role === "turnaround" ? 2 : 1)
      : [];
    const bassGhostPulses = role === "development" && config.syncopation > 0.48
      ? answers.slice(-1)
      : [];
    const bassPulses = uniqueGrooveOffsets(
      config.genre === "house" || config.genre === "neoSoul"
        ? answers
        : config.genre === "techno" && bar % 2 === 1
          ? [...answers, anchors[0]]
          : [
            ...anchors.filter((_, index) => index === 0 || index % 2 === 1),
            ...bassResponsePulses,
            ...bassGhostPulses,
            ...(role === "answer" || role === "turnaround" ? [genreGrammar.bassAnswer] : []),
          ],
      barBeats,
    ).filter((offset) => !spaces.includes(offset));
    const chordPulses = uniqueGrooveOffsets(
      route?.id === "harmony-first"
        ? [...anchors.filter((_, index) => index % 2 === 0), answers[0]]
        : style.chordMotion === "offbeat"
        ? answers
        : style.chordMotion === "sustained"
          ? [0]
          : [...answers.filter((_, index) => index % 2 === 0), anchors[0]],
      barBeats,
    ).filter((offset) => !spaces.includes(offset));
    const familyMember = motifs?.family?.[assignment?.motifId ?? "A"];
    const activeMotif = familyMember?.melody;
    const motifBars = validMotif(activeMotif) ? Math.max(1, Math.ceil(activeMotif.lengthBeats / barBeats)) : 1;
    const motifBar = mod(bar - section.startBar, motifBars);
    const motifPulses = validMotif(activeMotif)
      ? activeMotif.events
        .filter((event) => Math.floor(event.offset / barBeats) === motifBar)
        .map((event) => mod(event.offset, barBeats))
      : [];
    const leadPulses = uniqueGrooveOffsets(
      [
        ...answers,
        ...anchors.filter((_, index) => index % 2 === 0),
        ...motifPulses,
      ],
      barBeats,
    ).filter((offset) => !spaces.includes(offset));
    const counterPulses = uniqueGrooveOffsets(
      [...anchors.filter((_, index) => index % 2 === 1), ...answers.filter((_, index) => index % 2 === 0)],
      barBeats,
    ).filter((offset) => !spaces.includes(offset));
    bars.push({
      bar,
      sectionId: section.id,
      sectionFamilyId,
      motifId: assignment?.motifId ?? "A",
      genrePhrase: genreGrammar.phrase,
      phrasePosition,
      role,
      anchors,
      answers,
      spaces,
      bassPulses,
      chordPulses,
      leadPulses,
      counterPulses,
    });
  }
  return {
    version: 3,
    routeId: route?.id ?? "harmony-first",
    phraseBars: clamp(Math.round(finite(rhythmIdentity.phraseCycle, 2)), 2, 4),
    subdivision: config.complexity > 0.62 ? 0.25 : 0.5,
    bars,
  };
}

function genreSnareOffsets(config, style, barBeats) {
  if (barBeats < 3.75) return [barBeats / 2];
  if (["house", "techno"].includes(config.genre)) return [1, 3];
  if (config.genre === "trap" || style.drumGroove === "halfTime") return [2];
  return [1, 3];
}

const DRUM_FILL_VOCABULARIES = deepFreeze({
  electronic: [
    { id: "electronic-hat-lift", pitches: [42, 46, 42, 49], positions: [0, 0.25, 0.5, 0.75] },
    { id: "electronic-club-stairs", pitches: [45, 47, 50, 49], positions: [0, 0.25, 0.5, 0.875] },
    { id: "electronic-snare-gate", pitches: [38, 38, 39, 49], positions: [0, 0.375, 0.625, 0.875] },
  ],
  bassMusic: [
    { id: "bassmusic-break-turn", pitches: [38, 45, 38, 50], positions: [0, 0.25, 0.625, 0.875] },
    { id: "bassmusic-tom-drop", pitches: [50, 47, 45, 41], positions: [0, 0.25, 0.5, 0.75] },
    { id: "bassmusic-snare-rush", pitches: [38, 38, 38, 49], positions: [0, 0.5, 0.75, 0.875] },
  ],
  acoustic: [
    { id: "acoustic-tom-descent", pitches: [50, 47, 45, 41], positions: [0, 0.25, 0.5, 0.75] },
    { id: "acoustic-snare-tom-answer", pitches: [38, 45, 47, 50], positions: [0, 0.375, 0.625, 0.875] },
    { id: "acoustic-floor-launch", pitches: [41, 45, 38, 49], positions: [0, 0.25, 0.625, 0.875] },
  ],
  pocket: [
    { id: "pocket-ghost-turn", pitches: [37, 38, 45, 38], positions: [0, 0.375, 0.625, 0.875] },
    { id: "pocket-tom-conversation", pitches: [45, 50, 47, 38], positions: [0, 0.25, 0.625, 0.875] },
    { id: "pocket-brush-lift", pitches: [38, 42, 38, 46], positions: [0, 0.375, 0.625, 0.875] },
  ],
});

function drumFillVocabularyForGenre(genre) {
  if (["house", "techno", "synthwave"].includes(genre)) return DRUM_FILL_VOCABULARIES.electronic;
  if (["trap", "drill", "drumBass"].includes(genre)) return DRUM_FILL_VOCABULARIES.bassMusic;
  if (["rock", "country", "pop"].includes(genre)) return DRUM_FILL_VOCABULARIES.acoustic;
  return DRUM_FILL_VOCABULARIES.pocket;
}

function generateDrums(config, structure, _harmony, style, settings, rng, songBlueprint = null, grooveConductor = null) {
  const notes = [];
  if (settings.density <= 0.001) return notes;
  const profile = GENRE_PROFILES[config.genre];
  const rhythmIdentity = style.rhythmIdentity
    ?? createRhythmIdentity(config, style.drumGroove, rng.fork("fallback-rhythm-identity"));
  const barBeats = beatsPerBar(config);
  const totalBeats = config.bars * barBeats;
  const compound = config.timeSignature[1] === 8 && config.timeSignature[0] % 3 === 0;
  const detailedHats = ["trap", "drumBass", "techno"].includes(config.genre)
    || ["skip", "rising"].includes(rhythmIdentity.hatMotion)
    || config.complexity > 0.64;
  const hatStep = compound ? 0.5 : detailedHats ? 0.25 : 0.5;
  const maximumRolls = Math.max(1, Math.floor(Math.max(1, structure.length - 1) / 3));
  let rollFigures = 0;
  let tripletFigures = 0;
  let lastFillId = null;

  const hit = (pitch, start, velocity, duration = 0.08, metadata = null) => {
    if (notes.some((note) => note.pitch === pitch && Math.abs(note.start - start) < 1e-6)) return false;
    addNote(notes, pitch, start, duration, velocity, totalBeats, metadata);
    return true;
  };

  for (let bar = 0; bar < config.bars; bar += 1) {
    const evolution = phraseEvolutionForBar(config, structure, bar, "drums", rng, rhythmIdentity);
    const { section, phraseRng } = evolution;
    const sectionIndex = structure.indexOf(section);
    const nextSection = structure[sectionIndex + 1];
    const grammarRng = rng.fork(`drums-grammar-${section.id}-${evolution.grammarBar}`);
    const barRng = grammarRng.fork("velocity");
    const barTension = plannedTensionAtBeat(
      songBlueprint,
      section,
      bar * barBeats + barBeats * 0.5,
      barBeats,
    );
    const grammarIntensity = clamp(
      section.intensity * (0.58 + config.energy * 0.6) * (0.88 + barTension * 0.2),
      0.35,
      1.25,
    );
    const intensity = clamp(grammarIntensity * evolution.dynamic, 0.35, 1.25);
    const start = bar * barBeats;
    const kickVelocity = eventVelocity(config, settings, intensity, barRng.fork("kick-velocity"), 1.08);
    const snareVelocity = eventVelocity(config, settings, intensity, barRng.fork("snare-velocity"), 1.02);

    const variantRng = grammarRng.fork("kick-grammar");
    const patternBar = evolution.grammarBar + variantRng.int(0, 1);
    const groovePlan = grooveBar(grooveConductor, bar);
    let kicks = groovePlan?.anchors?.length
      ? [...groovePlan.anchors]
      : genreKickOffsets(config, style, barBeats, patternBar);
    const mutationChance = settings.variation
      * (0.14 + config.syncopation * 0.28 + config.evolution * 0.18 + rhythmIdentity.mutationBias * 0.26)
      * (0.82 + barTension * 0.32);
    if (!groovePlan && variantRng.bool(mutationChance)) {
      const candidates = (barBeats >= 3.75 ? [0.5, 0.75, 1.5, 2.5, 2.75, 3.5] : [barBeats / 4, barBeats * 0.75])
        .filter((offset) => offset < barBeats - 0.05 && !kicks.some((kick) => Math.abs(kick - offset) < 1e-6));
      const mayRemove = !["house", "techno"].includes(config.genre) && kicks.length > 2 && variantRng.bool(0.34);
      if (mayRemove) kicks = kicks.filter((_, index) => index !== variantRng.int(1, kicks.length - 1));
      else if (candidates.length) kicks = [...kicks, variantRng.pick(candidates)].sort((a, b) => a - b);
    }
    kicks.forEach((offset, index) => {
      const anchor = index === 0 || ["house", "techno", "synthwave"].includes(config.genre);
      const fourFloorGhost = ["house", "techno"].includes(config.genre)
        && Math.abs(offset - Math.round(offset)) > 0.01;
      const probability = clamp(0.42 + settings.density * 0.42 + (anchor ? 0.35 : settings.variation * 0.18), 0, 1);
      const cellRng = grammarRng.fork(`kick-${round(offset, 3)}`);
      if (groovePlan || anchor || cellRng.bool(probability)) {
        hit(
          36,
          start + offset,
          kickVelocity - (fourFloorGhost ? cellRng.int(15, 23) : index ? cellRng.int(1, 9) : 0),
          0.08,
          groovePlan ? {
            grooveRole: groovePlan.role,
            genrePhrase: groovePlan.genrePhrase,
            ...(fourFloorGhost ? { rhythmicFeature: "ghost-kick" } : {}),
          } : null,
        );
      }
    });

    for (const offset of genreSnareOffsets(config, style, barBeats)) {
      const cellRng = grammarRng.fork(`snare-${round(offset, 3)}`);
      hit(38, start + offset, snareVelocity + cellRng.int(-3, 3));
      const layeredBackbeat = ["house", "techno"].includes(config.genre)
        || (
          ["pop", "rock", "country", "rnbSoul", "funk"].includes(config.genre)
          && ["chorus", "drop"].includes(section.name)
          && barTension >= 0.58
        );
      if (layeredBackbeat && cellRng.bool(["house", "techno"].includes(config.genre) ? 0.72 : 0.62)) {
        hit(39, start + offset, snareVelocity - 7, 0.08, { rhythmicFeature: "layered-backbeat" });
      }
      const embellish = groovePlan?.role === "answer"
        ? offset - (compound ? 0.5 : 0.25)
        : groovePlan?.role === "development"
          ? offset + (compound ? 0.5 : 0.25)
          : null;
      if (
        embellish !== null
        && embellish > 0.05
        && embellish < barBeats - 0.05
        && cellRng.bool(0.18 + settings.variation * 0.34 + config.syncopation * 0.22)
      ) {
        hit(
          cellRng.bool(0.58) ? 37 : 38,
          start + embellish,
          eventVelocity(config, settings, intensity, cellRng, 0.38),
          0.07,
          { rhythmicFeature: "phrase-ghost-note", grooveRole: groovePlan.role },
        );
      }
    }

    const sectionEnd = bar === section.startBar + section.bars - 1;
    const transition = sectionEnd ? transitionFromSection(songBlueprint, section) : null;
    const incomingTransition = bar === section.startBar ? transitionIntoSection(songBlueprint, section) : null;
    const phraseEnd = evolution.phraseEnd;
    const featuredGenre = config.genre === "trap" || config.genre === "drumBass";
    const transitionRng = phraseRng.fork("transition-detail");
    const forceTriplet = config.tripletAmount >= 0.5 && featuredGenre && config.energy >= 0.8 && config.complexity >= 0.7 && tripletFigures === 0 && sectionEnd;
    const tripletProbability = config.tripletAmount * (0.32 + config.energy * 0.42 + config.complexity * 0.38);
    const useTriplet = !compound && phraseEnd && (forceTriplet || transitionRng.bool(tripletProbability));
    const tripletStep = config.complexity > 0.66 && (config.genre === "trap" || transitionRng.bool(0.42)) ? 1 / 6 : 1 / 3;
    const tripletStart = Math.max(0, barBeats - 1);

    // Keep note placement coherent at each position of the selected 2–4 bar
    // phrase. Velocity can still describe a gradual arc across repetitions.
    // The gradual intensity arc belongs in velocity, not in hit probability.
    const hatProbability = clamp(
      settings.density * grammarIntensity * (hatStep === 0.25 ? 0.78 : 1.08) * (0.88 + barTension * 0.18),
      0.12,
      0.98,
    );
    for (let offset = 0, cell = 0; offset < barBeats - 0.01; offset += hatStep, cell += 1) {
      if (useTriplet && offset >= tripletStart - 1e-6) continue;
      if (transition?.type === "drop-out" && offset >= barBeats - transition.pickupBeats - 1e-6) continue;
      if (groovePlan?.spaces?.some((space) => Math.abs(space - offset) < 0.01)) continue;
      const cellRng = grammarRng.fork(`hat-${cell}`);
      if (cellRng.bool(hatProbability)) {
        const isBeat = Math.abs(offset - Math.round(offset)) < 0.01;
        const accentCell = mod(cell + rhythmIdentity.accentRotation + evolution.grammarBar, 4);
        const motionAccent = rhythmIdentity.hatMotion === "offbeat" ? !isBeat
          : rhythmIdentity.hatMotion === "skip" ? accentCell === 1 || accentCell === 3
            : rhythmIdentity.hatMotion === "rising" ? accentCell >= 2
              : accentCell === 0;
        const open = ["house", "techno"].includes(config.genre)
          ? Math.abs(mod(offset, 1) - 0.5) < 0.01 && cellRng.bool(0.58)
          : (motionAccent || offset > barBeats - 0.75) && cellRng.bool(0.1 + settings.variation * 0.2);
        hit(
          open ? 46 : 42,
          start + offset,
          eventVelocity(config, settings, intensity, cellRng, (isBeat ? 0.68 : 0.54) + (motionAccent ? 0.1 : 0)),
          open ? 0.22 : 0.055,
          open ? { rhythmicFeature: "open-hat-accent" } : null,
        );
      }
    }
    if (useTriplet) {
      const count = tripletStep === 1 / 6 ? 6 : 3;
      const feature = tripletStep === 1 / 6 ? "triplet-sixteenth" : "triplet-eighth";
      for (let index = 0; index < count; index += 1) {
        const accent = index === count - 1 ? 0.82 : index % 3 === 0 ? 0.72 : 0.52;
        hit(42, start + tripletStart + index * tripletStep, eventVelocity(config, settings, intensity, transitionRng, accent), Math.min(0.08, tripletStep * 0.65), { rhythmicFeature: feature });
      }
      tripletFigures += 1;
    }

    const tensionPickup = phraseEnd
      && !sectionEnd
      && barTension >= 0.7
      && settings.variation > 0.28
      && transitionRng.bool(config.drumFills * (0.18 + barTension * 0.34));
    if (tensionPickup) {
      const pickupStep = config.complexity > 0.62 ? 0.25 : 0.5;
      const pickupStart = Math.max(0, barBeats - pickupStep * 2);
      for (let index = 0; index < 2; index += 1) {
        hit(
          index === 0 ? 45 : 47,
          start + pickupStart + index * pickupStep,
          eventVelocity(config, settings, intensity, transitionRng, 0.52 + index * 0.12),
          0.075,
          { rhythmicFeature: "tension-pickup", plannedTension: barTension },
        );
      }
    }

    if (
      groovePlan?.role === "turnaround"
      && barTension >= 0.58
      && settings.variation >= 0.32
      && transitionRng.bool(0.28 + config.energy * 0.28)
    ) {
      hit(
        41,
        start + Math.max(0, barBeats - 0.5),
        eventVelocity(config, settings, intensity, transitionRng, 0.62),
        0.11,
        { rhythmicFeature: "low-tom-turnaround", plannedTension: barTension },
      );
    }

    const ghostRng = phraseRng.fork("snare-ghost-lane");
    const ghostRole = ghostRng.int(0, 1);
    if (evolution.grammarBar === ghostRole && ghostRng.bool(
      config.syncopation * settings.variation * (0.34 + rhythmIdentity.ghostBias * 0.48)
    )) {
      const backbeat = genreSnareOffsets(config, style, barBeats)[0] ?? barBeats / 2;
      const ghostAt = start + clamp(backbeat - (compound ? 0.5 : 0.25), 0.25, barBeats - 0.2);
      hit(
        ghostRng.bool(0.5) ? 37 : 38,
        ghostAt,
        eventVelocity(config, settings, intensity, ghostRng, 0.4),
        0.08,
        { rhythmicFeature: "ghost-note" },
      );
    }

    // One quiet auxiliary lane is chosen for the whole phrase. Each phrase
    // position has a recognizable part, then evolves at the next boundary.
    const percussionRng = phraseRng.fork("percussion-lane");
    if (settings.density > 0.34 && percussionRng.bool(0.2 + config.complexity * 0.38 + section.intensity * 0.12)) {
      const percussionPitch = {
        ride: 51,
        tambourine: 54,
        cowbell: 56,
        shaker: 70,
      }[rhythmIdentity.percussionVoice] ?? percussionRng.pick([51, 54, 56]);
      const lanes = {
        steady: [[0.5, 1.5, 2.5, 3.5], [1.5, 3.5]],
        offbeat: [[0.5, 1.5, 2.5, 3.5], [0.75, 2.75]],
        skip: [[0.75, 1.5, 2.75, 3.5], [0.5, 2.75]],
        rising: [[1.5, 2.5, 3, 3.5], [0.75, 2.5, 3.5]],
      };
      const laneChoices = rhythmIdentity.hatMotion === "alternating"
        ? [lanes.offbeat[evolution.grammarBar % lanes.offbeat.length]]
        : lanes[rhythmIdentity.hatMotion] ?? lanes.steady;
      const lane = percussionRng.pick(laneChoices);
      for (const offset of lane.filter((value) => value < barBeats - 0.05)) {
        if (useTriplet && offset >= tripletStart - 1e-6) continue;
        const cellRng = phraseRng.fork(`percussion-${evolution.grammarBar}-${offset}`);
        if (evolution.grammarBar === 0 || cellRng.bool(0.7)) {
          hit(
            percussionPitch,
            start + offset,
            eventVelocity(config, settings, intensity, cellRng, 0.38 + evolution.progress * 0.08),
            0.08,
            { rhythmicFeature: `${rhythmIdentity.percussionVoice}-accent` },
          );
        }
      }
    }

    const boundary = sectionEnd && bar !== config.bars - 1;
    const importantBoundary = section.name === "build" || nextSection?.name === "drop" || nextSection?.name === "chorus";
    const forceRoll = config.rollAmount >= 0.5 && featuredGenre && config.energy >= 0.8 && config.complexity >= 0.7 && rollFigures === 0 && boundary;
    const forceTransitionRoll = boundary
      && ["launch", "build"].includes(transition?.type)
      && transition.strength >= 0.72
      && config.rollAmount > 0.001
      && config.drumFills > 0.001
      && rollFigures < maximumRolls;
    const rollProbability = config.rollAmount * config.drumFills * (0.3 + config.energy * 0.38 + config.complexity * 0.38) * (importantBoundary ? 1.35 : 0.72);
    const useRoll = boundary && rollFigures < maximumRolls && (forceRoll || forceTransitionRoll || transitionRng.bool(rollProbability));
    if (useRoll) {
      const steps = config.genre === "trap" ? [1 / 6, 1 / 8, 1 / 8, 1 / 4]
        : config.genre === "drumBass" ? [1 / 4, 1 / 6, 1 / 8]
          : [1 / 4, 1 / 6];
      const step = transitionRng.pick(steps);
      const length = step <= 1 / 6 && config.complexity > 0.72 ? 1 : 0.5;
      const rollStart = barBeats - length;
      const count = Math.max(2, Math.round(length / step));
      for (let index = 0; index < count; index += 1) {
        const ramp = 0.48 + (index / Math.max(1, count - 1)) * 0.46;
        const accent = index % 2 === 0 ? ramp : ramp * 0.82;
        hit(38, start + rollStart + index * step, eventVelocity(config, settings, intensity, transitionRng, accent), Math.min(0.07, step * 0.55), {
          rhythmicFeature: "snare-roll",
          subdivision: round(step),
          ...(transition ? { transitionFeature: transition.type } : {}),
        });
      }
      rollFigures += 1;
      hit(49, start + barBeats - 0.02, eventVelocity(config, settings, intensity, transitionRng, 0.88), 0.3, {
        transitionFeature: transition?.type ?? "fill",
      });
    } else if (boundary && (
      (["launch", "build", "turnaround"].includes(transition?.type) && transition.strength >= 0.56)
      || transitionRng.bool(config.drumFills * profile.arrangement.fillFrequency * (0.5 + settings.variation * 0.5))
    )) {
      const vocabulary = drumFillVocabularyForGenre(config.genre);
      const freshVocabulary = vocabulary.filter((pattern) => pattern.id !== lastFillId);
      const fill = transitionRng.pick(freshVocabulary.length ? freshVocabulary : vocabulary);
      const fillStart = Math.max(0, barBeats - 1);
      fill.positions.forEach((position, fillIndex) => {
        hit(
          fill.pitches[fillIndex % fill.pitches.length],
          start + fillStart + position,
          eventVelocity(config, settings, intensity, transitionRng, 0.72 + fillIndex * 0.05),
          0.08,
          {
            transitionFeature: transition?.type ?? "fill",
            drumFillId: fill.id,
            drumFillFamily: fill.id.split("-")[0],
          },
        );
      });
      lastFillId = fill.id;
    } else if (bar === section.startBar && (
      ["chorus", "drop"].includes(section.name)
      || ["launch", "resolve"].includes(incomingTransition?.type)
    )) {
      hit(49, start, eventVelocity(config, settings, intensity, transitionRng, 0.92), 0.35, {
        transitionFeature: incomingTransition?.type ?? "section-hit",
      });
    }
  }
  return developDuplicateDrumBars(notes, config, structure, settings, rng.fork("drum-development"), grooveConductor);
}

function drumBarSignature(notes, bar, barBeats) {
  const start = bar * barBeats;
  const end = start + barBeats;
  return notes
    .filter((note) => note.start >= start - 1e-6 && note.start < end - 1e-6)
    .map((note) => `${note.pitch}:${round(note.start - start, 4)}`)
    .sort()
    .join("|");
}

function developDuplicateDrumBars(source, config, structure, settings, rng, grooveConductor = null) {
  if (settings.variation <= 0.08 || source.length < 2) return source;
  const result = source.map((note) => ({ ...note }));
  const barBeats = beatsPerBar(config);
  const totalBeats = config.bars * barBeats;
  let previousSignature = "";
  for (let bar = 0; bar < config.bars; bar += 1) {
    const signature = drumBarSignature(result, bar, barBeats);
    if (!signature || signature !== previousSignature) {
      previousSignature = signature;
      continue;
    }

    const start = bar * barBeats;
    const end = start + barBeats;
    const plan = grooveBar(grooveConductor, bar);
    const section = sectionForBar(structure, bar);
    const local = rng.fork(`duplicate-bar-${bar}`);
    const hats = result.filter((note) => (
      [42, 46].includes(note.pitch)
      && note.start >= start + 0.2
      && note.start < end - 0.05
    ));
    if (hats.length) {
      const chosen = local.pick(hats);
      chosen.pitch = chosen.pitch === 42 ? 46 : 42;
      chosen.duration = chosen.pitch === 46 ? Math.max(0.16, chosen.duration) : Math.min(0.08, chosen.duration);
      chosen.velocity = clamp(chosen.velocity - local.int(5, 12), 1, 127);
      chosen.rhythmicFeature = "developed-hat-color";
      chosen.grooveRole = plan?.role ?? chosen.grooveRole;
    } else {
      const candidates = [0.75, 1.75, 2.75, barBeats - 0.25]
        .filter((offset) => offset > 0 && offset < barBeats - 0.05)
        .filter((offset) => !result.some((note) => (
          note.pitch === 37 && Math.abs(note.start - (start + offset)) < 1e-6
        )));
      if (candidates.length) {
        addNote(
          result,
          37,
          start + local.pick(candidates),
          0.06,
          clamp(Math.round(38 + settings.velocity * 28 + section.intensity * 8), 32, 72),
          totalBeats,
          { rhythmicFeature: "developed-ghost-note", grooveRole: plan?.role ?? "development" },
        );
      }
    }
    previousSignature = drumBarSignature(result, bar, barBeats);
  }
  return result.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
}

function fitDrumsToRetainedBass(drumNotes, bassNotes, config, structure, settings, rng) {
  if (!bassNotes?.length || settings.density <= 0.001) return drumNotes;
  const result = drumNotes.map((note) => ({ ...note }));
  const barBeats = beatsPerBar(config);
  const totalBeats = config.bars * barBeats;
  const desiredForBass = (note) => {
    if (["house", "neoSoul"].includes(config.genre)) return note.start - 0.5;
    if (config.genre === "techno" && Math.abs(mod(note.start, 1) - 0.5) < 0.16) return note.start - 0.5;
    return note.start;
  };
  for (let bar = 0; bar < config.bars; bar += 1) {
    const barStart = bar * barBeats;
    const barEnd = barStart + barBeats;
    const candidates = bassNotes
      .map((note) => ({ note, desired: desiredForBass(note) }))
      .filter(({ desired }) => desired >= barStart - 1e-6 && desired < barEnd - 0.04)
      .sort((a, b) => b.note.velocity - a.note.velocity || a.desired - b.desired);
    const maximumAdditions = clamp(1 + Math.floor(settings.variation * 3), 1, 4);
    let additions = 0;
    for (const { note, desired } of candidates) {
      if (additions >= maximumAdditions) break;
      if (result.some((drum) => drum.pitch === 36 && Math.abs(drum.start - desired) < 0.1)) continue;
      const section = sectionForBar(structure, bar);
      const local = rng.fork(`retained-bass-kick-${bar}-${round(desired, 4)}`);
      const intensity = clamp(section.intensity * (0.58 + config.energy * 0.6), 0.35, 1.25);
      const bassAccent = clamp(note.velocity / 100, 0.68, 1.08);
      addNote(result, 36, desired, 0.08, eventVelocity(config, settings, intensity, local, 0.92 * bassAccent), totalBeats);
      additions += 1;
    }
  }
  return result.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}

function rootMidi(chord, octave) {
  return (octave + 1) * 12 + chord.rootPc;
}

function groovePulsesForWindow(conductor, lane, start, duration, barBeats) {
  const end = start + duration - 0.05;
  const firstBar = Math.max(0, Math.floor(start / barBeats));
  const lastBar = Math.max(firstBar, Math.floor(Math.max(start, end - 0.001) / barBeats));
  const pulses = [];
  for (let bar = firstBar; bar <= lastBar; bar += 1) {
    const plan = grooveBar(conductor, bar);
    for (const offset of plan?.[lane] ?? []) {
      const absolute = bar * barBeats + offset;
      if (absolute >= start - 0.001 && absolute < end) pulses.push(round(absolute - start));
    }
  }
  return uniqueGrooveOffsets(pulses, duration);
}

function bassOffsetsFromDrums(config, chord, style, settings, drumContext, rng, grooveConductor = null) {
  const kickOnsets = Array.isArray(drumContext?.kickOnsets) ? drumContext.kickOnsets : [];
  // A completely drumless arrangement still needs an independent bass line.
  // Once real kicks exist, however, empty harmony windows become intentional
  // low-end space rather than an excuse to fall back to an imaginary pattern.
  if (!kickOnsets.length) return null;
  const eventStart = chord.start;
  const eventEnd = chord.start + chord.duration - 0.05;
  const conducted = groovePulsesForWindow(
    grooveConductor,
    "bassPulses",
    chord.start,
    chord.duration,
    beatsPerBar(config),
  ).filter((offset) => {
    const absolute = chord.start + offset;
    if (config.genre === "house") return kickOnsets.some((kick) => Math.abs(kick + 0.5 - absolute) < 0.01);
    if (config.genre === "neoSoul") return kickOnsets.some((kick) => [0.25, 0.5, 0.75].some((delay) => Math.abs(kick + delay - absolute) < 0.01));
    return kickOnsets.some((kick) => Math.abs(kick - absolute) < 0.01 || Math.abs(kick + 0.5 - absolute) < 0.01);
  });
  if (conducted.length) return conducted;
  const lookBehind = config.genre === "neoSoul" ? 0.76 : 0.01;
  const relevant = kickOnsets.filter((start) => start >= eventStart - lookBehind && start < eventEnd);
  const current = relevant.filter((start) => start >= eventStart - 0.001);
  if (!relevant.length) return [];
  const absolute = [];
  const add = (start) => {
    if (start < eventStart - 0.001 || start >= eventEnd) return;
    if (config.genre === "house" && kickOnsets.some((kick) => Math.abs(kick - start) < 1e-6)) return;
    if (!absolute.some((existing) => Math.abs(existing - start) < 1e-6)) absolute.push(start);
  };

  if (config.genre === "house") {
    for (const kick of relevant) add(kick + 0.5);
  } else if (config.genre === "techno") {
    const locked = chord.bar % 2 === 0;
    for (const kick of current) add(kick + (locked ? 0 : 0.5));
  } else if (["trap", "hipHop", "rap"].includes(config.genre)) {
    const lockChance = config.genre === "trap" ? 0.64 : 0.52;
    current.forEach((kick, index) => {
      if (index === 0 || rng.bool(lockChance + settings.density * 0.18)) add(kick);
    });
    if (config.syncopation > 0.62 && current.length && rng.bool(settings.variation * 0.42)) add(current[current.length - 1] + 0.25);
  } else if (config.genre === "drumBass") {
    current.forEach((kick, index) => {
      if (index === 0 || rng.bool(0.58 + settings.density * 0.25)) add(kick);
    });
    if (chord.bar % 2 === 1 && current.length) add(current[0] + 0.5);
  } else if (config.genre === "neoSoul") {
    const delays = [0.5, 0.75, 0.25];
    relevant.forEach((kick, index) => add(kick + delays[(chord.bar + index) % delays.length]));
  }

  if (!absolute.length && current.length && config.genre !== "house") add(current[0]);
  if (!absolute.length) return [];
  return absolute.sort((a, b) => a - b).map((start) => round(Math.max(0, start - eventStart)));
}

function generateBass(
  config,
  structure,
  harmony,
  style,
  settings,
  rng,
  drumContext = null,
  grooveConductor = null,
  songBlueprint = null,
) {
  const notes = [];
  if (settings.density <= 0.001) return notes;
  const totalBeats = config.bars * beatsPerBar(config);
  const barBeats = beatsPerBar(config);
  const bassOctave = config.genre === "trap" ? Math.max(0, settings.octave - 1) : settings.octave;
  let harmonicLifts = 0;
  for (let eventIndex = 0; eventIndex < harmony.length; eventIndex += 1) {
    const chord = harmony[eventIndex];
    const section = sectionForBar(structure, chord.bar);
    const sectionPlan = blueprintPlanForSection(songBlueprint, section);
    const barPlan = grooveBar(grooveConductor, chord.bar);
    const plannedTension = plannedTensionAtBeat(songBlueprint, section, chord.start, barBeats);
    const intensity = clamp(
      section.intensity * (0.65 + config.energy * 0.5) * (0.91 + plannedTension * 0.16),
      0.35,
      1.25,
    );
    let offsets = bassOffsetsFromDrums(config, chord, style, settings, drumContext, rng, grooveConductor);
    if (Array.isArray(offsets)) {
      // An empty contextual result is deliberate space; non-empty offsets came
      // from kicks that actually survived drum generation.
      if (!offsets.length) continue;
    } else if (["house", "techno"].includes(config.genre)) {
      const barStart = chord.bar * barBeats;
      offsets = [0.5, 1.5, 2.5, 3.5]
        .map((offset) => barStart + offset - chord.start)
        .filter((offset) => offset >= -0.001 && offset < chord.duration - 0.05);
      if (!offsets.length) offsets = [0];
    } else if (["neoSoul", "hipHop", "rap", "trap", "drumBass"].includes(config.genre)) {
      const barStart = chord.bar * barBeats;
      offsets = genreKickOffsets(config, style, barBeats, chord.bar)
        .map((offset) => barStart + offset - chord.start)
        .filter((offset) => offset >= -0.001 && offset < chord.duration - 0.05);
      if (!offsets.length) offsets = [0];
    } else if (style.bassGroove === "pulse") {
      const step = config.energy > 0.68 && settings.density > 0.55 ? 0.5 : 1;
      offsets = [];
      for (let offset = 0; offset < chord.duration - 0.05; offset += step) offsets.push(offset);
    } else if (style.bassGroove === "syncopated") {
      offsets = [0, 0.75, 1.5, 2.5, 3.25].filter((offset) => offset < chord.duration - 0.05);
    } else if (style.bassGroove === "walking") {
      offsets = [];
      for (let offset = 0; offset < chord.duration - 0.05; offset += 1) offsets.push(offset);
    } else {
      offsets = [0, chord.duration / 2].filter((offset, index) => index === 0 || offset >= 0.5);
    }

    const nextChord = harmony[(eventIndex + 1) % harmony.length];
    for (let index = 0; index < offsets.length; index += 1) {
      if (index > 0 && !rng.bool(clamp(settings.density * intensity, 0.08, 0.98))) continue;
      const absoluteStart = chord.start + offsets[index];
      const barOffset = round(mod(absoluteStart, barBeats), 4);
      const matchesPulse = (lane) => (barPlan?.[lane] ?? []).some((pulse) => Math.abs(pulse - barOffset) < 0.011);
      const bassGrooveRole = index === 0 || Math.abs(barOffset) < 0.011
        ? "anchor"
        : matchesPulse("answers")
          ? (barPlan?.role === "development" ? "ghost-response" : "response")
          : index === offsets.length - 1 && ["answer", "turnaround"].includes(barPlan?.role)
            ? "pickup"
            : "movement";
      let pitch = rootMidi(chord, bassOctave);
      if (style.bassGroove === "rootFifth" && index % 2 === 1) pitch += 7;
      if (style.bassGroove === "walking") {
        const choices = [0, 2, 4, 5];
        pitch = midiForDegree(config, chord.degree + choices[index % choices.length], bassOctave);
      } else if (index > 0 && rng.bool(settings.variation * 0.45)) {
        const movement = bassGrooveRole === "pickup"
          ? rng.pick([-1, 1, 2])
          : bassGrooveRole.includes("response")
            ? rng.pick([2, 4, 5])
            : rng.pick([4, 5, 7]);
        pitch = midiForDegree(config, chord.degree + movement, bassOctave);
      }
      const last = index === offsets.length - 1;
      if (last && nextChord && rng.bool(settings.variation * config.complexity * 0.5)) {
        const target = rootMidi(nextChord, bassOctave);
        const approach = rng.pick([-2, -1, 1, 2]);
        pitch = nearestScalePitch(target + approach, config, Math.sign(approach));
      }
      const harmonicLiftEligible = (
        sectionPlan?.role === "peak"
        && index === offsets.length - 1
        && pitch <= 52
      );
      const harmonicLift = harmonicLiftEligible && (
        harmonicLifts === 0
        || (
          ["development", "turnaround"].includes(barPlan?.role)
          && rng.bool(0.28 + settings.variation * 0.42)
        )
      );
      if (harmonicLift) {
        pitch += 12;
        harmonicLifts += 1;
      }
      const nextOffset = offsets[index + 1] ?? chord.duration;
      const durationFactor = ["house", "techno"].includes(config.genre)
        ? 0.58
        : ["trap", "hipHop", "rap", "drumBass"].includes(config.genre)
          ? 0.92
          : 0.84;
      const roleGate = bassGrooveRole === "ghost-response" ? 0.48
        : bassGrooveRole === "pickup" ? 0.62
          : bassGrooveRole === "response" ? 0.78 : 1;
      const duration = Math.max(0.1, (nextOffset - offsets[index]) * durationFactor * roleGate);
      const roleAccent = bassGrooveRole === "anchor" ? 1
        : bassGrooveRole === "response" ? 0.88
          : bassGrooveRole === "pickup" ? 0.78
            : bassGrooveRole === "ghost-response" ? 0.68 : 0.82;
      addNote(
        notes,
        pitch,
        absoluteStart,
        duration,
        eventVelocity(config, settings, intensity, rng, harmonicLift ? 0.9 : roleAccent),
        totalBeats,
        {
          bassRegisterRole: harmonicLift ? "upper-harmonic" : index === 0 ? "sub-anchor" : "movement",
          plannedTension,
          phraseRole: barPlan?.role ?? "statement",
          genrePhrase: barPlan?.genrePhrase ?? null,
          bassGrooveRole,
        },
      );
    }
  }
  return notes;
}

const CHARACTERISTIC_VOICE_BY_GENRE = deepFreeze({
  ambient: "pad",
  jazz: "chords",
  neoSoul: "chords",
  rnbSoul: "chords",
  loFiHipHop: "chords",
  house: "bass",
  techno: "bass",
  drumBass: "bass",
  trap: "bass",
  hipHop: "bass",
  rap: "bass",
  drill: "bass",
  reggaeton: "bass",
  afrobeats: "bass",
  funk: "bass",
  rock: "melody",
  country: "melody",
});

function applyCharacteristicVoice(sourceTracks, structure, config) {
  const preferred = CHARACTERISTIC_VOICE_BY_GENRE[config.genre] ?? "melody";
  const candidates = [preferred, "melody", "bass", "chords", "counterpoint", "pad"];
  const trackId = candidates.find((id) => sourceTracks.find((track) => track.id === id)?.notes?.length) ?? "melody";
  const sectionsCovered = new Set();
  const tracks = sourceTracks.map((track) => {
    if (track.id !== trackId) return track;
    return {
      ...track,
      characteristicVoice: true,
      notes: track.notes.map((note) => {
        const section = structure.find((candidate) => (
          note.start >= candidate.startBeat - 1e-6 && note.start < candidate.endBeat - 1e-6
        ));
        if (section) sectionsCovered.add(section.id);
        const role = note.bassGrooveRole === "anchor" || ["statement", "peak"].includes(note.phraseRole)
          ? "signature-accent"
          : note.bassGrooveRole?.includes("response") || note.phraseRole === "answer"
            ? "signature-answer"
            : "signature-support";
        return {
          ...note,
          characteristicVoiceRole: role,
        };
      }),
    };
  });
  return {
    tracks,
    report: {
      version: 1,
      status: "complete",
      trackId,
      sectionCoverage: round(sectionsCovered.size / Math.max(1, structure.length)),
      mixLift: 1.08,
      character: trackId === "bass" ? "groove-anchor" : trackId === "chords" ? "harmonic-color" : trackId === "pad" ? "atmospheric-glow" : "lead-signature",
    },
  };
}

/**
 * Turn drum fills into ensemble events. The drum phrase remains the call while
 * bass approaches the next harmony inside the same final beat, so section
 * boundaries feel composed instead of assembled from independent lanes.
 */
function applyRhythmSectionTurnaroundConversation(sourceTracks, harmony, config) {
  const tracks = Object.fromEntries(
    Object.entries(sourceTracks).map(([id, notes]) => [id, notes.map((note) => ({ ...note }))]),
  );
  const drums = tracks.drums ?? [];
  const bass = tracks.bass ?? [];
  const barBeats = beatsPerBar(config);
  const totalBeats = config.bars * barBeats;
  const fills = new Map();
  for (const note of drums) {
    if (!note.drumFillId) continue;
    const bar = Math.floor(note.start / barBeats);
    const id = `turnaround:${bar}:${note.drumFillId}`;
    if (!fills.has(id)) fills.set(id, { id, bar, patternId: note.drumFillId, notes: [] });
    fills.get(id).notes.push(note);
  }

  let bassAnswers = 0;
  for (const fill of fills.values()) {
    const boundary = Math.min(totalBeats, (fill.bar + 1) * barBeats);
    const fillStart = Math.min(...fill.notes.map((note) => note.start));
    for (const note of fill.notes) {
      note.rhythmTurnaroundId = fill.id;
      note.rhythmTurnaroundRole = "drum-call";
    }

    const nextChord = harmonyAt(harmony, Math.min(totalBeats - 0.02, boundary + 0.01));
    if (!nextChord) continue;
    const bassOctave = config.genre === "trap"
      ? Math.max(0, config.tracks.bass.octave - 1)
      : config.tracks.bass.octave;
    const destination = rootMidi(nextChord, bassOctave);
    const candidates = bass
      .filter((note) => note.start >= boundary - 1.0 && note.start < boundary - 0.04)
      .sort((left, right) => right.start - left.start);
    let answer = candidates[0];
    if (!answer) {
      const pickupStart = round(Math.max(fillStart, boundary - 0.75), 2);
      answer = {
        pitch: destination,
        start: pickupStart,
        duration: round(boundary - pickupStart - 0.06, 2),
        velocity: 80,
        orchestrationRole: "bass",
      };
      bass.push(answer);
    }
    const pitchClassDistance = mod(destination - answer.pitch, 12);
    const direction = pitchClassDistance === 0
      ? (hashSeed(`${config.seed}|${fill.id}|bass-answer`) % 2 ? 1 : -1)
      : pitchClassDistance <= 6 ? 1 : -1;
    answer.pitch = nearestScalePitch(answer.pitch + direction * 2, config, direction);
    answer.duration = Math.min(answer.duration, Math.max(0.12, boundary - answer.start - 0.06));
    answer.rhythmicFeature = answer.rhythmicFeature ?? "bass-fill-answer";
    answer.rhythmTurnaroundId = fill.id;
    answer.rhythmTurnaroundRole = "bass-answer";
    answer.transitionFeature = fill.notes[0].transitionFeature ?? "turnaround";
    bassAnswers += 1;
  }
  bass.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  return {
    tracks,
    report: {
      phase: 72,
      version: 1,
      status: "complete",
      drumCalls: fills.size,
      bassAnswers,
    },
  };
}

function createSpectrumPlan(config, structure, songBlueprint) {
  return {
    version: 1,
    bands: {
      sub: [24, 43],
      lowMid: [44, 59],
      body: [60, 76],
      presence: [77, 95],
      air: [96, 120],
    },
    sections: structure.map((section) => {
      const plan = blueprintPlanForSection(songBlueprint, section);
      return {
        sectionId: section.id,
        role: plan?.role ?? "development",
        lowEndWeight: round(clamp(0.58 + finite(plan?.energy, 0.5) * 0.36, 0.55, 0.94)),
        highLift: round(clamp(
          (plan?.role === "peak" ? 0.82 : 0.28) + finite(plan?.tension, 0.5) * 0.18,
          0.24,
          1,
        )),
      };
    }),
  };
}

function applySpectrumPlan(sourceTracks, structure, spectrumPlan, config) {
  const sectionPlans = new Map(spectrumPlan.sections.map((plan) => [plan.sectionId, plan]));
  const trackById = new Map(sourceTracks.map((track) => [track.id, track]));
  const liftSectionPlan = [...spectrumPlan.sections]
    .sort((a, b) => b.highLift - a.highLift)[0];
  const liftSection = structure.find((section) => section.id === liftSectionPlan?.sectionId);
  const featuredBassNote = (trackById.get("bass")?.notes ?? [])
    .filter((note) => (
      liftSection
      && note.start >= liftSection.startBeat - 1e-6
      && note.start < liftSection.endBeat - 1e-6
      && note.pitch <= 52
      && note.bassRegisterRole !== "sub-anchor"
    ))
    .at(-1) ?? null;
  const topAtOnset = new Map();
  for (const id of ["chords", "pad"]) {
    for (const note of trackById.get(id)?.notes ?? []) {
      const key = `${id}:${round(note.start, 4)}`;
      topAtOnset.set(key, Math.max(topAtOnset.get(key) ?? 0, note.pitch));
    }
  }

  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: track.notes.map((note) => {
      if (track.id === "drums") return { ...note, spectrumRole: note.pitch === 36 ? "sub-transient" : note.pitch >= 42 ? "high-percussion" : "drum-body" };
      const section = structure.find((candidate) => (
        note.start >= candidate.startBeat - 1e-6 && note.start < candidate.endBeat - 1e-6
      )) ?? structure.at(-1);
      const plan = sectionPlans.get(section?.id);
      let pitch = note.pitch;
      let spectrumRole = track.id;
      if (track.id === "bass") {
        if (note === featuredBassNote) {
          pitch += 12;
          spectrumRole = "upper-harmonic";
        } else {
          if (note.bassRegisterRole === "sub-anchor" && pitch > 47 && pitch - 12 >= 24) pitch -= 12;
          spectrumRole = note.bassRegisterRole ?? (pitch <= 43 ? "sub-anchor" : "bass-movement");
        }
      } else if (
        track.id === "melody"
        && plan?.role === "peak"
        && ["development", "turnaround"].includes(note.phraseRole)
        && pitch <= 96
      ) {
        pitch += 12;
        spectrumRole = "featured-air";
      } else if (
        track.id === "counterpoint"
        && plan?.role === "peak"
        && note.phraseRole === "answer"
        && pitch <= 96
      ) {
        pitch += 12;
        spectrumRole = "answer-presence";
      } else if (["chords", "pad"].includes(track.id)) {
        const top = topAtOnset.get(`${track.id}:${round(note.start, 4)}`);
        if (plan?.highLift >= 0.72 && note.pitch === top && pitch <= 96) {
          pitch += 12;
          spectrumRole = track.id === "pad" ? "air-bed" : "harmonic-presence";
        } else {
          spectrumRole = track.id === "pad" ? "spectral-bed" : "harmonic-body";
        }
      }
      return {
        ...note,
        pitch: clamp(pitch, 0, 127),
        ...(note === featuredBassNote ? { bassRegisterRole: "upper-harmonic" } : {}),
        spectrumRole,
      };
    }),
  }));
  const pitched = tracks.filter((track) => track.id !== "drums").flatMap((track) => track.notes);
  return {
    tracks,
    metrics: {
      lowestPitch: pitched.length ? Math.min(...pitched.map((note) => note.pitch)) : null,
      highestPitch: pitched.length ? Math.max(...pitched.map((note) => note.pitch)) : null,
      span: pitched.length ? Math.max(...pitched.map((note) => note.pitch)) - Math.min(...pitched.map((note) => note.pitch)) : 0,
    },
  };
}

function chordVoicing(chord, octave, previous, spread, rng, config = null) {
  const root = rootMidi(chord, octave);
  const intervals = chord.tones.map((tone) => mod(tone - chord.rootPc, 12));
  const candidates = [];
  for (let inversion = 0; inversion < Math.min(intervals.length, 4); inversion += 1) {
    let pitches = intervals.map((interval, index) => root + interval + (index < inversion ? 12 : 0)).sort((a, b) => a - b);
    for (const shift of [-12, 0, 12]) {
      const shifted = pitches.map((pitch) => pitch + shift);
      if (shifted.every((pitch) => pitch >= 24 && pitch <= 108)) candidates.push(shifted);
    }
  }
  const center = root + 5;
  const score = (pitches) => {
    const register = Math.abs(pitches.reduce((sum, pitch) => sum + pitch, 0) / pitches.length - center);
    if (!previous?.length) return register;
    const topVoiceLeap = Math.abs((pitches[pitches.length - 1] ?? 0) - (previous[previous.length - 1] ?? 0));
    const voiceMotion = pitches.reduce((sum, pitch, index) => sum + Math.abs(pitch - previous[Math.min(index, previous.length - 1)]), 0);
    const leapPenalty = topVoiceLeap > 4 ? topVoiceLeap * 1.5 : 0;
    return voiceMotion + leapPenalty + register * 0.35;
  };
  candidates.sort((a, b) => score(a) - score(b));
  const shortlist = candidates.slice(0, Math.min(3, candidates.length));
  const chosen = [...(rng.pick(shortlist) ?? [root, root + 4, root + 7])];
  if (config?.genre === "neoSoul" && chosen.length >= 4 && mod(chosen[0], 12) === chord.rootPc) chosen.shift();
  if (["house", "techno"].includes(config?.genre) && chosen.length > 3) chosen.splice(1, chosen.length - 3);
  if (spread > 0.55 && chosen.length >= 3) chosen[chosen.length - 1] = clamp(chosen[chosen.length - 1] + 12, 0, 127);
  if (config?.genre === "synthwave" && chosen.length >= 3) chosen[0] = clamp(chosen[0] - 12, 0, 127);
  chosen.sort((a, b) => a - b);
  return chosen;
}

function generateChords(config, structure, harmony, style, settings, rng, grooveConductor = null, songBlueprint = null) {
  const notes = [];
  if (settings.density <= 0.001) return notes;
  const totalBeats = config.bars * beatsPerBar(config);
  let previous = null;
  for (const chord of harmony) {
    const section = sectionForBar(structure, chord.bar);
    const tension = plannedTensionAtBeat(songBlueprint, section, chord.start, beatsPerBar(config));
    const intensity = clamp(section.intensity * (0.66 + config.energy * 0.5) * (0.9 + tension * 0.18), 0.35, 1.25);
    const voicing = chordVoicing(chord, settings.octave, previous, config.registerSpread, rng, config);
    previous = voicing;
    let offsets;
    if (style.chordMotion === "pulse") {
      offsets = [];
      const step = settings.density > 0.62 ? 0.5 : 1;
      for (let offset = 0; offset < chord.duration - 0.05; offset += step) offsets.push(offset);
    } else if (style.chordMotion === "offbeat") {
      offsets = [0.5, 1.5, 2.5, 3.5].filter((offset) => offset < chord.duration - 0.05);
      if (!offsets.length) offsets = [0];
    } else if (style.chordMotion === "arpeggio") {
      const step = config.complexity > 0.58 ? 0.25 : 0.5;
      for (let offset = 0, index = 0; offset < chord.duration - 0.05; offset += step, index += 1) {
        if (index > 0 && !rng.bool(clamp(settings.density * intensity, 0.12, 0.98))) continue;
        const pitch = voicing[index % voicing.length] + (index >= voicing.length && rng.bool(0.35) ? 12 : 0);
        addNote(notes, pitch, chord.start + offset, Math.min(step * 0.9, chord.duration - offset), eventVelocity(config, settings, intensity, rng, index % voicing.length === 0 ? 0.9 : 0.72), totalBeats);
      }
      continue;
    } else {
      offsets = [0];
      if (settings.density > 0.75 && chord.duration >= 2 && rng.bool(settings.variation * 0.35)) offsets.push(chord.duration / 2);
    }
    const conductedOffsets = groovePulsesForWindow(
      grooveConductor,
      "chordPulses",
      chord.start,
      chord.duration,
      beatsPerBar(config),
    );
    if (conductedOffsets.length && style.chordMotion !== "sustained") offsets = conductedOffsets;

    for (let index = 0; index < offsets.length; index += 1) {
      if (index > 0 && !rng.bool(clamp(settings.density * intensity, 0.1, 0.98))) continue;
      const nextOffset = offsets[index + 1] ?? chord.duration;
      const duration = Math.max(0.1, nextOffset - offsets[index] - (style.chordMotion === "sustained" ? 0.02 : 0.08));
      for (const pitch of voicing) {
        addNote(notes, pitch, chord.start + offsets[index], duration, eventVelocity(config, settings, intensity, rng, 0.74), totalBeats);
      }
    }
  }
  return notes;
}

function sectionDegreeShift(section) {
  if (section.name === "chorus") return 2;
  if (section.name === "drop") return 2;
  if (section.name === "build" || section.name === "prechorus") return 1;
  if (section.name === "bridge") return -1;
  if (section.name === "outro") return -2;
  return 0;
}

function phraseDevelopment(config, section, repeat, repeatStart, motif, counterpoint, rng, songBlueprint = null) {
  const sectionPlan = blueprintPlanForSection(songBlueprint, section);
  if (repeat === 0 && (!sectionPlan || sectionPlan.motifTransform === "statement")) return null;
  const repeatEnd = Math.min(repeatStart + motif.lengthBeats, section.endBeat);
  const sectionEnding = repeatEnd >= section.endBeat - 0.01;
  const phraseEnding = sectionEnding || repeat % 2 === 1;
  const local = rng.fork(`development-${counterpoint ? "counter" : "lead"}-${section.id}-${repeat}`);
  const intensity = clamp(section.intensity * (0.52 + config.energy * 0.5), 0.3, 1.25);
  let plannedType = null;
  if (sectionPlan) {
    plannedType = repeat === 0
      ? sectionPlan.motifTransform
      : sectionPlan.developmentPath[(repeat - 1) % sectionPlan.developmentPath.length];
    if (counterpoint && ["climax", "octaveLift"].includes(plannedType)) plannedType = "answer";
  }
  if (!plannedType && !phraseEnding) return null;
  if (!plannedType && !sectionEnding && !local.bool(clamp(0.22 + config.variation * 0.3 + config.evolution * 0.2 + config.surprise * 0.12 + intensity * 0.14, 0, 0.92))) return null;
  const liftSection = ["prechorus", "chorus", "build", "drop"].includes(section.name);
  const type = plannedType ?? local.weighted([
    ["answer", 2.4],
    ["contour", 1.1 + config.complexity * 1.25],
    ["rhythm", 0.9 + config.syncopation * 1.2],
    ["rest", 0.65 + (1 - clamp(intensity, 0, 1)) * 1.25],
    ["octaveLift", counterpoint ? 0.12 : 0.35 + intensity * 0.75 + (liftSection ? 0.8 : 0)],
  ]);
  return {
    type,
    direction: sectionPlan?.direction ?? (local.bool(0.56) ? 1 : -1),
    restIndex: motif.events.length > 2 ? local.int(1, motif.events.length - 2) : -1,
    rhythmShift: local.pick([-0.25, 0.25]),
    intensity,
    repeatEnd,
    sectionEnding,
  };
}

function motifForSection(motifProgram, section, counterpoint, fallback) {
  const assignment = motifProgram?.sectionAssignments?.find((entry) => entry.sectionId === section.id);
  const familyMember = motifProgram?.family?.[assignment?.motifId ?? "A"];
  const selected = counterpoint ? familyMember?.counterpoint : familyMember?.melody;
  return validMotif(selected) ? selected : fallback;
}

function grooveInfluenceForBeat(conductor, beat, lane, barBeats) {
  const bar = Math.max(0, Math.floor(beat / barBeats));
  const offset = round(mod(beat, barBeats));
  const plan = grooveBar(conductor, bar);
  if (!plan) return { pulse: false, space: false, role: null };
  return {
    pulse: (plan[lane] ?? []).some((value) => Math.abs(value - offset) <= 0.13),
    space: (plan.spaces ?? []).some((value) => Math.abs(value - offset) <= 0.13),
    role: plan.role,
  };
}

function magnetizeBeatToGroove(conductor, beat, lane, barBeats, maximumDistance) {
  const bar = Math.max(0, Math.floor(beat / barBeats));
  const plan = grooveBar(conductor, bar);
  const candidates = plan?.[lane] ?? [];
  if (!candidates.length) return { beat, snapped: false };
  const barStart = bar * barBeats;
  const closest = candidates
    .map((offset) => barStart + offset)
    .sort((left, right) => Math.abs(left - beat) - Math.abs(right - beat))[0];
  return Math.abs(closest - beat) <= maximumDistance
    ? { beat: round(closest), snapped: Math.abs(closest - beat) > 0.001 }
    : { beat, snapped: false };
}

function generateLead(
  config,
  structure,
  harmony,
  motif,
  settings,
  rng,
  counterpoint = false,
  songBlueprint = null,
  motifProgram = null,
  grooveConductor = null,
) {
  const notes = [];
  if (settings.density <= 0.001 || !validMotif(motif)) return notes;
  const totalBeats = config.bars * beatsPerBar(config);
  const barBeats = beatsPerBar(config);
  for (const section of structure) {
    const activeMotif = motifForSection(motifProgram, section, counterpoint, motif);
    const sectionPlan = blueprintPlanForSection(songBlueprint, section);
    const intensity = clamp(section.intensity * (0.56 + config.energy * 0.58), 0.25, 1.25);
    const sectionLength = section.endBeat - section.startBeat;
    for (let repeat = 0; repeat * activeMotif.lengthBeats < sectionLength - 0.01; repeat += 1) {
      const repeatStart = section.startBeat + repeat * activeMotif.lengthBeats;
      const development = phraseDevelopment(config, section, repeat, repeatStart, activeMotif, counterpoint, rng, songBlueprint);
      for (let eventIndex = 0; eventIndex < activeMotif.events.length; eventIndex += 1) {
        const event = activeMotif.events[eventIndex];
        const progress = eventIndex / Math.max(1, activeMotif.events.length - 1);
        const phraseSkeleton = !counterpoint && (
          eventIndex === 0
          || eventIndex === activeMotif.events.length - 1
          || eventIndex === Math.floor(activeMotif.events.length / 2)
        );
        if (development?.type === "rest" && eventIndex === development.restIndex && !phraseSkeleton) continue;
        if (
          development?.type === "fragment"
          && progress > 0.62
          && eventIndex !== activeMotif.events.length - 1
          && !phraseSkeleton
        ) continue;
        let startShift = 0;
        if (development?.type === "rhythm" && progress >= 0.45 && eventIndex % 2 === 1) startShift = development.rhythmShift;
        const proposedStart = repeatStart + finite(event.offset, 0) + startShift;
        if (proposedStart >= section.endBeat - 0.04 || proposedStart >= totalBeats) continue;
        const timingMagnet = counterpoint
          ? 0.18 + config.syncopation * 0.08
          : 0.26 + config.syncopation * 0.12;
        const synchronized = magnetizeBeatToGroove(
          grooveConductor,
          proposedStart,
          counterpoint ? "counterPulses" : "leadPulses",
          barBeats,
          timingMagnet,
        );
        const start = Math.max(repeatStart, synchronized.beat);
        const plannedDensity = sectionPlan?.density ?? 0.7;
        const plannedTension = plannedTensionAtBeat(songBlueprint, section, proposedStart, barBeats);
        const tensionDensity = 0.82 + plannedTension * (counterpoint ? 0.18 : 0.3);
        const baseProbability = settings.density
          * intensity
          * (counterpoint ? 0.86 : 1.04)
          * (0.78 + plannedDensity * 0.32)
          * tensionDensity;
        const anchor = phraseSkeleton || (counterpoint && eventIndex === 0 && repeat % 2 === 0);
        const groove = grooveInfluenceForBeat(
          grooveConductor,
          start,
          counterpoint ? "counterPulses" : "leadPulses",
          barBeats,
        );
        if (groove.space && !anchor) continue;
        const grooveProbability = baseProbability * (groove.pulse ? 1.18 : groove.space ? 0.45 : 0.9);
        if (!anchor && !rng.bool(clamp(grooveProbability, 0.04, 0.98))) continue;
        const motifDegree = Math.round(finite(event.degree, 0));
        let degree = motifDegree + sectionDegreeShift(section);
        if (section.name === "bridge" && !counterpoint) degree = -degree + 3;
        if (repeat > 0 && rng.bool(settings.variation * (0.1 + config.variation * 0.18))) degree += rng.pick([-2, -1, 1, 2]);
        if (development?.type === "answer" && progress >= 0.45) degree += development.direction * (eventIndex % 2 === 0 ? 2 : 1);
        if (development?.type === "contour") degree += development.direction * Math.round(progress * (1 + config.complexity * 2));
        if (development?.type === "inversion") degree = -motifDegree + sectionDegreeShift(section) + development.direction;
        if (development?.type === "sequence") degree += development.direction * (1 + Math.round(progress * 2));
        if (development?.type === "climax") degree += 2 + Math.round(progress * 2);
        if (development?.type === "resolution" && progress >= 0.55) degree = progress > 0.82 ? 0 : Math.round(degree * (1 - progress));
        let pitch = midiForDegree(config, degree, settings.octave);
        if ((development?.type === "octaveLift" || development?.type === "climax") && progress >= 0.42) pitch += counterpoint ? -12 : 12;
        if (
          sectionPlan?.registerLift
          && plannedTension >= (sectionPlan.registerLift > 0 ? 0.66 : 0.42)
          && !["climax", "octaveLift"].includes(development?.type)
          && progress >= 0.36
        ) {
          pitch += sectionPlan.registerLift * 12;
        }
        const chord = harmonyAt(harmony, start);
        const position = mod(start, beatsPerBar(config));
        const strong = Math.abs(position - Math.round(position)) < 0.04;
        if (strong && chord) pitch = nearestChordTone(pitch, chord, degree === 0 ? 0 : Math.sign(degree));
        if (counterpoint && chord && chord.tones.includes(mod(pitch, 12))) {
          const escape = rng.bool(0.5) ? 2 : -2;
          pitch = nearestScalePitch(pitch + escape, config, Math.sign(escape));
        }
        const maxDuration = section.endBeat - start;
        const rhythmFactor = development?.type === "rhythm" && progress >= 0.45
          ? (eventIndex % 2 ? 0.62 : 1.2)
          : development?.type === "fragment"
            ? 0.78
            : development?.type === "resolution"
              ? 1.18
              : 1;
        const duration = Math.min(clamp(finite(event.duration, 0.5) * rhythmFactor, 0.1, 4), maxDuration);
        const developmentAccent = development
          ? 0.9 + development.intensity * 0.08 + progress * 0.06 + plannedTension * 0.1
          : 0.94 + plannedTension * 0.1;
        const accent = clamp(finite(event.accent, 0.75) * developmentAccent, 0.4, 1.25);
        addNote(
          notes,
          pitch,
          start,
          duration,
          eventVelocity(config, settings, intensity, rng, accent),
          totalBeats,
          {
            genrePhraseGrammar: activeMotif.genreGrammar ?? config.genre,
            ...(phraseSkeleton ? { phraseAnchor: true } : {}),
            grooveRole: groove.role,
            plannedTension,
            ...(synchronized.snapped ? { rhythmicFeature: "groove-magnet" } : {}),
          },
        );
      }
      if (!counterpoint && ["answer", "resolution", "climax"].includes(development?.type) && development.sectionEnding) {
        const start = Math.max(repeatStart, development.repeatEnd - 0.375);
        const chord = harmonyAt(harmony, start);
        let pitch = midiForDegree(config, (chord?.degree ?? 0) + sectionDegreeShift(section), settings.octave);
        if (chord) pitch = nearestChordTone(pitch, chord);
        if (!notes.some((note) => note.pitch === pitch && Math.abs(note.start - start) < 1e-6)) {
          addNote(notes, pitch, start, Math.min(0.32, section.endBeat - start), eventVelocity(config, settings, intensity, rng, 0.96 + development.intensity * 0.06), totalBeats);
        }
      }
    }
  }
  if (!counterpoint && config.tripletAmount > 0) {
    const maxFigures = Math.max(1, Math.floor(structure.length / 3));
    let figures = 0;
    for (let sectionIndex = 0; sectionIndex < structure.length && figures < maxFigures; sectionIndex += 1) {
      const section = structure[sectionIndex];
      const closingMotif = motifForSection(motifProgram, section, false, motif);
      if (section.endBeat - section.startBeat < 1) continue;
      const force = config.tripletAmount >= 0.5 && config.genre === "trap" && config.energy >= 0.82 && config.complexity >= 0.72 && figures === 0 && sectionIndex === 0;
      if (!force && !rng.bool(config.tripletAmount * (0.16 + config.complexity * 0.3))) continue;
      const step = config.genre === "trap" && config.complexity > 0.72 ? 1 / 6 : 1 / 3;
      const count = step === 1 / 6 ? 6 : 3;
      const phraseStart = section.endBeat - 1;
      const chord = harmonyAt(harmony, phraseStart);
      const baseDegree = Math.round(finite(closingMotif.events[closingMotif.events.length - 1]?.degree, 0)) + sectionDegreeShift(section);
      const motion = [0, 1, 2, 1, 0, -1];
      for (let index = 0; index < count; index += 1) {
        const start = phraseStart + index * step;
        let pitch = midiForDegree(config, baseDegree + motion[index], settings.octave);
        if (index === 0 && chord) pitch = nearestChordTone(pitch, chord);
        if (notes.some((note) => note.pitch === pitch && Math.abs(note.start - start) < 1e-6)) continue;
        addNote(notes, pitch, start, Math.min(step * 0.7, 0.22), eventVelocity(config, settings, section.intensity, rng, index === count - 1 ? 0.9 : 0.68), totalBeats, { rhythmicFeature: step === 1 / 6 ? "triplet-sixteenth" : "triplet-eighth" });
      }
      figures += 1;
    }
  }
  return notes;
}

function interlaceCounterpoint(counterNotes, melodyNotes, config, structure, harmony) {
  if (!counterNotes.length || !melodyNotes.length) return counterNotes;
  const totalBeats = config.bars * beatsPerBar(config);
  const melody = [...melodyNotes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const targets = [];
  const minimumGap = 0.32;
  const addGapTargets = (start, end, section) => {
    if (end - start < minimumGap) return;
    let target = Math.ceil((start + 0.015) * 4) / 4;
    if (target < start + 0.04) target += 0.25;
    let index = 0;
    while (target < end - 0.1 && index < 4) {
      targets.push({ beat: round(target), sectionId: section.id, gapEnd: end });
      target += config.complexity > 0.72 ? 0.5 : 0.75;
      index += 1;
    }
  };

  for (const section of structure) {
    const sectionMelody = melody.filter((note) => note.start < section.endBeat - 0.01 && note.start + note.duration > section.startBeat + 0.01);
    let cursor = section.startBeat;
    for (const note of sectionMelody) {
      addGapTargets(cursor, Math.min(section.endBeat, note.start - 0.06), section);
      cursor = Math.max(cursor, note.start + note.duration + 0.1);
    }
    addGapTargets(cursor, section.endBeat, section);
  }

  const attackCollision = (beat) => melody.some((note) => Math.abs(note.start - beat) < 0.16);
  const melodySoundsAt = (beat) => melody.some((note) => beat > note.start - 0.04 && beat < note.start + note.duration + 0.08);
  const used = new Set();
  const result = [];
  const ordered = [...counterNotes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  for (let index = 0; index < ordered.length; index += 1) {
    const note = ordered[index];
    const section = structure.find((candidate) => note.start >= candidate.startBeat - 1e-6 && note.start < candidate.endBeat - 1e-6)
      ?? structure[structure.length - 1];
    let start = note.start;
    let gapEnd = section.endBeat;
    if (attackCollision(start) || melodySoundsAt(start)) {
      const available = targets
        .filter((target) => target.sectionId === section.id && !used.has(target.beat) && !attackCollision(target.beat) && !melodySoundsAt(target.beat))
        .sort((a, b) => Math.abs(a.beat - note.start) - Math.abs(b.beat - note.start) || a.beat - b.beat);
      const chosen = available.find((target) => Math.abs(target.beat - note.start) <= 2.5) ?? available[0];
      if (!chosen) continue;
      start = chosen.beat;
      gapEnd = chosen.gapEnd;
    } else {
      const containingGap = targets.find((target) => target.sectionId === section.id && Math.abs(target.beat - start) < 0.38);
      if (containingGap) gapEnd = containingGap.gapEnd;
    }
    start = round(clamp(start, section.startBeat, Math.min(section.endBeat - 0.05, totalBeats - 0.02)));
    if (used.has(start)) continue;
    used.add(start);
    const nextMelody = melody.find((candidate) => candidate.start > start + 0.05);
    const availableDuration = Math.min(
      gapEnd - start - 0.05,
      nextMelody ? nextMelody.start - start - 0.06 : Number.POSITIVE_INFINITY,
      section.endBeat - start,
    );
    const duration = clamp(Math.min(note.duration, availableDuration), 0.1, Math.max(0.1, section.endBeat - start));
    let pitch = note.pitch;
    const chord = harmonyAt(harmony, start);
    const position = mod(start, beatsPerBar(config));
    if (chord && Math.abs(position - Math.round(position)) < 0.04) pitch = nearestChordTone(pitch, chord);
    addNote(result, pitch, start, duration, note.velocity, totalBeats, note.rhythmicFeature ? { rhythmicFeature: note.rhythmicFeature } : null);
  }

  // Very dense lead phrases can consume every candidate from the original
  // counterline. Keep one restrained answer when a real gap still exists.
  if (result.length < Math.min(2, counterNotes.length) && targets.length) {
    for (const target of targets) {
      if (result.length >= Math.min(2, counterNotes.length) || used.has(target.beat) || melodySoundsAt(target.beat)) continue;
      const source = counterNotes[result.length % counterNotes.length];
      const chord = harmonyAt(harmony, target.beat);
      let pitch = source.pitch;
      if (chord) pitch = nearestChordTone(pitch, chord);
      addNote(result, pitch, target.beat, Math.min(0.5, target.gapEnd - target.beat), Math.max(1, Math.round(source.velocity * 0.86)), totalBeats);
      used.add(target.beat);
    }
  }
  return result.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}

function generatePad(
  config,
  structure,
  harmony,
  style,
  settings,
  rng,
  songBlueprint = null,
  grooveConductor = null,
) {
  const notes = [];
  if (settings.density <= 0.001) return notes;
  const totalBeats = config.bars * beatsPerBar(config);
  let previous = null;
  for (let index = 0; index < harmony.length; index += 1) {
    const chord = harmony[index];
    const section = sectionForBar(structure, chord.bar);
    const sectionPlan = blueprintPlanForSection(songBlueprint, section);
    const barPlan = grooveBar(grooveConductor, chord.bar);
    const plannedTension = plannedTensionAtBeat(songBlueprint, section, chord.start, beatsPerBar(config));
    const phrasePresence = {
      statement: 1,
      answer: 0.84,
      development: 1.04,
      turnaround: 0.92,
    }[barPlan?.role] ?? 1;
    const intensity = clamp(
      section.intensity
        * (0.5 + config.energy * 0.35)
        * (0.9 + plannedTension * 0.16),
      0.25,
      1.08,
    );
    const anchor = chord.bar === section.startBar;
    const presence = clamp(
      settings.density
        * (0.72 + finite(sectionPlan?.density, 0.6) * 0.34)
        * phrasePresence,
      0.05,
      0.99,
    );
    if (!anchor && !rng.bool(presence)) continue;
    const voicing = chordVoicing(chord, settings.octave, previous, Math.max(0.5, config.registerSpread), rng, config);
    previous = voicing;
    const delay = style.padMotion === "bloom" && chord.start > 0 ? Math.min(0.12, chord.duration * 0.05) : 0;
    for (const pitch of voicing) {
      addNote(
        notes,
        pitch,
        chord.start + delay,
        Math.max(0.1, chord.duration - delay),
        eventVelocity(config, settings, intensity, rng, 0.56),
        totalBeats,
        {
          sectionPatternId: barPlan?.sectionFamilyId ?? `${section.name}:pad`,
          phraseRole: barPlan?.role ?? "statement",
          plannedTension,
        },
      );
    }
  }
  return notes;
}

function applyOrchestrationMatrix(rawTracks, structure, songBlueprint, config, rng) {
  const matrix = new Map((songBlueprint?.orchestrationMatrix ?? []).map((entry) => [entry.sectionId, entry]));
  return Object.fromEntries(Object.entries(rawTracks).map(([id, sourceNotes]) => {
    const result = [];
    for (const section of structure) {
      const notes = sourceNotes.filter((note) => note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6);
      const lane = matrix.get(section.id)?.lanes?.[id];
      if (!lane || !notes.length) {
        result.push(...notes.map((note) => ({ ...note })));
        continue;
      }
      const kept = [];
      for (let index = 0; index < notes.length; index += 1) {
        const note = notes[index];
        if (id === "drums") {
          kept.push({
            ...note,
            velocity: clamp(Math.round(note.velocity * lane.velocity), 1, 127),
            orchestrationRole: lane.role,
          });
          continue;
        }
        const barPosition = mod(note.start, beatsPerBar(config));
        const structuralAnchor = index === 0
          || note.phraseAnchor
          || (id === "drums" && ([36, 38, 39].includes(note.pitch) || Math.abs(barPosition) < 0.04))
          || (id === "bass" && Math.abs(note.start - Math.round(note.start)) < 0.04)
          || (["chords", "pad"].includes(id) && note.start <= section.startBeat + 0.04);
        const local = rng.fork(`phase7-${section.id}-${id}-${round(note.start, 4)}-${note.pitch}-${index}`);
        if (!structuralAnchor && !local.bool(lane.presence)) continue;
        kept.push({
          ...note,
          velocity: clamp(Math.round(note.velocity * lane.velocity), 1, 127),
          orchestrationRole: lane.role,
        });
      }
      if (!kept.length && notes.length) {
        const anchor = [...notes].sort((left, right) => right.velocity - left.velocity || left.start - right.start)[0];
        kept.push({ ...anchor, orchestrationRole: lane.role });
      }
      result.push(...kept);
    }
    return [id, result.sort((left, right) => left.start - right.start || left.pitch - right.pitch)];
  }));
}

function applyMusicalMemory(rawTracks, structure, harmony, songBlueprint, motifLength, totalBeats) {
  const melody = (rawTracks.melody ?? []).map((note) => ({ ...note }));
  for (const memory of songBlueprint?.memoryMap ?? []) {
    const target = structure.find((section) => section.id === memory.sectionId);
    const origin = structure.find((section) => section.id === memory.originSectionId);
    if (!target || !origin || target.id === origin.id) continue;
    const window = Math.min(
      Math.max(1, finite(motifLength, beatsPerBar({ timeSignature: [4, 4] }))),
      origin.endBeat - origin.startBeat,
      target.endBeat - target.startBeat,
    );
    const source = melody
      .filter((note) => note.start >= origin.startBeat - 1e-6 && note.start < origin.startBeat + window - 1e-6)
      .sort((left, right) => left.start - right.start || left.pitch - right.pitch);
    if (!source.length) continue;

    if (memory.relationship === "contrast") {
      for (const note of melody.filter((candidate) => (
        candidate.start >= target.startBeat - 1e-6 && candidate.start < target.startBeat + window - 1e-6
      ))) {
        note.memoryRole = "contrast";
        note.memoryOriginSectionId = origin.id;
      }
      continue;
    }

    const desired = Math.max(2, Math.round(source.length * clamp(memory.recallStrength, 0.35, 1)));
    const recalled = source.slice(0, desired).map((note, index) => {
      const relativeStart = note.start - origin.startBeat;
      const start = clamp(target.startBeat + relativeStart, target.startBeat, Math.min(target.endBeat - 0.02, totalBeats - 0.02));
      let pitch = note.pitch;
      if (memory.contrastAxis === "register" && memory.relationship === "return") pitch += pitch <= 103 ? 12 : -12;
      const chord = harmonyAt(harmony, start);
      if (chord && Math.abs(start - Math.round(start)) < 0.05) pitch = nearestChordTone(pitch, chord);
      const rhythmFactor = memory.contrastAxis === "rhythm" && index % 2 ? 0.76 : 1;
      return {
        ...note,
        pitch: clamp(Math.round(pitch), 0, 127),
        start: round(start),
        duration: round(clamp(note.duration * rhythmFactor, 0.08, Math.max(0.08, target.endBeat - start))),
        velocity: clamp(Math.round(note.velocity * (memory.relationship === "return" ? 1.06 : 0.98)), 1, 127),
        memoryRole: memory.relationship,
        memoryOriginSectionId: origin.id,
      };
    });
    const targetWindowEnd = target.startBeat + window;
    const retained = melody.filter((note) => note.start < target.startBeat - 1e-6 || note.start >= targetWindowEnd - 1e-6);
    melody.length = 0;
    melody.push(...retained, ...recalled);
    melody.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  }
  const result = { ...rawTracks, melody };
  // A return should be remembered by the rhythm section and answering voice,
  // not only by the lead. Reuse the origin's onset sentence while retaining
  // the target section's harmony, register, articulation, and orchestration.
  for (const trackId of ["bass", "counterpoint"]) {
    const notes = (rawTracks[trackId] ?? []).map((note) => ({ ...note }));
    for (const memory of songBlueprint?.memoryMap ?? []) {
      if (!["recall", "return"].includes(memory.relationship)) continue;
      const target = structure.find((section) => section.id === memory.sectionId);
      const origin = structure.find((section) => section.id === memory.originSectionId);
      if (!target || !origin || target.id === origin.id) continue;
      const window = Math.min(
        Math.max(1, finite(motifLength, 4)),
        origin.endBeat - origin.startBeat,
        target.endBeat - target.startBeat,
      );
      const source = notes
        .filter((note) => note.start >= origin.startBeat - 1e-6 && note.start < origin.startBeat + window - 1e-6)
        .sort((left, right) => left.start - right.start || left.pitch - right.pitch);
      const targetNotes = notes
        .filter((note) => note.start >= target.startBeat - 1e-6 && note.start < target.startBeat + window - 1e-6)
        .sort((left, right) => left.start - right.start || left.pitch - right.pitch);
      const recalledCount = Math.min(
        targetNotes.length,
        source.length,
        trackId === "bass" ? 5 : 3,
      );
      for (let index = 0; index < recalledCount; index += 1) {
        const note = targetNotes[index];
        const sourceNote = source[index];
        note.start = round(clamp(
          target.startBeat + sourceNote.start - origin.startBeat,
          target.startBeat,
          Math.min(target.endBeat - 0.02, totalBeats - 0.02),
        ));
        note.duration = round(clamp(
          average([note.duration, sourceNote.duration], note.duration),
          0.06,
          Math.max(0.06, target.endBeat - note.start),
        ));
        note.memoryRole = memory.relationship;
        note.memoryOriginSectionId = origin.id;
        note.memoryTransform = trackId === "bass" ? "rhythmic-callback" : "answer-callback";
      }
    }
    notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
    result[trackId] = notes;
  }
  return result;
}

function applyFeaturedMotifHandoffs(rawTracks, structure, songBlueprint, motifLength, totalBeats, config) {
  const tracks = Object.fromEntries(Object.entries(rawTracks).map(([id, notes]) => [
    id,
    notes.map((note) => ({ ...note })),
  ]));
  const firstEntryByName = new Map();
  let handoffs = 0;
  let notesAdapted = 0;
  for (const entry of songBlueprint?.orchestrationMatrix ?? []) {
    const originEntry = firstEntryByName.get(entry.sectionName);
    if (!originEntry) {
      firstEntryByName.set(entry.sectionName, entry);
      continue;
    }
    if (!entry.featuredTrack || entry.featuredTrack === originEntry.featuredTrack || entry.featuredTrack === "pad") continue;
    const origin = structure.find((section) => section.id === originEntry.sectionId);
    const target = structure.find((section) => section.id === entry.sectionId);
    if (!origin || !target) continue;
    const window = Math.min(
      Math.max(1, finite(motifLength, 4)),
      origin.endBeat - origin.startBeat,
      target.endBeat - target.startBeat,
    );
    const sourceNotes = (tracks[originEntry.featuredTrack] ?? [])
      .filter((note) => note.start >= origin.startBeat - 1e-6 && note.start < origin.startBeat + window - 1e-6)
      .sort((left, right) => left.start - right.start || left.pitch - right.pitch);
    const sourceOffsets = [...new Set(sourceNotes.map((note) => round(note.start - origin.startBeat, 3)))]
      .slice(0, 4);
    if (sourceOffsets.length < 2) continue;
    const targetNotes = (tracks[entry.featuredTrack] ?? [])
      .filter((note) => (
        note.start >= target.startBeat - 1e-6
        && note.start < target.startBeat + window - 1e-6
        && (
          entry.featuredTrack !== "drums"
          || ![36, 38, 39].includes(note.pitch)
        )
      ))
      .sort((left, right) => left.start - right.start || left.pitch - right.pitch);
    const count = Math.min(sourceOffsets.length, targetNotes.length, entry.featuredTrack === "drums" ? 3 : 4);
    if (count < 2) continue;
    for (let index = 0; index < count; index += 1) {
      const note = targetNotes[index];
      let adaptedStart = clamp(
        target.startBeat + sourceOffsets[index],
        target.startBeat + 0.02,
        Math.min(target.endBeat - 0.25, totalBeats - 0.25),
      );
      if (entry.featuredTrack === "bass") {
        const responseDeltas = {
          house: [0.5],
          techno: [0, 0.5],
          trap: [0, 0.25],
          hipHop: [0, 0.25],
          drumBass: [0, 0.5],
          neoSoul: [0, 0.25, 0.5, 0.75],
        }[config.genre];
        const kickResponses = (tracks.drums ?? [])
          .filter((drum) => (
            drum.pitch === 36
            && drum.start >= target.startBeat - 1e-6
            && drum.start < target.endBeat - 1e-6
          ))
          .flatMap((drum) => (responseDeltas ?? [0]).map((delta) => drum.start + delta))
          .filter((start) => start >= target.startBeat && start < target.endBeat - 0.02)
          .sort((left, right) => Math.abs(left - adaptedStart) - Math.abs(right - adaptedStart));
        if (kickResponses[0] != null) adaptedStart = kickResponses[0];
        else adaptedStart = note.start;
      }
      note.start = round(adaptedStart);
      note.motifHandoffRole = `${originEntry.featuredTrack}-to-${entry.featuredTrack}`;
      note.motifHandoffOriginSectionId = origin.id;
      notesAdapted += 1;
    }
    tracks[entry.featuredTrack].sort((left, right) => left.start - right.start || left.pitch - right.pitch);
    handoffs += 1;
  }
  return {
    tracks,
    report: {
      phase: 69,
      version: 1,
      status: "complete",
      handoffs,
      notesAdapted,
    },
  };
}

function applyCoordinatedTransitions(rawTracks, structure, songBlueprint) {
  const result = Object.fromEntries(Object.entries(rawTracks).map(([id, notes]) => [
    id,
    notes.map((note) => ({ ...note })),
  ]));
  for (const transition of songBlueprint?.transitions ?? []) {
    const from = structure.find((section) => section.id === transition.fromSectionId);
    if (!from) continue;
    const to = structure.find((section) => section.id === transition.toSectionId);
    const lastSection = structure[structure.length - 1];
    if (to?.id === lastSection?.id && ["outro", "breakdown"].includes(to.name)) continue;
    const boundary = from.endBeat;
    const pickupStart = Math.max(from.startBeat, boundary - finite(transition.pickupBeats, 0.5));

    if (transition.type === "drop-out") {
      for (const id of Object.keys(result)) {
        result[id] = result[id]
          .filter((note) => note.start < pickupStart - 1e-6 || note.start >= boundary - 1e-6)
          .map((note) => note.start < pickupStart && note.start + note.duration > pickupStart
            ? { ...note, duration: Math.max(0.02, pickupStart - note.start), transitionFeature: "drop-out" }
            : note);
      }
      continue;
    }

    for (const id of ["drums", "bass", "chords", "melody", "counterpoint"]) {
      const candidates = (result[id] ?? [])
        .filter((note) => note.start >= pickupStart - 1e-6 && note.start < boundary - 1e-6)
        .sort((left, right) => right.start - left.start || right.velocity - left.velocity);
      if (candidates[0]) candidates[0].transitionFeature = transition.type;
    }

    if (["launch", "resolve"].includes(transition.type)) {
      for (const id of ["chords", "pad"]) {
        result[id] = (result[id] ?? []).map((note) => (
          note.start < boundary && note.start + note.duration > boundary
            ? { ...note, duration: Math.max(0.02, boundary - note.start), transitionFeature: transition.type }
            : note
        ));
      }
    }
  }
  return result;
}

function finalizeNotes(rawNotes, config, settings, rng, trackId = "", performanceProfile = null) {
  const totalBeats = config.bars * beatsPerBar(config);
  const felt = [];
  const allowedScale = trackId === "drums" ? null : scalePitchClasses(config);
  for (const note of rawNotes) {
    const exactSubdivision = typeof note.rhythmicFeature === "string" || note.preserveTiming === true;
    const eighthPosition = mod(note.start, 1);
    const isOffEighth = Math.abs(eighthPosition - 0.5) < 0.035;
    const swingDelay = !exactSubdivision && isOffEighth ? config.swing * settings.feel * (1 / 6) : 0;
    const jitterRange = finite(performanceProfile?.timingJitter, 0.035 * config.humanize);
    const genre = config?.genre;
    const isLaidbackGenre = ["neoSoul", "loFiHipHop", "rnbSoul"].includes(genre);
    const isGridGenre = ["house", "techno", "synthwave", "trap"].includes(genre);
    const isLaidbackNote = isLaidbackGenre && (
      (trackId === "drums" && [37, 38, 39].includes(note.pitch)) || trackId === "bass"
    );
    const laidbackOffset = !exactSubdivision && isLaidbackNote ? 0.016 * config.humanize : 0;
    const effectiveJitterRange = isGridGenre && trackId !== "drums" ? jitterRange * 0.5 : jitterRange;
    const jitter = exactSubdivision ? 0 : (rng.float() * 2 - 1) * effectiveJitterRange * settings.humanize;
    const pocketOffset = exactSubdivision ? 0 : finite(performanceProfile?.trackOffsets?.[trackId], 0) * settings.feel;
    const start = clamp(note.start + swingDelay + pocketOffset + laidbackOffset + jitter, 0, Math.max(0, totalBeats - 0.02));
    const durationJitter = exactSubdivision ? 1 : 1 + (rng.float() * 2 - 1) * jitterRange * settings.humanize;
    const duration = clamp(note.duration * settings.gate * durationJitter, 0.02, Math.max(0.02, totalBeats - start));
    const velocityRange = finite(performanceProfile?.velocityVariance, 7 * config.humanize);
    const velocity = clamp(Math.round(note.velocity + (rng.float() * 2 - 1) * velocityRange * settings.humanize), 1, 127);
    felt.push({
      pitch: trackId === "drums" ? note.pitch : nearestScalePitch(note.pitch, config, 0, allowedScale),
      start: round(start),
      duration: round(duration),
      velocity,
      ...(note.rhythmicFeature ? { rhythmicFeature: note.rhythmicFeature } : {}),
      ...(Number.isFinite(note.subdivision) ? { subdivision: note.subdivision } : {}),
      ...(note.transitionFeature ? { transitionFeature: note.transitionFeature } : {}),
      ...(note.drumFillId ? { drumFillId: note.drumFillId } : {}),
      ...(note.drumFillFamily ? { drumFillFamily: note.drumFillFamily } : {}),
      ...(note.rhythmTurnaroundId ? { rhythmTurnaroundId: note.rhythmTurnaroundId } : {}),
      ...(note.rhythmTurnaroundRole ? { rhythmTurnaroundRole: note.rhythmTurnaroundRole } : {}),
      ...(note.orchestrationRole ? { orchestrationRole: note.orchestrationRole } : {}),
      ...(note.memoryRole ? { memoryRole: note.memoryRole } : {}),
      ...(note.memoryOriginSectionId ? { memoryOriginSectionId: note.memoryOriginSectionId } : {}),
      ...(note.memoryTransform ? { memoryTransform: note.memoryTransform } : {}),
      ...(Number.isFinite(note.plannedTension) ? { plannedTension: round(note.plannedTension) } : {}),
      ...(note.resolutionRole ? { resolutionRole: note.resolutionRole } : {}),
      ...(Number.isFinite(note.phraseBoundary) ? { phraseBoundary: round(note.phraseBoundary) } : {}),
      ...(note.articulationIntent ? { articulationIntent: note.articulationIntent } : {}),
      ...(note.connectionId ? { connectionId: note.connectionId } : {}),
      ...(note.connectionRole ? { connectionRole: note.connectionRole } : {}),
      ...(note.ensembleAccent ? { ensembleAccent: true } : {}),
      ...(note.genrePhraseGrammar ? { genrePhraseGrammar: note.genrePhraseGrammar } : {}),
      ...(note.genrePhrase ? { genrePhrase: note.genrePhrase } : {}),
      ...(note.bassGrooveRole ? { bassGrooveRole: note.bassGrooveRole } : {}),
      ...(note.phraseAnchor ? { phraseAnchor: true } : {}),
      ...(note.motifHandoffRole ? { motifHandoffRole: note.motifHandoffRole } : {}),
      ...(note.motifHandoffOriginSectionId ? { motifHandoffOriginSectionId: note.motifHandoffOriginSectionId } : {}),
    });
  }

  felt.sort((a, b) => a.start - b.start || a.pitch - b.pitch || a.duration - b.duration);
  const deduped = [];
  for (const note of felt) {
    const previous = deduped[deduped.length - 1];
    if (previous && previous.pitch === note.pitch && Math.abs(previous.start - note.start) < 0.0005) {
      previous.duration = Math.max(previous.duration, note.duration);
      previous.velocity = Math.max(previous.velocity, note.velocity);
    } else {
      deduped.push(note);
    }
  }
  return deduped;
}

function enforceScaleSafety(sourceTracks, config) {
  let corrections = 0;
  const correctionsByTrack = {};
  const allowedScale = scalePitchClasses(config);
  const tracks = sourceTracks.map((track) => {
    if (track.id === "drums") return track;
    let trackCorrections = 0;
    const notes = (track.notes ?? []).map((note) => {
      const pitch = nearestScalePitch(note.pitch, config, 0, allowedScale);
      if (pitch !== note.pitch) {
        corrections += 1;
        trackCorrections += 1;
      }
      return pitch === note.pitch ? note : { ...note, pitch };
    });
    correctionsByTrack[track.id] = trackCorrections;
    return { ...track, notes };
  });
  const pitchedNotes = tracks
    .filter((track) => track.id !== "drums")
    .flatMap((track) => track.notes ?? []);
  const scaleFit = pitchedNotes.length
    ? pitchedNotes.filter((note) => pitchFitsScale(note.pitch, config, allowedScale)).length / pitchedNotes.length
    : 1;
  return {
    tracks,
    corrections,
    correctionsByTrack,
    scaleFit: round(scaleFit),
    passed: scaleFit >= 1 - 1e-9,
  };
}

function appendExpressionRamp(events, startBeat, endBeat, startValue, endValue, barBeats) {
  if (endBeat <= startBeat + 0.01) return;
  const steps = clamp(Math.ceil((endBeat - startBeat) / Math.max(0.5, barBeats / 2)), 2, 8);
  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    events.push({
      type: "cc",
      controller: 11,
      beat: round(startBeat + (endBeat - startBeat) * progress),
      value: clamp(Math.round(startValue + (endValue - startValue) * progress), 0, 127),
    });
  }
}

function createExpressionAutomation(id, config, structure, settings, rng, songBlueprint = null) {
  const barBeats = beatsPerBar(config);
  const totalBeats = config.bars * barBeats;
  const base = clamp(Math.round(108 + settings.volume * 18), 96, 126);
  const events = [{ type: "cc", controller: 11, beat: 0, value: base }];
  const expressive = ["chords", "melody", "counterpoint", "pad"].includes(id);
  if (!expressive || totalBeats < barBeats * 2) return events;

  const emotional = structure.filter((section) => ["bridge", "breakdown"].includes(section.name) && section.endBeat < totalBeats - 0.01);
  const dipSection = emotional.find((section) => (
    id === "pad"
    || rng.fork(`dip-${section.id}`).bool(0.42 + settings.reverb * 0.34)
  ));
  if (dipSection) {
    const length = dipSection.endBeat - dipSection.startBeat;
    const low = clamp(Math.round(base * (id === "pad" ? 0.58 : 0.68)), 46, base - 12);
    const lowBeat = Math.min(dipSection.endBeat - barBeats * 0.45, dipSection.startBeat + Math.max(barBeats, length * 0.42));
    const restoreBeat = Math.min(dipSection.endBeat, Math.max(lowBeat + barBeats, dipSection.endBeat - 0.05));
    appendExpressionRamp(events, dipSection.startBeat, lowBeat, base, low, barBeats);
    appendExpressionRamp(events, lowBeat, restoreBeat, low, base, barBeats);
  }

  for (const transition of songBlueprint?.transitions ?? []) {
    const from = structure.find((section) => section.id === transition.fromSectionId);
    if (!from) continue;
    const boundary = from.endBeat;
    const pickup = clamp(finite(transition.pickupBeats, 0.5), 0.25, barBeats);
    const to = structure.find((section) => section.id === transition.toSectionId);
    const lastSection = structure[structure.length - 1];
    if (["bridge", "breakdown"].includes(to?.name)) continue;
    if (to?.id === lastSection?.id && to?.name === "outro") continue;
    if (["launch", "build"].includes(transition.type)) {
      const low = clamp(Math.round(base - 10 - transition.strength * 12), 58, base - 6);
      appendExpressionRamp(events, Math.max(from.startBeat, boundary - pickup), boundary, low, base, barBeats);
    } else if (transition.type === "drop-out") {
      const low = clamp(Math.round(base * (0.5 + (1 - transition.strength) * 0.16)), 42, base - 18);
      appendExpressionRamp(events, Math.max(from.startBeat, boundary - pickup), Math.max(from.startBeat, boundary - 0.03), base, low, barBeats);
      appendExpressionRamp(events, boundary, Math.min(totalBeats, boundary + Math.min(barBeats / 2, pickup)), low, base, barBeats);
    }
  }

  const finalSection = structure[structure.length - 1];
  const finalFadeRng = rng.fork(`final-${finalSection?.id ?? "song"}`);
  const finalEmotional = finalSection && ["outro", "breakdown"].includes(finalSection.name);
  const fadeChance = id === "pad" ? 1 : id === "counterpoint" ? 0.78 : id === "melody" ? 0.7 : 0.56;
  if (finalEmotional && finalFadeRng.bool(fadeChance)) {
    const sectionLength = finalSection.endBeat - finalSection.startBeat;
    const fadeLength = Math.min(sectionLength, barBeats * (id === "pad" ? 2.5 : 1.75));
    const fadeStart = Math.max(finalSection.startBeat, finalSection.endBeat - fadeLength);
    const floor = clamp(Math.round(base * (id === "pad" ? 0.42 : 0.52)), 42, 76);
    appendExpressionRamp(events, fadeStart, Math.min(totalBeats, finalSection.endBeat), base, floor, barBeats);
  }

  const byBeat = new Map();
  for (const event of events) byBeat.set(`${event.controller}:${round(event.beat)}`, event);
  return [...byBeat.values()].sort((a, b) => a.beat - b.beat || a.controller - b.controller);
}

function articulatePerformance(notes, id, config, rng) {
  if (id === "drums") {
    return notes.map((note) => ({
      ...note,
      velocity: note.rhythmicFeature?.includes("ghost")
        ? clamp(Math.round(note.velocity * 0.82), 1, 127)
        : note.phraseRole === "turnaround"
          ? clamp(note.velocity + 3, 1, 127)
          : note.velocity,
      articulation: note.rhythmicFeature === "snare-roll"
        ? "roll"
        : note.velocity >= 108
          ? "accent"
          : "tight",
      performanceRole: note.rhythmicFeature?.includes("ghost") ? "ghost" : note.phraseRole ?? "pulse",
    }));
  }

  const result = notes.map((note) => ({ ...note }));
  const melodic = ["bass", "melody", "counterpoint"].includes(id);
  for (let index = 0; index < result.length; index += 1) {
    const note = result[index];
    const next = result[index + 1];
    const tension = clamp(finite(note.plannedTension, 0.5), 0, 1);
    const phraseFactor = note.phraseRole === "answer" ? 0.96
      : note.phraseRole === "development" ? 1.015
        : note.phraseRole === "turnaround" ? 1.035 : 1;
    note.velocity = clamp(Math.round(note.velocity * phraseFactor), 1, 127);
    const connected = next
      && next.start - (note.start + note.duration) < 0.16
      && Math.abs(next.pitch - note.pitch) <= 5;
    note.articulation = note.articulationIntent
      ?? (note.velocity >= 110
      ? "accent"
      : melodic && connected
        ? "legato"
        : note.duration <= 0.22
          ? "staccato"
          : ["chords", "pad"].includes(id)
            ? "sustain"
            : "tenuto");
    const breathAfter = melodic && (!next || next.start - (note.start + note.duration) >= 0.38);
    note.performanceRole = breathAfter
      ? "phrase-ending"
      : note.phraseRole === "answer" ? "response"
        : note.phraseRole === "turnaround" ? "lift"
          : "continuation";
    if (breathAfter) {
      note.duration = round(Math.max(0.06, Math.min(note.duration, (next?.start ?? note.start + note.duration + 0.18) - note.start - 0.12)));
      if (note.articulation !== "accent") note.articulation = "tenuto";
    }
    if (
      melodic
      && index > 0
      && Math.abs(note.pitch - result[index - 1].pitch) <= 2
      && note.start - (result[index - 1].start + result[index - 1].duration) < 0.12
      && rng.fork(`${id}-glide-${index}`).bool(0.08 + tension * 0.2)
    ) {
      note.articulation = "glide";
      note.glideFromSemitones = result[index - 1].pitch - note.pitch;
      note.glideBeats = round(clamp(note.duration * 0.22, 0.06, 0.2));
    }
  }
  return result;
}

function createPerformanceAutomation(id, notes, config, structure, settings, rng, songBlueprint = null) {
  const events = createExpressionAutomation(id, config, structure, settings, rng.fork("expression"), songBlueprint);
  if (id === "drums") return events;

  if (["melody", "counterpoint", "pad"].includes(id)) {
    events.push({ type: "cc", controller: 1, beat: 0, value: id === "pad" ? 18 : 4 });
    for (const section of structure) {
      const tension = clamp(finite(section.plannedTension ?? section.tension, 0.5), 0, 1);
      events.push({
        type: "cc",
        controller: 1,
        beat: round(section.startBeat),
        value: clamp(Math.round((id === "pad" ? 14 : 2) + tension * (id === "pad" ? 42 : 28)), 0, 127),
      });
    }
  }

  if (["chords", "pad"].includes(id)) {
    events.push({ type: "cc", controller: 64, beat: 0, value: 0 });
    for (const section of structure) {
      events.push({ type: "cc", controller: 64, beat: round(section.startBeat), value: 96 });
      events.push({ type: "cc", controller: 64, beat: round(Math.max(section.startBeat, section.endBeat - 0.08)), value: 0 });
    }
  }

  for (const note of notes) {
    if (note.articulation !== "glide" || !Number.isFinite(note.glideFromSemitones)) continue;
    const bend = clamp(Math.round(8192 + note.glideFromSemitones / 2 * 8192), 0, 16383);
    events.push({ type: "pitchBend", beat: note.start, value: bend });
    events.push({ type: "pitchBend", beat: round(note.start + finite(note.glideBeats, 0.12)), value: 8192 });
  }

  const byIdentity = new Map();
  for (const event of events) {
    const key = event.type === "cc"
      ? `cc:${event.controller}:${round(event.beat)}`
      : `${event.type}:${round(event.beat)}`;
    byIdentity.set(key, event);
  }
  return [...byIdentity.values()].sort((left, right) => (
    left.beat - right.beat || String(left.type).localeCompare(String(right.type))
  ));
}

function makeTrack(id, settings, notes, automation = []) {
  return {
    id,
    name: settings.name,
    role: TRACK_DEFINITIONS[id].type,
    type: TRACK_DEFINITIONS[id].type,
    channel: TRACK_DEFINITIONS[id].channel,
    program: settings.program,
    settings: {
      density: settings.density,
      variation: settings.variation,
      octave: settings.octave,
      volume: settings.volume,
      velocity: settings.velocity,
      pan: settings.pan,
      reverb: settings.reverb,
      cutoff: settings.cutoff,
      resonance: settings.resonance,
      gate: settings.gate,
      humanize: settings.humanize,
      feel: settings.feel,
      mute: settings.mute,
      solo: settings.solo,
    },
    notes,
    automation,
  };
}

function runProducerPass(sourceTracks, structure, songBlueprint) {
  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: (track.notes ?? []).map((note) => ({ ...note })),
    automation: (track.automation ?? []).map((event) => ({ ...event })),
  }));
  const repairs = {
    overlapsTrimmed: 0,
    registerCollisionsLifted: 0,
    velocitiesScaled: 0,
  };

  for (const track of tracks) {
    if (track.id === "drums") continue;
    const lastByPitch = new Map();
    for (const note of track.notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch)) {
      const previous = lastByPitch.get(note.pitch);
      if (previous && previous.start + previous.duration > note.start - 0.015) {
        const repaired = Math.max(0.02, note.start - previous.start - 0.015);
        if (repaired < previous.duration - 0.001) {
          previous.duration = round(repaired);
          repairs.overlapsTrimmed += 1;
        }
      }
      lastByPitch.set(note.pitch, note);
    }
  }

  const bass = tracks.find((track) => track.id === "bass")?.notes ?? [];
  for (const id of ["chords", "pad"]) {
    const track = tracks.find((candidate) => candidate.id === id);
    if (!track) continue;
    for (const note of track.notes) {
      const soundingBass = bass.filter((candidate) => (
        note.start < candidate.start + candidate.duration
        && candidate.start < note.start + note.duration
      ));
      const bassCeiling = soundingBass.length ? Math.max(...soundingBass.map((candidate) => candidate.pitch)) : null;
      if (bassCeiling != null && note.pitch - bassCeiling < 7 && note.pitch <= 115) {
        note.pitch += 12;
        repairs.registerCollisionsLifted += 1;
      }
    }
  }

  const allNotes = tracks.flatMap((track) => track.notes);
  const originalPeak = allNotes.length ? Math.max(...allNotes.map((note) => note.velocity)) : 0;
  if (originalPeak > 120) {
    const scale = 120 / originalPeak;
    for (const note of allNotes) note.velocity = clamp(Math.round(note.velocity * scale), 1, 120);
    repairs.velocitiesScaled = allNotes.length;
  }

  const finalPeak = allNotes.length ? Math.max(...allNotes.map((note) => note.velocity)) : 0;
  const featuredCoverage = (songBlueprint?.orchestrationMatrix ?? []).map((entry) => {
    const section = structure.find((candidate) => candidate.id === entry.sectionId);
    const track = tracks.find((candidate) => candidate.id === entry.featuredTrack);
    if (!section || !track || track.settings?.density <= 0.001) return true;
    return track.notes.some((note) => note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6);
  });
  const report = {
    phase: 9,
    version: 1,
    status: "awaiting-critic",
    repairs,
    metrics: {
      peakVelocity: finalPeak,
      headroom: Math.max(0, 127 - finalPeak),
      featuredSectionCoverage: round(average(featuredCoverage.map((covered) => covered ? 1 : 0), 1)),
    },
    checks: {
      noteBounds: allNotes.every((note) => note.pitch >= 0 && note.pitch <= 127 && note.velocity >= 1 && note.velocity <= 127),
      headroom: finalPeak <= 120,
      featuredSections: featuredCoverage.every(Boolean),
    },
  };
  return { tracks, report };
}

function runPerceptualMixPass(sourceTracks, structure) {
  const totalBeats = Math.max(0, ...structure.map((section) => finite(section.endBeat, 0)));
  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: track.notes.map((note) => ({ ...note })),
  }));
  const priority = { melody: 5, bass: 5, drums: 5, counterpoint: 3, chords: 2, pad: 1 };
  const pitched = tracks.filter((track) => track.id !== "drums");
  let maskingPairs = 0;
  let attenuatedNotes = 0;
  for (let leftIndex = 0; leftIndex < pitched.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < pitched.length; rightIndex += 1) {
      const left = pitched[leftIndex];
      const right = pitched[rightIndex];
      const rightNotes = [...right.notes].sort((a, b) => a.start - b.start);
      let rightCursor = 0;
      for (const leftNote of [...left.notes].sort((a, b) => a.start - b.start)) {
        while (
          rightCursor < rightNotes.length
          && rightNotes[rightCursor].start + rightNotes[rightCursor].duration <= leftNote.start
        ) rightCursor += 1;
        for (let index = rightCursor; index < rightNotes.length; index += 1) {
          const rightNote = rightNotes[index];
          if (rightNote.start >= leftNote.start + leftNote.duration) break;
          const overlap = leftNote.start < rightNote.start + rightNote.duration
            && rightNote.start < leftNote.start + leftNote.duration;
          if (!overlap) continue;
          const pitchDiff = Math.abs(leftNote.pitch - rightNote.pitch);
          const isMidRangeOvercrowding = (left.id === "melody" && ["chords", "counterpoint"].includes(right.id))
            || (right.id === "melody" && ["chords", "counterpoint"].includes(left.id));
          const maxDiff = isMidRangeOvercrowding ? 7 : 4;
          if (pitchDiff > maxDiff) continue;
          maskingPairs += 1;
          const support = priority[left.id] <= priority[right.id] ? leftNote : rightNote;
          if (support.perceptualRepair) continue;
          support.velocity = clamp(support.velocity - (isMidRangeOvercrowding ? 8 : 5), 1, 127);
          support.duration = round(Math.max(0.04, support.duration * (isMidRangeOvercrowding ? 0.88 : 0.94)));
          support.perceptualRepair = "masking-space";
          attenuatedNotes += 1;
        }
      }
    }
  }
  const notes = tracks.flatMap((track) => track.notes);
  for (const note of notes) {
    note.duration = round(clamp(note.duration, 0.02, Math.max(0.02, totalBeats - note.start)));
  }
  const velocities = notes.map((note) => note.velocity).sort((a, b) => a - b);
  const low = velocities[Math.floor(velocities.length * 0.1)] ?? 0;
  const high = velocities[Math.floor(velocities.length * 0.9)] ?? 0;
  const spectralBands = {
    sub: notes.filter((note) => note.pitch <= 43).length,
    body: notes.filter((note) => note.pitch > 43 && note.pitch <= 76).length,
    presence: notes.filter((note) => note.pitch > 76).length,
  };
  return {
    tracks,
    report: {
      phase: 42,
      version: 1,
      status: "complete",
      maskingPairs,
      attenuatedNotes,
      dynamicRange: high - low,
      spectralBands,
      sectionCount: structure.length,
    },
  };
}

/**
 * Last-mile musical mastering shared by preview and MIDI export. Scale repair
 * can collapse neighboring pitches onto one note, so this pass rechecks
 * overlaps, clears lead/counterpoint unisons, and preserves section dynamics
 * while keeping deterministic headroom.
 */
function runFinalMasterPass(sourceTracks, structure, songBlueprint, config) {
  const totalBeats = Math.max(0, ...structure.map((section) => finite(section.endBeat, 0)));
  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: (track.notes ?? []).map((note) => ({ ...note })),
    automation: (track.automation ?? []).map((event) => ({ ...event })),
  }));
  const repairs = {
    postScaleOverlaps: 0,
    duplicateNotesMerged: 0,
    leadUnisonsCleared: 0,
    leadDissonancesCleared: 0,
    headroomAdjustments: 0,
  };
  const sectionPlans = new Map(
    (songBlueprint?.sectionPlans ?? []).map((plan) => [plan.sectionId, plan]),
  );

  for (const track of tracks) {
    const ordered = track.notes
      .map((note) => {
        const section = structure.find((candidate) => (
          note.start >= candidate.startBeat - 1e-6 && note.start < candidate.endBeat - 1e-6
        ));
        const plannedEnergy = clamp(finite(
          sectionPlans.get(section?.id)?.energy,
          section?.energy ?? 0.58,
        ), 0, 1);
        const dynamicFactor = 0.94 + plannedEnergy * 0.1;
        const velocity = clamp(Math.round(note.velocity * dynamicFactor), 1, 120);
        if (velocity !== note.velocity) repairs.headroomAdjustments += 1;
        const start = round(clamp(note.start, 0, Math.max(0, totalBeats - 0.02)));
        return {
          ...note,
          start,
          duration: round(clamp(note.duration, 0.02, Math.max(0.02, totalBeats - start))),
          velocity,
          finalMasterRole: plannedEnergy >= 0.72 ? "section-peak"
            : plannedEnergy <= 0.38 ? "section-breath" : "section-body",
        };
      })
      .sort((left, right) => left.start - right.start || left.pitch - right.pitch || left.duration - right.duration);
    const deduped = [];
    for (const note of ordered) {
      const retriggerFloor = track.id === "drums" ? 0.0005 : 0.02;
      const duplicate = deduped.findLast((candidate) => (
        candidate.pitch === note.pitch && Math.abs(candidate.start - note.start) < retriggerFloor
      ));
      if (duplicate) {
        const duplicateEnd = Math.max(
          duplicate.start + duplicate.duration,
          note.start + note.duration,
        );
        duplicate.duration = round(duplicateEnd - duplicate.start);
        duplicate.velocity = Math.max(duplicate.velocity, note.velocity);
        repairs.duplicateNotesMerged += 1;
        continue;
      }
      deduped.push(note);
    }
    if (track.id !== "drums") {
      const lastByPitch = new Map();
      for (const note of deduped) {
        const previous = lastByPitch.get(note.pitch);
        if (previous && previous.start + previous.duration > note.start - 0.012) {
          previous.duration = round(Math.max(0.02, note.start - previous.start - 0.012));
          repairs.postScaleOverlaps += 1;
        }
        lastByPitch.set(note.pitch, note);
      }
    }
    track.notes = deduped;
  }

  const melody = tracks.find((track) => track.id === "melody")?.notes ?? [];
  const counterpoint = tracks.find((track) => track.id === "counterpoint")?.notes ?? [];
  const allowedScale = scalePitchClasses(config);
  for (const counterNote of counterpoint) {
    const overlappingLeads = melody.filter((leadNote) => (
      counterNote.start < leadNote.start + leadNote.duration
      && leadNote.start < counterNote.start + counterNote.duration
    ));
    const dissonantLeads = overlappingLeads.filter((leadNote) => (
      [0, 1, 6, 11].includes(mod(Math.abs(counterNote.pitch - leadNote.pitch), 12))
    ));
    if (dissonantLeads.length) {
      const firstConflict = dissonantLeads
        .slice()
        .sort((left, right) => left.start - right.start)[0];
      const availableDuration = firstConflict.start - counterNote.start - 0.06;
      if (availableDuration >= 0.08) {
        counterNote.duration = round(Math.min(counterNote.duration, availableDuration));
      } else {
        const candidates = [];
        for (let shift = -7; shift <= 7; shift += 1) {
          const pitch = counterNote.pitch + shift;
          if (pitch < 36 || pitch > 116 || !allowedScale.has(mod(pitch, 12))) continue;
          if (overlappingLeads.some((lead) => [0, 1, 6, 11].includes(mod(Math.abs(pitch - lead.pitch), 12)))) continue;
          candidates.push(pitch);
        }
        const pitch = candidates.sort((left, right) => (
          Math.abs(left - counterNote.pitch) - Math.abs(right - counterNote.pitch)
          || left - right
        ))[0];
        if (Number.isFinite(pitch)) counterNote.pitch = pitch;
        else {
          counterNote.velocity = clamp(counterNote.velocity - 10, 1, 120);
          counterNote.duration = round(Math.max(0.04, counterNote.duration * 0.58));
        }
      }
      counterNote.finalMasterRepair = "lead-dissonance-space";
      repairs.leadDissonancesCleared += 1;
    }
    const unison = melody.find((leadNote) => (
      leadNote.pitch === counterNote.pitch
      && Math.abs(leadNote.start - counterNote.start) <= 0.035
      && leadNote.start < counterNote.start + counterNote.duration
      && counterNote.start < leadNote.start + leadNote.duration
    ));
    if (!unison) continue;
    const shifted = counterNote.pitch + (counterNote.pitch <= 103 ? 12 : -12);
    const shiftIsClear = shifted >= 0 && shifted <= 127 && !counterpoint.some((candidate) => (
      candidate !== counterNote
      && candidate.pitch === shifted
      && candidate.start < counterNote.start + counterNote.duration
      && counterNote.start < candidate.start + candidate.duration
    ));
    if (shiftIsClear) counterNote.pitch = shifted;
    else {
      counterNote.velocity = clamp(counterNote.velocity - 8, 1, 120);
      counterNote.duration = round(Math.max(0.02, counterNote.duration * 0.82));
    }
    counterNote.finalMasterRepair = "lead-unison-space";
    repairs.leadUnisonsCleared += 1;
  }

  const notes = tracks.flatMap((track) => track.notes ?? []);
  const velocities = notes.map((note) => note.velocity).sort((left, right) => left - right);
  const percentile = (amount) => velocities[Math.min(
    Math.max(0, velocities.length - 1),
    Math.floor(velocities.length * amount),
  )] ?? 0;
  return {
    tracks,
    report: {
      phase: 52,
      version: 1,
      status: "complete",
      repairs,
      metrics: {
        noteCount: notes.length,
        peakVelocity: velocities.at(-1) ?? 0,
        dynamicRange: percentile(0.9) - percentile(0.1),
        sectionCount: structure.length,
      },
      checks: {
        headroom: notes.every((note) => note.velocity <= 120),
        noteBounds: notes.every((note) => (
          note.start >= 0 && note.duration >= 0.02 && note.start + note.duration <= totalBeats + 1e-6
        )),
        sorted: tracks.every((track) => track.notes.every((note, index, list) => (
          index === 0 || list[index - 1].start <= note.start
        ))),
      },
    },
  };
}

/**
 * Reconcile the rendered arrangement with its blueprint after all destructive
 * space-making passes. A removed feature is restored from the already
 * scale-checked pre-polish performance, never synthesized from an arbitrary
 * pitch. Transition repairs only annotate an existing boundary event.
 */
function runFinalAssemblyPass(sourceTracks, fallbackTracks, structure, songBlueprint) {
  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: (track.notes ?? []).map((note) => ({ ...note })),
    automation: (track.automation ?? []).map((event) => ({ ...event })),
  }));
  const fallbackById = new Map(
    fallbackTracks.map((track) => [track.id, track.notes ?? []]),
  );
  let featuredAnchorsRestored = 0;
  let transitionEventsTagged = 0;

  for (const entry of songBlueprint?.orchestrationMatrix ?? []) {
    const section = structure.find((candidate) => candidate.id === entry.sectionId);
    const track = tracks.find((candidate) => candidate.id === entry.featuredTrack);
    if (!section || !track || entry.lanes?.[entry.featuredTrack]?.presence <= 0.001) continue;
    const hasFeature = track.notes.some((note) => (
      note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6
    ));
    if (hasFeature) continue;
    const anchor = (fallbackById.get(entry.featuredTrack) ?? [])
      .filter((note) => note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6)
      .sort((left, right) => (
        Number(Boolean(right.phraseAnchor)) - Number(Boolean(left.phraseAnchor))
        || right.velocity - left.velocity
        || left.start - right.start
      ))[0];
    if (!anchor) continue;
    track.notes.push({
      ...anchor,
      orchestrationRole: "feature",
      finalAssemblyRole: "restored-feature-anchor",
    });
    track.notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
    featuredAnchorsRestored += 1;
  }

  for (const transition of songBlueprint?.transitions ?? []) {
    const from = structure.find((section) => section.id === transition.fromSectionId);
    const to = structure.find((section) => section.id === transition.toSectionId);
    if (!from || !to) continue;
    const lastSection = structure[structure.length - 1];
    if (to.id === lastSection?.id && ["outro", "breakdown"].includes(to.name)) continue;
    const handoffId = `${from.id}->${to.id}`;
    const alreadyTagged = tracks.some((track) => track.notes.some((note) => (
      note.transitionHandoffId === handoffId
    )));
    if (alreadyTagged || transition.type === "drop-out") continue;
    const pickupStart = Math.max(
      from.startBeat,
      from.endBeat - clamp(finite(transition.pickupBeats, 0.5), 0.25, 2),
    );
    const candidates = tracks
      .filter((track) => ["drums", "bass", "chords", "pad"].includes(track.id))
      .flatMap((track) => track.notes.map((note) => ({ note, trackId: track.id })))
      .filter(({ note }) => note.start >= pickupStart - 1e-6 && note.start <= from.endBeat + 0.12)
      .sort((left, right) => (
        Math.abs(left.note.start - from.endBeat) - Math.abs(right.note.start - from.endBeat)
        || Number(right.trackId === "drums") - Number(left.trackId === "drums")
        || right.note.velocity - left.note.velocity
      ));
    if (!candidates[0]) continue;
    candidates[0].note.transitionHandoffId = handoffId;
    candidates[0].note.transitionHandoffRole = `${transition.type}-final-boundary`;
    candidates[0].note.transitionFeature ??= transition.type;
    candidates[0].note.finalAssemblyRole = "verified-transition-event";
    transitionEventsTagged += 1;
  }

  return {
    tracks,
    repairs: {
      featuredAnchorsRestored,
      transitionEventsTagged,
    },
  };
}

function createFinalAssemblyReport(tracks, structure, songBlueprint, repairs) {
  const missingFeaturedSections = [];
  for (const entry of songBlueprint?.orchestrationMatrix ?? []) {
    const section = structure.find((candidate) => candidate.id === entry.sectionId);
    const track = tracks.find((candidate) => candidate.id === entry.featuredTrack);
    if (!section || !track || entry.lanes?.[entry.featuredTrack]?.presence <= 0.001) continue;
    if (!track.notes.some((note) => (
      note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6
    ))) {
      missingFeaturedSections.push(entry.sectionId);
    }
  }
  const silentSections = structure
    .filter((section) => !tracks.some((track) => track.notes.some((note) => (
      note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6
    ))))
    .map((section) => section.id);
  const transitionContracts = (songBlueprint?.transitions ?? []).filter((transition) => {
    const to = structure.find((section) => section.id === transition.toSectionId);
    const lastSection = structure[structure.length - 1];
    return !(to?.id === lastSection?.id && ["outro", "breakdown"].includes(to.name));
  });
  const coordinatedTransitions = transitionContracts.filter((transition) => {
    const from = structure.find((section) => section.id === transition.fromSectionId);
    if (!from) return false;
    const handoffId = `${transition.fromSectionId}->${transition.toSectionId}`;
    if (transition.type !== "drop-out") {
      return tracks.some((track) => track.notes.some((note) => note.transitionHandoffId === handoffId));
    }
    const silenceStart = Math.max(
      from.startBeat,
      from.endBeat - clamp(finite(transition.pickupBeats, 0.5), 0.25, 2),
    );
    return tracks.every((track) => !track.notes.some((note) => (
      note.start >= silenceStart - 1e-6 && note.start < from.endBeat - 1e-6
    )));
  }).length;
  return {
    phase: 75,
    version: 1,
    status: missingFeaturedSections.length || silentSections.length
      || coordinatedTransitions !== transitionContracts.length
      ? "best-available"
      : "complete",
    repairs,
    checks: {
      sectionCoverage: silentSections.length === 0,
      featuredLaneCoverage: missingFeaturedSections.length === 0,
      transitionCoverage: coordinatedTransitions === transitionContracts.length,
    },
    metrics: {
      sectionCount: structure.length,
      silentSections,
      missingFeaturedSections,
      transitionCount: transitionContracts.length,
      coordinatedTransitions,
    },
  };
}

function runVoiceLeadingPass(sourceTracks, config) {
  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: (track.notes ?? []).map((note) => ({ ...note })),
  }));
  let voicesMoved = 0;
  let totalMotion = 0;
  let comparedVoices = 0;
  let commonTonesHeld = 0;
  let bassCollisionsCleared = 0;
  let padDoublingsAvoided = 0;
  const bass = tracks.find((track) => track.id === "bass")?.notes ?? [];
  const chords = tracks.find((track) => track.id === "chords")?.notes ?? [];
  const candidatesForPitchClass = (pitch, minimum, maximum) => {
    const pitchClass = mod(pitch, 12);
    const candidates = [];
    for (let candidate = pitchClass; candidate <= 127; candidate += 12) {
      if (candidate >= minimum && candidate <= maximum) candidates.push(candidate);
    }
    return candidates;
  };

  for (const id of ["chords", "pad"]) {
    const track = tracks.find((candidate) => candidate.id === id);
    if (!track) continue;
    const groups = new Map();
    for (const note of track.notes) {
      const key = round(note.start);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(note);
    }
    let previous = null;
    for (const notes of [...groups.values()].sort((left, right) => left[0].start - right[0].start)) {
      notes.sort((left, right) => left.pitch - right.pitch);
      const soundingBass = bass.filter((note) => (
        notes[0].start < note.start + note.duration
        && note.start < notes[0].start + notes[0].duration
      ));
      const bassCeiling = soundingBass.length
        ? Math.max(...soundingBass.map((note) => note.pitch))
        : null;
      const minimum = id === "pad" ? 48 : bassCeiling != null ? Math.max(48, bassCeiling + 7) : 48;
      const maximum = id === "pad" ? 108 : 103;
      const chordPitches = id === "pad"
        ? new Set(chords.filter((note) => (
          Math.abs(note.start - notes[0].start) < 0.08
          || (
            notes[0].start < note.start + note.duration
            && note.start < notes[0].start + notes[0].duration
          )
        )).map((note) => note.pitch))
        : new Set();
      const choices = notes.map((note) => candidatesForPitchClass(note.pitch, minimum, maximum));
      let best = null;
      const visit = (index, voicing) => {
        if (index === choices.length) {
          let score = 0;
          for (let voice = 0; voice < voicing.length; voice += 1) {
            const pitch = voicing[voice];
            if (previous?.length) {
              const distance = Math.min(...previous.map((note) => Math.abs(note.pitch - pitch)));
              score += distance;
              if (previous.some((note) => note.pitch === pitch)) score -= 7;
            } else {
              score += Math.abs(pitch - (id === "pad" ? 72 : 64)) * 0.18;
            }
            if (voice > 0) {
              const spacing = pitch - voicing[voice - 1];
              if (spacing < 3) score += 30;
              if (spacing > 16) score += (spacing - 16) * 0.8;
            }
            if (id === "pad" && chordPitches.has(pitch)) score += 6;
          }
          if (bassCeiling != null && voicing[0] - bassCeiling < 7) {
            score += 80 + (7 - (voicing[0] - bassCeiling)) * 8;
          }
          if (!best || score < best.score) best = { score, voicing: [...voicing] };
          return;
        }
        for (const pitch of choices[index]) {
          if (voicing.length && pitch <= voicing[voicing.length - 1]) continue;
          visit(index + 1, [...voicing, pitch]);
        }
      };
      visit(0, []);
      const voicing = best?.voicing ?? notes.map((note) => note.pitch);
      const originalBassCollision = bassCeiling != null && notes[0].pitch - bassCeiling < 7;
      const originalPadDoublings = id === "pad"
        ? notes.filter((note) => chordPitches.has(note.pitch)).length
        : 0;
      notes.forEach((note, index) => {
        const chosen = voicing[index] ?? note.pitch;
        if (previous?.length) {
          totalMotion += Math.min(...previous.map((prior) => Math.abs(prior.pitch - chosen)));
          comparedVoices += 1;
          if (previous.some((prior) => prior.pitch === chosen)) commonTonesHeld += 1;
        }
        if (chosen !== note.pitch) {
          note.pitch = chosen;
          note.voiceLeadingRepair = "whole-voicing-optimizer";
          voicesMoved += 1;
        }
      });
      if (originalBassCollision && (bassCeiling == null || notes[0].pitch - bassCeiling >= 7)) {
        bassCollisionsCleared += 1;
      }
      if (id === "pad") {
        const remaining = notes.filter((note) => chordPitches.has(note.pitch)).length;
        padDoublingsAvoided += Math.max(0, originalPadDoublings - remaining);
      }
      notes.sort((left, right) => left.pitch - right.pitch);
      previous = notes;
    }
    track.notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  }
  return {
    tracks,
    report: {
      phase: 46,
      version: 1,
      status: "complete",
      voicesMoved,
      commonTonesHeld,
      bassCollisionsCleared,
      padDoublingsAvoided,
      averageVoiceMotion: round(comparedVoices ? totalMotion / comparedVoices : 0),
      scalePreserved: tracks
        .filter((track) => track.id !== "drums")
        .flatMap((track) => track.notes)
        .every((note) => pitchFitsScale(note.pitch, config)),
    },
  };
}

function runPocketCohesionPass(sourceTracks, structure) {
  const totalBeats = Math.max(0, ...structure.map((section) => finite(section.endBeat, 0)));
  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: (track.notes ?? []).map((note) => ({ ...note })),
  }));
  const drums = tracks.find((track) => track.id === "drums")?.notes ?? [];
  const anchors = drums
    .filter((note) => [36, 38, 39].includes(note.pitch))
    .map((note) => note.start)
    .sort((left, right) => left - right);
  let alignedNotes = 0;
  let totalCorrection = 0;
  for (const track of tracks) {
    // Lead and counterpoint already follow their genre phrase grids. Tighten
    // only the rhythm section here so expressive melodic placement survives.
    if (!["bass", "chords"].includes(track.id)) continue;
    for (const note of track.notes) {
      if (note.rhythmicFeature || note.transitionFeature) continue;
      const anchor = anchors.find((beat) => Math.abs(beat - note.start) <= 0.065);
      if (!Number.isFinite(anchor)) continue;
      const correction = clamp((anchor - note.start) * 0.45, -0.028, 0.028);
      if (Math.abs(correction) < 0.002) continue;
      note.start = round(clamp(note.start + correction, 0, Math.max(0, totalBeats - 0.02)));
      note.pocketCohesion = "shared-transient";
      alignedNotes += 1;
      totalCorrection += Math.abs(correction);
    }
    track.notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  }
  return {
    tracks,
    report: {
      phase: 47,
      version: 1,
      status: "complete",
      alignedNotes,
      averageCorrection: round(alignedNotes ? totalCorrection / alignedNotes : 0),
      anchorCount: anchors.length,
    },
  };
}

function runNegativeSpacePass(sourceTracks, structure, config) {
  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: (track.notes ?? []).map((note) => ({ ...note })),
  }));
  const eligible = structure
    .filter((section) => !["intro", "outro"].includes(section.name))
    .sort((left, right) => finite(left.energy, 0.5) - finite(right.energy, 0.5));
  const breathSection = eligible[0] ?? structure[Math.floor(structure.length / 2)];
  const phraseBars = Math.max(2, GENRE_PROFILES[config.genre]?.arrangement?.phraseBars ?? 4);
  const barBeats = beatsPerBar(config);
  let notesRemoved = 0;
  const windows = [];
  if (breathSection) {
    for (
      let boundary = breathSection.startBeat + phraseBars * barBeats;
      boundary < breathSection.endBeat + 0.01;
      boundary += phraseBars * barBeats
    ) {
      windows.push({
        start: round(Math.max(breathSection.startBeat, boundary - Math.min(0.5, barBeats / 4))),
        end: round(Math.min(breathSection.endBeat, boundary)),
      });
    }
    for (const id of ["counterpoint", "pad"]) {
      const track = tracks.find((candidate) => candidate.id === id);
      if (!track) continue;
      track.notes = track.notes.filter((note) => {
        const inBreath = windows.some((window) => note.start >= window.start && note.start < window.end);
        if (inBreath) notesRemoved += 1;
        return !inBreath;
      });
    }
  }
  return {
    tracks,
    report: {
      phase: 48,
      version: 1,
      status: "complete",
      sectionId: breathSection?.id ?? null,
      windows,
      notesRemoved,
    },
  };
}

const VOCAL_LED_GENRES = new Set(["rap", "hipHop", "trap", "drill", "rnbSoul", "neoSoul", "pop", "reggaeton", "afrobeats"]);

function runVocalSpacePass(sourceTracks, structure, config) {
  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: (track.notes ?? []).map((note) => ({ ...note })),
  }));
  const enabled = VOCAL_LED_GENRES.has(config.genre);
  const barBeats = beatsPerBar(config);
  const verseSections = enabled
    ? structure.filter((section) => !["intro", "chorus", "drop", "outro"].includes(section.name))
    : [];
  const windows = verseSections.flatMap((section) => Array.from({ length: section.bars }, (_, localBar) => {
    const start = section.startBeat + localBar * barBeats;
    return [
      { start: round(start + barBeats * 0.125), end: round(start + barBeats * 0.375) },
      { start: round(start + barBeats * 0.5625), end: round(start + barBeats * 0.8125) },
    ];
  })).flat();
  let freedNotes = 0;
  let softenedNotes = 0;
  const inVocalWindow = (note) => windows.some((window) => (
    note.start >= window.start && note.start < window.end
  ));
  if (windows.length) {
    for (const id of ["melody", "counterpoint"]) {
      const track = tracks.find((candidate) => candidate.id === id);
      if (!track) continue;
      track.notes = track.notes.filter((note) => {
        if (!inVocalWindow(note)) return true;
        const bar = Math.floor(note.start / barBeats);
        const keepFill = bar % 4 === 3 || ["lift", "phrase-ending"].includes(note.performanceRole);
        if (keepFill && id === "melody") {
          note.velocity = clamp(note.velocity - 7, 1, 120);
          note.duration = round(Math.max(0.04, note.duration * 0.72));
          note.vocalSpaceRole = "answer-fill";
          softenedNotes += 1;
          return true;
        }
        freedNotes += 1;
        return false;
      });
    }
    for (const id of ["chords", "pad"]) {
      const track = tracks.find((candidate) => candidate.id === id);
      if (!track) continue;
      for (const note of track.notes) {
        if (!inVocalWindow(note)) continue;
        note.velocity = clamp(note.velocity - 4, 1, 120);
        note.vocalSpaceRole = "vocal-bed";
        softenedNotes += 1;
      }
    }
  }
  const melodicNotes = tracks
    .filter((track) => ["melody", "counterpoint"].includes(track.id))
    .flatMap((track) => track.notes);
  const occupiedWindows = windows.filter((window) => melodicNotes.some((note) => (
    note.start >= window.start && note.start < window.end
  ))).length;
  return {
    tracks,
    report: {
      phase: 51,
      version: 1,
      status: "complete",
      enabled,
      windowCount: windows.length,
      freedNotes,
      softenedNotes,
      openWindowRatio: round(windows.length ? 1 - occupiedWindows / windows.length : 0),
    },
  };
}

function runEnsembleCadencePass(sourceTracks, structure, harmony, songBlueprint, config) {
  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: (track.notes ?? []).map((note) => ({ ...note })),
  }));
  const trackById = new Map(tracks.map((track) => [track.id, track]));
  let sectionsCoordinated = 0;
  let notesRetuned = 0;
  let releasesShaped = 0;
  const nearestPitchClass = (pitch, pitchClasses, minimum, maximum) => {
    let best = pitch;
    let distance = Infinity;
    for (const pitchClass of pitchClasses) {
      for (let candidate = pitchClass; candidate <= 127; candidate += 12) {
        if (candidate < minimum || candidate > maximum) continue;
        const candidateDistance = Math.abs(candidate - pitch);
        if (candidateDistance < distance) {
          best = candidate;
          distance = candidateDistance;
        }
      }
    }
    return best;
  };

  for (const section of structure) {
    const plan = blueprintPlanForSection(songBlueprint, section);
    if (!plan || !["resolve", "lift", "suspend"].includes(plan.cadence)) continue;
    const sectionHarmony = harmony.filter((event) => (
      event.start < section.endBeat - 1e-6
      && event.start + event.duration > section.startBeat + 1e-6
    ));
    const goal = sectionHarmony.at(-1);
    if (!goal) continue;
    let coordinated = false;
    for (const id of ["bass", "melody"]) {
      const track = trackById.get(id);
      const candidates = track?.notes.filter((note) => (
        note.start >= Math.max(section.startBeat, goal.start) - 1e-6
        && note.start < section.endBeat - 1e-6
        && (!note.connectionId || note.connectionId === `interlock:${section.id}`)
      )) ?? [];
      const note = candidates.at(-1);
      if (!note) continue;
      const targetClasses = id === "bass" || plan.cadence === "resolve"
        ? [goal.rootPc]
        : goal.tones;
      const target = nearestPitchClass(
        note.pitch,
        targetClasses,
        id === "bass" ? 28 : 55,
        id === "bass" ? 59 : 96,
      );
      if (target !== note.pitch) {
        note.pitch = target;
        notesRetuned += 1;
      }
      note.ensembleCadenceRole = `${plan.cadence}-${id}-landing`;
      if (plan.cadence === "resolve") {
        const heldDuration = Math.min(
          id === "bass" ? 1.25 : 1,
          Math.max(note.duration, section.endBeat - note.start - 0.04),
        );
        if (heldDuration > note.duration + 1e-6) {
          note.duration = round(heldDuration);
          releasesShaped += 1;
        }
      }
      coordinated = true;
    }
    for (const id of ["chords", "pad"]) {
      const notes = trackById.get(id)?.notes.filter((note) => (
        note.start >= goal.start - 1e-6 && note.start < section.endBeat - 1e-6
      )) ?? [];
      for (const note of notes) {
        const maximum = Math.max(0.08, section.endBeat - note.start - 0.025);
        const shaped = plan.cadence === "lift"
          ? Math.min(note.duration, 0.72)
          : plan.cadence === "resolve"
            ? Math.min(maximum, Math.max(note.duration, 0.9))
            : Math.min(note.duration, 0.86);
        if (Math.abs(shaped - note.duration) > 1e-6) {
          note.duration = round(shaped);
          releasesShaped += 1;
        }
        note.ensembleCadenceRole = `${plan.cadence}-harmony-release`;
        coordinated = true;
      }
    }
    if (coordinated) sectionsCoordinated += 1;
  }
  return {
    tracks,
    report: {
      phase: 66,
      version: 1,
      status: "complete",
      sectionsCoordinated,
      notesRetuned,
      releasesShaped,
      scalePreserved: tracks
        .filter((track) => track.id !== "drums")
        .flatMap((track) => track.notes)
        .every((note) => pitchFitsScale(note.pitch, config)),
    },
  };
}

function runTransitionHandoffPass(sourceTracks, structure, songBlueprint) {
  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: (track.notes ?? []).map((note) => ({ ...note })),
  }));
  let transitionsCoordinated = 0;
  let arrivalsAligned = 0;
  let crossingsCleared = 0;
  let dropoutNotesRemoved = 0;
  for (const transition of songBlueprint?.transitions ?? []) {
    const from = structure.find((section) => section.id === transition.fromSectionId);
    const to = structure.find((section) => section.id === transition.toSectionId);
    if (!from || !to) continue;
    const lastSection = structure[structure.length - 1];
    if (to.id === lastSection?.id && ["outro", "breakdown"].includes(to.name)) continue;
    const boundary = from.endBeat;
    const pickup = clamp(finite(transition.pickupBeats, 0.5), 0.25, 2);
    const handoffId = `${transition.fromSectionId}->${transition.toSectionId}`;
    let coordinated = false;

    if (transition.type === "drop-out") {
      const silenceStart = Math.max(from.startBeat, boundary - pickup);
      for (const track of tracks) {
        const kept = [];
        for (const note of track.notes) {
          if (note.start >= silenceStart - 1e-6 && note.start < boundary - 1e-6) {
            const belongsToIncomingSection = note.connectionId === `interlock:${to.id}`;
            const essentialArrival = (
              track.id === "drums" && note.pitch === 36
              || track.id === "bass" && note.bassRegisterRole === "upper-harmonic"
            );
            if ((belongsToIncomingSection || essentialArrival) && !note.ensembleCadenceRole) {
              note.start = round(boundary);
              note.transitionHandoffRole = "drop-out-arrival";
              note.transitionHandoffId = handoffId;
              arrivalsAligned += 1;
              coordinated = true;
              kept.push(note);
              continue;
            }
            dropoutNotesRemoved += 1;
            coordinated = true;
            continue;
          }
          if (note.start < silenceStart && note.start + note.duration > silenceStart) {
            note.duration = round(Math.max(0.02, silenceStart - note.start));
            note.transitionHandoffRole = "dropout-breath";
            note.transitionHandoffId = handoffId;
            crossingsCleared += 1;
            coordinated = true;
          }
          kept.push(note);
        }
        track.notes = kept;
      }
    } else {
      for (const track of tracks) {
        const incoming = track.notes
          .filter((note) => note.start >= boundary - 0.09 && note.start <= boundary + 0.12)
          .sort((left, right) => (
            Number(right.connectionId === `interlock:${to.id}`)
            - Number(left.connectionId === `interlock:${to.id}`)
            || Number(Boolean(left.ensembleCadenceRole)) - Number(Boolean(right.ensembleCadenceRole))
            || Math.abs(left.start - boundary) - Math.abs(right.start - boundary)
          ));
        const arrivalCandidates = incoming.filter((note) => (
          note.connectionId === `interlock:${to.id}` || !note.ensembleCadenceRole
        ));
        const arrival = arrivalCandidates.find((note) => note.transitionFeature === transition.type)
          ?? (["drums", "bass", "chords", "pad"].includes(track.id) ? arrivalCandidates[0] : null);
        if (arrival && Math.abs(arrival.start - boundary) > 1e-6) {
          arrival.start = round(boundary);
          arrival.transitionHandoffRole = `${transition.type}-arrival`;
          arrival.transitionHandoffId = handoffId;
          arrivalsAligned += 1;
          coordinated = true;
        } else if (arrival) {
          arrival.transitionHandoffRole = `${transition.type}-arrival`;
          arrival.transitionHandoffId = handoffId;
          coordinated = true;
        }
        if (transition.strength >= 0.72 && ["melody", "counterpoint", "chords", "pad"].includes(track.id)) {
          for (const note of track.notes) {
            if (note.start < boundary - 0.035 && note.start + note.duration > boundary - 0.035) {
              if (boundary - 0.035 - note.start < 0.02) note.start = round(boundary - 0.055);
              note.duration = round(Math.max(0.02, boundary - 0.035 - note.start));
              note.transitionHandoffRole = `${transition.type}-clear-seam`;
              note.transitionHandoffId = handoffId;
              crossingsCleared += 1;
              coordinated = true;
            }
          }
        }
      }
    }
    if (coordinated) transitionsCoordinated += 1;
  }
  for (const track of tracks) {
    track.notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  }
  return {
    tracks,
    report: {
      phase: 67,
      version: 1,
      status: "complete",
      transitionsCoordinated,
      arrivalsAligned,
      crossingsCleared,
      dropoutNotesRemoved,
    },
  };
}

function runCreativePolishPasses(sourceTracks, structure, harmony, songBlueprint, config) {
  const voiceLeading = runVoiceLeadingPass(sourceTracks, config);
  const pocketCohesion = runPocketCohesionPass(voiceLeading.tracks, structure);
  const negativeSpace = runNegativeSpacePass(pocketCohesion.tracks, structure, config);
  const vocalSpace = runVocalSpacePass(negativeSpace.tracks, structure, config);
  const ensembleCadence = runEnsembleCadencePass(
    vocalSpace.tracks,
    structure,
    harmony,
    songBlueprint,
    config,
  );
  const transitionHandoff = runTransitionHandoffPass(
    ensembleCadence.tracks,
    structure,
    songBlueprint,
  );
  return {
    tracks: transitionHandoff.tracks,
    voiceLeading: voiceLeading.report,
    pocketCohesion: pocketCohesion.report,
    negativeSpace: negativeSpace.report,
    vocalSpace: vocalSpace.report,
    ensembleCadence: ensembleCadence.report,
    transitionHandoff: transitionHandoff.report,
  };
}

function createSectionContrastReport(tracks, structure, orchestrationMatrix) {
  const firstFeatureByName = new Map();
  let repeatedSections = 0;
  let rotatedReturns = 0;
  const densities = structure.map((section) => {
    const entry = orchestrationMatrix.find((candidate) => candidate.sectionId === section.id);
    const previousFeature = firstFeatureByName.get(section.name);
    if (previousFeature) {
      repeatedSections += 1;
      if (entry?.featuredTrack && entry.featuredTrack !== previousFeature) rotatedReturns += 1;
    } else if (entry?.featuredTrack) {
      firstFeatureByName.set(section.name, entry.featuredTrack);
    }
    const noteCount = tracks.reduce((sum, track) => sum + track.notes.filter((note) => (
      note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6
    )).length, 0);
    return noteCount / Math.max(1, section.endBeat - section.startBeat);
  });
  return {
    phase: 68,
    version: 1,
    status: "complete",
    repeatedSections,
    rotatedReturns,
    densityRange: round(Math.max(...densities, 0) - Math.min(...densities, 0)),
    featuredTracks: [...new Set(orchestrationMatrix.map((entry) => entry.featuredTrack).filter(Boolean))],
  };
}

function createDrumFillVocabularyReport(tracks, genre) {
  const fillNotes = tracks.find((track) => track.id === "drums")?.notes
    .filter((note) => note.drumFillId) ?? [];
  const patternsUsed = [...new Set(fillNotes.map((note) => note.drumFillId))];
  const vocabulary = drumFillVocabularyForGenre(genre);
  return {
    phase: 71,
    version: 1,
    status: "complete",
    family: vocabulary[0].id.split("-")[0],
    fillEvents: fillNotes.length,
    patternCount: patternsUsed.length,
    patternsUsed,
  };
}

function createRhythmTurnaroundReport(tracks) {
  const calls = new Set();
  const answers = new Set();
  for (const track of tracks) {
    for (const note of track.notes) {
      if (!note.rhythmTurnaroundId) continue;
      if (note.rhythmTurnaroundRole === "drum-call") calls.add(note.rhythmTurnaroundId);
      if (note.rhythmTurnaroundRole === "bass-answer") answers.add(note.rhythmTurnaroundId);
    }
  }
  const paired = [...calls].filter((id) => answers.has(id));
  return {
    phase: 72,
    version: 1,
    status: "complete",
    drumCalls: calls.size,
    bassAnswers: answers.size,
    pairedTurnarounds: paired.length,
    pairRate: round(paired.length / Math.max(1, calls.size)),
  };
}

// ─── Song identity and title language ───────────────────────────────────────
// Titles combine style, tonal color, and energy without altering composition.
const TITLE_ADJECTIVES = [
  "Velvet", "Neon", "Golden", "Midnight", "Crystal", "Lucid", "Solar", "Secret", "Endless", "Prismatic",
  "Obsidian", "Astral", "Luminous", "Radiant", "Vivid", "Ethereal", "Cyber", "Silken", "Twilight", "Spectral",
  "Weightless", "Electric", "Chrome", "Fever", "Quiet", "Wild", "Blue", "Slow", "Satellite", "Hollow",
];
const TITLE_NOUNS = [
  "Orbit", "Bloom", "Signal", "Skyline", "Echo", "Mirage", "Horizon", "Eclipse", "Cascade", "Passage",
  "Avenue", "Prism", "Polaroid", "Afterglow", "Daybreak", "Switchback", "Static", "Moonlight", "Undertow",
  "Overdrive", "Silhouette", "Fire Escape", "Night Bus", "Glasshouse", "Crossfade", "Half-Light",
];
const TITLE_GENRE_WORDS = {
  neoSoul: { adjectives: ["Velvet", "Silken", "Honeyed", "Late-Night"], nouns: ["Slow Dance", "Side Street", "Blue Hour", "Afterglow"] },
  hipHop: { adjectives: ["Dusty", "Concrete", "Low-Slung", "Backseat"], nouns: ["Cipher", "Corner Store", "Night Bus", "Rooftop"] },
  rap: { adjectives: ["Untold", "Streetlit", "Raw", "After-Dark"], nouns: ["Sixteen Bars", "Open Mic", "Wordplay", "City Pages"] },
  trap: { adjectives: ["Chrome", "Hollow", "Midnight", "Black-Ice"], nouns: ["Pressure", "Starlight", "Fast Lane", "No Signal"] },
  house: { adjectives: ["Mirrorball", "Electric", "Golden", "Afterhours"], nouns: ["Warehouse", "Heartbeat", "Open Door", "Last Call"] },
  techno: { adjectives: ["Obsidian", "Machine", "Steel", "Infrared"], nouns: ["Tunnel", "Voltage", "Night Shift", "Sublevel"] },
  drumBass: { adjectives: ["Weightless", "Rapid", "Airborne", "Fractured"], nouns: ["Break Line", "Rush Hour", "Slipstream", "Blue Static"] },
  synthwave: { adjectives: ["Neon", "Satellite", "Chrome", "Violet"], nouns: ["Night Drive", "Arcade", "Sunset Grid", "Video Sky"] },
  pop: { adjectives: ["Golden", "Wild", "Bright", "Electric"], nouns: ["Daydream", "Polaroid", "Fire Escape", "Summer Signal"] },
  country: { adjectives: ["Open-Road", "Dusty", "Golden", "Blue-Sky"], nouns: ["County Line", "Front Porch", "Long Way Home", "Radio Moon"] },
  rock: { adjectives: ["Electric", "Ragged", "Crimson", "Loud"], nouns: ["Overdrive", "Backstage", "Broken Amp", "Last Encore"] },
};
const TITLE_ACTIONS = ["Chase", "Hold", "Follow", "Find", "Leave", "Ride", "Cross", "Wake"];
const TITLE_PLACES = ["Daybreak", "Midnight", "the Skyline", "the Afterglow", "Blue Hour", "Last Light"];

function titleFor(config, rng) {
  const genreWords = TITLE_GENRE_WORDS[config.genre] ?? TITLE_GENRE_WORDS.pop;
  const modeWords = ["minor", "phrygian", "harmonicMinor"].includes(config.scale)
    ? ["Hollow", "Midnight", "Obsidian", "Blue"]
    : ["major", "lydian"].includes(config.scale)
      ? ["Golden", "Luminous", "Solar", "Weightless"]
      : ["Lucid", "Velvet", "Electric", "Twilight"];
  const energyWords = config.energy >= 0.75
    ? ["Fever", "Electric", "Wild", "Rapid"]
    : config.energy <= 0.38
      ? ["Quiet", "Slow", "Silken", "Weightless"]
      : [];
  const adjectives = [...new Set([...genreWords.adjectives, ...modeWords, ...energyWords, ...TITLE_ADJECTIVES])];
  const nouns = [...new Set([...genreWords.nouns, ...TITLE_NOUNS])];
  const adjective = rng.pick(adjectives);
  const noun = rng.pick(nouns);
  const template = rng.int(0, 3);
  if (template === 1) return `${noun} at ${rng.pick(TITLE_PLACES)}`;
  if (template === 2) return `${rng.pick(TITLE_ACTIONS)} the ${noun}`;
  if (template === 3) {
    const second = rng.pick(nouns.filter((word) => word !== noun));
    return `${noun} / ${second}`;
  }
  return `${adjective} ${noun}`;
}

// Keep engine-only configuration details out of the exported song contract.
function publicSettings(config) {
  const {
    seed: _seed,
    keyPc: _keyPc,
    scaleIntervals: _scaleIntervals,
    title: _title,
    key: _key,
    scale: _scale,
    tempo: _tempo,
    bars: _bars,
    timeSignature: _timeSignature,
    excludeOneShotKitIds: _excludeOneShotKitIds,
    tasteProfile: _tasteProfile,
    ...settings
  } = config;
  return clone(settings);
}

const GM_PROGRAM_NAMES = {
  0: "Acoustic Grand Piano",
  4: "Electric Piano 1",
  5: "Electric Piano 2",
  16: "Drawbar Organ",
  17: "Percussive Organ",
  25: "Steel-String Guitar",
  26: "Jazz Electric Guitar",
  33: "Fingered Electric Bass",
  34: "Picked Electric Bass",
  35: "Fretless Bass",
  36: "Slap Bass",
  38: "Synth Bass 1",
  39: "Synth Bass 2",
  48: "String Ensemble",
  53: "Voice Oohs",
  54: "Synth Voice",
  73: "Flute",
  80: "Square Lead",
  81: "Saw Lead",
  82: "Calliope Lead",
  84: "Charang Lead",
  85: "Voice Lead",
  86: "Fifths Lead",
  87: "Bass + Lead",
  88: "New Age Pad",
  89: "Warm Pad",
  90: "Polysynth Pad",
  91: "Choir Pad",
  92: "Bowed Pad",
  95: "Sweep Pad",
  99: "Atmosphere FX",
};

const GM2_DRUM_KIT_NAMES = {
  0: "Standard Kit",
  8: "Room Kit",
  16: "Power Kit",
  24: "Electronic Kit",
  25: "TR-808 Kit",
};

/**
 * Browser-preview one-shot palettes. These are compact procedural samples:
 * each kit has its own deterministic noise grain, tuning, envelopes, and
 * transient color while retaining the General MIDI drum-note map for export.
 */
export const ONE_SHOT_KITS = deepFreeze([
  {
    id: "velvet-room",
    name: "Velvet Room One-Shots",
    oneShots: { kick: "Velvet 22", snare: "Room Snap", clap: "Soft Stack", hat: "Silk Hat", openHat: "Silk Open", cymbal: "Warm Crash", tom: "Maple Tom" },
    preview: { kickStart: 118, kickEnd: 45, kickDecay: 0.24, kickWave: "sine", clickPitch: 2350, clickLevel: 0.032, snareFilter: 1450, snareTone: 178, snareDecay: 0.19, hatFilter: 5900, hatDecay: 0.052, openHatDecay: 0.28, cymbalFilter: 4200, cymbalDecay: 0.68, tomTune: 0.92, noiseColor: 0.72 },
  },
  {
    id: "neon-808",
    name: "Neon 808 One-Shots",
    oneShots: { kick: "Neon Sub", snare: "Laser Snare", clap: "Digital Stack", hat: "Pixel Hat", openHat: "Neon Open", cymbal: "Glass Crash", tom: "808 Tom" },
    preview: { kickStart: 176, kickEnd: 34, kickDecay: 0.34, kickWave: "sine", clickPitch: 4100, clickLevel: 0.052, snareFilter: 2250, snareTone: 232, snareDecay: 0.13, hatFilter: 8200, hatDecay: 0.036, openHatDecay: 0.19, cymbalFilter: 6100, cymbalDecay: 0.48, tomTune: 1.08, noiseColor: 1.34 },
  },
  {
    id: "dusty-tape",
    name: "Dusty Tape One-Shots",
    oneShots: { kick: "Tape Knock", snare: "Dust Snare", clap: "Cassette Clap", hat: "Vinyl Hat", openHat: "Loose Open", cymbal: "Muted Crash", tom: "Cardboard Tom" },
    preview: { kickStart: 104, kickEnd: 49, kickDecay: 0.18, kickWave: "triangle", clickPitch: 1650, clickLevel: 0.022, snareFilter: 1180, snareTone: 154, snareDecay: 0.15, hatFilter: 4700, hatDecay: 0.061, openHatDecay: 0.24, cymbalFilter: 3600, cymbalDecay: 0.39, tomTune: 0.84, noiseColor: 0.48 },
  },
  {
    id: "chrome-club",
    name: "Chrome Club One-Shots",
    oneShots: { kick: "Club Hammer", snare: "Chrome Snare", clap: "Arena Clap", hat: "Chrome Hat", openHat: "Club Open", cymbal: "White Crash", tom: "Festival Tom" },
    preview: { kickStart: 154, kickEnd: 42, kickDecay: 0.21, kickWave: "sine", clickPitch: 5200, clickLevel: 0.061, snareFilter: 2700, snareTone: 218, snareDecay: 0.17, hatFilter: 9200, hatDecay: 0.032, openHatDecay: 0.25, cymbalFilter: 7200, cymbalDecay: 0.72, tomTune: 1.14, noiseColor: 1.58 },
  },
  {
    id: "basement-knock",
    name: "Basement Knock One-Shots",
    oneShots: { kick: "Concrete Kick", snare: "Basement Crack", clap: "Wall Clap", hat: "Rust Hat", openHat: "Rust Open", cymbal: "Dark Crash", tom: "Floor Tom" },
    preview: { kickStart: 132, kickEnd: 38, kickDecay: 0.29, kickWave: "sine", clickPitch: 2050, clickLevel: 0.044, snareFilter: 1720, snareTone: 132, snareDecay: 0.22, hatFilter: 5400, hatDecay: 0.043, openHatDecay: 0.31, cymbalFilter: 3900, cymbalDecay: 0.82, tomTune: 0.76, noiseColor: 0.63 },
  },
  {
    id: "circuit-pop",
    name: "Circuit Pop One-Shots",
    oneShots: { kick: "Circuit Kick", snare: "Pop Snare", clap: "Candy Clap", hat: "Tick Hat", openHat: "Fizz Open", cymbal: "Spark Crash", tom: "Arcade Tom" },
    preview: { kickStart: 146, kickEnd: 52, kickDecay: 0.16, kickWave: "triangle", clickPitch: 6200, clickLevel: 0.047, snareFilter: 3150, snareTone: 264, snareDecay: 0.11, hatFilter: 10400, hatDecay: 0.026, openHatDecay: 0.15, cymbalFilter: 7900, cymbalDecay: 0.36, tomTune: 1.28, noiseColor: 1.82 },
  },
  {
    id: "airbreak",
    name: "Airbreak One-Shots",
    oneShots: { kick: "Break Kick", snare: "Air Snare", clap: "Wide Clap", hat: "Rush Hat", openHat: "Rush Open", cymbal: "Break Crash", tom: "Jungle Tom" },
    preview: { kickStart: 128, kickEnd: 47, kickDecay: 0.17, kickWave: "sine", clickPitch: 3400, clickLevel: 0.038, snareFilter: 2380, snareTone: 196, snareDecay: 0.14, hatFilter: 7600, hatDecay: 0.029, openHatDecay: 0.18, cymbalFilter: 5700, cymbalDecay: 0.44, tomTune: 1.2, noiseColor: 1.18 },
  },
  {
    id: "solar-percussion",
    name: "Solar Percussion One-Shots",
    oneShots: { kick: "Sun Kick", snare: "Palm Snare", clap: "Hand Stack", hat: "Seed Hat", openHat: "Shaker Open", cymbal: "Bronze Crash", tom: "Skin Tom" },
    preview: { kickStart: 112, kickEnd: 55, kickDecay: 0.2, kickWave: "triangle", clickPitch: 2850, clickLevel: 0.029, snareFilter: 1920, snareTone: 246, snareDecay: 0.16, hatFilter: 6800, hatDecay: 0.047, openHatDecay: 0.21, cymbalFilter: 5000, cymbalDecay: 0.57, tomTune: 1.36, noiseColor: 0.96 },
  },
]);

function chooseOneShotKit(config, preferred = null) {
  const preferredId = typeof preferred === "string" ? preferred : preferred?.id;
  const requestedId = preferredId || config.oneShotKitId;
  const requested = ONE_SHOT_KITS.find((kit) => kit.id === requestedId);
  if (requested) return requested;
  const excluded = new Set(config.excludeOneShotKitIds ?? []);
  const choices = ONE_SHOT_KITS.filter((kit) => !excluded.has(kit.id));
  const palette = choices.length ? choices : ONE_SHOT_KITS;
  return palette[hashSeed(`${config.seed}::one-shot-kit`) % palette.length];
}

function publicOneShotKit(kit) {
  return {
    id: kit.id,
    name: kit.name,
    oneShots: clone(kit.oneShots),
  };
}

function programName(program) {
  return GM_PROGRAM_NAMES[program] ?? `GM Program ${Number(program) + 1}`;
}

function createIdeaAnalysis(config, structure, harmony, style, tracks, oneShotKit, songBlueprint = null, performanceProfile = null) {
  const profile = GENRE_PROFILES[config.genre];
  const notes = tracks.flatMap((track) => track.notes ?? []);
  const tripletEvents = notes.filter((note) => String(note.rhythmicFeature ?? "").startsWith("triplet-")).length;
  const snareRollEvents = notes.filter((note) => note.rhythmicFeature === "snare-roll").length;
  const ghostNoteEvents = notes.filter((note) => note.rhythmicFeature === "ghost-note").length;
  const auxiliaryRhythmEvents = notes.filter((note) => /-(accent)$/.test(String(note.rhythmicFeature ?? ""))).length;
  const grooveNames = {
    backbeat: "Pocket backbeat",
    fourFloor: "Four-on-the-floor drive",
    breakbeat: "Syncopated breakbeat",
    halfTime: "Half-time pocket",
    electro: "Electro syncopation",
  };
  const rhythmIdentity = style.rhythmIdentity && typeof style.rhythmIdentity === "object"
    ? clone(style.rhythmIdentity)
    : null;
  const rhythmicFeatures = [
    rhythmIdentity?.label ?? grooveNames[style.drumGroove] ?? "Genre pocket",
    grooveNames[style.drumGroove] ?? "Genre pocket",
  ];
  if (profile.halfTime || style.drumGroove === "halfTime") rhythmicFeatures.push("Half-time backbeat");
  if (tripletEvents) {
    if (notes.some((note) => note.rhythmicFeature === "triplet-eighth")) rhythmicFeatures.push("Eighth-note triplets");
    if (notes.some((note) => note.rhythmicFeature === "triplet-sixteenth")) rhythmicFeatures.push("Sixteenth-note triplets");
  }
  if (snareRollEvents) rhythmicFeatures.push("Phrase-boundary snare rolls");
  if (ghostNoteEvents) rhythmicFeatures.push("Dynamic ghost notes");
  if (auxiliaryRhythmEvents && rhythmIdentity?.percussionVoice) {
    rhythmicFeatures.push(`${rhythmIdentity.percussionVoice[0].toUpperCase()}${rhythmIdentity.percussionVoice.slice(1)} accent lane`);
  }
  if (config.swing >= 0.16) rhythmicFeatures.push("Swung offbeats");
  if (config.syncopation >= 0.5) rhythmicFeatures.push("Syncopated bass and accents");
  if (performanceProfile?.feel?.label) rhythmicFeatures.push(performanceProfile.feel.label);
  const phraseShapeLabels = {
    questionAnswer: "Question-and-answer phrase",
    syncopatedLoop: "Syncopated loop phrase",
    longShort: "Long-short phrase",
    staircase: "Stepping phrase",
    sparseEcho: "Sparse echo phrase",
  };
  const timingPocketLabels = {
    centered: "Centered timing",
    laidBack: "Laid-back timing",
    pushed: "Forward timing",
    elastic: "Elastic timing",
    live: "Live timing",
  };
  if (rhythmIdentity?.phraseShape) rhythmicFeatures.push(phraseShapeLabels[rhythmIdentity.phraseShape] ?? rhythmIdentity.phraseShape);
  if (rhythmIdentity?.timingPocket) rhythmicFeatures.push(timingPocketLabels[rhythmIdentity.timingPocket] ?? rhythmIdentity.timingPocket);
  if (rhythmIdentity?.motifBars) rhythmicFeatures.push(`${rhythmIdentity.motifBars}-bar motif`);
  const genreRhythmGrammar = GENRE_RHYTHM_GRAMMARS[config.genre];
  if (genreRhythmGrammar?.phrase) rhythmicFeatures.push(`Genre phrase: ${genreRhythmGrammar.phrase}`);
  rhythmicFeatures.push("A/A′/B/C motif conversation");
  rhythmicFeatures.push("Ensemble groove conductor");
  const transitionTypes = [...new Set((songBlueprint?.transitions ?? []).map((transition) => transition.type))];
  if (transitionTypes.length) rhythmicFeatures.push(`Transitions: ${transitionTypes.join(", ")}`);
  const barChords = harmony.filter((event, index) => index === 0 || harmony[index - 1].bar !== event.bar);
  return {
    genreId: profile.id,
    genreLabel: profile.label,
    tempoRange: { ...profile.bpm },
    tempoFit: config.tempo < profile.bpm.min ? "Below typical" : config.tempo > profile.bpm.max ? "Above typical" : "Genre pocket",
    grooveLabel: grooveNames[style.drumGroove] ?? "Genre pocket",
    rhythmIdentity,
    halfTime: profile.halfTime || style.drumGroove === "halfTime",
    tripletEvents,
    snareRollEvents,
    rhythmicFeatures,
    chordProgression: barChords.slice(0, 8).map((event) => event.symbol),
    harmonicStory: (songBlueprint?.sectionPlans ?? []).map((plan) => `${plan.sectionName}: ${plan.harmonicRole}`),
    transitionTypes,
    performanceFeel: performanceProfile?.feel?.label ?? "Generated pocket",
    sectionArc: structure.map((section) => `${section.name} (${section.bars} ${section.bars === 1 ? "bar" : "bars"})`),
    soundPalette: tracks.map((track) => ({
      trackId: track.id,
      program: track.program,
      name: track.id === "drums"
        ? `${oneShotKit.name} · ${oneShotKit.oneShots.kick} / ${oneShotKit.oneShots.snare}`
        : programName(track.program),
    })),
  };
}

function normalizeContextTracks(input, config) {
  const result = {};
  if (!input || typeof input !== "object") return result;
  const entries = Array.isArray(input)
    ? input.map((track) => [track?.id, track])
    : Object.entries(input);
  const totalBeats = config.bars * beatsPerBar(config);
  for (const [rawId, candidate] of entries) {
    const id = String(rawId ?? "");
    if (!TRACK_DEFINITIONS[id]) continue;
    const sourceNotes = Array.isArray(candidate) ? candidate : candidate?.notes;
    if (!Array.isArray(sourceNotes)) continue;
    result[id] = sourceNotes
      .filter((note) => note && Number.isFinite(Number(note.start)) && Number.isFinite(Number(note.pitch)))
      .map((note) => {
        const start = clamp(finite(note.start, 0), 0, Math.max(0, totalBeats - 0.02));
        return {
          pitch: clamp(Math.round(finite(note.pitch, 60)), 0, 127),
          start,
          duration: clamp(finite(note.duration, 0.25), 0.02, Math.max(0.02, totalBeats - start)),
          velocity: clamp(Math.round(finite(note.velocity, 90)), 1, 127),
          ...(note.rhythmicFeature ? { rhythmicFeature: String(note.rhythmicFeature) } : {}),
          ...(Number.isFinite(note.subdivision) ? { subdivision: note.subdivision } : {}),
        };
      })
      .sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  }
  return result;
}

function contextNotesForTarget(contextTracks, targetTrack, dependencyId) {
  if (!targetTrack || !TRACK_DEFINITIONS[targetTrack]) return null;
  if (!Object.prototype.hasOwnProperty.call(contextTracks, dependencyId)) return null;
  return contextTracks[dependencyId];
}

function createGenerationInterlockPlan(
  config,
  structure,
  harmony,
  motifs,
  songBlueprint,
  grooveConductor,
  performanceProfile,
  route,
) {
  const orchestration = new Map(
    (songBlueprint?.orchestrationMatrix ?? []).map((entry) => [entry.sectionId, entry]),
  );
  const outgoing = new Map(
    (songBlueprint?.transitions ?? []).map((transition) => [transition.fromSectionId, transition]),
  );
  const assignments = new Map(
    (motifs?.sectionAssignments ?? []).map((assignment) => [assignment.sectionId, assignment]),
  );
  const sectionContracts = structure.map((section) => {
    const plan = blueprintPlanForSection(songBlueprint, section);
    const sectionHarmony = harmony.filter((event) => (
      event.start >= section.startBeat - 1e-6 && event.start < section.endBeat - 1e-6
    ));
    const harmonicGoal = sectionHarmony.at(-1);
    const bars = (grooveConductor?.bars ?? [])
      .filter((bar) => bar.sectionId === section.id)
      .map((bar) => ({
        bar: bar.bar,
        role: bar.role,
        accent: round(bar.answers?.[0] ?? bar.anchors?.[1] ?? bar.anchors?.[0] ?? 0),
      }));
    return {
      id: `interlock:${section.id}`,
      sectionId: section.id,
      role: plan?.role ?? section.intent?.role ?? "development",
      cadence: plan?.cadence ?? section.intent?.cadence ?? "open",
      energy: round(clamp(finite(plan?.energy, section.intensity / 1.18), 0, 1)),
      tension: round(clamp(finite(plan?.tension, section.intent?.tension), 0, 1)),
      motifId: assignments.get(section.id)?.motifId ?? "A",
      harmonicGoalDegree: harmonicGoal?.degree ?? plan?.harmonicGoalDegree ?? 0,
      harmonicGoalPitchClasses: [...new Set(harmonicGoal?.tones ?? [config.keyPc])],
      featuredTrack: orchestration.get(section.id)?.featuredTrack ?? "melody",
      performanceFeel: performanceProfile?.feel?.id ?? "balanced",
      transitionOut: outgoing.get(section.id)?.type ?? null,
      bars,
    };
  });
  return {
    version: 1,
    phase: 39,
    routeId: route?.id ?? "harmony-first",
    stages: [
      { id: "intent", receives: ["settings"], publishes: ["structure", "style", "songBlueprint"] },
      { id: "harmony", receives: ["structure", "songBlueprint"], publishes: ["harmony"] },
      { id: "motif", receives: ["style", "songBlueprint", "harmony"], publishes: ["motifs"] },
      { id: "groove", receives: ["structure", "style", "motifs"], publishes: ["grooveConductor"] },
      {
        id: "ensemble",
        receives: ["songBlueprint", "harmony", "motifs", "grooveConductor"],
        publishes: ["connectedTracks"],
      },
      {
        id: "arrangement",
        receives: ["connectedTracks", "songBlueprint"],
        publishes: ["orchestratedTracks"],
      },
      {
        id: "performance",
        receives: ["orchestratedTracks", "performanceProfile"],
        publishes: ["performedTracks"],
      },
      { id: "critic", receives: ["performedTracks", "generationInterlock"], publishes: ["evaluation"] },
    ],
    sectionContracts,
  };
}

function applyGenerationInterlocks(
  sourceTracks,
  interlock,
  structure,
  config,
  { adjustVelocity = true } = {},
) {
  const barBeats = beatsPerBar(config);
  const contractBySection = new Map(
    (interlock?.sectionContracts ?? []).map((contract) => [contract.sectionId, contract]),
  );
  return Object.fromEntries(Object.entries(sourceTracks).map(([trackId, source]) => [
    trackId,
    source.map((note) => {
      const {
        connectionId: _oldConnectionId,
        connectionRole: _oldConnectionRole,
        ensembleAccent: _oldEnsembleAccent,
        ...cleanNote
      } = note;
      const section = structure.find((candidate) => (
        note.start >= candidate.startBeat - 1e-6 && note.start < candidate.endBeat - 1e-6
      )) ?? structure.at(-1);
      const contract = contractBySection.get(section?.id);
      if (!contract) return cleanNote;
      const bar = Math.floor(note.start / barBeats);
      const barContract = contract.bars.find((candidate) => candidate.bar === bar);
      const accentBeat = bar * barBeats + finite(barContract?.accent, 0);
      const ensembleAccent = Math.abs(note.start - accentBeat) <= 0.065;
      const phraseRole = barContract?.role ?? "statement";
      const phraseDynamic = {
        statement: 1,
        answer: 0.97,
        development: 1.025,
        turnaround: 1.045,
      }[phraseRole] ?? 1;
      const conversationDynamic = (
        (trackId === "melody" && phraseRole === "statement")
        || (trackId === "counterpoint" && phraseRole === "answer")
        || (trackId === "chords" && phraseRole === "development")
        || (["drums", "bass"].includes(trackId) && phraseRole === "turnaround")
      ) ? 1.035 : 1;
      const sharedDynamic = (0.98 + (contract.energy - 0.5) * 0.06)
        * phraseDynamic
        * conversationDynamic;
      const accentBoost = ensembleAccent
        ? trackId === contract.featuredTrack ? 5 : ["bass", "chords", "drums"].includes(trackId) ? 3 : 1
        : 0;
      return {
        ...cleanNote,
        velocity: adjustVelocity
          ? clamp(Math.round(note.velocity * sharedDynamic + accentBoost), 1, 127)
          : note.velocity,
        connectionId: contract.id,
        connectionRole: contract.role,
        sectionPatternId: `${contract.motifId}:${contract.role}`,
        phraseRole,
        ...(ensembleAccent ? { ensembleAccent: true } : {}),
      };
    }),
  ]));
}

function reconcileRepairedGenerationInterlock(song, config, diagnosis) {
  const interlock = createGenerationInterlockPlan(
    config,
    song.structure,
    song.harmony,
    song.motifs,
    song.songBlueprint,
    song.grooveConductor,
    song.performanceProfile,
    song.compositionRoute,
  );
  interlock.version = 2;
  interlock.reconciliation = {
    phase: 40,
    repairGroup: diagnosis.group,
    source: "actual-repaired-song",
  };
  const source = Object.fromEntries(
    (song.tracks ?? []).map((track) => [track.id, track.notes ?? []]),
  );
  const connected = applyGenerationInterlocks(
    source,
    interlock,
    song.structure,
    config,
    { adjustVelocity: false },
  );
  song.tracks = (song.tracks ?? []).map((track) => ({
    ...track,
    notes: connected[track.id] ?? track.notes ?? [],
  }));
  song.generationInterlock = interlock;
}

function applyPhraseResolutions(
  source,
  structure,
  harmony,
  config,
  songBlueprint,
  rng,
  trackId = "melody",
  generationInterlock = null,
) {
  if (!source?.length) return source ?? [];
  const result = source.map((note) => ({ ...note }));
  const barBeats = beatsPerBar(config);
  for (const section of structure) {
    const plan = blueprintPlanForSection(songBlueprint, section);
    const phraseBars = clamp(
      Math.round(finite(plan?.tensionEnvelope?.phraseBars, config.complexity > 0.68 ? 2 : 4)),
      2,
      4,
    );
    const boundaries = [];
    for (
      let boundary = section.startBeat + phraseBars * barBeats;
      boundary <= section.endBeat + 1e-6;
      boundary += phraseBars * barBeats
    ) {
      boundaries.push(Math.min(section.endBeat, boundary));
    }
    if (!boundaries.some((boundary) => Math.abs(boundary - section.endBeat) < 1e-6)) {
      boundaries.push(section.endBeat);
    }

    for (const boundary of boundaries) {
      const candidates = result
        .filter((note) => (
          note.start < boundary - 0.04
          && note.start >= Math.max(section.startBeat, boundary - barBeats * 1.35)
        ))
        .sort((left, right) => left.start - right.start || left.pitch - right.pitch);
      const landing = candidates.at(-1);
      if (!landing) continue;
      const chord = harmonyAt(harmony, Math.max(section.startBeat, boundary - 0.05));
      if (!chord?.tones?.length) continue;
      const previous = candidates.at(-2);
      const direction = previous ? Math.sign(landing.pitch - previous.pitch) : 0;
      const cadence = plan?.cadence ?? (boundary >= section.endBeat - 1e-6 ? "resolve" : "continue");
      const finalSongLanding = boundary >= config.bars * barBeats - 0.05;
      const forceTonic = finalSongLanding || cadence === "resolve";
      const sectionBoundary = boundary >= section.endBeat - 0.05;
      const contract = generationInterlock?.sectionContracts?.find((candidate) => candidate.sectionId === section.id);
      const contractTones = sectionBoundary ? contract?.harmonicGoalPitchClasses : null;
      const targetChord = forceTonic
        ? { ...chord, tones: [config.keyPc] }
        : Array.isArray(contractTones) && contractTones.length
          ? { ...chord, tones: contractTones }
          : chord;
      const target = nearestChordTone(landing.pitch, targetChord, direction);
      const maximumLeap = trackId === "counterpoint" ? 5 : 7;
      if (Math.abs(target - landing.pitch) <= maximumLeap || forceTonic) {
        landing.pitch = nearestScalePitch(target, config, direction);
      }
      landing.duration = round(clamp(
        Math.max(landing.duration, Math.min(barBeats * 0.55, boundary - landing.start - 0.03)),
        0.08,
        Math.max(0.08, boundary - landing.start - 0.02),
      ));
      landing.velocity = clamp(landing.velocity + (forceTonic ? 6 : 2), 1, 127);
      landing.resolutionRole = forceTonic ? "tonic-landing" : "chord-landing";
      landing.phraseBoundary = round(boundary);
      if (rng.fork(`${trackId}-${section.id}-${boundary}`).bool(trackId === "melody" ? 0.7 : 0.38)) {
        landing.articulationIntent = "tenuto";
      }
    }
  }
  return result;
}

function notesInWindow(track, startBeat, endBeat) {
  return (track?.notes ?? []).filter((note) => (
    note.start >= startBeat - 1e-6 && note.start < endBeat - 1e-6
  ));
}

function genreBassResponseOffsets(genre) {
  if (genre === "house") return [0.5];
  if (["techno", "drumBass"].includes(genre)) return [0, 0.5];
  if (["trap", "hipHop", "rap", "drill"].includes(genre)) return [0, 0.25];
  return [0, 0.25, 0.5, 0.75];
}

function lockFinalBassToSurvivingKicks(sourceTracks, genre, totalBeats) {
  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: track.notes.map((note) => ({ ...note })),
  }));
  const drums = tracks.find((track) => track.id === "drums")?.notes ?? [];
  const bass = tracks.find((track) => track.id === "bass");
  const kicks = drums.filter((note) => note.pitch === 36).map((note) => note.start);
  if (!bass?.notes.length || !kicks.length) return { tracks, repairs: 0 };
  const contextualGenres = new Set(["house", "techno", "trap", "hipHop", "rap", "drill", "drumBass", "neoSoul"]);
  if (!contextualGenres.has(genre)) return { tracks, repairs: 0 };
  const candidates = kicks.flatMap((kick) => genreBassResponseOffsets(genre).map((delay) => round(kick + delay)))
    .filter((start) => start >= 0 && start < totalBeats - 0.019);
  let repairs = 0;
  for (const note of bass.notes) {
    if (candidates.some((start) => Math.abs(start - note.start) < 1e-6)) continue;
    // Cadence and transition contracts deliberately own their exact boundary
    // timing. They take precedence over ordinary rhythm-section correction.
    if (note.ensembleCadenceRole || note.transitionHandoffRole) {
      const delay = genre === "house" ? 0.5 : 0;
      const kickStart = round(note.start - delay);
      if (kickStart >= 0 && !drums.some((drum) => drum.pitch === 36 && Math.abs(drum.start - kickStart) < 1e-6)) {
        drums.push({
          pitch: 36,
          start: kickStart,
          duration: 0.08,
          velocity: clamp(note.velocity + 4, 48, 112),
          rhythmLockRepair: "protected-bass-foundation",
          preserveTiming: true,
          finalMasterRole: "section-body",
        });
        candidates.push(round(kickStart + delay));
        repairs += 1;
      }
      continue;
    }
    const nearest = [...candidates].sort((left, right) => (
      Math.abs(left - note.start) - Math.abs(right - note.start) || left - right
    ))[0];
    if (!Number.isFinite(nearest)) continue;
    note.start = nearest;
    note.duration = round(Math.min(note.duration, Math.max(0.02, totalBeats - nearest)));
    note.rhythmLockRepair = "surviving-kick";
    note.preserveTiming = true;
    repairs += 1;
  }
  bass.notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  drums.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  bass.notes = bass.notes.filter((note, index, notes) => !notes.slice(0, index).some((previous) => (
    previous.pitch === note.pitch && Math.abs(previous.start - note.start) < 1e-6
  )));
  const previousByPitch = new Map();
  for (const note of bass.notes) {
    const previous = previousByPitch.get(note.pitch);
    if (previous && previous.start + previous.duration > note.start) {
      previous.duration = round(Math.max(0.02, note.start - previous.start));
    }
    previousByPitch.set(note.pitch, note);
  }
  return { tracks, repairs };
}

/** Critic 7.0 exposes weak short phrases hidden by a strong song average. */
export function evaluatePhraseWindows(sourceTracks, structure, harmony, config, grooveConductor = null) {
  const tracks = new Map((sourceTracks ?? []).map((track) => [track.id, track]));
  const barBeats = beatsPerBar(config);
  const phraseBars = clamp(Math.round(finite(grooveConductor?.phraseBars, 2)), 2, 4);
  const activeTrackIds = TRACK_IDS.filter((id) => (tracks.get(id)?.notes ?? []).length);
  const profile = GENRE_CRITIC_PROFILES[config.genre] ?? GENRE_CRITIC_PROFILES.pop;
  const windows = [];
  for (const section of structure) {
    const sectionEndBar = section.startBar + section.bars;
    for (let startBar = section.startBar; startBar < sectionEndBar; startBar += phraseBars) {
      const endBar = Math.min(sectionEndBar, startBar + phraseBars);
      const startBeat = startBar * barBeats;
      const endBeat = endBar * barBeats;
      const melody = notesInWindow(tracks.get("melody"), startBeat, endBeat)
        .sort((left, right) => left.start - right.start);
      const counterpoint = notesInWindow(tracks.get("counterpoint"), startBeat, endBeat);
      const bass = notesInWindow(tracks.get("bass"), startBeat, endBeat);
      const drums = notesInWindow(tracks.get("drums"), startBeat, endBeat);
      const kicks = drums.filter((note) => [35, 36].includes(note.pitch));
      const coverage = activeTrackIds.length
        ? activeTrackIds.filter((id) => notesInWindow(tracks.get(id), startBeat, endBeat).length).length / activeTrackIds.length
        : 0.7;
      const melodyFit = clamp(melody.length / Math.max(2, (endBar - startBar) * 4), 0, 1);
      const landing = melody.at(-1);
      const landingChord = landing ? harmonyAt(harmony, landing.start) : null;
      const resolves = Boolean(landing && (
        landingChord?.tones?.includes(mod(landing.pitch, 12))
        || mod(landing.pitch, 12) === config.keyPc
      ));
      const bassResponses = genreBassResponseOffsets(config.genre);
      const bassLock = kicks.length && bass.length
        ? bass.filter((note) => kicks.some((kick) => bassResponses.some((delay) => (
          Math.abs(note.start - kick.start - delay) <= 0.08
        )))).length / bass.length
        : bass.length || kicks.length ? 0.28 : 0.65;
      const collisionRatio = counterpoint.length
        ? counterpoint.filter((note) => melody.some((lead) => Math.abs(lead.start - note.start) < 0.08)).length / counterpoint.length
        : 0;
      const noteCount = activeTrackIds.filter((id) => id !== "drums").reduce(
        (sum, id) => sum + notesInWindow(tracks.get(id), startBeat, endBeat).length,
        0,
      );
      const density = noteCount / Math.max(1, endBar - startBar);
      const densityFit = clamp(1 - Math.abs(density - profile.density) / Math.max(18, profile.density * 1.35), 0, 1);
      const score = clamp(Math.round(
        18 + coverage * 15 + melodyFit * 15 + Number(resolves) * 18
        + bassLock * 20 + (1 - collisionRatio) * 8 + densityFit * 6
      ), 20, 100);
      windows.push({
        id: `${section.id}:${startBar}-${endBar}`,
        sectionId: section.id,
        startBar,
        endBar,
        startBeat: round(startBeat),
        endBeat: round(endBeat),
        score,
        diagnostics: {
          coverage: round(coverage),
          melodyFit: round(melodyFit),
          resolves,
          bassLock: round(bassLock),
          collisionRatio: round(collisionRatio),
          densityFit: round(densityFit),
        },
      });
    }
  }
  return windows;
}

function applyPhraseCritic(sourceTracks, structure, harmony, config, grooveConductor) {
  const tracks = sourceTracks.map((track) => ({
    ...track,
    notes: track.notes.map((note) => ({ ...note })),
  }));
  const windows = evaluatePhraseWindows(tracks, structure, harmony, config, grooveConductor);
  const repairTargets = [...windows]
    .filter((window) => window.score < 82)
    .sort((left, right) => left.score - right.score || left.startBeat - right.startBeat)
    .slice(0, 2);
  const repairs = [];
  const track = (id) => tracks.find((candidate) => candidate.id === id);

  for (const window of repairTargets) {
    const changedTracks = new Set();
    const melody = notesInWindow(track("melody"), window.startBeat, window.endBeat)
      .sort((left, right) => left.start - right.start);
    const landing = melody.at(-1);
    if (landing) {
      const chord = harmonyAt(harmony, landing.start);
      if (chord && !chord.tones.includes(mod(landing.pitch, 12))) {
        landing.pitch = nearestScalePitch(nearestChordTone(landing.pitch, chord), config);
        landing.duration = round(clamp(
          Math.max(landing.duration, 0.35),
          0.08,
          Math.max(0.08, window.endBeat - landing.start),
        ));
        landing.phraseRepair = "resolved-landing";
        changedTracks.add("melody");
      }
    } else {
      const previous = (track("melody")?.notes ?? [])
        .filter((note) => note.start < window.startBeat - 1e-6)
        .sort((left, right) => left.start - right.start)
        .at(-1);
      const chord = harmonyAt(harmony, window.startBeat);
      if (previous && chord) {
        track("melody").notes.push({
          ...previous,
          pitch: nearestScalePitch(nearestChordTone(previous.pitch, chord), config),
          start: round(window.startBeat + Math.min(0.5, (window.endBeat - window.startBeat) / 4)),
          duration: round(Math.min(previous.duration, Math.max(0.2, window.endBeat - window.startBeat - 0.55))),
          velocity: clamp(previous.velocity - 5, 1, 127),
          phraseRepair: "motif-recall",
          memoryRole: "surgical-recall",
        });
        changedTracks.add("melody");
      }
    }

    if (window.diagnostics.bassLock < 0.52) {
      const kick = notesInWindow(track("drums"), window.startBeat, window.endBeat)
        .filter((note) => [35, 36].includes(note.pitch))
        .sort((left, right) => left.start - right.start)[0];
      const bass = notesInWindow(track("bass"), window.startBeat, window.endBeat)
        .filter((note) => !note.preserveTiming && !note.motifHandoffRole)
        .sort((left, right) => left.start - right.start)[0];
      if (kick && bass) {
        const response = genreBassResponseOffsets(config.genre)[0] ?? 0;
        bass.start = round(Math.min(kick.start + response, window.endBeat - 0.02));
        bass.phraseRepair = "kick-bass-lock";
        bass.preserveTiming = true;
        changedTracks.add("bass");
      }
    }

    if (window.diagnostics.collisionRatio > 0.24) {
      const melodyAttacks = notesInWindow(track("melody"), window.startBeat, window.endBeat);
      const counterpoint = notesInWindow(track("counterpoint"), window.startBeat, window.endBeat)
        .sort((left, right) => left.start - right.start);
      const collision = counterpoint.find((note) => (
        melodyAttacks.some((lead) => Math.abs(lead.start - note.start) < 0.08)
      ));
      if (collision && collision.start + 0.25 < window.endBeat - 0.02) {
        collision.start = round(collision.start + 0.25);
        collision.phraseRepair = "counterpoint-breath";
        collision.preserveTiming = true;
        changedTracks.add("counterpoint");
      }
    }

    if (!changedTracks.size && landing) {
      landing.duration = round(clamp(
        Math.max(landing.duration, 0.42),
        0.08,
        Math.max(0.08, window.endBeat - landing.start),
      ));
      landing.velocity = clamp(landing.velocity + 3, 1, 127);
      landing.phraseRepair = "expressive-landing";
      changedTracks.add("melody");
    }

    for (const id of changedTracks) {
      track(id).notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
    }
    if (changedTracks.size) {
      repairs.push({
        windowId: window.id,
        scoreBefore: window.score,
        tracks: [...changedTracks],
        actions: [...changedTracks].map((id) => (
          id === "bass" ? "kick-bass-lock"
            : id === "counterpoint" ? "counterpoint-breath"
              : "phrase-resolution"
        )),
      });
    }
  }

  const rescored = evaluatePhraseWindows(tracks, structure, harmony, config, grooveConductor);
  return {
    tracks,
    report: {
      phase: 41,
      version: 1,
      status: "complete",
      phraseBars: clamp(Math.round(finite(grooveConductor?.phraseBars, 2)), 2, 4),
      analyzedWindows: rescored.length,
      repairedWindows: repairs.length,
      weakestScore: rescored.length ? Math.min(...rescored.map((window) => window.score)) : 100,
      windows: rescored,
      repairs,
    },
  };
}

function compose(config, options = {}) {
  const rootRng = createSeededRandom(config.seed);
  const route = compositionRoute(
    validCompositionRouteId(options.compositionRoute?.id ?? options.compositionRoute)
      ?? candidateCompositionRoute(config.seed, 0),
  );
  const oneShotKit = chooseOneShotKit(config, options.oneShotKit);
  const baseStructure = options.structure
    ?? createStructure(config, rootRng.fork("structure"));
  const style = options.style
    ?? createStyle(config, rootRng.fork("style"));
  const songBlueprint = createSongBlueprint(
    config,
    baseStructure,
    style,
    rootRng.fork("song-blueprint"),
    options.songBlueprint,
  );
  const structure = applySongBlueprint(baseStructure, songBlueprint);
  const spectrumPlan = createSpectrumPlan(config, structure, songBlueprint);
  const performanceProfile = createPerformanceProfile(
    config,
    style,
    rootRng.fork("performance-profile"),
    options.performanceProfile,
  );
  const harmony = createHarmony(
    config,
    structure,
    rootRng.fork("harmony"),
    options.harmonyBlueprint,
    songBlueprint,
  );
  let motifs = options.motifs
    ?? createMotif(config, style, rootRng.fork("motifs"), structure, songBlueprint);
  if (!Array.isArray(motifs.sectionAssignments) || motifs.sectionAssignments.length !== structure.length) {
    motifs.sectionAssignments = assignMotifFamily(structure, songBlueprint);
  }
  motifs = shapeMotifsForCompositionRoute(motifs, route, harmony, config, style);
  const renderedHook = motifs.family?.B?.melody;
  if (renderedHook) {
    const finalHookRefinement = refineWeakHookMotif(
      renderedHook,
      config,
      rootRng.fork("post-route-hook-distinctiveness"),
    );
    motifs.family.B.melody = smoothMotifFlow(finalHookRefinement.motif, "hook");
    motifs.family.B.counterpoint = counterMotifFromMelody(
      motifs.family.B.melody,
      style,
      beatsPerBar(config),
    );
    motifs.family.B.counterpoint = smoothMotifFlow(motifs.family.B.counterpoint, "answer");
    motifs.hookDistinctiveness = finalHookRefinement.report;
  }
  const grooveConductor = createGrooveConductor(
    config,
    structure,
    style,
    motifs,
    rootRng.fork("groove-conductor"),
    route,
  );

  const contextTracks = normalizeContextTracks(options.contextTracks, config);
  const targetTrack = TRACK_DEFINITIONS[options.targetTrack] ? options.targetTrack : null;
  const raw = {};
  raw.drums = generateDrums(
    config,
    structure,
    harmony,
    style,
    config.tracks.drums,
    rootRng.fork("drums-compose"),
    songBlueprint,
    grooveConductor,
  );
  if (targetTrack === "drums" && contextTracks.bass?.length) {
    raw.drums = fitDrumsToRetainedBass(
      raw.drums,
      contextTracks.bass,
      config,
      structure,
      config.tracks.drums,
      rootRng.fork("drums-retained-bass"),
    );
  }
  const retainedDrums = contextNotesForTarget(contextTracks, targetTrack, "drums");
  const drumsForBass = targetTrack === "bass" && retainedDrums ? retainedDrums : raw.drums;
  const drumContext = {
    kickOnsets: drumsForBass.filter((note) => note.pitch === 36).map((note) => note.start).sort((a, b) => a - b),
    snareOnsets: drumsForBass.filter((note) => note.pitch === 38 || note.pitch === 39).map((note) => note.start).sort((a, b) => a - b),
  };
  raw.bass = generateBass(
    config,
    structure,
    harmony,
    style,
    config.tracks.bass,
    rootRng.fork("bass-compose"),
    drumContext,
    targetTrack === "bass" && retainedDrums ? null : grooveConductor,
    songBlueprint,
  );
  raw.chords = generateChords(
    config,
    structure,
    harmony,
    style,
    config.tracks.chords,
    rootRng.fork("chords-compose"),
    grooveConductor,
    songBlueprint,
  );
  raw.melody = generateLead(
    config,
    structure,
    harmony,
    motifs.melody,
    config.tracks.melody,
    rootRng.fork("melody-compose"),
    false,
    songBlueprint,
    motifs,
    grooveConductor,
  );
  const retainedCounterpoint = contextNotesForTarget(contextTracks, targetTrack, "counterpoint");
  if (targetTrack === "melody" && retainedCounterpoint?.length) {
    raw.melody = interlaceCounterpoint(raw.melody, retainedCounterpoint, config, structure, harmony);
  }
  const retainedMelody = contextNotesForTarget(contextTracks, targetTrack, "melody");
  const melodyForCounterpoint = targetTrack === "counterpoint" && retainedMelody?.length
    ? retainedMelody
    : raw.melody;
  raw.counterpoint = interlaceCounterpoint(
    generateLead(
      config,
      structure,
      harmony,
      motifs.counterpoint,
      config.tracks.counterpoint,
      rootRng.fork("counterpoint-compose"),
      true,
      songBlueprint,
      motifs,
      grooveConductor,
    ),
    melodyForCounterpoint,
    config,
    structure,
    harmony,
  );
  raw.pad = generatePad(
    config,
    structure,
    harmony,
    style,
    config.tracks.pad,
    rootRng.fork("pad-compose"),
    songBlueprint,
    grooveConductor,
  );
  const rhythmTurnaround = applyRhythmSectionTurnaroundConversation(raw, harmony, config);

  const totalBeats = round(config.bars * beatsPerBar(config));
  const generationInterlock = createGenerationInterlockPlan(
    config,
    structure,
    harmony,
    motifs,
    songBlueprint,
    grooveConductor,
    performanceProfile,
    route,
  );
  const connected = applyGenerationInterlocks(rhythmTurnaround.tracks, generationInterlock, structure, config);
  const orchestrated = applyOrchestrationMatrix(
    connected,
    structure,
    songBlueprint,
    config,
    rootRng.fork("phase-7-orchestration"),
  );
  const remembered = applyMusicalMemory(
    orchestrated,
    structure,
    harmony,
    songBlueprint,
    motifs.melody?.lengthBeats,
    totalBeats,
  );
  const motifHandoff = applyFeaturedMotifHandoffs(
    remembered,
    structure,
    songBlueprint,
    motifs.melody?.lengthBeats,
    totalBeats,
    config,
  );
  const transitioned = applyCoordinatedTransitions(motifHandoff.tracks, structure, songBlueprint);
  const resolved = {
    ...transitioned,
    melody: applyPhraseResolutions(
      transitioned.melody,
      structure,
      harmony,
      config,
      songBlueprint,
      rootRng.fork("melody-resolutions"),
      "melody",
      generationInterlock,
    ),
    counterpoint: applyPhraseResolutions(
      transitioned.counterpoint,
      structure,
      harmony,
      config,
      songBlueprint,
      rootRng.fork("counterpoint-resolutions"),
      "counterpoint",
      generationInterlock,
    ),
  };
  // Phrase-resolution notes are composed after the first ensemble pass. Route
  // the complete result through the contracts once more without reapplying
  // dynamics so every final note carries the same section and phrase identity.
  const reconnected = applyGenerationInterlocks(
    resolved,
    generationInterlock,
    structure,
    config,
    { adjustVelocity: false },
  );
  const renderedTracks = TRACK_IDS.map((id) => {
    const evolved = applyGradualEvolution(reconnected[id], id, config, structure, rootRng.fork(`${id}-evolution`));
    const feltNotes = finalizeNotes(
      evolved,
      config,
      config.tracks[id],
      rootRng.fork(`${id}-feel`),
      id,
      performanceProfile,
    );
    const notes = articulatePerformance(
      feltNotes,
      id,
      config,
      rootRng.fork(`${id}-articulation`),
    );
    const automation = createPerformanceAutomation(
      id,
      notes,
      config,
      structure,
      config.tracks[id],
      rootRng.fork(`${id}-expression`),
      songBlueprint,
    );
    return makeTrack(id, config.tracks[id], notes, automation);
  });
  const phrasePolish = applyPhraseCritic(
    renderedTracks,
    structure,
    harmony,
    config,
    grooveConductor,
  );
  const produced = runProducerPass(phrasePolish.tracks, structure, songBlueprint);
  const perceptualMix = runPerceptualMixPass(produced.tracks, structure);
  produced.tracks = perceptualMix.tracks;
  produced.report.metrics.perceptualMaskingPairs = perceptualMix.report.maskingPairs;
  produced.report.metrics.perceptualDynamicRange = perceptualMix.report.dynamicRange;
  const producedById = Object.fromEntries(
    produced.tracks.map((track) => [track.id, track.notes]),
  );
  const producedConnected = applyGenerationInterlocks(
    producedById,
    generationInterlock,
    structure,
    config,
    { adjustVelocity: false },
  );
  produced.tracks = produced.tracks.map((track) => ({
    ...track,
    notes: producedConnected[track.id] ?? track.notes,
  }));
  const spectral = applySpectrumPlan(produced.tracks, structure, spectrumPlan, config);
  spectrumPlan.metrics = spectral.metrics;
  produced.report.metrics.spectralSpan = spectral.metrics.span;
  const scaleSafety = enforceScaleSafety(spectral.tracks, config);
  produced.report.repairs.scaleCorrections = scaleSafety.corrections;
  produced.report.repairs.scaleCorrectionsByTrack = scaleSafety.correctionsByTrack;
  produced.report.metrics.scaleFit = scaleSafety.scaleFit;
  produced.report.checks.scaleSafety = scaleSafety.passed;
  const creativePolish = runCreativePolishPasses(
    scaleSafety.tracks,
    structure,
    harmony,
    songBlueprint,
    config,
  );
  const melodicFlow = shapeRenderedMelodicFlow(creativePolish.tracks, structure);
  const finalAssemblyRepair = runFinalAssemblyPass(
    melodicFlow.tracks,
    scaleSafety.tracks,
    structure,
    songBlueprint,
  );
  const finalMaster = runFinalMasterPass(finalAssemblyRepair.tracks, structure, songBlueprint, config);
  const finalScaleSafety = enforceScaleSafety(finalMaster.tracks, config);
  const finalRhythmLock = lockFinalBassToSurvivingKicks(finalScaleSafety.tracks, config.genre, totalBeats);
  const characteristicVoice = applyCharacteristicVoice(finalRhythmLock.tracks, structure, config);
  const tracks = characteristicVoice.tracks;
  finalMaster.report.metrics.noteCount = tracks.reduce((sum, track) => sum + track.notes.length, 0);
  finalMaster.report.repairs.finalRhythmLock = finalRhythmLock.repairs;
  const finalAssembly = createFinalAssemblyReport(
    tracks,
    structure,
    songBlueprint,
    finalAssemblyRepair.repairs,
  );
  const sectionContrast = createSectionContrastReport(
    tracks,
    structure,
    songBlueprint.orchestrationMatrix,
  );
  const drumFillVocabulary = createDrumFillVocabularyReport(tracks, config.genre);
  const rhythmTurnaroundConversation = createRhythmTurnaroundReport(tracks);
  const identity = `${config.seed}|${config.genre}|${config.key}|${config.scale}|${config.bars}|${options.generation ?? "new"}|${options.revision ?? 0}`;
  const idea = createIdeaAnalysis(
    config,
    structure,
    harmony,
    style,
    tracks,
    oneShotKit,
    songBlueprint,
    performanceProfile,
  );
  idea.rhythmicFeatures.push(`${route.label} composition route`);
  return {
    schema: "midi-arcade/song@1",
    id: `song-${hashSeed(identity).toString(36)}`,
    parentId: options.parentId ?? null,
    generation: options.generation ?? "new",
    revision: options.revision ?? 0,
    seed: config.seed,
    title: titleFor(config, rootRng.fork("title")),
    genre: config.genre,
    bpm: config.tempo,
    key: config.key,
    mode: config.scale,
    bars: config.bars,
    ppq: PPQ,
    meta: {
      tempo: config.tempo,
      genre: config.genre,
      genreLabel: config.genreLabel ?? GENRE_PROFILES[config.genre]?.label ?? config.genre,
      secondaryGenre: config.secondaryGenre ?? null,
      fusionBlend: config.fusionBlend ?? 0.5,
      isFusion: Boolean(config.isFusion),
      key: config.key,
      keyPc: config.keyPc,
      scale: config.scale,
      scaleIntervals: [...config.scaleIntervals],
      timeSignature: [...config.timeSignature],
      bars: config.bars,
      beatsPerBar: beatsPerBar(config),
      totalBeats,
      ppq: PPQ,
    },
    settings: publicSettings(config),
    sections: structure,
    structure,
    harmony,
    style,
    motifs,
    compositionRoute: route,
    grooveConductor,
    phraseCritic: phrasePolish.report,
    perceptualMix: perceptualMix.report,
    voiceLeading: creativePolish.voiceLeading,
    melodicFlow: melodicFlow.report,
    pocketCohesion: creativePolish.pocketCohesion,
    negativeSpace: creativePolish.negativeSpace,
    vocalSpace: creativePolish.vocalSpace,
    ensembleCadence: creativePolish.ensembleCadence,
    transitionHandoff: creativePolish.transitionHandoff,
    sectionContrast,
    drumFillVocabulary,
    rhythmTurnaroundConversation,
    characteristicVoice: characteristicVoice.report,
    finalRhythmLock: { status: "complete", repairs: finalRhythmLock.repairs },
    motifHandoff: motifHandoff.report,
    hookDistinctiveness: motifs.hookDistinctiveness,
    finalMaster: finalMaster.report,
    finalAssembly,
    spectrumPlan,
    generationInterlock,
    tracks,
    oneShotKit: publicOneShotKit(oneShotKit),
    songBlueprint,
    performanceProfile,
    arrangementTransitions: clone(songBlueprint.transitions),
    orchestrationMatrix: clone(songBlueprint.orchestrationMatrix),
    memoryMap: clone(songBlueprint.memoryMap),
    producerPass: produced.report,
    generationPhases: [
      { phase: 7, id: "dynamic-orchestration", status: "complete" },
      { phase: 8, id: "musical-memory", status: "complete" },
      { phase: 9, id: "producer-pass", status: "awaiting-critic" },
      { phase: 39, id: "generation-interlocks", status: "complete" },
      { phase: 41, id: "phrase-critic-surgical-repair", status: "complete" },
      { phase: 42, id: "perceptual-mix-critic", status: "complete" },
      { phase: 44, id: "performance-phrasing", status: "complete" },
      { phase: 46, id: "harmonic-voice-leading", status: "complete" },
      { phase: 47, id: "ensemble-pocket-cohesion", status: "complete" },
      { phase: 48, id: "arrangement-negative-space", status: "complete" },
      { phase: 51, id: "vocal-space-composition", status: "complete" },
      { phase: 52, id: "final-output-master", status: "complete" },
      { phase: 66, id: "ensemble-cadence-contract", status: "complete" },
      { phase: 67, id: "transition-handoff-contract", status: "complete" },
      { phase: 68, id: "section-contrast-role-rotation", status: "complete" },
      { phase: 69, id: "cross-instrument-motif-handoff", status: "complete" },
      { phase: 70, id: "hook-distinctiveness-guard", status: "complete" },
      { phase: 71, id: "genre-native-drum-fill-vocabulary", status: "complete" },
      { phase: 72, id: "rhythm-section-turnaround-conversation", status: "complete" },
      { phase: 75, id: "final-song-assembly-contract", status: finalAssembly.status },
    ],
    idea,
  };
}

function average(values, fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function onsetMatchRatio(notes, targets, offsets, tolerance = 0.06) {
  if (!notes.length || !targets.length) return 0;
  const matched = notes.filter((note) => targets.some((target) => offsets.some((offset) => (
    Math.abs(note.start - target.start - offset) <= tolerance
  )))).length;
  return matched / notes.length;
}

function phraseRepetition(song, melodyNotes) {
  const length = finite(song.motifs?.melody?.lengthBeats, 0);
  if (length <= 0 || melodyNotes.length < 4) return 0.55;
  const signatures = [];
  for (const section of song.structure ?? []) {
    const repeats = Math.min(4, Math.floor((section.endBeat - section.startBeat) / length));
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const start = section.startBeat + repeat * length;
      const notes = melodyNotes.filter((note) => note.start >= start - 1e-6 && note.start < start + length - 1e-6);
      if (notes.length < 2) continue;
      signatures.push(new Set(notes.map((note) => `${Math.round((note.start - start) * 4) / 4}`)));
    }
  }
  if (signatures.length < 2) return 0.55;
  const reference = signatures[0];
  return average(signatures.slice(1).map((signature) => {
    const shared = [...reference].filter((item) => signature.has(item)).length;
    return shared / Math.max(1, Math.min(reference.size, signature.size));
  }), 0.55);
}

function actualSectionEnergy(song, section) {
  const notes = song.tracks.flatMap((track) => (
    track.notes ?? []
  )).filter((note) => note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6);
  const bars = Math.max(1, section.bars);
  const density = clamp(notes.length / bars / 32, 0, 1);
  const velocity = average(notes.map((note) => finite(note.velocity, 80) / 127), 0.4);
  return density * 0.54 + velocity * 0.46;
}

function blueprintArcScore(song) {
  const plans = song.songBlueprint?.sectionPlans ?? [];
  if (plans.length < 2 || !Array.isArray(song.structure)) return 75;
  const points = plans.map((plan) => {
    const section = song.structure.find((candidate) => candidate.id === plan.sectionId);
    return section ? { planned: plan.energy, actual: actualSectionEnergy(song, section) } : null;
  }).filter(Boolean);
  if (points.length < 2) return 75;
  let comparable = 0;
  let aligned = 0;
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      const plannedDelta = points[right].planned - points[left].planned;
      if (Math.abs(plannedDelta) < 0.045) continue;
      comparable += 1;
      const actualDelta = points[right].actual - points[left].actual;
      if (Math.sign(actualDelta) === Math.sign(plannedDelta) || Math.abs(actualDelta) < 0.025) aligned += 1;
    }
  }
  const agreement = comparable ? aligned / comparable : 0.72;
  const plannedContrast = Math.max(...points.map((point) => point.planned)) - Math.min(...points.map((point) => point.planned));
  const actualContrast = Math.max(...points.map((point) => point.actual)) - Math.min(...points.map((point) => point.actual));
  const contrastFit = clamp(1 - Math.abs(actualContrast - plannedContrast * 0.52) / 0.55, 0, 1);
  return clamp(Math.round(54 + agreement * 34 + contrastFit * 12), 35, 100);
}

function cadenceScoreForSong(song) {
  const harmony = Array.isArray(song.harmony) ? song.harmony : [];
  const plans = song.songBlueprint?.sectionPlans ?? [];
  if (!harmony.length || !plans.length) return 72;
  const results = [];
  for (const plan of plans) {
    const section = song.structure?.find((candidate) => candidate.id === plan.sectionId);
    if (!section || plan.cadence === "open") continue;
    const ending = harmonyAt(harmony, Math.max(section.startBeat, section.endBeat - 0.05));
    if (!ending) continue;
    const expected = plan.cadence === "resolve" ? [0] : plan.cadence === "lift" ? [4] : [3, 5];
    results.push(expected.includes(mod(ending.degree, 7)) ? 1 : 0);
  }
  return clamp(Math.round(50 + average(results, 0.55) * 50), 40, 100);
}

function transitionScoreForSong(song) {
  const transitions = song.arrangementTransitions ?? song.songBlueprint?.transitions ?? [];
  if (!transitions.length) return 72;
  const allNotes = song.tracks?.flatMap((track) => track.notes ?? []) ?? [];
  const results = transitions.map((transition) => {
    const from = song.structure?.find((section) => section.id === transition.fromSectionId);
    if (!from) return 0.55;
    const boundary = from.endBeat;
    const pickup = clamp(finite(transition.pickupBeats, 0.5), 0.25, 2);
    const marked = allNotes.filter((note) => (
      note.transitionFeature === transition.type
      && note.start >= boundary - pickup - 0.08
      && note.start <= boundary + 0.08
    )).length;
    if (transition.type === "drop-out") {
      const before = allNotes.filter((note) => note.start >= boundary - pickup * 2 && note.start < boundary - pickup).length;
      const gap = allNotes.filter((note) => note.start >= boundary - pickup && note.start < boundary).length;
      return clamp(0.58 + (1 - gap / Math.max(1, before)) * 0.42, 0, 1);
    }
    const incomingHit = allNotes.some((note) => (
      note.start >= boundary - 0.04
      && note.start <= boundary + 0.08
      && (note.pitch === 49 || note.velocity >= 92)
    ));
    return clamp(0.54 + Math.min(0.28, marked * 0.09) + (incomingHit ? 0.18 : 0), 0, 1);
  });
  return clamp(Math.round(42 + average(results, 0.62) * 58), 35, 100);
}

function harmonicJourneyScoreForSong(song) {
  const plans = song.songBlueprint?.sectionPlans ?? [];
  if (!plans.length || !song.harmony?.length) return 72;
  const matches = [];
  const roles = new Set();
  for (const plan of plans) {
    const section = song.structure?.find((candidate) => candidate.id === plan.sectionId);
    if (!section) continue;
    roles.add(plan.harmonicRole);
    const events = song.harmony.filter((event) => (
      event.start >= section.startBeat - 1e-6 && event.start < section.endBeat - 1e-6
    ));
    if (!events.length) continue;
    const first = events[0];
    const last = events[events.length - 1];
    if (Number.isFinite(plan.harmonicStartDegree)) {
      matches.push(mod(first.degree, 7) === mod(plan.harmonicStartDegree, 7) ? 1 : 0.35);
    }
    if (plan.cadence !== "open" && Number.isFinite(plan.harmonicGoalDegree)) {
      matches.push(mod(last.degree, 7) === mod(plan.harmonicGoalDegree, 7) ? 1 : 0.25);
    }
  }
  const roleVariety = clamp(roles.size / Math.min(4, Math.max(1, plans.length)), 0, 1);
  return clamp(Math.round(45 + average(matches, 0.58) * 43 + roleVariety * 12), 35, 100);
}

function performanceScoreForSong(song) {
  const profile = song.performanceProfile;
  if (!profile?.feel?.id) return 68;
  const pitched = song.tracks?.filter((track) => track.id !== "drums").flatMap((track) => track.notes ?? []) ?? [];
  const velocities = pitched.map((note) => finite(note.velocity, 80));
  const mean = average(velocities, 80);
  const variance = average(velocities.map((velocity) => (velocity - mean) ** 2), 0);
  const spread = Math.sqrt(variance);
  const target = 10 + finite(profile.velocityVariance, 5) * 1.2;
  const dynamicFit = clamp(1 - Math.abs(spread - target) / 24, 0, 1);
  const safeTiming = finite(profile.timingJitter, 0) <= 0.04
    && Object.values(profile.trackOffsets ?? {}).every((offset) => Math.abs(finite(offset, 0)) <= 0.05);
  return clamp(Math.round(52 + dynamicFit * 38 + (safeTiming ? 10 : 0)), 35, 100);
}

function orchestrationScoreForSong(song) {
  const matrix = song.orchestrationMatrix ?? song.songBlueprint?.orchestrationMatrix ?? [];
  if (!matrix.length) return 68;
  const results = [];
  for (const entry of matrix) {
    const section = song.structure?.find((candidate) => candidate.id === entry.sectionId);
    if (!section) continue;
    for (const [id, lane] of Object.entries(entry.lanes ?? {})) {
      const track = song.tracks?.find((candidate) => candidate.id === id);
      if (!track || track.settings?.density <= 0.001) continue;
      const count = (track.notes ?? []).filter((note) => (
        note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6
      )).length;
      if (lane.presence >= 0.55) results.push(count > 0 ? 1 : 0);
      if (id === entry.featuredTrack) results.push(count >= Math.max(1, Math.floor(section.bars / 2)) ? 1 : 0.4);
    }
  }
  const featuredRoles = song.tracks?.flatMap((track) => track.notes ?? [])
    .filter((note) => note.orchestrationRole === "feature").length ?? 0;
  return clamp(Math.round(48 + average(results, 0.58) * 44 + (featuredRoles ? 8 : 0)), 35, 100);
}

function memoryScoreForSong(song) {
  const memoryMap = song.memoryMap ?? song.songBlueprint?.memoryMap ?? [];
  const developed = memoryMap.filter((entry) => entry.relationship !== "introduction" && entry.relationship !== "statement");
  if (!developed.length) return 72;
  const memoryTracks = ["melody", "bass", "counterpoint"].map((id) => (
    song.tracks?.find((track) => track.id === id)?.notes ?? []
  ));
  const results = developed.map((entry) => {
    const section = song.structure?.find((candidate) => candidate.id === entry.sectionId);
    if (!section) return 0;
    const recalledTracks = memoryTracks.map((notes) => notes.some((note) => (
      note.memoryRole === entry.relationship
      && note.memoryOriginSectionId === entry.originSectionId
      && note.start >= section.startBeat - 1e-6
      && note.start < section.endBeat - 1e-6
    )));
    const ensembleRecall = recalledTracks.filter(Boolean).length / recalledTracks.length;
    return entry.relationship === "contrast"
      ? recalledTracks[0] ? 1 : 0.5
      : clamp(ensembleRecall, 0, 1);
  });
  return clamp(Math.round(45 + average(results, 0.55) * 55), 35, 100);
}

function productionScoreForSong(song) {
  const report = song.producerPass;
  if (!report || report.phase !== 9) return 62;
  const checks = Object.values(report.checks ?? {});
  const checkFit = average(checks.map((value) => value ? 1 : 0), 0.5);
  const headroom = finite(report.metrics?.headroom, 0);
  const headroomFit = clamp(headroom / 7, 0, 1);
  const coverage = clamp(finite(report.metrics?.featuredSectionCoverage, 0.5), 0, 1);
  return clamp(Math.round(42 + checkFit * 30 + headroomFit * 12 + coverage * 16), 30, 100);
}

function phraseResolutionScoreForSong(song, melodyNotes) {
  const sections = song.structure ?? song.sections ?? [];
  if (!melodyNotes.length || !sections.length) return 68;
  const tonic = finite(song.meta?.keyPc, 0);
  const endings = sections.map((section) => {
    const end = finite(section.endBeat, 0);
    const phraseNotes = melodyNotes.filter((note) => note.start < end - 0.01 && note.start >= end - finite(song.meta?.beatsPerBar, 4) * 1.25);
    const finalNote = phraseNotes.at(-1);
    if (!finalNote) return 0.55;
    const chord = harmonyAt(song.harmony ?? [], finalNote.start);
    const pitchClass = mod(finalNote.pitch, 12);
    const chordTone = chord?.tones?.includes(pitchClass);
    const tonicLanding = pitchClass === tonic;
    const held = finalNote.duration >= finite(song.meta?.beatsPerBar, 4) * 0.35;
    return clamp(0.38 + Number(chordTone) * 0.32 + Number(tonicLanding) * 0.18 + Number(held) * 0.12, 0, 1);
  });
  return clamp(Math.round(average(endings, 0.68) * 100), 25, 100);
}

function correlation(left, right) {
  if (left.length < 2 || left.length !== right.length) return 0;
  const leftMean = average(left, 0);
  const rightMean = average(right, 0);
  let numerator = 0;
  let leftPower = 0;
  let rightPower = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] - leftMean;
    const b = right[index] - rightMean;
    numerator += a * b;
    leftPower += a * a;
    rightPower += b * b;
  }
  return numerator / Math.max(1e-7, Math.sqrt(leftPower * rightPower));
}

function tensionFollowScoreForSong(song) {
  const sections = song.structure ?? song.sections ?? [];
  if (sections.length < 2) return 70;
  const pitched = song.tracks.filter((track) => track.id !== "drums").flatMap((track) => track.notes ?? []);
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  const tension = [];
  const activity = [];
  for (const section of sections) {
    const start = finite(section.startBeat, 0);
    const end = finite(section.endBeat, start + 1);
    const sectionPitched = pitched.filter((note) => note.start >= start && note.start < end);
    const sectionDrums = drums.filter((note) => note.start >= start && note.start < end);
    tension.push(clamp(finite(section.plannedTension ?? section.tension ?? section.energy, 0.5), 0, 1));
    activity.push(
      sectionPitched.length / Math.max(1, end - start) * 0.46
      + average(sectionPitched.map((note) => note.velocity / 127), 0.5) * 0.3
      + sectionDrums.length / Math.max(1, end - start) * 0.24,
    );
  }
  const fit = clamp((correlation(tension, activity) + 1) / 2, 0, 1);
  return clamp(Math.round(38 + fit * 62), 30, 100);
}

function drumVarietyScoreForSong(song, drumNotes) {
  const barBeats = finite(song.meta?.beatsPerBar, 4);
  const bars = Math.max(1, Math.round(finite(song.meta?.bars, song.bars ?? 1)));
  const signatures = Array.from({ length: bars }, (_, bar) => drumNotes
    .filter((note) => Math.floor(note.start / barBeats) === bar)
    .map((note) => `${note.pitch}:${round(mod(note.start, barBeats))}`)
    .join("|"));
  const populated = signatures.filter(Boolean);
  if (populated.length < 2) return 58;
  const uniqueRatio = new Set(populated).size / populated.length;
  const adjacentCopies = populated.slice(1).filter((signature, index) => signature === populated[index]).length / Math.max(1, populated.length - 1);
  const usefulVariation = 1 - Math.abs(uniqueRatio - 0.58) / 0.58;
  return clamp(Math.round(48 + clamp(usefulVariation, 0, 1) * 34 + (1 - adjacentCopies) * 18), 25, 100);
}

function registerFatigueScoreForSong(melodyNotes) {
  if (melodyNotes.length < 4) return 68;
  const octaves = melodyNotes.map((note) => Math.floor(note.pitch / 12));
  let longest = 1;
  let run = 1;
  for (let index = 1; index < octaves.length; index += 1) {
    run = octaves[index] === octaves[index - 1] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const pitches = melodyNotes.map((note) => note.pitch);
  const span = Math.max(...pitches) - Math.min(...pitches);
  const runFit = 1 - clamp((longest - 6) / 18, 0, 1);
  const spanFit = clamp(span / 16, 0.35, 1);
  return clamp(Math.round(38 + runFit * 38 + spanFit * 24), 30, 100);
}

function generationInterlockScoreForSong(song) {
  const interlock = song.generationInterlock;
  const contracts = interlock?.sectionContracts ?? [];
  const stages = interlock?.stages ?? [];
  if (!contracts.length || !stages.length) return 55;

  const tracks = song.tracks ?? [];
  const notes = tracks.flatMap((track) => (
    (track.notes ?? []).map((note) => ({ ...note, trackId: track.id }))
  ));
  const taggedCoverage = notes.length
    ? notes.filter((note) => note.connectionId).length / notes.length
    : 0;
  const sectionCoverage = average(contracts.map((contract) => {
    const participants = new Set(notes
      .filter((note) => note.connectionId === contract.id)
      .map((note) => note.trackId));
    return clamp(participants.size / 4, 0, 1);
  }), 0);

  const accentGroups = new Map();
  for (const note of notes.filter((candidate) => candidate.ensembleAccent)) {
    const bar = Math.floor(note.start / finite(song.meta?.beatsPerBar, 4));
    if (!accentGroups.has(bar)) accentGroups.set(bar, new Set());
    accentGroups.get(bar).add(note.trackId);
  }
  const accentCooperation = average(
    [...accentGroups.values()].map((participants) => clamp(participants.size / 2, 0, 1)),
    0.45,
  );

  const landingFit = average(contracts.map((contract) => {
    const section = song.structure?.find((candidate) => candidate.id === contract.sectionId);
    if (!section) return 0;
    const landings = notes.filter((note) => (
      ["melody", "counterpoint"].includes(note.trackId)
      && note.connectionId === contract.id
      && note.resolutionRole
      && note.start >= section.endBeat - finite(song.meta?.beatsPerBar, 4) * 1.35
    ));
    if (!landings.length) return 0.55;
    const goals = new Set(contract.harmonicGoalPitchClasses ?? []);
    return landings.some((note) => goals.has(mod(note.pitch, 12))) ? 1 : 0.35;
  }), 0.55);
  const stageContract = stages.length >= 8
    && stages.slice(1).every((stage) => stage.receives?.length && stage.publishes?.length)
    ? 1
    : 0.45;

  return clamp(Math.round(
    taggedCoverage * 28
    + sectionCoverage * 24
    + accentCooperation * 18
    + landingFit * 20
    + stageContract * 10
  ), 20, 100);
}

/**
 * Critic 6.0 evaluates musical correctness and whether a candidate fulfills
 * the shared song blueprint. It rewards intentional repetition, clean
 * interaction between parts, voice leading, cadences, section contrast,
 * coordinated transitions, harmonic storytelling, controlled performance,
 * purposeful orchestration, memorable returns, connected generation stages,
 * and production readiness.
 */
export function evaluateSongCandidate(song) {
  const fallback = {
    harmonic: 70,
    groove: 70,
    motif: 70,
    storyArc: 70,
    density: 70,
    voiceLeading: 70,
    separation: 70,
    cadence: 70,
    repetition: 70,
    transitions: 70,
    harmonicJourney: 70,
    performance: 70,
    orchestration: 70,
    memory: 70,
    production: 70,
    phraseResolution: 70,
    tensionFollow: 70,
    drumVariety: 70,
    registerHealth: 70,
    stageInterlock: 70,
    genreAuthenticity: 70,
  };
  if (!song || !Array.isArray(song.tracks) || !song.meta) {
    return { version: 6, score: 70, subscores: fallback };
  }

  const track = (id) => song.tracks.find((candidate) => candidate.id === id) ?? { notes: [] };
  const pitchedNotes = song.tracks.filter((candidate) => candidate.id !== "drums").flatMap((candidate) => candidate.notes ?? []);
  const melodyNotes = [...(track("melody").notes ?? [])].sort((a, b) => a.start - b.start);
  const counterNotes = [...(track("counterpoint").notes ?? [])].sort((a, b) => a.start - b.start);
  const chordNotes = [...(track("chords").notes ?? [])].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const bassNotes = [...(track("bass").notes ?? [])].sort((a, b) => a.start - b.start);
  const drumNotes = track("drums").notes ?? [];
  const kicks = drumNotes.filter((note) => note.pitch === 35 || note.pitch === 36);
  const snares = drumNotes.filter((note) => [37, 38, 39, 40].includes(note.pitch));
  const barBeats = finite(song.meta.beatsPerBar, 4);
  const bars = Math.max(1, finite(song.meta.bars, song.bars ?? 1));
  const criticProfile = GENRE_CRITIC_PROFILES[song.genre] ?? GENRE_CRITIC_PROFILES.pop;

  const scalePc = new Set((song.meta.scaleIntervals ?? []).map((interval) => mod(interval + finite(song.meta.keyPc, 0), 12)));
  const scaleFit = pitchedNotes.length
    ? pitchedNotes.filter((note) => !scalePc.size || scalePc.has(mod(note.pitch, 12))).length / pitchedNotes.length
    : 0.7;
  const strongMelody = melodyNotes.filter((note) => Math.abs(note.start - Math.round(note.start)) < 0.055);
  const chordAnchors = strongMelody.filter((note) => {
    const chord = harmonyAt(song.harmony ?? [], note.start);
    return chord?.tones?.includes(mod(note.pitch, 12));
  }).length / Math.max(1, strongMelody.length);
  const harmonic = clamp(Math.round(scaleFit * 62 + chordAnchors * 38), 20, 100);

  const downbeatCoverage = kicks.length
    ? new Set(kicks.filter((note) => Math.abs(mod(note.start, barBeats)) < 0.08).map((note) => Math.floor(note.start / barBeats))).size / bars
    : 0;
  const expectedBackbeats = bars * criticProfile.backbeats;
  const backbeatCoverage = clamp(snares.length / Math.max(1, expectedBackbeats), 0, 1);
  const grooveOffsets = song.genre === "house"
    ? [0.5]
    : ["trap", "drill"].includes(song.genre)
      ? [0, 0.25]
      : song.genre === "techno"
        ? [0, 0.5]
        : [0, 0.25, 0.5, 0.75];
  const bassLock = onsetMatchRatio(bassNotes, kicks, grooveOffsets, 0.075);
  const groove = clamp(Math.round(42 + downbeatCoverage * 16 + backbeatCoverage * 18 + bassLock * 24), 25, 100);

  const melodicIntervals = melodyNotes.slice(1).map((note, index) => Math.abs(note.pitch - melodyNotes[index].pitch));
  const controlledMotion = melodicIntervals.length
    ? melodicIntervals.filter((interval) => interval <= 12).length / melodicIntervals.length
    : 0.65;
  const repetitionRatio = phraseRepetition(song, melodyNotes);
  const repetitionTarget = average([
    finite(song.songBlueprint?.qualityTargets?.repetition, criticProfile.repetition),
    criticProfile.repetition,
  ], criticProfile.repetition);
  const repetition = clamp(Math.round(100 - Math.abs(repetitionRatio - repetitionTarget) * 125), 30, 100);
  const motif = clamp(Math.round(controlledMotion * 56 + repetition * 0.44), 25, 100);

  const storyArc = blueprintArcScore(song);
  const notesPerBar = pitchedNotes.length / bars;
  const densityTarget = criticProfile.density;
  const density = clamp(Math.round(100 - Math.abs(notesPerBar - densityTarget) / Math.max(10, densityTarget) * 42), 35, 100);

  const chordGroups = new Map();
  for (const note of chordNotes) {
    const key = round(note.start);
    if (!chordGroups.has(key)) chordGroups.set(key, []);
    chordGroups.get(key).push(note.pitch);
  }
  const voicings = [...chordGroups.values()];
  const chordMoves = voicings.slice(1).map((voicing, index) => average(voicing.map((pitch) => (
    Math.min(...voicings[index].map((previousPitch) => Math.abs(pitch - previousPitch)))
  )), 12));
  const chordMotionFit = chordMoves.length ? chordMoves.filter((movement) => movement <= 7).length / chordMoves.length : 0.72;
  const voiceLeading = clamp(Math.round(chordMotionFit * 62 + controlledMotion * 38), 25, 100);

  const attackCollisions = counterNotes.filter((note) => melodyNotes.some((lead) => Math.abs(lead.start - note.start) < 0.12)).length;
  const dissonantOverlaps = counterNotes.filter((note) => melodyNotes.some((lead) => {
    if (note.start >= lead.start + lead.duration || lead.start >= note.start + note.duration) return false;
    return [0, 1, 6, 11].includes(mod(Math.abs(note.pitch - lead.pitch), 12));
  })).length;
  const collisionRatio = (attackCollisions + dissonantOverlaps) / Math.max(1, counterNotes.length * 2);
  const separation = clamp(Math.round(100 - collisionRatio * 150), 20, 100);
  const cadence = cadenceScoreForSong(song);
  const transitions = transitionScoreForSong(song);
  const harmonicJourney = harmonicJourneyScoreForSong(song);
  const performance = performanceScoreForSong(song);
  const orchestration = orchestrationScoreForSong(song);
  const memory = memoryScoreForSong(song);
  const production = productionScoreForSong(song);
  const phraseResolution = phraseResolutionScoreForSong(song, melodyNotes);
  const tensionFollow = tensionFollowScoreForSong(song);
  const drumVariety = drumVarietyScoreForSong(song, drumNotes);
  const registerHealth = registerFatigueScoreForSong(melodyNotes);
  const stageInterlock = generationInterlockScoreForSong(song);
  const rhythmicNotes = [...drumNotes, ...bassNotes, ...melodyNotes];
  const measuredSyncopation = rhythmicNotes.length
    ? rhythmicNotes.filter((note) => Math.abs(note.start - Math.round(note.start)) > 0.08).length / rhythmicNotes.length
    : criticProfile.syncopation;
  const syncopationFit = clamp(
    Math.round(100 - Math.abs(measuredSyncopation - criticProfile.syncopation) * 135),
    25,
    100,
  );
  const bassLockFit = clamp(
    Math.round(bassLock / Math.max(0.1, criticProfile.bassLock) * 100),
    25,
    100,
  );
  const genreAuthenticity = clamp(Math.round(
    density * 0.2
    + repetition * 0.2
    + syncopationFit * 0.25
    + backbeatCoverage * 100 * 0.15
    + bassLockFit * 0.2
  ), 20, 100);

  const subscores = {
    harmonic,
    groove,
    motif,
    storyArc,
    density,
    voiceLeading,
    separation,
    cadence,
    repetition,
    transitions,
    harmonicJourney,
    performance,
    orchestration,
    memory,
    production,
    phraseResolution,
    tensionFollow,
    drumVariety,
    registerHealth,
    stageInterlock,
    genreAuthenticity,
  };
  const score = Math.round(
    harmonic * 0.08
    + groove * 0.08
    + motif * 0.07
    + storyArc * 0.03
    + density * 0.02
    + voiceLeading * 0.05
    + separation * 0.04
    + cadence * 0.04
    + repetition * 0.03
    + transitions * 0.05
    + harmonicJourney * 0.04
    + performance * 0.04
    + orchestration * 0.04
    + memory * 0.04
    + production * 0.02
    + phraseResolution * 0.07
    + tensionFollow * 0.06
    + drumVariety * 0.04
    + registerHealth * 0.05
    + stageInterlock * 0.05
    + genreAuthenticity * 0.06
  );
  return {
    version: 6,
    score: clamp(score, 0, 100),
    subscores,
    diagnostics: {
      scaleFit: round(scaleFit),
      chordAnchorFit: round(chordAnchors),
      bassKickLock: round(bassLock),
      motifRepetition: round(repetitionRatio),
      counterpointCollision: round(collisionRatio),
      transitionClarity: round(transitions / 100),
      harmonicJourneyFit: round(harmonicJourney / 100),
      performanceControl: round(performance / 100),
      orchestrationFit: round(orchestration / 100),
      memoryRecall: round(memory / 100),
      productionReadiness: round(production / 100),
      phraseResolution: round(phraseResolution / 100),
      tensionAlignment: round(tensionFollow / 100),
      drumVariation: round(drumVariety / 100),
      registerHealth: round(registerHealth / 100),
      stageInterlock: round(stageInterlock / 100),
      genreProfile: song.genre,
      densityTarget,
      repetitionTarget: round(repetitionTarget),
      syncopationTarget: criticProfile.syncopation,
      measuredSyncopation: round(measuredSyncopation),
      backbeatsPerBarTarget: criticProfile.backbeats,
      bassLockTarget: criticProfile.bassLock,
    },
  };
}

function fingerprintSequenceSimilarity(left = [], right = []) {
  if (!left.length && !right.length) return 1;
  if (!left.length || !right.length) return 0;
  const length = Math.max(left.length, right.length);
  let positionalMatches = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (String(left[index]) === String(right[index])) positionalMatches += 1;
  }
  const leftSet = new Set(left.map(String));
  const rightSet = new Set(right.map(String));
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return clamp((positionalMatches / length) * 0.72 + (intersection / Math.max(1, union)) * 0.28, 0, 1);
}

export function createSongFingerprint(song) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const drums = song?.tracks?.find((track) => track.id === "drums")?.notes ?? [];
  const kicks = drums
    .filter((note) => note.pitch === 35 || note.pitch === 36)
    .map((note) => `${Math.floor(note.start / barBeats)}:${round(mod(note.start, barBeats))}`);
  const motif = song?.motifs?.family?.A?.melody ?? song?.motifs?.melody;
  return {
    version: 1,
    structure: (song?.structure ?? []).map((section) => `${section.name}:${section.bars}`),
    harmony: (song?.harmony ?? []).map((event) => `${mod(event.degree, 7)}:${round(event.duration)}`),
    motifContour: (motif?.events ?? []).map((event) => Math.round(finite(event.degree, 0))),
    motifRhythm: (motif?.events ?? []).map((event) => `${round(event.offset)}:${round(event.duration)}`),
    groove: kicks,
  };
}

function fingerprintSimilarity(left, right) {
  const components = {
    structure: fingerprintSequenceSimilarity(left.structure, right.structure),
    harmony: fingerprintSequenceSimilarity(left.harmony, right.harmony),
    motifContour: fingerprintSequenceSimilarity(left.motifContour, right.motifContour),
    motifRhythm: fingerprintSequenceSimilarity(left.motifRhythm, right.motifRhythm),
    groove: fingerprintSequenceSimilarity(left.groove, right.groove),
  };
  return {
    similarity: clamp(
      components.structure * 0.16
      + components.harmony * 0.24
      + components.motifContour * 0.24
      + components.motifRhythm * 0.16
      + components.groove * 0.2,
      0,
      1,
    ),
    components,
  };
}

function normalizeRecentSongs(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const song of value) {
    if (!song?.meta || !Array.isArray(song.tracks)) continue;
    const identity = String(song.id ?? `${song.seed}:${song.title}`);
    if (seen.has(identity)) continue;
    seen.add(identity);
    if (!song.meta.ideaFingerprint) {
      song.meta.ideaFingerprint = createSongFingerprint(song);
    }
    result.push(song);
    if (result.length >= 8) break;
  }
  return result;
}

export function evaluateSongNovelty(song, recentSongs = [], generation = song?.generation ?? "new") {
  const recent = normalizeRecentSongs(recentSongs);
  const fingerprint = createSongFingerprint(song);
  if (!recent.length) {
    return {
      version: 1,
      compared: 0,
      score: 75,
      novelty: 1,
      maxSimilarity: 0,
      targetSimilarity: generation === "similar" ? clamp(finite(song?.settings?.similarity, 0.82), 0.55, 0.95) : 0.25,
      closestSongId: null,
      components: null,
    };
  }
  const comparisons = recent.map((candidate) => ({
    songId: candidate.id ?? null,
    ...fingerprintSimilarity(fingerprint, candidate.meta?.ideaFingerprint ?? createSongFingerprint(candidate)),
  })).sort((left, right) => right.similarity - left.similarity);
  const closest = comparisons[0];
  const targetSimilarity = generation === "similar"
    ? clamp(finite(song?.settings?.similarity, 0.82), 0.55, 0.95)
    : 0.25;
  const score = generation === "similar"
    ? 100 - Math.abs(closest.similarity - targetSimilarity) * 120
    : (1 - closest.similarity) * 100;
  return {
    version: 1,
    compared: comparisons.length,
    score: clamp(Math.round(score), 0, 100),
    novelty: round(1 - closest.similarity),
    maxSimilarity: round(closest.similarity),
    targetSimilarity: round(targetSimilarity),
    closestSongId: closest.songId,
    components: Object.fromEntries(
      Object.entries(closest.components).map(([key, value]) => [key, round(value)]),
    ),
  };
}

const DEFAULT_CANDIDATE_COUNT = 4;
const MAX_CANDIDATE_COUNT = 12;
const DEFAULT_ADAPTIVE_CANDIDATES = 3;
const DEFAULT_TARGETED_REPAIR_ATTEMPTS = 2;
const BALANCE_DIMENSIONS = Object.freeze([
  "harmonic",
  "groove",
  "motif",
  "storyArc",
  "voiceLeading",
  "separation",
  "transitions",
  "harmonicJourney",
  "performance",
  "orchestration",
  "memory",
  "phraseResolution",
  "tensionFollow",
  "drumVariety",
  "registerHealth",
  "stageInterlock",
  "genreAuthenticity",
]);
const CREATIVE_FLOOR_DIMENSIONS = Object.freeze([
  "groove",
  "motif",
  "storyArc",
  "transitions",
  "harmonicJourney",
  "phraseResolution",
  "drumVariety",
  "genreAuthenticity",
]);
const TARGETED_REPAIR_GROUPS = deepFreeze([
  {
    id: "harmony",
    dimensions: ["harmonic", "voiceLeading", "cadence", "harmonicJourney"],
    route: "harmony-first",
  },
  {
    id: "groove",
    dimensions: ["groove", "density", "drumVariety"],
    route: "groove-first",
  },
  {
    id: "motif",
    dimensions: ["motif", "repetition", "separation", "memory", "phraseResolution", "registerHealth"],
    route: "hook-first",
  },
  {
    id: "performance",
    dimensions: ["performance"],
    route: null,
  },
  {
    id: "arrangement",
    dimensions: ["storyArc", "transitions", "orchestration", "production", "tensionFollow", "stageInterlock"],
    route: null,
  },
]);

function normalizeCandidateCount(value) {
  return clamp(
    Math.round(finite(value, DEFAULT_CANDIDATE_COUNT)),
    1,
    MAX_CANDIDATE_COUNT,
  );
}

/**
 * Measure the weakest parts of an idea instead of trusting its average alone.
 * Production and density are intentionally excluded: they remain part of Critic
 * 6.0, while this profile focuses on whether the musical idea itself is balanced.
 */
export function evaluateCandidateBalance(evaluation = {}) {
  const subscores = evaluation?.subscores ?? {};
  const scores = BALANCE_DIMENSIONS.map((name) => clamp(finite(subscores[name], 70), 0, 100));
  const creativeScores = CREATIVE_FLOOR_DIMENSIONS.map((name) => clamp(finite(subscores[name], 70), 0, 100));
  const sorted = [...scores].sort((left, right) => left - right);
  const lowerBand = sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.3)));
  const mean = average(scores, 0);
  const spread = Math.sqrt(average(scores.map((score) => (score - mean) ** 2), 0));
  const balanceScore = Math.round(average(lowerBand, 0));
  const creativeFloor = Math.round(Math.min(...creativeScores));
  const scaleSafe = finite(evaluation?.diagnostics?.scaleFit, 0) >= 1 - 1e-9;
  const totalScore = finite(evaluation?.score, 0);
  return {
    version: 1,
    balanceScore,
    creativeFloor,
    spread: round(spread),
    passed: scaleSafe && totalScore >= 82 && balanceScore >= 68 && creativeFloor >= 64,
    // Groove-role scoring became more expressive in 1.2.x; require one extra
    // quality point so adaptive search does not stop merely because the richer
    // bass vocabulary lifted an otherwise unchanged candidate to 92.
    aspirational: scaleSafe && totalScore >= 93 && balanceScore >= 80 && creativeFloor >= 75,
  };
}

function candidateSearchPlan(input = {}) {
  const baseCandidateCount = normalizeCandidateCount(input.candidateCount);
  const adaptive = input.candidateCount == null && input.adaptiveCandidates !== false;
  const maxCandidateCount = adaptive
    ? Math.min(MAX_CANDIDATE_COUNT, baseCandidateCount + DEFAULT_ADAPTIVE_CANDIDATES)
    : baseCandidateCount;
  const targetedRepair = adaptive && input.targetedRepair !== false;
  const repairAttempts = targetedRepair
    ? clamp(
      Math.round(finite(input.repairAttempts, DEFAULT_TARGETED_REPAIR_ATTEMPTS)),
      0,
      DEFAULT_TARGETED_REPAIR_ATTEMPTS,
    )
    : 0;
  return {
    adaptive,
    baseCandidateCount,
    maxCandidateCount,
    targetedRepair,
    repairAttempts,
  };
}

function candidateMeetsAdaptiveTarget(candidate, generation) {
  const balance = evaluateCandidateBalance(candidate?.evaluation);
  const noveltyReady = !candidate?.novelty?.compared
    || finite(candidate.novelty.score, 0) >= (generation === "similar" ? 55 : 65);
  return balance.aspirational && noveltyReady;
}

/**
 * Map the critic's weakest dimension to the smallest generator dependency
 * group that can repair it. Exposed for diagnostics and deterministic tests.
 */
export function diagnoseCandidateRepair(evaluation = {}, attemptedGroups = []) {
  const attempted = new Set(Array.isArray(attemptedGroups) ? attemptedGroups : []);
  const subscores = evaluation?.subscores ?? {};
  const ranked = TARGETED_REPAIR_GROUPS
    .filter((group) => !attempted.has(group.id))
    .map((group, priority) => {
      const suppliedDimensions = group.dimensions.filter((dimension) => Object.hasOwn(subscores, dimension));
      const dimensions = (suppliedDimensions.length ? suppliedDimensions : group.dimensions).map((dimension) => ({
        dimension,
        score: clamp(finite(subscores[dimension], 70), 0, 100),
      }));
      dimensions.sort((left, right) => left.score - right.score);
      return {
        version: 1,
        group: group.id,
        route: group.route,
        weakestDimension: dimensions[0]?.dimension ?? null,
        weakestScore: dimensions[0]?.score ?? 0,
        groupScore: round(average(dimensions.map(({ score }) => score), 0)),
        priority,
      };
    })
    .sort(
      (left, right) =>
        left.weakestScore - right.weakestScore
        || left.groupScore - right.groupScore
        || left.priority - right.priority,
    );
  const selected = ranked[0];
  return selected
    ? {
      version: selected.version,
      group: selected.group,
      route: selected.route,
      weakestDimension: selected.weakestDimension,
      weakestScore: selected.weakestScore,
      groupScore: selected.groupScore,
    }
    : null;
}

function trackInputMap(value) {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .filter((track) => track && TRACK_DEFINITIONS[track.id])
        .map((track) => [track.id, track]),
    );
  }
  return value && typeof value === "object" ? value : {};
}

function mergeTrackInputs(base, overrides) {
  const baseTracks = trackInputMap(base);
  const overrideTracks = trackInputMap(overrides);
  return Object.fromEntries(
    TRACK_IDS.map((id) => [
      id,
      {
        ...(baseTracks[id] ?? {}),
        ...(overrideTracks[id] ?? {}),
      },
    ]),
  );
}

function configFromSong(song) {
  const settings = song?.settings && typeof song.settings === "object"
    ? song.settings
    : {};
  const renderedTracks = trackInputMap(song?.tracks);
  const savedTracks = trackInputMap(settings.tracks);
  const tracks = Object.fromEntries(
    TRACK_IDS.map((id) => {
      const rendered = renderedTracks[id] ?? {};
      return [
        id,
        {
          ...(savedTracks[id] ?? {}),
          ...(rendered.settings ?? {}),
          ...(rendered.name == null ? {} : { name: rendered.name }),
          ...(rendered.program == null ? {} : { program: rendered.program }),
          ...(rendered.channel == null ? {} : { channel: rendered.channel }),
        },
      ];
    }),
  );

  return {
    ...settings,
    seed: String(song?.seed ?? DEFAULT_CONFIG.seed),
    genre: song?.genre ?? song?.meta?.genre ?? settings.genre ?? DEFAULT_CONFIG.genre,
    key: song?.key ?? song?.meta?.key ?? DEFAULT_CONFIG.key,
    scale: song?.mode ?? song?.meta?.scale ?? DEFAULT_CONFIG.scale,
    tempo: song?.bpm ?? song?.meta?.tempo ?? DEFAULT_CONFIG.tempo,
    bars: song?.bars ?? song?.meta?.bars ?? DEFAULT_CONFIG.bars,
    timeSignature: song?.meta?.timeSignature ?? DEFAULT_CONFIG.timeSignature,
    oneShotKitId: song?.oneShotKit?.id ?? settings.oneShotKitId ?? null,
    title: song?.title ?? null,
    tracks,
  };
}

function candidateSeed(baseSeed, phase, index) {
  const entropy = hashSeed(`${baseSeed}::${phase}::${index}`).toString(36);
  return `${baseSeed}:${phase}:${index}:${entropy}`;
}

function replaceSongTracks(sourceTracks, replacementTracks, trackIds) {
  const replacements = new Map(
    replacementTracks
      .filter((track) => trackIds.includes(track.id))
      .map((track) => [track.id, track]),
  );
  return sourceTracks.map((track) => (
    replacements.has(track.id) ? clone(replacements.get(track.id)) : clone(track)
  ));
}

function finishRepairedSong(song, config, diagnosis, sourceCandidate, attempt) {
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
  song.tracks = finalMaster.tracks;
  song.finalAssembly = createFinalAssemblyReport(
    song.tracks,
    song.structure,
    song.songBlueprint,
    finalAssemblyRepair.repairs,
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
  };
  return song;
}

function repairCandidateSong(sourceCandidate, diagnosis, seed, attempt) {
  const sourceSong = sourceCandidate.song;
  const config = normalizeConfig({
    ...configFromSong(sourceSong),
    seed,
    oneShotKitId: sourceSong.oneShotKit?.id ?? null,
  });
  const arrangementRepair = diagnosis.group === "arrangement";
  const harmonyRepair = diagnosis.group === "harmony";
  const motifRepair = diagnosis.group === "motif";
  const performanceRepair = diagnosis.group === "performance";
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
    ...(harmonyRepair ? {
      targetTrack: "bass",
      contextTracks: {
        drums: sourceSong.tracks.find((track) => track.id === "drums"),
      },
    } : {}),
  };
  const variant = compose(config, options);
  let repaired;

  if (arrangementRepair) {
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
        ["bass", "chords", "melody", "counterpoint", "pad"],
      );
    } else if (diagnosis.group === "groove") {
      repaired.grooveConductor = variant.grooveConductor;
      repaired.tracks = replaceSongTracks(
        sourceSong.tracks,
        variant.tracks,
        ["drums", "bass"],
      );
    } else if (motifRepair) {
      repaired.motifs = variant.motifs;
      repaired.grooveConductor = variant.grooveConductor;
      repaired.tracks = replaceSongTracks(
        sourceSong.tracks,
        variant.tracks,
        ["melody", "counterpoint"],
      );
    } else {
      repaired.performanceProfile = variant.performanceProfile;
      repaired.tracks = clone(variant.tracks);
    }
  }

  repaired.generationInterlock = clone(variant.generationInterlock);
  repaired.title = sourceSong.title;
  return finishRepairedSong(repaired, config, diagnosis, sourceCandidate, attempt);
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

function rankCandidates(candidates) {
  return [...candidates].sort(
    (left, right) =>
      Number(qualityGateForEvaluation(right.evaluation).passed) - Number(qualityGateForEvaluation(left.evaluation).passed)
      || Number(evaluateCandidateBalance(right.evaluation).passed) - Number(evaluateCandidateBalance(left.evaluation).passed)
      || finite(right.selectionScore, right.evaluation.score) - finite(left.selectionScore, left.evaluation.score)
      || right.evaluation.score - left.evaluation.score
      || (Boolean(right.repair) - Boolean(left.repair))
      || left.index - right.index,
  );
}

function commitCandidate(candidates, search = {}) {
  const ranked = rankCandidates(candidates);
  const selected = ranked[0];
  if (!selected) throw new Error("Generation produced no candidates.");
  const qualityGate = qualityGateForEvaluation(selected.evaluation);
  const balance = evaluateCandidateBalance(selected.evaluation);
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
    novelty: selected.novelty,
    candidatesEvaluated: candidates.length,
    selectedCandidate: selected.index,
    balance,
    candidateSearch: {
      adaptive: Boolean(search.adaptive),
      baseCandidateCount: finite(search.baseCandidateCount, candidates.length),
      maxCandidateCount: finite(search.maxCandidateCount, candidates.length),
      expandedBy: Math.max(0, composedCandidates - finite(search.baseCandidateCount, composedCandidates)),
      targetReached,
    },
    criticRepair: {
      ...criticRepair,
      status: repairStatus,
      selectedFromRepair,
      selectedGroup: selected.repair?.group ?? null,
    },
    candidateScores: candidates.map(({ index, evaluation, novelty, selectionScore, song }) => {
      const candidateBalance = evaluateCandidateBalance(evaluation);
      return {
        index,
        score: evaluation.score,
        selectionScore,
        balanceScore: candidateBalance.balanceScore,
        creativeFloor: candidateBalance.creativeFloor,
        passedBalanceGate: candidateBalance.passed,
        noveltyScore: novelty?.score ?? 75,
        maxSimilarity: novelty?.maxSimilarity ?? 0,
        compositionRoute: song.compositionRoute?.id ?? null,
        passedPhase9: qualityGateForEvaluation(evaluation).passed,
        repairGroup: song.criticRepair?.group ?? null,
        repairSourceCandidate: song.criticRepair?.sourceCandidate ?? null,
      };
    }),
  };
  selected.song.meta.novelty = selected.novelty;
  selected.song.meta.ideaFingerprint = createSongFingerprint(selected.song);
  if (selected.novelty?.compared) {
    selected.song.idea?.rhythmicFeatures?.push(`Compared with ${selected.novelty.compared} recent ${selected.novelty.compared === 1 ? "idea" : "ideas"}`);
  }
  selected.song.meta.qualityGate = qualityGate;
  selected.song.producerPass = {
    ...(selected.song.producerPass ?? { phase: 9, version: 1 }),
    status: qualityGate.passed ? "passed" : "best-available",
    qualityGate,
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
      id: "targeted-critic-repair",
      phase: 20,
      status: repairStatus,
      attempts: criticRepair.attempts,
      groups: criticRepair.groups,
      selectedGroup: selected.repair?.group ?? null,
    },
  ];
  return selected.song;
}

function candidateSelectionScore(evaluation, novelty, generation) {
  const balance = evaluateCandidateBalance(evaluation);
  if (!novelty?.compared) {
    return round(evaluation.score * 0.8 + balance.balanceScore * 0.12 + balance.creativeFloor * 0.08);
  }
  const weights = generation === "similar"
    ? { quality: 0.68, balance: 0.12, floor: 0.08, novelty: 0.12 }
    : { quality: 0.7, balance: 0.12, floor: 0.08, novelty: 0.1 };
  return round(
    evaluation.score * weights.quality
    + balance.balanceScore * weights.balance
    + balance.creativeFloor * weights.floor
    + novelty.score * weights.novelty,
  );
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
    groups: [],
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
  for (
    let attempt = 0;
    attempt < search.repairAttempts && candidates.length < MAX_CANDIDATE_COUNT;
    attempt += 1
  ) {
    const sourceCandidate = rankCandidates(candidates)[0];
    const diagnosis = diagnoseCandidateRepair(sourceCandidate.evaluation, attemptedGroups);
    if (!diagnosis) {
      summary.reason = "no-repair-group";
      break;
    }
    attemptedGroups.push(diagnosis.group);
    const seed = candidateSeed(baseSeed, `repair-${diagnosis.group}`, attempt);
    const song = repairCandidateSong(sourceCandidate, diagnosis, seed, attempt);
    song.meta.ideaFingerprint = createSongFingerprint(song);
    const evaluation = evaluateSongCandidate(song);
    const novelty = evaluateSongNovelty(song, recentSongs, generation);
    song.criticRepair.weakestScoreAfter = finite(
      evaluation.subscores?.[diagnosis.weakestDimension],
      diagnosis.weakestScore,
    );
    song.criticRepair.totalScoreBefore = sourceCandidate.evaluation.score;
    song.criticRepair.totalScoreAfter = evaluation.score;
    const candidate = {
      index: candidates.length,
      song,
      evaluation,
      novelty,
      repair: song.criticRepair,
      selectionScore: candidateSelectionScore(evaluation, novelty, generation),
    };
    candidates.push(candidate);
    summary.attempts += 1;
    summary.groups.push(diagnosis.group);
    summary.targetReached = candidateMeetsAdaptiveTarget(candidate, generation);
    if (summary.targetReached) {
      summary.reason = "repair-target-reached";
      break;
    }
  }

  if (!summary.reason) {
    summary.reason = candidates.length >= MAX_CANDIDATE_COUNT
      ? "candidate-budget-reached"
      : "repair-budget-reached";
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

  for (let index = 0; index < search.maxCandidateCount; index += 1) {
    const seed = candidateSeed(baseSeed, "new", index);
    const config = normalizeConfig({ ...input, seed });
    const routeId = candidateCompositionRoute(baseSeed, index, input.compositionRoute);
    const candidateSong = compose(config, {
      generation: "new",
      revision: 0,
      compositionRoute: routeId,
    });
    candidateSong.meta.ideaFingerprint = createSongFingerprint(candidateSong);
    const evaluation = evaluateSongCandidate(candidateSong);
    const novelty = evaluateSongNovelty(candidateSong, recentSongs, "new");
    candidates.push({
      index,
      song: candidateSong,
      evaluation,
      novelty,
      selectionScore: candidateSelectionScore(evaluation, novelty, "new"),
    });
    if (
      candidates.length >= search.baseCandidateCount
      && (!search.adaptive || candidates.some((candidate) => candidateMeetsAdaptiveTarget(candidate, "new")))
    ) break;
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
      input.compositionRoute ?? (targetTrack ? current.compositionRoute?.id : null),
    );
    const inheritedContext = normalizeContextTracks(current.tracks, config);
    const suppliedContext = normalizeContextTracks(input.contextTracks, config);

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
      contextTracks: { ...inheritedContext, ...suppliedContext },
    });

    candidateSong.meta.ideaFingerprint = createSongFingerprint(candidateSong);
    const evaluation = evaluateSongCandidate(candidateSong);
    const novelty = evaluateSongNovelty(candidateSong, recentSongs, "similar");
    candidates.push({
      index,
      song: candidateSong,
      evaluation,
      novelty,
      selectionScore: candidateSelectionScore(evaluation, novelty, "similar"),
    });
    if (
      candidates.length >= search.baseCandidateCount
      && (!search.adaptive || candidates.some((candidate) => candidateMeetsAdaptiveTarget(candidate, "similar")))
    ) break;
  }

  runTargetedCriticRepair(candidates, {
    search,
    generation: "similar",
    recentSongs,
    baseSeed,
  });
  return commitCandidate(candidates, search);
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
  events.push({ tick: 0, order: 2, data: textMeta(0x01, "MIDI Arcade · General MIDI 2 sound-ready export") });
  const microseconds = clamp(Math.round(60000000 / clamp(finite(song.meta.tempo, 120), 30, 300)), 1, 0xffffff);
  events.push({ tick: 0, order: 3, data: meta(0x51, [(microseconds >> 16) & 0xff, (microseconds >> 8) & 0xff, microseconds & 0xff]) });
  const [numerator, denominator] = normalizeTimeSignature(song.meta.timeSignature);
  const denominatorPower = Math.round(Math.log2(denominator));
  const metronome = denominator === 8 && numerator % 3 === 0 ? 36 : 24;
  events.push({ tick: 0, order: 4, data: meta(0x58, [numerator, denominatorPower, metronome, 8]) });
  events.push({ tick: 0, order: 5, data: meta(0x59, keySignature(song)) });
  for (const section of song.structure ?? []) {
    events.push({
      tick: Math.round(finite(section.startBeat, 0) * ppq),
      order: 5,
      data: textMeta(0x06, String(section.name ?? "Section")),
    });
  }
  return encodeTrack(events, totalTicks);
}

function cutoffControllerValue(value) {
  const cutoff = clamp(finite(value, 8000), 1000, 14000);
  return clamp(Math.round((cutoff - 1000) / 13000 * 127), 0, 127);
}

function musicalTrack(track, song, ppq, audible, trackIndex = 0) {
  const channel = track.id === "drums" ? 9 : clamp(Math.round(finite(track.channel, 0)), 0, 15);
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
    for (const note of track.notes ?? []) {
      const pitch = clamp(Math.round(finite(note.pitch, 60)), 0, 127);
      const velocity = clamp(Math.round(finite(note.velocity, 90) * velocityScale), 1, 127);
      const onTick = clamp(Math.round(finite(note.start, 0) * ppq), 0, Math.round(song.meta.totalBeats * ppq));
      const offTick = clamp(
        Math.max(onTick + 1, Math.round((finite(note.start, 0) + finite(note.duration, 0.25) * gateScale) * ppq)),
        1,
        Math.round(song.meta.totalBeats * ppq),
      );
      events.push({ tick: onTick, order: 20, data: [0x90 | channel, pitch, velocity] });
      events.push({ tick: offTick, order: 10, data: [0x80 | channel, pitch, 0] });
    }
  }
  return encodeTrack(events, Math.round(song.meta.totalBeats * ppq));
}

/**
 * Encode a song as a Standard MIDI File type 1 Uint8Array. The first track is a
 * conductor track; every instrument receives its own named MIDI track.
 */
export function encodeMidi(song, options = {}) {
  if (!song?.meta || !Array.isArray(song.tracks)) throw new TypeError("encodeMidi requires a song JSON object");
  const ppq = clamp(Math.round(finite(options.ppq, song.meta.ppq ?? PPQ)), 24, 32767);
  const soloed = song.tracks.filter((track) => track.settings?.solo);
  const includeMuted = Boolean(options.includeMuted);
  const alwaysIncluded = new Set(Array.isArray(options.alwaysIncludeTrackIds) ? options.alwaysIncludeTrackIds.map(String) : []);
  const chunks = [conductorTrack(song, ppq)];
  for (const [trackIndex, track] of song.tracks.entries()) {
    const audible = includeMuted
      || alwaysIncluded.has(String(track.id))
      || (!track.settings?.mute && (!soloed.length || track.settings?.solo));
    chunks.push(musicalTrack(track, song, ppq, audible, trackIndex));
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
