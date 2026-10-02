const pc = (pitch) => ((pitch % 12) + 12) % 12;

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function chordClasses(tones = []) {
  return new Set((Array.isArray(tones) ? tones : [])
    .filter((tone) => Number.isFinite(Number(tone)))
    .map(pc));
}

function guideToneClasses(rootPc, tones = []) {
  if (!Number.isFinite(Number(rootPc))) return new Set();
  const root = pc(Number(rootPc));
  const chord = chordClasses(tones);
  const guides = [3, 4, 10, 11]
    .map((interval) => pc(root + interval))
    .filter((pitchClass) => chord.has(pitchClass));
  return new Set(guides);
}

function nearbyPitches(pitchClasses, around, radius = 12) {
  const pitches = [];
  for (let candidate = Math.max(0, around - radius); candidate <= Math.min(127, around + radius); candidate += 1) {
    if (pitchClasses.has(pc(candidate))) pitches.push(candidate);
  }
  return pitches;
}

function nearestPitch(pitches, value) {
  if (!pitches.length) return null;
  return pitches.reduce((best, candidate) => (
    Math.abs(candidate - value) < Math.abs(best - value)
      || Math.abs(candidate - value) === Math.abs(best - value) && candidate < best
      ? candidate
      : best
  ), pitches[0]);
}

function targetRoleForPitchClass(pitchClass, common, guides, future) {
  if (common.has(pitchClass) && guides.has(pitchClass)) return "common-guide-tone";
  if (common.has(pitchClass)) return "common-tone";
  if (guides.has(pitchClass)) return "guide-tone";
  if (future.has(pitchClass)) return "future-chord-tone";
  return "approach-tone";
}

function targetRoleBonus(role) {
  return {
    "common-guide-tone": 6.4,
    "common-tone": 5.3,
    "guide-tone": 4.8,
    "future-chord-tone": 3.4,
    "approach-tone": 1.4,
  }[role] ?? 0;
}

export function scorePhraseTargetCandidate({
  candidate,
  sourcePitch,
  currentTones = [],
  nextTones = [],
  nextRootPc = null,
} = {}) {
  if (![candidate, sourcePitch].every(Number.isFinite)) return null;
  const current = chordClasses(currentTones);
  const future = chordClasses(nextTones);
  if (!future.size) return null;

  const common = new Set([...current].filter((pitchClass) => future.has(pitchClass)));
  const guides = guideToneClasses(nextRootPc, nextTones);
  const goals = nearbyPitches(future, candidate, 12);
  if (!goals.length) return null;

  let best = null;
  for (const goalPitch of goals) {
    const goalPc = pc(goalPitch);
    const role = targetRoleForPitchClass(goalPc, common, guides, future);
    const goalDistance = Math.abs(goalPitch - candidate);
    const sourceMotion = Math.abs(candidate - sourcePitch);
    const candidatePc = pc(candidate);
    const candidateIsCurrentChordTone = current.has(candidatePc);
    const candidateIsCommon = common.has(candidatePc);
    const candidateIsGuide = guides.has(candidatePc) && future.has(candidatePc);
    const semitonePreparation = goalDistance === 1 ? 1.35 : 0;
    const stepPreparation = goalDistance === 2 ? 0.7 : 0;
    const score = targetRoleBonus(role)
      + (candidateIsCommon ? 2.2 : 0)
      + (candidateIsGuide ? 1.3 : 0)
      + (candidateIsCurrentChordTone ? 0.8 : 0)
      + semitonePreparation
      + stepPreparation
      - goalDistance * 0.72
      - sourceMotion * 0.42;

    const entry = {
      candidate,
      goalPitch,
      goalPitchClass: goalPc,
      targetRole: role,
      score: Math.round(score * 1000) / 1000,
      sourceMotion,
      goalDistance,
      candidateIsCommon,
      candidateIsGuide,
      semitonePreparation: Boolean(semitonePreparation),
    };

    if (
      !best
      || entry.score > best.score + 1e-9
      || Math.abs(entry.score - best.score) <= 1e-9 && entry.sourceMotion < best.sourceMotion
      || Math.abs(entry.score - best.score) <= 1e-9
        && entry.sourceMotion === best.sourceMotion
        && entry.goalDistance < best.goalDistance
      || Math.abs(entry.score - best.score) <= 1e-9
        && entry.sourceMotion === best.sourceMotion
        && entry.goalDistance === best.goalDistance
        && entry.candidate < best.candidate
    ) {
      best = entry;
    }
  }
  return best;
}

