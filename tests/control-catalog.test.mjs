import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTITUDE_ADJUSTMENTS,
  resolveControlHelp,
  TRACK_META,
  TRACK_ORDER,
  WORKFLOW_COPY,
} from "../src/ui/control-catalog.js";

function control({
  id = "",
  dataset = {},
  matches = () => false,
} = {}) {
  return { id, dataset, matches };
}

test("phase 21 control catalog owns immutable studio labels and workflow copy", () => {
  assert.deepEqual(TRACK_ORDER, ["drums", "bass", "chords", "melody", "counterpoint", "pad"]);
  assert.equal(Object.isFrozen(TRACK_ORDER), true);
  assert.equal(Object.isFrozen(TRACK_META), true);
  assert.equal(Object.isFrozen(ATTITUDE_ADJUSTMENTS), true);
  assert.equal(WORKFLOW_COPY.length, 5);
  assert.match(WORKFLOW_COPY[4].text, /export/i);
});

test("phase 21 help resolver maps stable ids, delegated actions, and progressive controls", () => {
  assert.deepEqual(resolveControlHelp(control({ id: "generateNew" })), [
    "New song idea",
    "Replace the entire composition: every instrument, chord progression, phrase, sound and section.",
  ]);
  assert.equal(
    resolveControlHelp(control({ dataset: { attitude: "hush" } }))[0],
    "Hush",
  );
  assert.equal(
    resolveControlHelp(control({ dataset: { editorAction: "quantize" } }))[0],
    "Quantize",
  );
  assert.match(
    resolveControlHelp(control({ dataset: { workflowStep: "3" } }))[0],
    /Workflow step 3/,
  );
  assert.equal(
    resolveControlHelp(control({
      matches: (selector) => selector === ".track-expression > summary",
    }))[0],
    "Shape instrument",
  );
  assert.equal(resolveControlHelp(null), null);
});

test("control catalog resolves help for newly described studio controls", () => {
  const newControlIds = [
    "menuButton",
    "keyTransposeDown",
    "keyTransposeUp",
    "secondaryGenreControl",
    "chordPathControl",
    "trapIntroModeControl",
    "tasteRating",
    "spotlightTrackControl",
    "spotlightIntensityControl",
    "exportProfileControl",
    "exportTimingControl",
    "saveCoverButton",
    "varyCoverButton",
    "clearSoloButton",
    "mixEnhanceToggle",
    "navDockToggle",
    "mobileDockToggle",
  ];

  for (const id of newControlIds) {
    const help = resolveControlHelp(control({ id }));
    assert.ok(Array.isArray(help), `Control help for ${id} should be an array`);
    assert.equal(help.length, 2, `Control help for ${id} should contain title and description`);
    assert.ok(help[0].length > 0, `Title for ${id} should be non-empty`);
    assert.ok(help[1].length > 0, `Description for ${id} should be non-empty`);
  }
});
