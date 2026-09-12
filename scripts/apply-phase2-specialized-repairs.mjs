import fs from "node:fs";

const path = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  if (!source.includes(oldText)) throw new Error(`Missing ${label} anchor.`);
  source = source.replace(oldText, newText);
}

replaceOnce(
`          collisionRatio: round(collisionRatio),
          densityFit: round(densityFit),`,
`          collisionRatio: round(collisionRatio),
          densityFit: round(densityFit),
          density: round(density),
          densityTarget: round(profile.density),
          densityDelta: round(density - profile.density),`,
"phrase density diagnostics",
);

const trackIdsOld = `function targetedRepairTrackIds(sourceCandidate, diagnosis) {
  const targetTrack = TRACK_DEFINITIONS[sourceCandidate?.targetTrack] ? sourceCandidate.targetTrack : null;
  if (targetTrack) return [targetTrack];
  if (diagnosis?.group === "harmony") return ["bass", "chords", "melody", "counterpoint", "pad"];
  if (diagnosis?.group === "groove") return ["drums", "bass"];
  if (diagnosis?.group === "motif") return ["melody", "counterpoint"];
  if (diagnosis?.group === "performance") return [...TRACK_IDS];
  return [...TRACK_IDS];
}`;

const trackIdsNew = `function targetedRepairTrackIds(sourceCandidate, diagnosis) {
  const targetTrack = TRACK_DEFINITIONS[sourceCandidate?.targetTrack] ? sourceCandidate.targetTrack : null;
  if (targetTrack) return [targetTrack];
  const dimension = String(diagnosis?.weakestDimension ?? "");
  if (dimension === "density") return ["bass"];
  if (dimension === "drumVariety") return ["drums"];
  if (dimension === "groove") return ["drums", "bass"];
  if (["repetition", "memory", "phraseResolution", "registerHealth", "separation", "motif"].includes(dimension)) {
    return ["melody", "counterpoint"];
  }
  if (diagnosis?.group === "harmony") return ["bass", "chords", "melody", "counterpoint", "pad"];
  if (diagnosis?.group === "groove") return ["drums", "bass"];
  if (diagnosis?.group === "motif") return ["melody", "counterpoint"];
  if (diagnosis?.group === "performance") return [...TRACK_IDS];
  return [...TRACK_IDS];
}

function specializedRepairSetting(config, trackId, name) {
  const tracks = trackInputMap(config?.tracks);
  return clamp(
    finite(tracks[trackId]?.[name], TRACK_DEFINITIONS[trackId]?.[name] ?? 0),
    0,
    1,
  );
}

function createSpecializedRepairStrategy(sourceCandidate, diagnosis, window, config) {
  const dimension = String(diagnosis?.weakestDimension ?? "");
  const trackIds = targetedRepairTrackIds(sourceCandidate, diagnosis);
  const trackOverrides = {};
  const configPatch = {};
  const diagnostics = window?.diagnostics ?? {};
  let id = `${diagnosis?.group ?? "general"}-regenerate`;
  const setTrack = (trackId, patch) => {
    trackOverrides[trackId] = { ...(trackOverrides[trackId] ?? {}), ...patch };
  };

  if (dimension === "density") {
    const densityDelta = finite(diagnostics.densityDelta, 0);
    const direction = densityDelta > 0.25 ? -1 : 1;
    id = direction > 0 ? "density-build" : "density-thin";
    setTrack("bass", {
      density: clamp(specializedRepairSetting(config, "bass", "density") + direction * 0.14, 0.18, 0.96),
      variation: clamp(specializedRepairSetting(config, "bass", "variation") + 0.06, 0, 1),
    });
    configPatch.syncopation = clamp(finite(config?.syncopation, 0.5) + (direction > 0 ? 0.04 : -0.03), 0, 1);
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
    id = "drum-vocabulary";
    setTrack("drums", {
      variation: clamp(specializedRepairSetting(config, "drums", "variation") + 0.18, 0, 1),
      density: clamp(specializedRepairSetting(config, "drums", "density") + 0.04, 0, 1),
    });
  } else if (dimension === "repetition") {
    id = "motif-evolution";
    setTrack("melody", {
      variation: clamp(specializedRepairSetting(config, "melody", "variation") + 0.18, 0, 1),
    });
    setTrack("counterpoint", {
      variation: clamp(specializedRepairSetting(config, "counterpoint", "variation") + 0.14, 0, 1),
    });
    configPatch.variation = clamp(finite(config?.variation, 0.5) + 0.12, 0, 1);
    configPatch.evolution = clamp(finite(config?.evolution, 0.5) + 0.1, 0, 1);
  } else if (dimension === "phraseResolution") {
    id = "phrase-resolution";
    setTrack("melody", {
      variation: clamp(specializedRepairSetting(config, "melody", "variation") - 0.05, 0, 1),
    });
    setTrack("counterpoint", {
      variation: clamp(specializedRepairSetting(config, "counterpoint", "variation") - 0.04, 0, 1),
    });
    configPatch.evolution = clamp(finite(config?.evolution, 0.5) + 0.06, 0, 1);
    configPatch.surprise = clamp(finite(config?.surprise, 0.5) - 0.06, 0, 1);
  } else if (dimension === "separation") {
    id = "motif-space";
    setTrack("melody", {
      density: clamp(specializedRepairSetting(config, "melody", "density") - 0.08, 0.12, 1),
    });
    setTrack("counterpoint", {
      density: clamp(specializedRepairSetting(config, "counterpoint", "density") - 0.12, 0.08, 1),
    });
  } else if (["memory", "registerHealth", "motif"].includes(dimension)) {
    id = dimension === "registerHealth" ? "motif-register-refresh" : "motif-refresh";
    setTrack("melody", {
      variation: clamp(specializedRepairSetting(config, "melody", "variation") + 0.1, 0, 1),
    });
    setTrack("counterpoint", {
      variation: clamp(specializedRepairSetting(config, "counterpoint", "variation") + 0.08, 0, 1),
    });
  }

  return {
    version: 1,
    id,
    dimension: dimension || null,
    trackIds,
    trackOverrides,
    configPatch,
  };
}

function specializedRepairConfig(config, strategy) {
  return normalizeConfig({
    ...config,
    ...(strategy?.configPatch ?? {}),
    tracks: mergeTrackInputs(config?.tracks, strategy?.trackOverrides ?? {}),
  });
}

function specializedRepairSummary(strategy) {
  if (!strategy) return null;
  return {
    version: strategy.version ?? 1,
    id: strategy.id ?? null,
    dimension: strategy.dimension ?? null,
    tracks: clone(strategy.trackIds ?? []),
    configPatch: clone(strategy.configPatch ?? {}),
    trackOverrides: clone(strategy.trackOverrides ?? {}),
  };
}`;
replaceOnce(trackIdsOld, trackIdsNew, "targeted repair track ownership");