export function rankPhraseTargetCandidates({
  pitch,
  scalePitchClasses = [],
  currentTones = [],
  nextTones = [],
  nextRootPc = null,
  limit = 4,
} = {}) {
  if (!Number.isFinite(pitch)) return [];
  const scale = new Set(Array.from(scalePitchClasses ?? [], pc));
  const current = chordClasses(currentTones);
  if (!scale.size || !current.size) return [];

  const candidates = [];
  for (let candidate = Math.max(0, pitch - limit); candidate <= Math.min(127, pitch + limit); candidate += 1) {
    const pitchClass = pc(candidate);
    if (!scale.has(pitchClass) || !current.has(pitchClass)) continue;
    const score = scorePhraseTargetCandidate({
      candidate,
      sourcePitch: pitch,
      currentTones,
      nextTones,
      nextRootPc,
    });
    if (score) candidates.push(score);
  }

  return candidates.sort((left, right) => (
    right.score - left.score
    || left.sourceMotion - right.sourceMotion
    || left.goalDistance - right.goalDistance
    || left.candidate - right.candidate
  ));
}

const RHYTHM_MELODY_LOOKAHEAD = Object.freeze({
  hipHop: Object.freeze({ maxShift: 0.25, tailReserve: 0.5 }),
  rap: Object.freeze({ maxShift: 0.25, tailReserve: 0.5 }),
  trap: Object.freeze({ maxShift: 0.1875, tailReserve: 0.5 }),
  neoSoul: Object.freeze({ maxShift: 0.25, tailReserve: 0.5 }),
  rnbSoul: Object.freeze({ maxShift: 0.25, tailReserve: 0.5 }),
  pop: Object.freeze({ maxShift: 0.125, tailReserve: 0.375 }),
  house: Object.freeze({ maxShift: 0.0625, tailReserve: 0.25 }),
  techno: Object.freeze({ maxShift: 0.0625, tailReserve: 0.25 }),
  jazz: Object.freeze({ maxShift: 0.25, tailReserve: 0.375 }),
});

function rhythmLookaheadProfile(genre) {
  return RHYTHM_MELODY_LOOKAHEAD[String(genre ?? "")] ?? Object.freeze({
    maxShift: 0.125,
    tailReserve: 0.375,
  });
}

function pulseNear(value, pulses = [], tolerance = 0.055) {
  return (pulses ?? []).some((pulse) => Math.abs(finite(pulse) - value) <= tolerance);
}

function grooveBarAt(conductor, bar) {
  return conductor?.bars?.find?.((candidate) => Number(candidate?.bar) === bar)
    ?? conductor?.bars?.[bar]
    ?? null;
}

/**
 * Read 1-2 bars of the already-authored Groove Conductor before a lead onset is
 * committed. This does not rewrite drums or bass; it lets melody/counterpoint
 * choose a nearby authored lead pulse that leaves space for the current
 * backbeat and for a busy incoming bar.
 */
export function planRhythmMelodyLookahead({
  grooveConductor = null,
  beat,
  beatsPerBar = 4,
  genre = "pop",
  lane = "leadPulses",
  horizonBars = 2,
} = {}) {
  if (!Number.isFinite(Number(beat)) || !grooveConductor?.bars?.length) return null;
  const barBeats = Math.max(1, finite(beatsPerBar, 4));
  const absoluteBeat = finite(beat);
  const bar = Math.max(0, Math.floor(absoluteBeat / barBeats));
  const offset = absoluteBeat - bar * barBeats;
  const current = grooveBarAt(grooveConductor, bar);
  if (!current) return null;

  const profile = rhythmLookaheadProfile(genre);
  const lanePulses = Array.isArray(current?.[lane]) ? current[lane] : [];

  const futureBars = [];
  for (let index = 1; index <= Math.max(1, Math.min(2, Math.round(horizonBars))); index += 1) {
    const candidate = grooveBarAt(grooveConductor, bar + index);
    if (candidate) futureBars.push(candidate);
  }
  const next = futureBars[0] ?? null;
  const nextOpeningWindow = 0.3;
  const nextOpeningLoad = next
    ? [
      pulseNear(0, next.anchors, nextOpeningWindow),
      pulseNear(0, next.snarePulses, nextOpeningWindow),
      pulseNear(0, next.bassPulses, nextOpeningWindow),
      pulseNear(0, next.chordPulses, nextOpeningWindow),
    ].filter(Boolean).length
    : 0;
  const transitionBoundary = Boolean(
    current?.transitionBoundary
    ?? (next && String(current?.sectionId ?? "") !== String(next?.sectionId ?? ""))
  );
  const nextSectionRole = String(
    current?.nextSectionRole
    ?? next?.sectionRole
    ?? next?.grooveDNA?.sectionRole
    ?? "",
  ).toLowerCase();
  const incomingPayoff = Boolean(
    transitionBoundary
    && ["payoff", "chorus", "drop"].includes(nextSectionRole)
  );
  // Reserve the outgoing tail only for a real section handoff/payoff. A busy
  // opening inside the same section should influence the next phrase without
  // misclassifying ordinary backbeat congestion as a transition.
  const reserveTail = Boolean(transitionBoundary && (nextOpeningLoad >= 2 || incomingPayoff));

  const scoreAt = (candidate) => {
    let score = 0;
    if (pulseNear(candidate, current.snarePulses, 0.08)) score += 4.2;
    if (pulseNear(candidate, current.anchors, 0.06)) score += 1.3;
    if (pulseNear(candidate, current.bassPulses, 0.06)) score += 1.5;
    if (pulseNear(candidate, current.protectedSpaces ?? current.spaces, 0.03)) score += 8;
    if (reserveTail && candidate >= barBeats - profile.tailReserve) {
      score += 2.5 + (candidate - (barBeats - profile.tailReserve)) * 2;
    }
    score -= pulseNear(candidate, lanePulses, 0.02) ? 1.1 : 0;
    return score;
  };

  const candidates = [...new Set([offset, ...lanePulses.map((pulse) => finite(pulse))])]
    .filter((candidate) => (
      candidate >= 0
      && candidate < barBeats - 0.01
      && Math.abs(candidate - offset) <= profile.maxShift + 1e-9
      && !pulseNear(candidate, current.protectedSpaces ?? current.spaces, 0.02)
    ))
    .map((candidate) => ({
      offset: candidate,
      shift: candidate - offset,
      score: scoreAt(candidate),
    }))
    .sort((left, right) => (
      left.score - right.score
      || Math.abs(left.shift) - Math.abs(right.shift)
      || left.offset - right.offset
    ));

  const chosen = candidates[0];
  const sourceScore = scoreAt(offset);
  const base = {
    version: 2,
    sourceBeat: Math.round(absoluteBeat * 10000) / 10000,
    bar,
    horizonBars: futureBars.length,
    nextOpeningLoad,
    incomingPayoff,
    reserveTail,
  };
  if (!chosen || Math.abs(chosen.shift) < 1e-9 || chosen.score >= sourceScore - 0.45) {
    if (!futureBars.length && !lanePulses.length) return null;
    return Object.freeze({
      ...base,
      beat: Math.round(absoluteBeat * 10000) / 10000,
      shiftBeats: 0,
      role: reserveTail ? "prepare-next-bar-hold" : "hold-authored-pocket",
    });
  }

  return Object.freeze({
    ...base,
    beat: Math.round((bar * barBeats + chosen.offset) * 10000) / 10000,
    shiftBeats: Math.round(chosen.shift * 10000) / 10000,
    role: reserveTail ? "prepare-next-bar" : "avoid-current-congestion",
  });
}

