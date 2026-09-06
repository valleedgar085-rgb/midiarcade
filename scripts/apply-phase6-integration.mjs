import fs from "node:fs";

function replaceExact(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} anchor not found`);
  return source.replace(before, after);
}

let app = fs.readFileSync("src/app.js", "utf8");
let engine = fs.readFileSync("src/music-engine.js", "utf8");

app = replaceExact(app,
`import { previewRuntimeProfile, previewVoiceFeatures, previewVoicePriority, selectPreviewVoiceVictim } from "./core/preview-performance.js";`,
`import { previewRuntimeProfile, previewVoiceFeatures, previewVoicePriority, selectPreviewVoiceVictim } from "./core/preview-performance.js";\nimport { createTasteProfile, learnTasteSignal, tasteGenerationBias } from "./core/taste-profile.js";\nimport { applyAdaptiveGroove } from "./core/groove-expression.js";\nimport { applyPatternVariety } from "./core/pattern-variety.js";`,
"adaptive imports");

app = replaceExact(app,
`function sanitizeTasteProfile(value) {\n  const source = isRecord(value) ? value : {};\n  const numeric = (key) => Math.max(0, Number(source[key]) || 0);\n  return {\n    ratings: numeric("ratings"),\n    likes: numeric("likes"),\n    rejects: numeric("rejects"),\n    favorites: numeric("favorites"),\n    energyTotal: numeric("energyTotal"),\n    complexityTotal: numeric("complexityTotal"),\n    variationTotal: numeric("variationTotal"),\n    genreVotes: isRecord(source.genreVotes) ? Object.fromEntries(\n      Object.entries(source.genreVotes).filter(([genre]) => GENRE_IDS.includes(genre)).map(([genre, vote]) => [genre, Number(vote) || 0]),\n    ) : {},\n    songRatings: isRecord(source.songRatings) ? Object.fromEntries(\n      Object.entries(source.songRatings).slice(-64).map(([id, rating]) => [String(id).slice(0, 96), String(rating).slice(0, 16)]),\n    ) : {},\n  };\n}`,
`function sanitizeTasteProfile(value) {\n  const source = isRecord(value) ? value : {};\n  const normalized = createTasteProfile(source);\n  normalized.genreVotes = isRecord(source.genreVotes) ? Object.fromEntries(\n    Object.entries(source.genreVotes).filter(([genre]) => GENRE_IDS.includes(genre)).map(([genre, vote]) => [genre, Number(vote) || 0]),\n  ) : {};\n  normalized.grooveVotes = isRecord(source.grooveVotes) ? Object.fromEntries(\n    Object.entries(source.grooveVotes).slice(-24).map(([groove, vote]) => [String(groove).slice(0, 64), Number(vote) || 0]),\n  ) : {};\n  normalized.songRatings = isRecord(source.songRatings) ? Object.fromEntries(\n    Object.entries(source.songRatings).slice(-64).map(([id, rating]) => [String(id).slice(0, 96), String(rating).slice(0, 16)]),\n  ) : {};\n  normalized.songSignals = isRecord(source.songSignals) ? Object.fromEntries(\n    Object.entries(source.songSignals).slice(-96).map(([id, count]) => [String(id).slice(0, 160), Math.max(0, Math.min(5, Number(count) || 0))]),\n  ) : {};\n  return normalized;\n}`,
"taste sanitizer");

app = replaceExact(app,
`  const tasteAverages = state.tasteProfile.ratings > 0 ? {\n    energyControl: state.tasteProfile.energyTotal / state.tasteProfile.ratings,\n    complexityControl: state.tasteProfile.complexityTotal / state.tasteProfile.ratings,\n    variationControl: state.tasteProfile.variationTotal / state.tasteProfile.ratings,\n  } : {};\n  const generationValue = (id, fallback) => {\n    const selected = state.autoControls.has(id)\n      ? autoGenerationValue(id, seed, profile, fallback)\n      : readNumber(\`#\${id}\`, fallback);\n    const learned = tasteAverages[id];\n    return state.autoControls.has(id) && Number.isFinite(learned)\n      ? selected * 0.72 + learned * 0.28\n      : selected;\n  };`,
`  const tasteBias = tasteGenerationBias(state.tasteProfile);\n  const tasteControlMap = {\n    tempoControl: "tempo", energyControl: "energy", complexityControl: "complexity",\n    swingControl: "swing", humanizeControl: "humanize", variationControl: "variation",\n    evolutionControl: "evolution", surpriseControl: "surprise",\n  };\n  const generationValue = (id, fallback) => {\n    const selected = state.autoControls.has(id)\n      ? autoGenerationValue(id, seed, profile, fallback)\n      : readNumber(\`#\${id}\`, fallback);\n    const trait = tasteControlMap[id];\n    const learned = trait ? tasteBias.traits?.[trait]?.center : null;\n    const influence = Math.min(0.34, tasteBias.confidence * 0.34);\n    return state.autoControls.has(id) && Number.isFinite(learned)\n      ? selected * (1 - influence) + learned * influence\n      : selected;\n  };`,
"taste generation blend");

app = replaceExact(app,
`  return {\n    seed,\n    genre: genreId,`,
`  const generationConfig = {\n    seed,\n    genre: genreId,`,
"build config return start");

app = replaceExact(app,
`    tasteProfile: deepClone(state.tasteProfile),\n    thinkingDepth: "deep",\n  };\n}\n\nconst GENERATION_SETTING_IDS = [`,
`    tasteProfile: deepClone(state.tasteProfile),\n    thinkingDepth: "deep",\n  };\n  return applyPatternVariety(\n    applyAdaptiveGroove(generationConfig, tasteBias, seed),\n    tasteBias,\n    seed,\n  );\n}\n\nconst GENERATION_SETTING_IDS = [`,
"build config adaptive return");

const oldRate = `function rateCurrentSong(rating) {\n  if (!state.song || !["like", "reject", "favorite"].includes(rating)) return;\n  const profile = state.tasteProfile;\n  if (profile.songRatings[state.song.id] === rating) return;\n  profile.songRatings[state.song.id] = rating;\n  const recentRatings = Object.entries(profile.songRatings).slice(-64);\n  profile.songRatings = Object.fromEntries(recentRatings);\n  const weight = rating === "favorite" ? 2 : rating === "like" ? 1 : -1;\n  if (rating === "like") profile.likes += 1;\n  if (rating === "reject") profile.rejects += 1;\n  if (rating === "favorite") profile.favorites += 1;\n  profile.genreVotes[state.song.genre] = (profile.genreVotes[state.song.genre] || 0) + weight;\n  if (weight > 0) {\n    profile.ratings += weight;\n    profile.energyTotal += Number(state.song.settings?.energy ?? 0.68) * 100 * weight;\n    profile.complexityTotal += Number(state.song.settings?.complexity ?? 0.54) * 100 * weight;\n    profile.variationTotal += Number(state.song.settings?.variation ?? 0.42) * 100 * weight;\n  }\n  renderSongShowcase();\n  scheduleSessionSave();\n  showToast(rating === "favorite"\n    ? "Favorite saved. Auto settings will lean further toward this musical character."\n    : rating === "like"\n      ? "Taste learned. Future Auto choices will gently favor this direction."\n      : "Noted. The idea engine will move away from this direction.");\n}`;
const newRate = `function learnCurrentTaste(signal, song = state.song) {\n  if (!song) return false;\n  state.tasteProfile = learnTasteSignal(state.tasteProfile, song, signal);\n  scheduleSessionSave();\n  return true;\n}\n\nfunction rateCurrentSong(rating) {\n  if (!state.song || !["like", "reject", "favorite"].includes(rating)) return;\n  const previous = state.tasteProfile?.songRatings?.[state.song.id];\n  if (previous === rating) return;\n  learnCurrentTaste(rating);\n  renderSongShowcase();\n  showToast(rating === "favorite"\n    ? "Favorite learned. Auto choices will remember its pocket, motion and emotional shape."\n    : rating === "like"\n      ? "Taste learned. Future Auto choices will gently favor this musical character while keeping exploration."\n      : "Noted. The producer brain will reduce this direction without erasing variety.");\n}`;
app = replaceExact(app, oldRate, newRate, "rating integration");

app = replaceExact(app,
`    renderAll();\n    scheduleSessionSave();\n    try { if (player.playing) player.restart(); } catch (_) { /* ignore */ }`,
`    renderAll();\n    if (sourceSong && kind === "similar") learnCurrentTaste("similar", sourceSong);\n    if (sourceSong && kind === "new") learnCurrentTaste("regenerate", sourceSong);\n    scheduleSessionSave();\n    try { if (player.playing) player.restart(); } catch (_) { /* ignore */ }`,
"generation signal integration");

app = replaceExact(app,
`    showToast(isNative\n      ? \`Sound-ready MIDI prepared: \${exportReport.trackCount} tracks, \${exportReport.noteCount} notes, \${exportReport.sectionMarkers} section markers, with DAW-ready setup.\`\n      : \`Exported DAW-ready MIDI: \${exportReport.trackCount} tracks, \${exportReport.noteCount} notes, \${exportReport.chordCues} chord cues.\`);`,
`    showToast(isNative\n      ? \`Sound-ready MIDI prepared: \${exportReport.trackCount} tracks, \${exportReport.noteCount} notes, \${exportReport.sectionMarkers} section markers, with DAW-ready setup.\`\n      : \`Exported DAW-ready MIDI: \${exportReport.trackCount} tracks, \${exportReport.noteCount} notes, \${exportReport.chordCues} chord cues.\`);\n    learnCurrentTaste("export");`,
"export taste signal");

app = replaceExact(app,
`    setWorkflowStep(3);\n    return true;`,
`    setWorkflowStep(3);\n    learnCurrentTaste("replay");\n    return true;`,
"replay taste signal");

engine = replaceExact(engine,
`    title: input.title == null ? null : String(input.title).slice(0, 100),\n    tracks,\n  };`,
`    title: input.title == null ? null : String(input.title).slice(0, 100),\n    compositionRoute: input.compositionRoute == null ? null : String(input.compositionRoute).slice(0, 40),\n    performancePocket: input.performancePocket && typeof input.performancePocket === "object" ? clone(input.performancePocket) : null,\n    patternVariety: input.patternVariety && typeof input.patternVariety === "object" ? clone(input.patternVariety) : null,\n    tracks,\n  };`,
"normalize adaptive metadata");

engine = replaceExact(engine,
`  const timingJitter = round(humanAmount * (0.004 + 0.026 * selected.timing));\n  const velocityVariance = round(2 + humanAmount * 10 * selected.velocity);`,
`  const adaptivePocket = config.performancePocket && typeof config.performancePocket === "object" ? config.performancePocket : null;\n  const adaptiveWindow = clamp(finite(adaptivePocket?.timingWindowBeats, 0), 0, 0.032);\n  const adaptiveAccent = clamp(finite(adaptivePocket?.accentDepth, 0), 0, 0.18);\n  const timingJitter = round(clamp(humanAmount * (0.004 + 0.026 * selected.timing) + adaptiveWindow * 0.22, 0, 0.04));\n  const velocityVariance = round(clamp(2 + humanAmount * 10 * selected.velocity + adaptiveAccent * 18, 2, 16));`,
"adaptive performance variance");

engine = replaceExact(engine,
`      chords: round((laidBack ? pocket : live ? pocket * 0.45 : 0) + phraseOffset * 0.45),\n      melody: round((laidBack ? pocket * 0.72 : live ? pocket * 0.3 : 0) + phraseOffset),\n      counterpoint: round((laidBack ? pocket * 0.52 : live ? -pocket * 0.2 : 0) - phraseOffset * 0.55),\n      pad: round((laidBack ? pocket * 0.8 : 0) + Math.max(0, phraseOffset) * 0.7),`,
`      chords: round((laidBack ? pocket : live ? pocket * 0.45 : 0) + phraseOffset * 0.45 + finite(adaptivePocket?.pushPull?.chords, 0)),\n      melody: round((laidBack ? pocket * 0.72 : live ? pocket * 0.3 : 0) + phraseOffset + finite(adaptivePocket?.pushPull?.melody, 0)),\n      counterpoint: round((laidBack ? pocket * 0.52 : live ? -pocket * 0.2 : 0) - phraseOffset * 0.55 + finite(adaptivePocket?.pushPull?.counterpoint, 0)),\n      pad: round((laidBack ? pocket * 0.8 : 0) + Math.max(0, phraseOffset) * 0.7 + finite(adaptivePocket?.pushPull?.pad, 0)),`,
"adaptive pocket offsets");

const routeCalls = [...engine.matchAll(/candidateCompositionRoute\(([^\n]+)\)/g)].map((match) => match[0]);
console.log("candidateCompositionRoute calls:", routeCalls);

fs.writeFileSync("src/app.js", app);
fs.writeFileSync("src/music-engine.js", engine);
console.log("Applied Phase 6 adaptive taste, groove, and pattern integration.");
