import { applyPerformanceEngine } from "./performance-engine.js";
import { createProfessionalGenerationGauntletSong } from "./professional-gauntlet-song.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value, 0) + Number.EPSILON) * factor) / factor;
}

function average(values) {
  return values.length
    ? values.reduce((sum, value) => sum + finite(value, 0), 0) / values.length
    : 0;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function identity(event) {
  return String(event?.id ?? "");
}

function performedState(event) {
  return Object.freeze({
    startBeat: finite(event?.performed?.startBeat, event?.time),
    durationBeats: finite(event?.performed?.durationBeats, event?.duration),
    renderedMidiPitch: Math.round(finite(
      event?.performed?.renderedMidiPitch,
      event?.renderedMidiPitch,
    )),
    velocity: Math.round(finite(event?.performed?.velocity, event?.velocity)),
    articulation: String(event?.performed?.articulation ?? event?.articulation ?? "normal"),
  });
}

function lockedStateEqual(before, after) {
  return JSON.stringify(performedState(before)) === JSON.stringify(performedState(after));
}

function roleSummary(roleId, comparisons, bpm) {
  const rows = comparisons.filter((entry) => entry.roleId === roleId);
  const absTimingBeats = rows.map((entry) => Math.abs(entry.timingDeltaBeats));
  const absTimingMs = absTimingBeats.map((value) => value * 60000 / Math.max(1, bpm));
  const absVelocity = rows.map((entry) => Math.abs(entry.velocityDelta));
  const absDurationPercent = rows.map((entry) => Math.abs(entry.durationDeltaPercent));

  return Object.freeze({
    roleId,
    events: rows.length,
    changedEvents: rows.filter((entry) => entry.changed).length,
    timing: Object.freeze({
      meanAbsBeats: round(average(absTimingBeats), 6),
      meanAbsMs: round(average(absTimingMs), 3),
      p95AbsMs: round(percentile(absTimingMs, 0.95), 3),
      maxAbsMs: round(Math.max(0, ...absTimingMs), 3),
    }),
    velocity: Object.freeze({
      meanAbsDelta: round(average(absVelocity), 3),
      maxAbsDelta: round(Math.max(0, ...absVelocity), 3),
    }),
    duration: Object.freeze({
      meanAbsPercent: round(average(absDurationPercent), 2),
      maxAbsPercent: round(Math.max(0, ...absDurationPercent), 2),
    }),
    articulationChanges: rows.filter((entry) => entry.articulationChanged).length,
  });
}

function nearCollisionCount(events, thresholdBeats = 1 / 960) {
  const grouped = new Map();
  for (const event of events) {
    const state = performedState(event);
    const key = `${event?.trackId ?? event?.roleId ?? "track"}|${state.renderedMidiPitch}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(state.startBeat);
  }

  let collisions = 0;
  for (const starts of grouped.values()) {
    starts.sort((left, right) => left - right);
    for (let index = 1; index < starts.length; index += 1) {
      if (starts[index] - starts[index - 1] <= thresholdBeats) collisions += 1;
    }
  }
  return collisions;
}

function orderingInversions(beforeEvents, afterEvents, thresholdBeats = 1 / 960) {
  const afterById = new Map(afterEvents.map((event) => [identity(event), event]));
  const tracks = new Map();
  for (const event of beforeEvents) {
    const trackId = String(event?.trackId ?? event?.roleId ?? "track");
    if (!tracks.has(trackId)) tracks.set(trackId, []);
    tracks.get(trackId).push(event);
  }

  let inversions = 0;
  for (const source of tracks.values()) {
    source.sort((left, right) => performedState(left).startBeat - performedState(right).startBeat);
    for (let index = 1; index < source.length; index += 1) {
      const sourcePrevious = performedState(source[index - 1]);
      const sourceCurrent = performedState(source[index]);
      const originalSeparation = sourceCurrent.startBeat - sourcePrevious.startBeat;
      // Notes that intentionally share an onset are a chord/stack, not an ordered
      // sequence. Microtiming may fan that stack out without creating a phrase
      // inversion, so only evaluate meaningfully separated source onsets.
      if (originalSeparation <= thresholdBeats) continue;

      const previous = afterById.get(identity(source[index - 1]));
      const current = afterById.get(identity(source[index]));
      if (!previous || !current) continue;
      if (
        performedState(previous).startBeat
        > performedState(current).startBeat + thresholdBeats
      ) {
        inversions += 1;
      }
    }
  }
  return inversions;
}

function compareEvents(beforeEvents, afterEvents) {
  const afterById = new Map(afterEvents.map((event) => [identity(event), event]));
  return Object.freeze(beforeEvents.map((before) => {
    const after = afterById.get(identity(before));
    const original = performedState(before);
    const proposed = after ? performedState(after) : original;
    const durationBase = Math.max(1 / 960, Math.abs(original.durationBeats));
    const timingDeltaBeats = proposed.startBeat - original.startBeat;
    const durationDeltaBeats = proposed.durationBeats - original.durationBeats;
    const velocityDelta = proposed.velocity - original.velocity;
    const articulationChanged = proposed.articulation !== original.articulation;
    return Object.freeze({
      id: identity(before),
      trackId: String(before?.trackId ?? ""),
      roleId: String(before?.roleId ?? ""),
      sectionId: before?.sectionId ?? null,
      locked: Boolean(before?.intent?.locked),
      timingDeltaBeats: round(timingDeltaBeats, 6),
      durationDeltaBeats: round(durationDeltaBeats, 6),
      durationDeltaPercent: round(durationDeltaBeats / durationBase * 100, 3),
      velocityDelta,
      articulationChanged,
      changed: Math.abs(timingDeltaBeats) > 1e-9
        || Math.abs(durationDeltaBeats) > 1e-9
        || velocityDelta !== 0
        || articulationChanged,
    });
  }));
}

export function createPerformanceShadowReport(song, {
  humanize = 0.65,
  seed = song?.seed ?? song?.id ?? "performance-shadow",
} = {}) {
  if (!song || !Array.isArray(song?.tracks)) {
    throw new TypeError("createPerformanceShadowReport requires a generated song");
  }

  const gauntletSong = createProfessionalGenerationGauntletSong(song);
  const shadow = applyPerformanceEngine(gauntletSong, { humanize, seed });
  const beforeEvents = gauntletSong.musicalEvents;
  const afterEvents = shadow.events;
  const comparisons = compareEvents(beforeEvents, afterEvents);
  const bpm = Math.max(1, finite(gauntletSong?.intent?.bpm, 120));
  const totalBeats = Math.max(0, finite(gauntletSong?.totalBeats, 0));

  const afterById = new Map(afterEvents.map((event) => [identity(event), event]));
  const idsPreserved = beforeEvents.every((event) => afterById.has(identity(event)));
  const pitchPreserved = beforeEvents.every((event) => {
    const after = afterById.get(identity(event));
    return after && performedState(after).renderedMidiPitch === performedState(event).renderedMidiPitch;
  });
  const lockedEventsPreserved = beforeEvents
    .filter((event) => event?.intent?.locked)
    .every((event) => {
      const after = afterById.get(identity(event));
      return after && lockedStateEqual(event, after);
    });
  const boundsPreserved = afterEvents.every((event) => {
    const state = performedState(event);
    return state.startBeat >= 0
      && state.durationBeats > 0
      && state.startBeat + state.durationBeats <= totalBeats + 1e-6
      && state.renderedMidiPitch >= 0
      && state.renderedMidiPitch <= 127
      && state.velocity >= 1
      && state.velocity <= 127;
  });
  const inversionCount = orderingInversions(beforeEvents, afterEvents);
  const collisionsBefore = nearCollisionCount(beforeEvents);
  const collisionsAfter = nearCollisionCount(afterEvents);
  const introducedNearCollisions = Math.max(0, collisionsAfter - collisionsBefore);

  const absTimingMs = comparisons.map(
    (entry) => Math.abs(entry.timingDeltaBeats) * 60000 / bpm,
  );
  const absVelocity = comparisons.map((entry) => Math.abs(entry.velocityDelta));
  const absDurationPercent = comparisons.map((entry) => Math.abs(entry.durationDeltaPercent));
  const roles = [...new Set(comparisons.map((entry) => entry.roleId))].sort();

  const technicalSafety = Object.freeze({
    eventCountPreserved: beforeEvents.length === afterEvents.length,
    eventIdsPreserved: idsPreserved,
    pitchPreserved,
    lockedEventsPreserved,
    boundsPreserved,
  });
  const grooveSafety = Object.freeze({
    orderingPreserved: inversionCount === 0,
    noNewNearCollisions: introducedNearCollisions === 0,
  });
  const safety = Object.freeze({
    ...technicalSafety,
    ...grooveSafety,
  });
  const safeToAudition = Object.values(technicalSafety).every(Boolean);
  const promotionCandidate = safeToAudition && Object.values(grooveSafety).every(Boolean);

  return Object.freeze({
    version: 1,
    id: "performance-shadow-v1",
    mode: "diagnostic-only",
    deterministic: true,
    sourceSongId: gauntletSong.sourceSongId,
    sourceSeed: gauntletSong.sourceSeed,
    genre: gauntletSong?.intent?.genre ?? null,
    bpm,
    bars: gauntletSong?.intent?.bars ?? null,
    humanize: shadow.humanize,
    engine: shadow.id,
    outputMutation: false,
    safeToAudition,
    promotionCandidate,
    technicalSafety,
    grooveSafety,
    safety,
    metrics: Object.freeze({
      totalEvents: comparisons.length,
      changedEvents: comparisons.filter((entry) => entry.changed).length,
      timing: Object.freeze({
        meanAbsMs: round(average(absTimingMs), 3),
        p95AbsMs: round(percentile(absTimingMs, 0.95), 3),
        maxAbsMs: round(Math.max(0, ...absTimingMs), 3),
      }),
      velocity: Object.freeze({
        meanAbsDelta: round(average(absVelocity), 3),
        maxAbsDelta: round(Math.max(0, ...absVelocity), 3),
      }),
      duration: Object.freeze({
        meanAbsPercent: round(average(absDurationPercent), 2),
        maxAbsPercent: round(Math.max(0, ...absDurationPercent), 2),
      }),
      articulationChanges: comparisons.filter((entry) => entry.articulationChanged).length,
      orderingInversions: inversionCount,
      nearCollisionsBefore: collisionsBefore,
      nearCollisionsAfter: collisionsAfter,
      introducedNearCollisions,
    }),
    roles: Object.freeze(roles.map((roleId) => roleSummary(roleId, comparisons, bpm))),
    comparisons,
  });
}
