# Shape Director — Phase 4

## Product role

Shape is the place where the user directs the composition after Create has supplied the idea and the Elemental Producer System has supplied a production personality.

**Create → idea**  
**Elements → personality**  
**Shape → authorship**  
**Mix → mixing, mastering and FX**

Shape must make advanced musical direction feel fast and safe. A beginner should be able to tap a section and choose a direction. An advanced user should be able to narrow the same change to one instrument or selected MIDI notes and then open the piano roll for precision.

## Ownership boundary

### Shape owns

- section and instrument targeting
- energy and density
- groove / pocket / syncopation
- motif and repetition
- phrase length and phrase resolution
- register and melodic lift
- harmonic movement and tension
- velocity contour and note gate as performance/composition behavior
- transitions and arrangement builds
- local variation and rewrite strength
- note-level composition edits

### Mix owns later

- level / gain
- pan
- mute / solo
- EQ and filtering as mix processing
- compression / limiting
- saturation / distortion FX
- reverb / delay
- stereo width
- sends and buses
- master loudness and ceiling
- mastering and final export polish

A phrase such as **More Space** in Shape therefore means fewer events, longer breathing room, and altered phrase/gate behavior. It must not secretly add reverb or delay.

## Scope model

Every Shape operation must declare its target before it changes the song:

1. **Section** — shape the selected Verse / Chorus / Bridge / Intro / Outro as a musical unit.
2. **Track inside section** — shape only Drums, Bass, Chords, Melody, Counterpoint or Pad in that section.
3. **Selected notes** — the narrowest authority for piano-roll precision.

Narrow requests must fail closed rather than silently expanding to a bigger region.

## Change size

### Touch Up
Small changes. Preserve the phrase and arrangement identity. Intended for fills, velocity contours, light rhythmic movement, note spacing and subtle phrasing.

### Reshape
Meaningful local rewrite. The selected area can change substantially while remaining recognizable in the current song.

### Transform
Large local rewrite. The selected area may be recomposed aggressively, but explicit preserve locks, key/mode safety and the surrounding song context still constrain the result.

The user-facing strength control must never imply that 100% is inherently better.

## Preserve locks

Initial locks:

- Preserve Melody
- Preserve Harmony
- Preserve Rhythm
- Preserve Instrument

Manual preserve locks outrank Auto and must survive repeated Shape operations until changed by the user.

## Quick directions

Initial musical directions:

- More Bounce
- Harder
- Simpler
- Busier
- More Emotional
- More Space
- Catchier
- Darker
- Brighter
- Build Up
- Calm Down

These are intent labels, not one-knob effects. Producer Brain should translate them into bounded changes across the relevant musical dimensions for the selected scope.

## Interaction model

1. User taps a section in the song map.
2. Shape shows the active scope clearly.
3. User optionally narrows to one instrument.
4. User chooses Touch Up / Reshape / Transform.
5. User chooses a quick direction or adjusts advanced musical macros.
6. Shape generates a non-destructive candidate for that local region.
7. User can A/B Before vs After.
8. Accept commits the local edit; Undo/Redo stays available.
9. Piano roll remains optional for exact note work.

## Safety / quality rules

- Never edit outside the declared scope.
- Preserve key/mode safety and MIDI bounds.
- Preserve locked musical dimensions.
- Respect surrounding section entrances and exits.
- Run relationship checks for kick/bass and melody/counterpoint where applicable.
- Reject a candidate that materially worsens critic/release quality without a compensating user-requested benefit.
- Keep changes deterministic for the same song, scope, direction, strength and seed.
- Do not duplicate Mix/FX controls inside Shape.
- Do not force the user into the piano roll for common musical changes.

## Phase 4 build order

1. Scope and ownership contract.
2. Non-destructive local transformation plan / candidate model.
3. Before/After audition and accept/revert transaction.
4. Quick direction layer.
5. Preserve locks.
6. Advanced section and track macros.
7. Integrate existing piano-roll precision as the deepest layer.
8. Android portrait / landscape interaction and performance validation.

Mix expansion follows after Shape is dependable. The Mix phase should then grow into the dedicated mixing, mastering and FX environment rather than competing with Shape for composition authority.