/** Choose a nearby preparation for a real future chord, without adding notes or moving time. */
export function planMusicalLookahead({
  pitch, start, boundary, totalBeats, scalePitchClasses = [], currentTones = [],
  nextTones = [], currentRootPc = null, nextRootPc = null,
  trackId = "melody", protectedLanding = false,
} = {}) {
  if (![pitch, start, boundary, totalBeats].every(Number.isFinite)
    || protectedLanding || boundary >= totalBeats - 0.01
    || boundary <= start || boundary - start > 1.5
    || !["bass", "melody", "counterpoint"].includes(trackId)) return null;

  const scale = new Set(Array.from(scalePitchClasses ?? [], pc));
  const future = chordClasses(nextTones);
  if (!future.size || !scale.has(pc(pitch))) return null;
  const bass = trackId === "bass";

  if (bass) {
    const goals = nearbyPitches(future, pitch, 12);
    if (!goals.length) return null;
    const goalFor = (value) => nearestPitch(goals, value);
    const distance = (value) => Math.abs(goalFor(value) - value);
    const score = (value) => distance(value) + Math.abs(value - pitch) * 0.35;
    let chosen = pitch;
    for (let candidate = Math.max(0, pitch - 2); candidate <= Math.min(127, pitch + 2); candidate += 1) {
      // Bass approaches the incoming root by scale step, rather than stating it early.
      if (!scale.has(pc(candidate)) || distance(candidate) === 0) continue;
      if (score(candidate) < score(chosen) - 1e-7) chosen = candidate;
    }
    if (chosen === pitch) return null;
    return {
      pitch: chosen,
      goalPitch: goalFor(chosen),
      boundary,
      role: "root-approach",
      targetRole: "future-root",
      score: null,
    };
  }

  const ranked = rankPhraseTargetCandidates({
    pitch,
    scalePitchClasses,
    currentTones,
    nextTones,
    nextRootPc,
    limit: 4,
  });
  if (!ranked.length) return null;

  const source = scorePhraseTargetCandidate({
    candidate: pitch,
    sourcePitch: pitch,
    currentTones,
    nextTones,
    nextRootPc,
  });
  const chosen = ranked[0];
  if (!chosen || chosen.candidate === pitch || source && chosen.score <= source.score + 0.35) return null;

  return {
    pitch: chosen.candidate,
    goalPitch: chosen.goalPitch,
    boundary,
    role: "phrase-target",
    targetRole: chosen.targetRole,
    score: chosen.score,
    sourceScore: source?.score ?? null,
    sourceMotion: chosen.sourceMotion,
    goalDistance: chosen.goalDistance,
    semitonePreparation: chosen.semitonePreparation,
    currentRootPc: Number.isFinite(Number(currentRootPc)) ? pc(Number(currentRootPc)) : null,
    nextRootPc: Number.isFinite(Number(nextRootPc)) ? pc(Number(nextRootPc)) : null,
  };
}

export const MUSICAL_LOOKAHEAD_VERSION = "2.1";
