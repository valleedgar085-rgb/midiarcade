import fs from "node:fs";

const enginePath = "src/music-engine.js";
const steeringTestPath = "tests/creative-genome-steering.test.mjs";
let source = fs.readFileSync(enginePath, "utf8");

function replaceOnce(haystack, needle, replacement, label) {
  const first = haystack.indexOf(needle);
  if (first < 0) throw new Error(`Phase 9C patch anchor missing: ${label}`);
  if (haystack.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`Phase 9C patch anchor is ambiguous: ${label}`);
  }
  return haystack.slice(0, first) + replacement + haystack.slice(first + needle.length);
}

source = replaceOnce(
  source,
  `function normalizeScale(value) {\n  const token = String(value ?? "minor").replace(/[\\s_-]/g, "").toLowerCase();\n  return SCALE_ALIASES[token] ?? "minor";\n}\n`,
  `function normalizeScale(value) {\n  const token = String(value ?? "minor").replace(/[\\s_-]/g, "").toLowerCase();\n  return SCALE_ALIASES[token] ?? "minor";\n}\n\nconst CREATIVE_MOTIF_MUTATIONS = new Set([\n  "literal-recall",\n  "answer",\n  "rhythmic-mutation",\n  "truncate-expand",\n  "instrument-handoff",\n  "contour-rewrite",\n]);\nconst CREATIVE_SPOTLIGHT_ROTATIONS = new Set([\n  "lead-led",\n  "bass-to-lead",\n  "chords-to-lead",\n  "counterpoint-to-hook",\n  "section-rotation",\n]);\n\nfunction normalizeCreativeStrategyToken(value, allowed) {\n  const token = String(value ?? "").trim();\n  return allowed.has(token) ? token : null;\n}\n\nfunction normalizeCreativeMotifMutation(value) {\n  return normalizeCreativeStrategyToken(value, CREATIVE_MOTIF_MUTATIONS);\n}\n\nfunction normalizeCreativeSpotlightRotation(value) {\n  return normalizeCreativeStrategyToken(value, CREATIVE_SPOTLIGHT_ROTATIONS);\n}\n`,
  "creative strategy token normalization",
);

source = replaceOnce(
  source,
  `  const tracks = {};\n  const paletteRng = createSeededRandom(\`\${seed}::\${genre}::palette\`);\n  for (const id of TRACK_IDS) tracks[id] = normalizeTrack(id, providedTracks[id], profile, paletteRng.fork(id));\n\n  return {`,
  `  const tracks = {};\n  const paletteRng = createSeededRandom(\`\${seed}::\${genre}::palette\`);\n  for (const id of TRACK_IDS) tracks[id] = normalizeTrack(id, providedTracks[id], profile, paletteRng.fork(id));\n  const creativeMotifMutation = normalizeCreativeMotifMutation(input.creativeMotifMutation);\n  const creativeSpotlightRotation = normalizeCreativeSpotlightRotation(input.creativeSpotlightRotation);\n  const creativeMotifStrength = clamp(finite(input.creativeMotifStrength, 0), 0, 1.3);\n  const creativeMotifMaxEvents = clamp(Math.round(finite(input.creativeMotifMaxEvents, 0)), 0, 2);\n\n  return {`,
  "normalize config creative values",
);

source = replaceOnce(
  source,
  `    title: input.title == null ? null : String(input.title).slice(0, 100),\n    tracks,`,
  `    title: input.title == null ? null : String(input.title).slice(0, 100),\n    ...(creativeMotifMutation ? { creativeMotifMutation } : {}),\n    ...(creativeSpotlightRotation ? { creativeSpotlightRotation } : {}),\n    ...(creativeMotifMutation || creativeSpotlightRotation ? {\n      creativeMotifStrength,\n      creativeMotifMaxEvents,\n    } : {}),\n    tracks,`,
  "normalize config return creative values",
);

const featuredOld = `function featuredTrackForSection(section, plan, config, occurrence = 0) {\n  if (section.name === "intro" || ["breakdown", "outro"].includes(section.name)) return "pad";\n  if (section.name === "bridge") return "counterpoint";\n  if (section.name === "solo") return occurrence % 2 ? "melody" : "counterpoint";\n  if (section.name === "drop") return plan.role === "peak" ? "bass" : "drums";\n  if (["prechorus", "build"].includes(section.name)) return "chords";\n  if (occurrence > 0) {\n    const candidates = ["house", "techno", "drumBass", "trap", "drill", "funk", "rock"].includes(config.genre)\n      ? ["bass", "drums", "counterpoint"]\n      : ["neoSoul", "rnbSoul", "jazz", "loFiHipHop"].includes(config.genre)\n        ? ["chords", "counterpoint", "bass"]\n        : ["counterpoint", "bass", "chords"];\n    return candidates[hashSeed(\`\${config.seed}|\${section.name}|feature-return|\${occurrence}\`) % candidates.length];\n  }\n  return "melody";\n}\n`;

