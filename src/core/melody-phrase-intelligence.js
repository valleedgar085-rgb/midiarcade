import { trackGroovePulses } from "./groove-contract.js";

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
function clamp(value, min = 0, max = 1) { return Math.min(max, Math.max(min, finite(value))); }
function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}
function mod12(value) { return ((Math.round(finite(value)) % 12) + 12) % 12; }
function melodyTrack(song) { return (song?.tracks ?? []).find((track) => track?.id === "melody") ?? null; }
function sections(song) { return Array.isArray(song?.structure) ? song.structure : (song?.sections ?? []); }
function bounds(song, section) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = Number.isFinite(Number(section?.startBeat)) ? Number(section.startBeat) : finite(section?.startBar, 0) * beatsPerBar;
  const end = Number.isFinite(Number(section?.endBeat)) ? Number(section.endBeat) : start + Math.max(1, finite(section?.bars, 1)) * beatsPerBar;
  return { start, end, beatsPerBar };
}
function notesIn(track, range) {
  return (track?.notes ?? []).filter((note) => finite(note?.start) >= range.start - 1e-6 && finite(note?.start) < range.end - 1e-6)
    .sort((a, b) => finite(a.start) - finite(b.start) || finite(a.pitch) - finite(b.pitch));
}
function harmonyAt(song, beat) {
  let result = song?.harmony?.[0] ?? null;
  for (const event of song?.harmony ?? []) {
    const start = finite(event?.start ?? event?.startBeat);
    if (start <= beat + 1e-6) result = event;
    if (beat >= start - 1e-6 && beat < start + Math.max(0.01, finite(event?.duration, 0.25)) - 1e-6) return event;
  }
  return result;
}
function chordClasses(event) {
  if (Array.isArray(event?.tones) && event.tones.length) return new Set(event.tones.map(mod12));
  if (Number.isFinite(Number(event?.rootPc))) return new Set([mod12(event.rootPc)]);
  return null;
}
function contour(notes) {
  return notes.slice(1).map((note, index) => Math.sign(finite(note.pitch) - finite(notes[index].pitch)));
}
function contourIdentity(notes) {
  const directions = contour(notes);
  const movementRatio = directions.length
    ? directions.filter((direction) => direction !== 0).length / directions.length
    : 0;
  if (notes.length < 4) return clamp(0.45 + movementRatio * 0.2);
  const windows = [];
  for (let i = 0; i <= notes.length - 4; i += 1) windows.push(contour(notes.slice(i, i + 4)).join(","));
  const counts = new Map();
  for (const item of windows) counts.set(item, (counts.get(item) ?? 0) + 1);
  const repeated = [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  const repeatedRatio = repeated / Math.max(1, windows.length);
  return clamp(0.25 + repeatedRatio * 0.45 + movementRatio * 0.3 - (1 - movementRatio) * 0.25);
}
function contourMovement(notes) {
  if (notes.length < 2) return 0.55;
  const intervals = notes.slice(1).map((note, index) => Math.abs(finite(note.pitch) - finite(notes[index].pitch)));
  const moving = intervals.filter((value) => value >= 1 && value <= 7).length / intervals.length;
  const extreme = intervals.filter((value) => value > 12).length / intervals.length;
  return clamp(moving - extreme * 0.8);
}
function leapDiscipline(notes) {
  if (notes.length < 3) return 0.72;
  const intervals = notes.slice(1).map((note, index) => Math.abs(finite(note.pitch) - finite(notes[index].pitch)));
  const stepwiseRatio = intervals.filter((value) => value <= 5).length / Math.max(1, intervals.length);
  let isolatedSpikes = 0;
  let hugeLeaps = 0;
  for (let index = 1; index < notes.length - 1; index += 1) {
    const previous = finite(notes[index - 1]?.pitch);
    const current = finite(notes[index]?.pitch);
    const next = finite(notes[index + 1]?.pitch);
    const left = Math.abs(current - previous);
    const right = Math.abs(next - current);
    const direct = Math.abs(next - previous);
    if (left >= 7 && right >= 7 && direct <= 5) isolatedSpikes += 1;
    if (left > 12 || right > 12) hugeLeaps += 1;
  }
  const interior = Math.max(1, notes.length - 2);
  return clamp(
    0.46
      + stepwiseRatio * 0.5
      - (isolatedSpikes / interior) * 0.72
      - (hugeLeaps / interior) * 0.5,
  );
}
function groovePurpose(song, notes, range) {
  if (!notes.length) return 0;
  const pulses = trackGroovePulses(song?.grooveConductor, "melody", range.start, range.end, range.beatsPerBar);
  if (!pulses.length) return 0.75;
  const fit = notes.filter((note) => pulses.some((pulse) => Math.abs(pulse - finite(note.start)) <= 0.12)).length / notes.length;
  return clamp(0.35 + fit * 0.65);
}
function harmonicLandings(song, notes) {
  if (!notes.length) return 0;
  const important = notes.filter((note, index) => finite(note.duration, 0.25) >= 0.65 || index === notes.length - 1);
  if (!important.length) return 0.65;
  let contextual = 0, fit = 0;
  for (const note of important) {
    const classes = chordClasses(harmonyAt(song, finite(note.start)));
    if (!classes?.size) continue;
    contextual += 1;
    if (classes.has(mod12(note.pitch))) fit += 1;
  }
  return contextual ? fit / contextual : 0.7;
}
function expressiveShape(notes) {
  if (notes.length < 3) return 0.55;
  const velocities = notes.map((note) => finite(note.velocity, 84));
  const durations = notes.map((note) => finite(note.duration, 0.25));
  const spread = (Math.max(...velocities) - Math.min(...velocities)) / 24;
  const durationKinds = new Set(durations.map((value) => Math.round(value * 4) / 4)).size;
  return clamp(spread * 0.55 + Math.min(1, durationKinds / 3) * 0.45);
}

function nearestDistance(value, candidates = []) {
  if (!candidates.length) return Infinity;
  return Math.min(...candidates.map((candidate) => Math.abs(value - candidate)));
}

function phraseGroups(notes, beatsPerBar = 4) {
  const ordered = [...notes].sort((left, right) => finite(left.start) - finite(right.start));
  if (!ordered.length) return [];
  const breakGap = Math.max(0.5, Math.min(1, beatsPerBar * 0.25));
  const groups = [[ordered[0]]];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const previousEnd = finite(previous.start) + Math.max(0.05, finite(previous.duration, 0.25));
    const gap = finite(ordered[index].start) - previousEnd;
    if (gap >= breakGap - 1e-9) groups.push([]);
    groups.at(-1).push(ordered[index]);
  }
  return groups;
}

