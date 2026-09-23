import assert from "node:assert/strict";
import test from "node:test";

import { resolveAutoScale } from "../src/core/scale-intent.js";
import { normalizeConfig } from "../src/music-engine.js";

test("Auto scale is deterministic and responds to musical intent", () => {
  const bright = resolveAutoScale({
    candidates: ["major", "minor"], seed: "scale-intent-bright", genre: "pop", chordPath: "pop",
    energy: 0.86, complexity: 0.18, surprise: 0.08, mood: "intense",
  });
  const dark = resolveAutoScale({
    candidates: ["major", "minor"], seed: "scale-intent-dark", genre: "hipHop", chordPath: "soul",
    energy: 0.28, complexity: 0.72, surprise: 0.62, mood: "calm",
  });
  assert.equal(bright, "major");
  assert.equal(dark, "minor");
  assert.equal(resolveAutoScale({
    candidates: ["major", "minor"], seed: "scale-intent-bright", genre: "pop", chordPath: "pop",
    energy: 0.86, complexity: 0.18, surprise: 0.08, mood: "intense",
  }), bright);
});


test("Auto scale rotates fairly across equally valid genre scales without Mixolydian dominance", () => {
  const pools = [
    { genre: "pop", chordPath: "pop", candidates: ["major", "minor", "mixolydian", "dorian"] },
    { genre: "rock", chordPath: "rock", candidates: ["minorPentatonic", "mixolydian", "major", "minor"] },
    { genre: "country", chordPath: "country", candidates: ["major", "mixolydian", "majorPentatonic", "minorPentatonic"] },
  ];

  for (const pool of pools) {
    const counts = new Map(pool.candidates.map((scale) => [scale, 0]));
    for (let index = 0; index < 512; index += 1) {
      const scale = resolveAutoScale({
        ...pool,
        seed: `balanced-scale-${pool.genre}-${index}`,
        energy: 0.7,
        complexity: 0.58,
        surprise: 0.28,
        mood: "neutral",
      });
      counts.set(scale, counts.get(scale) + 1);
    }

    for (const scale of pool.candidates) {
      const share = counts.get(scale) / 512;
      assert.ok(share >= 0.12, `${pool.genre} ${scale} should remain represented, got ${share}`);
      assert.ok(share <= 0.4, `${pool.genre} ${scale} should not dominate Auto scale, got ${share}`);
    }
  }
});

test("Auto scale probability is independent of preferred-scale list order", () => {
  const candidates = ["major", "minor", "mixolydian", "dorian"];
  for (let index = 0; index < 64; index += 1) {
    const input = {
      seed: `scale-order-${index}`,
      genre: "pop",
      chordPath: "pop",
      energy: 0.7,
      complexity: 0.58,
      surprise: 0.28,
      mood: "neutral",
    };
    assert.equal(
      resolveAutoScale({ ...input, candidates }),
      resolveAutoScale({ ...input, candidates: [...candidates].reverse() }),
    );
  }
});

test("Explicit scale remains authoritative while Auto uses the intent resolver", () => {
  const explicit = normalizeConfig({ seed: "scale-intent-explicit", genre: "hipHop", mode: "dorian", scaleSelection: "explicit" });
  const automatic = normalizeConfig({
    seed: "scale-intent-explicit", genre: "hipHop", mode: "auto", scaleSelection: "auto",
    energy: 0.72, complexity: 0.64, surprise: 0.4,
  });
  assert.equal(explicit.scale, "dorian");
  assert.equal(explicit.scaleSelection, "explicit");
  assert.equal(automatic.scaleSelection, "auto");
  assert.ok(automatic.scaleIntervals.length > 0);
});
