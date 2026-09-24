const DIRECT_PRIORS = Object.freeze({
  hiphop: Object.freeze({
    sourceStyles: Object.freeze(["hiphop"]),
    performances: 34,
    sampleBars: 866.357816,
    kickHitsPerBar: 4.567397,
    kickBeforeSnareRate: 0.445207,
    hatSyncopationRate: 0.208992,
    hatSwingOffset16: -0.078568,
  }),
  pop: Object.freeze({
    sourceStyles: Object.freeze(["pop"]),
    performances: 15,
    sampleBars: 315.836981,
    kickHitsPerBar: 2.805245,
    kickBeforeSnareRate: 0.29028,
    hatSyncopationRate: 0.161513,
    hatSwingOffset16: -0.148851,
  }),
  rock: Object.freeze({
    sourceStyles: Object.freeze(["rock"]),
    performances: 6,
    sampleBars: 212.890278,
    kickHitsPerBar: 4.17586,
    kickBeforeSnareRate: 0.652182,
    hatSyncopationRate: 0.161046,
    hatSwingOffset16: -0.093827,
  }),
  soul: Object.freeze({
    sourceStyles: Object.freeze(["soul"]),
    performances: 28,
    sampleBars: 618.218753,
    kickHitsPerBar: 3.775363,
    kickBeforeSnareRate: 0.417624,
    hatSyncopationRate: 0.173279,
    hatSwingOffset16: -0.10179,
  }),
  funk: Object.freeze({
    sourceStyles: Object.freeze(["funk"]),
    performances: 53,
    sampleBars: 2466.218231,
    kickHitsPerBar: 4.12575,
    kickBeforeSnareRate: 0.474701,
    hatSyncopationRate: 0.17462,
    hatSwingOffset16: -0.07464,
  }),
  country: Object.freeze({
    sourceStyles: Object.freeze(["country"]),
    performances: 2,
    sampleBars: 120.065625,
    kickHitsPerBar: 2.981703,
    kickBeforeSnareRate: 0.353243,
    hatSyncopationRate: 0.009395,
    hatSwingOffset16: -0.188412,
  }),
  afrobeat: Object.freeze({
    sourceStyles: Object.freeze(["afrobeat", "highlife"]),
    performances: 15,
    sampleBars: 1128.326563,
    kickHitsPerBar: 5.018926,
    kickBeforeSnareRate: 0.606125,
    hatSyncopationRate: 0.104419,
    hatSwingOffset16: -0.088965,
  }),
  latin: Object.freeze({
    sourceStyles: Object.freeze(["latin"]),
    performances: 1,
    sampleBars: 180.094167,
    kickHitsPerBar: 1.29932,
    kickBeforeSnareRate: 0.242747,
    hatSyncopationRate: 0.094595,
    hatSwingOffset16: -0.122396,
  }),
  dance: Object.freeze({
    sourceStyles: Object.freeze(["dance"]),
    performances: 7,
    sampleBars: 550.677604,
    kickHitsPerBar: 4.147617,
    kickBeforeSnareRate: 0.485654,
    hatSyncopationRate: 0.346754,
    hatSwingOffset16: -0.127272,
  }),
  jazz: Object.freeze({
    sourceStyles: Object.freeze(["jazz"]),
    performances: 2,
    sampleBars: 218.153473,
    kickHitsPerBar: 1.5402,
    kickBeforeSnareRate: 0.23251,
    hatSyncopationRate: 0.244494,
    hatSwingOffset16: 0.260607,
  }),
});

const GENRE_PRIOR_POLICY = Object.freeze({
  hipHop: Object.freeze({ prior: "hiphop", confidence: 0.95, cap: 0.18 }),
  rap: Object.freeze({ prior: "hiphop", confidence: 0.88, cap: 0.16 }),
  trap: Object.freeze({ prior: "hiphop", confidence: 0.42, cap: 0.07 }),
  drill: Object.freeze({ prior: "hiphop", confidence: 0.34, cap: 0.055 }),
  loFiHipHop: Object.freeze({ prior: "hiphop", confidence: 0.68, cap: 0.11 }),
  pop: Object.freeze({ prior: "pop", confidence: 0.9, cap: 0.16 }),
  popRadio: Object.freeze({ prior: "pop", confidence: 0.86, cap: 0.15 }),
  synthPopRadio: Object.freeze({ prior: "pop", confidence: 0.54, cap: 0.08 }),
  rock: Object.freeze({ prior: "rock", confidence: 0.82, cap: 0.14 }),
  rnbSoul: Object.freeze({ prior: "soul", confidence: 0.94, cap: 0.17 }),
  neoSoul: Object.freeze({ prior: "soul", confidence: 0.82, cap: 0.14 }),
  // Sparse-role genres stay diagnostic-only until their density calibration is explicitly re-baselined.\n  funk: Object.freeze({ prior: "funk", confidence: 0.98, cap: 0 }),
  country: Object.freeze({ prior: "country", confidence: 0.52, cap: 0.08 }),
  afrobeats: Object.freeze({ prior: "afrobeat", confidence: 0.86, cap: 0 }),
  reggaeton: Object.freeze({ prior: "latin", confidence: 0.3, cap: 0.045 }),
  house: Object.freeze({ prior: "dance", confidence: 0.52, cap: 0.05, protectFourFloor: true }),
  techno: Object.freeze({ prior: "dance", confidence: 0.46, cap: 0.04, protectFourFloor: true }),
  synthwave: Object.freeze({ prior: "dance", confidence: 0.32, cap: 0.035 }),
  drumBass: Object.freeze({ prior: "dance", confidence: 0.22, cap: 0 }),
  jazz: Object.freeze({ prior: "jazz", confidence: 0.42, cap: 0.025, preserveGrammar: true }),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function priorSummary(genre, policy, prior) {
  return Object.freeze({
    genre,
    sourceStyles: prior.sourceStyles,
    performances: prior.performances,
    sampleBars: prior.sampleBars,
    kickHitsPerBar: prior.kickHitsPerBar,
    kickBeforeSnareRate: prior.kickBeforeSnareRate,
    hatSyncopationRate: prior.hatSyncopationRate,
    hatSwingOffset16: prior.hatSwingOffset16,
    confidence: policy.confidence,
    influenceCap: policy.cap,
    protectFourFloor: Boolean(policy.protectFourFloor),
    preserveGrammar: Boolean(policy.preserveGrammar),
  });
}

export function humanGroovePriorForGenre(genre) {
  const id = String(genre ?? "");
  const policy = GENRE_PRIOR_POLICY[id];
  const prior = policy ? DIRECT_PRIORS[policy.prior] : null;
  return prior ? priorSummary(id, policy, prior) : null;
}

export function humanGrooveInfluence(config = {}, prior = humanGroovePriorForGenre(config.genre)) {
  if (!prior) return 0;
  const variation = clamp(config.variation ?? 0.5, 0, 1);
  const evolution = clamp(config.evolution ?? 0.5, 0, 1);
  const evidence = clamp(Math.log10(Math.max(10, prior.sampleBars)) / 4, 0.35, 0.9);
  const requested = prior.confidence * evidence * (0.1 + variation * 0.055 + evolution * 0.035);
  return round(Math.min(prior.influenceCap, requested));
}

export const HUMAN_GROOVE_PRIOR_VERSION = "1.0";
