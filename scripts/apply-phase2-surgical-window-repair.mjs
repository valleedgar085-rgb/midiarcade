import fs from "node:fs";

const path = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");

const insertAnchor = `function finishRepairedSong(song, config, diagnosis, sourceCandidate, attempt) {`;
if (!source.includes(insertAnchor)) throw new Error("Missing finishRepairedSong anchor.");
if (source.includes("export function diagnoseSurgicalRepairWindow")) {
  throw new Error("Surgical repair helpers already exist; refusing to apply twice.");
}

const helpers = `function surgicalWindowDimensionScore(window, diagnosis = {}) {
  const diagnostics = window?.diagnostics ?? {};
  const unit = (name, fallback = 0.5) => clamp(finite(diagnostics[name], fallback), 0, 1);
  const resolves = diagnostics.resolves ? 1 : 0;
  const separation = 1 - unit("collisionRatio", 0);
  const dimension = String(diagnosis?.weakestDimension ?? "");
  if (dimension === "density") return round(unit("densityFit") * 100);
  if (dimension === "groove" || dimension === "drumVariety") {
    return round(average([unit("bassLock"), unit("densityFit"), unit("coverage")], 0.5) * 100);
  }
  if (dimension === "separation") return round(separation * 100);
  if (["harmonic", "voiceLeading", "cadence", "harmonicJourney", "phraseResolution"].includes(dimension)) {
    return round(average([unit("melodyFit"), resolves, separation], 0.5) * 100);
  }
  if (["motif", "repetition", "memory", "registerHealth"].includes(dimension)) {
    return round(average([unit("melodyFit"), resolves, separation, unit("coverage")], 0.5) * 100);
  }
  if (dimension === "performance") {
    return round(average([unit("coverage"), unit("densityFit"), resolves], 0.5) * 100);
  }
  return clamp(finite(window?.score, 70), 0, 100);
}

/**
 * Pick the smallest deterministic phrase span that exposes the diagnosed weakness.
 * Critic 7.0 supplies 2-4 bar windows; groove/motif/performance problems may join
 * one contiguous phrase, keeping Producer Brain surgery strictly inside 2-8 bars.
 */
export function diagnoseSurgicalRepairWindow(song, diagnosis = {}) {
  if (!song?.meta || !Array.isArray(song?.tracks) || !Array.isArray(song?.structure) || !song.structure.length) {
    return null;
  }
  const config = normalizeConfig(configFromSong(song));
  const windows = evaluatePhraseWindows(
    song.tracks,
    song.structure,
    song.harmony ?? [],
    config,
    song.grooveConductor,
  );
  if (!windows.length) return null;
  const scored = windows.map((window) => ({
    ...window,
    focusScore: surgicalWindowDimensionScore(window, diagnosis),
  }));
  scored.sort((left, right) => (
    left.focusScore - right.focusScore
    || left.score - right.score
    || left.startBeat - right.startBeat
  ));
  const primary = scored[0];
  const members = [primary];
  const expand = ["groove", "motif", "performance"].includes(diagnosis?.group)
    || ["density", "drumVariety", "repetition", "memory"].includes(diagnosis?.weakestDimension);
  if (expand) {
    const neighbors = scored
      .filter((window) => (
        window.id !== primary.id
        && window.sectionId === primary.sectionId
        && (Math.abs(window.endBar - primary.startBar) < 1e-6 || Math.abs(window.startBar - primary.endBar) < 1e-6)
        && Math.max(window.endBar, primary.endBar) - Math.min(window.startBar, primary.startBar) <= 8
      ))
      .sort((left, right) => (
        left.focusScore - right.focusScore
        || left.score - right.score
        || left.startBeat - right.startBeat
      ));
    if (neighbors[0]) members.push(neighbors[0]);
  }
  members.sort((left, right) => left.startBeat - right.startBeat);
  const startBar = Math.min(...members.map((window) => window.startBar));
  const endBar = Math.max(...members.map((window) => window.endBar));
  const startBeat = Math.min(...members.map((window) => window.startBeat));
  const endBeat = Math.max(...members.map((window) => window.endBeat));
  return {
    version: 1,
    id: \`${"${primary.sectionId}"}:${"${startBar}"}-${"${endBar}"}\`,
    sectionId: primary.sectionId,
    startBar,
    endBar,
    startBeat: round(startBeat),
    endBeat: round(endBeat),
    bars: endBar - startBar,
    focusDimension: diagnosis?.weakestDimension ?? null,
    focusScore: round(average(members.map((window) => window.focusScore), primary.focusScore)),
    scoreBefore: round(average(members.map((window) => window.score), primary.score)),
    phraseWindowIds: members.map((window) => window.id),
    diagnostics: clone(primary.diagnostics ?? {}),
  };
}

function targetedRepairTrackIds(sourceCandidate, diagnosis) {
  const targetTrack = TRACK_DEFINITIONS[sourceCandidate?.targetTrack] ? sourceCandidate.targetTrack : null;
  if (targetTrack) return [targetTrack];
  if (diagnosis?.group === "harmony") return ["bass", "chords", "melody", "counterpoint", "pad"];
  if (diagnosis?.group === "groove") return ["drums", "bass"];
  if (diagnosis?.group === "motif") return ["melody", "counterpoint"];
  if (diagnosis?.group === "performance") return [...TRACK_IDS];
  return [...TRACK_IDS];
}

function spliceNotesInSurgicalWindow(sourceNotes = [], repairedNotes = [], window = {}) {
  const startBeat = finite(window.startBeat, 0);
  const endBeat = Math.max(startBeat, finite(window.endBeat, startBeat));
  const outside = sourceNotes.filter((note) => note.start < startBeat - 1e-6 || note.start >= endBeat - 1e-6);
  const inside = repairedNotes.filter((note) => note.start >= startBeat - 1e-6 && note.start < endBeat - 1e-6);
  return [...outside.map(clone), ...inside.map(clone)]
    .sort((left, right) => left.start - right.start || left.pitch - right.pitch);
}

function timedEventBeat(event) {
  const value = Number(event?.startBeat ?? event?.start);
  return Number.isFinite(value) ? value : null;
}

function spliceTimedEventsInSurgicalWindow(sourceEvents = [], repairedEvents = [], window = {}) {
  const startBeat = finite(window.startBeat, 0);
  const endBeat = Math.max(startBeat, finite(window.endBeat, startBeat));
  if (![...sourceEvents, ...repairedEvents].some((event) => timedEventBeat(event) != null)) {
    return clone(sourceEvents);
  }
  const outside = sourceEvents.filter((event) => {
    const beat = timedEventBeat(event);
    return beat == null || beat < startBeat - 1e-6 || beat >= endBeat - 1e-6;
  });
  const inside = repairedEvents.filter((event) => {
    const beat = timedEventBeat(event);
    return beat != null && beat >= startBeat - 1e-6 && beat < endBeat - 1e-6;
  });
  return [...outside.map(clone), ...inside.map(clone)]
    .sort((left, right) => finite(timedEventBeat(left), 0) - finite(timedEventBeat(right), 0));
}

function applySurgicalRepairWindow(sourceSong, repairedSong, config, diagnosis, sourceCandidate, window) {
  const trackIds = targetedRepairTrackIds(sourceCandidate, diagnosis);
  const repairedById = new Map((repairedSong.tracks ?? []).map((track) => [track.id, track]));
  const song = clone(sourceSong);
  song.id = repairedSong.id;
  song.seed = repairedSong.seed;
  song.settings = clone(repairedSong.settings ?? sourceSong.settings);
  song.tracks = sourceSong.tracks.map((track) => {
    if (!trackIds.includes(track.id)) return clone(track);
    const repairedTrack = repairedById.get(track.id) ?? track;
    return {
      ...clone(track),
      notes: spliceNotesInSurgicalWindow(track.notes ?? [], repairedTrack.notes ?? [], window),
    };
  });
  if (diagnosis?.group === "harmony") {
    song.harmony = spliceTimedEventsInSurgicalWindow(
      sourceSong.harmony ?? [],
      repairedSong.harmony ?? [],
      window,
    );
  } else {
    song.harmony = clone(sourceSong.harmony ?? []);
  }
  song.meta = { ...sourceSong.meta, ideaFingerprint: null };
  const rescoredWindows = evaluatePhraseWindows(
    song.tracks,
    song.structure,
    song.harmony,
    config,
    song.grooveConductor,
  );
  const affectedWindows = rescoredWindows.filter((candidate) => (
    candidate.startBeat < window.endBeat - 1e-6 && candidate.endBeat > window.startBeat + 1e-6
  ));
  const scoreAfter = round(average(affectedWindows.map((candidate) => candidate.score), window.scoreBefore));
  song.phraseCritic = {
    ...(sourceSong.phraseCritic ?? {}),
    phase: 41,
    version: 1,
    status: "complete",
    analyzedWindows: rescoredWindows.length,
    weakestScore: rescoredWindows.length ? Math.min(...rescoredWindows.map((candidate) => candidate.score)) : 100,
    windows: rescoredWindows,
    repairs: [
      ...clone(sourceSong.phraseCritic?.repairs ?? []),
      {
        windowId: window.id,
        scoreBefore: window.scoreBefore,
        scoreAfter,
        tracks: clone(trackIds),
        actions: ["producer-brain-regeneration"],
      },
    ],
  };
  song.idea = createIdeaAnalysis(
    config,
    song.structure,
    song.harmony,
    song.style,
    song.tracks,
    song.oneShotKit,
    song.songBlueprint,
    song.performanceProfile,
  );
  song.idea.rhythmicFeatures.push(
    \`Producer Brain surgical repair · bars ${"${window.startBar + 1}"}-${"${window.endBar}"}\`,
  );
  song.criticRepair = {
    ...(repairedSong.criticRepair ?? {}),
    mode: "surgical-window",
    surgicalWindow: {
      ...clone(window),
      scoreAfter,
    },
    surgicalTracks: clone(trackIds),
  };
  return song;
}

`;
source = source.replace(insertAnchor, helpers + insertAnchor);

