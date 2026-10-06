import { cloneValue } from "./clone-value.js";
import { evaluateMelodySectionMemory } from "./melody-section-memory.js";
import { rolePreferredRegisterWindow } from "./role-register-policy.js";

export const MAX_MELODY_SECTION_DEVELOPMENT_CANDIDATES = 3;

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, finite(value, min)));
}
function mod12(value) {
  return ((Math.round(finite(value)) % 12) + 12) % 12;
}
function melodyTrack(song) {
  return (song?.tracks ?? []).find((track) => track?.id === "melody") ?? null;
}
function structure(song) {
  return Array.isArray(song?.structure) ? song.structure : (song?.sections ?? []);
}
function sectionBounds(song, sectionId) {
  const section = structure(song).find((entry) => String(entry?.id) === String(sectionId));
  if (!section) return null;
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = Number.isFinite(Number(section?.startBeat))
    ? Number(section.startBeat)
    : finite(section?.startBar ?? section?.start, 0) * beatsPerBar;
  const end = Number.isFinite(Number(section?.endBeat))
    ? Number(section.endBeat)
    : start + Math.max(1, finite(section?.bars, 1)) * beatsPerBar;
  return { section, start, end };
}
function indexedNotes(song, sectionId) {
  const range = sectionBounds(song, sectionId);
  const track = melodyTrack(song);
  if (!range || !track) return [];
  return (track.notes ?? [])
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => finite(note?.start) >= range.start - 1e-6 && finite(note?.start) < range.end - 1e-6)
    .sort((left, right) => finite(left.note?.start) - finite(right.note?.start) || finite(left.note?.pitch) - finite(right.note?.pitch));
}
function scalePitchClasses(song) {
  const keyPc = Number(song?.meta?.keyPc);
  const intervals = song?.meta?.scaleIntervals;
  if (!Number.isFinite(keyPc) || !Array.isArray(intervals) || !intervals.length) return null;
  return new Set(intervals.map((interval) => mod12(keyPc + Number(interval))));
}
function nearestPitchWithClass(reference, pitchClass, { min = 48, max = 84 } = {}) {
  const candidates = [];
  for (let pitch = min; pitch <= max; pitch += 1) {
    if (mod12(pitch) === mod12(pitchClass)) candidates.push(pitch);
  }
  return candidates.sort((a, b) => Math.abs(a - reference) - Math.abs(b - reference) || a - b)[0]
    ?? Math.round(clamp(reference, min, max));
}
function nearestScaleNeighbor(song, pitch, direction) {
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const scale = scalePitchClasses(song);
  const source = Math.round(finite(pitch, 60));
  if (!scale?.size) {
    const octave = source + (direction >= 0 ? 12 : -12);
    return octave >= window.min && octave <= window.max ? octave : source;
  }
  const candidates = [];
  for (let step = 1; step <= 7; step += 1) {
    const candidate = source + (direction >= 0 ? step : -step);
    if (candidate < window.min || candidate > window.max) continue;
    if (scale.has(mod12(candidate))) candidates.push(candidate);
  }
  return candidates[0] ?? source;
}
function isProtectedAnchor(note) {
  return Boolean(
    note?.ensembleCadenceRole
    || note?.transitionHandoffRole
    || note?.motifHandoffRole
    || note?.finalAssemblyRole
    || note?.phraseRole === "turnaround"
  );
}

function isHookSignatureProtectedAnchor(note) {
  // Phase 5J is a pitch-only hook-identity authority. Downstream ensemble tags
  // may annotate the opening hook cell, but they must not make a broken return
  // permanently unrepairable. The 5J contract explicitly preserves turnaround
  // anchors; timing, duration, velocity, topology, scale safety, and release
  // gates remain unchanged and authoritative.
  return note?.phraseRole === "turnaround";
}

