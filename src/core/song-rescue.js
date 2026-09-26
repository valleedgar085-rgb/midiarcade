const RESCUE_VERSION = 1;

/**
 * Marks a song as user-rescued: the user has listened and confirmed it
 * sounds good despite quality-gate issues or imperfect scores.
 *
 * Once rescued, the self-correction loop will NOT swap the original for a
 * higher-scoring corrected version, and quality-pipeline repair stages will
 * treat this song's musical character as authoritative.
 *
 * @param {object} song - The song object to rescue
 * @param {object} opts
 * @param {string[]} opts.acceptedIssues - Quality issues the user is accepting
 * @param {string}  opts.reason          - Why rescued (default: "user-approved")
 */
export function createRescuedSong(song, { acceptedIssues = [], reason = "user-approved" } = {}) {
  if (!song || typeof song !== "object") return song;
  const rescue = Object.freeze({
    version: RESCUE_VERSION,
    reason,
    timestamp: Date.now(),
    acceptedIssues: Object.freeze([...acceptedIssues]),
  });
  return Object.freeze({
    ...song,
    meta: Object.freeze({
      ...(song.meta ?? {}),
      userRescue: rescue,
    }),
  });
}

/**
 * Returns true when a song carries a valid rescue record.
 */
export function isSongRescued(song) {
  return song?.meta?.userRescue?.version === RESCUE_VERSION
    && song.meta.userRescue.reason != null;
}

/**
 * Returns the full rescue record, or null if the song is not rescued.
 */
export function getRescueRecord(song) {
  return isSongRescued(song) ? song.meta.userRescue : null;
}

/**
 * Returns the list of quality issues the user has accepted, or [] if none.
 */
export function getRescueIssues(song) {
  return isSongRescued(song) ? [...(song.meta.userRescue.acceptedIssues ?? [])] : [];
}

/**
 * Collects diagnosable issues from a song's score metadata.
 * Used to pre-populate the accepted-issues list when rescuing.
 */
export function collectSongIssues(song) {
  const issues = [];
  const details = song?.meta?.scoreDetails;
  if (!details) return issues;

  const gate = details.releaseGate;
  if (gate && gate.passed === false) {
    for (const [check, passed] of Object.entries(gate.checks ?? {})) {
      if (!passed) issues.push(`release-gate:${check}`);
    }
    for (const failure of gate.failures ?? []) {
      if (!issues.some((i) => i === String(failure))) issues.push(String(failure));
    }
  }

  const lowestDim = details.balance?.lowestCriticalDimension;
  if (lowestDim) issues.push(`low-dimension:${lowestDim}`);

  return issues;
}
