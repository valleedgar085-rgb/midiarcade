import fs from "node:fs";

const enginePath = "src/music-engine.js";
let source = fs.readFileSync(enginePath, "utf8");
if (source.includes("function reinforceGrooveMemory(")) {
  console.log("Groove memory is already applied.");
  process.exit(0);
}

const returnAnchor = '  return developDuplicateDrumBars(notes, config, structure, settings, rng.fork("drum-development"), grooveConductor);';
if (!source.includes(returnAnchor)) throw new Error("generateDrums return anchor not found");
source = source.replace(returnAnchor, `  const developedDrums = developDuplicateDrumBars(
    notes,
    config,
    structure,
    settings,
    rng.fork("drum-development"),
    grooveConductor,
  );
  const memoryDrums = reinforceGrooveMemory(
    developedDrums,
    config,
    structure,
    settings,
    rng.fork("groove-memory"),
  );
  return developDuplicateDrumBars(
    memoryDrums,
    config,
    structure,
    settings,
    rng.fork("post-memory-development"),
    grooveConductor,
  );`);

const insertAnchor = "function fitDrumsToRetainedBass(drumNotes, bassNotes, config, structure, settings, rng) {";
if (!source.includes(insertAnchor)) throw new Error("post-drum-development insertion anchor not found");
const helper = `function reinforceGrooveMemory(source, config, structure, settings, rng) {
  if (source.length < 2 || config.bars < 8 || config.genre === "jazz") return source;
  const result = source.map((note) => ({ ...note }));
  const barBeats = beatsPerBar(config);
  const cycleBars = 4;
  const notesForBar = (bar) => {
    const start = bar * barBeats;
    const end = start + barBeats;
    return result.filter((note) => note.start >= start - 1e-6 && note.start < end - 1e-6);
  };
  const sectionForBar = (bar) => structure.find((section) => (
    bar >= section.startBar && bar < section.startBar + section.bars
  )) ?? structure.at(-1);
  const isProtectedBar = (bar) => {
    const section = sectionForBar(bar);
    const barNotes = notesForBar(bar);
    if (!section || bar <= 0 || bar >= config.bars - 1) return true;
    if (bar === section.startBar || bar === section.startBar + section.bars - 1) return true;
    return barNotes.some((note) => (
      note.drumFillId
      || note.transitionFeature
      || note.rhythmicFeature === "phrase-boundary-roll"
      || note.rhythmicFeature === "transition-fill"
    ));
  };
  const averageVelocity = (notes) => notes.length
    ? notes.reduce((sum, note) => sum + finite(note.velocity, 80), 0) / notes.length
    : 80;

  let recalls = 0;
  for (let bar = cycleBars + 1; bar < config.bars; bar += 1) {
    const role = mod(bar, cycleBars);
    if (![1, 2].includes(role) || isProtectedBar(bar)) continue;

    let referenceBar = bar - cycleBars;
    while (referenceBar > 0 && isProtectedBar(referenceBar)) referenceBar -= cycleBars;
    if (referenceBar < 0 || isProtectedBar(referenceBar)) continue;

    const referenceNotes = notesForBar(referenceBar);
    const targetNotes = notesForBar(bar);
    if (!referenceNotes.length || !targetNotes.length) continue;

    const referenceSignature = drumBarSignature(result, referenceBar, barBeats);
    const previousSignature = drumBarSignature(result, bar - 1, barBeats);
    if (!referenceSignature || referenceSignature === previousSignature) continue;

    const sourceStart = referenceBar * barBeats;
    const targetStart = bar * barBeats;
    const velocityRatio = clamp(
      averageVelocity(targetNotes) / Math.max(1, averageVelocity(referenceNotes)),
      0.78,
      1.24,
    );
    const replacement = referenceNotes.map((note, index) => ({
      ...note,
      start: round(targetStart + (note.start - sourceStart), 4),
      velocity: clamp(Math.round(finite(note.velocity, 80) * velocityRatio), 1, 127),
      grooveMemoryRecall: true,
      grooveMemorySourceBar: referenceBar,
      grooveMemoryCycle: cycleBars,
      grooveMemoryVariant: mod(index + rng.int(0, 1), 2),
    }));

    const targetStartBeat = targetStart;
    const targetEndBeat = targetStart + barBeats;
    for (let index = result.length - 1; index >= 0; index -= 1) {
      if (result[index].start >= targetStartBeat - 1e-6 && result[index].start < targetEndBeat - 1e-6) {
        result.splice(index, 1);
      }
    }
    result.push(...replacement);
    recalls += 1;
  }

  if (!recalls) return source;
  return result.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
}

`;
source = source.replace(insertAnchor, helper + insertAnchor);
fs.writeFileSync(enginePath, source);
console.log("Applied Phase 3 groove-memory recall.");
