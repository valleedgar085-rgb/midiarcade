import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { SHAPE_QUICK_DIRECTIONS } from "../src/core/shape-director-policy.js";
import {
  ELEMENT_SHAPE_SUGGESTIONS,
  shapeDirectionSuggestionsForElement,
} from "../src/ui/create-shape-bridge.js";

const bridgeSource = fs.readFileSync(new URL("../src/ui/create-shape-bridge.js", import.meta.url), "utf8");

test("Fire, Electric, and Drip expose distinct ranked Shape starting points", () => {
  assert.deepEqual(
    shapeDirectionSuggestionsForElement("fire").map((entry) => entry.directionId),
    ["harder", "moreBounce", "buildUp"],
  );
  assert.deepEqual(
    shapeDirectionSuggestionsForElement("electric").map((entry) => entry.directionId),
    ["catchier", "busier", "buildUp"],
  );
  assert.deepEqual(
    shapeDirectionSuggestionsForElement("drip").map((entry) => entry.directionId),
    ["moreSpace", "moreEmotional", "darker"],
  );
});

test("Element suggestions only reference canonical Shape directions", () => {
  for (const [elementId, specs] of Object.entries(ELEMENT_SHAPE_SUGGESTIONS)) {
    const suggestions = shapeDirectionSuggestionsForElement({ id: elementId });
    assert.equal(suggestions.length, specs.length);
    suggestions.forEach((entry, index) => {
      assert.equal(entry.rank, index + 1);
      assert.equal(entry.elementId, elementId);
      assert.equal(entry.direction, SHAPE_QUICK_DIRECTIONS[entry.directionId]);
      assert.ok(entry.reason.length > 12);
    });
  }
  assert.deepEqual(shapeDirectionSuggestionsForElement("base"), []);
  assert.deepEqual(shapeDirectionSuggestionsForElement(null), []);
});

test("Element suggestions are advisory and route through existing Shape controls", () => {
  assert.match(bridgeSource, /id = "shapeElementSuggestions"/);
  assert.match(bridgeSource, /Nothing changes until you choose one\./);
  assert.match(bridgeSource, /data-shape-suggestion/);
  assert.match(bridgeSource, /data-shape-direction=\\"\$\{directionId\}\\"/);
  assert.match(bridgeSource, /\.click\?\.\(\)/);
  assert.doesNotMatch(bridgeSource, /createShapeCandidate\(/);
  assert.doesNotMatch(bridgeSource, /createShapeIntent\(/);
});

test("Drip guidance stays compositional rather than becoming an effects shortcut", () => {
  const drip = shapeDirectionSuggestionsForElement("drip");
  const dimensions = drip.flatMap((entry) => entry.direction.dimensions);
  assert.equal(dimensions.includes("reverb"), false);
  assert.equal(dimensions.includes("delay"), false);
  assert.equal(dimensions.includes("stereoWidth"), false);
});
