import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  creativeContextChips,
  creativeContextSignature,
  elementMeta,
  normalizeCreativeContext,
  normalizeElementId,
} from "../src/core/creative-context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const bridgeSource = fs.readFileSync(path.join(root, "src/ui/create-shape-bridge.js"), "utf8");
const createWorkflowSource = fs.readFileSync(path.join(root, "src/ui/create-workflow-phase1.js"), "utf8");
const generationProgressSource = fs.readFileSync(path.join(root, "src/ui/generation-progress.js"), "utf8");
const buildSource = fs.readFileSync(path.join(root, "scripts/build.js"), "utf8");

test("creative context keeps current song facts separate from staged direction", () => {
  const context = normalizeCreativeContext({
    song: {
      title: "Midnight Polaroid",
      genre: "NEO SOUL",
      keyMode: "D DORIAN",
      tempo: "84 BPM",
      bars: "32 BARS",
      groove: "LAID-BACK",
      dnaFingerprint: "18·42·77",
      dnaScore: "SCORE 94/100",
    },
    direction: {
      status: "STAGED DIRECTION",
      genreId: "trap",
      key: "A",
      mode: "minor",
      tempo: 142,
      energy: 83,
      complexity: 61,
      variation: 66,
      evolution: 72,
      surprise: 35,
    },
    element: "fire",
  });

  assert.equal(context.song.genre, "NEO SOUL");
  assert.equal(context.song.tempo, "84 BPM");
  assert.equal(context.direction.genreId, "trap");
  assert.equal(context.direction.tempo, 142);
  assert.equal(context.direction.status, "STAGED DIRECTION");
  assert.equal(context.element.id, "fire");
  assert.equal(context.element.character, "Heat · impact");
});

test("Element identity normalizes the three producer personalities", () => {
  assert.equal(normalizeElementId("0"), "fire");
  assert.equal(normalizeElementId("Electric"), "electric");
  assert.equal(normalizeElementId("💧 Drip"), "drip");
  assert.equal(normalizeElementId("base"), null);
  assert.equal(elementMeta("electric")?.glyph, "⚡");
});

test("Shape DNA chips describe the inherited current song, not staged controls", () => {
  const context = normalizeCreativeContext({
    song: {
      genre: "HIP-HOP",
      keyMode: "A MINOR",
      tempo: "96 BPM",
      groove: "LAID-BACK",
    },
    direction: { genreId: "house", tempo: 124 },
    element: "electric",
  });
  assert.deepEqual(
    [...creativeContextChips(context)],
    ["HIP-HOP", "A MINOR", "96 BPM", "LAID-BACK", "⚡ Electric"],
  );
});

test("creative context signature changes when the shaped source identity changes", () => {
  const base = normalizeCreativeContext({
    song: { title: "A", genre: "TRAP", keyMode: "A MINOR", tempo: "142 BPM", dnaFingerprint: "11·22·33" },
    element: "fire",
  });
  const changed = normalizeCreativeContext({
    song: { title: "A", genre: "TRAP", keyMode: "A MINOR", tempo: "142 BPM", dnaFingerprint: "11·22·34" },
    element: "fire",
  });
  assert.notEqual(creativeContextSignature(base), creativeContextSignature(changed));
});

test("bridge provides an explicit Create to Shape CTA and inherited DNA ribbon", () => {
  assert.match(bridgeSource, /id = "createShapeHandoff"/);
  assert.match(bridgeSource, /id=\"shapeThisSongButton\"/);
  assert.match(bridgeSource, /Shape this song/);
  assert.match(bridgeSource, /id = "createShapeContextRibbon"/);
  assert.match(bridgeSource, /FROM CREATE · SONG DNA/);
  assert.match(bridgeSource, /midiarcade:create-shape-context/);
  assert.match(bridgeSource, /\[data-workspace=\"arrange\"\]/);
  assert.match(bridgeSource, /\[data-workspace=\"create\"\]/);
});

test("bridge reads authoritative current-song facts and preserves staged Create controls separately", () => {
  for (const id of ["songTitle", "factGenre", "factKey", "factTempo", "factBars", "factRhythm", "dnaFingerprint", "dnaScoreBadge"]) {
    assert.match(bridgeSource, new RegExp(`#${id}`), `${id} should feed the inherited song identity`);
  }
  for (const id of ["genreControl", "secondaryGenreControl", "keyControl", "modeControl", "tempoControl", "barsControl", "grooveControl", "energyControl", "complexityControl", "variationControl", "evolutionControl", "surpriseControl"]) {
    assert.match(bridgeSource, new RegExp(`#${id}`), `${id} should remain available as staged direction context`);
  }
});

test("production app bundle loads the bridge without increasing the protected initial HTML", () => {
  assert.match(createWorkflowSource, /import "\.\/create-shape-bridge\.js";/);
  assert.match(generationProgressSource, /import "\.\/create-workflow-phase1\.js";/);
  assert.doesNotMatch(buildSource, /create-shape-bridge\.js/);
  assert.doesNotMatch(buildSource, /replace\(\s*['"]<\/body>/);
  assert.match(buildSource, /copyRecursiveSync\(path\.join\(wwwDir, 'src'\), path\.join\(androidPublicDir, 'src'\)\)/);
});