function leadSeparationSafe(song, note, pitch) {
  const counterpoint = (song?.tracks ?? []).find((track) => track?.id === "counterpoint")?.notes ?? [];
  const start = finite(note?.start);
  const end = start + Math.max(0.02, finite(note?.duration, 0.25));
  return counterpoint.every((counter) => {
    const counterStart = finite(counter?.start);
    const counterEnd = counterStart + Math.max(0.02, finite(counter?.duration, 0.25));
    if (!(start < counterEnd - 1e-6 && counterStart < end - 1e-6)) return true;
    const intervalClass = mod12(Math.abs(Math.round(finite(pitch)) - Math.round(finite(counter?.pitch))));
    return ![0, 1, 6, 11].includes(intervalClass);
  });
}
function sourceContract(song, sectionId) {
  return (song?.phraseMemory?.sections ?? []).find((entry) => String(entry?.sectionId) === String(sectionId)) ?? null;
}
function tag(note, sourceSectionId, role) {
  note.phraseMemorySourceSectionId = sourceSectionId;
  note.sectionDevelopmentRole = role;
  // This tag is only applied to notes actually rewritten from the source-memory
  // relationship, so downstream diagnostics can distinguish authored recall
  // evidence from incidental contour similarity.
  note.motifMemoryCore = true;
}
function cloneBreakCandidate(song, report) {
  if (finite(report?.metrics?.cloneRisk) < 0.88) return null;
  const targetEntries = indexedNotes(song, report.sectionId);
  if (targetEntries.length < 4) return null;
  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  const positions = [
    Math.max(1, Math.floor(targetEntries.length / 3)),
    Math.min(targetEntries.length - 2, Math.floor((targetEntries.length * 2) / 3)),
  ];
  let changed = 0;
  positions.forEach((position, ordinal) => {
    const target = targetEntries[position];
    const note = track?.notes?.[target.index];
    if (!note) return;
    const direction = (position + ordinal + String(report.sectionId).length) % 2 === 0 ? 1 : -1;
    const nextPitch = nearestScaleNeighbor(candidate, note.pitch, direction);
    if (nextPitch === Math.round(finite(note.pitch))) return;
    note.pitch = nextPitch;
    tag(note, report.sourceSectionId, "developed-return");
    changed += 1;
  });
  return changed ? { id: "develop-clone", song: candidate, changedNotes: changed } : null;
}
function motifCoreRecallCandidate(song, report) {
  const relationship = String(report?.relationship ?? "");
  if (!["recall", "return"].includes(relationship)) return null;
  const threshold = relationship === "return" ? 0.56 : 0.42;
  if (finite(report?.metrics?.motifCoreSimilarity, 1) >= threshold) return null;

  const sourceEntries = indexedNotes(song, report.sourceSectionId);
  const targetEntries = indexedNotes(song, report.sectionId);
  if (sourceEntries.length < 3 || targetEntries.length < 3) return null;

  // Use the opening three-note cell as the melodic identity anchor. Preserve
  // its placement/rhythm in the return and restore only the internal contour.
  const source = sourceEntries.slice(0, 3).map((entry) => entry.note);
  const target = targetEntries.slice(0, 3);
  if (target.some((entry, index) => index > 0 && isProtectedAnchor(entry.note))) return null;

  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const scale = scalePitchClasses(candidate);
  const anchorPitch = Math.round(finite(target[0]?.note?.pitch, 60));
  const sourceIntervals = [
    Math.round(finite(source[1]?.pitch) - finite(source[0]?.pitch)),
    Math.round(finite(source[2]?.pitch) - finite(source[1]?.pitch)),
  ];

  const nearestAllowed = (desired) => {
    const choices = [];
    for (let pitch = window.min; pitch <= window.max; pitch += 1) {
      if (scale?.size && !scale.has(mod12(pitch))) continue;
      choices.push(pitch);
    }
    return choices.sort((left, right) => (
      Math.abs(left - desired) - Math.abs(right - desired) || left - right
    ))[0] ?? Math.round(clamp(desired, window.min, window.max));
  };

  const desired = [
    anchorPitch,
    nearestAllowed(anchorPitch + sourceIntervals[0]),
    null,
  ];
  desired[2] = nearestAllowed(desired[1] + sourceIntervals[1]);

  let changed = 0;
  for (let position = 1; position <= 2; position += 1) {
    const original = target[position];
    const note = track?.notes?.[original?.index];
    if (!note || isProtectedAnchor(note)) continue;
    const nextPitch = desired[position];
    const previousPitch = position === 1 ? anchorPitch : desired[position - 1];
    const followingPitch = position === 1
      ? desired[2]
      : Math.round(finite(targetEntries[3]?.note?.pitch, nextPitch));
    if (Math.abs(nextPitch - previousPitch) > 10 || Math.abs(followingPitch - nextPitch) > 10) continue;
    if (nextPitch === Math.round(finite(note.pitch))) continue;
    note.pitch = nextPitch;
    tag(note, report.sourceSectionId, position === 1 ? "motif-core-answer" : "motif-core-payoff");
    changed += 1;
  }

  return changed ? { id: "restore-motif-core", song: candidate, changedNotes: changed } : null;
}



function wrappedInterval(delta) {
  const wrapped = ((Math.round(finite(delta)) % 12) + 12) % 12;
  return wrapped > 6 ? wrapped - 12 : wrapped;
}

function motifCorePitchFit(sourceNotes, targetNotes) {
  if (sourceNotes.length < 3 || targetNotes.length < 3) return 0;
  const sourceIntervals = [
    wrappedInterval(finite(sourceNotes[1]?.pitch) - finite(sourceNotes[0]?.pitch)),
    wrappedInterval(finite(sourceNotes[2]?.pitch) - finite(sourceNotes[1]?.pitch)),
  ];
  const targetIntervals = [
    wrappedInterval(finite(targetNotes[1]?.pitch) - finite(targetNotes[0]?.pitch)),
    wrappedInterval(finite(targetNotes[2]?.pitch) - finite(targetNotes[1]?.pitch)),
  ];
  return sourceIntervals.reduce((sum, value, index) => {
    const other = targetIntervals[index] ?? 0;
    const distance = Math.min(6, Math.abs(value - other));
    const exactness = 1 - distance / 6;
    const directionMatch = Math.sign(value) === Math.sign(other) ? 1 : 0;
    return sum + exactness * 0.72 + directionMatch * 0.28;
  }, 0) / 2;
}

