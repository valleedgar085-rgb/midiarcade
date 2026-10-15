# Section Support Dynamics — opt-in arrangement audition

## Purpose

This is the **first optional composition change after the all-genre census**, not a new generator or second quality authority. It extends the existing `applyArrangementPerformance` pass invoked only by `createArrangementCandidates` when `arrangementEvolution` is enabled.

When a verse or idea is followed immediately by a chorus/drop/theme, eligible supporting **chord and pad** notes in the first half of the verse are gently reduced in velocity (up to seven MIDI velocity units); eligible notes in the first half of the payoff get a lift (up to five units). The kick/bass, melody, counterpoint and the approved synthesis patches are not modified by this new option.

The staging skips protected anchors, existing transition handoff notes, explicitly resting/foreground scene roles, short sections, and fusion songs. Each target lane edits at most two pre-existing notes per section. It never adds/removes MIDI notes or changes pitch, beat onset, duration, arrangement order, program, channel, or bass/drum pocket. No random draws are introduced.

## Activation

**Default remains off.** Call the existing arrangement audition with `sectionContrastDynamics: true` in its generation config to enable the bounded staging on eligible candidates. It does not bypass the existing three-candidate ceiling, producer intent, musical critic, release gate or other stage-mutation authority. A candidate can be rejected normally.

This is not a new user knob or global sound change yet. It is an explicit opt-in development experiment until fixed-seed quality checks and device listening support enabling it more broadly.

```js
const candidates = createArrangementCandidates(song, {
  genre: "hipHop",
  seed: "a-fixed-seed",
  bars: 32,
  arrangementEvolution: true,
  sectionContrastDynamics: true,
});
```

## Verification

```sh
node --test tests/section-contrast-performance.test.mjs tests/arrangement-performance.test.mjs tests/arrangement-candidate-search.test.mjs tests/midi-export-parity.test.mjs
npm run quality
npm run quality:music
```

Inspect returned candidate `performance.sectionContrastNotes` and `performance.sectionContrastSections`, and compare baseline/candidate note event fields. If there is no eligible moment, the proper result is no additional dynamics.

This is a velocity-only MIDI event change on the selected candidate, so it must be heard and compared on both actual Android preview and exported MIDI before promoting the option as an app default. Numeric section-activity scores are descriptive; they are **not** adequate evidence of better music.

## Design inputs

- `docs/musical-weakness-findings-20261014.md`
- `docs/section-activity-contrast.md`
- Existing `src/core/arrangement-performance.js`, `src/core/arrangement-candidates.js`
- Developer skills: `.agents/skills/midi-composition-review/SKILL.md`, `.agents/skills/midi-safe-integration/SKILL.md`
- Upstream arrangement principles: https://github.com/jtydhr88/music-composition-skills/blob/main/plugins/music-composition/skills/mc-arrangement-arch/SKILL.md
