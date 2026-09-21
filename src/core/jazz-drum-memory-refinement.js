import { cloneValue } from "./clone-value.js";
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round4 = (value) => Math.round((finite(value) + Number.EPSILON) * 1e4) / 1e4;
const round6 = (value) => Math.round((finite(value) + Number.EPSILON) * 1e6) / 1e6;
const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
const clamp = (value, min, max) => Math.min(max, Math.max(min, finite(value, min)));
const JAZZ_SYNCOPATION_TARGET = 0.68;
const JAZZ_REPETITION_TARGET = 0.46;
const JAZZ_BACKBEATS = 2;
const JAZZ_BASS_LOCK_TARGET = 0.46;
const KICK_PITCHES = new Set([35, 36]);
const SNARE_PITCHES = new Set([37, 38, 39, 40]);
const JAZZ_CYMBAL_COLOR_FAMILY = Object.freeze([42, 44, 46, 51, 53, 59]);
const JAZZ_TOM_COLOR_FAMILY = Object.freeze([41, 43, 45, 47, 48, 50]);

function sectionsOf(song) {
  return Array.isArray(song?.structure) ? song.structure : Array.isArray(song?.sections) ? song.sections : [];
}

function startOf(section) {
  return finite(section?.startBeat, finite(section?.start));
}

function endOf(section) {
  return finite(section?.endBeat, startOf(section) + finite(section?.bars) * 4);
}

function nameOf(section) {
  return String(section?.name ?? section?.type ?? "idea").toLowerCase().replace(/[^a-z]+/g, "");
}

function sectionPairs(song) {
  const sections = sectionsOf(song);
  const byId = new Map(sections.map((section) => [String(section.id), section]));
  const mapped = (Array.isArray(song?.memoryMap) ? song.memoryMap : [])
    .filter((entry) => ["recall", "return"].includes(String(entry?.relationship)))
    .map((entry) => ({ origin: byId.get(String(entry.originSectionId)), target: byId.get(String(entry.sectionId)) }))
    .filter(({ origin, target }) => origin && target && origin !== target);
  if (mapped.length) return mapped;
  const first = new Map();
  const fallback = [];
  for (const section of sections) {
    const name = nameOf(section);
    if (!first.has(name)) first.set(name, section);
    else fallback.push({ origin: first.get(name), target: section });
  }
  return fallback;
}

function notesForBar(song, bar) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  return (song.tracks?.find((track) => track.id === "drums")?.notes ?? [])
    .filter((note) => Math.floor(finite(note.start) / barBeats) === bar);
}

function protectedNote(note) {
  const feature = String(note?.rhythmicFeature ?? "");
  return Boolean(note?.drumFillId || note?.transitionFeature || note?.transitionHandoffRole
    || note?.transitionHandoffId || feature.includes("fill") || feature.includes("roll"));
}

function protectedBar(song, bar) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const bars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  if (bar <= 0 || bar >= bars - 1 || notesForBar(song, bar).some(protectedNote)) return true;
  return sectionsOf(song).some((section) => {
    const first = Math.floor(startOf(section) / barBeats + 1e-6);
    const last = Math.max(first, Math.ceil(endOf(section) / barBeats - 1e-6) - 1);
    return bar === first || bar === last;
  });
}

function sectionBarIndices(section, barBeats) {
  const first = Math.floor(startOf(section) / barBeats + 1e-6);
  const last = Math.max(first, Math.ceil(endOf(section) / barBeats - 1e-6) - 1);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
}

function rhythmicOffbeatCount(notes) {
  return notes.filter((note) => Math.abs(finite(note.start) - Math.round(finite(note.start))) > 0.08).length;
}

function kickSnareSkeletonSignature(notes, barBeats) {
  return notes
    .filter((note) => KICK_PITCHES.has(Number(note.pitch)) || SNARE_PITCHES.has(Number(note.pitch)))
    .map((note) => `${Number(note.pitch)}:${round6(mod(finite(note.start), barBeats))}`)
    .sort()
    .join("|");
}

function pocketCompatibleRecall(sourceNotes, targetNotes, barBeats) {
  return sourceNotes.length === targetNotes.length
    && rhythmicOffbeatCount(sourceNotes) === rhythmicOffbeatCount(targetNotes)
    && kickSnareSkeletonSignature(sourceNotes, barBeats) === kickSnareSkeletonSignature(targetNotes, barBeats);
}

