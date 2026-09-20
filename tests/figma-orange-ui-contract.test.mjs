import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const styles = fs.readFileSync(new URL("../src/ui/orange-studio.css", import.meta.url), "utf8");
const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("orange mobile Now Playing keeps generated song data visible", () => {
  assert.match(styles, /\.showcase-copy \.title-row\{display:flex/);
  assert.match(styles, /\.showcase-copy \.song-facts\{display:flex/);
  assert.match(styles, /\.showcase-copy \.showcase-actions\{display:grid/);
  assert.doesNotMatch(styles, /content:'Midnight Polaroid'/);
  assert.doesNotMatch(styles, /content:'Seed generated multitrack/);
  assert.doesNotMatch(styles, /\.showcase-art \+ \.showcase-copy\{display:contents\}/);
});

test("Termux dev server uses portable http.server bind arguments", () => {
  assert.equal(
    packageJson.scripts.dev,
    "npm run build && python -m http.server 4173 -d www -b 0.0.0.0",
  );
});
