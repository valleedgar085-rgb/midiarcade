import fs from "node:fs";

const appPath = "src/app.js";
const indexPath = "index.html";
let app = fs.readFileSync(appPath, "utf8");
let index = fs.readFileSync(indexPath, "utf8");

function mustReplace(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`EPS runtime patch missing: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`EPS runtime patch ambiguous: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function mustRegex(source, pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length !== 1) throw new Error(`EPS runtime patch expected one ${label}, found ${matches.length}`);
  return source.replace(pattern, replacement);
}

app = mustReplace(
  app,
  'import { createAppStore, createInitialAppState } from "./core/app-store.js";\n',
  [
    'import { createAppStore, createInitialAppState } from "./core/app-store.js";',
    'import { createDefaultAutoControls } from "./core/auto-control-policy.js";',
    'import { chooseElementProgram } from "./core/elemental-program-policy.js";',
    '',
  ].join("\n"),
  "EPS imports",
);

app = mustReplace(
  app,
  'const AUTO_SELECT_IDS = new Set(["keyControl", "modeControl", "barsControl", "grooveControl", "chordPathControl"]);\n',
  [
    'const AUTO_SELECT_IDS = new Set(["keyControl", "modeControl", "barsControl", "grooveControl", "chordPathControl"]);',
    '',
    'function trackProgramAutoKey(trackId) {',
    '  return `track:${trackId}:program`;',
    '}',
    '',
    'function isTrackProgramAuto(trackId) {',
    '  return state.autoControls.has(trackProgramAutoKey(trackId));',
    '}',
    '',
  ].join("\n"),
  "program Auto helpers",
);

app = mustReplace(
  app,
  'function chooseNewGenrePrograms(seed) {\n  const profile = genreProfile();\n  for (const id of TRACK_ORDER) {\n',
  'function chooseNewGenrePrograms(seed) {\n  const profile = genreProfile();\n  for (const id of TRACK_ORDER) {\n    if (!isTrackProgramAuto(id)) continue;\n',
  "manual program protection during New",
);

const elementProgramFn = [
  'function applyElementAutoPrograms(song, seed) {',
  '  const element = song?.variationSet?.element;',
  '  if (!song || !element?.id) return song;',
  '  const profile = genreProfile();',
  '  for (const [index, track] of songTracks(song).entries()) {',
  '    const id = trackId(track, index);',
  '    const settings = state.trackSettings[id];',
  '    if (!settings) continue;',
  '    const pinned = state.locked.has(id) || !isTrackProgramAuto(id);',
  '    if (pinned) {',
  '      const program = Number(settings.program);',
  '      if (Number.isFinite(program)) {',
  '        track.program = program;',
  '        track.settings = { ...(track.settings ?? {}), program };',
  '      }',
  '      continue;',
  '    }',
  '    const program = chooseElementProgram({',
  '      trackId: id,',
  '      elementId: element.id,',
  '      intensity: element.intensity,',
  '      palette: profilePrograms(id, profile),',
  '      seed: `${seed}:${id}`,',
  '      currentProgram: track.program,',
  '    });',
  '    if (!Number.isFinite(Number(program))) continue;',
  '    track.program = Number(program);',
  '    track.settings = { ...(track.settings ?? {}), program: Number(program) };',
  '  }',
  '  return refreshSongIdea(song);',
  '}',
].join("\n");

app = mustRegex(
  app,
  /(function chooseNewGenrePrograms\(seed\) \{[\s\S]*?\n\}\n)(?=\nfunction )/,
  (match) => `${match}\n${elementProgramFn}\n`,
  "element program applicator",
);

app = mustReplace(
  app,
  '      ...(isNew ? {} : { program: settings.program }),\n',
  '      ...(!isTrackProgramAuto(id) ? { program: settings.program } : {}),\n',
  "manual program generation config",
);

