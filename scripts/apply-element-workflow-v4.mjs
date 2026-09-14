import { readFile, writeFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function write(path, content) {
  await writeFile(new URL(`../${path}`, import.meta.url), content);
}

function replaceOnce(source, search, replacement, label) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`Patch target not found: ${label}`);
  return next;
}

let html = await read("index.html");
html = replaceOnce(
  html,
  '<span class="action-copy"><small>KEEP THE CURRENT DNA</small><strong>Create 3 variations</strong><em>Fire · Electric · Drip from one song DNA</em></span>',
  '<span class="action-copy"><small>ELEMENTAL PRODUCER</small><strong>Create all 3 Elements</strong><em>Choose Fire · Electric · Drip from one song DNA</em></span>',
  "Element generation action copy",
);
html = replaceOnce(
  html,
  '<section class="song-variation-tray" id="songVariationTray" aria-labelledby="songVariationTitle" hidden>',
  '<section class="song-variation-tray" id="songVariationTray" aria-labelledby="songVariationTitle">',
  "persistent Element tray",
);
html = replaceOnce(
  html,
  '<span><small>ELEMENTAL PRODUCER</small><strong id="songVariationTitle">Three elements, one song</strong></span>\n                <em>Same song DNA · three production personalities</em>',
  '<span><small>ELEMENTAL PRODUCER</small><strong id="songVariationTitle">Choose your production personality</strong></span>\n                <em>Generate one song, then direct it with Fire · Electric · Drip</em>',
  "Element tray heading",
);
html = html.replace('<b>🔥 Fire</b><small>Heat · impact</small>', '<b>🔥 Fire</b><small>Heat · punch · impact</small>');
html = html.replace('<b>⚡ Electric</b><small>Charge · motion</small>', '<b>⚡ Electric</b><small>Motion · spark · energy</small>');
html = html.replace('<b>💧 Drip</b><small>Flow · space</small>', '<b>💧 Drip</b><small>Flow · space · emotion</small>');
await write("index.html", html);

let app = await read("src/app.js");
app = replaceOnce(
  app,
  'import { chooseElementProgram } from "./core/elemental-program-policy.js";',
  'import { chooseElementProgram } from "./core/elemental-program-policy.js";\nimport { ELEMENT_PROFILES } from "./core/elemental-producer-system.js";\nimport { resolveSongElement } from "./core/elemental-lineage.js";',
  "Element UI imports",
);

