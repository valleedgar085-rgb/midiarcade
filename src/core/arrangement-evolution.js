import { finite } from "../utils.js";

const ELECTRONIC_GENRES = new Set(["house", "techno", "drumBass"]);
const LOOP_GENRES = new Set(["loFiHipHop", "ambient"]);
const HOOK_FORWARD_GENRES = new Set(["pop", "popRadio", "synthPopRadio", "synthwave", "rock"]);
const VERSE_FORWARD_GENRES = new Set(["rap", "hipHop", "country"]);

const FAMILIES = Object.freeze({
  hookFirst: Object.freeze({ id: "hook-first", label: "Hook first", character: "Open with identity, then earn a larger return." }),
  verseDriven: Object.freeze({ id: "verse-driven", label: "Verse driven", character: "Build the story before the main payoff." }),
  bridgePayoff: Object.freeze({ id: "bridge-payoff", label: "Bridge payoff", character: "Use contrast in the middle to make the final return feel larger." }),
  slowBloom: Object.freeze({ id: "slow-bloom", label: "Slow bloom", character: "Delay the strongest section and increase pressure across the form." }),
  doublePeak: Object.freeze({ id: "double-peak", label: "Double peak", character: "Two major payoffs separated by a real reset." }),
  earlyImpact: Object.freeze({ id: "early-impact", label: "Early impact", character: "Hit a recognizable peak early, then rebuild toward the final peak." }),
  hypnoticWave: Object.freeze({ id: "hypnotic-wave", label: "Hypnotic wave", character: "Cycle tension and release without literal section cloning." }),
  loopDevelopment: Object.freeze({ id: "loop-development", label: "Loop development", character: "Keep the core loop identity while changing its surrounding context." }),
});

