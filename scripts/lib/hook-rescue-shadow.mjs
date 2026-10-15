/** Developer-only proof that one proposed hook edit preserves musical authority. */
import assert from "node:assert/strict";

const fields = note => [note?.start, note?.duration, note?.pitch, note?.velocity];
const event = note => [note?.onTick, note?.offTick, note?.pitch, note?.velocity, note?.channel];
const signature = n => JSON.stringify(n);
const sortedEvents = notes => (notes ?? []).map(event).sort((a, b) => signature(a).localeCompare(signature(b)));
const bagDifference = (left, right) => {
  const counts = new Map(right.map(note => [signature(note), 0]));
  for (const item of right) counts.set(signature(item), (counts.get(signature(item)) ?? 0) + 1);
  return left.filter(item => {
    const key = signature(item), remaining = counts.get(key) ?? 0;
    if (remaining <= 0) return true;
    counts.set(key, remaining - 1);
    return false;
  });
};

export function inspectHookMutation(baseline, proposed, kind) {
  assert.ok(["pitch", "rhythm"].includes(kind));
  assert.deepEqual((proposed?.structure ?? []).map(s => [s.id, s.startBeat, s.endBeat]),
    (baseline?.structure ?? []).map(s => [s.id, s.startBeat, s.endBeat]), "section authority changed");
  const leftTracks = baseline?.tracks ?? [], rightTracks = proposed?.tracks ?? [];
  assert.equal(rightTracks.length, leftTracks.length, "track count changed");
  const altered = [];
  for (let t = 0; t < leftTracks.length; t++) {
    const a = leftTracks[t], b = rightTracks[t];
    assert.equal(b.id, a.id, "track order changed");
    assert.equal((b.notes ?? []).length, (a.notes ?? []).length, "note count changed");
    for (let n = 0; n < (a.notes ?? []).length; n++) {
      const before = a.notes[n], after = b.notes[n];
      const changed = fields(before).some((value, f) => value !== fields(after)[f]);
      if (!changed) continue;
      assert.equal(a.id, "melody", "non-melody instrument changed");
      assert.equal(before.duration, after.duration, "note duration changed");
      assert.equal(before.velocity, after.velocity, "note velocity changed");
      if (kind === "pitch") {
        assert.equal(before.start, after.start, "hook pitch proposal altered timing");
        assert.notEqual(before.pitch, after.pitch);
      } else {
        assert.equal(before.pitch, after.pitch, "hook rhythm proposal altered pitch");
        assert.ok(Math.abs(before.start - after.start) <= 0.375001, "rhythm shift too large");
        assert.ok(Math.abs(before.start - after.start) >= 0.089999, "rhythm shift too small");
      }
      altered.push({ trackId: a.id, noteIndex: n, from: fields(before), to: fields(after) });
    }
  }
  assert.equal(altered.length, 1, "hook helper must change precisely one authored note");
  return Object.freeze({ changedNotes: altered.length, change: altered[0] });
}

export function inspectHookExport(baselineVerified, proposedVerified, kind) {
  assert.equal(baselineVerified?.audit?.passed, true, "baseline MIDI parity failed");
  assert.equal(proposedVerified?.audit?.passed, true, "proposed MIDI parity failed");
  const left = baselineVerified.projection?.tracks ?? [];
  const right = proposedVerified.projection?.tracks ?? [];
  assert.equal(right.length, left.length, "export track count changed");
  const changed = [];
  for (let index = 0; index < left.length; index++) {
    const a = left[index], b = right[index];
    assert.equal(a.id, b.id, "export track identity changed");
    const before = sortedEvents(a.notes), after = sortedEvents(b.notes);
    assert.equal(after.length, before.length, "export note count changed");
    if (a.id !== "melody") {
      assert.deepEqual(after, before, "non-melody MIDI export changed");
      continue;
    }
    const removed = bagDifference(before, after), added = bagDifference(after, before);
    assert.equal(removed.length, 1, "expected exactly one edited exported note");
    assert.equal(added.length, 1, "expected exactly one replacement exported note");
    const prior = removed[0], next = added[0];
    assert.equal(prior[3], next[3], "export velocity changed");
    assert.equal(prior[4], next[4], "export channel changed");
    if (kind === "pitch") {
      assert.equal(prior[0], next[0], "export note onset changed");
      assert.equal(prior[1], next[1], "export note release changed");
      assert.notEqual(prior[2], next[2], "candidate pitch lost at export");
    } else {
      assert.equal(prior[2], next[2], "export pitch changed");
      assert.equal(prior[1] - prior[0], next[1] - next[0], "export note duration changed");
      assert.notEqual(prior[0], next[0], "candidate rhythm lost at export");
    }
    changed.push({ from: prior, to: next });
  }
  assert.equal(changed.length, 1, "expected exactly one MIDI melody event change");
  return Object.freeze({ changedEvents: changed.length, change: changed[0] });
}

/** Stable blind layout; NEVER used in music generation. */
export function blindVariant(seed) {
  let value = 2166136261;
  for (const ch of String(seed)) value = Math.imul(value ^ ch.charCodeAt(0), 16777619) >>> 0;
  return (value & 1) ? "A" : "B";
}
