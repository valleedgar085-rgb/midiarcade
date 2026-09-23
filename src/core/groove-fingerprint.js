const ROLE_PITCHES = Object.freeze({
  kick: new Set([35, 36]),
  snare: new Set([37, 38, 40]),
  closedHat: new Set([22, 42, 44]),
  openHat: new Set([26, 46]),
  tom: new Set([43, 45, 47, 48, 50, 58]),
  crash: new Set([49, 52, 55, 57]),
  ride: new Set([51, 53, 59]),
});

const ROLES = Object.freeze(Object.keys(ROLE_PITCHES));

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, precision = 6) {
  const factor = 10 ** precision;
  return Math.round(finite(value) * factor) / factor;
}

function normalizeVelocity(value) {
  const number = finite(value);
  return Math.max(0, Math.min(1, number > 1 ? number / 127 : number));
}

function normalizeTimeSignature(value) {
  if (Array.isArray(value)) {
    return [
      Math.max(1, Math.round(finite(value[0], 4))),
      Math.max(1, Math.round(finite(value[1], 4))),
    ];
  }
  const text = String(value ?? "4/4").trim().replace("-", "/");
  const [numerator, denominator] = text.split("/");
  return [
    Math.max(1, Math.round(finite(numerator, 4))),
    Math.max(1, Math.round(finite(denominator, 4))),
  ];
}

function emptyRoleAccumulator(stepsPerBar) {
  return {
    hits: 0,
    velocitySum: 0,
    velocitySqSum: 0,
    microSum: 0,
    microSqSum: 0,
    stepHits: Array(stepsPerBar).fill(0),
    stepVelocitySum: Array(stepsPerBar).fill(0),
  };
}

function stats(sum, squareSum, count) {
  if (!count) return { mean: 0, deviation: 0 };
  const mean = sum / count;
  const variance = Math.max(0, squareSum / count - mean * mean);
  return { mean: round(mean), deviation: round(Math.sqrt(variance)) };
}

function roleSummary(accumulator, bars) {
  const velocity = stats(accumulator.velocitySum, accumulator.velocitySqSum, accumulator.hits);
  const micro = stats(accumulator.microSum, accumulator.microSqSum, accumulator.hits);
  return {
    hits: accumulator.hits,
    hitsPerBar: round(accumulator.hits / bars),
    velocityMean: velocity.mean,
    velocityDeviation: velocity.deviation,
    microOffset16Mean: micro.mean,
    microOffset16Deviation: micro.deviation,
    stepPresencePerBar: accumulator.stepHits.map((count) => round(count / bars)),
    stepVelocityMean: accumulator.stepHits.map((count, index) => (
      count ? round(accumulator.stepVelocitySum[index] / count) : 0
    )),
  };
}

export function grooveDrumRole(pitch) {
  const note = Math.round(finite(pitch, -1));
  for (const role of ROLES) {
    if (ROLE_PITCHES[role].has(note)) return role;
  }
  return "other";
}

export function extractGroovePerformance({
  notes = [],
  ppq = 480,
  totalTicks = null,
  style = "unknown",
  beatType = "beat",
  bpm = 120,
  timeSignature = [4, 4],
} = {}) {
  const normalizedPpq = Math.max(1, finite(ppq, 480));
  const [numerator, denominator] = normalizeTimeSignature(timeSignature);
  const ticksPerBeat = normalizedPpq * 4 / denominator;
  const barTicks = ticksPerBeat * numerator;
  const stepsPerBar = Math.max(1, Math.round(numerator * 16 / denominator));
  const stepTicks = barTicks / stepsPerBar;
  const inferredTicks = notes.reduce((max, note) => Math.max(
    max,
    finite(note.ticks) + Math.max(0, finite(note.durationTicks)),
  ), 0);
  const lengthTicks = Math.max(stepTicks, finite(totalTicks, inferredTicks) || inferredTicks || barTicks);
  const bars = Math.max(1, lengthTicks / barTicks);
  const roleAccumulators = Object.fromEntries(ROLES.map((role) => [role, emptyRoleAccumulator(stepsPerBar)]));
  roleAccumulators.other = emptyRoleAccumulator(stepsPerBar);

  const absoluteSteps = {
    kick: [],
    snare: [],
    hats: [],
  };
  const hatSwingOffsets = [];

  for (const note of notes) {
    const ticks = Math.max(0, finite(note.ticks));
    const stepFloat = ticks / stepTicks;
    const nearestStep = Math.round(stepFloat);
    const microOffset16 = stepFloat - nearestStep;
    const barStep = ((nearestStep % stepsPerBar) + stepsPerBar) % stepsPerBar;
    const role = grooveDrumRole(note.midi ?? note.pitch);
    const velocity = normalizeVelocity(note.velocity);
    const accumulator = roleAccumulators[role];

    accumulator.hits += 1;
    accumulator.velocitySum += velocity;
    accumulator.velocitySqSum += velocity * velocity;
    accumulator.microSum += microOffset16;
    accumulator.microSqSum += microOffset16 * microOffset16;
    accumulator.stepHits[barStep] += 1;
    accumulator.stepVelocitySum[barStep] += velocity;

    if (role === "kick") absoluteSteps.kick.push(nearestStep);
    if (role === "snare") absoluteSteps.snare.push(nearestStep);
    if (role === "closedHat" || role === "openHat") {
      absoluteSteps.hats.push({ absolute: nearestStep, barStep, microOffset16 });
      if (barStep % 4 === 2) hatSwingOffsets.push(microOffset16);
    }
  }

  const kickSteps = new Set(absoluteSteps.kick);
  const snareCount = absoluteSteps.snare.length;
  const kickBeforeSnare = snareCount
    ? absoluteSteps.snare.filter((step) => kickSteps.has(step - 1) || kickSteps.has(step - 2)).length / snareCount
    : 0;
  const kickSnareOverlap = snareCount
    ? absoluteSteps.snare.filter((step) => kickSteps.has(step)).length / snareCount
    : 0;
  const hatSyncopation = absoluteSteps.hats.length
    ? absoluteSteps.hats.filter(({ barStep }) => barStep % 2 === 1).length / absoluteSteps.hats.length
    : 0;
  const swingOffset = hatSwingOffsets.length
    ? hatSwingOffsets.reduce((sum, value) => sum + value, 0) / hatSwingOffsets.length
    : 0;

  return {
    style: String(style || "unknown").toLowerCase(),
    beatType: String(beatType || "beat").toLowerCase(),
    bpm: round(bpm, 3),
    timeSignature: `${numerator}/${denominator}`,
    ppq: normalizedPpq,
    bars: round(bars),
    stepsPerBar,
    roles: Object.fromEntries(
      Object.entries(roleAccumulators).map(([role, accumulator]) => [role, roleSummary(accumulator, bars)]),
    ),
    relationships: {
      kickBeforeSnareRate: round(kickBeforeSnare),
      kickSnareOverlapRate: round(kickSnareOverlap),
      hatSyncopationRate: round(hatSyncopation),
      hatSwingOffset16: round(swingOffset),
    },
  };
}

