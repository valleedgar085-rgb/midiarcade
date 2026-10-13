import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { songInspectorSuggestions } from "../src/core/song-inspector.js";
import { rankShapeSuggestions, SHAPE_QUICK_DIRECTIONS } from "../src/core/shape-director-policy.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Inspector inherits deterministic critic and section context without creating new musical authority", () => {
  const song = { meta: { scoreDetails: { subscores: { groove: 74, hook: 92, arrangement: 88 } } } };
  const section = { id: "verse-1", name: "Verse 1" };
  const input = { song, section, target: "track", elementId: "fire" };
  const first = songInspectorSuggestions(input);
  const again = songInspectorSuggestions(input);
  assert.deepEqual(again, first);
  assert.equal(first.length, 2);
  assert.equal(first[0].directionId, "moreBounce");
  assert.equal(first[0].evidence, "LOWEST SCORED DIMENSION");
  assert.match(first[0].explanation, /critic|pocket/i);
  assert.ok(first.every((item) => SHAPE_QUICK_DIRECTIONS[item.directionId]));
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first[0]));
  assert.deepEqual(song, { meta: { scoreDetails: { subscores: { groove: 74, hook: 92, arrangement: 88 } } } });
  assert.equal(first[0].directionId, rankShapeSuggestions(input)[0].directionId);
});

test("Inspector labels section-role ideas as suggestions when no critic is available", () => {
  const ideas = songInspectorSuggestions({ song: {}, section: { name: "Outro" }, target: "section" });
  assert.equal(ideas[0].directionId, "calmDown");
  assert.equal(ideas[0].evidence, "SECTION ROLE");
  assert.match(ideas[0].explanation, /ending/i);
  assert.ok(ideas.every((entry) => entry.evidence !== "LOWEST SCORED DIMENSION"));
  assert.ok(ideas.every((entry) => entry.action.startsWith("Preview ")));
});

test("Inspector keeps a bounded display, including empty limit", () => {
  const selection = { song: {}, section: { name: "Chorus" }, target: "notes" };
  assert.equal(songInspectorSuggestions({ ...selection, limit: 0 }).length, 0);
  assert.equal(songInspectorSuggestions({ ...selection, limit: 99 }).length, 3);
  assert.ok(songInspectorSuggestions(selection).length <= 2);
});

test("Inspector lives inside Shape and routes actions through the existing Before/After candidate boundary", () => {
  const html = source("index.html");
  const app = source("src/app.js");
  const css = source("src/ui/shape-director.css");
  const inspectorStart = html.indexOf('id="shapeInspector"');
  assert.ok(inspectorStart > html.indexOf('id="shapeDirectorPanel"'));
  assert.ok(inspectorStart < html.indexOf('id="shapeDirectorDirections"'));
  assert.match(html, /id="shapeInspectorInsights" role="list"/);
  assert.match(html, /Nothing changes until you accept a preview/);
  assert.match(app, /songInspectorSuggestions\(\{/);
  assert.match(app, /button\.dataset\.shapeDirection = idea\.directionId/);
  assert.match(app, /button\.disabled = blocked/);
  assert.match(app, /inspector\.replaceChildren\(\.\.\.cards\)/);
  assert.match(app, /const direction = event\.target\.closest\?\.\("\[data-shape-direction\]"\)\?\.dataset\.shapeDirection;[\s\S]*?prepareShapeDirectorCandidate\(direction\)/);
  assert.match(app, /createShapeCandidate\(state\.song, intent/);
  assert.match(app, /if \(event\.target\.closest\?\.\("\[data-shape-accept\]"\)\)/);
  assert.match(css, /\.shape-inspector-card button\{min-height:44px/);
  assert.match(css, /@media\(max-width:650px\)/);
  assert.match(css, /@media\(forced-colors:active\)/);
});
