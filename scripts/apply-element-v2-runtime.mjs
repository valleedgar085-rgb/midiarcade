import { readFile, writeFile } from "node:fs/promises";

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceFunction(source, header, replacement, label) {
  const start = source.indexOf(header);
  if (start < 0) throw new Error(`Missing ${label}`);
  const end = source.indexOf("\n}\n\n", start);
  if (end < 0) throw new Error(`Could not bound ${label}`);
  return source.slice(0, start) + replacement + source.slice(end + 2);
}

const appPath = new URL("../src/app.js", import.meta.url);
const producerPath = new URL("../src/core/producer-variation-set.js", import.meta.url);
const cssPath = new URL("../src/ui/create-workflow.css", import.meta.url);

let app = await readFile(appPath, "utf8");

if (!app.includes("function generatedOrManualTrackSetting(")) {
  const replacement = [
    "function generatedOrManualTrackSetting(id, key, generatedValue, manualValue) {",
    "  const numeric = Number(generatedValue);",
    "  if (state.autoControls.has(`track:${id}:${key}`) && Number.isFinite(numeric)) return numeric;",
    "  return manualValue;",
    "}",
    "",
    "function applyTrackSettingsToSong(song) {",
    "  for (const [index, track] of songTracks(song).entries()) {",
    "    const id = trackId(track, index);",
    "    const settings = state.trackSettings[id];",
    "    if (!settings) continue;",
    "    const generated = track.settings || track.controls || {};",
    "    if (!isTrackProgramAuto(id) || !Number.isFinite(Number(track.program))) track.program = settings.program;",
    "    track.settings = {",
    "      ...generated,",
    "      program: track.program,",
    "      density: clamp(generatedOrManualTrackSetting(id, \"density\", generated.density, settings.density / 100), 0, 1),",
    "      variation: clamp(generatedOrManualTrackSetting(id, \"variation\", generated.variation, settings.variation / 100), 0, 1),",
    "      octave: clamp(generatedOrManualTrackSetting(id, \"octave\", generated.octave, (TRACK_DEFINITIONS[id]?.octave || 0) + settings.octave), 0, 8),",
    "      volume: clamp(generatedOrManualTrackSetting(id, \"volume\", generated.volume, settings.volume), 0, 1),",
    "      velocity: clamp(generatedOrManualTrackSetting(id, \"velocity\", generated.velocity, settings.velocity), 0.1, 1.5),",
    "      pan: clamp(generatedOrManualTrackSetting(id, \"pan\", generated.pan, settings.pan), -1, 1),",
    "      reverb: clamp(generatedOrManualTrackSetting(id, \"reverb\", generated.reverb, settings.reverb), 0, 1),",
    "      cutoff: clamp(generatedOrManualTrackSetting(id, \"cutoff\", generated.cutoff, settings.cutoff), 1000, 14000),",
    "      resonance: clamp(generatedOrManualTrackSetting(id, \"resonance\", generated.resonance, settings.resonance), 0, 1),",
    "      gate: clamp(generatedOrManualTrackSetting(id, \"gate\", generated.gate, settings.gate), 0.08, 1.5),",
    "      humanize: clamp(settings.humanize, 0, 1),",
    "      feel: clamp(settings.feel, 0, 1),",
    "      attitude: settings.attitude || \"neutral\",",
    "      mute: state.muted.has(id),",
    "      solo: state.solo.has(id),",
    "    };",
    "  }",
    "  return song;",
    "}",
  ].join("\n");
  app = replaceFunction(app, "function applyTrackSettingsToSong(song) {", replacement, "applyTrackSettingsToSong");
}

if (!app.includes("const useRuntimeAuthority = settingsById === state.trackSettings;")) {
  app = replaceOnce(
    app,
    "const uiSettings = settingsById?.[id] || {};\n    const settings = { ...defaults, ...(track.settings || track.controls || {}), ...uiSettings };",
    [
      "const uiSettings = settingsById?.[id] || {};",
      "    const generatedSettings = track.settings || track.controls || {};",
      "    const useRuntimeAuthority = settingsById === state.trackSettings;",
      "    const effectiveUiSettings = useRuntimeAuthority ? { ...uiSettings } : uiSettings;",
      "    if (useRuntimeAuthority) {",
      "      for (const key of AUTO_TRACK_RANGE_KEYS) {",
      "        if (state.autoControls.has(`track:${id}:${key}`)) delete effectiveUiSettings[key];",
      "      }",
      "      if (isTrackProgramAuto(id)) delete effectiveUiSettings.program;",
      "    }",
      "    const settings = { ...defaults, ...generatedSettings, ...effectiveUiSettings };",
    ].join("\n    "),
    "preview settings authority merge",
  );
}

await writeFile(appPath, app);

let producer = await readFile(producerPath, "utf8");
if (!producer.includes("./elemental-sound-profile.js")) {
  producer = replaceOnce(
    producer,
    "} from \"./elemental-producer-system.js\";\n",
    "} from \"./elemental-producer-system.js\";\nimport { applyElementSoundProfile } from \"./elemental-sound-profile.js\";\n",
    "element sound-profile import",
  );
}
if (!producer.includes("applyElementSoundProfile(generateSimilar(current, config), direction.id, intensity)")) {
  producer = replaceOnce(
    producer,
    "const song = generateSimilar(current, config);",
    "const song = applyElementSoundProfile(generateSimilar(current, config), direction.id, intensity);",
    "element sound-profile application",
  );
}
await writeFile(producerPath, producer);

