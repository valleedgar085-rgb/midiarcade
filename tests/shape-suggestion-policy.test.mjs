import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { rankShapeSuggestions } from "../src/core/shape-director-policy.js";

const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("A3 ranks Shape starting points from critic weakness, section role, target, and Element lineage", () => {
  const suggestions = rankShapeSuggestions({
    song: {
      variationSet: { element: { id: "fire" } },
      meta: {
        scoreDetails: {
          subscores: {
            groove: 76,
            transitions: 92,
            harmony: 90,
            phraseResolution: 91,
            hook: 89,
            arrangement: 93,
            production: 94,
            performance: 88,
          },
        },
      },
    },
    section: { id: "verse-1", name: "Verse 1" },
    target: "track",
  });

  assert.equal(suggestions.length, 3);
  assert.equal(suggestions[0].directionId, "moreBounce");
  assert.equal(suggestions[0].rank, 1);
  assert.ok(suggestions[0].signals.includes("critic"));
  assert.ok(suggestions[0].signals.includes("section"));
  assert.ok(suggestions[0].signals.includes("element"));
  assert.match(suggestions[0].reason, /critic|pocket/i);
});

test("A3 adapts the ranked suggestion to payoff and outro section roles", () => {
  const payoff = rankShapeSuggestions({
    song: { meta: { scoreDetails: { subscores: { hook: 90, groove: 90 } } } },
    section: { name: "Chorus Payoff" },
    target: "section",
  });
  assert.equal(payoff[0].directionId, "catchier");

  const outro = rankShapeSuggestions({
    song: {},
    section: { name: "Outro" },
    target: "notes",
  });
  assert.ok(outro.some((entry) => entry.directionId === "calmDown"));
});

test("A3 wiring stays advisory and stages the existing Shape transaction path", () => {
  assert.match(app, /rankShapeSuggestions\(\{/);
  assert.match(app, /nothing commits automatically/);
  assert.match(app, /data-shape-direction/);
  assert.match(app, /prepareShapeDirectorCandidate\(direction\)/);
  assert.match(app, /state\.song\?\.variationSet\?\.element\?\.id/);
});