const trayBlock = `function renderActiveElementIdentity(song = state.song) {
  const facts = $(".song-facts");
  if (!facts) return;
  let chip = $("#activeElementChip");
  if (!chip) {
    chip = document.createElement("span");
    chip.id = "activeElementChip";
    chip.className = "active-element-chip";
    facts.append(chip);
  }
  const raw = resolveSongElement(song);
  if (!raw?.id) {
    chip.hidden = true;
    chip.removeAttribute("data-element");
    document.documentElement?.removeAttribute("data-active-element");
    return;
  }
  const profile = ELEMENT_PROFILES.find((entry) => entry.id === String(raw.id)) ?? raw;
  const intensity = clamp(Number(raw.intensity ?? song?.elementSound?.intensity ?? 0.75), 0, 1);
  chip.hidden = false;
  chip.dataset.element = profile.id;
  chip.textContent = \`${profile.symbol ?? ""} ${String(profile.label ?? profile.id).toUpperCase()} · ${Math.round(intensity * 100)}%\`;
  chip.title = \`Active Element — ${profile.description ?? "This production personality stays with the song."}\`;
  document.documentElement?.setAttribute("data-active-element", profile.id);
}

function renderSongVariationTray() {
  const tray = $("#songVariationTray");
  if (!tray) return;
  const variations = Array.isArray(state.songVariations) ? state.songVariations : [];
  const ready = variations.length === 3;
  const activeElement = resolveSongElement(state.song);
  tray.hidden = false;
  tray.dataset.state = ready ? "ready" : state.song ? "available" : "empty";
  const status = $(".song-variation-heading em", tray);
  if (status) {
    status.textContent = ready
      ? \`${activeElement?.symbol ? activeElement.symbol + " " : ""}${activeElement?.label ?? "Element"} selected · tap another Element to switch personality\`
      : state.song
        ? activeElement?.id
          ? \`${activeElement.symbol ?? ""} ${activeElement.label ?? activeElement.id} is active · tap an Element to create a fresh trio from this DNA\`.trim()
          : "Current song is ready · tap Fire, Electric, or Drip to create the three-Element family"
        : "Generate a song first · Elements reinterpret one song DNA without replacing your idea";
  }
  $$('[data-song-variation]', tray).forEach((button) => {
    const index = Number(button.dataset.songVariation);
    const song = variations[index];
    const fallback = ELEMENT_PROFILES[index] ?? ELEMENT_PROFILES[0];
    const element = song?.variationSet?.element ?? fallback;
    const meter = song?.variationSet?.element?.meter;
    const score = Math.round(Number(song?.meta?.scoreDetails?.totalScore) || 0);
    const active = ready && index === state.activeSongVariation;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
    button.dataset.element = element?.id ?? "";
    button.dataset.mode = ready ? "select" : state.song ? "generate" : "locked";
    const title = $("b", button);
    const detail = $("small", button);
    if (title) title.textContent = element ? \`${element.symbol || ""} ${element.label}\`.trim() : \`Element ${index + 1}\`;
    const idleDetail = {
      fire: "Heat · punch · impact",
      electric: "Motion · spark · energy",
      drip: "Flow · space · emotion",
    }[element?.id] ?? element?.description ?? "Production personality";
    const meterText = meter ? \`${meter.label} ${Number(meter.value).toLocaleString()} ${meter.unit}\` : idleDetail;
    if (detail) detail.textContent = ready && score > 0 ? \`${meterText} · Q${score}\` : meterText;
    button.title = ready
      ? element?.description ?? "Switch to this full-song Element interpretation"
      : state.song
        ? \`Create the ${element?.label ?? "selected"} interpretation while keeping this song DNA\`
        : "Generate a song first, then use Elements to choose its production personality";
  });
}

export function selectSongVariation`;
app = replaceOnce(
  app,
  /function renderSongVariationTray\(\) \{[\s\S]*?\n\}\n\nexport function selectSongVariation/,
  trayBlock,
  "persistent Element tray runtime",
);

app = replaceOnce(
  app,
  '    renderSongVariationTray();\n    renderCreativeThread();',
  '    renderActiveElementIdentity();\n    renderSongVariationTray();\n    renderCreativeThread();',
  "active Element hero identity",
);

app = replaceOnce(
  app,
  '    let candidateSong = kind === "songVariations" ? variationSongs[0] : generated?.song;',
  '    const preferredVariationIndex = kind === "songVariations"\n      ? clamp(Math.round(Number(options.preferredVariationIndex) || 0), 0, 2)\n      : -1;\n    let candidateSong = kind === "songVariations" ? variationSongs[preferredVariationIndex] : generated?.song;',
  "preferred Element candidate",
);
app = replaceOnce(
  app,
  '      draft.activeSongVariation = kind === "songVariations" ? 0 : -1;',
  '      draft.activeSongVariation = kind === "songVariations" ? preferredVariationIndex : -1;',
  "preferred Element active index",
);

app = replaceOnce(
  app,
  '  $("#songVariationTray")?.addEventListener("click", (event) => {\n    const button = event.target.closest?.("[data-song-variation]");\n    if (button) selectSongVariation(button.dataset.songVariation);\n  });',
  '  $("#songVariationTray")?.addEventListener("click", (event) => {\n    const button = event.target.closest?.("[data-song-variation]");\n    if (!button) return;\n    const index = Number(button.dataset.songVariation);\n    if (state.songVariations?.[index]) {\n      selectSongVariation(index);\n      return;\n    }\n    if (!state.song) {\n      showToast("Generate a song first. Then Fire, Electric, and Drip can reinterpret that same DNA.");\n      scrollToControl("#generateNew");\n      return;\n    }\n    void runGeneration("songVariations", { preferredVariationIndex: index });\n  });',
  "direct Element card generation",
);

