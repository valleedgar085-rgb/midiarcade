import fs from "node:fs";

const enginePath = "src/music-engine.js";
let source = fs.readFileSync(enginePath, "utf8");
if (source.includes("function reinforceGrooveMemory(")) {
  console.log("Groove memory is already applied.");
  process.exit(0);
}

const insertAnchor = "function fitDrumsToRetainedBass(drumNotes, bassNotes, config, structure, settings, rng) {";
if (!source.includes(insertAnchor)) throw new Error("post-drum-development insertion anchor not found");
const helper = `function reinforceGrooveMemory(source, config, structure, songBlueprint) {
  if (source.length < 2 || config.bars < 8 || config.genre === "jazz") return source;
  const result = source.map((note) => ({ ...note }));
  const barBeats = beatsPerBar(config);
  const sectionForBar = (bar) => structure.find((section) => (
    bar >= section.startBar && bar < section.startBar + section.bars
  )) ?? structure.at(-1);
  const transitionBars = new Set();
  for (const transition of songBlueprint?.transitions ?? []) {
    const from = structure.find((section) => section.id === transition.fromSectionId);
    const to = structure.find((section) => section.id === transition.toSectionId);
    if (from) transitionBars.add(from.startBar + from.bars - 1);
    if (to) transitionBars.add(to.startBar);
  }
  const notesForBar = (bar) => {
    const start = bar * barBeats;
    const end = start + barBeats;
    return result.filter((note) => note.start >= start - 1e-6 && note.start < end - 1e-6);
  };
  const isProtectedBar = (bar) => {
    const section = sectionForBar(bar);
    const barNotes = notesForBar(bar);
    if (!section || bar <= 0 || bar >= config.bars - 1) return true;
    if (bar === section.startBar || transitionBars.has(bar)) return true;
    return barNotes.some((note) => (
      note.drumFillId
      || note.transitionFeature
      || note.transitionHandoffRole
      || note.transitionHandoffId
      || note.rhythmicFeature === "phrase-boundary-roll"
      || note.rhythmicFeature === "transition-fill"
    ));
  };
  const averageVelocity = (notes) => notes.length
    ? notes.reduce((sum, note) => sum + finite(note.velocity, 80), 0) / notes.length
    : 80;

  let recalls = 0;
  for (let bar = 2; bar < config.bars - 1; bar += 1) {
    if (isProtectedBar(bar)) continue;
    const targetSection = sectionForBar(bar);
    if (!targetSection) continue;
    const targetRole = bar - targetSection.startBar;
    const previousSignature = drumBarSignature(result, bar - 1, barBeats);

    // Repeated sections should remember the same interior groove role. Use the
    // earliest compatible role as the canonical template so later choruses,
    // drops, verses, etc. sound related instead of continually inventing a new bar.
    const candidates = [];
    for (let referenceBar = 0; referenceBar <= bar - 2; referenceBar += 1) {
      if (isProtectedBar(referenceBar)) continue;
      const referenceSection = sectionForBar(referenceBar);
      if (!referenceSection || referenceSection.name !== targetSection.name) continue;
      const referenceRole = referenceBar - referenceSection.startBar;
      if (referenceRole !== targetRole) continue;
      const referenceNotes = notesForBar(referenceBar);
      if (!referenceNotes.length) continue;
      const referenceSignature = drumBarSignature(result, referenceBar, barBeats);
      if (!referenceSignature || referenceSignature === previousSignature) continue;
      candidates.push(referenceBar);
    }
    const referenceBar = candidates[0];
    if (!Number.isInteger(referenceBar)) continue;

    const referenceNotes = notesForBar(referenceBar);
    const targetNotes = notesForBar(bar);
    if (!referenceNotes.length || !targetNotes.length) continue;
    const sourceStart = referenceBar * barBeats;
    const targetStart = bar * barBeats;
    const velocityRatio = clamp(
      averageVelocity(targetNotes) / Math.max(1, averageVelocity(referenceNotes)),
      0.86,
      1.16,
    );
    const replacement = referenceNotes.map((note) => {
      const {
        connectionId: _connectionId,
        transitionFeature: _transitionFeature,
        transitionHandoffRole: _transitionHandoffRole,
        transitionHandoffId: _transitionHandoffId,
        ensembleCadenceRole: _ensembleCadenceRole,
        sectionId: _sectionId,
        ...rhythmicNote
      } = note;
      return {
        ...rhythmicNote,
        start: round(targetStart + (note.start - sourceStart), 4),
        velocity: clamp(Math.round(finite(note.velocity, 80) * velocityRatio), 1, 127),
        sectionId: targetSection.id,
        grooveMemoryRecall: true,
        grooveMemorySourceBar: referenceBar,
        grooveMemorySectionRole: targetRole,
      };
    });

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

function applyFinalGrooveMemory(tracks, config, structure, songBlueprint) {
  return tracks.map((track) => track.id === "drums"
    ? { ...track, notes: reinforceGrooveMemory(track.notes, config, structure, songBlueprint) }
    : track);
}

`;
source = source.replace(insertAnchor, helper + insertAnchor);

