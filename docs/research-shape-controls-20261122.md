# Research-informed Shape controls

Base: `f0a993613d9f7c72f47aad432f09cda2c146560d` (merged main). Branch: `feat/research-informed-shape-controls-20261122`.

This applies bounded experiments from the November 6, 13 and 20 research briefs. It does not install an external model, retune the approved sound, replace the generator, or merge the separate piano-roll/TasteForge/Instrument Intelligence branches.

## What to try

Open **Shape**, select a part, then **See all changes**. Compare **Original / Preview** and choose **Use This Change** or **Keep Original**.

| Control | Changes | Preserves |
| --- | --- | --- |
| Shift Hats | Existing GM hat notes 42/44/46 rotate one sixteenth later within their bar. Strength does not change the rotation. | Hit count, cyclic gaps, microtiming, pitches, velocity, kick/snare, bass and other parts. Protected/partial unsafe cycles are refused. |
| Shape Hat Accents | Existing hat velocities receive a bounded offbeat emphasis (8/12/16 maximum velocity points for Small/Medium/Large). | Note timing, duration, pitch, hit count and the rest of the band. Rhythm locks remain supported. |
| Recall the Hook | The existing hook-development owner may change one pitch in a weak returning chorus. | First chorus, arrangement, harmony, rhythm, rests, velocity, other instruments and protected motif notes. Currently calibrated for Pop/Hip-Hop/Rap, not every genre. |
| Resolve the Ending | The existing cadence owner may change one final melody pitch to a nearby in-scale chord tone inside the preferred melody register. | Onsets, durations, velocity, rests, other sections/instruments, pitch locks and protected anchors. Requires active harmony and authoritative scale metadata. |

Whole-section scope still changes only the relevant lane for these four controls. Selected-note scope never widens automatically. Hook recall requires section or melody-track scope. No safe opportunity means a refusal, not a density fallback or a claimed improvement. Melody choices are intentionally very conservative; manually audition them.

## How the briefs influenced this work

- **November 6 — theme similarity and explicit symbolic reasoning:** expose hook recall without automatically adding notes; measure actual MIDI events, not a reassuring label or quality score. Source: [How Close to the Theme?](https://arxiv.org/abs/2611.01047), revised November 3. This is an experiment inspired by the result, not an implementation of that trained model.
- **November 13 — repeat-edit drift and local harmonic control:** every transaction owns immutable Before/After snapshots. Accept records Shape engine version 2, seed, exact selected note IDs, locks, direction, size and a musical-source fingerprint. The focused cadence option reuses the existing authority and avoids rewriting a whole melody. The fingerprint is diagnostic, not cryptographic; replay requires the same source snapshot and code version. These controls do not offer cross-version bitwise guarantees or a learned latent-steering model.
- **November 20 — independent rhythm lanes and WebView differences:** hats-only timing versus accents lets a listener compare one change against an unchanged band. Sources: [HoRNet developer walkthrough](https://www.hornetplugins.com/introducing-hornet-rhygenerator-mk2/) and [WebView guide](https://caniwebview.com/guide/). No plugin or Android permission was added. Passive diagnostics distinguish Web MIDI API exposure, native input API exposure and actual connections; they never query the optional WebView MIDI permission descriptor.

## Correctness fixes

- Export no longer silently discards an unaccepted Shape preview or exports during an undecided section audition. The user must choose first. Existing byte-level MIDI verification still precedes both Android Share and browser download.
- Shape setters keep finalized `performed` note values synchronized with musical edits, so preview and MIDI cannot silently play stale values.
- Canonical MIDI velocity `1` is treated as a soft attack, not normalized velocity `1.0`/full attack.
- Live MIDI callbacks now consume the manager's real `note-on` / `note-off`, `note` and MIDI velocity contract, including sustain/disconnect releases. Synthesis patches/envelopes are unchanged. Hardware connection and audible playback still need a device test.
- Copied/raw debugger JSON includes separate preview context, input capabilities and export status, even before generation. A failed new export cannot retain an earlier successful parity receipt. `share-completed` / `download-triggered` are not proof of a file being imported or saved by another app.
- New precision requests use the existing worker/dispatch/executor path and app fallback. They cannot run output-quality repair or persist a generation as though an audition had already been accepted. Selection/lock/strength changes invalidate an in-flight preview.

## Verification evidence

- Original baseline: `npm run quality`, exit 0, 1,227 tests.
- Final full gate: `npm run quality`, exit 0, **1,247/1,247 tests**, clean asset build and unchanged budget checks. `npm run android:sync`, exit 0; no generated Android assets are committed.
- Fixed Hip-Hop cohort: `research-precision-0` through `research-precision-9`, 32 bars, candidateCount 1. All 10 produced each hat edit. All 20 candidates replayed identically, preserved the band/structure/harmony/note counts, matched the **real** `buildPreviewEvents` output and passed verified MIDI serialization. This cohort produced **zero** recall/ending candidates; that is recorded as a conservative no-op, not hidden as a success.
- Known real weak-hook fixture: `phase4-hook-audit-rap-32-v2`, E minor, 32 bars, energy .64, complexity .58, variation .62, swing .14, humanize .10. Recall changes one returning chorus pitch; existing recurrence diagnostic changes 52 to 56. Preview/MIDI parity passes. This metric is not proof of catchiness.
- Default generation comparison: one fixed 16-bar seed in **each of 21 genres**, candidateCount 1. Complete serialized-song SHA-256 matches the base commit for all 21. Normal generation is unchanged.
- Request smoke audit: 6/6 contracts, 10 resulting songs and **60 verified export variants**, exit 0. New Shape requests additionally have a real worker-versus-app-fallback replay/persistence test.
- `npm run quality:music`: exit 0, 63 songs, 21 genres, 3 seeds, 16 bars; overall 94, musical 92, technical 100, release 100%. This checks baseline preservation, not a new audible improvement.
- `npm run test:android-release`: exit 0, 35 tests. Composition, parity and audio-regression focused suites: exit 0, 67 tests.
- Build budgets remain unchanged: 94 initial buttons; no new CSS, dependencies, Android permissions or generated Android files.

Full browser UI QA was attempted but Chromium could not start because its local socket creation was denied by the execution environment. Do not treat that as a UI pass. Physical Android listening, USB hot-plug/held-note behavior, and FL Studio Mobile import remain unverified.

## Phone listening checklist

1. Keep an original song you know. In Drums, compare Original / Shift Hats, then Original / Hat Accents. Listen for pocket and open-hat closure without changes to kick, snare or bass.
2. In Melody, try hook recall on a weak returning chorus and resolve an eligible ending. Refusals are expected for already-resolved or protected notes. Prefer the original whenever the change is not musically better.
3. While auditioning Preview, try export: it must ask you to accept or keep original without changing what is playing. Accept, export with Groove timing, and check the same phrase's pitches/onsets/durations/accents in FL Studio Mobile. Tight timing is an explicit different export policy.
4. For Android MIDI/audio testing, connect a keyboard, play/hold/release and use sustain. Change/disconnect the input and audio route while a note is held. Confirm clean release and playback recovery. Copy diagnostic JSON to distinguish input, audio context and file handoff results.

No blind listening panel or physical Android pass has been completed; do not label this a release-ready musical upgrade based on numerical checks alone.