app = replaceOnce(
  app,
  'function renderShapeDirector(section = editorSection()) {\n  const panel = $("#shapeDirectorPanel");\n  if (!panel) return;\n  panel.hidden = !section;\n  if (!section) return;\n  const director = shapeDirectorState();',
  'function renderShapeDirector(section = editorSection()) {\n  const panel = $("#shapeDirectorPanel");\n  if (!panel) return;\n  panel.hidden = !section;\n  if (!section) return;\n  const director = shapeDirectorState();\n  const rawElement = resolveSongElement(state.song);\n  const element = rawElement?.id ? (ELEMENT_PROFILES.find((entry) => entry.id === String(rawElement.id)) ?? rawElement) : null;\n  let elementContext = $("#shapeDirectorElementContext");\n  if (!elementContext) {\n    elementContext = document.createElement("em");\n    elementContext.id = "shapeDirectorElementContext";\n    elementContext.className = "shape-director-element-context";\n    $(".shape-director-heading", panel)?.append(elementContext);\n  }\n  if (elementContext) {\n    elementContext.hidden = !element;\n    if (element) {\n      elementContext.dataset.element = element.id;\n      elementContext.textContent = `${element.symbol ?? ""} ${String(element.label ?? element.id).toUpperCase()} ELEMENT · PRESERVED`;\n      elementContext.title = "Shape changes the selected musical scope without replacing the song’s Element personality.";\n    } else {\n      elementContext.removeAttribute("data-element");\n    }\n  }',
  "Shape Element context",
);
await write("src/app.js", app);

let engine = await read("src/core/shape-director-engine.js");
engine = replaceOnce(
  engine,
  'function validateCandidate(sourceSong, candidate, intent, beforeDigest) {\n  if (!candidate || !Array.isArray(candidate.tracks)) return { valid: false, error: "invalid-candidate" };',
  'function elementIdentityDigest(song) {\n  return JSON.stringify({\n    variationSet: song?.variationSet ?? null,\n    elementLineage: song?.elementLineage ?? null,\n    elementSound: song?.elementSound ?? null,\n  });\n}\n\nfunction validateCandidate(sourceSong, candidate, intent, beforeDigest) {\n  if (!candidate || !Array.isArray(candidate.tracks)) return { valid: false, error: "invalid-candidate" };\n  if (elementIdentityDigest(candidate) !== elementIdentityDigest(sourceSong)) {\n    return { valid: false, error: "element-lineage-escape" };\n  }',
  "Shape Element lineage validator",
);
engine = replaceOnce(
  engine,
  '    direction: intent.direction.id,\n    preserve: [...intent.preserve],',
  '    direction: intent.direction.id,\n    elementId: sourceSong?.variationSet?.element?.id ?? sourceSong?.elementLineage?.element?.id ?? null,\n    preserve: [...intent.preserve],',
  "Shape revision Element provenance",
);
await write("src/core/shape-director-engine.js", engine);

let elementCss = await read("src/ui/element-button-v3.js");
const elementCssInsert = `

#songVariationTray[data-state="empty"] .song-variation-options button {
  opacity:.58;
  filter:saturate(.72);
}
#songVariationTray[data-state="available"] .song-variation-options button {
  cursor:pointer;
  border-style:solid;
}
#songVariationTray[data-state="available"] .song-variation-options button::after {
  opacity:.9;
}
.active-element-chip {
  --active-element-rgb:157,111,255;
  display:inline-flex;
  align-items:center;
  gap:5px;
  border:1px solid rgba(var(--active-element-rgb),.42);
  border-radius:999px;
  padding:5px 8px;
  background:rgba(var(--active-element-rgb),.1);
  color:rgb(var(--active-element-rgb));
  font:800 .58rem/1 var(--font-data);
  letter-spacing:.065em;
  box-shadow:inset 0 1px rgba(255,255,255,.06),0 0 18px rgba(var(--active-element-rgb),.08);
}
.active-element-chip[data-element="fire"]{--active-element-rgb:255,105,58}
.active-element-chip[data-element="electric"]{--active-element-rgb:255,216,67}
.active-element-chip[data-element="drip"]{--active-element-rgb:75,184,255}
`;
elementCss = replaceOnce(
  elementCss,
  '\n@media (max-width:600px) {',
  elementCssInsert + '\n@media (max-width:600px) {',
  "Element persistent-state styling",
);
await write("src/ui/element-button-v3.js", elementCss);

