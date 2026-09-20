function asSet(value) {
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
}

function trackNotes(track) {
  return Array.isArray(track?.notes) ? track.notes : Array.isArray(track?.events) ? track.events : [];
}

export function playableSongNoteCount(song) {
  const tracks = Array.isArray(song?.tracks) ? song.tracks : [];
  return tracks.reduce((sum, track) => sum + trackNotes(track).length, 0);
}

export function hasAudiblePreviewEvents(events) {
  return Array.isArray(events) && events.some((event) => (
    Number.isFinite(Number(event?.time))
    && Number(event?.mixGain ?? 1) > 0.0001
    && Number(event?.velocity ?? 1) > 0
  ));
}

export function shouldRecoverSilentMixState({
  song,
  events,
  muted,
  solo,
} = {}) {
  if (playableSongNoteCount(song) <= 0) return false;
  if (hasAudiblePreviewEvents(events)) return false;
  const mutedSet = asSet(muted);
  const soloSet = asSet(solo);
  return mutedSet.size > 0 || soloSet.size > 0;
}

export function playbackSourceNeedsCanonicalReset(playbackSong, canonicalSong) {
  return Boolean(playbackSong && canonicalSong && playbackSong !== canonicalSong);
}
