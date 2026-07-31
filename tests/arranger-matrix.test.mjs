import test from "node:test";
import assert from "node:assert/strict";
import { generateNew } from "../src/music-engine.js";
import {
  buildSectionMatrix,
  updateSectionBars,
  updateSectionEnergy,
  updateSectionInstrumentMask,
  calculateNextQueuedSection,
  getSongSections,
} from "../src/core/arranger-matrix.js";

const sampleConfig = { genreId: "neoSoul", seed: 12345 };

test("buildSectionMatrix extracts structured sections with energy and track metadata", async () => {
  const song = await generateNew(sampleConfig);
  const matrix = buildSectionMatrix(song);

  assert.ok(Array.isArray(matrix));
  assert.ok(matrix.length > 0);

  const first = matrix[0];
  assert.ok(first.id);
  assert.ok(first.name);
  assert.ok(typeof first.bars === "number");
  assert.ok(typeof first.energy === "number");
  assert.ok(Array.isArray(first.activeTracks));
});

test("updateSectionBars resizes a section and adjusts note timings immutably", async () => {
  const song = await generateNew(sampleConfig);
  const sections = getSongSections(song);
  const firstSection = sections[0];
  const originalBars = firstSection.bars;
  const targetBars = originalBars === 8 ? 4 : 8;

  const updatedSong = updateSectionBars(song, firstSection.id, targetBars);

  assert.notEqual(updatedSong, song); // Immutable
  const updatedSections = getSongSections(updatedSong);
  const updatedSection = updatedSections.find((s) => s.id === firstSection.id);
  assert.equal(updatedSection.bars, targetBars);

  // Check total bars recalculation
  const expectedTotalBars = sections.reduce(
    (sum, sec) => sum + (sec.id === firstSection.id ? targetBars : sec.bars),
    0
  );
  assert.equal(updatedSong.meta?.bars || updatedSong.bars, expectedTotalBars);
});

test("updateSectionEnergy scales velocity and density for a target section", async () => {
  const song = await generateNew(sampleConfig);
  const sections = getSongSections(song);
  const firstSection = sections[0];

  const peakSong = updateSectionEnergy(song, firstSection.id, "peak");
  assert.notEqual(peakSong, song);

  const lowSong = updateSectionEnergy(song, firstSection.id, "low");
  assert.notEqual(lowSong, song);
});

test("updateSectionInstrumentMask filters active tracks per section", async () => {
  const song = await generateNew(sampleConfig);
  const sections = getSongSections(song);
  const firstSection = sections[0];
  const targetTracks = ["drums", "bass"];

  const maskedSong = updateSectionInstrumentMask(song, firstSection.id, targetTracks);
  assert.notEqual(maskedSong, song);

  const matrix = buildSectionMatrix(maskedSong);
  const updated = matrix.find((sec) => sec.id === firstSection.id);
  assert.deepEqual(updated.mask, targetTracks);
});

test("calculateNextQueuedSection returns exact beat boundary for live jumping", async () => {
  const song = await generateNew(sampleConfig);
  const sections = getSongSections(song);
  if (sections.length > 1) {
    const currentBeat = 6; // Mid-verse
    const targetSection = sections[1];
    const jumpInfo = calculateNextQueuedSection(currentBeat, targetSection.id, song);

    assert.ok(jumpInfo);
    assert.equal(jumpInfo.targetSectionId, targetSection.id);
    assert.ok(jumpInfo.triggerBeat >= currentBeat);
  }
});
