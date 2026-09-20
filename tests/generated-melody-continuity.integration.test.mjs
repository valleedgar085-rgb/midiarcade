import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "../src/music-engine.js";
import { analyzeMelodyContinuity } from "../src/core/melody-continuity-refinement.js";
import { applyResultOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

const GENRES = ["trap", "hipHop", "pop", "neoSoul"];
const BAR_COUNTS = [16, 24, 32, 48, 64];

function melodyFingerprint(song) {
  return JSON.stringify(
    (song.tracks ?? [])
      .find((track) => track.id === "melody")?.notes
      ?.map((note) => [note.pitch, note.start, note.duration, note.velocity, note.continuityRole ?? ""])
      ?? [],
  );
}

test("generated active verse and chorus melodies have no actionable interior silence gaps", { timeout: 120_000 }, () => {
  const failures = [];

  for (const genre of GENRES) {
    for (const bars of BAR_COUNTS) {
      const options = {
        seed: `track-b-real-song-${genre}-${bars}`,
        genre,
        key: "A",
        scale: "minor",
        bars,
        energy: 0.68,
        complexity: 0.72,
        variation: 0.74,
        swing: 0.16,
        humanize: 0.12,
      };
      const composed = engine.generateNew(options);
      const repeatedComposed = engine.generateNew(options);
      const result = applyResultOutputQualityPipeline({ song: composed }, {
        melodyContinuityRefinement: true,
      });
      const repeatedResult = applyResultOutputQualityPipeline({ song: repeatedComposed }, {
        melodyContinuityRefinement: true,
      });
      const song = result.song;
      const repeated = repeatedResult.song;
      assert.equal(melodyFingerprint(song), melodyFingerprint(repeated), `${genre}/${bars}: melody generation is not deterministic`);

      const analysis = analyzeMelodyContinuity(song);
      const activeSections = analysis.sections.filter((section) => (
        /^(verse|chorus)/.test(section.name) && section.attacksPerBar > 0
      ));
      if (!activeSections.length) {
        failures.push(`${genre}/${bars}: no active verse/chorus melody section was generated`);
        continue;
      }
      const actionable = activeSections.filter((section) => section.actionable);
      if (actionable.length) {
        failures.push(`${genre}/${bars}: actionable gaps in ${actionable.map((section) => section.id).join(", ")}`);
      }
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});
