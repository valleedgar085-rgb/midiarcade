import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  GENRE_MELODY_GRAMMARS,
  GENRE_PROFILES,
  generateNew,
  genreMicroTimingOffset,
} from "../src/music-engine.js";

const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("Hip-Hop pocket locks the fuller backbeat-first calibration from listener feedback", () => {
  const profile = GENRE_PROFILES.hipHop;
  assert.equal(profile.swing, 0.22);
  assert.equal(profile.humanize, 0.32);
  assert.equal(profile.syncopation, 0.6);
  assert.equal(profile.tripletChance, 0.38);
  assert.equal(profile.snareRollChance, 0.24);
  assert.equal(profile.arrangement.fillFrequency, 0.4);
  assert.ok(profile.grooveWeights.drumGroove.backbeat > profile.grooveWeights.drumGroove.halfTime * 3);
  assert.deepEqual(GENRE_MELODY_GRAMMARS.hipHop.phraseShapes, ["sparseEcho"]);
  assert.equal(GENRE_MELODY_GRAMMARS.hipHop.restBias, 0.2);
  assert.equal(GENRE_MELODY_GRAMMARS.hipHop.durationScale, 1.12);
  assert.ok(GENRE_MELODY_GRAMMARS.hipHop.leapChance <= 0.05);
});

test("Hip-Hop rhythm lanes stay on the authored grid", () => {
  assert.equal(genreMicroTimingOffset({ genre: "hipHop", trackId: "bass", start: 1 }), 0);
  assert.equal(genreMicroTimingOffset({ genre: "hipHop", trackId: "drums", pitch: 36, start: 1 }), 0);
  assert.equal(genreMicroTimingOffset({ genre: "hipHop", trackId: "drums", pitch: 38, start: 1 }), 0);
  assert.equal(genreMicroTimingOffset({ genre: "hipHop", trackId: "drums", pitch: 42, start: 1 }), 0);
  assert.equal(genreMicroTimingOffset({ genre: "hipHop", trackId: "drums", pitch: 42, start: 1.25 }), 0);
  assert.ok(genreMicroTimingOffset({ genre: "hipHop", trackId: "melody", start: 2 }) > 0);
  assert.ok(genreMicroTimingOffset({ genre: "hipHop", trackId: "counterpoint", start: 2 }) < 0);
  assert.equal(genreMicroTimingOffset({ genre: "hipHop", trackId: "drums", pitch: 38, start: 1, exactSubdivision: true }), 0);
});

test("Pop keeps the hook forward and supporting lanes slightly behind", () => {
  const grammar = GENRE_MELODY_GRAMMARS.pop;
  assert.deepEqual(grammar.phraseShapes, ["questionAnswer", "syncopatedLoop"]);
  assert.deepEqual(grammar.contours, ["arch", "climbFall"]);
  assert.ok(grammar.leapChance < 0.24);
  assert.ok(genreMicroTimingOffset({ genre: "pop", trackId: "melody", start: 2 }) < 0);
  assert.ok(genreMicroTimingOffset({ genre: "pop", trackId: "counterpoint", start: 2 }) > 0);
  assert.ok(genreMicroTimingOffset({ genre: "pop", trackId: "drums", pitch: 38, start: 2 }) > 0);
});

test("fixed-seed Hip-Hop and Pop generation remain deterministic after pocket changes", () => {
  for (const genre of ["hipHop", "pop"]) {
    const config = { genre, seed: `pocket-pass-${genre}`, bars: 16, professionalUpgrade: true };
    assert.deepEqual(generateNew(config), generateNew(config));
  }
});

test("Shape shows three recommendations first and progressively discloses the rest", () => {
  assert.match(html, /Pick what feels better/);
  assert.match(html, /WHAT TO CHANGE/);
  assert.match(html, /HOW MUCH/);
  assert.match(html, /Small · polish[\s\S]*?Medium · reshape[\s\S]*?Big · transform/);
  assert.match(app, /data-shape-more/);
  assert.match(app, /button\.hidden = panel\.dataset\.shapeMore !== "true"/);
  assert.match(app, /Tap one of the three suggested moves to preview it/);
  assert.match(app, /More directions/);
  assert.match(app, /Fewer directions/);
});


test("fusion and protected cadence landings bypass the standalone pocket nudge", () => {
  const source = fs.readFileSync(new URL("../src/music-engine.js", import.meta.url), "utf8");
  assert.match(source, /const protectedLanding = Boolean\(note\.resolutionRole \|\| note\.ensembleCadenceRole \|\| note\.transitionHandoffRole\)/);
  assert.match(source, /const microOffset = config\.secondaryGenre \|\| protectedLanding\s*\? 0/);
});
