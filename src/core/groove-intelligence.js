const BASE_GRID_STEPS = 16;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value ?? "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomUnit(seed) {
  let state = hashString(seed) || 1;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296;
}

function uniqueSorted(values = []) {
  return [...new Set(values.map((value) => round(value, 4)))].sort((a, b) => a - b);
}

function rotateSteps(steps, amount, gridSteps) {
  const size = Math.max(1, gridSteps);
  return uniqueSorted(steps.map((step) => ((step + amount) % size + size) % size));
}

function euclideanSteps(pulses, steps, rotation = 0) {
  const n = Math.max(1, Math.round(finite(steps, BASE_GRID_STEPS)));
  const k = Math.max(0, Math.min(n, Math.round(finite(pulses, 0))));
  if (k === 0) return [];
  const result = [];
  for (let index = 0; index < n; index += 1) {
    if ((index * k) % n < k) result.push(index);
  }
  return rotateSteps(result, rotation, n);
}

function scaleSteps(steps, gridSteps) {
  const factor = gridSteps / BASE_GRID_STEPS;
  return uniqueSorted((steps ?? []).map((step) => finite(step) * factor));
}

function sectionName(section) {
  return String(section?.name ?? section?.role ?? section?.id ?? "section").toLowerCase();
}

function sectionRole(section) {
  const name = sectionName(section);
  if (name.includes("pre") && name.includes("chorus")) return "prechorus";
  if (name.includes("chorus") || name.includes("drop") || name.includes("hook")) return "payoff";
  if (name.includes("bridge") || name.includes("break")) return "contrast";
  if (name.includes("intro")) return "intro";
  if (name.includes("outro")) return "outro";
  if (name.includes("build")) return "build";
  return "body";
}

function genreId(value) {
  const raw = String(value ?? "pop").toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases = {
    hiphop: "hipHop",
    rap: "hipHop",
    trap: "trap",
    drill: "trap",
    pop: "pop",
    popradio: "pop",
    house: "house",
    neosoul: "neoSoul",
    rnb: "neoSoul",
    rnbsoul: "neoSoul",
    jazz: "jazz",
    rock: "rock",
  };
  return aliases[raw] ?? "general";
}

