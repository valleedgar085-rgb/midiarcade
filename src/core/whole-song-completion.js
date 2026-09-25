const PAYOFF_NAMES = new Set(["chorus", "hook", "theme", "drop"]);
const STORY_NAMES = new Set(["verse", "idea"]);
const CONTRAST_NAMES = new Set(["bridge", "breakdown", "break", "solo"]);
const BACKBONE_TRACKS = Object.freeze(["drums", "bass", "chords"]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function round(value, places = 4) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizedName(section) {
  return String(section?.name ?? section?.type ?? section?.id ?? "idea")
    .toLowerCase()
    .replace(/\d+/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(" ")[0] || "idea";
}

function sectionBounds(section, beatsPerBar = 4) {
  const start = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
  const bars = Math.max(0.25, finite(section?.bars, 1));
  const end = Math.max(start + 0.25, finite(section?.endBeat, start + bars * beatsPerBar));
  return { start, end, beats: Math.max(0.25, end - start), bars };
}

function noteStart(note) {
  return finite(note?.start, finite(note?.startBeat, finite(note?.beat, 0)));
}

function sectionNotes(track, bounds) {
  return (track?.notes ?? []).filter((note) => {
    const start = noteStart(note);
    return start >= bounds.start - 1e-6 && start < bounds.end - 1e-6;
  });
}

function sectionStats(song, section, beatsPerBar = 4) {
  const bounds = sectionBounds(section, beatsPerBar);
  const lanes = [];
  let noteCount = 0;
  let velocityTotal = 0;
  let backbonePresent = 0;
  const trackCounts = {};

  for (const track of song?.tracks ?? []) {
    const notes = sectionNotes(track, bounds);
    trackCounts[String(track?.id ?? "")] = notes.length;
    if (!notes.length) continue;
    lanes.push(String(track?.id ?? ""));
    noteCount += notes.length;
    velocityTotal += notes.reduce((sum, note) => sum + clamp(finite(note?.velocity, 96), 1, 127), 0);
    if (BACKBONE_TRACKS.includes(String(track?.id ?? ""))) backbonePresent += 1;
  }

  const rate = noteCount / bounds.beats;
  const avgVelocity = noteCount ? velocityTotal / noteCount : 0;
  return Object.freeze({
    sectionId: section?.id ?? null,
    name: normalizedName(section),
    startBeat: round(bounds.start),
    endBeat: round(bounds.end),
    noteCount,
    notesPerBeat: round(rate),
    activeLanes: lanes.length,
    activeLaneIds: Object.freeze(lanes),
    backbonePresent,
    backboneCoverage: round(backbonePresent / BACKBONE_TRACKS.length),
    avgVelocity: round(avgVelocity, 2),
    trackCounts: Object.freeze(trackCounts),
  });
}

function energyIndex(stats) {
  return (
    clamp(stats.activeLanes / 6) * 0.36
    + clamp(stats.notesPerBeat / 5) * 0.44
    + clamp(stats.avgVelocity / 127) * 0.2
  );
}

function previousMusicalSection(stats, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (!["intro", "outro"].includes(stats[cursor].name)) return stats[cursor];
  }
  return index > 0 ? stats[index - 1] : null;
}

function payoffLiftReport(stats) {
  const payoffs = [];
  for (let index = 0; index < stats.length; index += 1) {
    const current = stats[index];
    if (!PAYOFF_NAMES.has(current.name)) continue;
    const previous = previousMusicalSection(stats, index);
    if (!previous) continue;
    const lift = energyIndex(current) - energyIndex(previous);
    payoffs.push(Object.freeze({
      sectionId: current.sectionId,
      fromSectionId: previous.sectionId,
      lift: round(lift),
      laneDelta: current.activeLanes - previous.activeLanes,
      densityDelta: round(current.notesPerBeat - previous.notesPerBeat),
      velocityDelta: round(current.avgVelocity - previous.avgVelocity, 2),
      passed: lift >= 0.025 || current.activeLanes > previous.activeLanes,
    }));
  }
  const score = payoffs.length
    ? Math.round(payoffs.reduce((sum, entry) => sum + clamp((entry.lift + 0.08) / 0.18), 0) / payoffs.length * 100)
    : 72;
  return Object.freeze({
    score,
    passed: !payoffs.length || payoffs.every((entry) => entry.passed),
    payoffs: Object.freeze(payoffs),
  });
}

function backboneCoverageReport(stats) {
  const body = stats.filter((entry) => !["intro", "outro", "breakdown", "break"].includes(entry.name));
  const eligible = body.length ? body : stats;
  const average = eligible.length
    ? eligible.reduce((sum, entry) => sum + entry.backboneCoverage, 0) / eligible.length
    : 1;
  const weakSections = eligible
    .filter((entry) => entry.backboneCoverage < 2 / 3)
    .map((entry) => entry.sectionId);
  return Object.freeze({
    score: Math.round(clamp(average) * 100),
    passed: weakSections.length === 0,
    weakSections: Object.freeze(weakSections),
  });
}

function sectionFingerprint(stats) {
  return [
    stats.trackCounts.drums ?? 0,
    stats.trackCounts.bass ?? 0,
    stats.trackCounts.chords ?? 0,
    stats.trackCounts.melody ?? 0,
    stats.trackCounts.counterpoint ?? 0,
    stats.trackCounts.pad ?? 0,
  ];
}

function fingerprintDistance(left, right) {
  const a = sectionFingerprint(left);
  const b = sectionFingerprint(right);
  const total = a.reduce((sum, value) => sum + value, 0) + b.reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  return a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0) / total;
}