function emptyAggregate(stepsPerBar) {
  return {
    performances: 0,
    bars: 0,
    bpmBarSum: 0,
    roles: Object.fromEntries([...ROLES, "other"].map((role) => [role, {
      hits: 0,
      velocityHitSum: 0,
      microHitSum: 0,
      microDeviationHitSum: 0,
      stepHits: Array(stepsPerBar).fill(0),
      stepVelocityHitSum: Array(stepsPerBar).fill(0),
    }])),
    relationshipBarSums: {
      kickBeforeSnareRate: 0,
      kickSnareOverlapRate: 0,
      hatSyncopationRate: 0,
      hatSwingOffset16: 0,
    },
  };
}

function finalizeAggregate(aggregate) {
  const bars = Math.max(1, aggregate.bars);
  return {
    performances: aggregate.performances,
    bars: round(aggregate.bars),
    bpmMean: round(aggregate.bpmBarSum / bars, 3),
    roles: Object.fromEntries(Object.entries(aggregate.roles).map(([role, value]) => {
      const hits = Math.max(0, value.hits);
      return [role, {
        hitsPerBar: round(hits / bars),
        velocityMean: hits ? round(value.velocityHitSum / hits) : 0,
        microOffset16Mean: hits ? round(value.microHitSum / hits) : 0,
        microOffset16Deviation: hits ? round(value.microDeviationHitSum / hits) : 0,
        stepPresencePerBar: value.stepHits.map((count) => round(count / bars)),
        stepVelocityMean: value.stepHits.map((count, index) => (
          count ? round(value.stepVelocityHitSum[index] / count) : 0
        )),
      }];
    })),
    relationships: Object.fromEntries(Object.entries(aggregate.relationshipBarSums).map(([key, value]) => [
      key,
      round(value / bars),
    ])),
  };
}

export function aggregateGroovePerformances(performances = []) {
  const groups = new Map();

  for (const performance of performances) {
    const style = String(performance?.style || "unknown").toLowerCase();
    const beatType = String(performance?.beatType || "beat").toLowerCase();
    const stepsPerBar = Math.max(1, Math.round(finite(performance?.stepsPerBar, 16)));
    const key = `${style}::${beatType}::${stepsPerBar}`;
    if (!groups.has(key)) groups.set(key, {
      style,
      beatType,
      stepsPerBar,
      aggregate: emptyAggregate(stepsPerBar),
    });
    const group = groups.get(key);
    const aggregate = group.aggregate;
    const bars = Math.max(1, finite(performance?.bars, 1));
    aggregate.performances += 1;
    aggregate.bars += bars;
    aggregate.bpmBarSum += finite(performance?.bpm, 120) * bars;

    for (const [role, summary] of Object.entries(performance?.roles ?? {})) {
      const destination = aggregate.roles[role] ?? aggregate.roles.other;
      const hits = Math.max(0, finite(summary?.hits));
      destination.hits += hits;
      destination.velocityHitSum += finite(summary?.velocityMean) * hits;
      destination.microHitSum += finite(summary?.microOffset16Mean) * hits;
      destination.microDeviationHitSum += finite(summary?.microOffset16Deviation) * hits;
      for (let index = 0; index < stepsPerBar; index += 1) {
        const stepHits = finite(summary?.stepPresencePerBar?.[index]) * bars;
        destination.stepHits[index] += stepHits;
        destination.stepVelocityHitSum[index] += finite(summary?.stepVelocityMean?.[index]) * stepHits;
      }
    }

    for (const keyName of Object.keys(aggregate.relationshipBarSums)) {
      aggregate.relationshipBarSums[keyName] += finite(performance?.relationships?.[keyName]) * bars;
    }
  }

  const profiles = {};
  for (const { style, beatType, stepsPerBar, aggregate } of groups.values()) {
    profiles[style] ??= {};
    profiles[style][beatType] = {
      stepsPerBar,
      ...finalizeAggregate(aggregate),
    };
  }
  return profiles;
}

export const GROOVE_FINGERPRINT_VERSION = "1.0";
