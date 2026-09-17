const CHROMATIC = Object.freeze(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]);
const NOTE_ALIASES = Object.freeze({
  C: "C",
  "B#": "C",
  "C#": "C#",
  DB: "C#",
  D: "D",
  "D#": "D#",
  EB: "D#",
  E: "E",
  FB: "E",
  "E#": "F",
  F: "F",
  "F#": "F#",
  GB: "F#",
  G: "G",
  "G#": "G#",
  AB: "G#",
  A: "A",
  "A#": "A#",
  BB: "A#",
  B: "B",
  CB: "B",
});

const MODE_INTERVALS = Object.freeze({
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  harmonicMajor: [0, 2, 4, 5, 7, 8, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  lydianDominant: [0, 2, 4, 6, 7, 9, 10],
  altered: [0, 1, 3, 4, 6, 8, 10],
  doubleHarmonic: [0, 1, 4, 5, 7, 8, 11],
  hirajoshi: [0, 2, 3, 7, 8],
  hungarianMinor: [0, 2, 3, 6, 7, 8, 11],
  inSen: [0, 1, 5, 7, 10],
  persian: [0, 1, 4, 5, 6, 8, 11],
  iwato: [0, 1, 5, 6, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  pentatonicNeutral: [0, 2, 5, 7, 10],
  egyptianPentatonic: [0, 2, 5, 7, 9],
  bebopMajor: [0, 2, 4, 5, 7, 8, 9, 11],
  bebopDominant: [0, 2, 4, 5, 7, 9, 10, 11],
  wholeTone: [0, 2, 4, 6, 8, 10],
  diminishedHalfWhole: [0, 1, 3, 4, 6, 7, 9, 10],
  diminishedWholeHalf: [0, 2, 3, 5, 6, 8, 9, 11],
  enigmatic: [0, 1, 4, 6, 8, 10, 11],
});

function normalizeKeyName(value) {
  const text = String(value ?? "").trim();
  const compact = text.replace(/\s+/g, "").toUpperCase();
  return NOTE_ALIASES[compact] || text || "C";
}

function resolveKey(song) {
  const key = song?.global?.key;
  if (typeof key === "string" && key) return normalizeKeyName(key);
  if (key && typeof key === "object") return normalizeKeyName(key.tonic || key.root || key.name || song?.key || song?.meta?.key || "C");
  return normalizeKeyName(song?.key || song?.meta?.key || "C");
}

function resolveMode(song) {
  const globalKey = song?.global?.key;
  if (globalKey && typeof globalKey === "object" && globalKey.mode) return globalKey.mode;
  return song?.global?.mode || song?.mode || song?.meta?.mode || song?.meta?.scale || "minor";
}

function sanitizeStoredIntervals(intervals) {
  if (!Array.isArray(intervals)) return [];
  const normalized = [...new Set(
    intervals
      .filter((interval) => interval != null && interval !== "")
      .map((interval) => Number(interval))
      .filter((interval) => Number.isInteger(interval) && interval >= 0 && interval < 12),
  )].sort((a, b) => a - b);
  return normalized.length >= 5 ? normalized : [];
}

export function getScaleChordGuide(song, startBeat = 0) {
  const key = resolveKey(song);
  const mode = resolveMode(song);
  const harmony = Array.isArray(song?.harmony) ? song.harmony : [];
  const currentHarmony = harmony.find((event) => {
    const start = Number(event.startBeat ?? event.start ?? 0);
    const duration = Number(event.duration ?? event.durationBeats ?? 4);
    return startBeat >= start && startBeat < start + duration;
  }) || harmony[0];

  const symbol = currentHarmony?.symbol
    || currentHarmony?.roman
    || currentHarmony?.chord?.symbol
    || currentHarmony?.chord?.roman
    || key;
  const roman = currentHarmony?.roman || currentHarmony?.chord?.roman || "i";
  const quality = currentHarmony?.quality || currentHarmony?.chord?.quality || "triad";
  const notes = Array.isArray(currentHarmony?.notes)
    ? currentHarmony.notes
    : Array.isArray(currentHarmony?.chord?.notes)
      ? currentHarmony.chord.notes
      : [key];

  const rootIndex = CHROMATIC.indexOf(key) >= 0 ? CHROMATIC.indexOf(key) : 0;
  const storedIntervals = sanitizeStoredIntervals(song?.meta?.scaleIntervals);
  const intervals = storedIntervals.length ? storedIntervals : MODE_INTERVALS[mode] || MODE_INTERVALS.minor;
  const scaleNotes = intervals.map((interval) => CHROMATIC[(rootIndex + interval) % 12]);
  const scalePitchClasses = intervals.map((interval) => (rootIndex + interval) % 12);

  return {
    key,
    mode,
    scaleIntervals: [...intervals],
    scalePitchClasses,
    scaleNotes,
    chord: {
      symbol,
      roman,
      quality,
      notes,
    },
  };
}

export { CHROMATIC, MODE_INTERVALS };
