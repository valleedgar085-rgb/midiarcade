import fs from "node:fs";
import { execFileSync } from "node:child_process";

const enginePath = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(enginePath, "utf8");

const diagnosticsAnchor = `      maxCriticalRegression: acceptance.maxCriticalRegression,\n      repairMode: song.criticRepair?.mode ?? "whole-candidate",`;
const diagnosticsReplacement = `      maxCriticalRegression: acceptance.maxCriticalRegression,\n      criticalRegressions: clone(acceptance.criticalRegressions ?? {}),\n      balanceDelta: acceptance.balanceDelta,\n      creativeFloorDelta: acceptance.creativeFloorDelta,\n      weakestScoreBefore: acceptance.weakestScoreBefore,\n      weakestScoreAfter: acceptance.weakestScoreAfter,\n      repairMode: song.criticRepair?.mode ?? "whole-candidate",`;
if (!source.includes(diagnosticsAnchor)) throw new Error("cadence diagnostic anchor missing");
source = source.replace(diagnosticsAnchor, diagnosticsReplacement);

const helperStart = source.indexOf("function reinforceRepairPhraseResolution(song, config, window) {");
const helperEnd = source.indexOf("\nfunction reinforceRepairTransitions(song, config) {", helperStart);
if (helperStart < 0 || helperEnd < 0) throw new Error("cadence helper boundary missing");
const saferHelper = `function reinforceRepairPhraseResolution(song, config, window) {\n  const repaired = clone(song);\n  const melodyTrack = repaired.tracks?.find((track) => track.id === "melody");\n  const counterTrack = repaired.tracks?.find((track) => track.id === "counterpoint");\n  if (!melodyTrack) return repaired;\n  const barBeats = beatsPerBar(config);\n  const tonic = finite(repaired.meta?.keyPc, config?.keyPc ?? 0);\n  const sections = (repaired.structure ?? []).filter((section) => (\n    !window\n    || (section.endBeat > window.startBeat + 1e-6 && section.startBeat < window.endBeat - 1e-6)\n  ));\n  let edits = 0;\n  for (const section of sections) {\n    if (window && window.endBeat < section.endBeat - 0.05) continue;\n    const phraseNotes = melodyTrack.notes\n      .filter((note) => note.start < section.endBeat - 0.01 && note.start >= section.endBeat - barBeats * 1.25)\n      .sort((left, right) => left.start - right.start);\n    const landing = phraseNotes.at(-1);\n    if (!landing) continue;\n    const chord = harmonyAt(repaired.harmony ?? [], landing.start);\n    const plan = blueprintPlanForSection(repaired.songBlueprint, section);\n    const finalSection = section.id === repaired.structure?.at(-1)?.id;\n    const preferTonic = finalSection || plan?.cadence === "resolve";\n    const chordTones = chord?.tones?.length ? chord.tones : [tonic];\n    const pitchClasses = [...new Set(preferTonic ? [tonic, ...chordTones] : [...chordTones, tonic])];\n    const currentDuration = Math.max(0.05, finite(landing.duration, 0.25));\n    const counterNotes = counterTrack?.notes ?? [];\n    const collisionCount = (pitch, duration) => counterNotes.filter((note) => {\n      if (note.start >= landing.start + duration - 1e-6 || landing.start >= note.start + note.duration - 1e-6) return false;\n      return [0, 1, 6, 11].includes(mod(Math.abs(pitch - note.pitch), 12));\n    }).length;\n    const candidates = pitchClasses.map((pitchClass, priority) => {\n      const pitch = nearestRepairPitch(landing.pitch, [pitchClass]);\n      return {\n        pitch,\n        pitchClass,\n        priority,\n        collisions: collisionCount(pitch, currentDuration),\n        distance: Math.abs(pitch - landing.pitch),\n      };\n    }).sort((left, right) => (\n      left.collisions - right.collisions\n      || left.priority - right.priority\n      || left.distance - right.distance\n      || left.pitch - right.pitch\n    ));\n    const chosen = candidates[0];\n    if (chosen && chosen.pitch !== landing.pitch) {\n      landing.pitch = chosen.pitch;\n      edits += 1;\n    }\n    const minimumDuration = barBeats * 0.36;\n    const availableDuration = Math.max(0.05, section.endBeat - landing.start);\n    const desiredDuration = Math.max(currentDuration, Math.min(minimumDuration, availableDuration));\n    if (desiredDuration > currentDuration + 1e-6\n      && collisionCount(landing.pitch, desiredDuration) <= collisionCount(landing.pitch, currentDuration)) {\n      landing.duration = round(desiredDuration);\n      edits += 1;\n    }\n    const pitchClass = mod(landing.pitch, 12);\n    landing.resolutionRole = pitchClass === tonic ? "tonic-landing" : "chord-landing";\n    landing.phraseBoundary = round(section.endBeat);\n    landing.preserveTiming = true;\n    landing.producerRepair = "phrase-cadence-precision";\n  }\n  repaired.precisionRepair = {\n    ...(repaired.precisionRepair ?? {}),\n    cadence: { version: 2, edits, windowId: window?.id ?? null },\n  };\n  melodyTrack.notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch);\n  return repaired;\n}\n`;
source = source.slice(0, helperStart) + saferHelper + source.slice(helperEnd);

