import { continueElementLineage } from "./elemental-lineage.js";
import { applySectionDrumEvolutionRefinement } from "./section-drum-evolution-refinement.js";
import { applySnareBounceRefinement } from "./snare-bounce-refinement.js";

/**
 * Single authoritative post-generation musical finalizer used by both worker
 * and synchronous fallback paths. It keeps Similar lineage and bounded drum
 * refinements in one ordered contract so the two execution paths cannot drift.
 */
export function finalizeGeneratedSong(song, {
  kind = "new",
  sourceSong = null,
  config = {},
} = {}) {
  if (!song || typeof song !== "object") {
    return Object.freeze({
      song,
      diagnostics: Object.freeze({
        snareBounce: null,
        sectionDrumEvolution: null,
      }),
    });
  }

  const lineageSong = kind === "similar" && sourceSong
    ? continueElementLineage(sourceSong, song)
    : song;
  const bounced = applySnareBounceRefinement(lineageSong, config);
  const evolved = applySectionDrumEvolutionRefinement(bounced.song, config);

  return Object.freeze({
    song: evolved.song,
    diagnostics: Object.freeze({
      snareBounce: bounced.diagnostics ?? null,
      sectionDrumEvolution: evolved.diagnostics ?? null,
    }),
  });
}
