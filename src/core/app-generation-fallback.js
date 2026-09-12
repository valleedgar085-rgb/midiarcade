import { runGenerationRequest } from "./generation-api.js";

/**
 * Create the synchronous fallback used when the generation worker is unavailable.
 * New/Similar retain the runner's overlap and validation contract; variation
 * requests use the same stable generation API as the worker.
 */
export function createAppGenerationFallback({
  generationRunner,
  runRequest = runGenerationRequest,
} = {}) {
  if (!generationRunner || typeof generationRunner.generate !== "function") {
    throw new TypeError("app generation fallback requires a generation runner");
  }
  if (typeof runRequest !== "function") {
    throw new TypeError("app generation fallback requires a generation request function");
  }

  return function generationFallback(kind, payload = {}) {
    if (kind === "sectionVariations" || kind === "songVariations") {
      return Promise.resolve(runRequest(kind, payload));
    }
    return generationRunner.generate(kind, {
      sourceSong: payload.sourceSong,
      config: payload.config,
    });
  };
}
