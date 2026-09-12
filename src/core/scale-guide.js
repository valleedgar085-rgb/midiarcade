const CHROMATIC = Object.freeze(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]);

const MODE_INTERVALS = Object.freeze({
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
});

export function getScaleChordGuide(song, startBeat = 0) {
  const key = song?.global?.key || song?.key || song?.meta?.key || "C";
  const mode = song?.global?.mode || song?.mode || song?.meta?.mode || "minor";
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
  const intervals = MODE_INTERVALS[mode] || MODE_INTERVALS.minor;
  const scaleNotes = intervals.map((interval) => CHROMATIC[(rootIndex + interval) % 12]);

  return {
    key,
    mode,
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
