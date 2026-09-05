import fs from "node:fs";

const enginePath = "src/music-engine.js";
const testPath = "tests/groove-intelligence.test.mjs";
let source = fs.readFileSync(enginePath, "utf8");

const marker = "PHASE3_DRUM_FILL_VOCABULARIES";
if (source.includes(marker)) {
  console.log("Phase 3 groove intelligence is already applied.");
  process.exit(0);
}

const generateAnchor = "function generateDrums(config, structure, _harmony, style, settings, rng, songBlueprint = null, grooveConductor = null) {";
if (!source.includes(generateAnchor)) throw new Error("generateDrums anchor not found");

const vocabularyBlock = `const PHASE3_DRUM_FILL_VOCABULARIES = deepFreeze({
  electronic: [
    { id: "p3-electronic-open-hat-turn", pitches: [42, 46, 42, 51], positions: [0, 0.25, 0.625, 0.875] },
    { id: "p3-electronic-tom-push", pitches: [45, 47, 50, 46], positions: [0, 0.375, 0.625, 0.875] },
    { id: "p3-electronic-clap-lift", pitches: [39, 42, 46, 49], positions: [0, 0.25, 0.625, 0.875] },
    { id: "p3-electronic-hat-stutter", pitches: [42, 42, 46, 42], positions: [0, 0.1875, 0.5, 0.875] },
  ],
  bassMusic: [
    { id: "p3-bass-hat-triplet", pitches: [42, 42, 46, 38], positions: [0, 1 / 6, 1 / 3, 0.75] },
    { id: "p3-bass-snare-drag", pitches: [38, 37, 38, 42], positions: [0, 0.375, 0.625, 0.875] },
    { id: "p3-bass-kick-response", pitches: [36, 42, 38, 46], positions: [0, 0.25, 0.625, 0.875] },
    { id: "p3-bass-break-turn", pitches: [42, 38, 42, 46], positions: [0, 0.3125, 0.625, 0.875] },
  ],
  acoustic: [
    { id: "p3-acoustic-tom-round", pitches: [45, 47, 50, 38], positions: [0, 0.25, 0.5, 0.875] },
    { id: "p3-acoustic-hat-snare-lift", pitches: [42, 46, 38, 49], positions: [0, 0.375, 0.625, 0.875] },
    { id: "p3-acoustic-side-stick-turn", pitches: [37, 42, 38, 46], positions: [0, 0.25, 0.625, 0.875] },
    { id: "p3-acoustic-tom-answer", pitches: [47, 45, 42, 38], positions: [0, 0.375, 0.75, 0.875] },
  ],
  pocket: [
    { id: "p3-pocket-ghost-lift", pitches: [37, 42, 38, 46], positions: [0, 0.375, 0.625, 0.875] },
    { id: "p3-pocket-shaker-answer", pitches: [70, 42, 37, 46], positions: [0, 0.25, 0.625, 0.875] },
    { id: "p3-pocket-rim-clave", pitches: [37, 75, 42, 38], positions: [0, 0.375, 0.625, 0.875] },
    { id: "p3-pocket-hat-pocket", pitches: [42, 37, 46, 42], positions: [0, 0.3125, 0.625, 0.875] },
  ],
  afroLatin: [
    { id: "p3-afro-clave-shaker", pitches: [75, 70, 75, 46], positions: [0, 0.25, 0.625, 0.875] },
    { id: "p3-afro-rim-percussion", pitches: [37, 70, 39, 75], positions: [0, 0.375, 0.625, 0.875] },
    { id: "p3-afro-conga-answer", pitches: [64, 70, 63, 75], positions: [0, 0.25, 0.625, 0.875] },
    { id: "p3-afro-shaker-turn", pitches: [70, 75, 70, 46], positions: [0, 0.3125, 0.625, 0.875] },
  ],
});

function phase3DrumFillVocabularyForGenre(genre) {
  if (["house", "techno", "synthwave", "synthPopRadio"].includes(genre)) return PHASE3_DRUM_FILL_VOCABULARIES.electronic;
  if (["trap", "drill", "drumBass"].includes(genre)) return PHASE3_DRUM_FILL_VOCABULARIES.bassMusic;
  if (["reggaeton", "afrobeats"].includes(genre)) return PHASE3_DRUM_FILL_VOCABULARIES.afroLatin;
  if (["rock", "country", "pop", "popRadio"].includes(genre)) return PHASE3_DRUM_FILL_VOCABULARIES.acoustic;
  return PHASE3_DRUM_FILL_VOCABULARIES.pocket;
}

`;
source = source.replace(generateAnchor, vocabularyBlock + generateAnchor);

