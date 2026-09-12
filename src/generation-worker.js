import { runGenerationRequest } from "./core/generation-api.js";

self.addEventListener("message", (event) => {
  const { requestId, kind, payload = {} } = event.data ?? {};
  try {
    const result = runGenerationRequest(kind, payload);
    self.postMessage({ requestId, ok: true, result });
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      error: error?.message || "The background composition engine failed.",
    });
  }
});
