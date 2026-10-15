# Musical weakness census — first 21-genre evidence pass

**Run:** [GitHub Actions: Read-only Musical Weakness Census #38680934003](https://github.com/valleedgar085-rgb/midiarcade/actions/runs/38680934003)
**Source branch:** `audit/read-only-music-weakness-matrix-20261014`
**Input:** 21 configured genres × 2 fixed seeds each, 32 bars, E minor, identical creative-control settings. All results are existing engine evaluators and **not listening tests**.

## Verified execution outcome

- Census workflow: **success**; 42 generation observations and complete JSON evidence artifact `midi-arcade-musical-weakness-census` (artifact ID `11948375977`).
- Report emitted **248 diagnostic findings**: 235 tagged heuristic, 12 tagged unavailable/unknown coverage, 1 other review item, **0 hard release-contract failures**.
- Counts represent **flag occurrences per generated song**, not 248 independent software bugs. Each category can appear in the same song and exploratory thresholds are deliberately broad.
- All 42 songs passed the existing release gate. Automated green status must **not** be interpreted as a subjective music-quality pass.

## Repeating observations (out of 42 songs)

| Signal | Count | Musical interpretation and caveat |
| --- | ---: | --- |
| Weak section-role evolution (exploratory threshold) | 42 | Many sections reuse a similar active instrument roster. Check whether the evaluator is insensitive to changes in dynamics/phrasing; constant orchestration is not necessarily bad for minimalist genres. |
| Supporting foreground overlap (exploratory threshold) | 38 | Lead/support density may compete. Verify at actual rhythmic moments and through listening; coincident notes alone do not prove masking. |
| Kick/bass onset-clone ratio (exploratory threshold) | 36 | Locked rhythm may be entirely intentional; investigate whether bass retains **melodic independence** and functional variation, not whether it plays with the kick. |
| Every layer active through each section | 30 | Potential arrangement saturation and lack of contrast. Confirm against section-role and energy timeline; fixed layers may be appropriate in some styles. |
| Weak hook recurrence | 12 | Twelve songs failed the existing hook critic, out of **30 evaluable** songs. This is a substantive recurring candidate for melody work but is not proof of bad listening quality. |
| Missing/incomplete hook comparison | 12 | Cannot score chorus return (one chorus, sparse sections, or unsuitable form). **Not a failing hook.** |
| Weak melodic phrase score | 6 | Inspect exact section rhythm/contour/cadence before modifying notes. |
| Ensemble authority evaluator failed | 5 | Current evaluator threshold failure, despite successful release gate; inspect per-section lead dialogue/role balance. |
| Weak cross-section memory | 2 | Both in ambient; consider style applicability before generalizing. |
| Harsh strong-note warning | 1 | Requires inspection for deliberate harmonic tension; not proof of a wrong note. |

## All genres: reproducible summary

| Genre | Average musical critic | Weak hooks / evaluable | Hook unknown | Weak phrases | Memory weak | Ensemble fail |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| neoSoul | 93 | 2/2 | 0 | 2 | 0 | 0 |
| hipHop | 94 | 0/2 | 0 | 1 | 0 | 0 |
| rap | 94.5 | 0/2 | 0 | 0 | 0 | 0 |
| trap | 92 | 0/2 | 0 | 0 | 0 | 0 |
| house | 93 | n/a | 2 | 0 | 0 | 0 |
| techno | 93.5 | n/a | 2 | 0 | 0 | 0 |
| drumBass | 93 | n/a | 2 | 0 | 0 | 0 |
| synthwave | 92.5 | 1/2 | 0 | 0 | 0 | 0 |
| pop | 93 | 0/2 | 0 | 0 | 0 | 2 |
| loFiHipHop | 94.5 | n/a | 2 | 1 | 0 | 0 |
| rnbSoul | 93.5 | 1/2 | 0 | 0 | 0 | 1 |
| drill | 92 | 1/2 | 0 | 0 | 0 | 0 |
| reggaeton | 93.5 | 0/2 | 0 | 0 | 0 | 1 |
| afrobeats | 94.5 | 2/2 | 0 | 0 | 0 | 1 |
| jazz | 90 | n/a | 2 | 0 | 0 | 0 |
| ambient | 93 | n/a | 2 | 1 | 2 | 0 |
| funk | 93.5 | 1/2 | 0 | 0 | 0 | 0 |
| country | 93 | 1/2 | 0 | 1 | 0 | 0 |
| rock | 93.5 | 1/2 | 0 | 0 | 0 | 0 |
| popRadio | 94 | 1/2 | 0 | 0 | 0 | 0 |
| synthPopRadio | 92.5 | 1/2 | 0 | 0 | 0 | 0 |

## Independent prior evidence — rap hook variability

[Full quality and observation run #38680444787](https://github.com/valleedgar085-rgb/midiarcade/actions/runs/38680444787) contains three 32-bar rap hook observations with scores **45, 72, 52** (threshold 66). The two new census rap seeds passed: *both things can be true*. Do not generalize from just two new seeds. The same run includes a 63-song quality lab (21 genres × 3 seeds, 16 bars) where global groove was the weakest group (85.7), jazz averaged 91.3 overall and trap's lowest dimension was repetition at 64. That lab reported **0 Phase 5 dimension floor breaches**.

## Recommended fix queue (separate PRs, no automatic musical mutation)

| Priority | Investigation | Target authority / proof |
| --- | --- | --- |
| P1 | Chorus identity across rap, neo-soul, afrobeats and pop-radio variants | `chorus-hook-recurrence.js`, existing phrase-memory + hook-development path. Fix only when comparable openings lose recognizable contour/rhythm unintentionally. |
| P1 | Section-role evolution and breathing room | `ensemble-coordination-authority.js`, arrangement matrix and section completion authority. Confirm auditor isn't scoring genre-minimalism as bad. Compare instrument entrances/exits and actual phrase roles. |
| P1 | Melody versus support foreground collisions | Existing ensemble and melodic-phrase critics. Check timed and register-specific overlap; favor reducing competing accompaniment over filling lead rests. |
| P2 | Kick/bass relationship and intentional groove | Genre-aware pocket contract. Flag rhythmic clones only when musical bass independence is harmed; never penalize intentional lockstep by itself. |
| P2 | Weak phrase development and cross-section memory | Existing melody phrase intelligence / memory critics, especially neo-soul and ambient. |
| P2 | Pop and fusion lead-dialogue / ensemble failures | Reproduce seeds and trace failing section's contract and scoring weights. |
| P3 | Groove/drum variety; density target vs actual | Current 63-song benchmark suggests a potential ceiling; expand genre-specific seeds and compare listening before modifying target values. |
| P3 | Tonal warning in synthPopRadio | Inspect the exact note/harmony context; retain intentional color notes. |

## Why this is **not** a claim that all music defects are known

One static knob profile, two 32-bar seeds, and symbolic critic scores do not cover every musical configuration. MIDI Arcade's worker/executor route, two other candidate selections, actual sound and device latency, user listening, long-form songs, genre blending, auto/off knobs and exported MIDI bytes need separate evidence. *All* here means all currently enumerated critic categories and all 21 configured genres, with unavailable evidence flagged. No app logic was changed in this work.
