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
  const scale = scalePitchClasses(song);
  const phaseFor = (entry) => (
    (finite(entry.note?.start) - targetRange.start)
    / Math.max(0.25, targetRange.end - targetRange.start)
  );
  const allowedPitches = [];
  for (let pitch = window.min; pitch <= window.max; pitch += 1) {
    if (!scale?.size || scale.has(mod12(pitch))) allowedPitches.push(pitch);
  }
  if (!allowedPitches.length) return [];

  // At the register ceiling, equality with the setup peak is still a meaningful
  // payoff. The previous implementation required referencePeak + 1 and therefore
  // had no legal move when the source/setup already touched the melody ceiling.
  const desiredPeak = Math.min(
    window.max,
    referencePeak < window.max - 1 ? Math.ceil(referencePeak + 2) : Math.ceil(referencePeak),
  );
  const payoffPitch = [...allowedPitches]
    .filter((pitch) => pitch >= Math.min(desiredPeak, window.max))
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

  // Strategy A: establish one clear late peak, optionally lifting its approach
  // note just enough to keep the melodic leap bounded.
  for (const option of eligible) {
    const currentPitch = Math.round(finite(option.entry.note?.pitch, 60));
    if (payoffPitch <= currentPitch) continue;

    const previous = targetEntries[option.position - 1];
    const following = targetEntries[option.position + 1];
    const candidate = cloneValue(song);
    const track = melodyTrack(candidate);
    const note = track?.notes?.[option.entry.index];
    if (!note) continue;

    let changed = 0;
    let previousPitch = previous ? Math.round(finite(previous.note?.pitch, payoffPitch)) : payoffPitch;
    const followingPitch = following ? Math.round(finite(following.note?.pitch, payoffPitch)) : payoffPitch;

    if (Math.abs(payoffPitch - previousPitch) > 10 && previous && !isProtectedAnchor(previous.note)) {
      const desiredApproach = payoffPitch - Math.sign(payoffPitch - previousPitch) * 7;
      const approachPitch = [...allowedPitches]
        .sort((a, b) => Math.abs(a - desiredApproach) - Math.abs(b - desiredApproach) || a - b)
        .find((pitch) => (
          Math.abs(pitch - previousPitch) <= 10
          && Math.abs(payoffPitch - pitch) <= 10
        ));
      if (approachPitch != null && approachPitch !== previousPitch) {
        const approachNote = track?.notes?.[previous.index];
        if (approachNote) {
          approachNote.pitch = approachPitch;
          tag(approachNote, report.sourceSectionId, "section-story-approach");
          previousPitch = approachPitch;
          changed += 1;
        }
      }
    }

    if (
      Math.abs(payoffPitch - previousPitch) > 10
      || Math.abs(followingPitch - payoffPitch) > 10
    ) continue;

    note.pitch = payoffPitch;
    tag(note, report.sourceSectionId, "section-story-payoff");
    changed += 1;
    result.push({
      id: changed > 1 ? "lift-chorus-payoff-ramp" : "lift-chorus-payoff",
      song: candidate,
      changedNotes: changed,
    });
    if (result.length >= 2) break;
  }

  // Strategy B: if the whole return sits far below its setup, raise a small
  // contiguous late cell together. This preserves its internal shape better
  // than forcing one isolated giant leap.
  const lateCell = eligible.slice(0, 3);
  if (lateCell.length >= 2) {
    const currentPeak = Math.max(...lateCell.map(({ entry }) => finite(entry.note?.pitch, 60)));
    const lift = Math.max(1, Math.min(12, desiredPeak - currentPeak));
    const candidate = cloneValue(song);
    const track = melodyTrack(candidate);
    let changed = 0;

    for (const { entry } of lateCell) {
      const note = track?.notes?.[entry.index];
      if (!note) continue;
      const sourcePitch = Math.round(finite(note.pitch, 60));
      const desired = Math.min(window.max, sourcePitch + lift);
      const nextPitch = [...allowedPitches]
        .sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired) || a - b)[0];
      if (nextPitch == null || nextPitch <= sourcePitch) continue;
      note.pitch = nextPitch;
      tag(note, report.sourceSectionId, "section-story-late-cell");
      changed += 1;
    }

    if (changed >= 2) {
      result.push({
        id: "lift-chorus-payoff-cell",
        song: candidate,
        changedNotes: changed,
      });
    }
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
  const motifDirection = motifCoreDirectionCandidates(song, report);
  const motifExact = motifCoreRecallCandidate(song, report);
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
    ? [...motifDirection, motifExact, ...general].filter(Boolean)
    : before.reason === "section-story-payoff-weak"
      ? [...story, ...general].filter(Boolean)
      : [motifExact, ...story, ...general].filter(Boolean);
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
      const authorityPhase = candidate.id === "lift-chorus-payoff" ? "5H" : "5G";
      return {
        ...candidate,
        candidateIndex,
        authorityId: authorityPhase === "5H"
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
    .filter((candidate) => candidate.memoryScoreDelta > 0 && candidate.sectionScoreDelta > 0)
    .slice(0, limit);
}