function phrasePlacement(song, notes, range) {
  if (!notes.length || !range) return 0;
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const groups = phraseGroups(notes, beatsPerBar);
  if (!groups.length) return 0;
  const pulses = trackGroovePulses(
    song?.grooveConductor,
    "melody",
    range.start,
    range.end,
    beatsPerBar,
  );
  const pulseFit = groups.map((group) => {
    const phraseStart = finite(group[0]?.start);
    if (!pulses.length) return 0.78;
    const distance = nearestDistance(phraseStart, pulses);
    return clamp(1 - distance / 0.35);
  });
  const firstStart = finite(groups[0]?.[0]?.start, range.start);
  const entryDelay = Math.max(0, firstStart - range.start);
  const entryFit = entryDelay <= 1.5
    ? 1
    : entryDelay <= 2
      ? 0.82
      : entryDelay <= beatsPerBar
        ? 0.58
        : 0.3;
  return clamp(
    (pulseFit.reduce((sum, value) => sum + value, 0) / pulseFit.length) * 0.78
    + entryFit * 0.22,
  );
}

function directionSimilarity(left, right) {
  const leftDirections = contour(left);
  const rightDirections = contour(right);
  const length = Math.min(leftDirections.length, rightDirections.length);
  if (!length) return 0.55;
  let matches = 0;
  let compatible = 0;
  for (let index = 0; index < length; index += 1) {
    const a = leftDirections[index];
    const b = rightDirections[index];
    if (a === b) matches += 1;
    if (a === b || a === 0 || b === 0) compatible += 1;
  }
  return clamp((matches / length) * 0.72 + (compatible / length) * 0.28);
}

