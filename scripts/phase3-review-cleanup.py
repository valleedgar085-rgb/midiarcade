from pathlib import Path
import re

engine_path = Path("src/music-engine.js")
source = engine_path.read_text()


def sub_once(pattern, replacement, label):
    global source
    source, count = re.subn(pattern, lambda _m: replacement, source, count=1)
    if count != 1:
        raise RuntimeError(f"{label}: expected one replacement, got {count}")


# One mapping controls both Phase 3 fill vocabulary and development behavior.
sub_once(
    r'function phase3DrumFillVocabularyForGenre\(genre\) \{[\s\S]*?\n\}\n\n(?=function generateDrums)',
    '''function phase3DrumFamilyForGenre(genre) {
  if (["house", "techno", "synthwave", "synthPopRadio"].includes(genre)) return "electronic";
  if (["trap", "drill", "drumBass"].includes(genre)) return "bassMusic";
  if (["reggaeton", "afrobeats"].includes(genre)) return "afroLatin";
  if (["rock", "country", "pop", "popRadio"].includes(genre)) return "acoustic";
  return "pocket";
}

function phase3DrumFillVocabularyForGenre(genre) {
  // Preserve the established jazz repair calibration seed and its Phase 40 contract.
  if (genre === "jazz") return [];
  return PHASE3_DRUM_FILL_VOCABULARIES[phase3DrumFamilyForGenre(genre)];
}

''',
    "Phase 3 vocabulary selector",
)
sub_once(
    r'    const phase3Family = \["house", "techno", "synthwave", "synthPopRadio"\][\s\S]*?\n    const phase3Role =',
    '    const phase3Family = phase3DrumFamilyForGenre(config.genre);\n    const phase3Role =',
    "Phase 3 development family",
)

