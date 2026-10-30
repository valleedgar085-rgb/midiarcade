# Generation request matrix and preview/MIDI contracts

## Scope and baseline

Base: `25c59754634179a9c8a491cf12fec5283ee72b3a` (`main`, MIDI Arcade 1.2.4).
The remote branch inventory and recent related authority/parity work were reviewed
before this change. This is a narrow extension of the existing canonical song,
performed-note resolver, generation executor and verified MIDI exporter. It does
not merge the separate Instrument Intelligence draft, change the three-candidate
arrangement system, install MIDI-GPT, add a second generator/critic, or alter
normal generated notes, approved synthesis patches, UI or Android permissions.

## Running it

```bash
npm run test:requests
npm run audit:requests -- --profile smoke
npm run audit:requests -- --profile pairwise
```

The smoke profile has six requests covering all five application request kinds.
The deterministic pairwise profile currently has 105 requests: all 21 genres
crossed with New, Similar, song variations, composition candidates and section
variations. It also covers every pair of levels from these factors:

- 8/16 bars; 4/4, 5/8, 7/8 and 9/8.
- Quick/deep; one/three requested composition candidates; two fixed seeds.
- Existing Auto/default versus explicit manual engine controls.

This is pairwise coverage, **not** the exhaustive Cartesian product. The separate
Instrument Intelligence UI draft is not implicitly covered by these engine
fixtures. Candidate search/critic selection remains owned by the existing engine.

Each request runs twice through the actual `src/generation-worker.js` in a Node
worker thread and once through the app fallback/executor. A transport shim only
bridges `self` to `parentPort`; it does not substitute the generation functions.
Unexpected worker failure/fallback, changed caller/source data, nondeterminism,
scope escape, incomplete accepted option sets or MIDI corruption fail the run.

Each returned song gets six export checks: full and selected-Melody exports in
performance and tight timing, plus muted and soloed live-Mix routing. Repeated
serialization must be byte-identical. Export preparation must not mutate the
accepted song. Scoped candidates preserve canonical authorities, untargeted
tracks and boundary-crossing/outside notes; section options preserve locked
tracks and outside-section material.

### Explicit refusal is not music generation

The real Trap fixture (`matrix-a`, 8 bars, 4/4, default controls) produces an
unsafe section option set. Its existing release gate refuses the request. The
matrix verifies the same exact refusal in both real-worker attempts and fallback,
then checks that the underlying options actually contain a release failure.
It records `outcome: refused`, zero returned songs and `midiParity: null`.
No unsafe option is exported. All other exceptions still fail the matrix.

This acknowledges the existing executor behavior: an error reply retires the
worker and tries fallback. A fresh worker is used to repeat a refused request;
otherwise the repeat could test only worker-backoff behavior. Production retry,
release and candidate-acceptance policies are unchanged.

## Reproducible reports and replay

Results are written to ignored `artifacts/request-matrix/`. `report.json` records
the package/engine version, sampler version, git revision, actual source-tree
SHA-256, Node version, exact request factors and a SHA-256 event hash for each
returned song. Event hashes retain sub-tick timing, note multiplicity, performed
values, track settings/programs, automation, meter, sections and harmony. They
exclude wall-clock diagnostics, titles and overall critic scores.

A failure creates a `.replay.json` containing its exact request and source song:

```bash
npm run audit:requests -- --replay artifacts/request-matrix/CASE.replay.json
npm run audit:requests -- --profile pairwise --case pairwise-92-sectionVariations-trap
```

Replay files are exact reproductions, not automatically minimized/shrunk inputs.
Versions and hashes currently live in the developer report; this change does not
retrofit generation receipts into saved user projects. Keep the original source
revision and source hash when sharing a failure: seeds alone cannot guarantee
cross-version identical results.

## Stronger export parity gate

The existing note-event gate already covered pitch, channel, velocity, on/off
ticks, counts and named tracks. It now also verifies:

- Conductor tempo, encoded meter and key signature, with no competing metadata
  on instrument tracks.
- Ordered section marker text/ticks, instrument program/channel and a single
  final end-of-track event at the authorized song boundary for every track.
- Track-bounded parsing: a truncated meta/channel payload cannot borrow bytes
  from the following chunk.

Deliberately corrupted tempo, meter, key, program, marker and ending fixtures
must fail even if all musical notes remain intact. The gate still validates
against the **prepared export clone**: tight quantization, approved safe note
lengths, retrigger cleanup and sustain normalization are authorized export
transformations, not hidden edits to the accepted song.

Two concrete export edge cases are fixed: an already-committed 13/16 score no
longer gets relabeled 12/16, and legacy odd-meter marker labels without
`beatsPerBar` use quarter-note beat units correctly. Generation's existing
2–12 numerator range is unchanged; this does **not** add 13/16 generation support.

## Preview and pitch-only adapter oracles

The browser-app smoke test passes **actual** `buildPreviewEvents` output for Pop,
Hip-Hop, Jazz and Ambient into a read-only event oracle. It checks pitch, start,
base MIDI velocity, program, note length and multiplicity against the export
projection with one-tick rounding tolerance. Injected pitch/timing/duration/
velocity/program/count defects must fail.

CC11 expression gain is not a new MIDI velocity. The existing 30 ms minimum
preview envelope and MIDI song-end clamp are explicit, counted playback policies.
Synth release tails, timbre, reverb and perceived loudness are not established by
this event-level test. This is not an audio waveform comparison or a phone
listening test, and does not verify every exported controller/pitch-bend event.

`assertPitchOnlyEditContract` is a developer assertion for a future model adapter:
only pitch representations inside the selected fully-contained notes may change.
Onsets, durations, velocities, note count/order, metadata, structural authorities,
other tracks and outside/boundary notes remain fixed. The assertion does not
replace tonal/register validation or grant a candidate acceptance. No pitch-only
MIDI-GPT integration is enabled by this change.

## CI and evidence

`npm run quality` includes the new tests. The dedicated request-contract workflow
runs the smoke audit on relevant pull requests, supports a manual full pairwise
run, and retains reports/replays as artifacts. It creates no scheduled task,
downloads no models, and does not publish or merge a release.

Local all-genre result: **105/105 contract cases**, 104 music-returning requests,
one explicitly safe refusal, 186 returned song/candidate options and **1,116
verified exports**. These are mechanical integrity checks, not proof of better
melodies or a higher listening preference.

Handoff: request/preview/export integrity | base SHA above | one integration
branch | core parity gate, exporter metadata, developer scripts/tests/workflow |
determinism, scope, performed values, source immutability and verified SMF |
full quality/music/Android contract gates plus request matrix | physical-device
listening and APK release remain separate | review and CI before merge.
