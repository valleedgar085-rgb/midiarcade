import {
  createArrangementEvolution,
  evolveSongArrangement,
} from "./arrangement-evolution.js";

export const MAX_ARRANGEMENT_CANDIDATES = 3;
const MAX_SEED_ATTEMPTS = 12;

function boundedCandidateLimit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MAX_ARRANGEMENT_CANDIDATES;
  return Math.max(1, Math.min(MAX_ARRANGEMENT_CANDIDATES, Math.round(numeric)));
}

function sectionOrderKey(song) {
  const sections = song?.structure ?? song?.sections;
  if (!Array.isArray(sections)) return "";
  return sections.map((section) => String(section?.id ?? "")).join(">");
}

/**
 * Build a tiny deterministic audition pool from the same generated song.
 * Candidates differ only by complete-section ordering: no notes are composed,
 * removed, retuned, or quantized here. The caller still owns critic/release
 * evaluation and may reject every candidate.
 */
export function createArrangementCandidates(sourceSong, config = {}, {
  maxCandidates = MAX_ARRANGEMENT_CANDIDATES,
} = {}) {
  const evolution = createArrangementEvolution(config);
  if (!evolution.enabled) return [];

  const sourceOrder = sectionOrderKey(sourceSong);
  if (!sourceOrder) return [];

  const limit = boundedCandidateLimit(maxCandidates);
  const baseSeed = String(config.seed ?? `${evolution.genre}:arrangement`);
  const seenOrders = new Set([sourceOrder]);
  const candidates = [];
  const attempts = Math.min(MAX_SEED_ATTEMPTS, Math.max(4, limit * 4));

  for (let attemptIndex = 0; attemptIndex < attempts && candidates.length < limit; attemptIndex += 1) {
    const candidateSeed = `${baseSeed}:arrangement-audition:${attemptIndex}`;
    const evolved = evolveSongArrangement(sourceSong, {
      ...config,
      seed: candidateSeed,
      arrangementEvolution: true,
    });
    if (!evolved.changed) continue;

    const orderKey = sectionOrderKey(evolved.song);
    if (!orderKey || seenOrders.has(orderKey)) continue;
    seenOrders.add(orderKey);

    const candidateIndex = candidates.length;
    evolved.song.outputQualityEvolution = {
      ...(evolved.song.outputQualityEvolution ?? {}),
      arrangement: {
        ...(evolved.song.outputQualityEvolution?.arrangement ?? {}),
        audition: {
          candidateIndex,
          attemptIndex,
          limit,
        },
      },
    };
    candidates.push(Object.freeze({
      candidateIndex,
      attemptIndex,
      orderKey,
      song: evolved.song,
      evolution: evolved.evolution,
    }));
  }

  return candidates;
}