replaceOnce(
`function finishRepairedSong(song, config, diagnosis, sourceCandidate, attempt) {`,
`function finishRepairedSong(song, config, diagnosis, sourceCandidate, attempt, repairStrategy = null) {`,
"finish repaired song signature",
);

replaceOnce(
`    weakestScoreBefore: diagnosis.weakestScore,
    sourceCandidate: sourceCandidate.index,
  };`,
`    weakestScoreBefore: diagnosis.weakestScore,
    sourceCandidate: sourceCandidate.index,
    repairStrategy: specializedRepairSummary(repairStrategy),
  };`,
"repair strategy metadata",
);

replaceOnce(
`  const config = normalizeConfig({
    ...configFromSong(sourceSong),
    seed,
    oneShotKitId: sourceSong.oneShotKit?.id ?? null,
  });
  const arrangementRepair = diagnosis.group === "arrangement";`,
`  const baseConfig = normalizeConfig({
    ...configFromSong(sourceSong),
    seed,
    oneShotKitId: sourceSong.oneShotKit?.id ?? null,
  });
  const repairStrategy = createSpecializedRepairStrategy(
    sourceCandidate,
    diagnosis,
    surgicalWindow,
    baseConfig,
  );
  const config = specializedRepairConfig(baseConfig, repairStrategy);
  const arrangementRepair = diagnosis.group === "arrangement";`,
"specialized repair config",
);

replaceOnce(
`      [sourceTargetTrack],`,
`      repairStrategy.trackIds,`,
"targeted track replacement",
);
replaceOnce(
`        ["bass", "chords", "melody", "counterpoint", "pad"],`,
`        repairStrategy.trackIds,`,
"harmony repair replacement",
);
replaceOnce(
`        ["drums", "bass"],`,
`        repairStrategy.trackIds,`,
"groove repair replacement",
);
replaceOnce(
`        ["melody", "counterpoint"],`,
`        repairStrategy.trackIds,`,
"motif repair replacement",
);

replaceOnce(
`  const finished = finishRepairedSong(repaired, config, diagnosis, sourceCandidate, attempt);`,
`  const finished = finishRepairedSong(
    repaired,
    config,
    diagnosis,
    sourceCandidate,
    attempt,
    repairStrategy,
  );`,
"finish repaired strategy plumbing",
);

replaceOnce(
`        repairWindowBars: song.criticRepair?.surgicalWindow?.bars ?? null,
      };`,
`        repairWindowBars: song.criticRepair?.surgicalWindow?.bars ?? null,
        repairStrategyId: song.criticRepair?.repairStrategy?.id ?? null,
      };`,
"candidate strategy diagnostics",
);

replaceOnce(
`      wholeFallbackUsed,
      reasons: clone(acceptance.reasons),`,
`      wholeFallbackUsed,
      repairStrategyId: song.criticRepair?.repairStrategy?.id
        ?? surgicalSong?.criticRepair?.repairStrategy?.id
        ?? null,
      reasons: clone(acceptance.reasons),`,
"acceptance history strategy diagnostics",
);

fs.writeFileSync(path, source);
console.log("Applied dimension-specialized Producer Brain repair strategies.");
