import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("Mix makes persistent Solo state unmistakable and offers one-tap recovery", () => {
  assert.match(html, /id="mixSoloAlert"/);
  assert.match(html, /id="mixSoloAlertText"/);
  assert.match(html, /id="clearSoloButton"/);
  assert.match(html, />Hear full band</);
  assert.match(css, /\.mix-solo-alert/);
  assert.match(css, /#tab-btn-mix\.has-solo::after/);
});

test("mute and solo changes immediately refresh Mix status instead of hiding state", () => {
  assert.match(app, /if \(action === "mute"\)[\s\S]*?renderMixOverview\(\);/);
  assert.match(app, /if \(action === "solo"\)[\s\S]*?renderMixOverview\(\);/);
  assert.match(app, /mixTab\?\.classList\.toggle\("has-solo", soloIds\.length > 0\)/);
  assert.match(app, /Solo active:[\s\S]*?Hear full band in Mix/);
});

test("restored sessions announce a still-active Solo instead of silently filtering the band", () => {
  assert.match(app, /else if \(restored && state\.solo\.size\)/);
  assert.match(app, /Your last song was restored\. Solo is still active on/);
  assert.match(app, /\$\("#clearSoloButton"\)\?\.addEventListener/);
  assert.match(app, /state\.solo\.clear\(\)/);
  assert.match(app, /Full-band playback is restored/);
});
