import { buildGenerationPersistenceSnapshot } from "./generation-persistence.js";

let sequence = 0;

function nowIso(clock) {
  const value = clock();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function safeToken(value, fallback) {
  const token = String(value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "-");
  return token || fallback;
}

export function createGenerationPersistenceService({
  store,
  clock = () => Date.now(),
  engineVersion = null,
  onError = null,
} = {}) {
  if (!store || typeof store.saveGenerationSnapshot !== "function") {
    throw new TypeError("generation persistence service requires a snapshot store");
  }

  return Object.freeze({
    async saveCommitted({
      kind = "new",
      song,
      config = {},
      startedAt = null,
      completedAt = null,
    } = {}) {
      if (!song) return { ok: false, reason: "missing-song" };
      const seed = safeToken(config.seed ?? song.seed, "unseeded");
      const songId = safeToken(song.id ?? song.songId ?? `song-${seed}`, `song-${seed}`);
      const runId = `run-${seed}-${Number(clock())}-${++sequence}`;
      try {
        const snapshot = buildGenerationPersistenceSnapshot({
          runId,
          songId,
          kind,
          config,
          song,
          engineVersion,
          startedAt: startedAt ?? nowIso(clock),
          completedAt: completedAt ?? nowIso(clock),
        });
        return await store.saveGenerationSnapshot(snapshot);
      } catch (error) {
        onError?.(error, { kind, songId, runId });
        return {
          ok: false,
          reason: "write-failed",
          error,
          runId,
          songId,
        };
      }
    },
  });
}
