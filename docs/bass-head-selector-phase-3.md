# Bass Head Phase 3 — Listener-Backed Bass Groove Selector (shadow)

**Baseline:** `main` at `a3b1fd892058cd9a68a8d581d810bba431652cb9`, with PR #370's **dormant, opt-in only** Funk/Neo-Soul bounce candidates. No existing audio, generation, or exported MIDI behavior is changed.

## Actual blind-listening evidence (one user, five A/B pairs)

The listener preferred **B in all five**. The actual A/B answer key from [Bass Head Shadow CI](https://github.com/valleedgar085-rgb/midiarcade/actions/runs/38870986153) shows that B represented both original and experimental patterns. Verified mapping is encoded as developer-only data in `scripts/fixtures/bass-head-listening-round-1.json`:

| Pair | Genre | Candidate | Which was B? | Listener preference |
| --- | --- | --- | --- | --- |
| bass-01 | Funk | −0.25 beat pickup | Experimental | Pickup |
| bass-02 | Neo-Soul | +0.25 beat answer | Experimental | Answer |
| bass-03 | Neo-Soul | −0.25 beat pickup | Original | Original |
| bass-04 | Neo-Soul | +0.25 beat answer | Experimental | Answer |
| bass-05 | Neo-Soul | −0.25 beat pickup | Original | Original |

Thus experimental proposals won **3/5** and originals **2/5**, across **three unique songs**. Neo-Soul answers have **two favorable examples on two separate seeds**. Neo-Soul pickups lost twice; Funk pickups won once. This is an *interesting directional preference*, not a universally trained model or proof of groove quality.

## What changes this phase

- **Developer-only selector**, `scripts/lib/bass-head-preference-selector.mjs`: decodes the *actual key* and votes; checks response integrity and distinct song counts. Groups results by **genre and proposal**, not just by A/B letter.
- **Conservative next-audition policy**: Neo-Soul answer = `priority-review`; Neo-Soul pickup = `prefer-baseline` and omitted from new blind pairs; Funk pickup = `collect-more`. Other genres and unknown proposals never receive music edits. Every plan includes the **unchanged original song** as baseline; `defaultActivationAllowed=false` always.
- **Existing bounds retained**: `createBassHeadBounceCandidates` remains dormant outside explicit developer shadow calls. No runtime controls or listener-personalized model; no modification to existing quality/release/candidate ownership.
- **Second independent listening set**: `scripts/benchmark-bass-head-preference-selector.mjs --start 4 --seeds 6 --bars 32` generates **12 held-out songs** (Funk and Neo-Soul, indices 04–09) with identical production configuration. Original comparison songs were indices 01–03. It checks unchanged **all nonbass tracks**, unchanged bass note counts, pitch, duration and velocity, maximum onset shift, unchanged kick-lock count, no increased bass overlaps, no critic regression, original/candidate release gate, verified actual MIDI export parity, and **source immutability**.
- Qualified cases become **blind A/B MIDI pairs**, maximum twelve, with the answer key in a completely separate artifact. Proposals that fail any check do not enter the listening pack. No code auto-chooses the final song.

## How to review

```sh
node --test tests/bass-head-preference-selector.test.mjs tests/bass-head-bounce-shadow.test.mjs tests/bass-head-groove-census.test.mjs tests/groove-pocket-refinement.test.mjs tests/bass-continuity-refinement.test.mjs
node scripts/benchmark-bass-head-preference-selector.mjs --start 4 --seeds 6 --bars 32 --out /tmp/bass-holdout.json --pack /tmp/bass-blind --key /tmp/bass-answer-key.json
npm run quality
npm run quality:music
```

Matched playback procedure: import paired `A.mid`/`B.mid` into FL Studio with identical drum/bass instruments, tempo, note velocity response, effects and loudness; listen to bass+drums and full arrangement before recording choice. Each pair is the same song seed. Only after voting open the **separate** answer key. The observed 5/5 preference for B must not be confused with 5/5 wins for the new bass algorithm.

## Guardrails and next decision

- **No synth edits, EQ, 808 patch, compressor, master gain, envelopes, key/scale change, melodic changes, or new UI**. Reference listening informs *rhythmic feel* only. Music generation remains the current 3-candidate deterministic authority, as before.
- A change in offbeat count is not evidence of a catchier bassline. Existing critic scores stayed unchanged in Phase 2; that explains why *human listening* matters, not why every offbeat should be kept.
- Even if held-out proposals pass CI, **do not automatically enable in the app**. Gather second-round listener votes, compare genuine preference rates on unseen seeds, and only then consider a narrow opt-in app control inside existing quality authority.
- If held-out Funk/Neo-Soul patterns do not yield enough safe trials, report limited coverage rather than lowering safety gates to manufacture candidates.

**Skills used:** MIDI Bass Groove Director; MIDI Composition Review; MIDI Safe Integration; systematic debugging and test-first approach. Independent domain inspections, no separately executed autonomous agents.
