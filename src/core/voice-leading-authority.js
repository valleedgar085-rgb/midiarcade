function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function average(values = [], fallback = 0) {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + finite(value), 0) / values.length;
}

function sortedPitches(voicing = []) {
  return [...voicing]
    .map((pitch) => Math.round(finite(pitch)))
    .filter((pitch) => pitch >= 0 && pitch <= 127)
    .sort((a, b) => a - b);
}

function alignedVoicePairs(current, previous) {
  const next = sortedPitches(current);
  const prior = sortedPitches(previous);
  if (!next.length || !prior.length) return [];

  const pairCount = Math.max(next.length, prior.length);
  if (pairCount === 1) return [[next[0], prior[0]]];

  return Array.from({ length: pairCount }, (_, index) => {
    const ratio = index / (pairCount - 1);
    const nextIndex = Math.round(ratio * (next.length - 1));
    const priorIndex = Math.round(ratio * (prior.length - 1));
    return [next[nextIndex], prior[priorIndex]];
  });
}

function commonToneCounts(current, previous) {
  const next = sortedPitches(current);
  const prior = sortedPitches(previous);
  const exact = next.filter((pitch) => prior.includes(pitch)).length;
  const priorClasses = new Set(prior.map((pitch) => ((pitch % 12) + 12) % 12));
  const pitchClass = next.filter((pitch) => priorClasses.has(((pitch % 12) + 12) % 12)).length;
  return { exact, pitchClass };
}

export function voiceLeadingMetrics(current, previous = []) {
  const next = sortedPitches(current);
  const prior = sortedPitches(previous);
  const pairs = alignedVoicePairs(next, prior);
  const leaps = pairs.map(([a, b]) => Math.abs(a - b));
  const common = commonToneCounts(next, prior);

  return Object.freeze({
    voiceCount: next.length,
    previousVoiceCount: prior.length,
    averagePitch: average(next, 0),
    span: next.length > 1 ? next.at(-1) - next[0] : 0,
    totalMotion: leaps.reduce((sum, leap) => sum + leap, 0),
    averageMotion: average(leaps, 0),
    maxMotion: leaps.length ? Math.max(...leaps) : 0,
    topVoiceLeap: prior.length && next.length ? Math.abs(next.at(-1) - prior.at(-1)) : 0,
    bottomVoiceLeap: prior.length && next.length ? Math.abs(next[0] - prior[0]) : 0,
    exactCommonTones: common.exact,
    pitchClassCommonTones: common.pitchClass,
    alignedLeaps: Object.freeze(leaps),
  });
}

export function scoreVoiceLeadingCandidate(
  current,
  previous = [],
  {
    targetCenter = 60,
    preferredMaxStep = 4,
    registerWeight = 0.35,
    motionWeight = 1,
    topVoiceWeight = 0.8,
    bottomVoiceWeight = 0.45,
    excessLeapWeight = 1.35,
    exactCommonToneReward = 1.6,
    pitchClassCommonToneReward = 0.35,
    wideSpanThreshold = 24,
    wideSpanWeight = 0.18,
  } = {},
) {
  const next = sortedPitches(current);
  if (!next.length) return Number.POSITIVE_INFINITY;

  const metrics = voiceLeadingMetrics(next, previous);
  const registerPenalty = Math.abs(metrics.averagePitch - finite(targetCenter, 60)) * registerWeight;
  const wideSpanPenalty = Math.max(0, metrics.span - wideSpanThreshold) * wideSpanWeight;

  if (!previous?.length) {
    return registerPenalty + wideSpanPenalty;
  }

  const excessLeapPenalty = metrics.alignedLeaps.reduce((sum, leap) => (
    sum + Math.max(0, leap - preferredMaxStep) ** 2 * excessLeapWeight
  ), 0);

  return (
    metrics.totalMotion * motionWeight
    + metrics.topVoiceLeap * topVoiceWeight
    + metrics.bottomVoiceLeap * bottomVoiceWeight
    + excessLeapPenalty
    + registerPenalty
    + wideSpanPenalty
    - metrics.exactCommonTones * exactCommonToneReward
    - metrics.pitchClassCommonTones * pitchClassCommonToneReward
  );
}

function candidateKey(voicing = []) {
  return sortedPitches(voicing).join(",");
}

export function rankVoiceLeadingCandidates(candidates = [], previous = [], options = {}) {
  const unique = new Map();
  for (const candidate of candidates) {
    const pitches = sortedPitches(candidate);
    if (!pitches.length) continue;
    unique.set(candidateKey(pitches), pitches);
  }

  return Object.freeze(
    [...unique.values()]
      .map((pitches) => Object.freeze({
        pitches: Object.freeze(pitches),
        score: scoreVoiceLeadingCandidate(pitches, previous, options),
        metrics: voiceLeadingMetrics(pitches, previous),
      }))
      .sort((left, right) => (
        left.score - right.score
        || candidateKey(left.pitches).localeCompare(candidateKey(right.pitches))
      )),
  );
}

export function selectVoiceLeadingCandidate(candidates = [], previous = [], options = {}) {
  const ranked = rankVoiceLeadingCandidates(candidates, previous, options);
  return ranked.length ? [...ranked[0].pitches] : [];
}
