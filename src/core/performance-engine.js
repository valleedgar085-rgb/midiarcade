const LAIDBACK_GENRES = new Set(["neoSoul", "loFiHipHop", "rnbSoul"]);
const GRID_GENRES = new Set(["house", "techno", "synthwave", "trap"]);

const GENRE_PERFORMANCE_SCALE = Object.freeze({
  house: Object.freeze({
    timing: 0.15,
    duration: 0.45,
    velocity: 0.65,
  }),
  trap: Object.freeze({
    timing: 0.35,
    duration: 1.15,
    velocity: 1.2,
  }),
});

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

function orderBoundsForEvents(events, totalBeats) {
  const groups = new Map();
  for (const event of events) {
    const trackId = String(event?.trackId ?? event?.roleId ?? "track");
    if (!groups.has(trackId)) groups.set(trackId, []);
    groups.get(trackId).push(event);
  }

  const bounds = new Map();
  const tieTolerance = 1e-9;
  const guard = 1 / 1920;
  const songEnd = Math.max(0, totalBeats - 1 / 960);

  for (const trackEvents of groups.values()) {
    const ordered = [...trackEvents].sort((left, right) => {
      const timeDelta = finite(left?.canonical?.startBeat, left?.time)
        - finite(right?.canonical?.startBeat, right?.time);
      return timeDelta || String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
    });

    for (let index = 0; index < ordered.length; index += 1) {
      const event = ordered[index];
      const start = finite(event?.canonical?.startBeat, event?.time);
      let previousStart = null;
      let nextStart = null;

      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const candidate = finite(ordered[cursor]?.canonical?.startBeat, ordered[cursor]?.time);
        if (start - candidate > tieTolerance) {
          previousStart = candidate;
          break;
        }
      }
      for (let cursor = index + 1; cursor < ordered.length; cursor += 1) {
        const candidate = finite(ordered[cursor]?.canonical?.startBeat, ordered[cursor]?.time);
        if (candidate - start > tieTolerance) {
          nextStart = candidate;
          break;
        }
      }

      const lowerMidpoint = previousStart == null ? 0 : (previousStart + start) / 2;
      const upperMidpoint = nextStart == null ? songEnd : (start + nextStart) / 2;
      const minStart = previousStart == null
        ? 0
        : Math.min(start, lowerMidpoint + guard);
      const maxStart = nextStart == null
        ? songEnd
        : Math.max(start, upperMidpoint - guard);

      bounds.set(String(event?.id ?? ""), Object.freeze({
        minStart: round(Math.max(0, minStart)),
        maxStart: round(Math.min(songEnd, Math.max(minStart, maxStart))),
      }));
    }
  }

  return bounds;
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

function eventStartBeat(event) {
  return finite(event?.canonical?.startBeat, event?.time);
}

function beatKey(value) {
  return round(finite(value, 0), 6).toFixed(6);
}

function nearModulo(value, modulo, target = 0, tolerance = 1e-6) {
  const wrapped = ((finite(value, 0) % modulo) + modulo) % modulo;
  return Math.abs(wrapped - target) <= tolerance
    || Math.abs(wrapped - modulo - target) <= tolerance;
}

function millisecondsToBeats(milliseconds, bpm) {
  return finite(milliseconds, 0) * Math.max(1, finite(bpm, 120)) / 60000;
}

function timingAnchorIds(events, beatsPerBar = 4) {
  const anchors = new Set();
  const kickIdsByBeat = new Map();

  for (const event of events) {
    const id = String(event?.id ?? "");
    const phraseRole = String(event?.phraseRole ?? "");
    const start = eventStartBeat(event);
    const family = drumFamily(event);

    if (
      event?.intent?.locked
      || event?.intent?.timingLocked
      || event?.transitionHandoffRole
      || ["resolution", "landing", "payoff"].includes(phraseRole)
    ) {
      anchors.add(id);
    }

    if (event?.roleId === "drums" && family === "kick") {
      const key = beatKey(start);
      if (!kickIdsByBeat.has(key)) kickIdsByBeat.set(key, []);
      kickIdsByBeat.get(key).push(id);
      if (nearModulo(start, Math.max(1, beatsPerBar), 0)) anchors.add(id);
    }
  }

  for (const event of events) {
    if (event?.roleId !== "bass") continue;
    const ids = kickIdsByBeat.get(beatKey(eventStartBeat(event)));
    if (!ids?.length) continue;
    anchors.add(String(event?.id ?? ""));
    for (const id of ids) anchors.add(id);
  }

  return anchors;
}

function hipHopTimingMilliseconds(event) {
  if (event?.roleId === "drums" || event?.roleId === "bass") return 0;
  return null;
}

