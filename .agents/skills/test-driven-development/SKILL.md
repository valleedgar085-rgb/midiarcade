---
name: test-driven-development
description: Use for MIDI Arcade feature development, refactors, bug fixes and behavior changes; establish a failing test before production edits, make the smallest passing change, then verify the full quality gate.
---

# Test-driven development for MIDI Arcade

This **developer-only** skill adapts [Superpowers: test-driven-development](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md) to the existing Node.js `node --test` suites. It adds no production dependencies and does not change the musical engine by itself. Read root `AGENTS.md` first.

## Trigger and order

Use for a new feature, behavior change, regression fix, or refactor. If resolving a fault, apply `systematic-debugging` first to establish the actual cause. Coordinate branches and independent changes with `midi-safe-integration`.

**RED → GREEN → REFACTOR**, one observable behavior at a time.

1. **Define the contract.** Identify the existing owning module, intended behavior, fixed input/seed/controls, and invariant that must not change. Inspect relevant tests before editing. Avoid creating a second melody, arrangement, or event authority.
2. **RED: add a focused test first.** Use `tests/*.test.mjs` and Node's built-in `node:test` + `node:assert/strict` conventions. Test the real exported function/integration path, not a mock of the assertion. Run the test and confirm it fails for the intended missing behavior, not a syntax/import/setup error. If already green, improve the test or clarify the requirement before proceeding.
3. **GREEN: minimal production edit.** Change only what makes the failing test pass. Preserve deterministic `createRng` authority, preview/export parity, Web Worker ownership, audio baseline, UX contracts, size budgets, and Android zero-permission rule.
4. **REFACTOR only with tests green.** Improve naming, duplication and module boundaries without new behavior; rerun focused tests after each meaningful edit.
5. **Verify broadly.** Run all relevant domain tests and the repo-wide `npm run quality` gate. For musical changes add `npm run quality:music` and fixed-seed before/after evaluation; for Android changes use `npm run test:android-release` and GitHub CI. Treat actual audio listening and device testing as additional evidence, not replaced by tests.

## High-value tests for MIDI Arcade

- Melody/arrangement: hook motif recurrence across chorus returns, phrase boundaries, deliberate vocal-rest windows, candidate winner consistency, genre/key/register invariants.
- Timing/export: same seed+settings yield identical MIDI note times/velocities and preview event signatures; no new `Math.random()` in the engine.
- Audio: sample/event boundary discontinuities, voice cleanup after stop/mute/seek, scheduler recovery without altering approved timbre.
- UI: control persistence, selected tab/track states, accessibility semantics, stable navigation, element/asset budgets.

Choose a **small relevant test** first; do not run every suite as the RED step. Do not weaken existing assertions, snapshot generated output indiscriminately, or replace a failing assertion with a fabricated happy-path fixture.

## Existing behavior and exceptions

For a refactor, use characterization/regression tests before editing, then keep their outputs stable. For exploratory spikes, discard experimental code before starting the tested implementation. Documentation-only/skill-only changes have no production behavior to test; validate their structure, links and diff, then run CI when available without claiming local tests were executed.

## Required handoff

`Behavior | Owning module | RED test & observed failure | Minimal GREEN edit | REFACTOR | Focused tests/exits | npm run quality result | CI + listening/device evidence | Open issues`

The full gate result must be reported even when it fails for an unrelated pre-existing reason.
