# MIDI-GPT Scoped Bass Experiment

## Status

This is an isolated research spike on `experiment/midi-gpt-scoped-bass`. It does not change the production generator or add a runtime dependency. The current app remains the authority for accepted notes, harmony, groove, register, preview, and MIDI export.

## Target experiment

Regenerate only the bass notes in one selected four-bar chorus span from an existing MIDI Arcade song. Preserve all other tracks and all notes outside that span exactly. Keep the experiment opt-in and label every result as an audition candidate until it passes the normal MIDI Arcade quality checks.

## Why this seam fits

MIDI Arcade's current pipeline already provides:

- a worker boundary for generation requests;
- song/section structure, harmony, Groove Conductor data, and role-based musical events;
- explicit role register policies and tonal-integrity checks;
- a single rendered MIDI pitch authority for downstream playback/export.

MIDI-GPT offers bar-level track infilling plus controls such as key, pitch range, density, polyphony, and note duration in its released model/code. This makes it a useful candidate generator for a narrowly scoped bass edit, but does not make it an authority for MIDI Arcade's genre groove or arrangement.

## Proposed boundary

1. Snapshot the original song and identify bass track ID plus four chorus bars from the existing section map.
2. Build a request from the selected span and its context: tempo, meter, key/scale, chord timeline, section role, groove relationship, bass register window, and unaffected tracks as context.
3. Call MIDI-GPT in an optional research service/CLI adapter. Do not call it from the Android UI thread or make it required for normal generation.
4. Reject malformed responses, unexpected track/bar changes, missing notes, or changes outside the requested bass span.
5. Convert returned notes through MIDI Arcade's canonical pitch/time representation. Do not remap pitches separately for preview and export.
6. Run existing tonal, register, groove/ensemble, and candidate quality checks. Accept only when checks pass and the user selects the audition.
7. Compare preview events and parsed Standard MIDI export events for exact pitch, onset, duration, track, and tempo parity.

## Experiment matrix

Use the same 4-bar chorus source and a fixed set of request seeds across:

- current MIDI Arcade bass (baseline);
- MIDI-GPT infill with the original groove/harmony context;
- MIDI-GPT infill with the same controls but no groove context (ablation).

Record per candidate:

- changed notes inside the target region and untouched-note differences outside it;
- scale violations and bass register distribution;
- kick/bass onset relationship and repeated kick-copy rate;
- note density, polyphony, durations, and silence/rest distribution;
- deterministic repeatability for the exact request, model/checkpoint, and runtime;
- preview-to-export event parity;
- blinded producer rating for pocket, section fit, and musical usefulness.

## Pass/fail gates

- No edits to non-bass tracks or bass notes outside the selected bars.
- Zero malformed/out-of-range MIDI pitches and zero prohibited scale notes after candidate validation.
- Candidate stays inside the existing bass register policy.
- Exact repeatability is required before calling this a deterministic mode; verify seed handling against the pinned upstream inference version rather than assuming it.
- Preview and exported MIDI have identical accepted event data after canonicalization.
- Run against multiple fixed songs/seeds and compare with the existing generator. A higher automated score alone is not a quality win; blinded listening must not show worse pocket or section fit.

## Integration decision

Only after the spike passes should we add a disabled-by-default model adapter behind the generation service boundary. A production Android app must not depend on a developer's local Python server. The later integration needs an explicit deployment/availability plan, model licensing review, latency budget, failure fallback, and authentication/network policy. Until then, the primary useful deliverable is evidence about whether this candidate composer improves scoped edits.

## References

- MIDI-GPT AAAI 2025 paper: https://ojs.aaai.org/index.php/AAAI/article/view/32138
- Released implementation and inference API: https://github.com/Metacreation-Lab/MIDI-GPT