function timingPolicy(event, genre, bpm, amount, seed, timingAnchor = false) {
  if (amount <= 0 || event?.intent?.locked || timingAnchor) return 0;

  if (genre === "hipHop") {
    const deliberateMilliseconds = hipHopTimingMilliseconds(event);
    if (deliberateMilliseconds != null) {
      return round(millisecondsToBeats(deliberateMilliseconds * amount, bpm));
    }
  }

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

function hipHopVelocityDelta(event) {
  const family = drumFamily(event);
  if (event?.roleId !== "drums") return null;

  const start = eventStartBeat(event);
  const sixteenthIndex = ((Math.round(start * 4) % 4) + 4) % 4;

  if (family === "kick") return nearModulo(start, 2, 0) ? 4 : 1;
  if (family === "snare" || family === "clap") return 6;
  if (family === "hat") return [4, -8, -2, -6][sixteenthIndex];
  return [-2, 2, -4, 1][sixteenthIndex];
}

function velocityPolicy(event, genre, amount, seed) {
  if (amount <= 0 || event?.intent?.locked) return 0;

  if (genre === "hipHop") {
    const deliberateDelta = hipHopVelocityDelta(event);
    if (deliberateDelta != null) return deliberateDelta * amount;
  }

  const range = ROLE_VELOCITY_RANGE[event?.roleId] ?? 3;
  const phraseMotion = signedPhase(`${seed}|velocity|${correlatedPhraseKey(event)}`) * range * 0.55;
  const localMotion = signedPhase(`${seed}|velocity|${event?.id}`) * range * 0.45;
  return (phraseMotion + localMotion + accentDelta(event)) * amount;
}

function performEvent(event, {
  genre,
  bpm,
  amount,
  seed,
  totalBeats,
  timingAnchor = false,
  orderBounds = null,
}) {
  if (amount <= 0 || event?.intent?.locked) return event;

  const canonical = event?.canonical ?? {
    startBeat: finite(event?.time, 0),
    durationBeats: finite(event?.duration, 0),
    renderedMidiPitch: Math.round(finite(event?.renderedMidiPitch, 60)),
    velocity: Math.round(clamp(event?.velocity, 1, 127)),
  };
  const performanceScale = GENRE_PERFORMANCE_SCALE[genre] ?? { timing: 1, duration: 1, velocity: 1 };
  const timingDeltaBeats = timingPolicy(
    event,
    genre,
    bpm,
    amount * performanceScale.timing,
    seed,
    timingAnchor,
  );
  const durationScale = durationPolicy(event, amount * performanceScale.duration, seed);
  const velocityDelta = velocityPolicy(event, genre, amount * performanceScale.velocity, seed);
  const minimumStart = Math.max(0, finite(orderBounds?.minStart, 0));
  const maximumStart = Math.min(
    Math.max(0, totalBeats - 1 / 960),
    finite(orderBounds?.maxStart, Math.max(0, totalBeats - 1 / 960)),
  );
  const startBeat = clamp(
    canonical.startBeat + timingDeltaBeats,
    minimumStart,
    Math.max(minimumStart, maximumStart),
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
  const beatsPerBar = Math.max(1, finite(
    gauntletSong?.intent?.beatsPerBar,
    gauntletSong?.beatsPerBar ?? 4,
  ));
  const orderBounds = orderBoundsForEvents(gauntletSong.musicalEvents, totalBeats);
  const timingAnchors = timingAnchorIds(gauntletSong.musicalEvents, beatsPerBar);
  const events = Object.freeze(
    gauntletSong.musicalEvents.map((event) => performEvent(event, {
      genre,
      bpm,
      amount,
      seed,
      totalBeats,
      timingAnchor: timingAnchors.has(String(event?.id ?? "")),
      orderBounds: orderBounds.get(String(event?.id ?? "")) ?? null,
    })),
  );

  const changed = events.filter((event, index) => event !== gauntletSong.musicalEvents[index]);
  const timingDeltas = changed.map((event) => Math.abs(finite(event?.performed?.timingDeltaBeats, 0)));
  const microtimingMilliseconds = changed.map((event) => Math.abs(finite(event?.performed?.microtimingMs, 0)));

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
      maxMicrotimingMs: microtimingMilliseconds.length ? round(Math.max(...microtimingMilliseconds), 3) : 0,
      intentionalPocket: genre === "hipHop",
      protectedTimingAnchors: timingAnchors.size,
      preservedLockedEvents: gauntletSong.musicalEvents.filter((event) => event?.intent?.locked).length,
    }),
  });
}