export const GENRE_GROOVE_GRAMMARS = Object.freeze({
  hipHop: Object.freeze({
    id: "hip-hop-pocket",
    philosophy: "kick-displacement-snare-anchor-rest-pocket",
    base: Object.freeze({
      kick: Object.freeze([0, 3, 7, 10, 14]),
      snare: Object.freeze([4, 12]),
      hat: Object.freeze([0, 2, 4, 6, 8, 10, 12, 14]),
      percussion: Object.freeze([6, 11, 15]),
    }),
    probability: Object.freeze({ kick: 0.78, snare: 1, hat: 0.9, percussion: 0.48 }),
    locked: Object.freeze({ kick: Object.freeze([0]), snare: Object.freeze([4, 12]), hat: Object.freeze([]), percussion: Object.freeze([]) }),
    density: Object.freeze({ kick: 0.92, snare: 1, hat: 0.9, percussion: 0.7 }),
    transforms: Object.freeze([
      Object.freeze({ lane: "kick", type: "rotateEvery", every: 2, amount: 1, chance: 0.34 }),
      Object.freeze({ lane: "hat", type: "dropEvery", every: 4, chance: 0.28 }),
    ]),
    relationships: Object.freeze({
      bass: Object.freeze({ source: "kick", mode: "lock-and-answer", lock: 0.72, answerDelayBeats: 0.5, syncopation: 0.58 }),
      chords: Object.freeze({ source: "snare", mode: "space-around-backbeat", offsetBeats: -0.25, syncopation: 0.42 }),
      lead: Object.freeze({ source: "snare", mode: "phrase-around-pocket", offsetBeats: 0.25, syncopation: 0.52 }),
    }),
    humanization: Object.freeze({ timing: 0.035, velocity: 0.12, swing: 0.16, laidBackBeats: 0.012 }),
    polyrhythm: Object.freeze({ percussionSteps: 12, pulses: 5 }),
  }),
  trap: Object.freeze({
    id: "trap-subdivision-engine",
    philosophy: "hat-subdivision-bursts-triplets-kick-808-interplay",
    base: Object.freeze({
      kick: Object.freeze([0, 6, 10, 13]),
      snare: Object.freeze([8]),
      hat: Object.freeze([0, 2, 4, 6, 8, 10, 12, 14]),
      percussion: Object.freeze([3, 11, 15]),
    }),
    probability: Object.freeze({ kick: 0.8, snare: 1, hat: 0.96, percussion: 0.46 }),
    locked: Object.freeze({ kick: Object.freeze([0]), snare: Object.freeze([8]), hat: Object.freeze([]), percussion: Object.freeze([]) }),
    density: Object.freeze({ kick: 0.94, snare: 1, hat: 1.32, percussion: 0.76 }),
    transforms: Object.freeze([
      Object.freeze({ lane: "hat", type: "burstEvery", every: 2, count: 3, spacingSteps: 0.6667, chance: 0.52 }),
      Object.freeze({ lane: "hat", type: "tripletTurn", every: 4, chance: 0.48 }),
      Object.freeze({ lane: "kick", type: "rotateEvery", every: 3, amount: 1, chance: 0.4 }),
    ]),
    relationships: Object.freeze({
      bass: Object.freeze({ source: "kick", mode: "808-interlock", lock: 0.82, answerDelayBeats: 0.25, syncopation: 0.74 }),
      chords: Object.freeze({ source: "snare", mode: "sparse-harmonic-bed", offsetBeats: 0, syncopation: 0.28 }),
      lead: Object.freeze({ source: "hat", mode: "float-over-subdivision", offsetBeats: 0.25, syncopation: 0.62 }),
    }),
    humanization: Object.freeze({ timing: 0.016, velocity: 0.1, swing: 0.05, laidBackBeats: 0 }),
    polyrhythm: Object.freeze({ percussionSteps: 12, pulses: 5 }),
  }),
  pop: Object.freeze({
    id: "pop-pulse-lift",
    philosophy: "stable-pulse-deliberate-section-intensification",
    base: Object.freeze({
      kick: Object.freeze([0, 8, 10]),
      snare: Object.freeze([4, 12]),
      hat: Object.freeze([0, 2, 4, 6, 8, 10, 12, 14]),
      percussion: Object.freeze([7, 15]),
    }),
    probability: Object.freeze({ kick: 0.9, snare: 1, hat: 0.92, percussion: 0.38 }),
    locked: Object.freeze({ kick: Object.freeze([0, 8]), snare: Object.freeze([4, 12]), hat: Object.freeze([]), percussion: Object.freeze([]) }),
    density: Object.freeze({ kick: 0.9, snare: 1, hat: 0.9, percussion: 0.56 }),
    transforms: Object.freeze([
      Object.freeze({ lane: "hat", type: "intensifySection", sections: Object.freeze(["prechorus", "payoff"]), amount: 1.25 }),
      Object.freeze({ lane: "kick", type: "intensifySection", sections: Object.freeze(["payoff"]), amount: 1.14 }),
    ]),
    relationships: Object.freeze({
      bass: Object.freeze({ source: "kick", mode: "pulse-reinforcement", lock: 0.78, answerDelayBeats: 0.5, syncopation: 0.42 }),
      chords: Object.freeze({ source: "snare", mode: "stable-comping", offsetBeats: 0, syncopation: 0.3 }),
      lead: Object.freeze({ source: "kick", mode: "hook-pickup", offsetBeats: -0.25, syncopation: 0.4 }),
    }),
    humanization: Object.freeze({ timing: 0.02, velocity: 0.1, swing: 0.08, laidBackBeats: 0 }),
    polyrhythm: Object.freeze({ percussionSteps: 16, pulses: 3 }),
  }),
  house: Object.freeze({
    id: "house-four-floor-interlock",
    philosophy: "four-floor-offbeat-hats-bass-chord-interlock",
    base: Object.freeze({
      kick: Object.freeze([0, 4, 8, 12]),
      snare: Object.freeze([4, 12]),
      hat: Object.freeze([2, 6, 10, 14]),
      percussion: Object.freeze([3, 7, 11, 15]),
    }),
    probability: Object.freeze({ kick: 1, snare: 0.9, hat: 0.98, percussion: 0.58 }),
    locked: Object.freeze({ kick: Object.freeze([0, 4, 8, 12]), snare: Object.freeze([4, 12]), hat: Object.freeze([2, 6, 10, 14]), percussion: Object.freeze([]) }),
    density: Object.freeze({ kick: 1, snare: 1, hat: 1, percussion: 0.8 }),
    transforms: Object.freeze([
      Object.freeze({ lane: "percussion", type: "euclid", pulses: 5, steps: 16, rotateEvery: 4 }),
    ]),
    relationships: Object.freeze({
      bass: Object.freeze({ source: "hat", mode: "offbeat-interlock", lock: 0.88, answerDelayBeats: 0, syncopation: 0.52 }),
      chords: Object.freeze({ source: "hat", mode: "offbeat-comp", offsetBeats: 0, syncopation: 0.54 }),
      lead: Object.freeze({ source: "kick", mode: "phrase-over-grid", offsetBeats: 0.5, syncopation: 0.36 }),
    }),
    humanization: Object.freeze({ timing: 0.008, velocity: 0.07, swing: 0.04, laidBackBeats: 0 }),
    polyrhythm: Object.freeze({ percussionSteps: 16, pulses: 5 }),
  }),
  neoSoul: Object.freeze({
    id: "neo-soul-elastic-pocket",
    philosophy: "behind-beat-chord-anticipation-bass-elasticity",
    base: Object.freeze({
      kick: Object.freeze([0, 5, 10, 14]),
      snare: Object.freeze([4, 12]),
      hat: Object.freeze([0, 2, 4, 6, 8, 10, 12, 14]),
      percussion: Object.freeze([3, 9, 15]),
    }),
    probability: Object.freeze({ kick: 0.76, snare: 1, hat: 0.82, percussion: 0.48 }),
    locked: Object.freeze({ kick: Object.freeze([0]), snare: Object.freeze([4, 12]), hat: Object.freeze([]), percussion: Object.freeze([]) }),
    density: Object.freeze({ kick: 0.88, snare: 1, hat: 0.84, percussion: 0.72 }),
    transforms: Object.freeze([
      Object.freeze({ lane: "kick", type: "rotateEvery", every: 2, amount: -1, chance: 0.3 }),
      Object.freeze({ lane: "hat", type: "dropEvery", every: 3, chance: 0.42 }),
    ]),
    relationships: Object.freeze({
      bass: Object.freeze({ source: "kick", mode: "elastic-answer", lock: 0.58, answerDelayBeats: 0.5, syncopation: 0.68 }),
      chords: Object.freeze({ source: "snare", mode: "anticipate-backbeat", offsetBeats: -0.25, syncopation: 0.64 }),
      lead: Object.freeze({ source: "snare", mode: "behind-beat-conversation", offsetBeats: 0.25, syncopation: 0.58 }),
    }),
    humanization: Object.freeze({ timing: 0.05, velocity: 0.15, swing: 0.28, laidBackBeats: 0.016 }),
    polyrhythm: Object.freeze({ percussionSteps: 12, pulses: 5 }),
  }),
  jazz: Object.freeze({
    id: "jazz-swing-conversation",
    philosophy: "swing-conversation-harmonic-rhythm-awareness",
    base: Object.freeze({
      kick: Object.freeze([0, 10]),
      snare: Object.freeze([6, 14]),
      hat: Object.freeze([0, 3, 4, 7, 8, 11, 12, 15]),
      percussion: Object.freeze([5, 13]),
    }),
    probability: Object.freeze({ kick: 0.5, snare: 0.62, hat: 0.94, percussion: 0.42 }),
    locked: Object.freeze({ kick: Object.freeze([0]), snare: Object.freeze([]), hat: Object.freeze([0, 4, 8, 12]), percussion: Object.freeze([]) }),
    density: Object.freeze({ kick: 0.64, snare: 0.78, hat: 1, percussion: 0.58 }),
    transforms: Object.freeze([
      Object.freeze({ lane: "snare", type: "rotateEvery", every: 3, amount: 1, chance: 0.46 }),
      Object.freeze({ lane: "percussion", type: "euclid", pulses: 5, steps: 12, rotateEvery: 2 }),
    ]),
    relationships: Object.freeze({
      bass: Object.freeze({ source: "hat", mode: "walking-quarter-dialogue", lock: 0.46, answerDelayBeats: 0.5, syncopation: 0.5 }),
      chords: Object.freeze({ source: "snare", mode: "comping-conversation", offsetBeats: -0.25, syncopation: 0.7 }),
      lead: Object.freeze({ source: "hat", mode: "swing-phrase-dialogue", offsetBeats: 0.25, syncopation: 0.72 }),
    }),
    humanization: Object.freeze({ timing: 0.045, velocity: 0.16, swing: 0.34, laidBackBeats: 0.012 }),
    polyrhythm: Object.freeze({ percussionSteps: 12, pulses: 5 }),
  }),
  rock: Object.freeze({
    id: "rock-kit-riff-drive",
    philosophy: "backbeat-kit-realism-riff-reinforcement-section-intensity",
    base: Object.freeze({
      kick: Object.freeze([0, 8, 10]),
      snare: Object.freeze([4, 12]),
      hat: Object.freeze([0, 2, 4, 6, 8, 10, 12, 14]),
      percussion: Object.freeze([15]),
    }),
    probability: Object.freeze({ kick: 0.94, snare: 1, hat: 0.96, percussion: 0.42 }),
    locked: Object.freeze({ kick: Object.freeze([0]), snare: Object.freeze([4, 12]), hat: Object.freeze([]), percussion: Object.freeze([]) }),
    density: Object.freeze({ kick: 0.94, snare: 1, hat: 1, percussion: 0.52 }),
    transforms: Object.freeze([
      Object.freeze({ lane: "hat", type: "intensifySection", sections: Object.freeze(["payoff", "build"]), amount: 1.24 }),
      Object.freeze({ lane: "percussion", type: "intensifySection", sections: Object.freeze(["payoff"]), amount: 1.4 }),
    ]),
    relationships: Object.freeze({
      bass: Object.freeze({ source: "kick", mode: "riff-reinforcement", lock: 0.82, answerDelayBeats: 0, syncopation: 0.34 }),
      chords: Object.freeze({ source: "kick", mode: "riff-lock", offsetBeats: 0, syncopation: 0.24 }),
      lead: Object.freeze({ source: "snare", mode: "phrase-over-backbeat", offsetBeats: 0, syncopation: 0.34 }),
    }),
    humanization: Object.freeze({ timing: 0.02, velocity: 0.13, swing: 0.03, laidBackBeats: 0 }),
    polyrhythm: Object.freeze({ percussionSteps: 16, pulses: 2 }),
  }),
  general: Object.freeze({
    id: "general-balanced-groove",
    philosophy: "balanced-backbeat",
    base: Object.freeze({
      kick: Object.freeze([0, 8]),
      snare: Object.freeze([4, 12]),
      hat: Object.freeze([0, 2, 4, 6, 8, 10, 12, 14]),
      percussion: Object.freeze([7, 15]),
    }),
    probability: Object.freeze({ kick: 0.88, snare: 1, hat: 0.9, percussion: 0.4 }),
    locked: Object.freeze({ kick: Object.freeze([0]), snare: Object.freeze([4, 12]), hat: Object.freeze([]), percussion: Object.freeze([]) }),
    density: Object.freeze({ kick: 0.9, snare: 1, hat: 0.9, percussion: 0.6 }),
    transforms: Object.freeze([]),
    relationships: Object.freeze({
      bass: Object.freeze({ source: "kick", mode: "support", lock: 0.7, answerDelayBeats: 0.5, syncopation: 0.42 }),
      chords: Object.freeze({ source: "snare", mode: "support", offsetBeats: 0, syncopation: 0.36 }),
      lead: Object.freeze({ source: "kick", mode: "support", offsetBeats: 0.25, syncopation: 0.44 }),
    }),
    humanization: Object.freeze({ timing: 0.025, velocity: 0.1, swing: 0.08, laidBackBeats: 0 }),
    polyrhythm: Object.freeze({ percussionSteps: 16, pulses: 3 }),
  }),
});

