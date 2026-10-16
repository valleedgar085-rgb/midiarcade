# MIDI Arcade: developer-only AI skill workflow

**Purpose:** Improve how the AI *builds* MIDI Arcade; no added Android features, runtime dependencies, models, network calls, or background jobs.

## Installed in this repository

Coding agents supporting project skills in `.agents/skills/` can use:

| Situation | Project skill | External reference |
| --- | --- | --- |
| Random or unmemorable melodies, weak chorus returns, bass/drum clashes, poor section contrast | `midi-composition-review` | [music-composition-skills](https://github.com/jtydhr88/music-composition-skills), specifically `mc-melody`, `mc-development`, `mc-rhythm-section` and `mc-arrangement-arch` |
| Heavy/bouncy basslines, 808s, kick-and-bass timing, groovy bass movement, dance pocket, low-end clarity | `midi-bass-groove-director` | [mc-rhythm-section](https://github.com/jtydhr88/music-composition-skills/blob/main/plugins/music-composition/skills/mc-rhythm-section/SKILL.md) and [mc-style-hiphop](https://github.com/jtydhr88/music-composition-skills/blob/main/plugins/music-composition/skills/mc-style-hiphop/SKILL.md) |
| Clicks, pops, crackle, silence, output distortion, Web Audio timing issues | `midi-audio-diagnostics` | [Sonic Skills](https://github.com/kunitoki/sonic-skills) and [Audio Verification](https://github.com/AkshitIreddy/agent-skills/tree/main/skills/audio-verification) |
| Bugfixes, new development branches, subagent work, regression fixes, PRs/releases | `midi-safe-integration` | [Superpowers](https://github.com/obra/superpowers) |

The project skill files contain self-contained instructions, so they remain useful if the upstream repository is unavailable. They are **adaptations**, not full vendored copies or claims that upstream plugins were globally installed. Review upstream original docs before applying unfamiliar rules or updating these adapters.

Codex discovers the canonical `.agents/skills/` manifests. Claude Code uses the matching project entry points under `.claude/skills/` and `CLAUDE.md`, which direct it to the same canonical project skills. If an agent does not auto-discover either location, direct it to read the named `SKILL.md` and root `AGENTS.md`. This branch does **not** install third-party skills globally into a developer's home directory.

## Bass Head Groove Director: baseline and practice

When bass is the focus, route to the canonical .agents/skills/midi-bass-groove-director/SKILL.md **in addition to** midi-composition-review and midi-safe-integration. The workflow covers kick/bass interlock, danceable offbeats, 808/sub articulation, melodic register, genre-appropriate push/pull, low-end masking and controlled A/B listening.

The desired feel is deep, precisely timed, and jumpy/groovy enough to invite dancing. Start by measuring actual kick and bass note onsets; do **not** automatically increase bass velocity, note density, gain, sub EQ or compressor strength.

A useful first follow-up is a read-only, fixed-seed bass-versus-kick onset/pocket census covering trap, hip-hop, neo-soul, funk, Afrobeats and house, with explicit timing pairs, note length and rests; later make only evidence-based opt-in repairs inside existing groove-pocket or bass-continuity authority. Keep the approved playback patches unchanged.

## First assignment: melody + vocal pocket audit (read-only)

Goal: find exactly where the generated melodic hook loses identity or crowds rap space, without touching production note events or the approved Web Audio baseline.

1. Pin existing `main` SHA and fixed genre/seed/knob/bar fixtures, including hip-hop, trap and pop.
2. Read `docs/phase4-hook-research-and-baseline.md` and existing test/critic code. Reuse `src/core/chorus-hook-recurrence.js` and other established read-only authorities.
3. Observe two-bar chorus opening fingerprint (rhythm, contour, durations, repetition vs clone), late chorus return, melody phrase length/ending, verse rest windows, and drum/bass pocket. Classify low confidence or insufficient evidence explicitly.
4. Compare candidate outputs and fixed seeds. Distinguish an intentional rap-vocal gap from a broken melody. Provide a short listening A/B plan with matched loudness.
5. Propose exactly one narrow improvement inside the existing authority only after evidence supports it. Require an independent review and `midi-safe-integration` for any subsequent engine edit.

**Do not:** invent scores, replace the three-candidate arrangement system, introduce a second generator, blindly enforce generic music-theory rules, add model downloads to the app, or modify the audio engine while doing the musical audit.

## Baseline commands

From repo root (Node 22+ with dependencies installed):

```bash
node --test tests/chorus-hook-recurrence.test.mjs tests/melody-section-memory.test.mjs tests/arrangement-candidate-search.test.mjs tests/midi-export-parity.test.mjs
npm run quality
npm run quality:music
```

For sound complaints:

```bash
node --test tests/atmosphere-pad-click-regression.test.mjs tests/pitched-preview-click-regression.test.mjs tests/preview-audio-transition.test.mjs tests/phase7-audio-runtime.test.mjs tests/playback-recovery.test.mjs
npm run quality
npm run test:android-release
```

Don't treat a new test or a static document as proof that music sounds better. Full CI and physical-device listening are separate requirements for applicable output changes.

## Evidence required in each PR

Record base and head commit; category and fixed seeds; before/after observations; changed authoritative module(s); focused tests (commands + exact outcomes); `npm run quality` result; quality:music output for musical changes; APK job and artifact only when relevant; actual listening evidence; and any blockers. Link the GitHub Actions jobs rather than asserting all CI passed because one job succeeded.

## Sources and maintenance

- Composition source: https://github.com/jtydhr88/music-composition-skills
- Audio source: https://github.com/kunitoki/sonic-skills
- Offline audio validation: https://github.com/AkshitIreddy/agent-skills/tree/main/skills/audio-verification
- Development discipline: https://github.com/obra/superpowers
- Current project policies: [../AGENTS.md](../AGENTS.md)

These are **read-only research references** and not submodules or fetched code executed by a build. Verify compatibility, licensing and upstream revisions before vendoring third-party material in the future.