function drumSignature(song, bar) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  return notesForBar(song, bar)
    .map((note) => `${note.pitch}:${round6(mod(finite(note.start), barBeats))}`)
    .join("|");
}

export function adjacentDrumDuplicateCount(song) {
  const bars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  const signatures = Array.from({ length: bars }, (_, bar) => drumSignature(song, bar)).filter(Boolean);
  return signatures.slice(1).filter((signature, index) => signature === signatures[index]).length;
}

function average(values, fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function phraseRepetition(song, melodyNotes) {
  const length = finite(song?.motifs?.melody?.lengthBeats, 0);
  if (length <= 0 || melodyNotes.length < 4) return 0.55;
  const signatures = [];
  for (const section of song?.structure ?? []) {
    const repeats = Math.min(4, Math.floor((finite(section?.endBeat) - finite(section?.startBeat)) / length));
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const start = finite(section?.startBeat) + repeat * length;
      const notes = melodyNotes.filter((note) => finite(note?.start) >= start - 1e-6 && finite(note?.start) < start + length - 1e-6);
      if (notes.length < 2) continue;
      signatures.push(new Set(notes.map((note) => `${Math.round((finite(note?.start) - start) * 4) / 4}`)));
    }
  }
  if (signatures.length < 2) return 0.55;
  const reference = signatures[0];
  return average(signatures.slice(1).map((signature) => {
    const shared = [...reference].filter((item) => signature.has(item)).length;
    return shared / Math.max(1, Math.min(reference.size, signature.size));
  }), 0.55);
}

function drumVarietyScore(song, drumNotes) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const bars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  const signatures = Array.from({ length: bars }, (_, bar) => drumNotes
    .filter((note) => Math.floor(finite(note.start) / barBeats) === bar)
    .map((note) => `${note.pitch}:${round4(mod(finite(note.start), barBeats))}`)
    .join("|"));
  const populated = signatures.filter(Boolean);
  if (populated.length < 2) return 58;
  const uniqueRatio = new Set(populated).size / populated.length;
  const adjacentCopies = populated.slice(1)
    .filter((signature, index) => signature === populated[index]).length / Math.max(1, populated.length - 1);
  const usefulVariation = 1 - Math.abs(uniqueRatio - 0.58) / 0.58;
  const rememberedBars = new Set(drumNotes
    .filter((note) => note?.jazzMemoryPocketRecall === true
      || note?.jazzMemoryColorRecall === true
      || note?.jazzMemoryGlobalRecall === true)
    .map((note) => Math.floor(finite(note.start) / barBeats))).size;
  const memoryDevelopmentCredit = Math.min(6, rememberedBars * 4);
  return clamp(Math.round(
    48
    + clamp(usefulVariation, 0, 1) * 34
    + (1 - adjacentCopies) * 18
    + memoryDevelopmentCredit
  ), 25, 100);
}

function onsetMatchRatio(notes, targets, offsets, tolerance = 0.075) {
  if (!notes.length || !targets.length) return 0;
  const matched = notes.filter((note) => targets.some((target) => offsets.some((offset) => (
    Math.abs(finite(note.start) - finite(target.start) - offset) <= tolerance
  )))).length;
  return matched / notes.length;
}

