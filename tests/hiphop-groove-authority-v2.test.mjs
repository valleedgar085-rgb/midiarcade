import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import { createGrooveDNA, grooveDNAConductorLanes } from "../src/core/groove-intelligence.js";
import { generateNew } from "../src/music-engine.js";

const structure = [
  { id: "verse-1", name: "verse", startBar: 0, bars: 8 },
];

test("Hip-Hop Groove DNA authors a deliberate repeating four-bar pocket phrase", () => {
  const dna = createGrooveDNA({
    seed: "hiphop-pocket-steroids",
    genre: "hipHop",
    bars: 8,
    beatsPerBar: 4,
    complexity: 0.72,
    variation: 0.92,
  }, { structure });

  const baseKicks = dna.bars.map((bar) => bar.kick.baseSteps);
  assert.notDeepEqual(baseKicks[0], baseKicks[1]);
  assert.notDeepEqual(baseKicks[1], baseKicks[2]);
  assert.deepEqual(baseKicks[0], baseKicks[4]);
  assert.deepEqual(baseKicks[1], baseKicks[5]);
  assert.deepEqual(baseKicks[2], baseKicks[6]);
  assert.deepEqual(baseKicks[3], baseKicks[7]);

  for (const bar of dna.bars) {
    assert.deepEqual(bar.snare.requiredSteps, [4, 12]);
    assert.ok(bar.kick.steps.includes(0), "Hip-Hop must keep beat-one grounding");
    assert.equal(bar.kick.steps.includes(5), false);
    assert.equal(bar.kick.steps.includes(13), false);
  }

  assert.equal(dna.relationships.bass.mode, "lock-and-answer");
  assert.equal(dna.relationships.bass.answerDelayBeats, 0.5);
  assert.ok(dna.relationships.bass.lock < 0.7);
});

test("Hip-Hop bass relationship is authored by Groove DNA rather than kick cloning", () => {
  const dna = createGrooveDNA({
    seed: "hiphop-bass-conversation",
    genre: "hipHop",
    bars: 4,
    beatsPerBar: 4,
    complexity: 0.72,
    variation: 0.7,
  }, { structure: [{ id: "verse", name: "verse", startBar: 0, bars: 4 }] });

  let independentBars = 0;
  for (let bar = 0; bar < 4; bar += 1) {
    const lanes = grooveDNAConductorLanes(dna, bar);
    const kick = new Set(lanes.anchors.map((beat) => beat.toFixed(3)));
    if (lanes.bassPulses.some((beat) => !kick.has(beat.toFixed(3)))) independentBars += 1;
    assert.ok(lanes.bassPulses.length <= 3, "body Hip-Hop bass should stay conversational, not machine-gun dense");
    assert.ok(lanes.chordPulses.length <= 2, "body Hip-Hop chords should leave vocal and drum space");
  }
  assert.ok(independentBars >= 1, "at least one bar should contain a bass reply rather than pure kick cloning");
});

test("generated Hip-Hop does not let optional arrangement layers write extra drums", { timeout: 120_000 }, () => {
  const song = generateNew({
    seed: "hiphop-no-arrangement-drum-writer",
    genre: "hipHop",
    bars: 8,
    candidateCount: 1,
    arrangementLayers: { enabled: true, density: 1, mode: "auto" },
    energy: 0.82,
    complexity: 0.76,
    variation: 0.7,
  });
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  assert.equal(
    drums.some((note) => note.arrangementLayer),
    false,
    "optional arrangement layers must not compete with Groove DNA for Hip-Hop drums",
  );
});

test("Hip-Hop engine source does not reintroduce post-DNA rhythm writers", () => {
  const source = fs.readFileSync(new URL("../src/music-engine.js", import.meta.url), "utf8");
  assert.match(source, /\["hipHop", "rap"\]\.includes\(config\.genre\) && layer\.trackId === "drums"/);
  assert.match(source, /if \(hipHopPocket\) continue;/);
  assert.match(source, /!\(grooveConductor && \["hipHop", "rap"\]\.includes\(config\.genre\)\)/);
  assert.match(source, /DRUM_FILL_VOCABULARIES\.hipHop/);
  assert.match(
    source,
    /preDropPunctuation:\s*true,[\s\S]{0,120}transitionFeature:/,
    "DNA-safe Hip-Hop transition punctuation must keep blueprint provenance",
  );
});
