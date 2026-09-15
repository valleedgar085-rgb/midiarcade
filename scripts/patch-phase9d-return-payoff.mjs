import fs from "node:fs";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`Phase 9D patch anchor missing: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`Phase 9D patch anchor is ambiguous: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

const returnPath = "src/core/return-development.js";
let returns = fs.readFileSync(returnPath, "utf8");

returns = replaceOnce(
  returns,
  "function applyRhythmicRecall(song, pairs) {",
  "function applyRhythmicRecall(song, pairs, options = {}) {",
  "rhythmic recall options",
);

returns = replaceOnce(
  returns,
  `  const maxRepeats = technoGridRecall ? 4 : 1;\n  const maxChangedPerTarget = technoGridRecall ? 16 : 8;`,
  `  const maxRepeats = Number.isFinite(Number(options.maxRepeats))\n    ? clamp(Math.round(Number(options.maxRepeats)), 1, 4)\n    : technoGridRecall ? 4 : 1;\n  const maxChangedPerTarget = Number.isFinite(Number(options.maxChangedPerTarget))\n    ? clamp(Math.round(Number(options.maxChangedPerTarget)), 1, 16)\n    : technoGridRecall ? 16 : 8;\n  const recallRole = String(options.role ?? "rhythmic-recall");`,
  "bounded recall envelope",
);

returns = replaceOnce(
  returns,
  `          destination[index].returnDevelopmentRole = "rhythmic-recall";`,
  `          destination[index].returnDevelopmentRole = recallRole;`,
  "generic recall role",
);

const spotlightHelpers = `function orchestrationEntryForSection(song, section) {\n  const matrix = Array.isArray(song?.orchestrationMatrix) ? song.orchestrationMatrix : [];\n  return matrix.find((entry) => String(entry?.sectionId) === String(section?.id)) ?? null;\n}\n\nfunction applyReturnSpotlight(song, pairs) {\n  const eligibleTracks = new Set(["melody", "bass", "chords", "counterpoint"]);\n  let changed = 0;\n\n  for (const { target, origin } of pairs) {\n    const matrix = orchestrationEntryForSection(song, target);\n    const featuredTrackId = String(matrix?.featuredTrack ?? "");\n    if (finite(matrix?.featureOccurrence, 0) <= 0 || !eligibleTracks.has(featuredTrackId)) continue;\n    const track = trackOf(song, featuredTrackId);\n    if (!track?.notes?.length) continue;\n    const notes = notesInSection(track, target);\n    if (!notes.length) continue;\n\n    const handoffSuffix = \`-to-\${featuredTrackId}\`;\n    const handoffNotes = notes.filter((note) => String(note?.motifHandoffRole ?? "").endsWith(handoffSuffix));\n    const handoffSet = new Set(handoffNotes);\n    const ordered = [...handoffNotes, ...notes.filter((note) => !handoffSet.has(note))].slice(0, 2);\n\n    for (const note of ordered) {\n      const before = noteVelocity(note);\n      const lift = note?.motifHandoffRole ? 7 : 4;\n      const after = clamp(before + lift, 1, 127);\n      if (after <= before + 1e-6) continue;\n      setNoteVelocity(note, after);\n      note.returnDevelopmentSpotlightRole = \`feature-\${featuredTrackId}\`;\n      note.returnDevelopmentOriginSectionId = String(origin.id);\n      changed += 1;\n    }\n  }\n\n  return changed;\n}\n\nfunction applyReturnPayoff(song, pairs) {\n  const recallChanges = applyRhythmicRecall(song, pairs, {\n    maxRepeats: 1,\n    maxChangedPerTarget: 2,\n    role: "return-payoff-recall",\n  });\n  const cadenceChanges = applyCadencePayoff(song, pairs);\n  const spotlightChanges = applyReturnSpotlight(song, pairs);\n  return recallChanges + cadenceChanges + spotlightChanges;\n}\n\n`;

returns = replaceOnce(
  returns,
  "function grooveOffsetsForGenre(genre) {",
  `${spotlightHelpers}function grooveOffsetsForGenre(genre) {`,
  "coordinated return payoff helpers",
);

returns = replaceOnce(
  returns,
  ` * Create at most three focused return-section candidates. Each candidate fixes\n * one measurable quality axis and leaves harmony, song length, section order,\n * and all unrelated notes untouched. The caller must critic/release-gate them.`,
  ` * Create at most three focused return-section candidates. Each strategy stays\n * bounded to recurring sections and leaves harmony, song length, section order,\n * and all unrelated notes untouched. The caller must critic/release-gate them.`,
  "return candidate documentation",
);

returns = replaceOnce(
  returns,
  `  const definitions = [\n    ["cadence-payoff", applyCadencePayoff],\n    ["rhythmic-recall", applyRhythmicRecall],\n    ["groove-lock", applyGrooveLock],\n  ];`,
  `  const definitions = [\n    ["return-payoff", applyReturnPayoff],\n    ["rhythmic-recall", applyRhythmicRecall],\n    ["groove-lock", applyGrooveLock],\n  ];`,
  "return candidate set",
);

fs.writeFileSync(returnPath, returns);