function motifCoreSearchCandidates(song, report, { maxCandidates = 2 } = {}) {
  const relationship = String(report?.relationship ?? "");
  if (!["recall", "return"].includes(relationship)) return [];
  const threshold = relationship === "return" ? 0.56 : 0.42;
  if (finite(report?.metrics?.motifCoreSimilarity, 1) >= threshold) return [];

  const sourceEntries = indexedNotes(song, report.sourceSectionId);
  const targetEntries = indexedNotes(song, report.sectionId);
  if (sourceEntries.length < 3 || targetEntries.length < 3) return [];

  const source = sourceEntries.slice(0, 3).map((entry) => entry.note);
  const target = targetEntries.slice(0, 3);
  const baseWindow = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const localPitches = target.map(({ note }) => Math.round(finite(note?.pitch, 60)));
  // Preserve the register the generator actually authored. A return can be
  // legitimately above the generic role window; forcing it back into 57-79 was
  // the cause of the hip-hop register-health regression.
  const minPitch = Math.max(48, Math.min(baseWindow.min, ...localPitches));
  const maxPitch = Math.min(88, Math.max(baseWindow.max, ...localPitches));
  const scale = scalePitchClasses(song);

  const allowedFor = ({ note }, position) => {
    const current = Math.round(finite(note?.pitch, 60));
    if (isProtectedAnchor(note)) return [current];
    const options = [];
    for (
      let pitch = Math.max(minPitch, current - 7);
      pitch <= Math.min(maxPitch, current + 7);
      pitch += 1
    ) {
      if (scale?.size && !scale.has(mod12(pitch))) continue;
      if (pitch !== current && !leadSeparationSafe(song, note, pitch)) continue;
      options.push(pitch);
    }
    if (!options.includes(current)) options.push(current);
    return [...new Set(options)].sort((a, b) => a - b);
  };

  const allowed = target.map(allowedFor);
  const currentFit = motifCorePitchFit(source, target.map(({ note }) => note));
  const nextOutside = targetEntries[3]?.note ?? null;
  const scored = [];

  for (const pitch0 of allowed[0]) {
    for (const pitch1 of allowed[1]) {
      if (Math.abs(pitch1 - pitch0) > 10) continue;
      for (const pitch2 of allowed[2]) {
        if (Math.abs(pitch2 - pitch1) > 10) continue;
        if (nextOutside && Math.abs(finite(nextOutside.pitch, pitch2) - pitch2) > 10) continue;
        const pitches = [pitch0, pitch1, pitch2];
        if (pitches.every((pitch, index) => pitch === localPitches[index])) continue;
        const fit = motifCorePitchFit(
          source,
          pitches.map((pitch, index) => ({ ...target[index].note, pitch })),
        );
        if (fit <= currentFit + 1e-6) continue;
        const movement = pitches.reduce(
          (sum, pitch, index) => sum + Math.abs(pitch - localPitches[index]),
          0,
        );
        const maxMove = Math.max(
          ...pitches.map((pitch, index) => Math.abs(pitch - localPitches[index])),
        );
        scored.push({ pitches, fit, movement, maxMove });
      }
    }
  }

  const observedMotif = finite(report?.metrics?.motifCoreSimilarity, 0);
  const estimatedRhythmFit = clamp(
    (observedMotif - currentFit * 0.82) / 0.18,
    0,
    1,
  );
  const requiredPitchFit = clamp(
    ((threshold + 0.012) - estimatedRhythmFit * 0.18) / 0.82,
    0,
    1,
  );

  const sufficient = scored
    .filter((entry) => entry.fit >= requiredPitchFit - 1e-9)
    .sort((left, right) => (
      left.movement - right.movement
      || left.maxMove - right.maxMove
      || right.fit - left.fit
      || left.pitches[0] - right.pitches[0]
      || left.pitches[1] - right.pitches[1]
      || left.pitches[2] - right.pitches[2]
    ));
  const strongest = [...scored].sort((left, right) => (
    right.fit - left.fit
    || left.movement - right.movement
    || left.maxMove - right.maxMove
    || left.pitches[0] - right.pitches[0]
    || left.pitches[1] - right.pitches[1]
    || left.pitches[2] - right.pitches[2]
  ));
  const ordered = [...sufficient, ...strongest];

  const result = [];
  const seen = new Set();
  for (const option of ordered) {
    const signature = option.pitches.join(",");
    if (seen.has(signature)) continue;
    seen.add(signature);

    const candidate = cloneValue(song);
    const track = melodyTrack(candidate);
    let changed = 0;
    for (let position = 0; position < 3; position += 1) {
      if (option.pitches[position] === localPitches[position]) continue;
      const entry = target[position];
      const note = track?.notes?.[entry.index];
      if (!note || isProtectedAnchor(note)) continue;
      note.pitch = option.pitches[position];
      tag(note, report.sourceSectionId, "motif-core-search");
      changed += 1;
    }
    if (!changed) continue;
    result.push({
      id: `restore-motif-core-search-${result.length + 1}`,
      song: candidate,
      changedNotes: changed,
      motifPitchFit: round(option.fit),
      pitchMovement: option.movement,
    });
    if (result.length >= Math.max(1, Math.min(3, Math.floor(maxCandidates)))) break;
  }
  return result;
}



function hookSignaturePitchFit(sourceNotes, targetNotes) {
  if (sourceNotes.length < 4 || targetNotes.length < 4) return 0;
  const sourceIntervals = sourceNotes.slice(1, 4).map((note, index) => (
    wrappedInterval(finite(note?.pitch) - finite(sourceNotes[index]?.pitch))
  ));
  const targetIntervals = targetNotes.slice(1, 4).map((note, index) => (
    wrappedInterval(finite(note?.pitch) - finite(targetNotes[index]?.pitch))
  ));
  return sourceIntervals.reduce((sum, value, index) => {
    const other = targetIntervals[index] ?? 0;
    const distance = Math.min(6, Math.abs(value - other));
    const exactness = 1 - distance / 6;
    const directionMatch = Math.sign(value) === Math.sign(other) ? 1 : 0;
    return sum + exactness * 0.72 + directionMatch * 0.28;
  }, 0) / 3;
}