function grammarForGenre(genre) {
  return GENRE_GROOVE_GRAMMARS[genreId(genre)] ?? GENRE_GROOVE_GRAMMARS.general;
}

function applyProbability(steps, probability, lockedSteps, seed) {
  const locked = new Set((lockedSteps ?? []).map((value) => round(value, 4)));
  return uniqueSorted(steps.filter((step) => (
    locked.has(round(step, 4))
    || randomUnit(`${seed}:probability:${round(step, 4)}`) <= clamp(probability, 0, 1)
  )));
}

function applyDensity(steps, targetFactor, lockedSteps, gridSteps, seed) {
  const locked = new Set((lockedSteps ?? []).map((value) => round(value, 4)));
  const baseTarget = Math.max(locked.size, Math.round(Math.max(1, steps.length) * clamp(targetFactor, 0.25, 2)));
  let out = uniqueSorted([...steps, ...locked]);
  if (out.length > baseTarget) {
    const removable = out
      .filter((step) => !locked.has(round(step, 4)))
      .sort((left, right) => (
        randomUnit(`${seed}:remove:${left}`) - randomUnit(`${seed}:remove:${right}`)
        || left - right
      ));
    const removeCount = Math.min(removable.length, out.length - baseTarget);
    const remove = new Set(removable.slice(0, removeCount));
    out = out.filter((step) => !remove.has(step));
  }
  if (out.length < baseTarget) {
    const existing = new Set(out.map((step) => round(step, 4)));
    const candidates = [];
    for (let step = 0; step < gridSteps; step += 1) {
      if (!existing.has(round(step, 4))) candidates.push(step);
    }
    candidates.sort((left, right) => (
      randomUnit(`${seed}:add:${right}`) - randomUnit(`${seed}:add:${left}`)
      || left - right
    ));
    out = uniqueSorted([...out, ...candidates.slice(0, baseTarget - out.length)]);
  }
  return out;
}

