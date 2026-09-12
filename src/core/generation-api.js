import {
  generateNew,
  generateSectionVariations,
  generateSimilar,
  generateSongVariations,
} from "../music-engine.js";
import { dispatchGenerationRequest } from "./generation-dispatch.js";

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
  return dispatchGenerationRequest(kind, payload, ENGINE_API);
}

export const generationEngineApi = ENGINE_API;