function jazzRhythmMetrics(song, drumNotes) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const bars = Math.max(1, finite(song?.meta?.bars, song?.bars ?? 1));
  const bass = song?.tracks?.find((track) => track.id === "bass")?.notes ?? [];
  const melody = song?.tracks?.find((track) => track.id === "melody")?.notes ?? [];
  const kicks = drumNotes.filter((note) => KICK_PITCHES.has(Number(note.pitch)));
  const snares = drumNotes.filter((note) => SNARE_PITCHES.has(Number(note.pitch)));
  const downbeatCoverage = kicks.length
    ? new Set(kicks
      .filter((note) => Math.abs(mod(finite(note.start), barBeats)) < 0.08)
      .map((note) => Math.floor(finite(note.start) / barBeats))).size / bars
    : 0;
  const backbeatCoverage = clamp(snares.length / Math.max(1, bars * JAZZ_BACKBEATS), 0, 1);
  const bassLock = onsetMatchRatio(bass, kicks, [0, 0.25, 0.5, 0.75], 0.075);
  const groove = clamp(Math.round(
    42 + downbeatCoverage * 16 + backbeatCoverage * 18 + bassLock * 24
  ), 25, 100);
  const rhythmicNotes = [...drumNotes, ...bass, ...melody];
  const measuredSyncopation = rhythmicNotes.length
    ? rhythmicNotes.filter((note) => Math.abs(finite(note.start) - Math.round(finite(note.start))) > 0.08).length / rhythmicNotes.length
    : JAZZ_SYNCOPATION_TARGET;
  const syncopationFit = clamp(
    Math.round(100 - Math.abs(measuredSyncopation - JAZZ_SYNCOPATION_TARGET) * 135),
    25,
    100,
  );
  const bassLockFit = clamp(
    Math.round(bassLock / Math.max(0.1, JAZZ_BASS_LOCK_TARGET) * 100),
    25,
    100,
  );
  const pitched = song?.tracks?.filter((track) => track.id !== "drums").flatMap((track) => track.notes ?? []) ?? [];
  const notesPerBar = pitched.length / bars;
  const density = clamp(Math.round(
    100 - Math.abs(notesPerBar - 36) / 36 * 42
  ), 35, 100);
  const repetitionRatio = phraseRepetition(song, melody);
  const repetitionTarget = average([
    finite(song?.songBlueprint?.qualityTargets?.repetition, JAZZ_REPETITION_TARGET),
    JAZZ_REPETITION_TARGET,
  ], JAZZ_REPETITION_TARGET);
  const repetition = clamp(Math.round(
    100 - Math.abs(repetitionRatio - repetitionTarget) * 125
  ), 30, 100);
  const authenticity = clamp(Math.round(
    density * 0.2
    + repetition * 0.2
    + syncopationFit * 0.25
    + backbeatCoverage * 100 * 0.15
    + bassLockFit * 0.2
  ), 20, 100);
  return {
    groove,
    authenticity,
    density,
    repetition,
    measuredSyncopation,
    syncopationFit,
    backbeatCoverage,
    bassLock,
    bassLockFit,
  };
}

function noteKey(note) {
  return [
    Number(note?.pitch),
    round6(finite(note?.start)),
    round6(finite(note?.duration, 0.25)),
  ].join(":");
}

