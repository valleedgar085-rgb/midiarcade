# MIDI Arcade — Melody Hook Rescue shadow audition

**Purpose:** Test whether MIDI Arcade's already-present, opt-in chorus-hook pitch/rhythm candidates can repair weak recurring hooks **without changing the default generator**. The hook recurrence score is only a development diagnostic, not a listener preference score.

## Why

In the previous all-genre 42-song read-only census, 12 of 30 evaluable songs had hook recurrence scores below 66. The existing `createChorusHookDevelopmentCandidates` and `createChorusHookRhythmCandidates` are intentionally restricted to pop, hipHop, and rap and must not rewrite the chosen song without an explicit owner.

This phase checks all 21 genres × 2 fixed 32-bar seeds, plus three historical rap seeds whose recurrence outcomes varied. It reports which weak cases are **unsupported**, **not safely repairable**, or have potentially useful one-note candidates. A single chorus or sparse/unsupported form is unknown, not a failed hook.

## Workflow

```sh
node --test tests/hook-rescue-shadow.test.mjs tests/chorus-hook-development.test.mjs tests/chorus-hook-rhythm.test.mjs
node scripts/benchmark-hook-rescue-shadow.mjs --seeds 2 --bars 32 --out /tmp/hook-shadow
npm run quality
npm run quality:music
```

For each weak evaluable supported song, the script reads existing candidates and examines all available pitches and rhythms (max three each). It requires exactly **one melody note** to change; non-melody tracks, note counts, velocities, durations, and section authority are preserved. A rhythm edit cannot exceed 3/8 beat. It uses the **existing critic**, **existing release gate**, **scale-fit check** and checks all exported MIDI note events. Only fully qualifying proposals can generate blind MIDI cases.

It never enables a song-generation refinement or introduces a new note-writer. The script is development-only, and `main` song generation output remains unchanged.

## Artifacts and blind protocol

The workflow uploads:

- `midi-arcade-hook-rescue-shadow-cases`: full per-seed `report.json`, instructions and any `hook-NN-A.mid` / `hook-NN-B.mid` pairs. No guarantee any pairing qualifies; zero is valid evidence.
- `midi-arcade-hook-rescue-answer-key-OPEN-LAST`: hidden mapping between control and proposed melody.

Audition both files with exactly the same instruments, gain and tempo in FL Studio; choose A, B or tie **before** opening the key. Focus on whether the chorus melody remains recognizable without becoming a repetitive or awkward contour, whether the second hook has a purpose, and whether the verse leaves space for a vocalist. Do not promote the winning candidate automatically until controlled listening **and real Android preview/export parity tests** agree.

## Limitations

- Read-only metrics do not measure true catchiness.
- Strong vs weak under the critic is not a release-contract failure.
- MIDI audition in FL Studio does not verify synthesized mobile playback or loudness.
- A sparse verse should not be filled just to improve numeric score.
- The existing helpers support only pop/hipHop/rap; unsupported weak cases are a **roadmap signal**, not a request to copy a hip-hop repair algorithm into every genre.
- Any candidate with altered exported notes outside exactly one melody event is rejected as unsafe.

## Skill decisions

- `.agents/skills/midi-composition-review/SKILL.md`: separate motive identity, hook rhythm, verse negative space, musical intent, and listening.
- `.agents/skills/midi-safe-integration/SKILL.md`: narrow implementation branch, deterministic seed matrix, candidate ownership, strict CI, no premature merge.
- Upstream `mc-melody` and `mc-development`: musical questions to ask while reviewing hook recurrence, not imported runtime code.
- Parallel reads of independent music critic, safe integration, and test authority were performed; no dedicated parallel coding agent was invoked.
