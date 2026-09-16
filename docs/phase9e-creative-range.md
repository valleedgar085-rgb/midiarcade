# Phase 9E — Creative Range UI

## Goal
Expose the existing deterministic Creative Genome range modes on Create without changing ordinary generation unless the producer explicitly opts in.

## User-facing contract
- **Default · existing behavior** — emits no `creativeRange` request field and preserves the pre-9E composition path.
- **Familiar** — opts into the bounded Familiar Creative Genome envelope.
- **Fresh** — opts into the balanced Fresh envelope.
- **Wild** — opts into the widest currently calibrated Creative Genome envelope.

## Safety
- Invalid or empty UI values normalize to `null` and are omitted from `buildConfig()`.
- Existing fusion fail-closed behavior remains authoritative.
- Candidate counts, critic/release thresholds, scale/MIDI/export contracts, Android playback budgets, and Phase 9D return-development logic are unchanged.
- The selection participates in staged-direction detection, Reset direction, and session preference restore.
- The selector is mounted by the existing Create presentation boundary before runtime wiring, keeping the protected initial HTML budget unchanged.

## Validation target
- Focused Creative Range policy/UI/control-contract tests green.
- Full repository tests green.
- Full `npm run quality` / `npm run quality:music` green on PR head.
- Android asset sync and Preview APK build green before merge.
