const PUNCTUATED_GENRES = new Set(["funk", "afrobeats"]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function usesPunctuatedPhraseResolution(genre) {
  return PUNCTUATED_GENRES.has(String(genre ?? ""));
}

export function phraseResolutionDesiredDuration(genre, beatsPerBar = 4) {
  const bar = Math.max(1, finite(beatsPerBar, 4));
  return bar * (usesPunctuatedPhraseResolution(genre) ? 0.12 : 0.35);
}

export function phraseResolutionArticulationSatisfied({
  genre,
  note,
  sectionEnd,
  beatsPerBar = 4,
} = {}) {
  if (!note) return false;
  const desiredDuration = phraseResolutionDesiredDuration(genre, beatsPerBar);
  const duration = Math.max(0, finite(note.duration));
  if (duration >= desiredDuration - 1e-6) return true;
  if (!usesPunctuatedPhraseResolution(genre)) return false;

  // Funk and Afrobeats often resolve with a short, clean stab rather than a
  // long held tone. Count that as intentional resolution when the note itself
  // reaches the section boundary closely enough to act as punctuation.
  const endGap = Math.max(0, finite(sectionEnd) - (finite(note.start) + duration));
  return endGap <= Math.max(0.18, Math.min(0.28, Math.max(1, finite(beatsPerBar, 4)) * 0.05));
}