const oldPatchOptions = [
  'function patchOptions(id, selectedProgram) {',
  '  const profileChoices = profilePrograms(id);',
  '  const baseChoices = (PATCHES[id] || []).map(([program]) => Number(program));',
  '  const programs = [...new Set([...profileChoices, ...baseChoices, Number(selectedProgram)].filter(Number.isFinite))];',
  '  return programs.map((program) => {',
  '    const profilePick = profileChoices.includes(program);',
  '    const name = programName(id, program);',
  '    return `<option value="${program}" ${program === Number(selectedProgram) ? "selected" : ""}>${profilePick ? "✦ " : ""}${name}</option>`;',
  '  }).join("");',
  '}',
].join("\n");

const newPatchOptions = [
  'function patchOptions(id, selectedProgram) {',
  '  const profileChoices = profilePrograms(id);',
  '  const baseChoices = (PATCHES[id] || []).map(([program]) => Number(program));',
  '  const programs = [...new Set([...profileChoices, ...baseChoices, Number(selectedProgram)].filter(Number.isFinite))];',
  '  const auto = isTrackProgramAuto(id);',
  '  const autoOption = `<option value="auto" ${auto ? "selected" : ""}>AUTO · Element decides</option>`;',
  '  const manualOptions = programs.map((program) => {',
  '    const profilePick = profileChoices.includes(program);',
  '    const name = programName(id, program);',
  '    return `<option value="${program}" ${!auto && program === Number(selectedProgram) ? "selected" : ""}>${profilePick ? "✦ " : ""}${name}</option>`;',
  '  }).join("");',
  '  return `${autoOption}${manualOptions}`;',
  '}',
].join("\n");
app = mustReplace(app, oldPatchOptions, newPatchOptions, "program picker Auto option");

app = mustReplace(
  app,
  '${profilePick ? "STYLE PICK" : "CUSTOM"}',
  '${isTrackProgramAuto(id) ? "AUTO" : profilePick ? "STYLE PICK" : "CUSTOM"}',
  "program picker authority badge",
);

app = mustReplace(
  app,
  'function handleTrackControl(id, control) {\n  const key = control.dataset.control;\n  state.trackSettings[id][key] = Number(control.value);\n',
  'function handleTrackControl(id, control) {\n  const key = control.dataset.control;\n  if (key === "program" && control.value === "auto") return;\n  state.trackSettings[id][key] = Number(control.value);\n',
  "program input Auto guard",
);

app = mustReplace(
  app,
  'async function handleTrackControlCommit(id, control) {\n  const key = control.dataset.control;\n  state.trackSettings[id][key] = Number(control.value);\n',
  [
    'async function handleTrackControlCommit(id, control) {',
    '  const key = control.dataset.control;',
    '  if (key === "program" && control.value === "auto") {',
    '    state.autoControls.add(trackProgramAutoKey(id));',
    '    renderTrackRack();',
    '    renderMixOverview();',
    '    scheduleSessionSave();',
    '    showToast(`${TRACK_META[id]?.name || "Instrument"} sound returned to Auto. Fire, Electric and Drip may choose it on the next generation.`);',
    '    return;',
    '  }',
    '  state.trackSettings[id][key] = Number(control.value);',
    '',
  ].join("\n"),
  "program commit Auto branch",
);

app = mustReplace(
  app,
  '  if (key === "program") {\n    const track = songTracks().find((candidate, index) => trackId(candidate, index) === id);\n',
  '  if (key === "program") {\n    state.autoControls.delete(trackProgramAutoKey(id));\n    const track = songTracks().find((candidate, index) => trackId(candidate, index) === id);\n',
  "manual program pins Auto authority",
);

