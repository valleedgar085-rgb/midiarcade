import fs from "node:fs";

const enginePath = "src/music-engine.js";
let source = fs.readFileSync(enginePath, "utf8");
if (source.includes("function reinforceGrooveMemory(")) {
  console.log("Groove memory is already applied.");
  process.exit(0);
}

const insertAnchor = "function fitDrumsToRetainedBass(drumNotes, bassNotes, config, structure, settings, rng) {";
if (!source.includes(insertAnchor)) throw new Error("post-drum-development insertion anchor not found");
const helper = `function reinforceGrooveMemory(source, config, structure, rng) {
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
      || note.transitionHandoffRole
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
      0.82,
      1.2,
    );
    const replacement = referenceNotes.map((note) => ({
      ...note,
      start: round(targetStart + (note.start - sourceStart), 4),
      velocity: clamp(Math.round(finite(note.velocity, 80) * velocityRatio), 1, 127),
      grooveMemoryRecall: true,
      grooveMemorySourceBar: referenceBar,
      grooveMemoryCycle: cycleBars,
    }));

    const targetEnd = targetStart + barBeats;
    for (let index = result.length - 1; index >= 0; index -= 1) {
      if (result[index].start >= targetStart - 1e-6 && result[index].start < targetEnd - 1e-6) {
        result.splice(index, 1);
      }
    }
    result.push(...replacement);
    recalls += 1;
  }

  if (!recalls) return source;
  return result.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
}

function applyFinalGrooveMemory(tracks, config, structure, rng) {
  return tracks.map((track) => track.id === "drums"
    ? { ...track, notes: reinforceGrooveMemory(track.notes, config, structure, rng) }
    : track);
}

`;
source = source.replace(insertAnchor, helper + insertAnchor);

const finalAnchor = `  const finalScaleSafety = enforceScaleSafety(finalMaster.tracks, config);
  const finalRhythmLock = lockFinalBassToSurvivingKicks(finalScaleSafety.tracks, config.genre, totalBeats);`;
if (!source.includes(finalAnchor)) throw new Error("final rhythm-lock anchor not found");
source = source.replace(finalAnchor, `  const finalScaleSafety = enforceScaleSafety(finalMaster.tracks, config);
  // Phase 3 late groove memory: establish recurring rhythmic identity only after
  // the broad producer/mastering passes, then let the existing bass lock and
  // final producer-intent/assembly audits validate the output listeners receive.
  const finalGrooveMemoryTracks = applyFinalGrooveMemory(
    finalScaleSafety.tracks,
    config,
    structure,
    rootRng.fork("phase3-final-groove-memory"),
  );
  const finalRhythmLock = lockFinalBassToSurvivingKicks(finalGrooveMemoryTracks, config.genre, totalBeats);`);

fs.writeFileSync(enginePath, source);
console.log("Applied Phase 3 late groove-memory recall.");
