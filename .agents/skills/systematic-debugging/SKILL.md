---
name: systematic-debugging
description: Use on MIDI Arcade for bugs, failing tests, CI or APK build errors, preview audio defects, performance issues, and unexpected behavior; identify and prove the root cause before editing production code.
---

# Systematic debugging for MIDI Arcade

This is a **developer-only** skill, adapted from [Superpowers: systematic-debugging](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md). It does not run in the APK. Read root `AGENTS.md` first. For Web Audio symptoms also read `midi-audio-diagnostics`; for integration and PR work read `midi-safe-integration`.

## Trigger and nonnegotiable rule

Use on any bug, failed test, build-quality failure, unexpected UI state, audio click/pop, melody/export mismatch, Android regression, or performance problem.

**Do not apply a speculative fix before investigating the cause.** Never weaken tests, increase budgets or timeouts, swallow errors, or retune approved sound merely to make a symptom disappear.

## Procedure

1. **Pin the baseline.** Record failing branch/commit, previous working SHA (if known), OS/browser or Android device, relevant seed/genre/key/controls/section, error log, and exact reproduction. If not reproducible, collect evidence instead of guessing.
2. **Read the entire failure.** Identify the first meaningful error and failing layer. Trace from workflow → npm scripts → `scripts/build.js` → `scripts/check-build-quality.js`, or from UI/worker → generation authority → preview scheduling/MIDI export, as relevant. Inspect recent diffs.
3. **Compare working and failing paths.** Find an adjacent working example in the current codebase; identify what changed. Instrument boundaries only when needed and remove temporary logging afterwards. For a build-size failure, identify the actual generated output and its upstream source instead of raising its byte budget.
4. **State one falsifiable root-cause hypothesis.** Explain the observed evidence and the simplest experiment that will disprove it. Test one variable at a time. If disproved, return to evidence collection; do not stack speculative fixes.
5. **Write a regression before the fix.** Switch to `test-driven-development` to create and run a focused failing test, unless the failure cannot be automated (document why). Implement the smallest correction in the owning production module only.
6. **Verify in widening circles.** Re-run the regression, related tests and `npm run quality`. For music generation run `npm run quality:music`; for Android changes run `npm run test:android-release` and CI. For audible output, compare matching seeds/levels and validate on an Android device before claiming a listening improvement.

## Guardrails specific to this repository

- Preserve seeded deterministic results, existing three-candidate selection, single event authority, key/register contracts, and preview-to-MIDI parity.
- Preserve the approved audio baseline; do not use blanket headroom or global fade changes to conceal clicks.
- Preserve the UI/build budgets and zero-permission Android architecture specified in `AGENTS.md`.
- When three independent fix attempts fail, stop and review whether the architecture or diagnostic model is wrong; do not try a fourth patch blindly.
- A passing APK build alone is not a passing quality gate.

## Report format

`Symptom | SHA and reproduction | Evidence/first failing layer | Hypothesis and test | Root cause | Minimal change | Focused test + exit | npm run quality + exit | CI/device checks | Remaining uncertainty`

Never invent test executions or report a command as passing if it was not run.