# Pre-bucket notes by bar so groove-memory lookup does not repeatedly scan the whole track.
memory_start = source.index("function reinforceGrooveMemory(")
memory_end = source.index("\nfunction applyFinalGrooveMemory(", memory_start)
optimized_memory = '''function reinforceGrooveMemory(source, config, structure, songBlueprint, grooveConductor) {
  if (source.length < 2 || config.bars < 8 || config.genre === "jazz") return source;
  const barBeats = beatsPerBar(config);
  const phraseBars = clamp(Math.round(finite(grooveConductor?.phraseBars, 2)), 2, 4);
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

  const notesByBar = Array.from({ length: config.bars }, () => []);
  const outsideNotes = [];
  for (const sourceNote of source) {
    const note = { ...sourceNote };
    const bar = Math.floor(note.start / barBeats);
    if (bar >= 0 && bar < config.bars) notesByBar[bar].push(note);
    else outsideNotes.push(note);
  }
  const notesForBar = (bar) => notesByBar[bar] ?? [];
  const signatureForBar = (bar) => notesForBar(bar)
    .map((note) => note.pitch + ":" + round(mod(note.start, barBeats), 4))
    .sort()
    .join("|");
  const isProtectedBar = (bar) => {
    const section = sectionForBar(bar);
    const barNotes = notesForBar(bar);
    if (!section || bar <= 0 || bar >= config.bars - 1) return true;
    if (bar === section.startBar || transitionBars.has(bar)) return true;
    if (mod(bar - section.startBar, phraseBars) === 0) return true;
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
    const targetRole = mod(bar - targetSection.startBar, phraseBars);
    const previousSignature = signatureForBar(bar - 1);
    const candidates = [];
    const coreSectionNames = new Set(["verse", "chorus", "drop"]);
    const targetFamily = coreSectionNames.has(targetSection.name) ? "song-core" : targetSection.name;
    for (let referenceBar = 0; referenceBar <= bar - 2; referenceBar += 1) {
      if (isProtectedBar(referenceBar)) continue;
      const referenceSection = sectionForBar(referenceBar);
      if (!referenceSection) continue;
      const sameSection = referenceSection.name === targetSection.name;
      const referenceFamily = coreSectionNames.has(referenceSection.name) ? "song-core" : referenceSection.name;
      if (!sameSection && referenceFamily !== targetFamily) continue;
      const referenceRole = mod(referenceBar - referenceSection.startBar, phraseBars);
      if (referenceRole !== targetRole) continue;
      const referenceNotes = notesForBar(referenceBar);
      if (!referenceNotes.length) continue;
      const referenceSignature = signatureForBar(referenceBar);
      if (!referenceSignature || referenceSignature === previousSignature) continue;
      candidates.push({ referenceBar, sameSection });
    }
    candidates.sort((left, right) => Number(right.sameSection) - Number(left.sameSection) || left.referenceBar - right.referenceBar);
    const referenceBar = candidates[0]?.referenceBar;
    if (!Number.isInteger(referenceBar)) continue;

    const referenceNotes = notesForBar(referenceBar);
    const targetNotes = notesForBar(bar);
    if (!referenceNotes.length || !targetNotes.length) continue;
    const targetConnectionNote = targetNotes.find((note) => note.connectionId) ?? targetNotes[0];
    const targetStart = bar * barBeats;
    const velocityRatio = clamp(
      averageVelocity(targetNotes) / Math.max(1, averageVelocity(referenceNotes)),
      0.86,
      1.16,
    );
    const replacement = referenceNotes.map((note) => {
      const {
        connectionId: _connectionId,
        connectionRole: _connectionRole,
        sectionPatternId: _sectionPatternId,
        phraseRole: _phraseRole,
        transitionFeature: _transitionFeature,
        transitionHandoffRole: _transitionHandoffRole,
        transitionHandoffId: _transitionHandoffId,
        ensembleCadenceRole: _ensembleCadenceRole,
        sectionId: _sectionId,
        ...rhythmicNote
      } = note;
      return {
        ...rhythmicNote,
        start: round(targetStart + round(mod(note.start, barBeats))),
        velocity: clamp(Math.round(finite(note.velocity, 80) * velocityRatio), 1, 120),
        sectionId: targetSection.id,
        connectionId: targetConnectionNote?.connectionId ?? `interlock:${targetSection.id}`,
        ...(targetConnectionNote?.connectionRole ? { connectionRole: targetConnectionNote.connectionRole } : {}),
        ...(targetConnectionNote?.sectionPatternId ? { sectionPatternId: targetConnectionNote.sectionPatternId } : {}),
        ...(targetConnectionNote?.phraseRole ? { phraseRole: targetConnectionNote.phraseRole } : {}),
        grooveMemoryRecall: true,
        grooveMemorySourceBar: referenceBar,
        grooveMemorySectionRole: targetRole,
      };
    });
    notesByBar[bar] = replacement;
    recalls += 1;
  }

  if (!recalls) return source;
  return [...outsideNotes, ...notesByBar.flat()]
    .sort((left, right) => left.start - right.start || left.pitch - right.pitch);
}
'''.rstrip()
source = source[:memory_start] + optimized_memory + source[memory_end:]

# Expose the rhythm lock that actually runs after groove recall.
for before, after, label in [
    (
        '  finalMaster.report.repairs.finalRhythmLock = finalRhythmLock.repairs;',
        '  finalMaster.report.repairs.finalRhythmLock = finalGrooveRhythmLock.repairs;',
        'final master rhythm lock report',
    ),
    (
        '    finalRhythmLock: { status: "complete", repairs: finalRhythmLock.repairs },',
        '    finalRhythmLock: { status: "complete", repairs: finalGrooveRhythmLock.repairs },',
        'song rhythm lock report',
    ),
]:
    if before not in source:
        raise RuntimeError(label + ' anchor missing')
    source = source.replace(before, after, 1)

