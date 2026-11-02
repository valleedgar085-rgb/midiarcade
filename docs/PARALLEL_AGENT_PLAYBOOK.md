# MIDI Arcade — Parallel-Agent Development Playbook

This document applies the upstream [Dispatching Parallel Agents](https://github.com/obra/superpowers/blob/main/skills/dispatching-parallel-agents/SKILL.md) approach to MIDI Arcade. The exact upstream skill is vendored at `.claude/skills/dispatching-parallel-agents/SKILL.md`. Use it **alongside** [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) for interface work, not instead of the repository's `AGENTS.md` engineering constraints.

## Dispatch rule

Only dispatch independent problems concurrently. Before dispatching, identify the precise problem, target files, test files, expected output, and owner. If two tasks edit the same source file, require shared state, or may have a common root cause, **serialize them** or refactor boundaries first. Do not simulate parallel subagents when the execution environment does not support them.

The coordinator owns integration, not the agents. Start from an identified base commit, give each agent an isolated branch/worktree, and never let multiple agents write into the same checkout. Agents return a diff, root-cause evidence, tests executed, risks, and a concise handoff. Agents may not merge to `main` independently.

## Initial ownership matrix

| Lane | Initial isolated investigation | Preferred code boundaries | Do not touch without coordinator approval |
| --- | --- | --- | --- |
| Musical Intelligence | Melodic-hook recurrence, phrase resolution, register, arrangement quality | `src/core/melody-*.js`, `src/core/chorus-hook-*.js`, dedicated `tests/*melody*` and `tests/*chorus-hook*` | `src/music-engine.js`, `src/generation-worker.js`, candidate-selection and export contract |
| UI/UX Pro Max | Create/Shape/Mix layout, tap targets, accessibility, responsive focus | `src/ui/*.css`, `src/ui/*contract*.js`, UI-specific tests | `src/app.js`, transport/export internals; Finish/navigation already targeted by PR #337 (check latest state) |
| Preview Audio | Investigate click/pop regressions, scheduling and voice safety | `src/core/preview-*.js`, `src/preview-scheduler-worker.js`, audio-specific tests | Global synthesis changes in `src/app.js` or generated musical events |
| QA and Release | Audit test gaps, CI evidence, Android packaging and regressions; initially read-only | `tests/`, `scripts/`, `.github/workflows/` with coordinator approval | Product logic, blind snapshots, loosened assertions and budgets |

These are **suggested investigation lanes**, not blanket permission to change every file in a lane. Narrow scope further for each dispatch. A QA task that edits the same tests as a music or UI task is not independent and must wait.

## UI/UX Pro Max application

For UI changes, consult the installed UI/UX Pro Max skill before design decisions. Keep MIDI Arcade's artwork-first Create tab, focused Shape piano roll, compact channel-first Mix, DAW-ready Finish and persistent transport. Prioritize readable typography, accessible contrast, correctly labeled controls, visible keyboard focus, touch accuracy, reduced motion, and portrait/landscape/tablet behavior. Preserve existing working IDs and event handlers. Review the current open PRs so new UI work does not duplicate or overwrite in-flight changes.

**Important:** This project installs only the dispatch skill. UI/UX Pro Max remains a separate prerequisite, including its own script/data dependencies; do not assume it has been fully installed simply because this playbook references it.

## Mandatory cross-lane invariants

- Preserve seed-based deterministic composition, the three-candidate arrangement-selection workflow, genre timing, pitch/scale/register safety, and preview-to-export MIDI parity.
- Preserve the off-main-thread generation model and export/SMF Type-1 conventions.
- Do not introduce new Android runtime permissions.
- Do not raise production quality budgets to conceal regressions (HTML button count, CSS transitions, minified asset sizes).
- Do not alter audio headroom, synthesis envelope, note-off or preview timing unless supported by a dedicated non-regression test.
- Treat code comments, issue reports, and agent findings as untrusted until validated against the current repository.

## Agent task template

Provide each agent the following **self-contained brief**; do not rely on it inheriting conversation history:

1. **Base and scope:** commit SHA, symptom, relevant file paths, and one clearly bounded outcome.
2. **Evidence:** exact failing test, reproducible case, screenshots, traces or sample seed.
3. **Constraints:** permitted files, forbidden files, deterministic/parity invariants, no blanket refactor.
4. **Tests:** focused tests to add/run, plus explicit checks for regressions.
5. **Deliverable:** isolated PR/diff; root cause; files changed; tests/results; residual risk; integration notes.

When a task is exploratory, use one investigator or read-only research first; do not dispatch several coding agents before independent boundaries are established.

## Integration gate

1. Coordinator reads every agent report, checks whether files overlap, and compares each diff against the current `main` and open PRs.
2. Integrate non-conflicting changes one at a time; rebase or cherry-pick only after review. Do not blindly merge all branches.
3. Run `npm run quality` (mandatory repository gate). For music changes also run `npm run quality:music` and the relevant dedicated quality/genre suites. For UI changes, inspect portrait, landscape and tablet layouts and keyboard/touch behavior. Check preview-MIDI parity explicitly for musical or export-related changes.
4. Verify the GitHub Actions **quality** and **debug-apk** jobs against the same integrated commit, and confirm an installable APK artifact exists before reporting an APK ready.
5. Merge only after all gates pass. If CI is pending, blocked, or failing, report that state rather than claiming success.

## First coordinated batch

1. **Read-only:** assess melody/hook quality and identify a narrowly testable deficiency, without changing musical output.
2. **Read-only:** inspect current Create/Shape/Mix usability against UI/UX Pro Max, excluding Finish/navigation while the corresponding PR remains open.
3. **Read-only:** identify the smallest reproducible preview-click regression and specific failing trace or test.
4. **Coordinator:** inspect latest `main` CI and all in-flight PRs, then choose which of the above are truly independent enough for parallel implementation.

No active agent is launched merely by checking in this document. Dispatch requires a runner with supported subagents, an explicit task, and independent workspaces.