function applyTransforms(steps, transforms, {
  lane,
  bar,
  section,
  gridSteps,
  seed,
}) {
  let out = uniqueSorted(steps);
  let densityMultiplier = 1;
  for (const transform of transforms ?? []) {
    if (transform.lane !== lane) continue;
    const chance = clamp(transform.chance ?? 1, 0, 1);
    const enabled = randomUnit(`${seed}:transform:${transform.type}:${bar}`) <= chance;
    if (transform.type === "rotateEvery" && enabled && bar % Math.max(1, transform.every ?? 1) === Math.max(1, transform.every ?? 1) - 1) {
      out = rotateSteps(out, finite(transform.amount, 0), gridSteps);
    } else if (transform.type === "dropEvery" && enabled && bar % Math.max(1, transform.every ?? 1) === Math.max(1, transform.every ?? 1) - 1) {
      const candidates = out.filter((_, index) => index % 2 === 1);
      if (candidates.length) {
        const remove = candidates[Math.floor(randomUnit(`${seed}:drop:${bar}`) * candidates.length)];
        out = out.filter((step) => step !== remove);
      }
    } else if (transform.type === "burstEvery" && enabled && bar % Math.max(1, transform.every ?? 1) === Math.max(1, transform.every ?? 1) - 1) {
      const origin = out.at(-1) ?? gridSteps - 2;
      const count = Math.max(2, Math.round(finite(transform.count, 3)));
      const spacing = Math.max(0.25, finite(transform.spacingSteps, 0.6667));
      out = uniqueSorted([
        ...out,
        ...Array.from({ length: count }, (_, index) => origin + index * spacing)
          .filter((step) => step >= 0 && step < gridSteps),
      ]);
    } else if (transform.type === "tripletTurn" && enabled && bar % Math.max(1, transform.every ?? 1) === Math.max(1, transform.every ?? 1) - 1) {
      const origin = Math.max(0, gridSteps - 3);
      out = uniqueSorted([...out, origin, origin + 2 / 3, origin + 4 / 3, origin + 2]);
    } else if (transform.type === "euclid") {
      const rotation = Math.max(1, transform.rotateEvery ?? 1) > 1
        ? bar % Math.max(1, transform.rotateEvery)
        : 0;
      const source = euclideanSteps(transform.pulses, transform.steps, rotation);
      out = scaleSteps(source, gridSteps);
    } else if (
      transform.type === "intensifySection"
      && (transform.sections ?? []).includes(sectionRole(section))
    ) {
      densityMultiplier *= clamp(transform.amount, 0.5, 2);
    }
  }
  return { steps: out, densityMultiplier };
}