const finalAnchor = `  const finalProducerIntentAudit = auditProducerIntentContract(
    postIntentAssembly.tracks,
    structure,
    songBlueprint.producerIntent,
  );
  const tracks = finalProducerIntentAudit.tracks;`;
if (!source.includes(finalAnchor)) throw new Error("final producer-intent anchor not found");
source = source.replace(finalAnchor, `  const finalProducerIntentAudit = auditProducerIntentContract(
    postIntentAssembly.tracks,
    structure,
    songBlueprint.producerIntent,
  );
  // Phase 3 groove memory runs only after the existing producer/master pipeline
  // has converged. It recalls matching interior roles from repeated sections,
  // never transition boundary bars. Bass is re-locked to the surviving kick
  // pattern, producer intent is re-audited, and final assembly gets the last word.
  const finalGrooveMemoryTracks = applyFinalGrooveMemory(
    finalProducerIntentAudit.tracks,
    config,
    structure,
    songBlueprint,
  );
  const finalGrooveRhythmLock = lockFinalBassToSurvivingKicks(
    finalGrooveMemoryTracks,
    config.genre,
    totalBeats,
  );
  const postGrooveIntentAudit = auditProducerIntentContract(
    finalGrooveRhythmLock.tracks,
    structure,
    songBlueprint.producerIntent,
  );
  const finalGrooveAssembly = runFinalAssemblyPass(
    postGrooveIntentAudit.tracks,
    finalProducerIntentAudit.tracks,
    structure,
    songBlueprint,
  );
  const tracks = finalGrooveAssembly.tracks;`);

const featuredReport = `      featuredAnchorsRestored: finalAssemblyRepair.repairs.featuredAnchorsRestored
        + postIntentAssembly.repairs.featuredAnchorsRestored,`;
if (!source.includes(featuredReport)) throw new Error("featured assembly report anchor not found");
source = source.replace(featuredReport, `      featuredAnchorsRestored: finalAssemblyRepair.repairs.featuredAnchorsRestored
        + postIntentAssembly.repairs.featuredAnchorsRestored
        + finalGrooveAssembly.repairs.featuredAnchorsRestored,`);

const transitionReport = `      transitionEventsTagged: finalAssemblyRepair.repairs.transitionEventsTagged
        + postIntentAssembly.repairs.transitionEventsTagged,`;
if (!source.includes(transitionReport)) throw new Error("transition assembly report anchor not found");
source = source.replace(transitionReport, `      transitionEventsTagged: finalAssemblyRepair.repairs.transitionEventsTagged
        + postIntentAssembly.repairs.transitionEventsTagged
        + finalGrooveAssembly.repairs.transitionEventsTagged,`);

const intentReport = "    producerIntentReport: finalProducerIntentAudit.report,";
if (!source.includes(intentReport)) throw new Error("producer intent report anchor not found");
source = source.replace(intentReport, "    producerIntentReport: postGrooveIntentAudit.report,");

fs.writeFileSync(enginePath, source);
console.log("Applied Phase 3 canonical groove memory after final intent audit.");