# Formatting-independent critic-repair finalization insertion.
finish_start = source.index("function finishRepairedSong(")
finish_end = source.index("\nfunction repairCandidateSong(", finish_start)
finish = source[finish_start:finish_end]
repair_pattern = re.compile(
    r'  const finalProducerIntentAudit = auditProducerIntentContract\(\s*'
    r'postIntentAssembly\.tracks,\s*song\.structure,\s*song\.songBlueprint\?\.producerIntent,\s*'
    r'\);\s*song\.tracks = finalProducerIntentAudit\.tracks;'
)
repair_replacement = '''  const finalProducerIntentAudit = auditProducerIntentContract(
    postIntentAssembly.tracks,
    song.structure,
    song.songBlueprint?.producerIntent,
  );
  const repairedGrooveMemoryTracks = sourceCandidate.targetTrack
    ? finalProducerIntentAudit.tracks
    : applyFinalGrooveMemory(
      finalProducerIntentAudit.tracks,
      config,
      song.structure,
      song.songBlueprint,
      song.grooveConductor,
    );
  const repairedGrooveRhythmLock = lockFinalBassToSurvivingKicks(
    repairedGrooveMemoryTracks,
    config.genre,
    config.bars * beatsPerBar(config),
  );
  const repairedPostGrooveIntentAudit = auditProducerIntentContract(
    repairedGrooveRhythmLock.tracks,
    song.structure,
    song.songBlueprint?.producerIntent,
  );
  const repairedFinalGrooveAssembly = runFinalAssemblyPass(
    repairedPostGrooveIntentAudit.tracks,
    finalProducerIntentAudit.tracks,
    song.structure,
    song.songBlueprint,
  );
  song.tracks = repairedFinalGrooveAssembly.tracks;
  finalMaster.report.repairs.finalRhythmLock = repairedGrooveRhythmLock.repairs;
  song.finalRhythmLock = { status: "complete", repairs: repairedGrooveRhythmLock.repairs };'''
finish, count = repair_pattern.subn(lambda _m: repair_replacement, finish, count=1)
if count != 1:
    raise RuntimeError(f"critic-repair groove finalization: expected one replacement, got {count}")

for before, after, label in [
    (
        '      featuredAnchorsRestored: finalAssemblyRepair.repairs.featuredAnchorsRestored\n        + postIntentAssembly.repairs.featuredAnchorsRestored,',
        '      featuredAnchorsRestored: finalAssemblyRepair.repairs.featuredAnchorsRestored\n        + postIntentAssembly.repairs.featuredAnchorsRestored\n        + repairedFinalGrooveAssembly.repairs.featuredAnchorsRestored,',
        'critic repair featured report',
    ),
    (
        '      transitionEventsTagged: finalAssemblyRepair.repairs.transitionEventsTagged\n        + postIntentAssembly.repairs.transitionEventsTagged,',
        '      transitionEventsTagged: finalAssemblyRepair.repairs.transitionEventsTagged\n        + postIntentAssembly.repairs.transitionEventsTagged\n        + repairedFinalGrooveAssembly.repairs.transitionEventsTagged,',
        'critic repair transition report',
    ),
    (
        '  song.producerIntentReport = finalProducerIntentAudit.report;',
        '  song.producerIntentReport = repairedPostGrooveIntentAudit.report;',
        'critic repair producer intent report',
    ),
]:
    if before not in finish:
        raise RuntimeError(label + ' anchor missing')
    finish = finish.replace(before, after, 1)
source = source[:finish_start] + finish + source[finish_end:]
engine_path.write_text(source)

# Preserve bar positions in clone detection; empty bars are not clones.
test_path = Path("tests/groove-intelligence.test.mjs")
tests = test_path.read_text()
old_tail = '    .join("|"))\n    .filter(Boolean);'
new_tail = '    .join("|"));'
if old_tail not in tests:
    raise RuntimeError("critic bar-signature test anchor missing")
tests = tests.replace(old_tail, new_tail, 1)
old_adjacent = '    const adjacentCopies = signatures.slice(1).filter((signature, index) => signature === signatures[index]);'
new_adjacent = '    const adjacentCopies = signatures.slice(1).filter((signature, index) => signature && signatures[index] && signature === signatures[index]);'
if old_adjacent not in tests:
    raise RuntimeError("adjacent clone test anchor missing")
tests = tests.replace(old_adjacent, new_adjacent, 1)
test_path.write_text(tests)

print("Applied all Phase 3 review cleanup items.")
