import { continueElementLineage } from "./elemental-lineage.js";

/**
 * Single authoritative post-generation finalizer used by worker and synchronous
 * fallback paths. Groove DNA owns rhythmic structure, so finalization may
 * preserve Similar lineage but must not add, move, delete, or re-time notes.
 */
export function finalizeGeneratedSong(song, {
  kind = "new",
  sourceSong = null,
  config: _config = {},
} = {}) {
  if (!song || typeof song !== "object") {
    return Object.freeze({
      song,
      diagnostics: Object.freeze({
        rhythmAuthority: "groove-dna",
        rhythmChanged: false,
      }),
    });
  }

  const lineageSong = kind === "similar" && sourceSong
    ? continueElementLineage(sourceSong, song)
    : song;

  return Object.freeze({
    song: lineageSong,
    diagnostics: Object.freeze({
      rhythmAuthority: "groove-dna",
      rhythmChanged: false,
    }),
  });
}