const signatureOld = `function repairCandidateSong(sourceCandidate, diagnosis, seed, attempt) {`;
const signatureNew = `function repairCandidateSong(sourceCandidate, diagnosis, seed, attempt, surgicalWindow = null) {`;
if (!source.includes(signatureOld)) throw new Error("Missing repairCandidateSong signature.");
source = source.replace(signatureOld, signatureNew);

const returnOld = `  repaired.generationInterlock = clone(variant.generationInterlock);\n  repaired.title = sourceSong.title;\n  return finishRepairedSong(repaired, config, diagnosis, sourceCandidate, attempt);\n}`;
const returnNew = `  repaired.generationInterlock = clone(variant.generationInterlock);\n  repaired.title = sourceSong.title;\n  const finished = finishRepairedSong(repaired, config, diagnosis, sourceCandidate, attempt);\n  return surgicalWindow && !arrangementRepair\n    ? applySurgicalRepairWindow(sourceSong, finished, config, diagnosis, sourceCandidate, surgicalWindow)\n    : finished;\n}`;
if (!source.includes(returnOld)) throw new Error("Missing repairCandidateSong return block.");
source = source.replace(returnOld, returnNew);

const summaryOld = `    rejected: 0,\n    groups: [],\n    acceptanceHistory: [],`;
const summaryNew = `    rejected: 0,\n    surgicalAttempts: 0,\n    surgicalWindows: [],\n    groups: [],\n    acceptanceHistory: [],`;
if (!source.includes(summaryOld)) throw new Error("Missing critic repair summary anchor.");
source = source.replace(summaryOld, summaryNew);