function hash32(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick(values, seed) {
  return values[hash32(seed) % values.length];
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function cloneLayout(layout = []) {
  return layout.map((section) => ({
    name: String(section?.name ?? "idea").toLowerCase(),
    weight: Math.max(0.2, finite(section?.weight, 1)),
  }));
}

function weight(name, amount = 1) {
  return { name, weight: amount };
}

function songFamilyCandidates(genre) {
  if (ELECTRONIC_GENRES.has(genre)) return [FAMILIES.doublePeak, FAMILIES.earlyImpact, FAMILIES.hypnoticWave, FAMILIES.slowBloom];
  if (LOOP_GENRES.has(genre)) return [FAMILIES.loopDevelopment, FAMILIES.slowBloom, FAMILIES.bridgePayoff];
  if (HOOK_FORWARD_GENRES.has(genre)) return [FAMILIES.hookFirst, FAMILIES.bridgePayoff, FAMILIES.slowBloom, FAMILIES.verseDriven];
  if (VERSE_FORWARD_GENRES.has(genre)) return [FAMILIES.verseDriven, FAMILIES.bridgePayoff, FAMILIES.hookFirst];
  return [FAMILIES.verseDriven, FAMILIES.bridgePayoff, FAMILIES.slowBloom, FAMILIES.hookFirst];
}

export function createArrangementEvolution(config = {}) {
  const genre = String(config.genre ?? "pop");
  const bars = Math.max(1, Math.round(finite(config.bars, 16)));
  const seed = String(config.seed ?? `${genre}:arrangement`);
  const enabled = config.arrangementEvolution === true && bars >= 8;
  const candidates = songFamilyCandidates(genre);
  const family = pick(candidates, `${seed}:${genre}:${bars}:family`);
  return Object.freeze({
    enabled,
    version: 1,
    genre,
    bars,
    family: family.id,
    label: family.label,
    character: family.character,
    signature: hash32(`${seed}:${genre}:${bars}:${family.id}`).toString(16).padStart(8, "0"),
  });
}

function electronicLayout(family, bars) {
  const compact = bars <= 15;
  if (family === "early-impact") {
    return compact
      ? [weight("intro", 0.7), weight("drop", 1.7), weight("breakdown", 1), weight("build", 0.8), weight("drop", 1.9)]
      : [weight("intro", 0.7), weight("drop", 1.8), weight("breakdown", 1.2), weight("build", 0.8), weight("drop", 2.2), weight("outro", 0.6)];
  }
  if (family === "slow-bloom") {
    return compact
      ? [weight("intro", 1.2), weight("build", 1.1), weight("breakdown", 0.8), weight("drop", 2.3)]
      : [weight("intro", 1.1), weight("build", 1.2), weight("breakdown", 1), weight("build", 0.9), weight("drop", 2.6), weight("outro", 0.6)];
  }
  if (family === "hypnotic-wave") {
    return compact
      ? [weight("intro", 0.7), weight("drop", 1.5), weight("breakdown", 0.9), weight("drop", 1.8), weight("outro", 0.5)]
      : [weight("intro", 0.7), weight("drop", 1.6), weight("breakdown", 1), weight("drop", 1.9), weight("breakdown", 0.8), weight("drop", 2.1), weight("outro", 0.5)];
  }
  return compact
    ? [weight("intro", 0.7), weight("build", 0.8), weight("drop", 1.8), weight("breakdown", 0.9), weight("drop", 2)]
    : [weight("intro", 0.7), weight("build", 0.8), weight("drop", 1.8), weight("breakdown", 1.1), weight("build", 0.7), weight("drop", 2.2), weight("outro", 0.5)];
}

function loopLayout(family, bars) {
  const compact = bars <= 15;
  if (family === "slow-bloom") {
    return compact
      ? [weight("intro", 1), weight("idea", 1.7), weight("breakdown", 1), weight("theme", 2)]
      : [weight("intro", 1), weight("idea", 1.7), weight("breakdown", 1.1), weight("theme", 2), weight("bridge", 1), weight("idea", 1.8), weight("outro", 0.7)];
  }
  if (family === "bridge-payoff") {
    return compact
      ? [weight("intro", 0.8), weight("idea", 1.8), weight("bridge", 1), weight("idea", 2)]
      : [weight("intro", 0.8), weight("idea", 1.8), weight("breakdown", 0.9), weight("bridge", 1.2), weight("idea", 2.1), weight("outro", 0.7)];
  }
  return compact
    ? [weight("intro", 0.7), weight("idea", 1.8), weight("breakdown", 0.9), weight("idea", 2)]
    : [weight("intro", 0.7), weight("idea", 1.9), weight("breakdown", 1), weight("idea", 1.7), weight("bridge", 1), weight("idea", 2.1), weight("outro", 0.6)];
}

function songLayout(family, bars) {
  const compact = bars <= 15;
  if (family === "hook-first") {
    return compact
      ? [weight("intro", 0.6), weight("chorus", 1.4), weight("verse", 1.8), weight("prechorus", 0.6), weight("chorus", 1.7)]
      : [weight("intro", 0.6), weight("chorus", 1.35), weight("verse", 1.8), weight("prechorus", 0.65), weight("chorus", 1.65), weight("bridge", 1), weight("chorus", 1.9), weight("outro", 0.55)];
  }
  if (family === "bridge-payoff") {
    return compact
      ? [weight("intro", 0.6), weight("verse", 1.7), weight("chorus", 1.4), weight("bridge", 0.9), weight("chorus", 1.8)]
      : [weight("intro", 0.6), weight("verse", 1.8), weight("prechorus", 0.65), weight("chorus", 1.45), weight("bridge", 1.1), weight("verse", 1.35), weight("chorus", 1.95), weight("outro", 0.55)];
  }
  if (family === "slow-bloom") {
    return compact
      ? [weight("intro", 0.8), weight("verse", 1.8), weight("prechorus", 0.8), weight("bridge", 0.8), weight("chorus", 2)]
      : [weight("intro", 0.8), weight("verse", 1.9), weight("verse", 1.45), weight("prechorus", 0.75), weight("bridge", 0.95), weight("chorus", 2.1), weight("outro", 0.55)];
  }
  return compact
    ? [weight("intro", 0.55), weight("verse", 2.1), weight("verse", 1.4), weight("chorus", 1.6), weight("outro", 0.5)]
    : [weight("intro", 0.55), weight("verse", 2.1), weight("verse", 1.55), weight("prechorus", 0.65), weight("chorus", 1.55), weight("bridge", 0.9), weight("chorus", 1.85), weight("outro", 0.5)];
}

/**
 * Planning helper for future structure-first composition. Phase 6B's shipped
 * runtime uses evolveSongArrangement below because it can be independently
 * scored and rejected after the existing calibrated composition pass.
 */
export function evolveArrangementLayout(baseLayout = [], config = {}) {
  const source = cloneLayout(baseLayout);
  const evolution = createArrangementEvolution(config);
  if (!evolution.enabled || source.length < 2) return source;

  if (ELECTRONIC_GENRES.has(evolution.genre)) return electronicLayout(evolution.family, evolution.bars);
  if (LOOP_GENRES.has(evolution.genre)) return loopLayout(evolution.family, evolution.bars);
  return songLayout(evolution.family, evolution.bars);
}

function sectionName(section) {
  return String(section?.name ?? "idea").toLowerCase();
}

function isPayoff(section) {
  return ["chorus", "drop", "theme"].includes(sectionName(section));
}

function isContrast(section) {
  return ["bridge", "breakdown"].includes(sectionName(section));
}

function isVerseLike(section) {
  return ["verse", "idea", "solo"].includes(sectionName(section));
}

function moveSection(sections, fromIndex, targetIndex) {
  if (fromIndex < 0 || targetIndex < 0 || fromIndex >= sections.length || targetIndex >= sections.length || fromIndex === targetIndex) return false;
  const [section] = sections.splice(fromIndex, 1);
  sections.splice(targetIndex, 0, section);
  return true;
}

function firstIndex(sections, predicate, start = 0) {
  for (let index = Math.max(0, start); index < sections.length; index += 1) {
    if (predicate(sections[index])) return index;
  }
  return -1;
}

function lastIndex(sections, predicate) {
  for (let index = sections.length - 1; index >= 0; index -= 1) {
    if (predicate(sections[index])) return index;
  }
  return -1;
}

function evolvedSectionOrder(sourceSections, family) {
  const sections = clone(sourceSections);
  if (sections.length < 4) return sections;
  const introOffset = sectionName(sections[0]) === "intro" ? 1 : 0;
  const outroOffset = sectionName(sections.at(-1)) === "outro" ? 1 : 0;

  if (["hook-first", "early-impact"].includes(family)) {
    const payoff = firstIndex(sections, isPayoff, introOffset);
    if (payoff >= 0) moveSection(sections, payoff, introOffset);
  } else if (family === "verse-driven") {
    const firstVerse = firstIndex(sections, isVerseLike, introOffset);
    if (firstVerse >= 0) moveSection(sections, firstVerse, introOffset);
    const secondVerse = firstIndex(sections, isVerseLike, introOffset + 1);
    if (secondVerse >= 0) moveSection(sections, secondVerse, introOffset + 1);
    const payoff = firstIndex(sections, isPayoff, introOffset + 2);
    if (payoff >= 0) moveSection(sections, payoff, Math.min(sections.length - 1 - outroOffset, introOffset + 2));
  } else if (family === "bridge-payoff") {
    const finalPayoff = lastIndex(sections, isPayoff);
    const contrast = firstIndex(sections, isContrast, introOffset);
    if (finalPayoff > introOffset + 1 && contrast >= 0 && contrast !== finalPayoff - 1) {
      const destination = contrast < finalPayoff ? finalPayoff - 1 : finalPayoff;
      moveSection(sections, contrast, Math.max(introOffset, destination));
    }
  } else if (family === "slow-bloom") {
    const payoff = firstIndex(sections, isPayoff, introOffset);
    const latestBodyIndex = Math.max(introOffset, sections.length - 2 - outroOffset);
    const target = Math.min(latestBodyIndex, Math.max(introOffset + 1, Math.floor(sections.length * 0.58)));
    if (payoff >= introOffset && payoff < target) moveSection(sections, payoff, target);
  } else if (["double-peak", "hypnotic-wave"].includes(family)) {
    const firstPayoff = firstIndex(sections, isPayoff, introOffset);
    const secondPayoff = firstIndex(sections, isPayoff, firstPayoff + 1);
    const contrast = firstIndex(sections, isContrast, firstPayoff + 1);
    if (firstPayoff >= 0 && secondPayoff >= 0 && contrast >= 0 && !(contrast > firstPayoff && contrast < secondPayoff)) {
      const target = Math.min(sections.length - 1 - outroOffset, firstPayoff + 1);
      moveSection(sections, contrast, target);
    }
  } else if (family === "loop-development") {
    const firstIdea = firstIndex(sections, isVerseLike, introOffset);
    const contrast = firstIndex(sections, isContrast, introOffset);
    if (firstIdea >= 0 && contrast >= 0 && contrast !== firstIdea + 1) {
      moveSection(sections, contrast, Math.min(sections.length - 1 - outroOffset, firstIdea + 1));
    }
  }

  return sections;
}

function eventStart(event) {
  return finite(event?.start ?? event?.startBeat ?? event?.beat ?? event?.time ?? event?.tick, 0);
}

function setEventStart(event, value) {
  const key = ["start", "startBeat", "beat", "time", "tick"].find((candidate) => (
    Object.prototype.hasOwnProperty.call(event, candidate)
  )) || "start";
  event[key] = value;
}

function sectionBars(section) {
  return Math.max(1, Math.round(finite(section?.bars, 1)));
}

function sectionStartBeat(section, beatsPerBar) {
  return finite(section?.startBeat, finite(section?.startBar, finite(section?.start, 0)) * beatsPerBar);
}

function reorderSectionAddressedArray(entries, orderedIds) {
  if (!Array.isArray(entries)) return entries;
  const byId = new Map(entries.map((entry) => [String(entry?.sectionId ?? ""), entry]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  const addressed = new Set(ordered.map((entry) => String(entry?.sectionId ?? "")));
  return [...ordered, ...entries.filter((entry) => !addressed.has(String(entry?.sectionId ?? "")))];
}

/**
 * Reorder whole existing sections while preserving every event and section id.
 * No notes are created, deleted, quantized, or retuned here. This makes the
 * operation reversible and safe to score against the original candidate.
 */
export function evolveSongArrangement(sourceSong, config = {}) {
  const evolution = createArrangementEvolution(config);
  const sourceSections = sourceSong?.structure ?? sourceSong?.sections;
  if (!evolution.enabled || !Array.isArray(sourceSections) || sourceSections.length < 4 || !Array.isArray(sourceSong?.tracks)) {
    return { changed: false, song: sourceSong, evolution };
  }

  const ordered = evolvedSectionOrder(sourceSections, evolution.family);
  const originalIds = sourceSections.map((section) => String(section?.id ?? ""));
  const orderedIds = ordered.map((section) => String(section?.id ?? ""));
  if (orderedIds.some((id) => !id) || new Set(orderedIds).size !== orderedIds.length) {
    return { changed: false, song: sourceSong, evolution };
  }
  if (originalIds.every((id, index) => id === orderedIds[index])) {
    return { changed: false, song: sourceSong, evolution };
  }

  const song = clone(sourceSong);
  const beatsPerBar = Math.max(1, finite(song.meta?.beatsPerBar, 4));
  const original = clone(sourceSections);
  const reordered = clone(ordered);
  let cursorBars = 0;
  for (const section of reordered) {
    const bars = sectionBars(section);
    section.start = cursorBars;
    section.startBar = cursorBars;
    section.startBeat = cursorBars * beatsPerBar;
    section.endBeat = (cursorBars + bars) * beatsPerBar;
    cursorBars += bars;
  }

  const destinationById = new Map(reordered.map((section) => [String(section.id), section]));
  const sourceForBeat = (beat) => original.find((section) => {
    const start = sectionStartBeat(section, beatsPerBar);
    return beat >= start - 1e-7 && beat < start + sectionBars(section) * beatsPerBar - 1e-7;
  });
  const relocate = (event) => {
    const source = sourceForBeat(eventStart(event));
    const destination = destinationById.get(String(source?.id ?? ""));
    if (!source || !destination) return;
    setEventStart(event, eventStart(event) + destination.startBeat - sectionStartBeat(source, beatsPerBar));
  };
  const relocateArray = (events) => Array.isArray(events)
    ? events.map((event) => {
        const next = clone(event);
        relocate(next);
        return next;
      }).sort((left, right) => eventStart(left) - eventStart(right))
    : events;

  song.tracks = song.tracks.map((track) => ({
    ...track,
    notes: relocateArray(track.notes),
    automation: relocateArray(track.automation),
  }));
  song.harmony = relocateArray(song.harmony);
  song.structure = reordered;
  song.sections = clone(reordered);
  song.bars = cursorBars;
  song.meta = {
    ...(song.meta ?? {}),
    bars: cursorBars,
    totalBeats: cursorBars * beatsPerBar,
  };
  if (song.songBlueprint?.sectionPlans) {
    song.songBlueprint = {
      ...song.songBlueprint,
      sectionPlans: reorderSectionAddressedArray(song.songBlueprint.sectionPlans, orderedIds),
    };
  }
  if (song.phraseMemory?.sections) {
    song.phraseMemory = {
      ...song.phraseMemory,
      sections: reorderSectionAddressedArray(song.phraseMemory.sections, orderedIds),
    };
  }
  if (song.songDNA?.sections) {
    song.songDNA = {
      ...song.songDNA,
      sections: reorderSectionAddressedArray(song.songDNA.sections, orderedIds),
    };
  }
  song.outputQualityEvolution = {
    ...(song.outputQualityEvolution ?? {}),
    arrangement: {
      version: evolution.version,
      family: evolution.family,
      label: evolution.label,
      signature: evolution.signature,
      sectionOrder: orderedIds,
    },
  };
  return { changed: true, song, evolution };
}
