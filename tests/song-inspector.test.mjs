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
  const expanded = songInspectorSuggestions({ ...selection, limit: 99 });
  assert.ok(expanded.length >= 1 && expanded.length <= 3, "only supported non-fallback ideas may be shown");
  assert.ok(expanded.every((idea) => idea.evidence !== "FALLBACK"));
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
  assert.match(html, /Preview first\. Save to keep it\./);
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


function returningChorusFixture({ weak = true } = {}) {
  const firstPitches = [60, 62, 65, 64, 67, 65, 69, 67];
  const weakPitches = [72, 59, 73, 60, 75, 58, 70, 61];
  const sourceOffsets = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5];
  const returnOffsets = weak
    ? [0.25, 0.75, 2.25, 2.5, 3.75, 5.25, 6.25, 7.25]
    : sourceOffsets;
  const notes = [
    ...sourceOffsets.map((offset, i) => ({
      start: offset, pitch: firstPitches[i], duration: 0.35, velocity: 84,
    })),
    ...returnOffsets.map((offset, i) => ({
      start: 16 + offset, pitch: weak ? weakPitches[i] : firstPitches[i] + 2,
      duration: 0.35, velocity: 84,
    })),
  ];
  return {
    genre: "pop",
    meta: { beatsPerBar: 4 },
    structure: [
      { id: "chorus-1", name: "Chorus", startBeat: 0, endBeat: 8 },
      { id: "verse-1", name: "Verse", startBeat: 8, endBeat: 16 },
      { id: "chorus-2", name: "Chorus", startBeat: 16, endBeat: 24 },
    ],
    tracks: [{ id: "melody", notes }],
  };
}

test("Song Inspector prioritizes the measured chorus-hook gap without touching the song", () => {
  const song = returningChorusFixture();
  const before = structuredClone(song);
  const selection = { song, section: song.structure[2], target: "track", trackId: "melody" };
  const ideas = songInspectorSuggestions(selection);
  assert.equal(ideas[0].directionId, "catchier");
  assert.equal(ideas[0].evidence, "CHORUS HOOK RETURN");
  assert.match(ideas[0].explanation, /opening-hook similarity.*shared note attacks/i);
  assert.equal(ideas[0].action, "Preview Catchier");
  assert.equal(ideas.filter((idea) => idea.directionId === "catchier").length, 1);
  assert.ok(ideas.length <= 2);
  assert.ok(Object.isFrozen(ideas));
  assert.ok(Object.isFrozen(ideas[0]));
  assert.deepEqual(songInspectorSuggestions(selection), ideas);
  assert.deepEqual(song, before, "read-only Inspector must preserve MIDI data");
});

test("Song Inspector does not mislabel a first chorus, verse, or strong return", () => {
  const weak = returningChorusFixture();
  const first = songInspectorSuggestions({ song: weak, section: weak.structure[0] });
  const verse = songInspectorSuggestions({ song: weak, section: weak.structure[1] });
  assert.ok(first.every((idea) => idea.evidence !== "CHORUS HOOK RETURN"));
  assert.ok(verse.every((idea) => idea.evidence !== "CHORUS HOOK RETURN"));
  assert.deepEqual(
    songInspectorSuggestions({ song: weak, section: weak.structure[2], limit: 0 }), [],
  );

  const recognizable = returningChorusFixture({ weak: false });
  const good = songInspectorSuggestions({ song: recognizable, section: recognizable.structure[2] });
  assert.ok(good.every((idea) => idea.evidence !== "CHORUS HOOK RETURN"));
  assert.ok(good.every((idea) => SHAPE_QUICK_DIRECTIONS[idea.directionId]));
});

test("Song Inspector ignores unavailable hook evidence instead of claiming weakness", () => {
  const song = returningChorusFixture();
  song.tracks = [];
  const ideas = songInspectorSuggestions({ song, section: song.structure[2] });
  assert.ok(ideas.every((idea) => idea.evidence !== "CHORUS HOOK RETURN"));
});

test("Song Inspector scopes hook guidance to melody or the complete section", () => {
  const song = returningChorusFixture();
  const chorus = song.structure[2];
  const bass = songInspectorSuggestions({ song, section: chorus, target: "track", trackId: "bass" });
  const drums = songInspectorSuggestions({ song, section: chorus, target: "notes", trackId: "drums" });
  const songSection = songInspectorSuggestions({ song, section: chorus, target: "section" });
  assert.ok(bass.every((idea) => idea.evidence !== "CHORUS HOOK RETURN"));
  assert.ok(drums.every((idea) => idea.evidence !== "CHORUS HOOK RETURN"));
  assert.equal(songSection[0].evidence, "CHORUS HOOK RETURN");
});

test("Inspector receives the actual selected track instead of guessing an instrument", () => {
  const app = source("src/app.js");
  assert.match(app, /songInspectorSuggestions\(\{[\s\S]*?target: director\.target,\s*trackId: state\.editorTrack,/);
});
