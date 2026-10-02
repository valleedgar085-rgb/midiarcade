// Generated genre reference profiles are registered here after audio analysis.
// Keep this module metadata-only: never bundle reference MP3/WAV files into the app.
export const REFERENCE_PROFILES = Object.freeze({});

export function referenceProfileForGenre(genre) {
  const key = String(genre ?? "").trim();
  return REFERENCE_PROFILES[key] ?? null;
}

export function availableReferenceProfileGenres() {
  return Object.freeze(Object.keys(REFERENCE_PROFILES));
}
