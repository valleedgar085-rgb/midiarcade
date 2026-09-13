import fs from "node:fs";

const appPath = "src/app.js";
const indexPath = "index.html";
let app = fs.readFileSync(appPath, "utf8");
let index = fs.readFileSync(indexPath, "utf8");

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`EPS runtime patch missing: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`EPS runtime patch ambiguous: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function replaceRegexOnce(source, pattern, replacement, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`EPS runtime patch expected one ${label}, found ${matches.length}`);
  return source.replace(pattern, replacement);
}

app = replaceOnce(
  app,
  'import { createAppStore, createInitialAppState } from "./core/app-store.js";\n',
  'import { createAppStore, createInitialAppState } from "./core/app-store.js";\nimport { createDefaultAutoControls } from "./core/auto-control-policy.js";\nimport { chooseElementProgram } from "./core/elemental-program-policy.js";\n',
  "EPS imports",
);

app = replaceOnce(
  app,
  'const AUTO_SELECT_IDS = new Set(["keyControl", "modeControl", "barsControl", "grooveControl", "chordPathControl"]);\n',
  'const AUTO_SELECT_IDS = new Set(["keyControl", "modeControl", "barsControl", "grooveControl", "chordPathControl"]);\n\nfunction trackProgramAutoKey(trackId) {\n  return `track:${trackId}:program`;\n}\n\nfunction isTrackProgramAuto(trackId) {\n  return state.autoControls.has(trackProgramAutoKey(trackId));\n}\n',
  "program Auto helpers",
);

app = replaceOnce(
  app,
  'function chooseNewGenrePrograms(seed) {\n  const profile = genreProfile();\n  for (const id of TRACK_ORDER) {\n',
  'function chooseNewGenrePrograms(seed) {\n  const profile = genreProfile();\n  for (const id of TRACK_ORDER) {\n    if (!isTrackProgramAuto(id)) continue;\n',
  "manual program protection during New",
);

app = replaceRegexOnce(
  app,
  /(function chooseNewGenrePrograms\(seed\) \{[\s\S]*?\n\}\n)(?=\nfunction )/,
  `$1\nfunction applyElementAutoPrograms(song, seed) {\n  const element = song?.variationSet?.element;\n  if (!song || !element?.id) return song;\n  const profile = genreProfile();\n  for (const [index, track] of songTracks(song).entries()) {\n    const id = trackId(track, index);\n    const settings = state.trackSettings[id];\n    if (!settings) continue;\n    const pinned = state.locked.has(id) || !isTrackProgramAuto(id);\n    if (pinned) {\n      const program = Number(settings.program);\n      if (Number.isFinite(program)) {\n        track.program = program;\n        track.settings = { ...(track.settings ?? {}), program };\n      }\n      continue;\n    }\n    const program = chooseElementProgram({\n      trackId: id,\n      elementId: element.id,\n      intensity: element.intensity,\n      palette: profilePrograms(id, profile),\n      seed: \`${"${seed}"}:\${id}\`,\n      currentProgram: track.program,\n    });\n    if (!Number.isFinite(Number(program))) continue;\n    track.program = Number(program);\n    track.settings = { ...(track.settings ?? {}), program: Number(program) };\n  }\n  return refreshSongIdea(song);\n}\n`,
  "element program applicator",
);

app = replaceOnce(
  app,
  '      ...(isNew ? {} : { program: settings.program }),\n',
  '      ...(!isTrackProgramAuto(id) ? { program: settings.program } : {}),\n',
  "manual program generation config",
);

app = replaceRegexOnce(
  app,
  /function patchOptions\(id, selectedProgram\) \{[\s\S]*?\n\}\n\nfunction renderAttitudeStrip/,
  `function patchOptions(id, selectedProgram) {\n  const profileChoices = profilePrograms(id);\n  const baseChoices = (PATCHES[id] || []).map(([program]) => Number(program));\n  const programs = [...new Set([...profileChoices, ...baseChoices, Number(selectedProgram)].filter(Number.isFinite))];\n  const auto = isTrackProgramAuto(id);\n  const autoOption = \`<option value="auto" \${auto ? "selected" : ""}>AUTO · Element decides</option>\`;\n  const manualOptions = programs.map((program) => {\n    const profilePick = profileChoices.includes(program);\n    const name = programName(id, program);\n    return \`<option value="\${program}" \${!auto && program === Number(selectedProgram) ? "selected" : ""}>\${profilePick ? "✦ " : ""}\${name}</option>\`;\n  }).join("");\n  return \`\${autoOption}\${manualOptions}\`;\n}\n\nfunction renderAttitudeStrip`,
  "program picker Auto option",
);

app = replaceOnce(
  app,
  '${profilePick ? "STYLE PICK" : "CUSTOM"}',
  '${isTrackProgramAuto(id) ? "AUTO" : profilePick ? "STYLE PICK" : "CUSTOM"}',
  "program picker authority badge",
);

app = replaceOnce(
  app,
  'function handleTrackControl(id, control) {\n  const key = control.dataset.control;\n  state.trackSettings[id][key] = Number(control.value);\n',
  'function handleTrackControl(id, control) {\n  const key = control.dataset.control;\n  if (key === "program" && control.value === "auto") return;\n  state.trackSettings[id][key] = Number(control.value);\n',
  "program input Auto guard",
);