const repairAnchor = `  const config = specializedRepairConfig(baseConfig, repairStrategy);\n  const arrangementRepair = diagnosis.group === "arrangement";`;
const repairReplacement = `  const config = specializedRepairConfig(baseConfig, repairStrategy);\n  if (repairStrategy.dimension === "phraseResolution" && strategyWindow) {\n    const directCadence = reinforceRepairPhraseResolution(sourceSong, config, strategyWindow);\n    directCadence.id = "song-" + hashSeed(String(sourceSong.id ?? sourceSong.seed) + "|" + seed + "|phrase-cadence-precision").toString(36);\n    directCadence.seed = seed;\n    directCadence.settings = clone(sourceSong.settings ?? publicSettings(config));\n    directCadence.title = sourceSong.title;\n    directCadence.criticRepair = {\n      phase: 20,\n      version: 1,\n      status: "awaiting-critic",\n      attempt: attempt + 1,\n      group: diagnosis.group,\n      weakestDimension: diagnosis.weakestDimension,\n      weakestScoreBefore: diagnosis.weakestScore,\n      sourceCandidate: sourceCandidate.index,\n      repairStrategy: specializedRepairSummary(repairStrategy),\n    };\n    const finishedCadence = finishRepairedSong(\n      directCadence,\n      config,\n      diagnosis,\n      sourceCandidate,\n      attempt,\n      repairStrategy,\n    );\n    return applySurgicalRepairWindow(\n      sourceSong,\n      finishedCadence,\n      config,\n      diagnosis,\n      sourceCandidate,\n      strategyWindow,\n      repairStrategy,\n    );\n  }\n  const arrangementRepair = diagnosis.group === "arrangement";`;
if (!source.includes(repairAnchor)) throw new Error("cadence precision repair anchor missing");
source = source.replace(repairAnchor, repairReplacement);
fs.writeFileSync(enginePath, source);

execFileSync(process.execPath, [
  "--test",
  "tests/producer-brain-specialized-repair.test.mjs",
  "tests/producer-brain-repair-acceptance.test.mjs",
  "tests/producer-brain-surgical-repair.test.mjs",
  "tests/music-engine.test.mjs",
], { stdio: "inherit" });

const { generateNew } = await import(`../src/music-engine.js?cadence=${Date.now()}`);
const genres = ["techno", "drumBass", "jazz", "hipHop", "trap", "popRadio", "house", "afrobeats"];
const profiles = [
  { id: "sparse", energy: 0.12, complexity: 0.18 },
  { id: "balanced", energy: 0.55, complexity: 0.55 },
  { id: "dense", energy: 0.88, complexity: 0.82 },
];
const seeds = ["repair-cal-01", "repair-cal-02", "repair-cal-03", "repair-cal-04"];
const phrase = [];
for (const genre of genres) {
  for (const profile of profiles) {
    for (const seed of seeds) {
      const song = generateNew({
        genre,
        seed: `${seed}:${genre}:${profile.id}`,
        bars: 8,
        energy: profile.energy,
        complexity: profile.complexity,
      });
      for (const entry of song.meta?.scoreDetails?.criticRepair?.acceptanceHistory ?? []) {
        if (entry.repairStrategyId !== "phrase-cadence") continue;
        phrase.push({ genre, seed, profile: profile.id, ...entry });
      }
    }
  }
}
const accepted = phrase.filter((entry) => entry.accepted);
console.log(`Phrase cadence attempts: ${phrase.length}`);
console.log(`Phrase cadence accepted: ${accepted.length}/${phrase.length} (${Math.round(accepted.length / Math.max(1, phrase.length) * 100)}%)`);
console.log(`Accepted average weakness gain: ${accepted.length ? (accepted.reduce((sum, entry) => sum + Number(entry.weaknessGain ?? 0), 0) / accepted.length).toFixed(2) : "0.00"}`);
const criticalCounts = {};
for (const row of phrase.filter((entry) => !entry.accepted)) {
  for (const [name, value] of Object.entries(row.criticalRegressions ?? {})) {
    if (Number(value) <= 0) continue;
    criticalCounts[name] ??= { count: 0, total: 0, max: 0 };
    criticalCounts[name].count += 1;
    criticalCounts[name].total += Number(value);
    criticalCounts[name].max = Math.max(criticalCounts[name].max, Number(value));
  }
}
console.log("Critical regression summary:", JSON.stringify(criticalCounts));
for (const row of phrase) console.log(JSON.stringify(row));
