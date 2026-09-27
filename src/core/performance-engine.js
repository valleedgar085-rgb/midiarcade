const LAIDBACK_GENRES = new Set(["neoSoul", "loFiHipHop", "rnbSoul"]);
const GRID_GENRES = new Set(["house", "techno", "synthwave", "trap"]);

const ROLE_TIMING_RANGE = Object.freeze({
  drums: 0.003,
  bass: 0.004,
  chords: 0.005,
  lead: 0.007,
  counter: 0.007,
  arp: 0.003,
  fx: 0.002,
});

const ROLE_DURATION_RANGE = Object.freeze({
  drums: 0.03,
  bass: 0.08,
  chords: 0.07,
  lead: 0.1,
  counter: 0.09,
  arp: 0.05,
  fx: 0.04,
});

const ROLE_VELOCITY_RANGE = Object.freeze({
  drums: 5,
  bass: 4,
  chords: 3,
  lead: 5,
  counter: 4,
  arp: 3,
  fx: 2,
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round((finite(value, 0) + Number.EPSILON) * factor) / factor;
}

function stableUnit(key) {
  let hash = 2166136261;
  for (const char of String(key)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function signedPhase(key) {
  return stableUnit(key) * 2 - 1;
}

function drumFamily(event) {
  const midi = Math.round(finite(
    event?.semanticPitch?.midiNote,
    event?.renderedMidiPitch,
  ));
  if ([35, 36].includes(midi)) return "kick";
  if ([38, 40].includes(midi)) return "snare";
  if ([42, 44, 46].includes(midi)) return "hat";
  if ([39].includes(midi)) return "clap";
  return "percussion";
}

function isSnare(event) {
  return event?.roleId === "drums" && drumFamily(event) === "snare";
}

function correlatedPhraseKey(event) {
  return [
    event?.sectionId ?? "song",
    event?.motifId ?? event?.phraseRole ?? "phrase",
    event?.roleId ?? "role",
  ].join("|");
}

function accentDelta(event) {
  const beat = finite(event?.canonical?.startBeat, event?.time);
  const position = ((beat % 4) + 4) % 4;
  const family = drumFamily(event);
  if (event?.roleId === "drums") {
    if (family === "kick" && (Math.abs(position) < 1e-6 || Math.abs(position - 2) < 1e-6)) return 4;
    if (family === "snare" && (Math.abs(position - 1) < 1e-6 || Math.abs(position - 3) < 1e-6)) return 5;
    if (family === "hat" && Math.abs(position % 1) < 1e-6) return 2;
  }
  if (["answer", "resolution", "landing", "payoff"].includes(String(event?.phraseRole))) return 3;
  if (["question", "setup"].includes(String(event?.phraseRole))) return -1;
  return 0;
}

function articulationFor(event, durationScale) {
  const existing = String(event?.articulation ?? event?.performed?.articulation ?? "normal");
  if (existing !== "normal" && existing !== "short") return existing;
  if (durationScale <= 0.9) return "short";
  if (durationScale >= 1.08 && ["lead", "counter", "chords"].includes(event?.roleId)) return "connected";
  return existing;
}

function timingPolicy(event, genre, amount, seed) {
  if (amount <= 0 || event?.intent?.locked) return 0;

  let deliberate = 0;
  if (LAIDBACK_GENRES.has(genre) && (event?.roleId === "bass" || isSnare(event))) {
    deliberate = 0.016;
  }

  const phraseRange = (ROLE_TIMING_RANGE[event?.roleId] ?? 0.004) * 0.55;
  const localRange = (ROLE_TIMING_RANGE[event?.roleId] ?? 0.004) * 0.45;
  const attenuation = GRID_GENRES.has(genre) ? 0.5 : 1;
  const phraseDrift = signedPhase(`${seed}|phrase|${correlatedPhraseKey(event)}`) * phraseRange;
  const localMotion = signedPhase(`${seed}|event|${event?.id}|timing`) * localRange;

  return round((deliberate + (phraseDrift + localMotion) * attenuation) * amount);
}

function durationPolicy(event, amount, seed) {
  if (amount <= 0 || event?.intent?.locked) return 1;
  const range = ROLE_DURATION_RANGE[event?.roleId] ?? 0.06;
  const phraseMotion = signedPhase(`${seed}|duration|${correlatedPhraseKey(event)}`) * range * 0.65;
  const localMotion = signedPhase(`${seed}|duration|${event?.id}`) * range * 0.35;
  let phraseShape = 0;
  if (["resolution", "landing", "payoff"].includes(String(event?.phraseRole))) phraseShape = 0.06;
  if (["question", "pickup"].includes(String(event?.phraseRole))) phraseShape = -0.05;
  return clamp(1 + (phraseMotion + localMotion + phraseShape) * amount, 0.72, 1.24);
}

function velocityPolicy(event, amount, seed) {
  if (amount <= 0 || event?.intent?.locked) return 0;
  const range = ROLE_VELOCITY_RANGE[event?.roleId] ?? 3;
  const phraseMotion = signedPhase(`${seed}|velocity|${correlatedPhraseKey(event)}`) * range * 0.55;
  const localMotion = signedPhase(`${seed}|velocity|${event?.id}`) * range * 0.45;
  return (phraseMotion + localMotion + accentDelta(event)) * amount;
}

function performEvent(event, { genre, bpm, amount, seed, totalBeats }) {
  if (amount <= 0 || event?.intent?.locked) return event;

  const canonical = event?.canonical ?? {
    startBeat: finite(event?.time, 0),
    durationBeats: finite(event?.duration, 0),
    renderedMidiPitch: Math.round(finite(event?.renderedMidiPitch, 60)),
    velocity: Math.round(clamp(event?.velocity, 1, 127)),
  };
  const timingDeltaBeats = timingPolicy(event, genre, amount, seed);
  const durationScale = durationPolicy(event, amount, seed);
  const velocityDelta = velocityPolicy(event, amount, seed);
  const startBeat = clamp(
    canonical.startBeat + timingDeltaBeats,
    0,
    Math.max(0, totalBeats - 1 / 960),
  );
  const maxDuration = Math.max(1 / 960, totalBeats - startBeat);
  const durationBeats = clamp(
    Math.max(1 / 960, canonical.durationBeats * durationScale),
    1 / 960,
    maxDuration,
  );
  const velocity = Math.round(clamp(canonical.velocity + velocityDelta, 1, 127));
  const performed = Object.freeze({
    startBeat: round(startBeat),
    durationBeats: round(durationBeats),
    renderedMidiPitch: Math.round(clamp(canonical.renderedMidiPitch, 0, 127)),
    velocity,
    articulation: articulationFor(event, durationScale),
    microtimingMs: round(timingDeltaBeats * 60000 / Math.max(1, bpm), 3),
    timingDeltaBeats: round(startBeat - canonical.startBeat),
    durationDeltaBeats: round(durationBeats - canonical.durationBeats),
    velocityDelta: velocity - canonical.velocity,
  });

  return Object.freeze({
    ...event,
    time: performed.startBeat,
    duration: performed.durationBeats,
    renderedMidiPitch: performed.renderedMidiPitch,
    velocity: performed.velocity,
    articulation: performed.articulation,
    microtimingMs: performed.microtimingMs,
    performed,
  });
}

export function applyPerformanceEngine(gauntletSong, {
  humanize = 1,
  seed = gauntletSong?.sourceSeed ?? gauntletSong?.id ?? "performance",
} = {}) {
  if (!gauntletSong || !Array.isArray(gauntletSong.musicalEvents)) {
    throw new TypeError("applyPerformanceEngine requires a GauntletSong with musicalEvents");
  }

  const amount = clamp(humanize, 0, 1);
  const genre = String(gauntletSong?.intent?.genre ?? "unknown");
  const bpm = clamp(gauntletSong?.intent?.bpm ?? 120, 30, 300);
  const totalBeats = Math.max(1 / 960, finite(gauntletSong?.totalBeats, 1));
  const events = Object.freeze(
    gauntletSong.musicalEvents.map((event) => performEvent(event, {
      genre,
      bpm,
      amount,
      seed,
      totalBeats,
    })),
  );

  const changed = events.filter((event, index) => event !== gauntletSong.musicalEvents[index]);
  const timingDeltas = changed.map((event) => Math.abs(finite(event?.performed?.timingDeltaBeats, 0)));

  return Object.freeze({
    version: 1,
    id: "performance-engine-v1",
    deterministic: true,
    humanize: amount,
    genre,
    seed: String(seed),
    events,
    metrics: Object.freeze({
      totalEvents: events.length,
      changedEvents: changed.length,
      maxTimingDeltaBeats: timingDeltas.length ? round(Math.max(...timingDeltas)) : 0,
      preservedLockedEvents: gauntletSong.musicalEvents.filter((event) => event?.intent?.locked).length,
    }),
  });
}