function hookSignatureSearchCandidates(song, report, { maxCandidates = 2 } = {}) {
  const relationship = String(report?.relationship ?? "");
  if (!["recall", "return"].includes(relationship)) return [];
  const threshold = relationship === "return" ? 0.74 : 0.60;
  if (finite(report?.metrics?.hookSignatureSimilarity, 1) >= threshold) return [];

  const sourceEntries = indexedNotes(song, report.sourceSectionId);
  const targetEntries = indexedNotes(song, report.sectionId);
  if (sourceEntries.length < 4 || targetEntries.length < 4) return [];

  const source = sourceEntries.slice(0, 4).map((entry) => entry.note);
  const target = targetEntries.slice(0, 4);
  const localPitches = target.map(({ note }) => Math.round(finite(note?.pitch, 60)));
  const baseWindow = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const minPitch = Math.max(48, Math.min(baseWindow.min, ...localPitches));
  const maxPitch = Math.min(88, Math.max(baseWindow.max, ...localPitches));
  const scale = scalePitchClasses(song);

  const allowedFor = ({ note }, position) => {
    const current = localPitches[position];
    if (position === 0 || isHookSignatureProtectedAnchor(note)) return [current];
    const options = [current];
    for (
      let pitch = Math.max(minPitch, current - 7);
      pitch <= Math.min(maxPitch, current + 7);
      pitch += 1
    ) {
      if (scale?.size && !scale.has(mod12(pitch))) continue;
      if (pitch !== current && !leadSeparationSafe(song, note, pitch)) continue;
      options.push(pitch);
    }
    return [...new Set(options)]
      .sort((left, right) => (
        Math.abs(left - current) - Math.abs(right - current)
        || left - right
      ))
      .slice(0, 7);
  };

  const allowed = target.map(allowedFor);
  const currentFit = hookSignaturePitchFit(source, target.map(({ note }) => note));
  const observed = finite(report?.metrics?.hookSignatureSimilarity, 0);
  const nonPitchContribution = clamp(observed - currentFit * 0.80, 0, 0.20);
  const requiredPitchFit = clamp(
    ((threshold + 0.012) - nonPitchContribution) / 0.80,
    0,
    1,
  );
  const nextOutside = targetEntries[4]?.note ?? null;
  const scored = [];

  for (const p0 of allowed[0]) {
    for (const p1 of allowed[1]) {
      if (Math.abs(p1 - p0) > 12) continue;
      for (const p2 of allowed[2]) {
        if (Math.abs(p2 - p1) > 12) continue;
        for (const p3 of allowed[3]) {
          if (Math.abs(p3 - p2) > 12) continue;
          if (nextOutside && Math.abs(finite(nextOutside.pitch, p3) - p3) > 12) continue;
          const pitches = [p0, p1, p2, p3];
          const changed = pitches.filter((pitch, index) => pitch !== localPitches[index]).length;
          if (!changed || changed > 3) continue;
          const fit = hookSignaturePitchFit(
            source,
            pitches.map((pitch, index) => ({ ...target[index].note, pitch })),
          );
          if (fit <= currentFit + 1e-6) continue;
          const movement = pitches.reduce(
            (sum, pitch, index) => sum + Math.abs(pitch - localPitches[index]),
            0,
          );
          const maxMove = Math.max(
            ...pitches.map((pitch, index) => Math.abs(pitch - localPitches[index])),
          );
          scored.push({ pitches, changed, fit, movement, maxMove });
        }
      }
    }
  }

  const sufficient = scored
    .filter((entry) => entry.fit >= requiredPitchFit - 1e-9)
    .sort((left, right) => (
      left.changed - right.changed
      || left.movement - right.movement
      || left.maxMove - right.maxMove
      || right.fit - left.fit
      || left.pitches.join(",").localeCompare(right.pitches.join(","))
    ));
  const strongest = [...scored].sort((left, right) => (
    right.fit - left.fit
    || left.changed - right.changed
    || left.movement - right.movement
    || left.maxMove - right.maxMove
    || left.pitches.join(",").localeCompare(right.pitches.join(","))
  ));
  const ordered = [...sufficient, ...strongest];

  const result = [];
  const seen = new Set();
  for (const option of ordered) {
    const signature = option.pitches.join(",");
    if (seen.has(signature)) continue;
    seen.add(signature);

    const candidate = cloneValue(song);
    const track = melodyTrack(candidate);
    let changed = 0;
    for (let position = 0; position < 4; position += 1) {
      if (option.pitches[position] === localPitches[position]) continue;
      const entry = target[position];
      const note = track?.notes?.[entry.index];
      if (!note || isHookSignatureProtectedAnchor(note)) continue;
      note.pitch = option.pitches[position];
      tag(
        note,
        report.sourceSectionId,
        position === 3 ? "hook-signature-payoff" : "hook-signature-search",
      );
      changed += 1;
    }
    if (!changed) continue;
    result.push({
      id: `restore-hook-signature-search-${result.length + 1}`,
      song: candidate,
      changedNotes: changed,
      hookPitchFit: round(option.fit),
      pitchMovement: option.movement,
    });
    if (result.length >= Math.max(1, Math.min(3, Math.floor(maxCandidates)))) break;
  }
  return result;
}

function hookSignatureRecallCandidate(song, report) {
  const relationship = String(report?.relationship ?? "");
  if (!["recall", "return"].includes(relationship)) return null;
  const threshold = relationship === "return" ? 0.74 : 0.60;
  if (finite(report?.metrics?.hookSignatureSimilarity, 1) >= threshold) return null;

  const sourceEntries = indexedNotes(song, report.sourceSectionId);
  const targetEntries = indexedNotes(song, report.sectionId);
  if (sourceEntries.length < 4 || targetEntries.length < 4) return null;

  const source = sourceEntries.slice(0, 4).map((entry) => entry.note);
  const target = targetEntries.slice(0, 4);
  const sourceIntervals = source.slice(1).map((note, index) => (
    wrappedInterval(finite(note?.pitch) - finite(source[index]?.pitch))
  ));
  const localPitches = target.map(({ note }) => Math.round(finite(note?.pitch, 60)));
  const baseWindow = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const minPitch = Math.max(48, Math.min(baseWindow.min, ...localPitches));
  const maxPitch = Math.min(88, Math.max(baseWindow.max, ...localPitches));
  const scale = scalePitchClasses(song);

  const nearestAllowed = (desired, position) => {
    const choices = [];
    for (let pitch = minPitch; pitch <= maxPitch; pitch += 1) {
      if (scale?.size && !scale.has(mod12(pitch))) continue;
      if (!leadSeparationSafe(song, target[position]?.note, pitch)) continue;
      choices.push(pitch);
    }
    return choices.sort((left, right) => (
      Math.abs(left - desired) - Math.abs(right - desired)
      || Math.abs(left - localPitches[0]) - Math.abs(right - localPitches[0])
      || left - right
    ))[0] ?? Math.round(desired);
  };

  // Keep the section's authored register anchor, but restore the four-note
  // identity path that a listener actually remembers.
  const desired = [localPitches[0]];
  for (let index = 0; index < sourceIntervals.length; index += 1) {
    desired.push(nearestAllowed(desired[index] + sourceIntervals[index], index + 1));
  }

  for (let position = 0; position < 4; position += 1) {
    if (
      isHookSignatureProtectedAnchor(target[position]?.note)
      && desired[position] !== localPitches[position]
    ) return null;
    if (position > 0 && Math.abs(desired[position] - desired[position - 1]) > 12) return null;
  }
  const nextOutside = targetEntries[4]?.note ?? null;
  if (nextOutside && Math.abs(finite(nextOutside.pitch, desired[3]) - desired[3]) > 12) return null;

  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  let changed = 0;
  for (let position = 1; position < 4; position += 1) {
    if (desired[position] === localPitches[position]) continue;
    const entry = target[position];
    const note = track?.notes?.[entry.index];
    if (!note || isHookSignatureProtectedAnchor(note)) continue;
    note.pitch = desired[position];
    tag(note, report.sourceSectionId, position === 3 ? "hook-signature-payoff" : "hook-signature-recall");
    changed += 1;
  }

  return changed
    ? {
      id: "restore-hook-signature",
      song: candidate,
      changedNotes: changed,
    }
    : null;
}

