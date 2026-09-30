import assert from "node:assert/strict";
import test from "node:test";
import { resolveSectionPacing } from "../src/core/section-pacing.js";
import { generateNew, generateSimilar, normalizeConfig, producerRoleGateWindow, evaluateSongReleaseGate } from "../src/music-engine.js";
import { createGenerationExecutor } from "../src/core/generation-executor.js";

test("Roomier expands the total once and preserves exact short loops and the 128-bar ceiling", () => {
  for (const [base, total] of [[4, 4], [16, 24], [24, 36], [32, 44], [48, 68], [64, 88], [128, 128]]) {
    const paced = normalizeConfig({ bars: base, sectionPacing: "roomier" });
    assert.equal(paced.bars, total);
    assert.equal(paced.pacingBaseBars, base);
    assert.equal(normalizeConfig(paced).bars, total, "normalization must not extend an already expanded song again");
    assert.equal(resolveSectionPacing({ bars: base, sectionPacing: "standard" }).bars, base);
  }
});

test("Roomier grows the intro most and gives every other section more time without adding transitions", () => {
  for (const [genre, secondaryGenre] of [["pop", "techno"], ["pop", null], ["hipHop", null], ["techno", null]]) {
    const input = { seed: "pacing-pop-proof", genre, secondaryGenre, bars: 32, professionalUpgrade: true, candidateCount: 1, targetedRepair: false };
    const standard = generateNew(input);
    const paced = generateNew({ ...input, sectionPacing: "roomier" });
    assert.deepEqual(paced.structure.map((s) => s.id), standard.structure.map((s) => s.id));
    const growth = paced.structure.map((s, index) => s.bars - standard.structure[index].bars);
    assert.ok(growth.every((bars) => bars > 0), `${genre}: every section should be longer`);
    assert.ok(growth[0] > Math.max(...growth.slice(1)), `${genre}: prioritize the intro`);
    assert.equal(paced.structure.reduce((sum, s) => sum + s.bars, 0), 44);
    assert.equal(paced.meta.bars, 44);
    assert.equal(paced.structure.at(-1).endBeat, 44 * paced.meta.beatsPerBar);
    assert.deepEqual(generateNew({ ...input, sectionPacing: "roomier" }), paced, "pacing must be deterministic");
    assert.equal(evaluateSongReleaseGate(paced).passed, true, `${genre}: retain the release gate`);
    for (const track of paced.tracks) {
      assert.ok(track.notes.every((note) => note.start >= 0 && note.start + note.duration <= paced.structure.at(-1).endBeat + 0.01));
    }
    const firstBass = (song) => Math.min(...song.tracks.find((track) => track.id === "bass").notes.map((note) => note.start));
    assert.ok(firstBass(paced) > firstBass(standard), `${genre}: bring in the bass more gradually`);
  }
});

test("Roomier schedules supporting intro entrances over multiple bars while preserving the opening foundation", () => {
  const section = { id: "intro-1", name: "intro", startBeat: 0, endBeat: 24 };
  const structure = [section, { id: "verse-1", startBeat: 24, endBeat: 176 }];
  const config = normalizeConfig({ bars: 32, sectionPacing: "roomier", genre: "pop" });
  const scene = { purpose: "establish" };
  assert.equal(producerRoleGateWindow(section, structure, scene, "drums", "foundation", config), null);
  assert.equal(producerRoleGateWindow(section, structure, scene, "pad", "foreground", config), null);
  for (const [id, entryBeat] of [["chords", 4], ["bass", 6], ["melody", 10], ["counterpoint", 14]]) {
    assert.equal(producerRoleGateWindow(section, structure, scene, id, "support", config).entryBeat, entryBeat);
  }
});

test("committed output quality keeps the longer intro and final timeline consistent", async () => {
  const executor = createGenerationExecutor({ fallback: (_kind, payload) => ({ status: "committed", song: generateNew(payload.config) }) });
  const result = await executor.run("new", { config: {
    seed: "pacing-pop-proof", genre: "pop", secondaryGenre: "techno", bars: 32,
    sectionPacing: "roomier", professionalUpgrade: true, candidateCount: 1, targetedRepair: false,
  } });
  assert.equal(result.song.meta.bars, 44);
  assert.ok(result.song.structure[0].bars >= 6);
  assert.equal(result.song.structure.at(-1).endBeat, 176);
  assert.equal(evaluateSongReleaseGate(result.song).passed, true);
  executor.dispose();
});

test("switching an existing song to Roomier preserves its form and expands its intro", () => {
  const config = { seed: "pacing-pop-proof", genre: "pop", bars: 32, professionalUpgrade: true, candidateCount: 1, targetedRepair: false };
  const source = generateNew(config);
  const result = generateSimilar(source, { ...config, sectionPacing: "roomier" });
  assert.equal(result.meta.bars, 44);
  assert.deepEqual(result.structure.map((section) => section.name), source.structure.map((section) => section.name));
  assert.ok(result.structure[0].bars >= source.structure[0].bars + 4);
  const repeat = generateSimilar(result, { ...config, sectionPacing: "roomier" });
  assert.equal(repeat.meta.bars, 44, "related generations cannot keep increasing the length");
  assert.deepEqual(repeat.structure.map((section) => section.bars), result.structure.map((section) => section.bars));
});