const oldVocabularyLine = "      const vocabulary = drumFillVocabularyForGenre(config.genre);";
const newVocabularyLine = "      const vocabulary = [...drumFillVocabularyForGenre(config.genre), ...phase3DrumFillVocabularyForGenre(config.genre)];";
if (!source.includes(oldVocabularyLine)) throw new Error("drum fill selection anchor not found");
source = source.replace(oldVocabularyLine, newVocabularyLine);

const phraseAnchor = "    const phraseEnd = evolution.phraseEnd;\n    const featuredGenre = config.genre === \"trap\" || config.genre === \"drumBass\";";
if (!source.includes(phraseAnchor)) throw new Error("phrase development anchor not found");

const phase3Development = `    const phraseEnd = evolution.phraseEnd;

    // Phase 3: evolve one restrained, genre-native detail per bar. Core kick/snare
    // anchors are never deleted or moved; this layer creates statement/answer/lift/
    // cadence contrast so repeated sections retain identity without cloning bars.
    const phase3Family = ["house", "techno", "synthwave", "synthPopRadio"].includes(config.genre)
      ? "electronic"
      : ["trap", "drill", "drumBass"].includes(config.genre)
        ? "bassMusic"
        : ["reggaeton", "afrobeats"].includes(config.genre)
          ? "afroLatin"
          : ["rock", "country", "pop", "popRadio"].includes(config.genre)
            ? "acoustic"
            : "pocket";
    const phase3Role = phraseEnd
      ? "cadence"
      : evolution.barInPhrase === 0
        ? "statement"
        : evolution.barInPhrase === 1
          ? "answer"
          : "lift";
    const phase3Rng = phraseRng.fork(\`phase3-groove-\${phase3Role}-\${evolution.phraseIndex}\`);
    const phase3Variant = mod(evolution.phraseIndex + bar + phase3Rng.int(0, 2), 3);
    const phase3Strength = clamp(0.48 + settings.variation * 0.2 + config.evolution * 0.18 + config.energy * 0.12, 0.48, 0.88);
    const phase3Meta = {
      rhythmicFeature: "phase3-groove-development",
      grooveRole: phase3Role,
      grooveFamily: phase3Family,
      grooveVariant: phase3Variant,
    };
    const phase3Add = (pitches, offsets, scale = 0.62, duration = 0.07) => {
      const pitch = pitches[phase3Variant % pitches.length];
      const offset = Math.min(Math.max(0, offsets[phase3Variant % offsets.length]), Math.max(0, barBeats - 0.0625));
      return hit(
        pitch,
        start + offset,
        eventVelocity(config, settings, intensity, phase3Rng.fork(\`detail-\${pitch}-\${offset}\`), scale),
        duration,
        phase3Meta,
      );
    };

    if (phase3Role === "statement") {
      if (phase3Rng.bool(phase3Strength * 0.58)) {
        if (phase3Family === "afroLatin") phase3Add([70, 75, 70], [0.75, 1.25, 2.75], 0.52);
        else if (phase3Family === "electronic") phase3Add([42, 42, 46], [0.75, 1.75, 2.75], 0.5);
        else phase3Add([42, 37, 42], [0.75, 1.5, 2.75], 0.48);
      }
    } else if (phase3Role === "answer") {
      if (phase3Family === "electronic") phase3Add([46, 42, 51], [1.5, 2.5, 3.5], 0.58);
      else if (phase3Family === "bassMusic") phase3Add([42, 37, 46], [1.75, 2.75, 3.25], 0.54);
      else if (phase3Family === "afroLatin") phase3Add([75, 70, 63], [1.25, 2.25, 3.25], 0.56);
      else if (phase3Family === "acoustic") phase3Add([37, 42, 46], [1.5, 2.5, 3.5], 0.52);
      else phase3Add([37, 42, 70], [1.25, 2.5, 3.25], 0.5);
    } else if (phase3Role === "lift") {
      if (phase3Family === "electronic") phase3Add([46, 42, 39], [2.25, 2.75, 3.25], 0.62);
      else if (phase3Family === "bassMusic") phase3Add([42, 46, 38], [2 + 1 / 3, 2.75, 3 + 1 / 6], 0.58);
      else if (phase3Family === "afroLatin") phase3Add([70, 75, 64], [2.25, 2.75, 3.25], 0.6);
      else if (phase3Family === "acoustic") phase3Add([42, 47, 46], [2.25, 2.75, 3.25], 0.58);
      else phase3Add([42, 37, 46], [2.25, 2.75, 3.25], 0.54);
    } else {
      if (phase3Family === "electronic") phase3Add([46, 49, 39], [3.25, 3.5, 3.75], 0.68);
      else if (phase3Family === "bassMusic") phase3Add([38, 42, 46], [3 + 1 / 6, 3.5, 3.75], 0.64);
      else if (phase3Family === "afroLatin") phase3Add([75, 70, 63], [3.25, 3.5, 3.75], 0.64);
      else if (phase3Family === "acoustic") phase3Add([47, 50, 38], [3.25, 3.5, 3.75], 0.62);
      else phase3Add([37, 42, 46], [3.25, 3.5, 3.75], 0.58);
    }

    const featuredGenre = config.genre === "trap" || config.genre === "drumBass";`;