function uniqueNotes(notes) {
  const seen = new Set();
  return notes.filter((note) => {
    const key = noteKey(note);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function barTimingSignature(notes) {
  return notes
    .map((note) => `${round6(finite(note?.start))}:${round6(finite(note?.duration, 0.25))}`)
    .sort()
    .join("|");
}

function shiftedSourceNotes(sourceNotes, delta) {
  return sourceNotes.map((note) => ({
    ...cloneValue(note),
    start: round6(finite(note.start) + delta),
  }));
}

function targetSkeleton(notes) {
  return notes.filter((note) => KICK_PITCHES.has(Number(note.pitch)) || SNARE_PITCHES.has(Number(note.pitch)));
}

function sourceOrnaments(notes) {
  return notes.filter((note) => !KICK_PITCHES.has(Number(note.pitch)) && !SNARE_PITCHES.has(Number(note.pitch)));
}

function jazzDevelopedColorPitches(pitch) {
  const value = Number(pitch);
  const family = JAZZ_CYMBAL_COLOR_FAMILY.includes(value)
    ? JAZZ_CYMBAL_COLOR_FAMILY
    : JAZZ_TOM_COLOR_FAMILY.includes(value)
      ? JAZZ_TOM_COLOR_FAMILY
      : JAZZ_CYMBAL_COLOR_FAMILY;
  return family.filter((candidate) => candidate !== value);
}

function ornamentVariants(shifted, targetNotes) {
  const ornaments = sourceOrnaments(shifted)
    .sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  const skeleton = targetSkeleton(targetNotes).map(cloneValue);
  const variants = [];
  const originalTarget = targetNotes.map(cloneValue);
  const targetOrnaments = sourceOrnaments(targetNotes)
    .sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  const sourceOrnamentPool = sourceOrnaments(shifted)
    .sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  const offbeatClass = (note) => Math.abs(finite(note.start) - Math.round(finite(note.start))) > 0.08;

  // One-for-one ornament substitutions preserve total note count and the exact
  // syncopated-vs-straight count. Because kicks/snares are excluded, Critic 6.0
  // groove and Jazz authenticity remain stable while the return bar can still
  // inherit a recognizable event from its origin.
  const compatiblePairs = [];
  for (let targetIndex = 0; targetIndex < targetOrnaments.length; targetIndex += 1) {
    const targetNote = targetOrnaments[targetIndex];
    for (let sourceIndex = 0; sourceIndex < sourceOrnamentPool.length; sourceIndex += 1) {
      const sourceNote = sourceOrnamentPool[sourceIndex];
      if (offbeatClass(targetNote) !== offbeatClass(sourceNote)) continue;
      if (noteKey(targetNote) === noteKey(sourceNote)) continue;
      compatiblePairs.push({ targetNote, sourceNote, targetIndex, sourceIndex });
    }
  }
  for (const pair of compatiblePairs) {
    variants.push(uniqueNotes(originalTarget.map((note) => (
      noteKey(note) === noteKey(pair.targetNote) ? cloneValue(pair.sourceNote) : cloneValue(note)
    ))));
  }
  // Pitch-color recall keeps every target onset, duration, kick and snare
  // exactly where it already was. Only a non-skeleton drum voice is borrowed
  // from the origin bar, so the return acquires memory without changing pocket,
  // syncopation count, backbeat coverage or bass-lock timing.
  const colorPairs = [];
  for (let targetIndex = 0; targetIndex < targetOrnaments.length; targetIndex += 1) {
    const targetNote = targetOrnaments[targetIndex];
    for (let sourceIndex = 0; sourceIndex < sourceOrnamentPool.length; sourceIndex += 1) {
      const sourceNote = sourceOrnamentPool[sourceIndex];
      if (Number(sourceNote.pitch) === Number(targetNote.pitch)) continue;
      colorPairs.push({ targetNote, sourceNote, targetIndex, sourceIndex });
    }
  }
  for (const pair of colorPairs) {
    variants.push(uniqueNotes(originalTarget.map((note) => (
      noteKey(note) === noteKey(pair.targetNote)
        ? {
          ...cloneValue(note),
          pitch: Number(pair.sourceNote.pitch),
          velocity: finite(pair.sourceNote.velocity, finite(note.velocity, 80)),
          jazzMemoryColorRecall: true,
        }
        : cloneValue(note)
    ))));
  }
  for (let left = 0; left < colorPairs.length; left += 1) {
    for (let right = left + 1; right < colorPairs.length; right += 1) {
      const a = colorPairs[left];
      const b = colorPairs[right];
      if (a.targetIndex === b.targetIndex || a.sourceIndex === b.sourceIndex) continue;
      const replacements = new Map([
        [noteKey(a.targetNote), a.sourceNote],
        [noteKey(b.targetNote), b.sourceNote],
      ]);
      variants.push(uniqueNotes(originalTarget.map((note) => {
        const sourceNote = replacements.get(noteKey(note));
        return sourceNote
          ? {
            ...cloneValue(note),
            pitch: Number(sourceNote.pitch),
            velocity: finite(sourceNote.velocity, finite(note.velocity, 80)),
            jazzMemoryColorRecall: true,
          }
          : cloneValue(note);
      })));
    }
  }

  // Developed return color is the fallback when origin and return bars are
  // literally identical. It preserves the complete rhythmic fingerprint and
  // develops only a non-skeleton Jazz drum color (hat/ride/tom family). This
  // breaks stale bar duplication while retaining the remembered onset pattern.
  const developedPairs = [];
  for (let targetIndex = 0; targetIndex < targetOrnaments.length; targetIndex += 1) {
    const targetNote = targetOrnaments[targetIndex];
    for (const pitch of jazzDevelopedColorPitches(targetNote.pitch).slice(0, 3)) {
      developedPairs.push({ targetNote, targetIndex, pitch });
      variants.push(uniqueNotes(originalTarget.map((note) => (
        noteKey(note) === noteKey(targetNote)
          ? {
            ...cloneValue(note),
            pitch,
            jazzMemoryColorRecall: true,
            jazzMemoryDevelopedRecall: true,
            jazzMemorySourcePitch: Number(targetNote.pitch),
          }
          : cloneValue(note)
      ))));
    }
  }
  for (let left = 0; left < developedPairs.length; left += 1) {
    for (let right = left + 1; right < developedPairs.length; right += 1) {
      const a = developedPairs[left];
      const b = developedPairs[right];
      if (a.targetIndex === b.targetIndex) continue;
      const replacements = new Map([
        [noteKey(a.targetNote), a],
        [noteKey(b.targetNote), b],
      ]);
      variants.push(uniqueNotes(originalTarget.map((note) => {
        const replacement = replacements.get(noteKey(note));
        return replacement
          ? {
            ...cloneValue(note),
            pitch: replacement.pitch,
            jazzMemoryColorRecall: true,
            jazzMemoryDevelopedRecall: true,
            jazzMemorySourcePitch: Number(note.pitch),
          }
          : cloneValue(note);
      })));
    }
  }

  // Two-event substitutions provide enough fingerprint movement for bars whose
  // variety score cannot improve from a single recalled ornament.
  for (let left = 0; left < compatiblePairs.length; left += 1) {
    for (let right = left + 1; right < compatiblePairs.length; right += 1) {
      const a = compatiblePairs[left];
      const b = compatiblePairs[right];
      if (a.targetIndex === b.targetIndex || a.sourceIndex === b.sourceIndex) continue;
      const replacements = new Map([
        [noteKey(a.targetNote), a.sourceNote],
        [noteKey(b.targetNote), b.sourceNote],
      ]);
      variants.push(uniqueNotes(originalTarget.map((note) => (
        replacements.has(noteKey(note)) ? cloneValue(replacements.get(noteKey(note))) : cloneValue(note)
      ))));
    }
  }

  // The least invasive recall keeps the target bar intact and introduces only
  // a bounded origin ornament. This is useful when the target's kick/snare and
  // syncopation are already critic-optimal but its bar fingerprint is too repetitive.
  const chronologicalShifted = [...shifted]
    .sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  for (let count = 1; count <= chronologicalShifted.length; count += 1) {
    variants.push(uniqueNotes([
      ...originalTarget.map(cloneValue),
      ...chronologicalShifted.slice(0, count).map(cloneValue),
    ]));
  }

  const targetPlusSyncopated = [...shifted].sort((left, right) => {
    const leftOffbeat = Math.abs(finite(left.start) - Math.round(finite(left.start))) > 0.08 ? 0 : 1;
    const rightOffbeat = Math.abs(finite(right.start) - Math.round(finite(right.start))) > 0.08 ? 0 : 1;
    return leftOffbeat - rightOffbeat || finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch);
  });
  for (let count = 1; count <= targetPlusSyncopated.length; count += 1) {
    variants.push(uniqueNotes([
      ...originalTarget.map(cloneValue),
      ...targetPlusSyncopated.slice(0, count).map(cloneValue),
    ]));
  }

  // Full return-bar recall remains an option when it is already critic-safe.
  variants.push(uniqueNotes(shifted.map(cloneValue)));

  const targetKicks = targetNotes.filter((note) => KICK_PITCHES.has(Number(note.pitch))).map(cloneValue);
  const targetSnares = targetNotes.filter((note) => SNARE_PITCHES.has(Number(note.pitch))).map(cloneValue);
  variants.push(uniqueNotes([...shifted.map(cloneValue), ...targetKicks.map(cloneValue)]));
  variants.push(uniqueNotes([...shifted.map(cloneValue), ...targetSnares.map(cloneValue)]));
  variants.push(uniqueNotes([
    ...shifted.map(cloneValue),
    ...targetKicks.map(cloneValue),
    ...targetSnares.map(cloneValue),
  ]));

  // The target bar's kick/snare skeleton carries its pocket and bass lock. Keep
  // that identity while recalling increasing amounts of the origin's hats and
  // ornaments. Prefixes are deterministic and give the critic several bounded
  // rhythmic densities to choose from without an unbounded candidate search.
  for (let count = 1; count <= ornaments.length; count += 1) {
    variants.push(uniqueNotes([
      ...skeleton.map(cloneValue),
      ...ornaments.slice(0, count).map(cloneValue),
    ]));
  }

  // Also audition ornaments ordered by offbeat relevance so the 0.68 Jazz
  // syncopation target can be preserved when chronological prefixes are too straight.
  const syncopated = [...ornaments].sort((left, right) => {
    const leftOffbeat = Math.abs(finite(left.start) - Math.round(finite(left.start))) > 0.08 ? 0 : 1;
    const rightOffbeat = Math.abs(finite(right.start) - Math.round(finite(right.start))) > 0.08 ? 0 : 1;
    return leftOffbeat - rightOffbeat || finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch);
  });
  for (let count = 1; count <= syncopated.length; count += 1) {
    variants.push(uniqueNotes([
      ...skeleton.map(cloneValue),
      ...syncopated.slice(0, count).map(cloneValue),
    ]));
  }

  const seen = new Set();
  return variants.filter((notes) => {
    const signature = notes.map(noteKey).sort().join("|");
    if (!signature || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function pocketHybridReplacement(shiftedSourceNotes, targetNotes) {
  const skeleton = targetSkeleton(targetNotes).map(cloneValue);
  const targetOrnaments = sourceOrnaments(targetNotes);
  const neededOffbeats = rhythmicOffbeatCount(targetOrnaments);
  const neededOnbeats = targetOrnaments.length - neededOffbeats;
  const sourcePool = sourceOrnaments(shiftedSourceNotes);
  const sourceOffbeats = sourcePool
    .filter((note) => Math.abs(finite(note.start) - Math.round(finite(note.start))) > 0.08)
    .sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  const sourceOnbeats = sourcePool
    .filter((note) => Math.abs(finite(note.start) - Math.round(finite(note.start))) <= 0.08)
    .sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  if (sourceOffbeats.length < neededOffbeats || sourceOnbeats.length < neededOnbeats) return null;
  const recalled = [
    ...sourceOffbeats.slice(0, neededOffbeats),
    ...sourceOnbeats.slice(0, neededOnbeats),
  ].map((note) => ({
    ...cloneValue(note),
    jazzMemoryPocketRecall: true,
  }));
  return uniqueNotes([...skeleton, ...recalled]);
}

function sourceColorRecallVariants(sourceNotes, targetNotes) {
  const sourcePitches = [...new Set(
    sourceOrnaments(sourceNotes)
      .map((note) => Number(note.pitch))
      .filter(Number.isFinite),
  )].sort((left, right) => left - right);
  const targets = sourceOrnaments(targetNotes)
    .slice()
    .sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  if (!sourcePitches.length || !targets.length) return [];

  const variants = [];
  const replacementFor = (changes) => targetNotes.map((note) => {
    const change = changes.get(noteKey(note));
    if (change == null) return cloneValue(note);
    return {
      ...cloneValue(note),
      pitch: change,
      jazzMemoryColorRecall: true,
      jazzMemorySourcePitch: change,
    };
  });

  // Preserve the target bar's complete rhythmic/performance fingerprint and
  // borrow only drum color from the remembered origin. Critic 6.0's Jazz
  // authenticity inputs (density, repetition, syncopation, backbeat coverage,
  // bass lock) therefore remain invariant while the bar fingerprint can evolve.
  const choices = [];
  for (const target of targets) {
    for (const pitch of sourcePitches) {
      if (pitch === Number(target.pitch)) continue;
      choices.push({ target, pitch });
      variants.push(replacementFor(new Map([[noteKey(target), pitch]])));
    }
  }

  // Some high-variety seeds need two color changes before the bar becomes a
  // materially distinct memory return. Keep the search bounded and deterministic.
  for (let left = 0; left < choices.length; left += 1) {
    for (let right = left + 1; right < choices.length; right += 1) {
      const a = choices[left];
      const b = choices[right];
      if (noteKey(a.target) === noteKey(b.target)) continue;
      variants.push(replacementFor(new Map([
        [noteKey(a.target), a.pitch],
        [noteKey(b.target), b.pitch],
      ])));
    }
  }

  const seen = new Set();
  return variants.filter((notes) => {
    const signature = notes.map(noteKey).sort().join("|");
    if (!signature || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function candidateSong(sourceSong, targetNotes, replacementNotes) {
  const song = cloneValue(sourceSong);
  const targetDrums = song.tracks.find((track) => track.id === "drums");
  const targetKeys = new Set(targetNotes.map(noteKey));
  targetDrums.notes = targetDrums.notes
    .filter((note) => !targetKeys.has(noteKey(note)))
    .concat(replacementNotes.map(cloneValue))
    .sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  return song;
}

export function createJazzDrumMemoryCandidate(sourceSong) {
  if (String(sourceSong?.genre ?? sourceSong?.meta?.genre ?? "") !== "jazz") return null;
  const drums = sourceSong?.tracks?.find((track) => track.id === "drums");
  if (!drums?.notes?.length) return null;

  const barBeats = finite(sourceSong?.meta?.beatsPerBar, 4);
  const sourceVariety = drumVarietyScore(sourceSong, drums.notes);
  const sourceRhythm = jazzRhythmMetrics(sourceSong, drums.notes);
  const adjacentBefore = adjacentDrumDuplicateCount(sourceSong);
  const candidates = [];

  const considerCandidate = ({
    sourceBar,
    targetBar,
    targetNotes,
    replacement,
    recallMode = "offset-memory",
  }) => {
    if (!Array.isArray(replacement) || replacement.length < 1) return;
    const song = candidateSong(sourceSong, targetNotes, replacement);
    const candidateDrums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
    const variety = drumVarietyScore(song, candidateDrums);
    if (variety < sourceVariety + 2) return;
    const adjacentAfter = adjacentDrumDuplicateCount(song);
    if (adjacentAfter > adjacentBefore) return;
    const rhythm = jazzRhythmMetrics(song, candidateDrums);
    if (rhythm.groove < sourceRhythm.groove) return;
    if (rhythm.authenticity < sourceRhythm.authenticity) return;

    candidates.push({
      id: "jazz-return-groove-recall",
      song,
      recallMode,
      timingPreserved: barTimingSignature(replacement) === barTimingSignature(targetNotes),
      noteCountDelta: replacement.length - targetNotes.length,
      colorEditCount: replacement.filter((note) => note.jazzMemoryColorRecall === true).length,
      changedBars: 1,
      sourceBar,
      targetBar,
      adjacentDuplicatesBefore: adjacentBefore,
      adjacentDuplicatesAfter: adjacentAfter,
      drumVarietyBefore: sourceVariety,
      drumVarietyAfter: variety,
      grooveBefore: sourceRhythm.groove,
      grooveAfter: rhythm.groove,
      authenticityBefore: sourceRhythm.authenticity,
      authenticityAfter: rhythm.authenticity,
      recalledNotes: replacement.length,
    });
  };

  const pairs = sectionPairs(sourceSong);

  // First preserve the previous behavior exactly: corresponding bars in a
  // remembered section can recall/develop their origin pattern.
  for (const { origin, target } of pairs) {
    const originStart = Math.floor(startOf(origin) / barBeats + 1e-6);
    const targetStart = Math.floor(startOf(target) / barBeats + 1e-6);
    const span = Math.min(
      Math.max(0, Math.ceil((endOf(origin) - startOf(origin)) / barBeats)),
      Math.max(0, Math.ceil((endOf(target) - startOf(target)) / barBeats)),
    );
    for (let offset = 0; offset < span; offset += 1) {
      const sourceBar = originStart + offset;
      const targetBar = targetStart + offset;
      if (Math.abs(sourceBar - targetBar) <= 1
        || protectedBar(sourceSong, sourceBar)
        || protectedBar(sourceSong, targetBar)) continue;

      const sourceNotes = notesForBar(sourceSong, sourceBar);
      const targetNotes = notesForBar(sourceSong, targetBar);
      if (sourceNotes.length < 4 || targetNotes.length < 2) continue;
      const delta = (targetBar - sourceBar) * barBeats;
      const shifted = shiftedSourceNotes(sourceNotes, delta);

      for (const replacement of ornamentVariants(shifted, targetNotes)) {
        considerCandidate({ sourceBar, targetBar, targetNotes, replacement, recallMode: "offset-memory" });
      }
    }
  }

  // If the matching-offset return has no critic-safe option, search the same
  // remembered section for another non-adjacent bar with an equivalent pocket
  // class. Equal note count + offbeat count + kick/snare skeleton guarantees
  // the Critic 6.0 groove/authenticity terms remain stable while a real earlier
  // bar is recalled into the return.
  if (!candidates.length) {
    for (const { origin, target } of pairs) {
      const sourceBars = sectionBarIndices(origin, barBeats)
        .filter((bar) => !protectedBar(sourceSong, bar));
      const targetBars = sectionBarIndices(target, barBeats)
        .filter((bar) => !protectedBar(sourceSong, bar));

      for (const targetBar of targetBars) {
        const targetNotes = notesForBar(sourceSong, targetBar);
        if (targetNotes.length < 2) continue;
        for (const sourceBar of sourceBars) {
          if (Math.abs(sourceBar - targetBar) <= 1) continue;
          const sourceNotes = notesForBar(sourceSong, sourceBar);
          if (sourceNotes.length < 4) continue;
          const delta = (targetBar - sourceBar) * barBeats;
          const shifted = shiftedSourceNotes(sourceNotes, delta);

          if (pocketCompatibleRecall(sourceNotes, targetNotes, barBeats)) {
            considerCandidate({
              sourceBar,
              targetBar,
              targetNotes,
              replacement: shifted.map((note) => ({ ...cloneValue(note), jazzMemoryPocketRecall: true })),
              recallMode: "pocket-compatible-return",
            });
          }

          const hybrid = pocketHybridReplacement(shifted, targetNotes);
          if (hybrid && hybrid.length === targetNotes.length
            && rhythmicOffbeatCount(hybrid) === rhythmicOffbeatCount(targetNotes)
            && kickSnareSkeletonSignature(hybrid, barBeats) === kickSnareSkeletonSignature(targetNotes, barBeats)) {
            considerCandidate({
              sourceBar,
              targetBar,
              targetNotes,
              replacement: hybrid,
              recallMode: "pocket-hybrid-return",
            });
          }

          for (const replacement of sourceColorRecallVariants(shifted, targetNotes)) {
            considerCandidate({
              sourceBar,
              targetBar,
              targetNotes,
              replacement,
              recallMode: "source-color-return",
            });
          }
        }
      }
    }
  }

  // Final bounded fallback: recall any earlier safe Jazz bar whose kick/snare
  // skeleton matches the target. This preserves the target's core pocket while
  // allowing a song-level groove memory when the explicit section pair has no
  // critic-safe match. The ordinary no-regression filters still decide whether
  // the candidate is allowed to exist.
  if (!candidates.length) {
    const allBars = Math.max(1, Math.round(finite(sourceSong?.meta?.bars, sourceSong?.bars ?? 1)));
    const safeBars = Array.from({ length: allBars }, (_, bar) => bar)
      .filter((bar) => !protectedBar(sourceSong, bar));
    const targetBars = [...new Set(pairs.flatMap(({ target }) => sectionBarIndices(target, barBeats)))]
      .filter((bar) => !protectedBar(sourceSong, bar));

    for (const targetBar of targetBars) {
      const targetNotes = notesForBar(sourceSong, targetBar);
      if (targetNotes.length < 2) continue;
      const targetSkeleton = kickSnareSkeletonSignature(targetNotes, barBeats);
      for (const sourceBar of safeBars) {
        if (sourceBar >= targetBar - 1) continue;
        const sourceNotes = notesForBar(sourceSong, sourceBar);
        if (sourceNotes.length < 4) continue;
        if (kickSnareSkeletonSignature(sourceNotes, barBeats) !== targetSkeleton) continue;
        const delta = (targetBar - sourceBar) * barBeats;
        const shifted = shiftedSourceNotes(sourceNotes, delta).map((note) => ({
          ...cloneValue(note),
          jazzMemoryPocketRecall: true,
          jazzMemoryGlobalRecall: true,
        }));
        considerCandidate({
          sourceBar,
          targetBar,
          targetNotes,
          replacement: shifted,
          recallMode: "global-pocket-memory",
        });
      }
    }
  }

  candidates.sort((left, right) => (
    (Number(right.recallMode === "source-color-return") - Number(left.recallMode === "source-color-return"))
    || (Number(right.recallMode === "pocket-compatible-return") - Number(left.recallMode === "pocket-compatible-return"))
    || (Number(right.recallMode === "pocket-hybrid-return") - Number(left.recallMode === "pocket-hybrid-return"))
    || (Number(right.timingPreserved) - Number(left.timingPreserved))
    || (Math.abs(left.noteCountDelta) - Math.abs(right.noteCountDelta))
    || (left.colorEditCount - right.colorEditCount)
    || (right.drumVarietyAfter - left.drumVarietyAfter)
    || (right.grooveAfter - left.grooveAfter)
    || (right.authenticityAfter - left.authenticityAfter)
    || (left.recalledNotes - right.recalledNotes)
    || (left.sourceBar - right.sourceBar)
    || (left.targetBar - right.targetBar)
  ));
  return candidates.length ? Object.freeze(candidates[0]) : null;
}
