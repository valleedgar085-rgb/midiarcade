import fs from "node:fs";

const evolutionPath = "src/core/arrangement-evolution.js";
const testPath = "tests/arrangement-recontextualization.test.mjs";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`missing ${label}`);
  const next = source.replace(before, after);
  if (next === source) throw new Error(`failed ${label}`);
  return next;
}

let evolution = fs.readFileSync(evolutionPath, "utf8");
evolution = replaceOnce(
  evolution,
  'const TRANSITION_TRACK_PRIORITY = Object.freeze(["drums", "bass", "melody", "counterpoint", "chords", "pad"]);\n',
  "",
  "transition track priority",
);

const mutationStart = evolution.indexOf("function noteIsProtected(note) {");
const mutationEnd = evolution.indexOf("function recontextualizeTransitions(song) {");
if (mutationStart < 0 || mutationEnd <= mutationStart) throw new Error("missing transition mutation block");
evolution = evolution.slice(0, mutationStart) + evolution.slice(mutationEnd);

evolution = replaceOnce(
  evolution,
  `function recontextualizeTransitions(song) {\n  const transitions = buildTransitionContext(song);\n  let shapedNotes = 0;\n  for (const transition of transitions) shapedNotes += shapeTransitionBoundary(song, transition);\n\n  song.songBlueprint = {\n    ...(song.songBlueprint ?? {}),\n    transitions: clone(transitions),\n  };\n  song.arrangementTransitions = transitions.map((transition) => ({\n    ...transition,\n    handoffId: \`handoff:\${transition.fromSectionId}->\${transition.toSectionId}\`,\n    releaseRole: transition.type === "drop-out" ? "breath" : "pickup",\n    pickupRole: transition.type,\n    anchorRole: "arrival",\n  }));\n  return { transitions, shapedNotes };\n}`,
  `function recontextualizeTransitions(song) {\n  const transitions = buildTransitionContext(song);\n  song.songBlueprint = {\n    ...(song.songBlueprint ?? {}),\n    transitions: clone(transitions),\n  };\n  song.arrangementTransitions = transitions.map((transition) => ({\n    ...transition,\n    handoffId: \`handoff:\${transition.fromSectionId}->\${transition.toSectionId}\`,\n    releaseRole: transition.type === "drop-out" ? "breath" : "pickup",\n    pickupRole: transition.type,\n    anchorRole: "arrival",\n  }));\n  return { transitions, shapedNotes: 0 };\n}`,
  "metadata-only transition recontextualization",
);

evolution = replaceOnce(
  evolution,
  ` * Reorder whole existing sections while preserving section identity and every\n * note pitch/onset/duration. Phase 8 then rebuilds the transition context for\n * the new neighbors and adds only bounded velocity accents to real boundary\n * notes, so critic credit corresponds to an audible transition rather than\n * stale metadata from the old order.`,
  ` * Reorder whole existing sections while preserving section identity and the\n * complete note payload. Phase 8 rebuilds only the transition/interlock context\n * for the new neighbors. Expressive boundary performance belongs in a separate\n * critic-audited stage so arrangement reordering remains atomic and reversible.`,
  "arrangement atomicity comment",
);
fs.writeFileSync(evolutionPath, evolution);

let testFile = fs.readFileSync(testPath, "utf8");
testFile = replaceOnce(
  testFile,
  "  assert.ok(result.song.outputQualityEvolution.arrangement.transitionNotesShaped > 0);",
  "  assert.equal(result.song.outputQualityEvolution.arrangement.transitionNotesShaped, 0);",
  "recontextualization shaped count assertion",
);

const testStart = testFile.indexOf('test("transition shaping is audible but bounded and never rewrites pitch, duration, or note count", () => {');
const nextTest = testFile.indexOf('test("Phase 8 recontextualization does not widen the critic candidate ceiling", () => {', testStart);
if (testStart < 0 || nextTest <= testStart) throw new Error("missing old transition-shaping test");
const replacement = `test("arrangement recontextualization keeps the complete note payload atomic", () => {\n  const source = fixtureSong();\n  const config = changingConfig(source);\n  const first = evolveSongArrangement(source, config);\n  const repeated = evolveSongArrangement(source, config);\n\n  assert.deepEqual(first, repeated, "same song and seed must produce the exact same arrangement context");\n\n  const sourceNotes = notesByTag(source);\n  const evolvedNotes = notesByTag(first.song);\n  assert.equal(evolvedNotes.size, sourceNotes.size);\n\n  for (const [tag, note] of evolvedNotes) {\n    const original = sourceNotes.get(tag);\n    assert.ok(original, \`missing source note \${tag}\`);\n    assert.equal(note.pitch, original.pitch, \`\${tag} pitch must stay authoritative\`);\n    assert.equal(note.duration, original.duration, \`\${tag} duration must stay authoritative\`);\n    assert.equal(note.velocity, original.velocity, \`\${tag} velocity must stay authoritative during reorder\`);\n    assert.equal(note.transitionFeature, original.transitionFeature, \`\${tag} transition feature must not be synthesized during reorder\`);\n    assert.equal(note.connectionId, original.connectionId, \`\${tag} connection id must not be synthesized during reorder\`);\n  }\n\n  assert.equal(first.song.outputQualityEvolution.arrangement.transitionNotesShaped, 0);\n});\n\n`;
testFile = testFile.slice(0, testStart) + replacement + testFile.slice(nextTest);
testFile = replaceOnce(
  testFile,
  "    assert.ok(candidate.song.outputQualityEvolution.arrangement.transitionNotesShaped <= candidate.song.arrangementTransitions.length * 3);",
  "    assert.equal(candidate.song.outputQualityEvolution.arrangement.transitionNotesShaped, 0);",
  "candidate atomicity assertion",
);
fs.writeFileSync(testPath, testFile);

console.log("Phase 8B patch applied: arrangement recontextualization is metadata-only and note payloads remain atomic.");
