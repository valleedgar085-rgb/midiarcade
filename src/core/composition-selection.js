import { sectionRange, trackId, tracksOf } from "./composition-scope.js";

function selectionTarget(selection = {}) {
  const raw = String(selection?.target ?? selection?.scope ?? selection?.type ?? "song")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");
  if (["song", "whole-song", "whole", "all"].includes(raw)) return "song";
  if (["track", "instrument", "whole-track", "whole-instrument"].includes(raw)) return "track";
  if (["section", "whole-section"].includes(raw)) return "section";
  if (["section-track", "sectiontrack", "section-instrument", "sectioninstrument", "instrument-section"].includes(raw)) {
    return "section-track";
  }
  return raw;
}

export function normalizeCompositionSelection(selection = {}, song = null) {
  const requested = selectionTarget(selection);
  const sectionId = selection?.sectionId ?? selection?.section ?? null;
  const requestedTrackId = selection?.trackId ?? selection?.instrumentId ?? selection?.instrument ?? null;
  const resolvedTrackId = requestedTrackId == null ? null : String(requestedTrackId);
  let target = requested;

  if (target === "track" && sectionId != null) target = "section-track";
  if (target === "section" && resolvedTrackId) target = "section-track";

  if (!["song", "track", "section", "section-track"].includes(target)) {
    throw new TypeError(`Unsupported composition selection target: ${requested}`);
  }
  if (["track", "section-track"].includes(target) && !resolvedTrackId) {
    throw new TypeError(`${target} selection requires trackId`);
  }
  if (["section", "section-track"].includes(target) && sectionId == null) {
    throw new TypeError(`${target} selection requires sectionId`);
  }

  if (song && resolvedTrackId && !tracksOf(song).some((track) => trackId(track) === resolvedTrackId)) {
    throw new RangeError(`Unknown track: ${resolvedTrackId}`);
  }
  if (song && sectionId != null && !sectionRange(song, sectionId)) {
    throw new RangeError(`Unknown section: ${sectionId}`);
  }

  return {
    target,
    ...(resolvedTrackId ? { trackId: resolvedTrackId } : {}),
    ...(sectionId != null ? { sectionId: String(sectionId) } : {}),
  };
}
