import { normalizeGenreId } from "./genre-contract.js";

function defaultClock() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

function cloneDetail(value) {
  if (value == null) return value;
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map((entry) => cloneDetail(entry));
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneDetail(entry)]));
}

function summarizeConfig(config = {}) {
  const brain = config?.producerBrain;
  return Object.freeze({
    seed: config?.seed == null ? null : String(config.seed),
    genre: config?.genre == null ? null : normalizeGenreId(config.genre),
    bars: Number.isFinite(Number(config?.bars)) ? Number(config.bars) : null,
    thinkingDepth: config?.thinkingDepth == null ? null : String(config.thinkingDepth),
    candidateCount: Number.isFinite(Number(config?.candidateCount)) ? Number(config.candidateCount) : null,
    adaptiveCandidates: config?.adaptiveCandidates !== false,
    weaknessAwareSearch: config?.weaknessAwareSearch !== false,
    targetedRepair: config?.targetedRepair !== false,
    producerBrain: brain ? Object.freeze({
      id: brain.id ?? null,
      version: brain.version ?? null,
      mode: brain.mode ?? null,
      blueprintId: brain.blueprint?.id ?? null,
    }) : null,
  });
}

function summarizeSong(song) {
  const search = song?.meta?.scoreDetails?.candidateSearch;
  const score = song?.meta?.scoreDetails?.totalScore
    ?? song?.meta?.score
    ?? song?.meta?.qualityScore
    ?? null;
  return Object.freeze({
    id: song?.id ?? null,
    title: song?.title ?? null,
    seed: song?.seed ?? null,
    score: Number.isFinite(Number(score)) ? Number(score) : null,
    candidateSearch: search ? cloneDetail({
      thinkingDepth: search.thinkingDepth,
      totalCandidates: search.totalCandidates,
      baseCandidateCount: search.baseCandidateCount,
      maxCandidateCount: search.maxCandidateCount,
      weakestDimension: search.weakestDimension,
      repairAttempts: search.repairAttempts,
      repairAccepted: search.repairAccepted,
      focusHistory: search.focusHistory,
    }) : null,
  });
}

/**
 * Small in-memory diagnostic recorder for generation sessions. It deliberately
 * stores summaries rather than complete songs/configs so normal use stays
 * bounded and cheap. A sink can mirror completed entries to Crashlytics or
 * another telemetry backend later without coupling core generation to it.
 */
export function createGenerationFlightRecorder({
  clock = defaultClock,
  limit = 32,
  sink = null,
} = {}) {
  const maxEntries = Math.max(4, Math.min(128, Math.round(Number(limit) || 32)));
  const entries = [];
  const active = new Map();
  let sequence = 0;

  function trim() {
    while (entries.length > maxEntries) entries.shift();
  }

  function publish(entry) {
    entries.push(Object.freeze(entry));
    trim();
    if (typeof sink === "function") {
      try { sink(entries.at(-1)); } catch { /* telemetry must never fail generation */ }
    }
  }

  return Object.freeze({
    begin(kind, { config = {}, sourceSong = null } = {}) {
      sequence += 1;
      const id = `generation-${sequence}`;
      const startedAt = Number(clock());
      active.set(id, {
        id,
        kind: String(kind),
        startedAt,
        config: summarizeConfig(config),
        sourceSongId: sourceSong?.id ?? null,
        stages: [],
      });
      return id;
    },
    mark(id, stage, detail = {}) {
      const run = active.get(id);
      if (!run) return false;
      run.stages.push(Object.freeze({
        stage: String(stage),
        at: Number(clock()),
        detail: Object.freeze(cloneDetail(detail)),
      }));
      return true;
    },
    complete(id, result) {
      const run = active.get(id);
      if (!run) return false;
      active.delete(id);
      const endedAt = Number(clock());
      publish({
        ...run,
        status: result?.status ?? "committed",
        endedAt,
        durationMs: Math.max(0, endedAt - run.startedAt),
        song: result?.song ? summarizeSong(result.song) : result?.status ? null : summarizeSong(result),
        variationCount: result?.variations?.length ?? null,
        stages: Object.freeze([...run.stages]),
      });
      return true;
    },
    fail(id, error) {
      const run = active.get(id);
      if (!run) return false;
      active.delete(id);
      const endedAt = Number(clock());
      publish({
        ...run,
        status: "failed",
        endedAt,
        durationMs: Math.max(0, endedAt - run.startedAt),
        error: Object.freeze({
          name: error?.name ?? "Error",
          message: error?.message ?? String(error),
        }),
        stages: Object.freeze([...run.stages]),
      });
      return true;
    },
    snapshot() {
      return entries.map((entry) => cloneDetail(entry));
    },
    clear() {
      entries.length = 0;
      active.clear();
    },
    get activeCount() {
      return active.size;
    },
  });
}
