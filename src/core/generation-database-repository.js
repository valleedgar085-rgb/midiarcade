function defaultPluginProvider() {
  if (typeof window === "undefined") return null;
  return window?.Capacitor?.Plugins?.GenerationDatabase ?? null;
}

function normalizeLimit(value) {
  const number = Math.round(Number(value) || 0);
  return Math.max(1, Math.min(100, number || 12));
}

export function createGenerationDatabaseRepository({
  pluginProvider = defaultPluginProvider,
  onError = null,
} = {}) {
  if (typeof pluginProvider !== "function") {
    throw new TypeError("generation database repository requires a plugin provider");
  }

  function report(error) {
    if (typeof onError !== "function") return;
    try {
      onError(error instanceof Error ? error : new Error(String(error)));
    } catch {
      // Reporting must never turn persistence into a generation failure.
    }
  }

  function plugin() {
    try {
      return pluginProvider() ?? null;
    } catch (error) {
      report(error);
      return null;
    }
  }

  async function persist(record) {
    if (!record || record.schema !== "midi-arcade/generation-record@1") {
      throw new TypeError("generation database repository requires a generation record");
    }
    const native = plugin();
    if (typeof native?.persistGeneration !== "function") {
      return Object.freeze({ ok: false, reason: "unavailable" });
    }
    try {
      const result = await native.persistGeneration({ record });
      return Object.freeze({
        ok: result?.ok !== false,
        reason: result?.reason ?? null,
        songId: result?.songId ?? record.song?.id ?? null,
        generationRunId: result?.generationRunId ?? record.generationRun?.id ?? null,
      });
    } catch (error) {
      report(error);
      return Object.freeze({
        ok: false,
        reason: "native-error",
        message: error?.message ?? String(error),
      });
    }
  }

  async function recentRuns(limit = 12) {
    const native = plugin();
    if (typeof native?.recentRuns !== "function") return [];
    try {
      const result = await native.recentRuns({ limit: normalizeLimit(limit) });
      return Array.isArray(result?.runs) ? result.runs : [];
    } catch (error) {
      report(error);
      return [];
    }
  }

  return Object.freeze({
    persist,
    recentRuns,
    get available() {
      return typeof plugin()?.persistGeneration === "function";
    },
  });
}