function sectionDensityMultiplier(genre, section) {
  const role = sectionRole(section);
  if (genre === "pop") {
    if (role === "prechorus") return 1.14;
    if (role === "payoff") return 1.28;
  }
  if (genre === "rock" && ["build", "payoff"].includes(role)) return role === "payoff" ? 1.24 : 1.12;
  if (genre === "trap" && role === "payoff") return 1.16;
  if (genre === "house" && role === "payoff") return 1.1;
  if (role === "intro" || role === "outro") return 0.78;
  return 1;
}

function humanizeSteps(steps, humanization, seed, beatsPerStep) {
  return Object.freeze(steps.map((step) => {
    const jitter = (randomUnit(`${seed}:timing:${step}`) * 2 - 1) * finite(humanization.timing, 0);
    const offsetBeats = finite(humanization.laidBackBeats, 0) + jitter;
    return Object.freeze({
      step: round(step),
      beat: round(step * beatsPerStep),
      humanizedBeat: round(step * beatsPerStep + offsetBeats),
      timingOffsetBeats: round(offsetBeats),
      velocityScale: round(1 + (randomUnit(`${seed}:velocity:${step}`) * 2 - 1) * finite(humanization.velocity, 0), 3),
    });
  }));
}

function sourcePulseLane(lanes, source) {
  const lane = lanes[source];
  return lane?.steps ?? [];
}