let css = await readFile(cssPath, "utf8");
if (!css.includes("/* Element V2: audible identities + premium variation typography */")) {
  css += `\n\n/* Element V2: audible identities + premium variation typography */\n#preGenSection .song-variation-tray {\n  margin-top: 14px;\n  padding: 12px;\n  border: 1px solid rgba(255,255,255,.08);\n  border-radius: 16px;\n  background: linear-gradient(180deg, rgba(255,255,255,.032), rgba(5,5,10,.62));\n}\n\n#preGenSection .song-variation-heading {\n  display:flex;\n  align-items:flex-end;\n  justify-content:space-between;\n  gap:14px;\n  margin-bottom:10px;\n}\n\n#preGenSection .song-variation-heading small {\n  display:block;\n  font:800 .56rem var(--font-data);\n  letter-spacing:.19em;\n  color:var(--text-3);\n}\n\n#preGenSection .song-variation-heading strong {\n  display:block;\n  margin-top:2px;\n  font-family:var(--font-display);\n  font-size:.96rem;\n  letter-spacing:-.015em;\n}\n\n#preGenSection .song-variation-heading em {\n  color:var(--text-3);\n  font-size:.65rem;\n  line-height:1.35;\n}\n\n#preGenSection .song-variation-options {\n  gap:8px;\n}\n\n#preGenSection .song-variation-options button {\n  --element-rgb:157,111,255;\n  position:relative;\n  isolation:isolate;\n  min-height:78px;\n  padding:12px 12px 10px;\n  overflow:hidden;\n  border:1px solid rgba(var(--element-rgb),.24);\n  border-radius:14px;\n  background:linear-gradient(145deg, rgba(var(--element-rgb),.11), rgba(255,255,255,.018) 62%);\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.04);\n  transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease,background .18s ease;\n}\n\n#preGenSection .song-variation-options button::before {\n  content:\"\";\n  position:absolute;\n  inset:0 auto 0 0;\n  width:3px;\n  background:linear-gradient(180deg, rgba(var(--element-rgb),1), rgba(var(--element-rgb),.18));\n  box-shadow:0 0 18px rgba(var(--element-rgb),.42);\n}\n\n#preGenSection .song-variation-options button b {\n  display:block;\n  position:relative;\n  z-index:1;\n  font-family:var(--font-display);\n  font-size:clamp(.94rem,1.4vw,1.08rem);\n  line-height:1;\n  text-transform:uppercase;\n  color:rgb(var(--element-rgb));\n}\n\n#preGenSection .song-variation-options button small {\n  display:block;\n  position:relative;\n  z-index:1;\n  margin-top:8px;\n  color:var(--text-2);\n  font:700 .58rem/1.35 var(--font-data);\n  letter-spacing:.035em;\n}\n\n#preGenSection .song-variation-options button[data-element=\"fire\"] {\n  --element-rgb:255,112,67;\n  background:radial-gradient(circle at 14% 0%, rgba(255,138,76,.2), transparent 46%), linear-gradient(145deg, rgba(255,73,38,.11), rgba(255,255,255,.015) 66%);\n}\n#preGenSection .song-variation-options button[data-element=\"fire\"] b {\n  font-weight:900;\n  letter-spacing:.105em;\n  text-shadow:0 0 18px rgba(255,96,48,.26);\n}\n\n#preGenSection .song-variation-options button[data-element=\"electric\"] {\n  --element-rgb:111,226,255;\n  background:linear-gradient(118deg, rgba(76,132,255,.15), rgba(167,86,255,.08) 52%, rgba(33,245,255,.08));\n}\n#preGenSection .song-variation-options button[data-element=\"electric\"] b {\n  font-weight:850;\n  font-style:italic;\n  letter-spacing:.055em;\n  transform:skewX(-5deg);\n  transform-origin:left center;\n  text-shadow:0 0 18px rgba(80,214,255,.32);\n}\n\n#preGenSection .song-variation-options button[data-element=\"drip\"] {\n  --element-rgb:86,196,255;\n  background:radial-gradient(ellipse at 88% 110%, rgba(61,153,255,.18), transparent 52%), linear-gradient(145deg, rgba(54,118,255,.08), rgba(54,220,255,.055));\n}\n#preGenSection .song-variation-options button[data-element=\"drip\"] b {\n  font-weight:650;\n  letter-spacing:.17em;\n  text-shadow:0 0 20px rgba(81,188,255,.28);\n}\n\n#preGenSection .song-variation-options button.is-active {\n  transform:translateY(-2px);\n  outline:none;\n  border-color:rgba(var(--element-rgb),.68);\n  box-shadow:0 12px 30px rgba(0,0,0,.24),0 0 0 1px rgba(var(--element-rgb),.16),0 0 24px rgba(var(--element-rgb),.12);\n}\n\n@media (max-width:600px) {\n  #preGenSection .song-variation-heading em {display:none}\n  #preGenSection .song-variation-options button {flex-basis:154px;min-height:72px}\n  #preGenSection .song-variation-options button b {font-size:.9rem}\n}\n`;
}
await writeFile(cssPath, css);

console.log("Element V2 runtime wiring applied.");
