import {
  generateNew,
  generateSectionVariations,
  generateSimilar,
} from "../music-engine.js";
import { dispatchGenerationRequest } from "./generation-dispatch.js";
import { continueElementLineage } from "./elemental-lineage.js";
import { generateProducerVariationSet } from "./producer-variation-set.js";
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
  const refined = applySnareBounceRefinement(result.song, payload.config ?? {});
  return refined.song === result.song ? result : { ...result, song: refined.song };
}

export const generationEngineApi = ENGINE_API;