function relationshipSteps(lanes, relationship, beatsPerStep, gridSteps, seed) {
  const source = sourcePulseLane(lanes, relationship.source);
  if (!source.length) return [];
  const offsetSteps = finite(relationship.offsetBeats, 0) / beatsPerStep;
  const answerSteps = finite(relationship.answerDelayBeats, 0) / beatsPerStep;
  const lock = clamp(relationship.lock ?? 0.65, 0, 1);
  const result = [];
  for (const step of source) {
    if (randomUnit(`${seed}:lock:${step}`) <= lock) result.push(step + offsetSteps);
    if (answerSteps && randomUnit(`${seed}:answer:${step}`) <= relationship.syncopation) {
      result.push(step + answerSteps);
    }
  }
  return uniqueSorted(result
    .map((step) => ((step % gridSteps) + gridSteps) % gridSteps));
}

function normalizeStructure(structure, bars, beatsPerBar) {
  if (!Array.isArray(structure) || !structure.length) {
    return [{ id: "song", name: "body", startBar: 0, bars, startBeat: 0, endBeat: bars * beatsPerBar }];
  }
  return structure.map((section, index) => {
    const startBar = Math.max(0, Math.round(finite(
      section?.startBar,
      finite(section?.startBeat, 0) / beatsPerBar,
    )));
    const sectionBars = Math.max(1, Math.round(finite(
      section?.bars,
      (finite(section?.endBeat, (startBar + 1) * beatsPerBar) - startBar * beatsPerBar) / beatsPerBar,
    )));
    return {
      id: String(section?.id ?? `section-${index + 1}`),
      name: String(section?.name ?? section?.role ?? section?.id ?? `section-${index + 1}`),
      startBar,
      bars: sectionBars,
      startBeat: startBar * beatsPerBar,
      endBeat: (startBar + sectionBars) * beatsPerBar,
    };
  });
}

function sectionForBar(structure, bar) {
  return structure.find((section) => bar >= section.startBar && bar < section.startBar + section.bars)
    ?? structure.at(-1);
}

function directorSectionForId(directorSections, sectionId) {
  return (directorSections ?? []).find((section) => String(section?.sectionId) === String(sectionId)) ?? null;
}

function directorDensityMultiplier(directorSection) {
  const target = finite(directorSection?.density?.target, NaN);
  if (!Number.isFinite(target)) return 1;
  return clamp(0.72 + target * 0.56, 0.72, 1.28);
}

function directorLaneDensityMultiplier(directorSection, lane) {
  const drums = directorSection?.instruments?.drums ?? {};
  const bass = directorSection?.instruments?.bass ?? {};
  if (lane === "hat" && drums.hatBehavior === "accelerate") return 1.28;
  if (lane === "hat" && drums.hatBehavior === "sparse") return 0.72;
  if (lane === "kick" && drums.role === "strongest-pattern") return 1.12;
  if (lane === "kick" && bass.role === "simplified") return 0.9;
  return 1;
}

function trimForDirectorVacuum(steps, directorSection, section, bar, beatsPerBar, beatsPerStep) {
  const vacuumBeats = Math.max(0, finite(directorSection?.transitionOut?.vacuumBeats, 0));
  const lastBar = bar === section.startBar + section.bars - 1;
  if (!lastBar || vacuumBeats <= 0) return uniqueSorted(steps);
  const cutoffBeat = Math.max(0, beatsPerBar - vacuumBeats);
  const cutoffStep = cutoffBeat / beatsPerStep;
  return uniqueSorted(steps.filter((step) => step < cutoffStep - 1e-6));
}

function applyDirectorRelationship(steps, role, directorSection) {
  const bass = directorSection?.instruments?.bass ?? {};
  if (role === "bass" && bass.role === "simplified") {
    return uniqueSorted(steps.filter((_, index) => index % 2 === 0));
  }
  return uniqueSorted(steps);
}