const postPath = "src/core/output-quality-postprocess.js";
let post = fs.readFileSync(postPath, "utf8");
post = replaceOnce(
  post,
  `const RETURN_DIMENSIONS = Object.freeze({\n  "cadence-payoff": Object.freeze(["phraseResolution"]),\n  "rhythmic-recall": Object.freeze(["repetition", "motif"]),\n  "groove-lock": Object.freeze(["groove"]),\n});`,
  `const RETURN_DIMENSIONS = Object.freeze({\n  "return-payoff": Object.freeze(["phraseResolution", "repetition", "motif"]),\n  "rhythmic-recall": Object.freeze(["repetition", "motif"]),\n  "groove-lock": Object.freeze(["groove"]),\n});`,
  "return critic dimensions",
);
fs.writeFileSync(postPath, post);

const testPath = "tests/return-development.test.mjs";
let testSource = fs.readFileSync(testPath, "utf8");

const newTest = `test("Phase 9D return payoff coordinates bounded recall, cadence, and native spotlight inside return sections", () => {\n  const song = generateNew({\n    genre: "pop",\n    seed: "section-contrast-pop",\n    bars: 32,\n    energy: 0.76,\n    evolution: 0.84,\n    candidateCount: 1,\n    creativeSpotlightRotation: "bass-to-lead",\n    creativeMotifStrength: 1,\n    creativeMotifMaxEvents: 0,\n  });\n  const before = structuredClone(song);\n  const config = {\n    genre: "pop",\n    seed: "phase9d-return-payoff",\n    bars: 32,\n    arrangementEvolution: false,\n    returnDevelopment: true,\n  };\n  const first = createReturnDevelopmentCandidates(song, config);\n  const repeated = createReturnDevelopmentCandidates(song, config);\n  const payoff = first.find(({ id }) => id === "return-payoff");\n  const repeatedPayoff = repeated.find(({ id }) => id === "return-payoff");\n  const targets = returnDevelopmentTargets(song);\n  const targetIds = new Set(targets.map(({ sectionId }) => sectionId));\n\n  assert.deepEqual(song, before, "Phase 9D candidate creation must keep the source authoritative");\n  assert.ok(payoff, "the coordinated return-payoff candidate should be available for a repeated hook fixture");\n  assert.deepEqual(payoff.song, repeatedPayoff.song, "the coordinated payoff must be deterministic");\n  assert.ok(first.length <= MAX_RETURN_DEVELOPMENT_CANDIDATES);\n  assert.ok(payoff.changedNotes > 0);\n  assert.ok(payoff.changedNotes <= targets.length * 5, "return payoff must stay within the 2 recall + 1 cadence + 2 spotlight edit envelope");\n  assert.deepEqual(payoff.song.structure, song.structure);\n  assert.deepEqual(payoff.song.harmony, song.harmony);\n\n  for (const sourceTrack of song.tracks) {\n    const candidateTrack = payoff.song.tracks.find((track) => track.id === sourceTrack.id);\n    assert.equal(candidateTrack?.notes?.length, sourceTrack.notes.length, \`\${sourceTrack.id} note count must remain unchanged\`);\n  }\n\n  const spotlight = payoff.song.tracks.flatMap((track) => (track.notes ?? [])\n    .filter((note) => note.returnDevelopmentSpotlightRole)\n    .map((note) => ({ track, note })));\n  assert.ok(spotlight.length >= 1, "Phase 9D should audibly reinforce at least one native return spotlight");\n  assert.ok(spotlight.length <= targets.length * 2, "spotlight reinforcement is capped at two notes per return");\n  assert.ok(spotlight.some(({ note }) => note.motifHandoffRole), "known Phase 9C fixture should reinforce an existing motif handoff instead of inventing a new phrase");\n\n  for (const { track, note } of spotlight) {\n    const section = payoff.song.structure.find((entry) => note.start >= entry.startBeat - 1e-6 && note.start < entry.endBeat - 1e-6);\n    assert.ok(section && targetIds.has(String(section.id)), "spotlight edits must stay inside recurring target sections");\n    const matrix = payoff.song.orchestrationMatrix.find((entry) => String(entry.sectionId) === String(section.id));\n    assert.equal(matrix?.featuredTrack, track.id, "spotlight reinforcement must follow the native orchestration feature owner");\n    assert.equal(note.returnDevelopmentSpotlightRole, \`feature-\${track.id}\`);\n  }\n});\n\n`;

testSource = replaceOnce(
  testSource,
  `});\n\ntest("Phase 6D techno recall directly improves critic repetition overlap without changing note count or pitch", () => {`,
  `});\n\n${newTest}test("Phase 6D techno recall directly improves critic repetition overlap without changing note count or pitch", () => {`,
  "Phase 9D coordinated payoff regression",
);

testSource = replaceOnce(
  testSource,
  `      if (id === "cadence-payoff") return evaluation(90.5, { phraseResolution: 86 });\n      if (id === "rhythmic-recall") return evaluation(91.4, { repetition: 90, motif: 91 });`,
  `      if (id === "return-payoff") return evaluation(91.8, { phraseResolution: 88, repetition: 90, motif: 91 });\n      if (id === "rhythmic-recall") return evaluation(91.4, { repetition: 90, motif: 91 });`,
  "candidate scoring fixture",
);

testSource = replaceOnce(
  testSource,
  `  assert.equal(processed.returnDiagnostics.id, "rhythmic-recall");`,
  `  assert.equal(processed.returnDiagnostics.id, "return-payoff");`,
  "candidate selection expectation",
);

fs.writeFileSync(testPath, testSource);