app = mustRegex(
  app,
  /(function captureResolvedAutoTrackSettings\(song\) \{[\s\S]*?const settings = state\.trackSettings\[id\];\n    if \(!settings\) continue;\n)/,
  (match) => `${match}    if (isTrackProgramAuto(id)) {\n      const resolvedProgram = Number(track.program ?? controls.program);\n      if (Number.isFinite(resolvedProgram)) settings.program = resolvedProgram;\n    }\n`,
  "capture resolved Auto programs",
);

app = mustReplace(
  app,
  '    if (kind === "songVariations") {\n      variationSongs = variationSongs.map((song) => preserveLockedTracks(sourceSong, song));\n    }\n',
  [
    '    if (kind === "songVariations") {',
    '      variationSongs = variationSongs.map((song, index) => applyElementAutoPrograms(',
    '        preserveLockedTracks(sourceSong, song),',
    '        `${config.seed}:element-program:${index}`,',
    '      ));',
    '    }',
    '',
  ].join("\n"),
  "element-aware program selection",
);

app = mustReplace(
  app,
  '    const direction = song?.variationSet?.direction;\n    const score = Math.round(Number(song?.meta?.scoreDetails?.totalScore) || 0);\n',
  [
    '    const direction = song?.variationSet?.direction;',
    '    const element = song?.variationSet?.element;',
    '    const meter = element?.meter;',
    '    const score = Math.round(Number(song?.meta?.scoreDetails?.totalScore) || 0);',
    '',
  ].join("\n"),
  "variation element metadata",
);

const oldVariationCopy = [
  '    const title = $("b", button);',
  '    const detail = $("small", button);',
  '    if (title) title.textContent = `${String.fromCharCode(65 + index)} · ${direction?.label ?? `Version ${index + 1}`}`;',
  '    if (detail) detail.textContent = `${score ? `${score} quality · ` : ""}${direction?.description ?? "Related arrangement"}`;',
].join("\n");
const newVariationCopy = [
  '    button.dataset.element = element?.id ?? direction?.id ?? "";',
  '    const title = $("b", button);',
  '    const detail = $("small", button);',
  '    if (title) title.textContent = element ? `${element.symbol || ""} ${element.label}`.trim() : (direction?.label ?? `Version ${index + 1}`);',
  '    const meterText = meter ? `${meter.label} ${Number(meter.value).toLocaleString()} ${meter.unit}` : "Elemental producer pass";',
  '    if (detail) detail.textContent = score > 0 ? `${meterText} · Q${score}` : meterText;',
  '    button.title = element?.description ?? direction?.description ?? "Switch to this full-song interpretation";',
].join("\n");
app = mustReplace(app, oldVariationCopy, newVariationCopy, "Elemental variation tray copy");

app = mustReplace(
  app,
  '  const direction = variation.variationSet?.direction?.label ?? `Version ${safeIndex + 1}`;\n  showToast(`${direction} variation selected.`);\n',
  [
    '  const element = variation.variationSet?.element;',
    '  const direction = element?.label ?? variation.variationSet?.direction?.label ?? `Version ${safeIndex + 1}`;',
    '  const reading = element?.meter;',
    '  showToast(`${element?.symbol ? `${element.symbol} ` : ""}${direction} selected${reading ? ` · ${reading.label} ${reading.value} ${reading.unit}` : ""}.`);',
    '',
  ].join("\n"),
  "element selection toast",
);

app = mustReplace(
  app,
  '  $("#resetControlsButton").addEventListener("click", () => {\n    state.autoControls.clear();\n',
  '  $("#resetControlsButton").addEventListener("click", () => {\n    state.autoControls.clear();\n    for (const key of createDefaultAutoControls(TRACK_ORDER)) state.autoControls.add(key);\n',
  "Auto-first reset",
);

index = mustReplace(index, "PRODUCER A/B/C", "ELEMENTAL PRODUCER", "variation tray eyebrow");
index = mustReplace(index, "Three directions, one song", "Three elements, one song", "variation tray title");
index = mustReplace(index, "Tap any version to switch instantly", "Same song DNA · three production personalities", "variation tray guidance");
index = mustReplace(index, "<b>A · Pocket</b><small>Rhythm-led</small>", "<b>🔥 Fire</b><small>Heat · impact</small>", "Fire placeholder");
index = mustReplace(index, "<b>B · Hook</b><small>Lead-led</small>", "<b>⚡ Electric</b><small>Charge · motion</small>", "Electric placeholder");
index = mustReplace(index, "<b>C · Journey</b><small>Arc-led</small>", "<b>💧 Drip</b><small>Flow · space</small>", "Drip placeholder");
index = mustReplace(index, "Producer compares six complete arrangements", "Fire · Electric · Drip from one song DNA", "generation button copy");

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);
console.log("EPS runtime wiring v2 applied with all source-shape assertions satisfied.");
