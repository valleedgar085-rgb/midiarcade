# Bass Head Phase 5 — true kick-relative response vs anticipation (shadow)

Baseline: MIDI Arcade `main` commit `c5844d6310ab96c4d0d10dd6a916b656477cc9f0`. User auditioned eight previous blind examples across two rounds; original versions won four, experimental versions won four. A general offbeat-shift policy is **not supported** by those choices. Previous [Phase 4 kick-context investigation](https://github.com/valleedgar085-rgb/midiarcade/pull/373) found three newly created *anticipations* and zero newly created true post-kick responses in the so-called "answer" candidate. This phase separates them.

## Musically intentional alternatives

The **developer-only** `scripts/lib/bass-head-true-kick-candidates.mjs` proposes up to two role-constrained versions of an existing generated song:

- **True post-kick response:** an unprotected bass note may shift at most 0.25 beats toward **an actual GM kick onset + 0.25 beats**, and only if the existing classifier confirms that the resulting bass attack follows the kick.
- **True pre-kick anticipation:** an unprotected bass note may shift at most 0.25 beats toward **the actual kick onset − 0.25 beats**, with independent confirmation that the result is before that kick.
- **Original:** the untouched full song and original MIDI are always the control; there are **zero additions/deletions** of bass notes.

Both proposals are intentionally **opt-in shadow functions, not runtime knobs**, with separate candidate IDs. Do not mistake this for a second production arrangement generator.

Restrictions: Funk or Neo-Soul single genre only; no fusions; only authorized verse/chorus/idea/hook sections where bass is expected; no explicit bass rests, motif anchors, cadence/handoff timing roles, note register/pitch/velocity/duration changes, kick-locked downbeat edits, new bass overlaps, section/bar crossings, or harmony changes at note start or release. The most one edited attack per two bars; eight per song. No changes to any other instrument, presets, Web Audio synth, gain, Android permissions or application UI.

## Real-song holdout, not a self-grading model

The `scripts/benchmark-bass-head-true-kick-roles.mjs` script evaluates **16 previously untested 32-bar E-minor songs** (Funk × 8 and Neo-Soul × 8, fixed seed indices 10–17) with the same composition configuration used for earlier blind experiments. Existing `evaluateSongCandidate`, `evaluateSongReleaseGate` and `encodeMidiVerified` remain the authority; proposals additionally require unchanged nonbass tracks, note topology, kick locks, no increased bass overlaps, and the new *actual kick-relative role*. Reject any candidate that fails, without relaxing musical safeguards just to fill an A/B pack.

Qualified candidates are exported as matched **two-way A/B or three-way A/B/C MIDI comparisons** with the untouched original as one concealed option. Labels rotate deterministically between cases to reduce A/B-side preference. The answer key is a separate artifact; **open it only after listening**. A MIDI-file comparison cannot demonstrate audible dynamics or punch with no specific instruments/DAW gain: use identical FL Studio sound patches and levels, then compare bass + kick, full mix, headphones and phone speakers.

### Developer verification

```bash
node --test tests/bass-head-true-kick-candidates.test.mjs tests/bass-head-timing-context.test.mjs tests/bass-head-bounce-shadow.test.mjs tests/bass-head-preference-selector.test.mjs tests/bass-head-groove-census.test.mjs
node scripts/benchmark-bass-head-true-kick-roles.mjs --start 10 --seeds 8 --bars 32 --out /tmp/kick-roles-report.json --pack /tmp/kick-roles-blind --key /tmp/kick-roles-key.json
npm run quality
npm run quality:music
```

No automatic production enablement or algorithm selection is justified until real listening comparisons across independent songs show reliable wins. The experiment preserves the complete approved sound and deterministic song pipeline.

**Skills consulted:** Bass Head Groove Director, MIDI Composition Review, MIDI Safe Integration; test-first independent code paths and regression verification. No autonomous subagent execution.