export function createGrooveDNA(input = {}, {
  structure = null,
  directorSections = null,
} = {}) {
  const seed = String(input?.seed ?? "midi-arcade");
  const genre = genreId(input?.genre);
  const grammar = grammarForGenre(genre);
  const bars = Math.max(1, Math.round(finite(input?.bars, 8)));
  const beatsPerBar = Math.max(1, finite(input?.beatsPerBar, Array.isArray(input?.timeSignature) ? input.timeSignature[0] : 4));
  const gridSteps = Math.max(4, Math.round(beatsPerBar * 4));
  const beatsPerStep = beatsPerBar / gridSteps;
  const densityControl = clamp(input?.density ?? input?.complexity ?? 0.58, 0, 1);
  const variation = clamp(input?.variation ?? 0.48, 0, 1);
  const normalizedSections = normalizeStructure(structure ?? input?.structure, bars, beatsPerBar);
  const barPlans = [];

  for (let bar = 0; bar < bars; bar += 1) {
    const section = sectionForBar(normalizedSections, bar);
    const directorSection = directorSectionForId(directorSections, section?.id);
    const lanePlans = {};
    for (const lane of ["kick", "snare", "hat", "percussion"]) {
      const baseSteps = scaleSteps(grammar.base[lane], gridSteps);
      const lockedSteps = scaleSteps(grammar.locked[lane], gridSteps);
      const probabilitySteps = applyProbability(
        baseSteps,
        grammar.probability[lane],
        lockedSteps,
        `${seed}:${genre}:${bar}:${lane}`,
      );
      const transformed = applyTransforms(probabilitySteps, grammar.transforms, {
        lane,
        bar,
        section,
        gridSteps,
        seed: `${seed}:${genre}:${lane}`,
      });
      const factor = grammar.density[lane]
        * (0.72 + densityControl * 0.56)
        * sectionDensityMultiplier(genre, section)
        * directorDensityMultiplier(directorSection)
        * directorLaneDensityMultiplier(directorSection, lane)
        * transformed.densityMultiplier;
      const densitySteps = applyDensity(
        transformed.steps,
        factor,
        lockedSteps,
        gridSteps,
        `${seed}:${genre}:${bar}:${lane}:density`,
      );
      const variationAmount = Math.round(variation * (lane === "hat" ? 2 : 1));
      let variedSteps = variationAmount > 0 && randomUnit(`${seed}:${genre}:${bar}:${lane}:variation`) < variation * 0.42
        ? rotateSteps(densitySteps, randomUnit(`${seed}:${bar}:${lane}:direction`) < 0.5 ? -variationAmount : variationAmount, gridSteps)
        : densitySteps;
      if (lane === "hat" && directorSection?.instruments?.drums?.hatBehavior === "accelerate") {
        const finalSectionBar = bar === section.startBar + section.bars - 1;
        const extra = finalSectionBar
          ? Array.from({ length: gridSteps }, (_, step) => step).filter((step) => step >= Math.floor(gridSteps / 2))
          : Array.from({ length: gridSteps }, (_, step) => step).filter((step) => step % 2 === 0);
        variedSteps = uniqueSorted([...variedSteps, ...extra]);
      }
      variedSteps = trimForDirectorVacuum(
        variedSteps,
        directorSection,
        section,
        bar,
        beatsPerBar,
        beatsPerStep,
      );
      lanePlans[lane] = Object.freeze({
        baseSteps: Object.freeze(baseSteps),
        probabilitySteps: Object.freeze(probabilitySteps),
        densitySteps: Object.freeze(densitySteps),
        steps: Object.freeze(variedSteps),
        events: humanizeSteps(
          variedSteps,
          grammar.humanization,
          `${seed}:${genre}:${bar}:${lane}:humanize`,
          beatsPerStep,
        ),
      });
    }

    const relationships = {};
    for (const [role, relationship] of Object.entries(grammar.relationships)) {
      const steps = applyDirectorRelationship(
        trimForDirectorVacuum(
          relationshipSteps(
            lanePlans,
            relationship,
            beatsPerStep,
            gridSteps,
            `${seed}:${genre}:${bar}:${role}`,
          ),
          directorSection,
          section,
          bar,
          beatsPerBar,
          beatsPerStep,
        ),
        role,
        directorSection,
      );
      relationships[role] = Object.freeze({
        ...relationship,
        steps: Object.freeze(steps),
        pulses: Object.freeze(steps.map((step) => round(step * beatsPerStep))),
      });
    }

    const polySteps = euclideanSteps(
      grammar.polyrhythm.pulses,
      grammar.polyrhythm.percussionSteps,
      bar % Math.max(1, grammar.polyrhythm.percussionSteps),
    );
    barPlans.push(Object.freeze({
      bar,
      sectionId: section.id,
      sectionRole: sectionRole(section),
      directorPurpose: directorSection?.purpose ?? null,
      directorDensity: directorSection?.density?.state ?? null,
      vacuumBeats: Math.max(0, finite(directorSection?.transitionOut?.vacuumBeats, 0)),
      kick: lanePlans.kick,
      snare: lanePlans.snare,
      hat: lanePlans.hat,
      percussion: lanePlans.percussion,
      polyrhythm: Object.freeze({
        cycleSteps: grammar.polyrhythm.percussionSteps,
        pulses: grammar.polyrhythm.pulses,
        steps: Object.freeze(polySteps),
      }),
      relationships: Object.freeze(relationships),
    }));
  }

  return Object.freeze({
    version: 1,
    id: "groove-dna-v1",
    seed,
    genre,
    grammarId: grammar.id,
    philosophy: grammar.philosophy,
    barCount: bars,
    beatsPerBar,
    gridSteps,
    beatsPerStep: round(beatsPerStep),
    pipeline: Object.freeze([
      "base-rhythm",
      "probability",
      "density-transform",
      "variation",
      "humanization",
      "instrument-mapping",
    ]),
    grammar: Object.freeze({
      kick: Object.freeze({ base: grammar.base.kick, probability: grammar.probability.kick, locked: grammar.locked.kick }),
      snare: Object.freeze({ base: grammar.base.snare, probability: grammar.probability.snare, locked: grammar.locked.snare }),
      hat: Object.freeze({ base: grammar.base.hat, probability: grammar.probability.hat, locked: grammar.locked.hat }),
      percussion: Object.freeze({ base: grammar.base.percussion, probability: grammar.probability.percussion, locked: grammar.locked.percussion }),
    }),
    relationships: grammar.relationships,
    humanization: grammar.humanization,
    sections: Object.freeze(normalizedSections),
    directorSections: Object.freeze((directorSections ?? []).map((section) => ({
      sectionId: section.sectionId,
      purpose: section.purpose,
      density: section.density,
      transitionOut: section.transitionOut,
    }))),
    bars: Object.freeze(barPlans),
  });
}

