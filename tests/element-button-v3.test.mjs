import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/ui/element-button-v3.js", import.meta.url), "utf8");
const progress = fs.readFileSync(new URL("../src/ui/generation-progress.js", import.meta.url), "utf8");

test("Electric uses a yellow-gold identity that stays distinct from blue Drip", () => {
  assert.match(source, /button\[data-element="electric"\][\s\S]*?--element-rgb:255,216,67/);
  assert.match(source, /button\[data-element="electric"\][\s\S]*?color:#ffdc43/);
  assert.match(source, /button\[data-element="drip"\][\s\S]*?--element-rgb:75,184,255/);
  assert.doesNotMatch(source, /button\[data-element="electric"\][\s\S]{0,300}?--element-rgb:75,184,255/);
});

test("element buttons expose premium interaction states for mouse, touch, and keyboard", () => {
  assert.match(source, /button:hover[\s\S]*?translateY\(-3px\)/);
  assert.match(source, /button:active[\s\S]*?scale\(\.985\)/);
  assert.match(source, /button:focus-visible[\s\S]*?outline:2px solid/);
  assert.match(source, /button\.is-active[\s\S]*?scale\(1\.012\)/);
});

test("Create V2 visually separates direction, generation and Element selection", () => {
  assert.match(source, /Create V2: clearer direction -> generate -> choose personality hierarchy/);
  assert.match(source, /#preGenSection::before[\s\S]*?#9d6fff[\s\S]*?#22d3ee/);
  assert.match(source, /#preGenSection \.generation-new[\s\S]*?rgba\(124,58,237,\.3\)/);
  assert.match(source, /#preGenSection \.generation-similar[\s\S]*?rgba\(34,211,238,\.075\)/);
  assert.match(source, /song-variation-options button:nth-child\(1\)[\s\S]*?255,105,58/);
  assert.match(source, /song-variation-options button:nth-child\(2\)[\s\S]*?255,216,67/);
  assert.match(source, /song-variation-options button:nth-child\(3\)[\s\S]*?75,184,255/);
});

test("Create V2 keeps phone Element choices large and reduced-motion safe", () => {
  assert.match(source, /@media \(max-width:600px\)[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(source, /@media \(max-width:600px\)[\s\S]*?min-height:92px/);
  assert.match(source, /@media \(prefers-reduced-motion:reduce\)/);
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