const featuredNew = `function creativeReturnFeaturedTrack(section, config, occurrence) {\n  if (occurrence <= 0 || !["verse", "chorus", "theme", "idea"].includes(section.name)) return null;\n  if (config.creativeSpotlightRotation === "lead-led") return "melody";\n  if (config.creativeSpotlightRotation === "bass-to-lead") return occurrence % 2 ? "bass" : "melody";\n  if (config.creativeSpotlightRotation === "chords-to-lead") return occurrence % 2 ? "chords" : "melody";\n  if (config.creativeSpotlightRotation === "counterpoint-to-hook") return occurrence % 2 ? "counterpoint" : "melody";\n  return null;\n}\n\nfunction featuredTrackForSection(section, plan, config, occurrence = 0) {\n  if (section.name === "intro" || ["breakdown", "outro"].includes(section.name)) return "pad";\n  if (section.name === "bridge") return "counterpoint";\n  if (section.name === "solo") return occurrence % 2 ? "melody" : "counterpoint";\n  if (section.name === "drop") return plan.role === "peak" ? "bass" : "drums";\n  if (["prechorus", "build"].includes(section.name)) return "chords";\n  const creativeReturn = creativeReturnFeaturedTrack(section, config, occurrence);\n  if (creativeReturn) return creativeReturn;\n  if (occurrence > 0) {\n    const candidates = ["house", "techno", "drumBass", "trap", "drill", "funk", "rock"].includes(config.genre)\n      ? ["bass", "drums", "counterpoint"]\n      : ["neoSoul", "rnbSoul", "jazz", "loFiHipHop"].includes(config.genre)\n        ? ["chords", "counterpoint", "bass"]\n        : ["counterpoint", "bass", "chords"];\n    return candidates[hashSeed(\`\${config.seed}|\${section.name}|feature-return|\${occurrence}\`) % candidates.length];\n  }\n  return "melody";\n}\n`;
source = replaceOnce(source, featuredOld, featuredNew, "featured track strategy");

const matrixOld = `function createOrchestrationMatrix(config, structure, sectionPlans, source = null) {\n  const occurrences = new Map();\n  return structure.map((section, index) => {\n    const plan = sectionPlans[index];\n    const inherited = source?.orchestrationMatrix?.find((entry) => entry.sectionId === section.id)\n      ?? source?.orchestrationMatrix?.find((entry) => entry.sectionName === section.name);\n    if (inherited?.lanes) return clone(inherited);\n    const shape = ORCHESTRATION_SHAPES[section.name] ?? ORCHESTRATION_SHAPES.idea;\n    const occurrence = occurrences.get(section.name) ?? 0;\n    occurrences.set(section.name, occurrence + 1);\n    const featuredTrack = featuredTrackForSection(section, plan, config, occurrence);`;
const matrixNew = `function createOrchestrationMatrix(config, structure, sectionPlans, source = null) {\n  const occurrences = new Map();\n  return structure.map((section, index) => {\n    const plan = sectionPlans[index];\n    const occurrence = occurrences.get(section.name) ?? 0;\n    occurrences.set(section.name, occurrence + 1);\n    const inherited = source?.orchestrationMatrix?.find((entry) => entry.sectionId === section.id)\n      ?? source?.orchestrationMatrix?.find((entry) => entry.sectionName === section.name);\n    const creativeReturn = occurrence > 0\n      && Boolean(config.creativeSpotlightRotation)\n      && ["verse", "chorus", "theme", "idea"].includes(section.name);\n    if (inherited?.lanes && !creativeReturn) return clone(inherited);\n    const shape = ORCHESTRATION_SHAPES[section.name] ?? ORCHESTRATION_SHAPES.idea;\n    const featuredTrack = featuredTrackForSection(section, plan, config, occurrence);`;
source = replaceOnce(source, matrixOld, matrixNew, "orchestration return inheritance");

