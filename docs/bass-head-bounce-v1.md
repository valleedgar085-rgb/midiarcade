# Bass Head — Funk/Neo-Soul Bounce Shadow V1 (developer-only)

## Baseline

Current approved MIDI Arcade audio is unchanged. The nine-genre, 18-song [read-only Bass Head census (PR #366)](https://github.com/valleedgar085-rgb/midiarcade/pull/366) found Funk with **22/84 (26%)** bass onsets off quarter-note beats and Neo-Soul with **62/124 (50%)**; House had **134/134 (100%)** deliberate offbeat onsets. These counts describe note positions, not a measure of musical danceability.

The simpler PR #369 was **closed without merging** because the more complete PR #366 was already merged.

## Intervention

Add **one opt-in, bounded proposal owner** to the existing `src/core/groove-pocket-refinement.js`, exported as `createBassHeadBounceCandidates(song,{bassHeadBounceV1:true})`. It is not imported by the default engine or user interface. Two alternatives **for Funk or Neo-Soul only**, never fusions:

- **Answer**: one eligible unaccented onbeat bass attack shifted **+0.25 beats** after its original position.
- **Pickup**: one eligible unaccented onbeat bass attack shifted **−0.25 beats** before its original position.

A maximum of one change per two-bar phrase, eight changes for a full-length song. Never create or remove notes. Preserve original pitch, duration, velocity, kick/drum and all nonbass tracks. Reject moving a note that is protected (anchor, cadence/handoff, preserving timing), near an existing kick, too close to a section edge, past a harmony change or into another bass note. Reject non-verse/chorus/idea/hook sections, bass rest obligations, and fusions. The original groove-pocket optimizer (three existing profiles) has **no behavioral changes**.

**No changes to synthesis, volume, sub-bass EQ, envelopes, Web Audio voice count or approved samples**. No new rhythm generator or candidate release authority; proposed changes are shadow evaluated only.

## Verification

```sh
node --test tests/bass-head-bounce-shadow.test.mjs tests/groove-pocket-refinement.test.mjs tests/bass-continuity-refinement.test.mjs tests/bass-head-groove-census.test.mjs
node scripts/benchmark-bass-head-bounce-shadow.mjs --seeds 3 --bars 32 --out /tmp/bass-head-report.json --pack /tmp/bass-head-blind --key /tmp/bass-head-answer-key.json
npm run quality
npm run quality:music
```

The shadow audit compares six **matching fixed seeds**: Funk and Neo-Soul × three songs in E minor. It records actual note onset/offset changes, independent critic score, production release pass/fail, kick-lock preservation, bass overlap avoidance, unchanged nonbass tracks and actual encoded MIDI export parity.

If a proposal clears all automated gates, create matched blind A/B .mid pairs, with the answer key stored as a **separate CI artifact**. Human listening should compare the actual musical groove with consistent FL Studio patches and loudness, first drums+bass and then full arrangement, including the earlier reference-song approach. Prefer the original if the changed groove doesn't feel better.

Important: An increased offbeat percentage and successful critic gate do not prove an improvement; groove needs actual human judgment. No default enablement until sufficiently broad listening/genre evidence confirms benefit. If real fixtures show no safe proposal, document that outcome and re-examine bass phrase planning rather than loosening protection blindly.

## Source and skill routing

Bass Head Groove Director, MIDI Composition Review, MIDI Safe Integration; upstream `mc-rhythm-section` and `mc-style-hiphop` principles as genre-specific guidance. Source/audit/test domains were inspected independently through concurrent repository calls; **no dedicated autonomous subagents were dispatched**.


## Measured first real-song result (2026-10-16)

[Successful isolated Bass Head shadow workflow](https://github.com/valleedgar085-rgb/midiarcade/actions/runs/38870986153): **18/18 focused tests pass**. Six fixed-seed 32-bar Funk/Neo-Soul songs, **five proposals** across three songs, **five meet existing release, nonbass-track, unchanged kick-lock/overlap and actual encoded-MIDI parity gates**, and **five distinct blind MIDI A/B pairs** were archived.

| Genre/seed | Proposals surviving automation | Added offbeat onsets | Critic score change |
| --- | --- | --- | --- |
| Funk seed 02 | Pickup (−0.25 beat) | +1 | 0 |
| Neo-Soul seed 02 | Answer (+0.25 beat); pickup (−0.25 beat) | +1; +5 | 0; 0 |
| Neo-Soul seed 03 | Answer; pickup | +2; +2 | 0; 0 |

Funk 01, Funk 03 and Neo-Soul 01 had no bounded, safe candidates. That is a **valid protected baseline**; do not widen edit budgets merely to make all songs receive a change. The other music-quality, tonal and rhythmic workflows must pass independently before code integration. Results are **not audible proof**; the sound engine, UI and normal generation remain unchanged.

[Blind MIDI ZIP archive](https://github.com/valleedgar085-rgb/midiarcade/actions/runs/38870986153/artifacts/12032673782) — listen to matched A/B files first. [Answer key (open last)](https://github.com/valleedgar085-rgb/midiarcade/actions/runs/38870986153/artifacts/12033497096). Use the same synth presets and matched levels, then select cases where timing actually makes you move. No automatic activation or claim of improved bass punch without listener feedback.
