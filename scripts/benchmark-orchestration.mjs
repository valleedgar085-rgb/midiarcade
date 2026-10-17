import { performance } from "node:perf_hooks";
import { normalizeConfig, TRACK_DEFINITIONS } from "../src/music-engine.js";

const ORCHESTRATION_SHAPES = {
  intro: { drums: 0.52, bass: 0.38, chords: 0.68, melody: 0.48, counterpoint: 0.24, pad: 0.88 },
  verse: { drums: 0.82, bass: 0.78, chords: 0.62, melody: 0.88, counterpoint: 0.34, pad: 0.5 },
  prechorus: { drums: 0.9, bass: 0.84, chords: 0.8, melody: 0.9, counterpoint: 0.42, pad: 0.72 },
  chorus: { drums: 1, bass: 0.96, chords: 0.9, melody: 1, counterpoint: 0.56, pad: 0.82 },
  bridge: { drums: 0.62, bass: 0.58, chords: 0.78, melody: 0.7, counterpoint: 0.72, pad: 0.9 },
};

const TRACK_IDS = Object.keys(TRACK_DEFINITIONS);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function finite(v, fb) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function round(v, p = 6) { const pow = 10 ** p; return Math.round((v + Number.EPSILON) * pow) / pow; }

function featuredTrackForSection(section, plan, config, occurrence = 0) {
  return "melody";
}

function createOrchestrationMatrixOld(config, structure, sectionPlans, source = null) {
  const occurrences = new Map();
  return structure.map((section, index) => {
    const plan = sectionPlans[index];
    const occurrence = occurrences.get(section.name) ?? 0;
    occurrences.set(section.name, occurrence + 1);
    const inherited = source?.orchestrationMatrix?.find((entry) => entry.sectionId === section.id)
      ?? source?.orchestrationMatrix?.find((entry) => entry.sectionName === section.name);
    const creativeReturn = occurrence > 0
      && Boolean(config.creativeSpotlightRotation)
      && ["verse", "chorus", "theme", "idea"].includes(section.name);
    if (inherited?.lanes && !creativeReturn) return clone(inherited);
    const shape = ORCHESTRATION_SHAPES[section.name] ?? ORCHESTRATION_SHAPES.verse;
    const featuredTrack = featuredTrackForSection(section, plan, config, occurrence);
    const lanes = Object.fromEntries(TRACK_IDS.map((id) => {
      const base = finite(shape[id], 0.7);
      const energyFactor = 0.82 + plan.energy * 0.24;
      const featured = id === featuredTrack;
      const presence = round(clamp(base * energyFactor + (featured ? 0.08 : 0), 0.18, 1));
      const registerShift = ["melody", "counterpoint", "chords", "pad"].includes(id)
        ? (featured ? plan.registerLift : 0)
        : 0;
      return [id, {
        presence,
        velocity: round(clamp(0.82 + plan.energy * 0.18 + (featured ? 0.06 : 0), 0.72, 1.08)),
        registerShift,
        role: featured ? "feature" : ["drums", "bass"].includes(id) ? "foundation" : presence < 0.46 ? "space" : "support",
      }];
    }));
    return {
      sectionId: section.id,
      sectionName: section.name,
      featuredTrack,
      featureOccurrence: occurrence,
      lanes,
    };
  });
}

function createOrchestrationMatrixNew(config, structure, sectionPlans, source = null) {
  const occurrences = new Map();
  const inheritedBySectionId = new Map();
  const inheritedBySectionName = new Map();
  if (Array.isArray(source?.orchestrationMatrix)) {
    for (const entry of source.orchestrationMatrix) {
      if (entry?.sectionId != null && !inheritedBySectionId.has(entry.sectionId)) {
        inheritedBySectionId.set(entry.sectionId, entry);
      }
      if (entry?.sectionName != null && !inheritedBySectionName.has(entry.sectionName)) {
        inheritedBySectionName.set(entry.sectionName, entry);
      }
    }
  }

  return structure.map((section, index) => {
    const plan = sectionPlans[index];
    const occurrence = occurrences.get(section.name) ?? 0;
    occurrences.set(section.name, occurrence + 1);
    const inherited = inheritedBySectionId.get(section.id)
      ?? inheritedBySectionName.get(section.name);
    const creativeReturn = occurrence > 0
      && Boolean(config.creativeSpotlightRotation)
      && ["verse", "chorus", "theme", "idea"].includes(section.name);
    if (inherited?.lanes && !creativeReturn) return clone(inherited);
    const shape = ORCHESTRATION_SHAPES[section.name] ?? ORCHESTRATION_SHAPES.verse;
    const featuredTrack = featuredTrackForSection(section, plan, config, occurrence);
    const lanes = Object.fromEntries(TRACK_IDS.map((id) => {
      const base = finite(shape[id], 0.7);
      const energyFactor = 0.82 + plan.energy * 0.24;
      const featured = id === featuredTrack;
      const presence = round(clamp(base * energyFactor + (featured ? 0.08 : 0), 0.18, 1));
      const registerShift = ["melody", "counterpoint", "chords", "pad"].includes(id)
        ? (featured ? plan.registerLift : 0)
        : 0;
      return [id, {
        presence,
        velocity: round(clamp(0.82 + plan.energy * 0.18 + (featured ? 0.06 : 0), 0.72, 1.08)),
        registerShift,
        role: featured ? "feature" : ["drums", "bass"].includes(id) ? "foundation" : presence < 0.46 ? "space" : "support",
      }];
    }));
    return {
      sectionId: section.id,
      sectionName: section.name,
      featuredTrack,
      featureOccurrence: occurrence,
      lanes,
    };
  });
}

const N = 500;
const sections = [];
const sectionPlans = [];
const sourceMatrix = [];

for (let i = 0; i < N; i++) {
  const sectionName = ["verse", "chorus", "bridge", "intro", "outro"][i % 5];
  const sectionId = `section-${i}`;
  sections.push({ id: sectionId, name: sectionName });
  sectionPlans.push({ energy: 0.8, registerLift: 0 });
  // Add entries in sourceMatrix in reversed or mismatched order to simulate lookup overhead
  sourceMatrix.push({ sectionId: `section-${N - 1 - i}`, sectionName: sectionName, lanes: {} });
}

const config = { creativeSpotlightRotation: "bass-to-lead" };
const source = { orchestrationMatrix: sourceMatrix };

// Warmup
for (let i = 0; i < 50; i++) {
  createOrchestrationMatrixOld(config, sections, sectionPlans, source);
  createOrchestrationMatrixNew(config, sections, sectionPlans, source);
}

const RUNS = 100;

let t0 = performance.now();
for (let i = 0; i < RUNS; i++) {
  createOrchestrationMatrixOld(config, sections, sectionPlans, source);
}
let oldTime = performance.now() - t0;

let t1 = performance.now();
for (let i = 0; i < RUNS; i++) {
  createOrchestrationMatrixNew(config, sections, sectionPlans, source);
}
let newTime = performance.now() - t1;

console.log(`Old (O(N^2)): ${oldTime.toFixed(2)} ms for ${RUNS} runs (${(oldTime/RUNS).toFixed(4)} ms/op)`);
console.log(`New (O(N)):   ${newTime.toFixed(2)} ms for ${RUNS} runs (${(newTime/RUNS).toFixed(4)} ms/op)`);
console.log(`Speedup: ${(oldTime / newTime).toFixed(2)}x`);
