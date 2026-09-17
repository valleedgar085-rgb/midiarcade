import {
  generateNew,
  generateSectionVariations,
  generateSimilar,
} from "../music-engine.js";
import { dispatchGenerationRequest } from "./generation-dispatch.js";
import { continueElementLineage } from "./elemental-lineage.js";
import { generateProducerVariationSet } from "./producer-variation-set.js";
import { applySectionDrumEvolutionRefinement } from "./section-drum-evolution-refinement.js";
import { applyTrapStagedBuildRefinement } from "./trap-staged-build-refinement.js";
import { applySnareBounceRefinement } from "./snare-bounce-refinement.js";

function generateSongVariations(sourceSong, config = {}) {
  return generateProducerVariationSet(sourceSong, config, { generateSimilar });
}

function generateSimilarWithElementLineage(sourceSong, config = {}) {
  return continueElementLineage(sourceSong, generateSimilar(sourceSong, config));
}

const ENGINE_API = Object.freeze({
  generateNew,
  generateSimilar: generateSimilarWithElementLineage,
  generateSectionVariations,
  generateSongVariations,
});

/**
 * Stable application-facing generation boundary. The composition engine stays
 * authoritative for musical behavior while callers depend on this smaller API.
 */
export function runGenerationRequest(kind, payload = {}) {
  const result = dispatchGenerationRequest(kind, payload, ENGINE_API);
  if (!result?.song || !["new", "similar"].includes(String(kind))) return result;
  const config = payload.config ?? {};
  const bounced = applySnareBounceRefinement(result.song, config);
  const evolved = applySectionDrumEvolutionRefinement(bounced.song, config);
  const staged = applyTrapStagedBuildRefinement(evolved.song, config);
  return staged.song === result.song ? result : { ...result, song: staged.song };
}

export const generationEngineApi = ENGINE_API;
