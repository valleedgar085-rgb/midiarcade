import fs from "node:fs";

const path = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing ${label} anchor.`);
  source = source.replace(from, to);
}

const helperAnchor = "function applySurgicalRepairWindow(sourceSong, repairedSong, config, diagnosis, sourceCandidate, window, repairStrategy = null) {";
const helpers = `function copiedDrumNoteForBar(note, sourceBar, targetBar, barBeats) {
  const copy = clone(note);
  copy.start = round(note.start + (targetBar - sourceBar) * barBeats);
  delete copy.drumFillId;
  delete copy.transitionFeature;
  delete copy.rhythmTurnaroundId;
  delete copy.rhythmTurnaroundRole;
  return copy;
}

function applyDirectDrumVarietyRepair(song, window, repairStrategy) {
  if (repairStrategy?.id !== "drum-stabilize") return song;
  const drums = song?.tracks?.find((track) => track.id === "drums");
  if (!drums || !window) return song;
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const bars = [];
  for (let bar = window.startBar; bar < window.endBar; bar += 1) bars.push(bar);
  if (bars.length < 2) return song;

  const original = [...(drums.notes ?? [])].map(clone);
  const byBar = new Map(bars.map((bar) => [
    bar,
    original.filter((note) => Math.floor(note.start / barBeats) === bar),
  ]));
  const populated = bars.filter((bar) => (byBar.get(bar) ?? []).length);
  if (populated.length < 2) return song;
  const targetUnique = clamp(Math.round(populated.length * 0.58), 1, Math.max(1, populated.length - 1));
  const sourceBars = populated.slice(0, targetUnique);
  const outside = original.filter((note) => (
    note.start < window.startBeat - 1e-6 || note.start >= window.endBeat - 1e-6
  ));
  const repairedInside = [];

  populated.forEach((targetBar, index) => {
    const sourceBar = sourceBars[index % sourceBars.length];
    const sourceNotes = byBar.get(sourceBar) ?? [];
    const targetNotes = byBar.get(targetBar) ?? [];
    const protectedNotes = targetNotes.filter((note) => note.drumFillId || note.transitionFeature || note.rhythmTurnaroundId);
    const copied = sourceNotes
      .filter((note) => !note.drumFillId && !note.transitionFeature && !note.rhythmTurnaroundId)
      .map((note) => copiedDrumNoteForBar(note, sourceBar, targetBar, barBeats));
    repairedInside.push(...copied, ...protectedNotes.map(clone));
  });

  const deduped = new Map();
  for (const note of [...outside, ...repairedInside]) {
    const key = \`\${note.pitch}:\${round(note.start, 4)}\`;
    const previous = deduped.get(key);
    if (!previous || finite(note.velocity, 0) > finite(previous.velocity, 0)) deduped.set(key, note);
  }
  drums.notes = [...deduped.values()].sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  return song;
}

function nearestMemoryRegisterPitch(originPitch, currentPitch, minimum = 24, maximum = 108) {
  const candidates = [];
  for (let octave = -8; octave <= 8; octave += 1) {
    const pitch = originPitch + octave * 12;
    if (pitch >= minimum && pitch <= maximum) candidates.push(pitch);
  }
  return candidates.sort((left, right) => (
    Math.abs(left - currentPitch) - Math.abs(right - currentPitch) || left - right
  ))[0] ?? currentPitch;
}

function applyDirectMemoryRepair(song, window, repairStrategy) {
  if (repairStrategy?.dimension !== "memory" || !window) return song;
  const memoryMap = song?.memoryMap ?? song?.songBlueprint?.memoryMap ?? [];
  const memory = memoryMap.find((entry) => (
    entry.sectionId === window.sectionId
    && !["introduction", "statement"].includes(entry.relationship)
  ));
  if (!memory) return song;
  const targetSection = song?.structure?.find((section) => section.id === memory.sectionId);
  const originSection = song?.structure?.find((section) => section.id === memory.originSectionId);
  if (!targetSection || !originSection) return song;

  for (const trackId of ["melody", "bass", "counterpoint"]) {
    const track = song?.tracks?.find((candidate) => candidate.id === trackId);
    if (!track) continue;
    const alreadyRecalled = (track.notes ?? []).some((note) => (
      note.memoryRole === memory.relationship
      && note.memoryOriginSectionId === memory.originSectionId
      && note.start >= targetSection.startBeat - 1e-6
      && note.start < targetSection.endBeat - 1e-6
    ));
    if (alreadyRecalled) continue;
    const originNotes = (track.notes ?? [])
      .filter((note) => note.start >= originSection.startBeat - 1e-6 && note.start < originSection.endBeat - 1e-6)
      .sort((left, right) => left.start - right.start || left.pitch - right.pitch);
    const targetNotes = (track.notes ?? [])
      .filter((note) => (
        note.start >= Math.max(targetSection.startBeat, window.startBeat) - 1e-6
        && note.start < Math.min(targetSection.endBeat, window.endBeat) - 1e-6
      ))
      .sort((left, right) => left.start - right.start || left.pitch - right.pitch);
    if (!originNotes.length || !targetNotes.length) continue;

    const recallCount = trackId === "melody" ? Math.min(2, targetNotes.length, originNotes.length) : 1;
    for (let index = 0; index < recallCount; index += 1) {
      const origin = originNotes[Math.min(originNotes.length - 1, index)];
      const targetPhase = (origin.start - originSection.startBeat) / Math.max(0.25, originSection.endBeat - originSection.startBeat);
      const desiredBeat = targetSection.startBeat + targetPhase * (targetSection.endBeat - targetSection.startBeat);
      const target = [...targetNotes].sort((left, right) => (
        Math.abs(left.start - desiredBeat) - Math.abs(right.start - desiredBeat)
        || left.start - right.start
      ))[0];
      if (!target) continue;
      target.pitch = nearestMemoryRegisterPitch(origin.pitch, target.pitch, trackId === "bass" ? 24 : 36, trackId === "bass" ? 72 : 108);
      target.velocity = clamp(Math.round((finite(target.velocity, 80) * 2 + finite(origin.velocity, 80)) / 3), 1, 127);
      target.memoryRole = memory.relationship;
      target.memoryOriginSectionId = memory.originSectionId;
      target.memoryRecallStrength = round(clamp(finite(memory.recallStrength, 0.75), 0, 1));
      target.memoryTransform = memory.contrastAxis ?? "recall";
    }
  }
  return song;
}

function applyDirectSurgicalRepairMaterial(song, window, repairStrategy) {
  applyDirectDrumVarietyRepair(song, window, repairStrategy);
  applyDirectMemoryRepair(song, window, repairStrategy);
  return song;
}

`;
replaceOnce(helperAnchor, helpers + helperAnchor, "direct surgical repair helper insertion");

const callAnchor = `  song.tracks = preInterlockTracks.map((track) => {
    if (!surgicalTrackSet.has(track.id)) return track;
    return {
      ...track,
      notes: spliceNotesInSurgicalWindow(
        track.notes ?? [],
        reconnected[track.id] ?? track.notes ?? [],
        window,
      ),
    };
  });
  song.meta = { ...sourceSong.meta, ideaFingerprint: null };`;
const callReplacement = `  song.tracks = preInterlockTracks.map((track) => {
    if (!surgicalTrackSet.has(track.id)) return track;
    return {
      ...track,
      notes: spliceNotesInSurgicalWindow(
        track.notes ?? [],
        reconnected[track.id] ?? track.notes ?? [],
        window,
      ),
    };
  });
  applyDirectSurgicalRepairMaterial(song, window, repairStrategy);
  song.meta = { ...sourceSong.meta, ideaFingerprint: null };`;
replaceOnce(callAnchor, callReplacement, "direct surgical repair material call");

fs.writeFileSync(path, source);
console.log("Applied direct drum-variety and memory repair material.");