app = replaceOnce(
  app,
  'async function handleTrackControlCommit(id, control) {\n  const key = control.dataset.control;\n  state.trackSettings[id][key] = Number(control.value);\n',
  'async function handleTrackControlCommit(id, control) {\n  const key = control.dataset.control;\n  if (key === "program" && control.value === "auto") {\n    state.autoControls.add(trackProgramAutoKey(id));\n    renderTrackRack();\n    renderMixOverview();\n    scheduleSessionSave();\n    showToast(`${TRACK_META[id]?.name || "Instrument"} sound returned to Auto. Fire, Electric and Drip may choose it on the next generation.`);\n    return;\n  }\n  state.trackSettings[id][key] = Number(control.value);\n',
  "program commit Auto branch",
);

app = replaceOnce(
  app,
  '  if (key === "program") {\n    const track = songTracks().find((candidate, index) => trackId(candidate, index) === id);\n',
  '  if (key === "program") {\n    state.autoControls.delete(trackProgramAutoKey(id));\n    const track = songTracks().find((candidate, index) => trackId(candidate, index) === id);\n',
  "manual program pins Auto authority",
);

app = replaceRegexOnce(
  app,
  /(function captureResolvedAutoTrackSettings\(song\) \{[\s\S]*?const settings = state\.trackSettings\[id\];\n    if \(!settings\) continue;\n)/,
  `$1    if (isTrackProgramAuto(id)) {\n      const resolvedProgram = Number(track.program ?? controls.program);\n      if (Number.isFinite(resolvedProgram)) settings.program = resolvedProgram;\n    }\n`,
  "capture resolved Auto programs",
);

app = replaceOnce(
  app,
  '    if (kind === "songVariations") {\n      variationSongs = variationSongs.map((song) => preserveLockedTracks(sourceSong, song));\n    }\n',
  '    if (kind === "songVariations") {\n      variationSongs = variationSongs.map((song, index) => applyElementAutoPrograms(\n        preserveLockedTracks(sourceSong, song),\n        `${config.seed}:element-program:${index}`,\n      ));\n    }\n',
  "element-aware program selection",
);

app = replaceRegexOnce(
  app,
  /function renderSongVariationTray\(\) \{[\s\S]*?\n\}\n\nexport function selectSongVariation/,
  `function renderSongVariationTray() {\n  const tray = $("#songVariationTray");\n  if (!tray) return;\n  const variations = Array.isArray(state.songVariations) ? state.songVariations : [];\n  tray.hidden = variations.length !== 3;\n  if (tray.hidden) return;\n  const heading = $("#songVariationTitle");\n  if (heading) heading.textContent = "Fire · Electric · Drip";\n  $$('[data-song-variation]', tray).forEach((button) => {\n    const index = Number(button.dataset.songVariation);\n    const song = variations[index];\n    const element = song?.variationSet?.element;\n    const direction = song?.variationSet?.direction;\n    const meter = element?.meter;\n    const score = Math.round(Number(song?.meta?.scoreDetails?.totalScore) || 0);\n    const active = index === state.activeSongVariation;\n    button.classList.toggle("is-active", active);\n    button.setAttribute("aria-checked", String(active));\n    button.dataset.element = element?.id ?? direction?.id ?? "";\n    const title = $("b", button);\n    const detail = $("small", button);\n    if (title) title.textContent = element\n      ? `${element.symbol || ""} ${element.label}`.trim()\n      : direction?.label ?? `Version ${index + 1}`;\n    const meterText = meter ? `${meter.label} ${Number(meter.value).toLocaleString()} ${meter.unit}` : "Elemental producer pass";\n    if (detail) detail.textContent = score > 0 ? `${meterText} · Q${score}` : meterText;\n    button.title = element?.description ?? direction?.description ?? "Switch to this full-song interpretation";\n  });\n}\n\nexport function selectSongVariation`,
  "Elemental variation tray",
);

app = replaceOnce(
  app,
  '  const direction = variation.variationSet?.direction?.label ?? `Version ${safeIndex + 1}`;\n  showToast(`${direction} variation selected.`);\n',
  '  const element = variation.variationSet?.element;\n  const direction = element?.label ?? variation.variationSet?.direction?.label ?? `Version ${safeIndex + 1}`;\n  const reading = element?.meter;\n  showToast(`${element?.symbol ? `${element.symbol} ` : ""}${direction} selected${reading ? ` · ${reading.label} ${reading.value} ${reading.unit}` : ""}.`);\n',
  "element selection toast",
);

app = replaceOnce(
  app,
  '  $("#resetControlsButton").addEventListener("click", () => {\n    state.autoControls.clear();\n',
  '  $("#resetControlsButton").addEventListener("click", () => {\n    state.autoControls.clear();\n    for (const key of createDefaultAutoControls(TRACK_ORDER)) state.autoControls.add(key);\n',
  "Auto-first reset",
);

index = replaceOnce(index, "PRODUCER A/B/C", "ELEMENTAL PRODUCER", "variation tray eyebrow");
index = replaceOnce(index, "Three directions, one song", "Three elements, one song", "variation tray title");
index = replaceOnce(index, "Tap any version to switch instantly", "Same song DNA · three production personalities", "variation tray guidance");
index = replaceOnce(index, "<b>A · Pocket</b><small>Rhythm-led</small>", "<b>🔥 Fire</b><small>Heat · impact</small>", "Fire placeholder");
index = replaceOnce(index, "<b>B · Hook</b><small>Lead-led</small>", "<b>⚡ Electric</b><small>Charge · motion</small>", "Electric placeholder");
index = replaceOnce(index, "<b>C · Journey</b><small>Arc-led</small>", "<b>💧 Drip</b><small>Flow · space</small>", "Drip placeholder");
index = replaceOnce(index, "Producer compares six complete arrangements", "Fire · Electric · Drip from one song DNA", "generation button copy");

fs.writeFileSync(appPath, app);
fs.writeFileSync(indexPath, index);
console.log("EPS runtime wiring applied with all source-shape assertions satisfied.");
