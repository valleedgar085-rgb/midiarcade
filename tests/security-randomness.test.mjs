import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("src/app.js and src/music-engine.js do not contain Math.random()", () => {
  const appSource = fs.readFileSync("src/app.js", "utf8");
  const engineSource = fs.readFileSync("src/music-engine.js", "utf8");

  assert.doesNotMatch(appSource, /Math\.random/);
  assert.doesNotMatch(engineSource, /Math\.random/);
});