function relativeIntervalShape(notes) {
  if (notes.length < 2) return [];
  const base = finite(notes[0]?.pitch);
  return notes.slice(1).map((note) => {
    const interval = finite(note?.pitch) - base;
    return Math.sign(interval) * Math.min(7, Math.abs(Math.round(interval)));
  });
}

function intervalShapeSimilarity(left, right) {
  const a = relativeIntervalShape(left);
  const b = relativeIntervalShape(right);
  const length = Math.min(a.length, b.length);
  if (!length) return 0.55;
  let score = 0;
  for (let index = 0; index < length; index += 1) {
    const distance = Math.abs(a[index] - b[index]);
    score += clamp(1 - distance / 7);
  }
  return clamp(score / length);
}

function normalizedRhythmShape(notes) {
  if (notes.length < 2) return [];
  const start = finite(notes[0]?.start);
  const span = Math.max(0.25, finite(notes.at(-1)?.start) - start);
  return notes.slice(1).map((note) => round((finite(note?.start) - start) / span, 3));
}

function rhythmShapeSimilarity(left, right) {
  const a = normalizedRhythmShape(left);
  const b = normalizedRhythmShape(right);
  const length = Math.min(a.length, b.length);
  if (!length) return 0.6;
  let score = 0;
  for (let index = 0; index < length; index += 1) {
    score += clamp(1 - Math.abs(a[index] - b[index]) / 0.42);
  }
  return clamp(score / length);
}

function responseGapFit(statement, answer, beatsPerBar = 4) {
  const statementEnd = finite(statement.at(-1)?.start)
    + Math.max(0.05, finite(statement.at(-1)?.duration, 0.25));
  const gap = Math.max(0, finite(answer[0]?.start) - statementEnd);
  const ideal = Math.min(0.75, beatsPerBar * 0.1875);
  if (gap < 0.12) return 0.35;
  if (gap <= ideal) return clamp(0.72 + (gap / Math.max(0.01, ideal)) * 0.28);
  if (gap <= beatsPerBar * 0.5) {
    return clamp(1 - (gap - ideal) / Math.max(0.25, beatsPerBar * 0.5 - ideal) * 0.28);
  }
  return clamp(0.72 - (gap - beatsPerBar * 0.5) / Math.max(0.5, beatsPerBar) * 0.52);
}

function familyBandFit(value) {
  const familiarity = clamp(value);
  if (familiarity < 0.42) return clamp(familiarity / 0.42);
  if (familiarity <= 0.86) return 1;
  return clamp(1 - (familiarity - 0.86) / 0.14 * 0.72);
}

function phrasePairConversation(statement, answer, beatsPerBar = 4) {
  const contourFit = directionSimilarity(statement, answer);
  const intervalFit = intervalShapeSimilarity(statement, answer);
  const rhythmFit = rhythmShapeSimilarity(statement, answer);
  const familiarity = clamp(contourFit * 0.5 + intervalFit * 0.3 + rhythmFit * 0.2);
  const familyFit = familyBandFit(familiarity);
  const variationFit = clamp(1 - Math.max(0, familiarity - 0.9) / 0.1);
  const responseFit = responseGapFit(statement, answer, beatsPerBar);
  const lengthRatio = Math.min(statement.length, answer.length) / Math.max(statement.length, answer.length);
  const balanceFit = clamp(0.55 + lengthRatio * 0.45);
  return clamp(
    familyFit * 0.42
    + responseFit * 0.28
    + variationFit * 0.18
    + balanceFit * 0.12,
  );
}

function phraseConversation(notes, beatsPerBar = 4) {
  const groups = phraseGroups(notes, beatsPerBar).filter((group) => group.length >= 2);
  if (groups.length < 2) return { score: 0.76, pairs: 0 };
  const pairScores = [];
  for (let index = 0; index < groups.length - 1; index += 1) {
    pairScores.push(phrasePairConversation(groups[index], groups[index + 1], beatsPerBar));
  }
  const average = pairScores.reduce((sum, value) => sum + value, 0) / pairScores.length;
  const weakest = Math.min(...pairScores);
  return {
    score: clamp(average * 0.62 + weakest * 0.38),
    pairs: pairScores.length,
  };
}

