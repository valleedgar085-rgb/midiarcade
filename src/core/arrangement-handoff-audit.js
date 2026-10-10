/**
 * Read-only pre-export authority check.
 *
 * The MIDI byte parity gate proves that the encoder agrees with its projection.
 * This gate proves the projection is being prepared from the CURRENT accepted
 * arrangement, rather than a stale Create/Shape snapshot. Export articulation
 * remains clone-only and may intentionally adjust note durations.
 */
function sectionsOf(song) {
  return song?.structure ?? song?.sections ?? [];
}

function sectionIdentity(song) {
  const sections = sectionsOf(song);
  if (!Array.isArray(sections)) return null;
  return sections.map((section) => [
    section?.id ?? null,
    section?.name ?? null,
    section?.bars ?? null,
    section?.startBeat ?? null,
    section?.endBeat ?? null,
    section?.startBar ?? section?.start ?? null,
  ]);
}

function timingIdentity(song) {
  const meta = song?.meta ?? {};
  return [
    meta.tempo ?? null,
    meta.beatsPerBar ?? null,
    meta.totalBeats ?? null,
    meta.bars ?? song?.bars ?? null,
    JSON.stringify(meta.timeSignature ?? null),
  ];
}

function trackIdentity(song) {
  if (!Array.isArray(song?.tracks)) return null;
  return song.tracks.map((track) => String(track?.id ?? ""));
}

function noteIdentity(song) {
  if (!Array.isArray(song?.tracks)) return null;
  return song.tracks.map((track) => [
    String(track?.id ?? ""),
    JSON.stringify(track?.notes ?? []),
  ]);
}

/**
 * Verify a canonical song, the Mix-configured export snapshot, and the
 * articulation-prepared export retain a single accepted arrangement authority.
 *
 * Deliberately does NOT compare the prepared notes to source notes: tightening
 * note lengths, optional quantization and retrigger cleanup are approved
 * non-destructive export transformations. The existing MIDI bytes parity audit
 * verifies those prepared notes against the actual encoded events.
 */
export function auditSelectedArrangementHandoff(canonicalSong, mixSnapshot, preparedSong) {
  const issues = [];
  if (!canonicalSong?.meta || !Array.isArray(canonicalSong?.tracks)
    || !mixSnapshot?.meta || !Array.isArray(mixSnapshot?.tracks)
    || !preparedSong?.meta || !Array.isArray(preparedSong?.tracks)) {
    return Object.freeze({
      passed: false,
      reason: "invalid-song-handoff",
      issues: Object.freeze(["missing-song-state"]),
    });
  }

  const sourceSections = sectionIdentity(canonicalSong);
  const snapshotSections = sectionIdentity(mixSnapshot);
  const preparedSections = sectionIdentity(preparedSong);
  if (!sourceSections || !snapshotSections || !preparedSections
    || JSON.stringify(sourceSections) !== JSON.stringify(snapshotSections)
    || JSON.stringify(sourceSections) !== JSON.stringify(preparedSections)) {
    issues.push("arrangement-section-drift");
  }
  const ids = sourceSections?.map((section) => section[0]) ?? [];
  if (ids.some((id) => id == null || id === "") || new Set(ids).size !== ids.length) {
    issues.push("ambiguous-section-identity");
  }
  const sourceTiming = JSON.stringify(timingIdentity(canonicalSong));
  if (sourceTiming !== JSON.stringify(timingIdentity(mixSnapshot))
    || sourceTiming !== JSON.stringify(timingIdentity(preparedSong))) {
    issues.push("song-timing-drift");
  }
  const sourceTracks = trackIdentity(canonicalSong);
  if (JSON.stringify(sourceTracks) !== JSON.stringify(trackIdentity(mixSnapshot))
    || JSON.stringify(sourceTracks) !== JSON.stringify(trackIdentity(preparedSong))) {
    issues.push("track-order-drift");
  }
  if (sourceTracks.some((id) => !id) || new Set(sourceTracks).size !== sourceTracks.length) {
    issues.push("ambiguous-track-identity");
  }
  // Mix can change program, level, pan, mute, solo, and gate, but MUST NOT
  // silently replace the accepted note content. Shape Accept is the only
  // authority for a musical edit at this boundary.
  if (JSON.stringify(noteIdentity(canonicalSong)) !== JSON.stringify(noteIdentity(mixSnapshot))) {
    issues.push("accepted-note-drift");
  }

  return Object.freeze({
    passed: issues.length === 0,
    reason: issues.length ? "handoff-mismatch" : "accepted-arrangement-preserved",
    issues: Object.freeze(issues),
    sectionCount: ids.length,
    trackCount: sourceTracks.length,
  });
}
