/**
 * Arranger Matrix & Dynamic Song Structure Studio Engine (Phase 21)
 *
 * Provides pure, unit-testable structure operations:
 * - Section matrix extraction & analysis
 * - Immutable section bar-length resizing with note time scaling
 * - Section energy scaling (low, medium, peak)
 * - Per-section instrument track masking
 * - Real-time section queue calculation for live playback jumping
 */

import { clamp } from "../utils.js";

function deepClone(obj) {
  if (obj == null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const copy = {};
  for (const key of Object.keys(obj)) {
    copy[key] = deepClone(obj[key]);
  }
  return copy;
}

const ALL_TRACK_IDS = ["drums", "bass", "chords", "melody", "counterpoint", "pad"];

export function getSongSections(song) {
  if (!song) return [];
  if (Array.isArray(song.sections)) return song.sections;
  if (song.arrangement && Array.isArray(song.arrangement.sections)) return song.arrangement.sections;
  return [];
}

export function buildSectionMatrix(song) {
  const sections = getSongSections(song);
  if (!sections.length) return [];

  const beatsPerBar = Number(song.meta?.beatsPerBar ?? song.beatsPerBar ?? 4);

  return sections.map((sec) => {
    const startBeat = sec.start * beatsPerBar;
    const endBeat = (sec.start + sec.bars) * beatsPerBar;

    // Determine active tracks in section
    const activeTracks = (song.tracks || []).filter((tr) => {
      if (!Array.isArray(tr.notes)) return false;
      return tr.notes.some((n) => {
        const beat = Number(n.startBeat ?? n.start ?? 0);
        return beat >= startBeat && beat < endBeat;
      });
    }).map((tr) => tr.id || tr.name?.toLowerCase() || "drums");

    // Calculate energy score from average velocity
    let totalVel = 0;
    let noteCount = 0;
    (song.tracks || []).forEach((tr) => {
      if (!Array.isArray(tr.notes)) return;
      tr.notes.forEach((n) => {
        const beat = Number(n.startBeat ?? n.start ?? 0);
        if (beat >= startBeat && beat < endBeat) {
          totalVel += Number(n.velocity ?? 90);
          noteCount += 1;
        }
      });
    });

    const energy = noteCount > 0 ? clamp(totalVel / noteCount / 127, 0.1, 1) : 0.5;

    return {
      id: sec.id,
      name: sec.name || "Section",
      type: sec.type || "verse",
      start: sec.start,
      bars: sec.bars,
      energy: Number(energy.toFixed(2)),
      activeTracks: activeTracks.length ? activeTracks : [...ALL_TRACK_IDS],
      mask: sec.instrumentMask || [...ALL_TRACK_IDS],
    };
  });
}

export function updateSectionBars(song, sectionId, targetBars) {
  const sections = getSongSections(song);
  if (!sections.length) return song;

  const validBars = [2, 4, 8, 12, 16, 24, 32].includes(targetBars) ? targetBars : 8;
  const clone = deepClone(song);
  const targetSections = getSongSections(clone);
  const sectionIndex = targetSections.findIndex((s) => s.id === sectionId);

  if (sectionIndex < 0) return song;

  const targetSection = targetSections[sectionIndex];
  const oldBars = targetSection.bars;
  if (oldBars === validBars) return song;

  const beatsPerBar = Number(clone.meta?.beatsPerBar ?? clone.beatsPerBar ?? 4);
  const oldBeats = oldBars * beatsPerBar;
  const newBeats = validBars * beatsPerBar;
  const scaleRatio = newBeats / oldBeats;
  const oldStartBeat = targetSection.start * beatsPerBar;
  const oldEndBeat = oldStartBeat + oldBeats;
  const deltaBeats = newBeats - oldBeats;

  targetSection.bars = validBars;

  // Scale notes in section & shift subsequent notes
  (clone.tracks || []).forEach((tr) => {
    if (!Array.isArray(tr.notes)) return;
    const newNotes = [];
    tr.notes.forEach((n) => {
      const beat = Number(n.startBeat ?? n.start ?? 0);
      const dur = Number(n.durationBeats ?? n.duration ?? 1);

      if (beat >= oldStartBeat && beat < oldEndBeat) {
        // Inside target section: scale position & duration
        const relBeat = beat - oldStartBeat;
        const scaledStart = oldStartBeat + relBeat * scaleRatio;
        const scaledDur = Math.max(0.125, dur * scaleRatio);
        newNotes.push({
          ...n,
          startBeat: scaledStart,
          durationBeats: scaledDur,
        });
      } else if (beat >= oldEndBeat) {
        // After target section: shift forward/backward
        newNotes.push({
          ...n,
          startBeat: beat + deltaBeats,
        });
      } else {
        // Before target section: leave unchanged
        newNotes.push(n);
      }
    });
    tr.notes = newNotes;
  });

  // Re-calculate start bars for all subsequent sections
  let currentStart = 0;
  targetSections.forEach((sec) => {
    sec.start = currentStart;
    currentStart += sec.bars;
  });

  if (clone.meta) clone.meta.bars = currentStart;
  if ("bars" in clone) clone.bars = currentStart;

  return clone;
}

export function updateSectionEnergy(song, sectionId, energyLevel) {
  const sections = getSongSections(song);
  if (!sections.length) return song;

  const clone = deepClone(song);
  const targetSections = getSongSections(clone);
  const beatsPerBar = Number(clone.meta?.beatsPerBar ?? clone.beatsPerBar ?? 4);
  const targetSection = targetSections.find((s) => s.id === sectionId);
  if (!targetSection) return song;

  const startBeat = targetSection.start * beatsPerBar;
  const endBeat = (targetSection.start + targetSection.bars) * beatsPerBar;

  const multiplier = energyLevel === "peak" ? 1.25 : energyLevel === "low" ? 0.65 : 1.0;

  (clone.tracks || []).forEach((tr) => {
    if (!Array.isArray(tr.notes)) return;
    tr.notes = tr.notes.map((n) => {
      const beat = Number(n.startBeat ?? n.start ?? 0);
      if (beat >= startBeat && beat < endBeat) {
        const vel = Number(n.velocity ?? 90);
        return {
          ...n,
          velocity: clamp(Math.round(vel * multiplier), 20, 127),
        };
      }
      return n;
    });
  });

  return clone;
}

export function updateSectionInstrumentMask(song, sectionId, activeTracks) {
  const sections = getSongSections(song);
  if (!sections.length) return song;

  const clone = deepClone(song);
  const targetSections = getSongSections(clone);
  const targetSection = targetSections.find((s) => s.id === sectionId);
  if (!targetSection) return song;

  targetSection.instrumentMask = [...activeTracks];

  return clone;
}

export function calculateNextQueuedSection(currentBeat, targetSectionId, song) {
  const sections = getSongSections(song);
  if (!sections.length) return null;

  const beatsPerBar = Number(song.meta?.beatsPerBar ?? song.beatsPerBar ?? 4);
  const targetSection = sections.find((s) => s.id === targetSectionId);
  if (!targetSection) return null;

  // Next bar boundary after currentBeat
  const currentBar = Math.floor(currentBeat / beatsPerBar);
  const triggerBeat = (currentBar + 1) * beatsPerBar;
  const targetStartBeat = targetSection.start * beatsPerBar;

  return {
    targetSectionId,
    targetSectionName: targetSection.name,
    triggerBeat,
    targetStartBeat,
  };
}