let shapeCss = await read("src/ui/shape-director.css");
shapeCss += '\n.shape-director-element-context{justify-self:end;align-self:start;padding:5px 8px;border:1px solid rgba(167,139,250,.22);border-radius:999px;background:rgba(124,58,237,.08);font:800 9px/1 var(--font-mono)!important;letter-spacing:.08em!important;color:#c4b5fd!important;white-space:nowrap}.shape-director-element-context[data-element="fire"]{border-color:rgba(255,105,58,.32);background:rgba(255,105,58,.08);color:#ff8b66!important}.shape-director-element-context[data-element="electric"]{border-color:rgba(255,216,67,.34);background:rgba(255,216,67,.08);color:#ffdc43!important}.shape-director-element-context[data-element="drip"]{border-color:rgba(75,184,255,.34);background:rgba(75,184,255,.08);color:#6fd5ff!important}@media(max-width:680px){.shape-director-element-context{grid-column:1/-1;justify-self:start;white-space:normal}}\n';
await write("src/ui/shape-director.css", shapeCss);

let engineTest = await read("tests/shape-director-engine.test.mjs");
if (!engineTest.includes('Shape preserves Element identity')) {
  engineTest += `

test("Shape preserves Element identity and lineage across local rewrites", () => {
  for (const provenance of ["variationSet", "elementLineage"]) {
    const source = fixtureSong();
    source.elementSound = { version: 1, id: "electric", intensity: 0.82 };
    if (provenance === "variationSet") {
      source.variationSet = {
        id: "elemental-family-1",
        element: { id: "electric", label: "Electric", symbol: "⚡", intensity: 0.82 },
        moodIntent: { id: "club", label: "Club" },
      };
    } else {
      source.elementLineage = {
        version: 1,
        depth: 2,
        parentSongId: "parent-song",
        rootFamilyId: "elemental-family-1",
        element: { id: "electric", label: "Electric", symbol: "⚡", intensity: 0.82 },
        moodIntent: { id: "club", label: "Club" },
      };
    }
    const transaction = createShapeCandidate(source, {
      selection: { target: "track", sectionId: "verse", trackId: "melody" },
      size: "reshape",
      direction: "catchier",
    }, { seed: `element-shape-${provenance}` });
    assert.equal(transaction.status, "candidate");
    assert.deepEqual(transaction.after.variationSet, source.variationSet);
    assert.deepEqual(transaction.after.elementLineage, source.elementLineage);
    assert.deepEqual(transaction.after.elementSound, source.elementSound);
    assert.equal(transaction.after.shapeRevision.elementId, "electric");
  }
});
`;
}
await write("tests/shape-director-engine.test.mjs", engineTest);

const workflowTest = `import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const elementUi = fs.readFileSync(new URL("../src/ui/element-button-v3.js", import.meta.url), "utf8");
const shapeCss = fs.readFileSync(new URL("../src/ui/shape-director.css", import.meta.url), "utf8");
const shapeEngine = fs.readFileSync(new URL("../src/core/shape-director-engine.js", import.meta.url), "utf8");

test("Elemental Producer stays visible before the three siblings exist", () => {
  assert.match(html, /id="songVariationTray"/);
  assert.doesNotMatch(html, /id="songVariationTray"[^>]*hidden/);
  assert.match(html, /Create all 3 Elements/);
  assert.match(html, /Choose your production personality/);
  assert.match(app, /tray\.dataset\.state = ready \? "ready" : state\.song \? "available" : "empty"/);
});

test("Element cards can directly request Fire Electric or Drip while preserving one family", () => {
  assert.match(app, /preferredVariationIndex/);
  assert.match(app, /variationSongs\[preferredVariationIndex\]/);
  assert.match(app, /runGeneration\("songVariations", \{ preferredVariationIndex: index \}\)/);
  assert.match(app, /ELEMENT_PROFILES/);
});

test("the active Element remains visible on the song and inside Shape", () => {
  assert.match(app, /function renderActiveElementIdentity/);
  assert.match(app, /activeElementChip/);
  assert.match(elementUi, /active-element-chip\[data-element="electric"\]/);
  assert.match(app, /shapeDirectorElementContext/);
  assert.match(shapeCss, /shape-director-element-context\[data-element="drip"\]/);
});

test("Shape fails closed if a local rewrite attempts to escape Element lineage", () => {
  assert.match(shapeEngine, /function elementIdentityDigest/);
  assert.match(shapeEngine, /element-lineage-escape/);
  assert.match(shapeEngine, /elementId: sourceSong\?\.variationSet\?\.element\?\.id/);
});
`;
await write("tests/element-workflow-v4.test.mjs", workflowTest);

console.log("Element workflow v4 patch applied.");