function melodicArcPayoff(notes, range) {
  if (!range || notes.length < 4) return { score: 0.74, peakPhase: null, peakPitch: null };
  const ordered = [...notes].sort((a, b) => finite(a.start) - finite(b.start));
  const pitches = ordered.map((note) => finite(note.pitch));
  const velocities = ordered.map((note) => finite(note.velocity, 84));
  const minPitch = Math.min(...pitches);
  const maxPitch = Math.max(...pitches);
  const pitchSpan = Math.max(1, maxPitch - minPitch);
  const minVelocity = Math.min(...velocities);
  const maxVelocity = Math.max(...velocities);
  const velocitySpan = Math.max(1, maxVelocity - minVelocity);
  const sectionLength = Math.max(0.25, finite(range.end) - finite(range.start));

  const emphasis = ordered.map((note) => {
    const pitchEnergy = (finite(note.pitch) - minPitch) / pitchSpan;
    const velocityEnergy = (finite(note.velocity, 84) - minVelocity) / velocitySpan;
    const durationEnergy = clamp(finite(note.duration, 0.25) / 0.9);
    // Melodic peak is primarily contour/register authority. Performance
    // emphasis can support a peak, but a loud/held cadence must not falsely
    // become the section's melodic high point.
    return pitchEnergy * 0.78 + velocityEnergy * 0.17 + durationEnergy * 0.05;
  });
  let peakIndex = 0;
  for (let index = 1; index < emphasis.length; index += 1) {
    if (emphasis[index] > emphasis[peakIndex] + 1e-9) peakIndex = index;
  }
  const peak = ordered[peakIndex];
  const peakPhase = clamp((finite(peak.start) - finite(range.start)) / sectionLength);
  const peakPlacement = peakPhase >= 0.52 && peakPhase <= 0.86
    ? 1
    : peakPhase < 0.52
      ? clamp(1 - (0.52 - peakPhase) / 0.52)
      : clamp(1 - (peakPhase - 0.86) / 0.14);

  const early = emphasis.slice(0, Math.max(1, Math.floor(emphasis.length * 0.4)));
  const lateStart = Math.max(1, Math.floor(emphasis.length * 0.55));
  const late = emphasis.slice(lateStart);
  const earlyMean = early.reduce((sum, value) => sum + value, 0) / early.length;
  const lateMean = late.reduce((sum, value) => sum + value, 0) / Math.max(1, late.length);
  const developmentLift = clamp(0.5 + (lateMean - earlyMean) * 1.15);

  const ending = ordered.at(-1);
  const resolutionDrop = Math.max(0, finite(peak.pitch) - finite(ending.pitch));
  const endingAfterPeak = peakIndex < ordered.length - 1;
  const resolutionFit = endingAfterPeak
    ? clamp(0.5 + Math.min(7, resolutionDrop) / 14 + (finite(ending.duration, 0.25) >= 0.45 ? 0.12 : 0))
    : 0.3;

  const spanFit = clamp(pitchSpan / 7);
  return {
    score: clamp(
      peakPlacement * 0.34
      + developmentLift * 0.28
      + resolutionFit * 0.26
      + spanFit * 0.12,
    ),
    peakPhase: round(peakPhase),
    peakPitch: Math.round(finite(peak.pitch)),
  };
}

function phraseBreathing(notes, range, beatsPerBar = 4) {
  if (notes.length < 3 || !range) return 0.55;
  const ordered = [...notes].sort((left, right) => finite(left.start) - finite(right.start));
  const gaps = [];
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const currentEnd = finite(ordered[index].start)
      + Math.max(0.05, finite(ordered[index].duration, 0.25));
    const gap = finite(ordered[index + 1].start) - currentEnd;
    if (gap > 0.05) gaps.push(gap);
  }
  const sectionLength = Math.max(0.25, finite(range.end) - finite(range.start));
  const breathThreshold = Math.min(0.5, beatsPerBar * 0.125);
  const meaningfulBreaths = gaps.filter((gap) => gap >= breathThreshold).length;
  const expectedPhrases = Math.max(1, Math.ceil(sectionLength / Math.max(2, beatsPerBar * 2)));
  const breathingRatio = meaningfulBreaths / expectedPhrases;
  const occupancy = ordered.reduce(
    (sum, note) => sum + Math.max(0.05, finite(note.duration, 0.25)),
    0,
  ) / sectionLength;
  const continuousPenalty = gaps.length === 0 && occupancy >= 0.62 ? 0.34 : 0;
  return clamp(0.48 + Math.min(1, breathingRatio) * 0.46 - continuousPenalty);
}