function motifCoreDirectionCandidates(song, report) {
  const relationship = String(report?.relationship ?? "");
  if (!["recall", "return"].includes(relationship)) return [];
  const threshold = relationship === "return" ? 0.56 : 0.42;
  if (finite(report?.metrics?.motifCoreSimilarity, 1) >= threshold) return [];

  const sourceEntries = indexedNotes(song, report.sourceSectionId);
  const targetEntries = indexedNotes(song, report.sectionId);
  if (sourceEntries.length < 3 || targetEntries.length < 3) return [];

  const source = sourceEntries.slice(0, 3).map((entry) => entry.note);
  const target = targetEntries.slice(0, 3);
  const candidates = [];

  for (const position of [1, 2]) {
    const targetEntry = target[position];
    if (!targetEntry?.note || isProtectedAnchor(targetEntry.note)) continue;

    const sourcePrev = source[position - 1];
    const sourceNow = source[position];
    const targetPrev = target[position - 1]?.note;
    if (!sourcePrev || !sourceNow || !targetPrev) continue;

    const sourceDelta = Math.round(finite(sourceNow.pitch) - finite(sourcePrev.pitch));
    const wrapped = ((sourceDelta % 12) + 12) % 12;
    const sourceDirection = Math.sign(wrapped > 6 ? wrapped - 12 : wrapped);
    if (!sourceDirection) continue;

    const currentPitch = Math.round(finite(targetEntry.note.pitch, 60));
    const nextPitch = nearestScaleNeighbor(song, currentPitch, sourceDirection);
    if (nextPitch === currentPitch) continue;
    if (!leadSeparationSafe(song, targetEntry.note, nextPitch)) continue;

    const previousPitch = Math.round(finite(targetPrev.pitch, currentPitch));
    const followingPitch = position < 2
      ? Math.round(finite(target[position + 1]?.note?.pitch, nextPitch))
      : Math.round(finite(targetEntries[3]?.note?.pitch, nextPitch));
    if (
      Math.abs(nextPitch - previousPitch) > 10
      || Math.abs(followingPitch - nextPitch) > 10
    ) continue;

    const candidate = cloneValue(song);
    const note = melodyTrack(candidate)?.notes?.[targetEntry.index];
    if (!note) continue;
    note.pitch = nextPitch;
    tag(note, report.sourceSectionId, "motif-core-direction");
    candidates.push({
      id: `restore-motif-core-direction-${position}`,
      song: candidate,
      changedNotes: 1,
    });
  }

  return candidates;
}