function returnDevelopmentReport(stats) {
  const payoffs = stats.filter((entry) => PAYOFF_NAMES.has(entry.name));
  if (payoffs.length < 2) {
    return Object.freeze({ score: 76, passed: true, comparisons: Object.freeze([]), reason: "single-payoff-form" });
  }
  const comparisons = [];
  for (let index = 1; index < payoffs.length; index += 1) {
    const previous = payoffs[index - 1];
    const current = payoffs[index];
    const distance = fingerprintDistance(previous, current);
    const identityRetained = distance <= 0.62;
    const developmentPresent = distance >= 0.035
      || current.noteCount !== previous.noteCount
      || Math.abs(current.avgVelocity - previous.avgVelocity) >= 2;
    comparisons.push(Object.freeze({
      fromSectionId: previous.sectionId,
      toSectionId: current.sectionId,
      distance: round(distance),
      identityRetained,
      developmentPresent,
      passed: identityRetained && developmentPresent,
    }));
  }
  const score = Math.round(comparisons.reduce((sum, entry) => {
    const development = clamp(entry.distance / 0.16);
    const identity = clamp(1 - Math.max(0, entry.distance - 0.35) / 0.35);
    return sum + (development * 0.55 + identity * 0.45);
  }, 0) / comparisons.length * 100);
  return Object.freeze({
    score,
    passed: comparisons.every((entry) => entry.passed),
    comparisons: Object.freeze(comparisons),
  });
}

function contrastReport(stats) {
  if (stats.length < 2) return Object.freeze({ score: 75, passed: true, strongestDelta: 0, pairCount: 0 });
  const deltas = [];
  for (let index = 1; index < stats.length; index += 1) {
    const left = stats[index - 1];
    const right = stats[index];
    const energyDelta = Math.abs(energyIndex(right) - energyIndex(left));
    const laneDelta = Math.abs(right.activeLanes - left.activeLanes) / 6;
    const semanticBonus = CONTRAST_NAMES.has(left.name) || CONTRAST_NAMES.has(right.name) ? 0.06 : 0;
    deltas.push(clamp(energyDelta + laneDelta * 0.35 + semanticBonus));
  }
  const strongestDelta = Math.max(...deltas, 0);
  const score = Math.round(clamp(strongestDelta / 0.16) * 100);
  return Object.freeze({
    score,
    passed: strongestDelta >= 0.055,
    strongestDelta: round(strongestDelta),
    pairCount: deltas.length,
  });
}