/**
 * Read-only melody phrase critic. It measures musical intent rather than density.
 * No notes are inserted, deleted, moved, or repitched here.
 */
export function evaluateMelodyPhraseIntelligence(song) {
  const track = melodyTrack(song);
  if (!track) return Object.freeze({ version: 1, passed: false, score: 0, reason: "missing-melody", sections: [] });
  const reports = sections(song).map((section) => {
    const range = bounds(song, section);
    const notes = notesIn(track, range);
    const metrics = {
      motifIdentity: round(contourIdentity(notes)),
      contourMovement: round(contourMovement(notes)),
      leapDiscipline: round(leapDiscipline(notes)),
      groovePurpose: round(groovePurpose(song, notes, range)),
      harmonicLandings: round(harmonicLandings(song, notes)),
      expressiveShape: round(expressiveShape(notes)),
      phraseBreathing: round(phraseBreathing(notes, range, Math.max(1, finite(song?.meta?.beatsPerBar, 4)))),
      phrasePlacement: round(phrasePlacement(song, notes, range)),
      phraseConversation: round(phraseConversation(notes, range.beatsPerBar).score),
      phraseConversationPairs: phraseConversation(notes, range.beatsPerBar).pairs,
      melodicArcPayoff: round(melodicArcPayoff(notes, range).score),
      melodicArcPeakPhase: melodicArcPayoff(notes, range).peakPhase,
      melodicArcPeakPitch: melodicArcPayoff(notes, range).peakPitch,
    };
    const score = Math.round(100 * (
      metrics.motifIdentity * 0.2
      + metrics.contourMovement * 0.13
      + metrics.leapDiscipline * 0.1
      + metrics.groovePurpose * 0.19
      + metrics.harmonicLandings * 0.2
      + metrics.expressiveShape * 0.1
      + metrics.phraseBreathing * 0.08
    ));
    return Object.freeze({ sectionId: String(section?.id ?? ""), notes: notes.length, score, metrics: Object.freeze(metrics) });
  });
  const active = reports.filter((entry) => entry.notes >= 2);
  const score = Math.round(active.reduce((sum, entry) => sum + entry.score, 0) / Math.max(1, active.length));
  const weakestSection = [...active].sort((a, b) => a.score - b.score)[0] ?? null;
  const weakestPlacementSection = [...active].sort((a, b) => (
    finite(a?.metrics?.phrasePlacement, 1) - finite(b?.metrics?.phrasePlacement, 1)
    || a.score - b.score
    || String(a.sectionId).localeCompare(String(b.sectionId))
  ))[0] ?? null;
  const weakestArcSection = [...active].sort((a, b) => (
    finite(a?.metrics?.melodicArcPayoff, 1) - finite(b?.metrics?.melodicArcPayoff, 1)
    || a.score - b.score
    || String(a.sectionId).localeCompare(String(b.sectionId))
  ))[0] ?? null;
    const conversationSections = active.filter((entry) => finite(entry?.metrics?.phraseConversationPairs, 0) > 0);
  const weakestConversationSection = [...conversationSections].sort((a, b) => (
    finite(a?.metrics?.phraseConversation, 1) - finite(b?.metrics?.phraseConversation, 1)
    || a.score - b.score
    || String(a.sectionId).localeCompare(String(b.sectionId))
  ))[0] ?? null;
  return Object.freeze({
    version: 1,
    authority: "melody-phrase-intelligence-v1",
    mode: "read-only",
    passed: active.length > 0 && score >= 68,
    score,
    reason: active.length ? (score >= 68 ? "melody-phrase-coherent" : "melody-phrase-weak") : "melody-inactive",
    weakestSection,
    weakestPlacementSection,
    weakestConversationSection,
    weakestArcSection,
    sections: Object.freeze(reports),
  });
}
