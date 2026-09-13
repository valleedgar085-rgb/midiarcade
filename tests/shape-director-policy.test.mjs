import assert from "node:assert/strict";
import test from "node:test";

import {
  SHAPE_CHANGE_SIZES,
  SHAPE_QUICK_DIRECTIONS,
  controlOwner,
  createShapeIntent,
  normalizeShapeSelection,
} from "../src/core/shape-director-policy.js";

test("Shape owns composition direction while Mix owns processing controls", () => {
  assert.equal(controlOwner("density"), "shape");
  assert.equal(controlOwner("motif"), "shape");
  assert.equal(controlOwner("phraseResolution"), "shape");
  assert.equal(controlOwner("volume"), "mix");
  assert.equal(controlOwner("eq"), "mix");
  assert.equal(controlOwner("reverb"), "mix");
  assert.equal(controlOwner("compression"), "mix");
  assert.equal(controlOwner("masterLoudness"), "mix");
});

test("Shape supports section, track, and note-level targeting", () => {
  assert.deepEqual(normalizeShapeSelection({ target: "section", sectionId: "verse-1" }), {
    target: "section",
    sectionId: "verse-1",
    trackId: null,
    noteIds: [],
  });
  assert.equal(normalizeShapeSelection({ target: "track", sectionId: "chorus-1", trackId: "melody" }).trackId, "melody");
  const notes = normalizeShapeSelection({
    target: "notes",
    sectionId: "bridge",
    trackId: "bass",
    noteIds: ["n1", "n1", "n2"],
  });
  assert.deepEqual(notes.noteIds, ["n1", "n2"]);
});

test("invalid narrow scopes fail instead of silently changing a larger region", () => {
  assert.throws(() => normalizeShapeSelection({ target: "section" }), /sectionId/);
  assert.throws(() => normalizeShapeSelection({ target: "track", sectionId: "verse" }), /trackId/);
  assert.throws(() => normalizeShapeSelection({ target: "notes", sectionId: "verse", trackId: "melody" }), /noteId/);
});

test("change sizes expose bounded rewrite budgets from subtle to transformative", () => {
  assert.ok(SHAPE_CHANGE_SIZES.touchUp.rewriteBudget < SHAPE_CHANGE_SIZES.reshape.rewriteBudget);
  assert.ok(SHAPE_CHANGE_SIZES.reshape.rewriteBudget < SHAPE_CHANGE_SIZES.transform.rewriteBudget);
  assert.ok(SHAPE_CHANGE_SIZES.transform.rewriteBudget < 1);
});

test("Shape intent combines local target, change size, musical direction, and preserve locks", () => {
  const intent = createShapeIntent({
    selection: { target: "track", sectionId: "verse-2", trackId: "melody" },
    size: "reshape",
    direction: "catchier",
    preserve: ["harmony", "instrument", "not-a-lock"],
  });

  assert.equal(intent.selection.sectionId, "verse-2");
  assert.equal(intent.selection.trackId, "melody");
  assert.equal(intent.size.id, "reshape");
  assert.equal(intent.direction, SHAPE_QUICK_DIRECTIONS.catchier);
  assert.deepEqual(intent.preserve, ["harmony", "instrument"]);
});

test("More Space remains a composition instruction rather than an FX shortcut", () => {
  assert.equal(SHAPE_QUICK_DIRECTIONS.moreSpace.dimensions.includes("reverb"), false);
  assert.deepEqual(SHAPE_QUICK_DIRECTIONS.moreSpace.dimensions, ["density", "phraseLength", "noteGate"]);
});
