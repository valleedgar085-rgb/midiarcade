export const HISTORY_LIMIT = 6;
export const RECENT_IDEA_LIMIT = 6;

export function appendWithinLimit(entries, value, limit = HISTORY_LIMIT) {
  const safeLimit = Math.max(1, Math.round(Number(limit) || HISTORY_LIMIT));
  return [...(Array.isArray(entries) ? entries : []), value].slice(-safeLimit);
}

export function compactRecentSongs(candidates, limit = RECENT_IDEA_LIMIT) {
  const safeLimit = Math.max(1, Math.round(Number(limit) || RECENT_IDEA_LIMIT));
  const seen = new Set();
  const result = [];
  for (const song of Array.isArray(candidates) ? candidates : []) {
    if (!song?.meta || !Array.isArray(song.tracks)) continue;
    const identity = String(song.id ?? `${song.seed}:${song.title}`);
    if (seen.has(identity)) continue;
    seen.add(identity);
    const fingerprint = song.meta.ideaFingerprint;
    result.push(fingerprint && Number(fingerprint.version) >= 2
      ? {
        id: song.id,
        seed: song.seed,
        title: song.title,
        meta: { ideaFingerprint: fingerprint },
        tracks: [],
      }
      : song);
    if (result.length >= safeLimit) break;
  }
  return result;
}