const hookAnchor = `  return { eventCount: events.length, uniqueDegrees, uniqueGaps, contourTurns, syncopated, score: round(score) };\n}\n\nfunction refineWeakHookMotif(source, config, rng) {`;
const hookReplacement = `  return { eventCount: events.length, uniqueDegrees, uniqueGaps, contourTurns, syncopated, score: round(score) };\n}\n\nfunction applyCreativeHookMutation(source, config, rng) {\n  const motif = clone(source);\n  const mode = normalizeCreativeMotifMutation(config.creativeMotifMutation);\n  const strength = clamp(finite(config.creativeMotifStrength, 0), 0, 1.3);\n  const maxEvents = clamp(Math.round(finite(config.creativeMotifMaxEvents, 0)), 0, 2);\n  const before = hookDistinctivenessMetrics(motif);\n  if (!validMotif(motif) || !mode || strength <= 0 || maxEvents <= 0\n    || ["literal-recall", "instrument-handoff"].includes(mode)) {\n    return {\n      motif,\n      report: {\n        phase: "9C",\n        version: 1,\n        status: "complete",\n        mode: mode ?? null,\n        changedEvents: 0,\n        maxEvents,\n        before,\n        after: before,\n      },\n    };\n  }\n\n  const maximumDegree = Math.max(3, Math.ceil(config.melodicRange / 2));\n  const interior = motif.events\n    .map((event, index) => ({ event, index }))\n    .filter(({ index }) => index > 0 && index < motif.events.length - 1);\n  const chosen = interior.length ? rng.shuffle(interior).slice(0, Math.min(maxEvents, interior.length)) : [];\n  let changedEvents = 0;\n\n  for (const { event, index } of chosen) {\n    const original = { ...event };\n    if (mode === "answer") {\n      const direction = event.degree === 0 ? (index % 2 ? 1 : -1) : -Math.sign(event.degree);\n      event.degree = clamp(event.degree + direction, -maximumDegree, maximumDegree);\n    } else if (mode === "rhythmic-mutation") {\n      const previous = motif.events[index - 1];\n      const next = motif.events[index + 1];\n      const minimum = previous.offset + 0.125;\n      const maximum = Math.min(motif.lengthBeats - 0.125, next.offset - 0.125);\n      const preferred = event.offset + rng.pick([-0.25, 0.25]);\n      event.offset = round(clamp(preferred, minimum, Math.max(minimum, maximum)));\n    } else if (mode === "truncate-expand") {\n      const next = motif.events[index + 1];\n      const available = Math.max(0.2, (next?.offset ?? motif.lengthBeats) - event.offset - 0.05);\n      const scale = index % 2 ? 0.7 : 1.28;\n      event.duration = round(clamp(event.duration * scale, 0.2, Math.min(4, available)));\n    } else if (mode === "contour-rewrite") {\n      const direction = event.degree === 0 ? (rng.bool() ? 1 : -1) : -Math.sign(event.degree);\n      event.degree = clamp(event.degree + direction * 2, -maximumDegree, maximumDegree);\n    }\n    if (event.degree !== original.degree || event.offset !== original.offset || event.duration !== original.duration) {\n      changedEvents += 1;\n    }\n  }\n\n  motif.events.sort((left, right) => left.offset - right.offset);\n  return {\n    motif,\n    report: {\n      phase: "9C",\n      version: 1,\n      status: "complete",\n      mode,\n      strength: round(strength),\n      changedEvents,\n      maxEvents,\n      before,\n      after: hookDistinctivenessMetrics(motif),\n    },\n  };\n}\n\nfunction refineWeakHookMotif(source, config, rng) {`;
source = replaceOnce(source, hookAnchor, hookReplacement, "creative hook mutation");

const composeOld = `  const renderedHook = motifs.family?.B?.melody;\n  if (renderedHook) {\n    const finalHookRefinement = refineWeakHookMotif(\n      renderedHook,\n      config,\n      rootRng.fork("post-route-hook-distinctiveness"),\n    );\n    motifs.family.B.melody = smoothMotifFlow(finalHookRefinement.motif, "hook");`;
const composeNew = `  let renderedHook = motifs.family?.B?.melody;\n  if (renderedHook) {\n    const creativeGenomeMutation = applyCreativeHookMutation(\n      renderedHook,\n      config,\n      rootRng.fork("creative-genome-hook-mutation"),\n    );\n    motifs.family.B.melody = creativeGenomeMutation.motif;\n    renderedHook = motifs.family.B.melody;\n    const finalHookRefinement = refineWeakHookMotif(\n      renderedHook,\n      config,\n      rootRng.fork("post-route-hook-distinctiveness"),\n    );\n    motifs.family.B.melody = smoothMotifFlow(finalHookRefinement.motif, "hook");`;
source = replaceOnce(source, composeOld, composeNew, "compose hook mutation integration");

source = replaceOnce(
  source,
  `    motifs.hookDistinctiveness = finalHookRefinement.report;\n  }\n  const grooveConductor = createGrooveConductor(`,
  `    motifs.hookDistinctiveness = finalHookRefinement.report;\n    motifs.creativeGenomeMutation = creativeGenomeMutation.report;\n  }\n  const grooveConductor = createGrooveConductor(`,
  "creative hook report",
);

fs.writeFileSync(enginePath, source);

let steeringTests = fs.readFileSync(steeringTestPath, "utf8");
steeringTests = replaceOnce(
  steeringTests,
  `  assert.deepEqual(first.producerBrain.creativeGenome.guardrails.consumedFields, ["energyArc", "spaceStrategy"]);`,
  `  assert.deepEqual(first.producerBrain.creativeGenome.guardrails.consumedFields, [\n    "energyArc",\n    "spaceStrategy",\n    "motifMutation",\n    "spotlightRotation",\n  ]);`,
  "Phase 9B consumed field expectation",
);
fs.writeFileSync(steeringTestPath, steeringTests);

console.log("Phase 9C motif/spotlight engine patch applied.");