function sectionStoryPayoffCandidates(song, report) {
  if (report?.metrics?.sectionStoryEligible !== true) return [];
  if (finite(report?.metrics?.sectionStoryPayoff, 1) >= 0.6) return [];

  const sourceEntries = indexedNotes(song, report.sourceSectionId);
  const targetEntries = indexedNotes(song, report.sectionId);
  const targetRange = sectionBounds(song, report.sectionId);
  if (sourceEntries.length < 3 || targetEntries.length < 4 || !targetRange) return [];

  const ordered = structure(song);
  const targetSectionIndex = ordered.findIndex((entry) => String(entry?.id) === String(report.sectionId));
  let previousEntries = [];
  for (let cursor = targetSectionIndex - 1; cursor >= 0; cursor -= 1) {
    previousEntries = indexedNotes(song, ordered[cursor]?.id);
    if (previousEntries.length >= 2) break;
  }
  if (!previousEntries.length) previousEntries = sourceEntries;

  const sourcePeak = Math.max(...sourceEntries.map((entry) => finite(entry.note?.pitch, 60)));
  const previousPeak = Math.max(...previousEntries.map((entry) => finite(entry.note?.pitch, 60)));
  const referencePeak = Math.max(sourcePeak, previousPeak);
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const dynamicMax = Math.min(88, Math.max(window.max, Math.ceil(referencePeak + 2)));
  const scale = scalePitchClasses(song);
  const phaseFor = (entry) => (
    (finite(entry.note?.start) - targetRange.start)
    / Math.max(0.25, targetRange.end - targetRange.start)
  );
  const allowedPitches = [];
  for (let pitch = window.min; pitch <= dynamicMax; pitch += 1) {
    if (!scale?.size || scale.has(mod12(pitch))) allowedPitches.push(pitch);
  }
  if (!allowedPitches.length) return [];

  // At the register ceiling, equality with the setup peak is still a meaningful
  // payoff. The previous implementation required referencePeak + 1 and therefore
  // had no legal move when the source/setup already touched the melody ceiling.
  const desiredPeak = Math.min(
    dynamicMax,
    referencePeak < dynamicMax - 1 ? Math.ceil(referencePeak + 2) : Math.ceil(referencePeak),
  );
  const payoffPitch = [...allowedPitches]
    .filter((pitch) => pitch >= Math.min(desiredPeak, dynamicMax))
    .sort((a, b) => Math.abs(a - desiredPeak) - Math.abs(b - desiredPeak) || b - a)[0]
    ?? [...allowedPitches].sort((a, b) => b - a)[0];

  const eligible = targetEntries
    .map((entry, position) => ({ entry, position, phase: phaseFor(entry) }))
    .filter(({ position }) => position >= 3)
    .filter(({ entry }) => !isProtectedAnchor(entry.note))
    .filter(({ phase }) => phase >= 0.42 && phase <= 0.84)
    .sort((left, right) => (
      Math.abs(left.phase - 0.68) - Math.abs(right.phase - 0.68)
      || left.position - right.position
    ));
  if (!eligible.length) return [];

  const result = [];
  // A deliberate chorus/drop payoff may use an octave-sized leap. Keep this
  // slightly wider than ordinary contour repair, but still bounded and subject
  // to the full release/critic gates before it can commit.
  const maxPayoffLeap = 12;
  const originalPitches = targetEntries.map(({ note }) => Math.round(finite(note?.pitch, 60)));

  const nearestAllowedInRange = (desired, minPitch, maxPitch) => (
    [...allowedPitches]
      .filter((pitch) => pitch >= minPitch && pitch <= maxPitch)
      .sort((left, right) => (
        Math.abs(left - desired) - Math.abs(right - desired)
        || left - right
      ))[0] ?? null
  );

  // Build the smallest scale-safe path needed to reach a late payoff peak.
  // Unlike the old one-note repair, this can walk backward/forward through
  // several editable notes until the new peak reconnects to authored material.
  for (const option of eligible) {
    const peakPosition = option.position;
    const peakCurrent = originalPitches[peakPosition];
    if (payoffPitch <= peakCurrent) continue;

    const pitches = [...originalPitches];
    const changedPositions = new Set([peakPosition]);
    pitches[peakPosition] = payoffPitch;
    let safe = true;

    for (let position = peakPosition - 1; position >= 0; position -= 1) {
      if (Math.abs(pitches[position] - pitches[position + 1]) <= maxPayoffLeap) break;
      const entry = targetEntries[position];
      if (!entry?.note || isProtectedAnchor(entry.note)) {
        safe = false;
        break;
      }
      const nextPitch = pitches[position + 1];
      const repaired = nearestAllowedInRange(
        originalPitches[position],
        Math.max(window.min, nextPitch - maxPayoffLeap),
        Math.min(dynamicMax, nextPitch + maxPayoffLeap),
      );
      if (repaired == null) {
        safe = false;
        break;
      }
      pitches[position] = repaired;
      changedPositions.add(position);
      if (changedPositions.size > 6) {
        safe = false;
        break;
      }
    }
    if (!safe) continue;

    for (let position = peakPosition + 1; position < targetEntries.length; position += 1) {
      if (Math.abs(pitches[position] - pitches[position - 1]) <= maxPayoffLeap) break;
      const entry = targetEntries[position];
      if (!entry?.note || isProtectedAnchor(entry.note)) {
        safe = false;
        break;
      }
      const previousPitch = pitches[position - 1];
      const repaired = nearestAllowedInRange(
        originalPitches[position],
        Math.max(window.min, previousPitch - maxPayoffLeap),
        Math.min(dynamicMax, previousPitch + maxPayoffLeap),
      );
      if (repaired == null) {
        safe = false;
        break;
      }
      pitches[position] = repaired;
      changedPositions.add(position);
      if (changedPositions.size > 6) {
        safe = false;
        break;
      }
    }
    if (!safe) continue;

    // Only enforce leap safety on pairs touched by this repair. Existing
    // authored leaps elsewhere in the section are outside 5H's authority.
    const touchedPairsSafe = [...changedPositions].every((position) => {
      const leftSafe = position <= 0 || Math.abs(pitches[position] - pitches[position - 1]) <= maxPayoffLeap;
      const rightSafe = position >= pitches.length - 1 || Math.abs(pitches[position + 1] - pitches[position]) <= maxPayoffLeap;
      return leftSafe && rightSafe;
    });
    if (!touchedPairsSafe) continue;

    const candidate = cloneValue(song);
    const track = melodyTrack(candidate);
    let changed = 0;
    for (const position of [...changedPositions].sort((a, b) => a - b)) {
      const entry = targetEntries[position];
      const note = track?.notes?.[entry?.index];
      if (!note) continue;
      const nextPitch = pitches[position];
      if (nextPitch === originalPitches[position]) continue;
      note.pitch = nextPitch;
      tag(
        note,
        report.sourceSectionId,
        position === peakPosition ? "section-story-payoff" : "section-story-path",
      );
      changed += 1;
    }
    if (!changed) continue;

    result.push({
      id: changed === 1 ? "lift-chorus-payoff" : "lift-chorus-payoff-path",
      song: candidate,
      changedNotes: changed,
      payoffPhase: round(option.phase),
      payoffPitch,
    });
    if (result.length >= 3) break;
  }

  return result;
}

