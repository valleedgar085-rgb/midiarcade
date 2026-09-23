const RHYTHM_DENSITY_WEIGHTS = Object.freeze({
  drumBass: 0.75,
  funk: 0.8,
  afrobeats: 0.7,
});

const DRUM_ONSET_CAP_PER_BAR = 16;

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function barsFor(song) {
  return Math.max(1, finite(song?.meta?.bars, song?.bars ?? 1));
}

function pitchedNotes(song) {
  return (song?.tracks ?? [])
    .filter((track) => track?.id !== "drums")
    .flatMap((track) => track?.notes ?? []);
}

function uniqueDrumOnsets(song) {
  const drums = (song?.tracks ?? []).find((track) => track?.id === "drums")?.notes ?? [];
  return new Set(drums.map((note) => round(note?.start, 4))).size;
}

/**
 * Density is normally pitched-note activity. Rhythm-led genres additionally
 * receive a bounded contribution from unique drum onsets so the critic measures
 * ensemble activity instead of pressuring pads/chords to manufacture note count.
 */
export function densityActivityForSong(song) {
  const bars = barsFor(song);
  const genre = String(song?.genre ?? song?.meta?.genre ?? "");
  const pitchedNotesPerBar = pitchedNotes(song).length / bars;
  const drumOnsetsPerBar = uniqueDrumOnsets(song) / bars;
  const drumWeight = RHYTHM_DENSITY_WEIGHTS[genre] ?? 0;
  const drumContribution = Math.min(DRUM_ONSET_CAP_PER_BAR, drumOnsetsPerBar) * drumWeight;
  return Object.freeze({
    genre,
    metric: drumWeight > 0 ? "ensemble-events" : "pitched-notes",
    pitchedNotesPerBar: round(pitchedNotesPerBar),
    drumOnsetsPerBar: round(drumOnsetsPerBar),
    drumWeight,
    drumContribution: round(drumContribution),
    observed: round(pitchedNotesPerBar + drumContribution),
  });
}

export const RHYTHM_DENSITY_GENRES = Object.freeze(Object.keys(RHYTHM_DENSITY_WEIGHTS));
