import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const brandCss = fs.readFileSync(new URL("../src/ui/creator-brand.css", import.meta.url), "utf8");
const buildSource = fs.readFileSync(new URL("../scripts/build.js", import.meta.url), "utf8");

test("creator identity remains visible and receives a dedicated branded card", () => {
  assert.match(html, /Created by Edgar Valle/);
  assert.match(brandCss, /\.menu-dropdown\s*>\s*\.menu-item:last-child/);
  assert.match(brandCss, /ORIGINAL CREATOR/);
  assert.match(brandCss, /var\(--accent\)/);
});

test("creator menu styling is included in both web and Android build output", () => {
  assert.match(buildSource, /creator-brand\.css/);
  assert.match(buildSource, /androidPublicDir/);
  assert.match(buildSource, /copyRecursiveSync\(path\.join\(wwwDir, 'styles\.css'\)/);
});

test("creator menu polish includes mobile and reduced-motion safeguards", () => {
  assert.match(brandCss, /@media\(max-width:600px\)/);
  assert.match(brandCss, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(brandCss, /max-width:min\(92vw,340px\)/);
});