function contourRecallCandidate(song, report, {
  maxNotes = 2,
  id = "restore-contour",
} = {}) {
  if (finite(report?.metrics?.relationshipFit, 1) >= 0.72 && finite(report?.metrics?.familiarity, 1) >= 0.48) return null;
  const sourceEntries = indexedNotes(song, report.sourceSectionId);
  const targetEntries = indexedNotes(song, report.sectionId);
  if (sourceEntries.length < 3 || targetEntries.length < 3) return null;
  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const count = Math.min(sourceEntries.length, targetEntries.length);
  const options = [...Array(Math.max(0, count - 2)).keys()]
    .map((offset) => offset + 1)
    .map((position) => {
      const sourcePosition = Math.round(position * (sourceEntries.length - 1) / (count - 1));
      const targetPosition = Math.round(position * (targetEntries.length - 1) / (count - 1));
      const source = sourceEntries[sourcePosition]?.note;
      const target = targetEntries[targetPosition];
      const note = target?.note;
      const currentPitch = Math.round(finite(note?.pitch, 60));
      const matchedPitch = source && note
        ? nearestPitchWithClass(currentPitch, mod12(source.pitch), window)
        : null;
      const previousTarget = targetPosition > 0 ? targetEntries[targetPosition - 1]?.note : null;
      const previousSource = sourcePosition > 0 ? sourceEntries[sourcePosition - 1]?.note : null;
      const sourceDirection = previousSource && source
        ? Math.sign(finite(source.pitch) - finite(previousSource.pitch))
        : 0;
      const currentDirection = previousTarget && note
        ? Math.sign(finite(note.pitch) - finite(previousTarget.pitch))
        : 0;
      const restoresContour = sourceDirection !== 0 && currentDirection !== sourceDirection;
      // This stage owns harmonic identity, not register. Skip octave-only moves
      // unless that register correction restores the source contour direction.
      const registerOnly = matchedPitch != null
        && matchedPitch !== currentPitch
        && mod12(matchedPitch) === mod12(currentPitch);
      const nextPitch = matchedPitch != null && registerOnly && !restoresContour
        ? null
        : matchedPitch;
      const start = finite(note?.start);
      const offStrongBeat = Math.abs(start - Math.round(start)) > 0.09;
      return {
        position,
        source,
        target,
        nextPitch,
        protected: isProtectedAnchor(note),
        short: finite(note?.duration, 0.5) < 0.65,
        offStrongBeat,
        pitchDistance: source && note ? Math.abs(finite(source.pitch) - finite(note.pitch)) : 0,
      };
    })
    .filter((entry) => entry.source && entry.target && entry.nextPitch != null)
    .filter((entry) => !entry.protected)
    .filter((entry) => entry.nextPitch !== Math.round(finite(entry.target.note?.pitch)))
    .sort((left, right) => (
      Number(right.short) - Number(left.short)
      || Number(right.offStrongBeat) - Number(left.offStrongBeat)
      || right.pitchDistance - left.pitchDistance
      || left.position - right.position
    ))
    .slice(0, Math.max(1, Math.min(3, Math.floor(finite(maxNotes, 2)))));
  let changed = 0;
  for (const option of options) {
    const note = track?.notes?.[option.target?.index];
    if (!note) continue;
    note.pitch = option.nextPitch;
    tag(note, report.sourceSectionId, maxNotes >= 3 ? "motif-recall-anchor-strong" : "motif-recall-anchor");
    changed += 1;
  }
  return changed ? { id, song: candidate, changedNotes: changed } : null;
}
function directionalContourCandidate(song, report) {
  const sourceEntries = indexedNotes(song, report.sourceSectionId);
  const targetEntries = indexedNotes(song, report.sectionId);
  if (sourceEntries.length < 4 || targetEntries.length < 4) return null;
  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  const comparable = Math.min(sourceEntries.length, targetEntries.length);
  const opportunities = [];

  for (let position = 1; position < comparable - 1; position += 1) {
    const sourcePrev = sourceEntries[Math.round((position - 1) * (sourceEntries.length - 1) / (comparable - 1))]?.note;
    const sourceNow = sourceEntries[Math.round(position * (sourceEntries.length - 1) / (comparable - 1))]?.note;
    const targetPrev = targetEntries[Math.round((position - 1) * (targetEntries.length - 1) / (comparable - 1))]?.note;
    const target = targetEntries[Math.round(position * (targetEntries.length - 1) / (comparable - 1))];
    if (!sourcePrev || !sourceNow || !targetPrev || !target?.note || isProtectedAnchor(target.note)) continue;
    const sourceDirection = Math.sign(finite(sourceNow.pitch) - finite(sourcePrev.pitch));
    const targetDirection = Math.sign(finite(target.note.pitch) - finite(targetPrev.pitch));
    if (sourceDirection === 0 || sourceDirection === targetDirection) continue;

    const nextPitch = nearestScaleNeighbor(candidate, target.note.pitch, sourceDirection);
    if (nextPitch === Math.round(finite(target.note.pitch))) continue;
    if (nextPitch < window.min || nextPitch > window.max) continue;
    opportunities.push({
      target,
      nextPitch,
      sourceDirection,
      short: finite(target.note.duration, 0.5) < 0.65,
      offStrongBeat: Math.abs(finite(target.note.start) - Math.round(finite(target.note.start))) > 0.09,
    });
  }

  opportunities.sort((left, right) => (
    Number(right.short) - Number(left.short)
    || Number(right.offStrongBeat) - Number(left.offStrongBeat)
    || finite(left.target.note.start) - finite(right.target.note.start)
  ));

  let changed = 0;
  for (const option of opportunities.slice(0, 3)) {
    const note = track?.notes?.[option.target.index];
    if (!note) continue;
    note.pitch = option.nextPitch;
    tag(note, report.sourceSectionId, "motif-direction-recall");
    changed += 1;
  }
  return changed ? { id: "restore-directional-contour", song: candidate, changedNotes: changed } : null;
}

function endingRecallCandidate(song, report) {
  if (finite(report?.metrics?.endingSimilarity, 1) >= 0.76) return null;
  const sourceEntries = indexedNotes(song, report.sourceSectionId);
  const targetEntries = indexedNotes(song, report.sectionId);
  if (sourceEntries.length < 2 || targetEntries.length < 2) return null;
  const candidate = cloneValue(song);
  const track = melodyTrack(candidate);
  const window = rolePreferredRegisterWindow("melody") ?? { min: 57, max: 79 };
  let changed = 0;
  for (let tail = 2; tail >= 1; tail -= 1) {
    const source = sourceEntries[sourceEntries.length - tail]?.note;
    const target = targetEntries[targetEntries.length - tail];
    const note = track?.notes?.[target?.index];
    if (!source || !note) continue;
    const currentPitch = Math.round(finite(note.pitch, 60));
    const matchedPitch = nearestPitchWithClass(currentPitch, mod12(source.pitch), window);
    const previousTarget = targetEntries[targetEntries.length - tail - 1]?.note;
    const previousSource = sourceEntries[sourceEntries.length - tail - 1]?.note;
    const sourceDirection = previousSource && source
      ? Math.sign(finite(source.pitch) - finite(previousSource.pitch))
      : 0;
    const currentDirection = previousTarget
      ? Math.sign(finite(note.pitch) - finite(previousTarget.pitch))
      : 0;
    const restoresEndingContour = sourceDirection !== 0 && currentDirection !== sourceDirection;
    const registerOnlyPitchChange = matchedPitch !== currentPitch
      && mod12(matchedPitch) === mod12(currentPitch);
    const nextPitch = registerOnlyPitchChange && !restoresEndingContour ? currentPitch : matchedPitch;
    const nextDuration = round(clamp(
      finite(note.duration, 0.5) * 0.55 + finite(source.duration, 0.5) * 0.45,
      0.12,
      1.5,
    ));
    if (nextPitch !== currentPitch || Math.abs(nextDuration - finite(note.duration, 0.5)) > 1e-6) changed += 1;
    note.pitch = nextPitch;
    note.duration = nextDuration;
    tag(note, report.sourceSectionId, tail === 1 ? "memory-landing" : "memory-approach");
  }
  return changed ? { id: "restore-ending", song: candidate, changedNotes: changed } : null;
}

