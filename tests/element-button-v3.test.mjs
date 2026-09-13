import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/ui/element-button-v3.js", import.meta.url), "utf8");
const progress = fs.readFileSync(new URL("../src/ui/generation-progress.js", import.meta.url), "utf8");

test("Electric uses a yellow-gold identity that stays distinct from blue Drip", () => {
  assert.match(source, /button\[data-element="electric"\][\s\S]*?--element-rgb:255,216,67/);
  assert.match(source, /button\[data-element="electric"\][\s\S]*?color:#ffdc43/);
  assert.match(source, /button\[data-element="drip"\][\s\S]*?--element-rgb:75,184,255/);
  assert.doesNotMatch(source, /button\[data-element="electric"\][\s\S]{0,260}?--element-rgb:75,184,255/);
});

test("element buttons expose premium interaction states for mouse, touch, and keyboard", () => {
  assert.match(source, /button:hover[\s\S]*?translateY\(-3px\)/);
  assert.match(source, /button:active[\s\S]*?scale\(\.985\)/);
  assert.match(source, /button:focus-visible[\s\S]*?outline:2px solid/);
  assert.match(source, /button\.is-active[\s\S]*?scale\(1\.012\)/);
});

test("element button presentation is loaded through the existing generation UI entry point", () => {
  assert.match(progress, /import "\.\/element-button-v3\.js";/);
});

test("element button module remains import-safe without browser globals", async () => {
  const previousDocument = globalThis.document;
  try {
    delete globalThis.document;
    const module = await import(`../src/ui/element-button-v3.js?importSafe=${Date.now()}`);
    assert.equal(typeof module.applyElementButtonV3, "function");
    assert.equal(module.applyElementButtonV3(undefined), false);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
