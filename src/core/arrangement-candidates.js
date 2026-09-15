import {
  createArrangementEvolution,
  evolveSongArrangement,
} from "./arrangement-evolution.js";

export const MAX_ARRANGEMENT_CANDIDATES = 3;
const MAX_SEED_ATTEMPTS = 12;

const PAYOFF_NAMES = new Set(["chorus", "drop", "theme"]);
const CONTRAST_NAMES = new Set(["bridge", "breakdown"]);
const STORY_NAMES = new Set(["verse", "idea", "solo"]);

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

function sectionNames(song) {
  const sections = song?.structure ?? song?.sections;
  return Array.isArray(sections)
    ? sections.map((section) => String(section?.name ?? "idea").toLowerCase())
    : [];
}

function indicesOf(names, predicate) {
  const result = [];
  names.forEach((name, index) => {
    if (predicate(name)) result.push(index);
  });
  return result;
}

function familyFitScore(names, family) {
  if (!names.length) return 0;
  const payoff = indicesOf(names, (name) => PAYOFF_NAMES.has(name));
  const contrast = indicesOf(names, (name) => CONTRAST_NAMES.has(name));
  const story = indicesOf(names, (name) => STORY_NAMES.has(name));
  const bodyStart = names[0] === "intro" ? 1 : 0;
  const lastBody = names.at(-1) === "outro" ? names.length - 2 : names.length - 1;
  const firstPayoff = payoff[0] ?? -1;
  const finalPayoff = payoff.at(-1) ?? -1;
  let score = 0;

  if (names[0] === "intro") score += 0.7;
  if (names.at(-1) === "outro") score += 0.45;
  if (finalPayoff >= 0) score += 0.9 * (finalPayoff / Math.max(1, lastBody));
  if (story.some((index) => index >= bodyStart && (firstPayoff < 0 || index < firstPayoff))) score += 0.55;
  if (finalPayoff >= 0 && contrast.some((index) => index > bodyStart && index < finalPayoff)) score += 0.7;
  if (finalPayoff > 0 && contrast.includes(finalPayoff - 1)) score += 0.65;
  for (let index = bodyStart + 1; index <= lastBody; index += 1) {
    if (names[index] === names[index - 1]) score -= 0.35;
  }

  if (["hook-first", "early-impact"].includes(family)) {
    if (firstPayoff === bodyStart) score += 0.9;
    if (finalPayoff > firstPayoff) score += 0.35;
  } else if (family === "verse-driven") {
    if (story.includes(bodyStart)) score += 0.65;
    if (story.includes(bodyStart + 1)) score += 0.35;
    if (firstPayoff >= bodyStart + 2) score += 0.55;
  } else if (family === "bridge-payoff") {
    if (finalPayoff > bodyStart && contrast.includes(finalPayoff - 1)) score += 1;
  } else if (family === "slow-bloom") {
    if (finalPayoff >= Math.max(bodyStart + 1, Math.floor(names.length * 0.55))) score += 1;
  } else if (["double-peak", "hypnotic-wave"].includes(family)) {
    if (payoff.length >= 2) {
      const first = payoff[0];
      const second = payoff[1];
      if (contrast.some((index) => index > first && index < second)) score += 1;
    }
  } else if (family === "loop-development") {
    const firstStory = story[0] ?? -1;
    if (firstStory >= bodyStart && contrast.includes(firstStory + 1)) score += 0.8;
  }

  return Math.round(score * 1000) / 1000;
}

function compareNarrativeCandidates(left, right) {
  const scoreDelta = right.narrativeScore - left.narrativeScore;
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  return left.attemptIndex - right.attemptIndex;
}

/**
 * Build a tiny deterministic audition pool from the same generated song.
 * The discovery pass may inspect the existing bounded seed-attempt budget, but
 * only the three strongest narrative shapes are returned to the expensive
 * critic/release audition. No notes are composed, removed, retuned or quantized.
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
  const discovered = [];
  const attempts = Math.min(MAX_SEED_ATTEMPTS, Math.max(4, limit * 4));

  for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
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
    discovered.push({
      attemptIndex,
      orderKey,
      narrativeScore: familyFitScore(sectionNames(evolved.song), evolved.evolution.family),
      song: evolved.song,
      evolution: evolved.evolution,
    });
  }

  return discovered
    .sort(compareNarrativeCandidates)
    .slice(0, limit)
    .map((candidate, candidateIndex) => {
      candidate.song.outputQualityEvolution = {
        ...(candidate.song.outputQualityEvolution ?? {}),
        arrangement: {
          ...(candidate.song.outputQualityEvolution?.arrangement ?? {}),
          audition: {
            candidateIndex,
            attemptIndex: candidate.attemptIndex,
            limit,
            narrativeScore: candidate.narrativeScore,
            discoveredCandidates: discovered.length,
          },
        },
      };
      return Object.freeze({
        candidateIndex,
        attemptIndex: candidate.attemptIndex,
        orderKey: candidate.orderKey,
        narrativeScore: candidate.narrativeScore,
        song: candidate.song,
        evolution: candidate.evolution,
      });
    });
}