/**
 * Tiny, deterministic repair set for the single weakest melody-memory relationship.
 * It never changes note topology, canonical start times, or non-melody tracks.
 */
export function createMelodySectionDevelopmentCandidates(song, {
  maxCandidates = MAX_MELODY_SECTION_DEVELOPMENT_CANDIDATES,
} = {}) {
  const before = evaluateMelodySectionMemory(song);
  const weakest = before?.weakestSection;
  if (!weakest?.available || before.status !== "evaluated" || before.passed) return [];
  const contract = sourceContract(song, weakest.sectionId);
  const report = {
    ...weakest,
    sourceSectionId: weakest.sourceSectionId ?? contract?.sourceSectionId ?? null,
  };
  if (!report.sourceSectionId) return [];
  const motifSearch = motifCoreSearchCandidates(song, report, { maxCandidates: 2 });
  const motifDirection = motifCoreDirectionCandidates(song, report);
  const motifExact = motifCoreRecallCandidate(song, report);
  const hookSignatureSearch = hookSignatureSearchCandidates(song, report, { maxCandidates: 2 });
  const hookSignature = hookSignatureRecallCandidate(song, report);
  const story = sectionStoryPayoffCandidates(song, report);
  const general = [
    cloneBreakCandidate(song, report),
    endingRecallCandidate(song, report),
    directionalContourCandidate(song, report),
    contourRecallCandidate(song, report, { maxNotes: 2, id: "restore-contour" }),
    contourRecallCandidate(song, report, { maxNotes: 3, id: "restore-contour-strong" }),
  ].filter(Boolean);
  // 5G owns motif identity before 5H owns payoff. When the read-only audit
  // identifies one of those defects, reserve the tiny candidate budget for its
  // actual owner instead of letting unrelated contour/ending moves crowd it out.
  const raw = before.reason === "motif-core-weak"
    ? [...motifSearch, ...hookSignatureSearch, ...motifDirection, motifExact, ...general].filter(Boolean)
    : before.reason === "hook-signature-weak"
      ? [...hookSignatureSearch, hookSignature, motifExact, ...general].filter(Boolean)
      : before.reason === "section-story-payoff-weak"
        // 5H owns this defect. If it can author a payoff candidate, do not let a
        // larger generic 5G delta starve the actual failing authority.
        ? (story.length ? [...story] : [...general]).filter(Boolean)
        : [hookSignature, motifExact, ...story, ...general].filter(Boolean);
  const seen = new Set();
  const limit = Math.max(
    0,
    Math.min(
      MAX_MELODY_SECTION_DEVELOPMENT_CANDIDATES,
      Math.floor(finite(maxCandidates, MAX_MELODY_SECTION_DEVELOPMENT_CANDIDATES)),
    ),
  );
  return raw
    .map((candidate, candidateIndex) => {
      const after = evaluateMelodySectionMemory(candidate.song);
      const afterSection = (after.sections ?? []).find((entry) => String(entry.sectionId) === String(report.sectionId)) ?? null;
      const signature = JSON.stringify(melodyTrack(candidate.song)?.notes?.map((note) => [
        round(note.start), Math.round(finite(note.pitch)), round(note.duration), Math.round(finite(note.velocity, 84)),
      ]) ?? []);
      if (seen.has(signature)) return null;
      seen.add(signature);
      const authorityPhase = candidate.id.startsWith("restore-hook-signature")
        ? "5J"
        : candidate.id.startsWith("lift-chorus-payoff")
          ? "5H"
          : "5G";
      return {
        ...candidate,
        candidateIndex,
        authorityId: authorityPhase === "5J"
          ? "5j-hook-signature-recognizability"
          : authorityPhase === "5H"
            ? "5h-section-story-payoff"
            : "5g-motif-recall",
        authorityPhase,
        sectionId: report.sectionId,
        sourceSectionId: report.sourceSectionId,
        relationship: report.relationship,
        beforeMemoryScore: before.score,
        afterMemoryScore: after.score,
        memoryScoreDelta: after.score - before.score,
        beforeSectionScore: finite(report.score),
        afterSectionScore: finite(afterSection?.score),
        sectionScoreDelta: finite(afterSection?.score) - finite(report.score),
        beforeReport: before,
        afterReport: after,
        beforeSection: report,
        afterSection,
      };
    })
    .filter(Boolean)
    .filter((candidate) => {
      const threshold = candidate.relationship === "return" ? 0.74 : 0.60;
      const hookSignatureCleared = candidate.authorityPhase === "5J"
        && finite(candidate.beforeSection?.metrics?.hookSignatureSimilarity, 1) < threshold
        && finite(candidate.afterSection?.metrics?.hookSignatureSimilarity, 0) >= threshold;
      return (
        candidate.memoryScoreDelta > 0
        && candidate.sectionScoreDelta > 0
      ) || (
        hookSignatureCleared
        && candidate.memoryScoreDelta >= 0
        && candidate.sectionScoreDelta >= 0
      );
    })
    .slice(0, limit);
}
