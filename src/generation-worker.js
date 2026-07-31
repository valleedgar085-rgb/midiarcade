import { generateNew, generateSectionVariations, generateSimilar } from "./music-engine.js";

self.addEventListener("message", (event) => {
  const { requestId, kind, payload = {} } = event.data ?? {};
  try {
    let result;
    if (kind === "new") {
      result = { status: "committed", song: generateNew(payload.config ?? {}) };
    } else if (kind === "similar") {
      result = { status: "committed", song: generateSimilar(payload.sourceSong, payload.config ?? {}) };
    } else if (kind === "sectionVariations") {
      result = {
        status: "committed",
        options: generateSectionVariations(payload.sourceSong, payload.sectionId, payload.input ?? {}),
      };
    } else {
      throw new TypeError(`Unknown background generation kind: ${kind}`);
    }
    self.postMessage({ requestId, ok: true, result });
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      error: error?.message || "The background composition engine failed.",
    });
  }
});