source = source.replace(phraseAnchor, phase3Development);

fs.writeFileSync(enginePath, source);

const testSource = `import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSongCandidate, generateNew } from "../src/music-engine.js";

const TARGET_GENRES = ["rnbSoul", "techno", "trap", "drumBass", "reggaeton", "afrobeats"];

function drumSignature(song) {
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  return drums.map(({ pitch, start, velocity }) => [pitch, start, velocity]);
}

test("phase 3 groove intelligence is deterministic and leaves bounded genre-native development", () => {
  for (const genre of TARGET_GENRES) {
    const options = { genre, seed: \`phase3-groove-test:\${genre}\`, bars: 16, candidateCount: 1 };
    const first = generateNew(options);
    const second = generateNew(options);
    assert.deepEqual(drumSignature(first), drumSignature(second), \`\${genre} drums must remain deterministic\`);

    const drums = first.tracks.find((track) => track.id === "drums")?.notes ?? [];
    const developed = drums.filter((note) => note.rhythmicFeature === "phase3-groove-development");
    assert.ok(developed.length >= 4, \`\${genre} should develop multiple bars without flooding the groove\`);
    assert.ok(developed.length <= 20, \`\${genre} development must remain bounded\`);
    assert.ok(developed.every((note) => note.velocity >= 1 && note.velocity <= 127));
  }
});

test("phase 3 target genres keep a healthy drum-variety floor without weakening critic validity", () => {
  for (const genre of TARGET_GENRES) {
    const song = generateNew({ genre, seed: \`phase3-quality-test:\${genre}\`, bars: 16, candidateCount: 1 });
    const evaluation = evaluateSongCandidate(song);
    assert.ok(evaluation.subscores.drumVariety >= 72, \`\${genre} drum variety fell to \${evaluation.subscores.drumVariety}\`);
    assert.ok(Number.isFinite(evaluation.score) && evaluation.score > 0);
  }
});
`;
fs.writeFileSync(testPath, testSource);
console.log("Applied Phase 3 groove intelligence and tests.");
