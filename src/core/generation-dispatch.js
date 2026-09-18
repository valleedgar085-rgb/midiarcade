const GENERATION_HANDLERS = Object.freeze({
  new: Object.freeze({
    engineMethod: "generateNew",
    run(fn, payload) {
      return { status: "committed", song: fn(payload.config ?? {}) };
    },
  }),
  similar: Object.freeze({
    engineMethod: "generateSimilar",
    run(fn, payload) {
      return {
        status: "committed",
        song: fn(payload.sourceSong, payload.config ?? {}),
      };
    },
  }),
  sectionVariations: Object.freeze({
    engineMethod: "generateSectionVariations",
    run(fn, payload) {
      return {
        status: "committed",
        options: fn(payload.sourceSong, payload.sectionId, payload.input ?? {}),
      };
    },
  }),
  songVariations: Object.freeze({
    engineMethod: "generateSongVariations",
    run(fn, payload) {
      return {
        status: "committed",
        variations: fn(payload.sourceSong, payload.config ?? {}),
      };
    },
  }),
});

function requireFunction(engine, name) {
  const fn = engine?.[name];
  if (typeof fn !== "function") {
    throw new TypeError(`generation engine is missing ${name}`);
  }
  return fn;
}

export function isGenerationKind(kind) {
  return Object.prototype.hasOwnProperty.call(GENERATION_HANDLERS, String(kind));
}

/**
 * Pure command boundary for every heavy generation request. Request routing is
 * data-driven so workers, fallbacks and future producer orchestration share one
 * exact command contract.
 */
export function dispatchGenerationRequest(kind, payload = {}, engine = {}) {
  const requestKind = String(kind);
  const handler = GENERATION_HANDLERS[requestKind];
  if (!handler) {
    throw new TypeError(`Unknown background generation kind: ${requestKind}`);
  }
  const fn = requireFunction(engine, handler.engineMethod);
  return handler.run(fn, payload);
}
