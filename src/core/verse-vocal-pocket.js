import { normalizeGenreId } from "./genre-contract.js";

const RAP_STYLES = new Set(["rap", "hipHop", "trap", "drill"]);
const round = (value) => Math.round(value * 1000) / 1000;
const valid = (value) => typeof value === "number" && Number.isFinite(value);

function sectionBounds(song, section) {
  const beatsPerBar = song?.meta?.beatsPerBar ?? 4;
  if (!valid(beatsPerBar) || beatsPerBar <= 0) return null;
  const start = valid(section?.startBeat)
    ? section.startBeat
    : valid(section?.startBar) ? section.startBar * beatsPerBar : null;
  const end = valid(section?.endBeat)
    ? section.endBeat
    : valid(section?.bars) && start !== null ? start + section.bars * beatsPerBar : null;
  return start !== null && end !== null && end > start + 1e-6 ? { start, end } : null;
}

function trackIntervals(song, trackId, { start, end }) {
  const track = (song?.tracks ?? []).find((entry) => entry?.id === trackId);
  if (!Array.isArray(track?.notes)) return null;
  const intervals = [];
  let count = 0;
  for (const note of track.notes) {
    if (!valid(note?.start) || !valid(note?.duration) || note.duration <= 0) continue;
    if (note.start < start - 1e-6 || note.start >= end - 1e-6) continue;
    count += 1;
    const clippedEnd = Math.min(end, note.start + note.duration);
    if (clippedEnd > note.start) intervals.push([note.start, clippedEnd]);
  }
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const [left, right] of intervals) {
    if (merged.length && left <= merged.at(-1)[1] + 1e-7) {
      merged.at(-1)[1] = Math.max(right, merged.at(-1)[1]);
    } else {
      merged.push([left, right]);
    }
  }
  return { count, merged };
}

function lengthOf(intervals) {
  return intervals.reduce((sum, [a, b]) => sum + b - a, 0);
}

function overlapOf(left, right) {
  let i = 0;
  let j = 0;
  let overlap = 0;
  while (i < left.length && j < right.length) {
    overlap += Math.max(0, Math.min(left[i][1], right[j][1])
      - Math.max(left[i][0], right[j][0]));
    if (left[i][1] <= right[j][1]) i += 1;
    else j += 1;
  }
  return overlap;
}

/**
 * A read-only MIDI activity observation, NOT a recording or vocal detector.
 * Durations are unioned first so overlapping MIDI notes are never double
 * counted. Missing metadata fails closed. No score or rewrite authority.
 */
export function measureVerseVocalPocket(song, section) {
  const genre = normalizeGenreId(song?.meta?.genre ?? song?.genre);
  if (!RAP_STYLES.has(genre) || !section?.id) return null;
  const role = [section.role, section.name, section.type, section.id].some((value) =>
    /^(?:verse|rap[ -]?verse)(?:\b|[-_0-9])/i.test(String(value ?? "").trim()));
  if (!role) return null;
  const bounds = sectionBounds(song, section);
  if (!bounds) return null;
  const lead = trackIntervals(song, "melody", bounds);
  const response = trackIntervals(song, "counterpoint", bounds);
  if (!lead || !response || lead.count < 1 || response.count < 1) return null;

  const duration = bounds.end - bounds.start;
  const leadFraction = lengthOf(lead.merged) / duration;
  const counterpointFraction = lengthOf(response.merged) / duration;
  const overlapFraction = overlapOf(lead.merged, response.merged) / duration;
  const openFraction = Math.max(0, Math.min(1, 1 - leadFraction - counterpointFraction + overlapFraction));
  return Object.freeze({
    sectionId: String(section.id),
    source: "midi-note-coverage",
    leadNotes: lead.count,
    counterpointNotes: response.count,
    leadActivityFraction: round(leadFraction),
    counterpointActivityFraction: round(counterpointFraction),
    overlapFraction: round(overlapFraction),
    jointRestFraction: round(openFraction),
    // Conservative, calibrated as suggestion thresholds only. No release gate.
    crowdedLead: lead.count >= 4 && leadFraction >= 0.5 && openFraction < 0.42,
    crowdedCounterpoint: response.count >= 4 && counterpointFraction >= 0.32
      && (overlapFraction >= 0.2 || openFraction < 0.42),
  });
}
