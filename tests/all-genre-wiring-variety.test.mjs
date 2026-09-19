import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  GENRE_PROFILES,
  evaluateSongReleaseGate,
  generateNew,
  normalizeConfig,
} from "../src/music-engine.js";
import { generationCharacter } from "../src/core/adaptive-generation.js";
import {
  fusedGenreArrangementProfile,
  genreArrangementProfile,
} from "../src/core/genre-arrangement-profile.js";
import { outputQualityDevelopment } from "../src/core/output-quality-evolution.js";
import { roleRegisterWindow } from "../src/core/role-register-policy.js";

const GENRES = Object.keys(GENRE_PROFILES).sort();

function selectValues(html, id) {
  const start = html.indexOf(`id="${id}"`);
  assert.ok(start >= 0, `missing #${id}`);
  const open = html.lastIndexOf("<select", start);
  const close = html.indexOf("</select>", start);
  assert.ok(open >= 0 && close > start, `invalid #${id} select`);
  return [...html.slice(open, close).matchAll(/<option\s+value="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => value !== "none")
    .sort();
}

function songFingerprint(song) {
  return song.tracks.map((track) => (
    `${track.id}:${track.notes.map((note) => `${note.pitch}@${Number(note.start).toFixed(3)}:${Number(note.duration).toFixed(3)}:${note.velocity}`).join("|")}`
  )).join(";");
}

test("every engine genre is wired into both Create genre selectors and every professional steering layer", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.deepEqual(selectValues(html, "genreControl"), GENRES);
  assert.deepEqual(selectValues(html, "secondaryGenreControl"), GENRES);

  for (const genre of GENRES) {
    const profile = genreArrangementProfile(genre);
    assert.ok(profile.id, `${genre} must resolve an arrangement profile`);
    assert.ok(profile.phraseBars.length > 0, `${genre} must expose phrase lengths`);
    assert.ok(profile.rhythmTemplates.length > 0, `${genre} must expose rhythm templates`);
    assert.ok(profile.harmonicGoals.length > 0, `${genre} must expose harmonic goals`);
    assert.ok(profile.optionalLayers.length > 0, `${genre} must expose optional arrangement layers`);

    const character = generationCharacter(genre);
    const development = outputQualityDevelopment(genre);
    for (const [key, value] of Object.entries(character)) {
      assert.ok(Number.isFinite(Number(value)), `${genre} adaptive character ${key} must be finite`);
    }
    for (const [key, value] of Object.entries(development)) {
      assert.ok(Number.isFinite(Number(value)), `${genre} quality development ${key} must be finite`);
    }

    const normalized = normalizeConfig({
      genre,
      seed: `genre-wiring-${genre}`,
      professionalUpgrade: true,
    });
    assert.equal(normalized.genre, genre);
    assert.equal(normalized.professionalUpgrade, true);
    assert.equal(normalized.arrangementProfileId, profile.id);
    assert.equal(normalized.arrangementLayers.enabled, true);
  }
});

test("every ordered two-genre fusion blends arrangement grammar instead of silently using only the primary style", () => {
  for (const primary of GENRES) {
    for (const secondary of GENRES) {
      if (primary === secondary) continue;
      const fused = fusedGenreArrangementProfile(primary, secondary, 0.5);
      const normalized = normalizeConfig({
        genre: primary,
        secondaryGenre: secondary,
        fusionBlend: 0.5,
        professionalUpgrade: true,
        seed: `fusion-wiring-${primary}-${secondary}`,
      });

      assert.equal(normalized.isFusion, true);
      assert.equal(normalized.secondaryGenre, secondary);
      assert.equal(normalized.arrangementProfileId, fused.id);
      assert.match(fused.id, /^fusion:/);
      assert.ok(fused.phraseBars.length > 0);
      assert.ok(fused.rhythmTemplates.length > 0);
      assert.ok(fused.harmonicGoals.length > 0);
      assert.ok(fused.optionalLayers.length > 0);
      assert.ok(fused.rhythmTemplates.some((entry) => entry.weight > 0));
      assert.ok(fused.harmonicGoals.some((entry) => entry.weight > 0));
    }
  }
});

test("all genres remain release-safe while different seeds produce different full arrangements", { timeout: 120_000 }, () => {
  for (const genre of GENRES) {
    const songs = [
      generateNew({
        genre,
        seed: `genre-variety-${genre}-a`,
        bars: 16,
        energy: 0.38,
        complexity: 0.46,
        variation: 0.42,
        professionalUpgrade: true,
      }),
      generateNew({
        genre,
        seed: `genre-variety-${genre}-b`,
        bars: 16,
        energy: 0.82,
        complexity: 0.76,
        variation: 0.88,
        professionalUpgrade: true,
      }),
    ];

    for (const song of songs) {
      const gate = evaluateSongReleaseGate(song);
      assert.equal(gate.passed, true, `${genre} must pass the release gate: ${gate.failures?.join(", ") ?? "unknown"}`);
      assert.equal(song.meta?.scoreDetails?.releaseGate?.passed, true, `${genre} selected song must carry a passing release gate`);
      assert.ok(song.finalMaster && Object.values(song.finalMaster.checks ?? {}).every(Boolean), `${genre} must pass final-master checks`);
      assert.ok(song.finalAssembly && Object.values(song.finalAssembly.checks ?? {}).every(Boolean), `${genre} must pass final-assembly checks`);
      assert.equal(song.registerIntegrity?.after?.hardViolations, 0, `${genre} must finish with no hard role-register violations`);
      for (const track of song.tracks) {
        const window = roleRegisterWindow(track.id);
        if (!window) continue;
        for (const note of track.notes ?? []) {
          assert.ok(
            note.pitch >= window.min && note.pitch <= window.max,
            `${genre}/${track.id} pitch ${note.pitch} escaped professional register ${window.min}-${window.max}`,
          );
        }
      }
    }

    assert.notEqual(
      songFingerprint(songs[0]),
      songFingerprint(songs[1]),
      `${genre} must produce a different complete arrangement for a different seed and musical direction`,
    );
  }
});

test("cross-family fusion examples stay professional after arrangement-grammar blending", { timeout: 120_000 }, () => {
  const pairs = [
    ["pop", "hipHop"],
    ["house", "jazz"],
    ["trap", "ambient"],
    ["neoSoul", "afrobeats"],
    ["country", "synthwave"],
  ];

  for (const [genre, secondaryGenre] of pairs) {
    const song = generateNew({
      genre,
      secondaryGenre,
      fusionBlend: 0.5,
      seed: `fusion-quality-${genre}-${secondaryGenre}`,
      bars: 16,
      energy: 0.68,
      complexity: 0.64,
      variation: 0.78,
      professionalUpgrade: true,
    });
    const gate = evaluateSongReleaseGate(song);
    assert.equal(gate.passed, true, `${genre} + ${secondaryGenre} must pass release gate: ${gate.failures?.join(", ") ?? "unknown"}`);
  }
});
