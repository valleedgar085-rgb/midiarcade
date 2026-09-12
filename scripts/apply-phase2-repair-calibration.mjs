import fs from "node:fs";

const path = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing ${label} anchor.`);
  source = source.replace(from, to);
}

function replaceBetween(start, end, replacement, label) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error(`Missing ${label} start anchor.`);
  const endIndex = source.indexOf(end, startIndex);
  if (endIndex < 0) throw new Error(`Missing ${label} end anchor.`);
  source = source.slice(0, startIndex) + replacement + source.slice(endIndex);
}

replaceBetween(
  "function targetedRepairTrackIds(sourceCandidate, diagnosis) {",
  "\nfunction specializedRepairSetting",
  `function targetedRepairTrackIds(sourceCandidate, diagnosis) {
  const targetTrack = TRACK_DEFINITIONS[sourceCandidate?.targetTrack] ? sourceCandidate.targetTrack : null;
  if (targetTrack) return [targetTrack];
  const dimension = String(diagnosis?.weakestDimension ?? "");
  if (dimension === "density") return ["bass", "chords", "counterpoint", "pad"];
  if (dimension === "drumVariety") return ["drums"];
  if (dimension === "groove") return ["drums", "bass"];
  if (["repetition", "phraseResolution", "registerHealth"].includes(dimension)) return ["melody"];
  if (dimension === "memory") return ["melody", "bass", "counterpoint"];
  if (["separation", "motif"].includes(dimension)) return ["melody", "counterpoint"];
  if (diagnosis?.group === "harmony") return ["bass", "chords", "melody", "counterpoint", "pad"];
  if (diagnosis?.group === "groove") return ["drums", "bass"];
  if (diagnosis?.group === "motif") return ["melody", "counterpoint"];
  if (diagnosis?.group === "performance") return [...TRACK_IDS];
  return [...TRACK_IDS];
}
`,
  "targeted repair tracks",
);

const strategyReplacement = `function repairDrumVarietyMetrics(song) {
  const drumNotes = song?.tracks?.find((track) => track.id === "drums")?.notes ?? [];
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const bars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  const signatures = Array.from({ length: bars }, (_, bar) => drumNotes
    .filter((note) => Math.floor(note.start / barBeats) === bar)
    .map((note) => \`\${note.pitch}:\${round(mod(note.start, barBeats))}\`)
    .join("|"));
  const populated = signatures.filter(Boolean);
  if (populated.length < 2) return { score: 58, uniqueRatio: 0, adjacentCopies: 0 };
  const uniqueRatio = new Set(populated).size / populated.length;
  const adjacentCopies = populated.slice(1)
    .filter((signature, index) => signature === populated[index]).length / Math.max(1, populated.length - 1);
  const usefulVariation = 1 - Math.abs(uniqueRatio - 0.58) / 0.58;
  return {
    score: clamp(Math.round(48 + clamp(usefulVariation, 0, 1) * 34 + (1 - adjacentCopies) * 18), 25, 100),
    uniqueRatio: round(uniqueRatio),
    adjacentCopies: round(adjacentCopies),
  };
}

function repairDensityDelta(song) {
  const bars = Math.max(1, finite(song?.meta?.bars, song?.bars ?? 1));
  const noteCount = (song?.tracks ?? [])
    .filter((track) => track.id !== "drums")
    .reduce((sum, track) => sum + (track.notes ?? []).length, 0);
  const profile = GENRE_CRITIC_PROFILES[song?.genre] ?? GENRE_CRITIC_PROFILES.pop;
  return noteCount / bars - profile.density;
}

function repairRepetitionMetrics(song) {
  const melody = [...(song?.tracks?.find((track) => track.id === "melody")?.notes ?? [])]
    .sort((left, right) => left.start - right.start);
  const profile = GENRE_CRITIC_PROFILES[song?.genre] ?? GENRE_CRITIC_PROFILES.pop;
  const actual = phraseRepetition(song, melody);
  const target = average([
    finite(song?.songBlueprint?.qualityTargets?.repetition, profile.repetition),
    profile.repetition,
  ], profile.repetition);
  return { actual: round(actual), target: round(target), delta: round(actual - target) };
}

function createSpecializedRepairStrategy(sourceCandidate, diagnosis, window, config) {
  const dimension = String(diagnosis?.weakestDimension ?? "");
  let trackIds = targetedRepairTrackIds(sourceCandidate, diagnosis);
  const trackOverrides = {};
  const configPatch = {};
  const diagnostics = window?.diagnostics ?? {};
  const sourceSong = sourceCandidate?.song;
  let id = String(diagnosis?.group ?? "general") + "-regenerate";
  const setTrack = (trackId, patch) => {
    trackOverrides[trackId] = { ...(trackOverrides[trackId] ?? {}), ...patch };
  };

  if (dimension === "density") {
    const localDelta = finite(diagnostics.densityDelta, repairDensityDelta(sourceSong));
    const globalDelta = repairDensityDelta(sourceSong);
    const densityDelta = average([localDelta, globalDelta], globalDelta);
    const direction = densityDelta > 0 ? -1 : 1;
    id = direction > 0 ? "density-build" : "density-thin";
    trackIds = direction > 0
      ? ["bass", "chords", "counterpoint"]
      : ["bass", "counterpoint", "pad"];
    const amount = direction > 0 ? 0.18 : -0.18;
    for (const trackId of trackIds) {
      setTrack(trackId, {
        density: clamp(specializedRepairSetting(config, trackId, "density") + amount, 0.08, 0.96),
        variation: clamp(specializedRepairSetting(config, trackId, "variation") + 0.04, 0, 1),
      });
    }
    configPatch.syncopation = clamp(finite(config?.syncopation, 0.5) + (direction > 0 ? 0.03 : -0.02), 0, 1);
  } else if (dimension === "groove") {
    const bassLock = clamp(finite(diagnostics.bassLock, 0.5), 0, 1);
    const tighten = bassLock < 0.72;
    id = tighten ? "groove-lock" : "groove-develop";
    setTrack("drums", {
      variation: clamp(specializedRepairSetting(config, "drums", "variation") + 0.08, 0, 1),
      humanize: clamp(specializedRepairSetting(config, "drums", "humanize") + (tighten ? -0.05 : 0.02), 0, 1),
    });
    setTrack("bass", {
      variation: clamp(specializedRepairSetting(config, "bass", "variation") + (tighten ? -0.06 : 0.08), 0, 1),
      humanize: clamp(specializedRepairSetting(config, "bass", "humanize") + (tighten ? -0.1 : 0.02), 0, 1),
      feel: clamp(specializedRepairSetting(config, "bass", "feel") + 0.08, 0, 1),
    });
  } else if (dimension === "drumVariety") {
    const variety = repairDrumVarietyMetrics(sourceSong);
    const stabilize = variety.uniqueRatio > 0.64 && variety.adjacentCopies < 0.22;
    id = stabilize ? "drum-stabilize" : "drum-develop";
    setTrack("drums", {
      variation: clamp(specializedRepairSetting(config, "drums", "variation") + (stabilize ? -0.2 : 0.14), 0, 1),
      density: clamp(specializedRepairSetting(config, "drums", "density") + (stabilize ? -0.03 : 0.03), 0, 1),
    });
    configPatch.variation = clamp(finite(config?.variation, 0.5) + (stabilize ? -0.12 : 0.08), 0, 1);
  } else if (dimension === "repetition") {
    const repetition = repairRepetitionMetrics(sourceSong);
    const reinforce = repetition.actual < repetition.target;
    id = reinforce ? "motif-reinforce" : "motif-evolution";
    trackIds = ["melody"];
    setTrack("melody", {
      variation: clamp(specializedRepairSetting(config, "melody", "variation") + (reinforce ? -0.16 : 0.16), 0, 1),
    });
    configPatch.variation = clamp(finite(config?.variation, 0.5) + (reinforce ? -0.1 : 0.1), 0, 1);
    configPatch.evolution = clamp(finite(config?.evolution, 0.5) + (reinforce ? -0.06 : 0.1), 0, 1);
    configPatch.surprise = clamp(finite(config?.surprise, 0.5) + (reinforce ? -0.08 : 0.04), 0, 1);
  } else if (dimension === "memory") {
    id = "memory-recall";
    trackIds = ["melody", "bass", "counterpoint"];
    configPatch.variation = clamp(finite(config?.variation, 0.5) - 0.04, 0, 1);
  } else if (dimension === "phraseResolution") {
    id = "phrase-cadence";
    trackIds = ["melody"];
    setTrack("melody", {
      variation: clamp(specializedRepairSetting(config, "melody", "variation") - 0.1, 0, 1),
    });
    configPatch.evolution = clamp(finite(config?.evolution, 0.5) + 0.04, 0, 1);
    configPatch.surprise = clamp(finite(config?.surprise, 0.5) - 0.1, 0, 1);
  } else if (dimension === "separation") {
    id = "motif-space";
    setTrack("melody", {
      density: clamp(specializedRepairSetting(config, "melody", "density") - 0.08, 0.12, 1),
    });
    setTrack("counterpoint", {
      density: clamp(specializedRepairSetting(config, "counterpoint", "density") - 0.12, 0.08, 1),
    });
  } else if (dimension === "registerHealth") {
    id = "motif-register-refresh";
    trackIds = ["melody"];
    setTrack("melody", {
      variation: clamp(specializedRepairSetting(config, "melody", "variation") + 0.08, 0, 1),
    });
  } else if (dimension === "motif") {
    id = "motif-refresh";
    setTrack("melody", {
      variation: clamp(specializedRepairSetting(config, "melody", "variation") + 0.1, 0, 1),
    });
    setTrack("counterpoint", {
      variation: clamp(specializedRepairSetting(config, "counterpoint", "variation") + 0.08, 0, 1),
    });
  }

  return {
    version: 2,
    id,
    dimension: dimension || null,
    trackIds,
    trackOverrides,
    configPatch,
  };
}
`;

replaceBetween(
  "function createSpecializedRepairStrategy(sourceCandidate, diagnosis, window, config) {",
  "\nfunction specializedRepairConfig",
  strategyReplacement,
  "specialized repair strategy",
);

const helperInsertion = `
function repairWindowDrumVarietyScore(song, window) {
  const drums = song?.tracks?.find((track) => track.id === "drums")?.notes ?? [];
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const signatures = [];
  for (let bar = window.startBar; bar < window.endBar; bar += 1) {
    signatures.push(drums
      .filter((note) => Math.floor(note.start / barBeats) === bar)
      .map((note) => \`\${note.pitch}:\${round(mod(note.start, barBeats))}\`)
      .join("|"));
  }
  const populated = signatures.filter(Boolean);
  if (populated.length < 2) return 58;
  const uniqueRatio = new Set(populated).size / populated.length;
  const adjacentCopies = populated.slice(1)
    .filter((signature, index) => signature === populated[index]).length / Math.max(1, populated.length - 1);
  const usefulVariation = 1 - Math.abs(uniqueRatio - 0.58) / 0.58;
  return clamp(Math.round(48 + clamp(usefulVariation, 0, 1) * 34 + (1 - adjacentCopies) * 18), 25, 100);
}

function repairWindowMemoryScore(song, window) {
  const memory = song?.songBlueprint?.memoryMap?.find((entry) => (
    entry.sectionId === window.sectionId
    && !["introduction", "statement"].includes(entry.relationship)
  ));
  if (!memory) return 100;
  const recalled = ["melody", "bass", "counterpoint"].map((trackId) => (
    song?.tracks?.find((track) => track.id === trackId)?.notes?.some((note) => (
      note.memoryRole === memory.relationship
      && note.memoryOriginSectionId === memory.originSectionId
      && note.start >= window.startBeat - 1e-6
      && note.start < window.endBeat - 1e-6
    ))
  ));
  if (memory.relationship === "contrast") return recalled[0] ? 100 : 50;
  return round(recalled.filter(Boolean).length / recalled.length * 100);
}

function repairWindowPhraseResolutionScore(song, window) {
  const section = song?.structure?.find((candidate) => candidate.id === window.sectionId);
  if (!section || window.endBeat < section.endBeat - 0.05) return 100;
  const melody = [...(song?.tracks?.find((track) => track.id === "melody")?.notes ?? [])]
    .filter((note) => note.start < section.endBeat - 0.01 && note.start >= section.endBeat - finite(song?.meta?.beatsPerBar, 4) * 1.25)
    .sort((left, right) => left.start - right.start);
  const landing = melody.at(-1);
  if (!landing) return 55;
  const chord = harmonyAt(song?.harmony ?? [], landing.start);
  const pitchClass = mod(landing.pitch, 12);
  const chordTone = chord?.tones?.includes(pitchClass);
  const tonicLanding = pitchClass === finite(song?.meta?.keyPc, 0);
  const held = landing.duration >= finite(song?.meta?.beatsPerBar, 4) * 0.35;
  return round(clamp(0.38 + Number(chordTone) * 0.32 + Number(tonicLanding) * 0.18 + Number(held) * 0.12, 0, 1) * 100);
}

function repairWindowRepetitionScore(song, window) {
  const section = song?.structure?.find((candidate) => candidate.id === window.sectionId);
  if (!section) return 70;
  const melody = [...(song?.tracks?.find((track) => track.id === "melody")?.notes ?? [])]
    .filter((note) => note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6)
    .sort((left, right) => left.start - right.start);
  const profile = GENRE_CRITIC_PROFILES[song?.genre] ?? GENRE_CRITIC_PROFILES.pop;
  const ratio = phraseRepetition({ ...song, structure: [section] }, melody);
  const target = average([
    finite(song?.songBlueprint?.qualityTargets?.repetition, profile.repetition),
    profile.repetition,
  ], profile.repetition);
  return clamp(Math.round(100 - Math.abs(ratio - target) * 125), 30, 100);
}

function nearestRepairPitch(pitch, pitchClasses, minimum = 36, maximum = 108) {
  const goals = new Set((pitchClasses ?? []).map((value) => mod(value, 12)));
  if (!goals.size) return pitch;
  const candidates = [];
  for (let candidate = minimum; candidate <= maximum; candidate += 1) {
    if (goals.has(mod(candidate, 12))) candidates.push(candidate);
  }
  return candidates.sort((left, right) => Math.abs(left - pitch) - Math.abs(right - pitch) || left - right)[0] ?? pitch;
}

function reinforceRepairMemory(song, config) {
  const rawTracks = Object.fromEntries((song?.tracks ?? []).map((track) => [
    track.id,
    (track.notes ?? []).map((note) => ({ ...note })),
  ]));
  const remembered = applyMusicalMemory(
    rawTracks,
    song.structure ?? [],
    song.harmony ?? [],
    song.songBlueprint,
    song.motifs?.melody?.lengthBeats,
    finite(config?.bars, song?.meta?.bars ?? song?.bars ?? 1) * beatsPerBar(config),
  );
  const repaired = clone(song);
  repaired.tracks = repaired.tracks.map((track) => ({
    ...track,
    notes: (remembered?.[track.id] ?? track.notes ?? []).map((note) => ({ ...note })),
  }));
  return repaired;
}

function reinforceRepairPhraseResolution(song, config, window) {
  const repaired = clone(song);
  const melodyTrack = repaired.tracks?.find((track) => track.id === "melody");
  if (!melodyTrack) return repaired;
  const barBeats = beatsPerBar(config);
  const sections = (repaired.structure ?? []).filter((section) => (
    !window
    || (section.endBeat > window.startBeat + 1e-6 && section.startBeat < window.endBeat - 1e-6)
  ));
  for (const section of sections) {
    if (window && window.endBeat < section.endBeat - 0.05) continue;
    const phraseNotes = melodyTrack.notes
      .filter((note) => note.start < section.endBeat - 0.01 && note.start >= section.endBeat - barBeats * 1.25)
      .sort((left, right) => left.start - right.start);
    const landing = phraseNotes.at(-1);
    if (!landing) continue;
    const chord = harmonyAt(repaired.harmony ?? [], landing.start);
    const plan = blueprintPlanForSection(repaired.songBlueprint, section);
    const finalSection = section.id === repaired.structure?.at(-1)?.id;
    const forceTonic = finalSection || plan?.cadence === "resolve";
    const pitchClasses = forceTonic
      ? [finite(repaired.meta?.keyPc, config?.keyPc ?? 0)]
      : chord?.tones?.length ? chord.tones : [finite(repaired.meta?.keyPc, config?.keyPc ?? 0)];
    landing.pitch = nearestRepairPitch(landing.pitch, pitchClasses);
    const minimumDuration = barBeats * 0.38;
    if (landing.start + minimumDuration > section.endBeat) {
      landing.start = round(Math.max(section.startBeat, section.endBeat - minimumDuration));
    }
    landing.duration = round(Math.max(minimumDuration, Math.min(
      landing.duration,
      Math.max(minimumDuration, section.endBeat - landing.start),
    )));
    landing.resolutionRole = forceTonic ? "tonic-landing" : "chord-landing";
    landing.phraseBoundary = round(section.endBeat);
    landing.preserveTiming = true;
  }
  melodyTrack.notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  return repaired;
}

function applySpecializedRepairMaterial(song, strategy, config, window) {
  if (!song || !strategy) return song;
  if (strategy.dimension === "memory" && strategy.trackIds.some((id) => ["melody", "bass", "counterpoint"].includes(id))) {
    return reinforceRepairMemory(song, config);
  }
  if (strategy.dimension === "phraseResolution" && strategy.trackIds.includes("melody")) {
    return reinforceRepairPhraseResolution(song, config, window);
  }
  return song;
}
`;

replaceOnce(
  "\nfunction spliceNotesInSurgicalWindow",
  helperInsertion + "\nfunction spliceNotesInSurgicalWindow",
  "specialized repair helper insertion",
);

const surgicalScoreReplacement = `function surgicalWindowDimensionScore(window, diagnosis = {}, song = null) {
  const diagnostics = window?.diagnostics ?? {};
  const unit = (name, fallback = 0.5) => clamp(finite(diagnostics[name], fallback), 0, 1);
  const resolves = diagnostics.resolves ? 1 : 0;
  const separation = 1 - unit("collisionRatio", 0);
  const dimension = String(diagnosis?.weakestDimension ?? "");
  if (dimension === "density") return round(unit("densityFit") * 100);
  if (dimension === "drumVariety") return repairWindowDrumVarietyScore(song, window);
  if (dimension === "groove") {
    return round(average([unit("bassLock"), unit("densityFit"), unit("coverage")], 0.5) * 100);
  }
  if (dimension === "memory") return repairWindowMemoryScore(song, window);
  if (dimension === "repetition") return repairWindowRepetitionScore(song, window);
  if (dimension === "phraseResolution") return repairWindowPhraseResolutionScore(song, window);
  if (dimension === "registerHealth") {
    const melody = (song?.tracks?.find((track) => track.id === "melody")?.notes ?? [])
      .filter((note) => note.start >= window.startBeat - 1e-6 && note.start < window.endBeat - 1e-6);
    return registerFatigueScoreForSong(melody);
  }
  if (dimension === "separation") return round(separation * 100);
  if (["harmonic", "voiceLeading", "cadence", "harmonicJourney"].includes(dimension)) {
    return round(average([unit("melodyFit"), resolves, separation], 0.5) * 100);
  }
  if (dimension === "motif") {
    return round(average([unit("melodyFit"), resolves, separation, unit("coverage")], 0.5) * 100);
  }
  if (dimension === "performance") {
    return round(average([unit("coverage"), unit("densityFit"), resolves], 0.5) * 100);
  }
  return clamp(finite(window?.score, 70), 0, 100);
}
`;
replaceBetween(
  "function surgicalWindowDimensionScore(window, diagnosis = {}) {",
  "\n/**\n * Pick the smallest deterministic phrase span",
  surgicalScoreReplacement,
  "surgical dimension scoring",
);
replaceOnce(
  "    focusScore: surgicalWindowDimensionScore(window, diagnosis),",
  "    focusScore: surgicalWindowDimensionScore(window, diagnosis, song),",
  "surgical focus score call",
);

replaceOnce(
  "function applySurgicalRepairWindow(sourceSong, repairedSong, config, diagnosis, sourceCandidate, window) {\n  const trackIds = targetedRepairTrackIds(sourceCandidate, diagnosis);",
  "function applySurgicalRepairWindow(sourceSong, repairedSong, config, diagnosis, sourceCandidate, window, repairStrategy = null) {\n  const trackIds = repairStrategy?.trackIds ?? repairStrategy?.tracks ?? targetedRepairTrackIds(sourceCandidate, diagnosis);",
  "surgical repair strategy tracks",
);

replaceOnce(
  "  const variant = compose(config, options);\n  let repaired;",
  "  let variant = compose(config, options);\n  variant = applySpecializedRepairMaterial(variant, repairStrategy, config, strategyWindow);\n  let repaired;",
  "specialized material application",
);

replaceOnce(
  "    ? applySurgicalRepairWindow(sourceSong, finished, config, diagnosis, sourceCandidate, surgicalWindow)\n    : finished;",
  "    ? applySurgicalRepairWindow(sourceSong, finished, config, diagnosis, sourceCandidate, surgicalWindow, repairStrategy)\n    : finished;",
  "repairCandidateSong surgical strategy",
);

replaceOnce(
  `      ? applySurgicalRepairWindow(\n        sourceCandidate.song,\n        wholeRepairSong,\n        repairConfig,\n        diagnosis,\n        sourceCandidate,\n        surgicalWindow,\n      )`,
  `      ? applySurgicalRepairWindow(\n        sourceCandidate.song,\n        wholeRepairSong,\n        repairConfig,\n        diagnosis,\n        sourceCandidate,\n        surgicalWindow,\n        wholeRepairSong.criticRepair?.repairStrategy,\n      )`,
  "targeted critic surgical strategy",
);

fs.writeFileSync(path, source);
console.log("Applied Phase 2 critic-aligned repair calibration.");
