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

  const scale = new Set(scalePitchClasses.map(pc));
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

export const MUSICAL_LOOKAHEAD_VERSION = "2.0";
