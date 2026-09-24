import { continueElementLineage } from "./elemental-lineage.js";

function retiredRhythmDiagnostic(id) {
  return Object.freeze({
    version: 1,
    id,
    attempted: false,
    accepted: false,
    changed: false,
    reason: "retired-groove-dna-authority",
  });
}

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
        snareBounce: null,
        sectionDrumEvolution: null,
        rhythmAuthority: "groove-dna",
      }),
    });
  }

  const lineageSong = kind === "similar" && sourceSong
    ? continueElementLineage(sourceSong, song)
    : song;

  return Object.freeze({
    song: lineageSong,
    diagnostics: Object.freeze({
      snareBounce: retiredRhythmDiagnostic("snare-bounce"),
      sectionDrumEvolution: retiredRhythmDiagnostic("section-drum-evolution"),
      rhythmAuthority: "groove-dna",
    }),
  });
}
