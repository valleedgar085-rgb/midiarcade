---
name: midi-safe-integration
description: Coordinate parallel development, test-driven changes, integration reviews and release verification for MIDI Arcade without breaking the existing generator, Web Audio baseline or Android builds.
---

# MIDI Arcade safe integration

This skill governs development process, **not application functionality**. The root `AGENTS.md` is authoritative. Reference [Superpowers systematic-debugging](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md), [test-driven-development](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md), [dispatching-parallel-agents](https://github.com/obra/superpowers/blob/main/skills/dispatching-parallel-agents/SKILL.md), [using-git-worktrees](https://github.com/obra/superpowers/blob/main/skills/using-git-worktrees/SKILL.md) and [verification-before-completion](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md).

## Contract

1. Start from the latest stable `main` commit; state SHA and scope. Prefer a narrow feature branch and, when locally available, isolated git worktrees. Never force push, auto-merge, or rewrite unrelated changes.
2. Divide independent work by **owned file domains**, not by arbitrary task count. Composition analyst reads current music authority, Web Audio analyst reads preview paths, test specialist designs fixtures, integrator owns cross-cutting contracts. Parallel reviews are safe; parallel edits to the same file are not.
3. Before code changes write a failing test for a reproducible defect (when possible), confirm the failure, implement minimal targeted change and confirm the passing test. Do not suppress errors, weaken checks, inflate budgets, or invent a happy-path test that never reproduces the defect.
4. Preserve existing musical candidate selection, note-event authority, deterministic RNG, tonal/register constraints, preview-to-MIDI parity, and approved synthesis behavior. Only one owner may make a production event decision.
5. Integrate in a single branch after independent work is reviewed. Audit touched files and branch diff for conflicts, UI regression, changed timing and unintended dependencies.
6. Run `npm run quality` from the repo root, then domain-specific tests, then GitHub CI on a PR. For music changes also run `npm run quality:music`. For Android behavior check `npm run test:android-release` and build APK only when warranted.
7. Report factual outcomes (command, environment, exit code, run URL). A successful debug APK job does **not** mean the separate quality job passed. An APK existing does not prove musical quality. Do not say "done" or "ready to merge" until all required checks are verified.

## No-code-change exception

When adding only developer documentation and skills, do not change application files or force a new APK. Verify skill metadata, links, repository diff and run available CI, identifying any pre-existing failures. Do not claim `npm run quality` was run if the repo could not be checked out. Leave PR unmerged if required checks are not passing.

## Review handoff template

`Task | Base SHA | Owning agent/paths | Files changed | Invariants checked | Tests executed + exit status | Known pre-existing failures | Next reviewer/merge decision`.
