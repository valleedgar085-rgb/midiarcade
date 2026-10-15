# Comprehensive MIDI Arcade musical weakness census (read-only)

This is a **developer-only diagnostic**, not a new song critic, score-boosting pass, generator, APK change, or automatic release gate.

## Scope

The command exercises all genre profiles in `GENRE_PROFILES` using two distinct deterministic seeds per genre at 32 bars and a fixed creative-control configuration. It captures **every** observed weakness rather than only the lowest overall score. The accompanying GitHub Actions workflow saves every per-seed observation in a JSON artifact.

```sh
node scripts/audit-musical-weaknesses.mjs --seeds 2 --bars 32 --json /tmp/midi-musical-census.json
```

Repeat with other seeds, different control combinations or longer forms to evaluate coverage. Run existing `npm run quality` and `npm run quality:music` separately to verify the established quality gate.

## Subsystems checked

| Category | Existing source-of-truth function | What is surfaced |
| --- | --- | --- |
| Melody phrase cohesion | `evaluateMelodyPhraseIntelligence` | Motif identity, contour, phrase-level groove, harmonic landing and expression |
| Chorus hook identity | `evaluateChorusHookRecurrence` | Return recognizability, contour/rhythm overlap, literal repeat and unavailable comparisons |
| Cross-section development | `evaluateMelodySectionMemory` | Motif recall, contrast, relationship fitness, clone risk, absent memory contracts |
| Rhythm and bass/drum team | `evaluateEnsembleCoordinationAuthority` | Rhythm foundation, kick/bass cloning, bass independence, call/response |
| Arrangement / layer orchestration | same ensemble evaluator | Always-on layers, section-role evolution, foreground/support overlap, melody/chord crowding |
| Harmonic safety | `analyzeTonalIntegrity` | Active scale fit, strong-note chord fit, harsh sustained strong-beat notes |
| General music dimensions | `evaluateSongCandidate` | Each genre/seed's five lowest critic dimensions, all scores below existing Phase 5 floors |
| Technical/release | `evaluateSongReleaseGate` | All release-gate failures and names |
| Vocal negative space proxy | `evaluateChorusHookRecurrence(...).verses` | Lead MIDI melody note attacks and rest fractions per verse |

## What findings mean

- **Contract:** existing release gate or strictly defined scale fit failed; investigate before proceeding to a release.
- **Heuristic:** music-aware numeric critic or exploratory ensemble threshold highlighted an area for listening and investigation. This is NOT proof the song sounds bad.
- **Unknown:** evaluator had insufficient evidence (e.g., no second chorus or no phrase-memory contract); don't count it as success or failure.
- Lead MIDI melody rest time is **not** an estimate of how well an unrecorded singer or rapper will perform; it only flags possible space to investigate.
- A high `passed` or `score` does not guarantee a memorable hook. Compare identical seeds blind and at matched loudness.
- `generateNew` is the seedable production engine, but these runs do not exercise the full executor/worker/Android preview routing. Run dedicated UI, MIDI-export, and device tests before any production changes.

## Read-only protocol and continuation

1. Run the census job on the PR; retrieve `midi-arcade-musical-weakness-census` artifact (JSON) and its `MUSIC_CENSUS_GENRE` log rows.
2. Group every reported category by genre and reproducing seed. Review **all** observed failures and not just the top-ranked score; identify recurring versus isolated evidence.
3. For weak pop/hip-hop/rap hooks, inspect `src/core/chorus-hook-recurrence.js` plus existing hook-development candidates and the `PHASE4_HOOK_BASELINE` test output.
4. For bass/kick, ensemble, orchestration, tonal and density weaknesses, reuse their existing owning modules and focused tests. Don't create parallel correction authorities.
5. Record prioritized bounded fixes **separately** after evidence. Keep the approved Android audio baseline, three-candidate arrangement architecture, seed determinism and preview/MIDI parity intact.
6. Run `npm run quality` and a music matrix on each proposal; require listening A/B for audible claims.

## Coverage limits

This audit does not measure actual audio waveforms, click/pop defects, CPU load on Android hardware, voice recordings, or actual user listening preference. Those require Sonic Skills / Audio Verification and physical device checks. It also does not claim complete coverage of every possible key, knob value, genre combination, or seed; "all" refers to **all exposed categories and all configured genres and seeds**, with explicit gaps reported.

## Related developer skills

- `.agents/skills/midi-composition-review/SKILL.md` (in [developer skill PR #350](https://github.com/valleedgar085-rgb/midiarcade/pull/350))
- `.agents/skills/midi-audio-diagnostics/SKILL.md`
- `.agents/skills/midi-safe-integration/SKILL.md`