function narrativeReport(stats, genre) {
  const names = stats.map((entry) => entry.name);
  const normalizedGenre = String(genre ?? "");
  let checks = [];

  if (normalizedGenre === "hipHop" || normalizedGenre === "rap") {
    const bodyStart = names[0] === "intro" ? 1 : 0;
    const firstVerse = names.findIndex((name, index) => index >= bodyStart && STORY_NAMES.has(name));
    const payoffs = names.map((name, index) => PAYOFF_NAMES.has(name) ? index : -1).filter((index) => index >= 0);
    const firstPayoff = payoffs[0] ?? -1;
    const finalPayoff = payoffs.at(-1) ?? -1;
    const laterVerse = names.findIndex((name, index) => index > firstPayoff && STORY_NAMES.has(name));
    checks = [
      firstVerse === bodyStart,
      firstPayoff > firstVerse,
      payoffs.length < 2 || finalPayoff > laterVerse,
      finalPayoff < 0 || names[finalPayoff + 1] !== "verse",
    ];
  } else if (normalizedGenre === "pop") {
    const finalPayoff = Math.max(names.lastIndexOf("chorus"), names.lastIndexOf("hook"), names.lastIndexOf("theme"));
    const prechorusBefore = finalPayoff > 0 && names.slice(0, finalPayoff).includes("prechorus");
    const contrastBefore = finalPayoff > 0 && names
      .slice(Math.floor(names.length * 0.35), finalPayoff)
      .some((name) => CONTRAST_NAMES.has(name));
    checks = [
      finalPayoff > 0,
      prechorusBefore || contrastBefore || names.filter((name) => PAYOFF_NAMES.has(name)).length >= 2,
      finalPayoff < 0 || names[finalPayoff + 1] !== "verse",
    ];
  } else {
    checks = [stats.length > 0];
  }

  const score = Math.round(checks.filter(Boolean).length / Math.max(1, checks.length) * 100);
  return Object.freeze({ score, passed: checks.every(Boolean), checks: Object.freeze(checks), names: Object.freeze(names) });
}

function finalResolutionReport(song) {
  const finalBoundary = song?.sectionCompletion?.finalBoundary ?? null;
  if (!finalBoundary) return Object.freeze({ score: 65, passed: false, reason: "missing-final-boundary" });
  const endingFit = clamp(finite(finalBoundary.endingFit, 0));
  const cadenceFit = clamp(finite(finalBoundary.cadenceFit, 0));
  const score = Math.round((endingFit * 0.5 + cadenceFit * 0.5) * 100);
  return Object.freeze({
    score,
    passed: endingFit >= 0.6 && cadenceFit >= 0.6,
    endingFit: round(endingFit),
    cadenceFit: round(cadenceFit),
  });
}

export function evaluateWholeSongCompletion(song) {
  const structure = Array.isArray(song?.structure) ? song.structure : Array.isArray(song?.sections) ? song.sections : [];
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const stats = structure.map((section) => sectionStats(song, section, beatsPerBar));
  const payoffLift = payoffLiftReport(stats);
  const backbone = backboneCoverageReport(stats);
  const returnDevelopment = returnDevelopmentReport(stats);
  const contrast = contrastReport(stats);
  const narrative = narrativeReport(stats, song?.meta?.genre ?? song?.genre);
  const finalResolution = finalResolutionReport(song);
  const silentSections = stats.filter((entry) => entry.noteCount === 0).map((entry) => entry.sectionId);

  const score = Math.round(
    payoffLift.score * 0.24
    + backbone.score * 0.18
    + returnDevelopment.score * 0.16
    + contrast.score * 0.14
    + narrative.score * 0.16
    + finalResolution.score * 0.12
  );
  const passed = score >= 72
    && silentSections.length === 0
    && backbone.score >= 62
    && finalResolution.passed
    && narrative.score >= 50;

  return Object.freeze({
    version: 1,
    authority: "whole-song-completion-v1",
    readOnly: true,
    genre: String(song?.meta?.genre ?? song?.genre ?? "unknown"),
    score,
    passed,
    status: passed ? "complete" : "needs-attention",
    checks: Object.freeze({
      noSilentSections: silentSections.length === 0,
      payoffLift: payoffLift.passed,
      backboneCoverage: backbone.passed,
      returnDevelopment: returnDevelopment.passed,
      contrast: contrast.passed,
      narrative: narrative.passed,
      finalResolution: finalResolution.passed,
    }),
    silentSections: Object.freeze(silentSections),
    payoffLift,
    backbone,
    returnDevelopment,
    contrast,
    narrative,
    finalResolution,
    sections: Object.freeze(stats),
  });
}