export function grooveDNAForBar(grooveDNA, bar) {
  return grooveDNA?.bars?.find((entry) => entry.bar === Math.max(0, Math.floor(finite(bar, 0)))) ?? null;
}

export function grooveDNAConductorLanes(grooveDNA, bar) {
  const plan = grooveDNAForBar(grooveDNA, bar);
  if (!plan) return null;
  const pulses = (lane) => Object.freeze((plan?.[lane]?.steps ?? []).map((step) => round(step * grooveDNA.beatsPerStep)));
  return Object.freeze({
    anchors: pulses("kick"),
    snarePulses: pulses("snare"),
    hatPulses: pulses("hat"),
    percussionPulses: pulses("percussion"),
    bassPulses: plan.relationships.bass.pulses,
    chordPulses: plan.relationships.chords.pulses,
    leadPulses: plan.relationships.lead.pulses,
    counterPulses: Object.freeze(
      plan.relationships.lead.pulses
        .map((beat) => round((beat + grooveDNA.beatsPerStep * 2) % grooveDNA.beatsPerBar)),
    ),
  });
}

export function validateGrooveDNA(grooveDNA) {
  const issues = [];
  if (grooveDNA?.id !== "groove-dna-v1") issues.push("groove-dna:invalid-id");
  if (!Array.isArray(grooveDNA?.pipeline) || grooveDNA.pipeline.length !== 6) issues.push("groove-dna:pipeline");
  if (!Array.isArray(grooveDNA?.bars)) issues.push("groove-dna:bars");
  else {
    if (grooveDNA.bars.length !== Math.max(1, Math.round(finite(grooveDNA?.barCount, 1)))) {
      issues.push("groove-dna:bar-count");
    }
    for (const bar of grooveDNA.bars) {
      for (const lane of ["kick", "snare", "hat", "percussion"]) {
        if (!Array.isArray(bar?.[lane]?.steps)) issues.push(`groove-dna:${lane}:steps`);
      }
      for (const role of ["bass", "chords", "lead"]) {
        if (!Array.isArray(bar?.relationships?.[role]?.pulses)) issues.push(`groove-dna:${role}:relationship`);
      }
    }
  }
  return Object.freeze({
    passed: issues.length === 0,
    issues: Object.freeze([...new Set(issues)]),
  });
}
