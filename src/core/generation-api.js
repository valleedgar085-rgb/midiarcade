import {
  generateNew,
  generateSectionVariations,
  generateSimilar,
} from "../music-engine.js";
import { dispatchGenerationRequest } from "./generation-dispatch.js";
import { generateProducerVariationSet } from "./producer-variation-set.js";
import { finalizeGeneratedSong } from "./generation-finalizer.js";

function generateSongVariations(sourceSong, config = {}) {
  return generateProducerVariationSet(sourceSong, config, { generateSimilar });
}

const ENGINE_API = Object.freeze({
  generateNew,
  generateSimilar,
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
  const finalized = finalizeGeneratedSong(result.song, {
    kind,
    sourceSong: payload.sourceSong ?? null,
    config: payload.config ?? {},
  });
  return finalized.song === result.song ? result : { ...result, song: finalized.song };
}

export const generationEngineApi = ENGINE_API;
