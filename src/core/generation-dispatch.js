const GENERATION_KINDS = Object.freeze(new Set([
  "new",
  "similar",
  "sectionVariations",
  "songVariations",
]));

function requireFunction(engine, name) {
  const fn = engine?.[name];
  if (typeof fn !== "function") {
    throw new TypeError(`generation engine is missing ${name}`);
  }
  return fn;
}

export function isGenerationKind(kind) {
  return GENERATION_KINDS.has(String(kind));
}

/**
 * Pure command boundary for every heavy generation request. Keeping request
 * routing here prevents the worker, UI fallback, and future producer-brain
 * orchestration from each growing their own slightly different switch tree.
 */
export function dispatchGenerationRequest(kind, payload = {}, engine = {}) {
  const requestKind = String(kind);
  if (!isGenerationKind(requestKind)) {
    throw new TypeError(`Unknown background generation kind: ${requestKind}`);
  }

  if (requestKind === "new") {
    const generateNew = requireFunction(engine, "generateNew");
    return { status: "committed", song: generateNew(payload.config ?? {}) };
  }

  if (requestKind === "similar") {
    const generateSimilar = requireFunction(engine, "generateSimilar");
    return {
      status: "committed",
      song: generateSimilar(payload.sourceSong, payload.config ?? {}),
    };
  }

  if (requestKind === "sectionVariations") {
    const generateSectionVariations = requireFunction(engine, "generateSectionVariations");
    return {
      status: "committed",
      options: generateSectionVariations(
        payload.sourceSong,
        payload.sectionId,
        payload.input ?? {},
      ),
    };
  }

  const generateSongVariations = requireFunction(engine, "generateSongVariations");
  return {
    status: "committed",
    variations: generateSongVariations(payload.sourceSong, payload.config ?? {}),
  };
}
