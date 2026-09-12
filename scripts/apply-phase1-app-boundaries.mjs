import fs from "node:fs";

const path = new URL("../src/app.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");
const original = source;

function insertAfter(anchor, addition, label) {
  if (source.includes(addition.trim())) return;
  const index = source.indexOf(anchor);
  if (index < 0) throw new Error(`Phase 1 codemod could not find ${label}`);
  source = source.slice(0, index + anchor.length) + addition + source.slice(index + anchor.length);
}

function replaceExact(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) {
    if (source.includes(after)) return;
    throw new Error(`Phase 1 codemod could not find ${label}`);
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Phase 1 codemod found multiple ${label} blocks`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceRegex(pattern, after, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length === 0) {
    if (source.includes(after)) return;
    throw new Error(`Phase 1 codemod could not find ${label}`);
  }
  if (matches.length !== 1) throw new Error(`Phase 1 codemod found ${matches.length} ${label} blocks`);
  source = source.replace(pattern, after);
}

insertAfter(
  'import { createGenerationExecutor } from "./core/generation-executor.js";\n',
  'import { createAppGenerationFallback } from "./core/app-generation-fallback.js";\n'
    + 'import { getScaleChordGuide as deriveScaleChordGuide } from "./core/scale-guide.js";\n'
    + 'import { sanitizePersistedTrackSettings, sanitizeTasteProfile, validPersistedSong } from "./core/session-contract.js";\n',
  "generation executor import",
);

replaceRegex(
  /export function getScaleChordGuide\(song = state\.song, startBeat = 0\) \{[\s\S]*?\n\}\n\nfunction handleMidiDevicesChanged/,
  'export function getScaleChordGuide(song = state.song, startBeat = 0) {\n'
    + '  return deriveScaleChordGuide(song, startBeat);\n'
    + '}\n\nfunction handleMidiDevicesChanged',
  "scale/chord guide",
);

replaceRegex(
  /function isRecord\(value\) \{[\s\S]*?\n\}\n\nexport function restorePersistedSession\(\)/,
  'export function restorePersistedSession()',
  "persisted-session helper",
);

replaceExact(
  'validPersistedSong(parsed.song)',
  'validPersistedSong(parsed.song, { trackOrder: TRACK_ORDER })',
  "persisted song validation call",
);
replaceExact(
  'sanitizePersistedTrackSettings(parsed.trackSettings)',
  'sanitizePersistedTrackSettings(parsed.trackSettings, { defaults: DEFAULT_TRACK_SETTINGS, trackOrder: TRACK_ORDER })',
  "persisted track settings sanitization call",
);
replaceExact(
  'sanitizeTasteProfile(parsed.tasteProfile)',
  'sanitizeTasteProfile(parsed.tasteProfile, { genreIds: GENRE_IDS })',
  "taste profile sanitization call",
);

const fallbackBefore = `  fallback: (kind, payload) => {\n    if (kind === "sectionVariations") {\n      return Promise.resolve({\n        status: "committed",\n        options: generateSectionVariations(payload.sourceSong, payload.sectionId, payload.input),\n      });\n    }\n    if (kind === "songVariations") {\n      return Promise.resolve({\n        status: "committed",\n        variations: generateSongVariations(payload.sourceSong, payload.config ?? {}),\n      });\n    }\n    return generationRunner.generate(kind, {\n      sourceSong: payload.sourceSong,\n      config: payload.config,\n    });\n  },`;
replaceExact(
  fallbackBefore,
  '  fallback: createAppGenerationFallback({ generationRunner }),',
  "generation fallback",
);

if (source === original) {
  console.log("Phase 1 app boundary codemod: no changes required.");
  process.exit(0);
}

fs.writeFileSync(path, source);
console.log(`Phase 1 app boundary codemod updated src/app.js (${original.length} -> ${source.length} bytes).`);