const repairCallOld = `    const seed = candidateSeed(baseSeed, \`repair-${"${diagnosis.group}"}\`, attempt);\n    const song = repairCandidateSong(sourceCandidate, diagnosis, seed, attempt);`;
const repairCallNew = `    const seed = candidateSeed(baseSeed, \`repair-${"${diagnosis.group}"}\`, attempt);\n    const surgicalWindow = diagnosis.group === "arrangement"\n      ? null\n      : diagnoseSurgicalRepairWindow(sourceCandidate.song, diagnosis);\n    const song = repairCandidateSong(sourceCandidate, diagnosis, seed, attempt, surgicalWindow);\n    if (song.criticRepair?.surgicalWindow) {\n      summary.surgicalAttempts += 1;\n      summary.surgicalWindows.push(clone(song.criticRepair.surgicalWindow));\n    }`;
if (!source.includes(repairCallOld)) throw new Error("Missing targeted repair call anchor.");
source = source.replace(repairCallOld, repairCallNew);

const historyOld = `      maxCriticalRegression: acceptance.maxCriticalRegression,\n      reasons: clone(acceptance.reasons),`;
const historyNew = `      maxCriticalRegression: acceptance.maxCriticalRegression,\n      repairMode: song.criticRepair?.mode ?? "whole-candidate",\n      surgicalWindow: clone(song.criticRepair?.surgicalWindow ?? null),\n      surgicalTracks: clone(song.criticRepair?.surgicalTracks ?? []),\n      reasons: clone(acceptance.reasons),`;
if (!source.includes(historyOld)) throw new Error("Missing repair acceptance history anchor.");
source = source.replace(historyOld, historyNew);

const scoreOld = `        repairAccepted: candidate.repairAccepted ?? null,\n        repairAcceptanceReasons: clone(song.criticRepair?.acceptance?.reasons ?? []),`;
const scoreNew = `        repairAccepted: candidate.repairAccepted ?? null,\n        repairAcceptanceReasons: clone(song.criticRepair?.acceptance?.reasons ?? []),\n        repairMode: song.criticRepair?.mode ?? null,\n        repairWindowId: song.criticRepair?.surgicalWindow?.id ?? null,\n        repairWindowBars: song.criticRepair?.surgicalWindow?.bars ?? null,`;
if (!source.includes(scoreOld)) throw new Error("Missing candidate score repair diagnostics anchor.");
source = source.replace(scoreOld, scoreNew);

const phaseOld = `      rejected: criticRepair.rejected ?? 0,\n      groups: criticRepair.groups,`;
const phaseNew = `      rejected: criticRepair.rejected ?? 0,\n      surgicalAttempts: criticRepair.surgicalAttempts ?? 0,\n      groups: criticRepair.groups,`;
if (!source.includes(phaseOld)) throw new Error("Missing idea-engine repair phase anchor.");
source = source.replace(phaseOld, phaseNew);

fs.writeFileSync(path, source);
console.log("Applied Producer Brain 2.0 surgical window repair patch.");
