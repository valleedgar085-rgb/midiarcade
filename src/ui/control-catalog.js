export const TRACK_ORDER = Object.freeze(["drums", "bass", "chords", "melody", "counterpoint", "pad"]);

export const TRACK_META = Object.freeze({
  drums: { name: "Drums", role: "Rhythmic pulse", icon: "✺", color: "#ff755e" },
  bass: { name: "Bass", role: "Low-end movement", icon: "◒", color: "#ae8cff" },
  chords: { name: "Chords", role: "Harmony & voicing", icon: "▰", color: "#58e6d9" },
  melody: { name: "Melody", role: "Main motif", icon: "♪", color: "#d8ff53" },
  counterpoint: { name: "Counterline", role: "Call & response", icon: "⌁", color: "#f7c866" },
  pad: { name: "Atmosphere", role: "Space & texture", icon: "≈", color: "#62a6ff" },
});

export const TRACK_EXPRESSION_KEYS = Object.freeze([
  "volume",
  "velocity",
  "pan",
  "reverb",
  "cutoff",
  "resonance",
  "gate",
  "humanize",
  "feel",
]);

export const ATTITUDE_LABELS = Object.freeze({
  neutral: "Neutral",
  power: "Power",
  motion: "Motion",
  bloom: "Bloom",
  hush: "Hush",
});

export const ATTITUDE_ADJUSTMENTS = Object.freeze({
  power: {
    density: 7, variation: 4, volume: 0.09, velocity: 0.13,
    reverb: -0.05, gate: 0.06, humanize: -0.04, feel: 0.08,
  },
  motion: {
    density: 9, variation: 16, volume: 0.01, velocity: 0.02,
    reverb: 0.03, gate: -0.07, humanize: 0.09, feel: 0.2,
  },
  bloom: {
    density: -2, variation: 6, volume: -0.02, velocity: -0.04,
    reverb: 0.24, gate: 0.24, humanize: 0.04, feel: -0.02,
  },
  hush: {
    density: -9, variation: -5, volume: -0.14, velocity: -0.16,
    reverb: 0.07, gate: 0.08, humanize: 0.05, feel: -0.08,
  },
});

export const CONTROL_HELP = Object.freeze({
  undoButton: ["Undo", "Return to the previous generated song or instrument rewrite. It restores notes and controls together."],
  redoButton: ["Redo", "Reapply the last undone song or Shape edit, including its notes, controls, and section focus."],
  helpButton: ["Complete guide", "Open the full four-step tutorial and a plain-language explanation of every control."],
  renameButton: ["Rename idea", "Change only the displayed song title. The notes and sound remain unchanged."],
  generateNew: ["New song idea", "Replace the entire composition: every instrument, chord progression, phrase, sound and section."],
  generateSimilar: ["More like this", "Keep the current musical DNA while creating a fresh recognizable variation."],
  showcasePlayButton: ["Play this song", "Audition the complete generated arrangement without leaving the Create workspace."],
  showcaseSimilarButton: ["More like this", "Keep the song's recognizable musical identity while composing a new variation."],
  showcaseArrangeButton: ["Open arrangement", "Move to the song map where every section and instrument can be focused and edited."],
  mixPlayButton: ["Listen to the mix", "Play or pause the complete song while you balance and shape its instruments."],
  reorderButton: ["Change section order", "Reorder the song's sections and compose a related arrangement around the new journey."],
  randomizeMixButton: ["Vary instrument balance", "Adjust each instrument's density and movement. Generate More like this afterward to hear the new balance."],
  resetControlsButton: ["Reset song direction", "Restore beginner-friendly Neo Soul settings. The current song stays unchanged until you generate."],
  newRecipeButton: ["Load creative recipe", "Load a curated mood, rhythm feel, energy and complexity combination. Generate afterward to hear it."],
  previousButton: ["Restart", "Return playback to the beginning of the song."],
  playButton: ["Play or pause", "Audition the complete arrangement with the built-in studio preview engine."],
  loopButton: ["Loop", "Repeat the entire song continuously while you make changes."],
  songScrubber: ["Song position", "Drag to hear another point in the arrangement."],
  exportButton: ["Export sound-ready MIDI", "Download one Type-1 MIDI file with separate named tracks, GM2 programs, bank selection, note velocity, gate, mix controllers and automation."],
  guidedModeButton: ["Guided mode", "Show or hide the four-step workflow. Hiding it does not remove any music controls."],
  workflowAction: ["Recommended next action", "Perform the safest next step shown by the workflow coach."],
  closeDialog: ["Close guide", "Close the complete app guide and return to your song."],
  editorPlayButton: ["Play from this section", "Move playback to the beginning of the focused section and audition your edits in context."],
  editorCloseButton: ["Close piano roll", "Return to the full song map. Your MIDI edits remain in the song."],
  editorGridControl: ["Snap grid", "Choose the timing step used by quantize, nudge, note length and newly drawn notes."],
  editorVelocityControl: ["Note velocity", "Set how hard the selected MIDI notes play, from 1 to 127."],
  editorZoomControl: ["Piano-roll zoom", "Change horizontal note spacing without changing musical timing."],
  threadSongButton: ["Current song", "Return to the main song idea and its two generation choices."],
  threadSectionButton: ["Section focus", "Open the focused section in the piano roll, or choose a musical section when none is focused."],
  threadTrackButton: ["Instrument focus", "Jump to the selected instrument. This focus is shared with Character controls and the piano roll."],
  threadActionButton: ["Connected next action", "Jump to the most relevant place for the current song, section and instrument focus."],
  genreControl: ["Genre", "Sets tempo range, groove rules, harmony, arrangement behavior and the instrument palette."],
  keyControl: ["Root note", "Sets the tonal home of the generated song."],
  modeControl: ["Musical mood", "Choose the scale color: brighter, darker, soulful, dreamy, open or tense."],
  tempoControl: ["Tempo", "Set song speed in beats per minute. The genre's usual range is shown above."],
  barsControl: ["Song length", "Choose 16 bars for a sketch or 32–64 bars for a fuller arrangement."],
  grooveControl: ["Rhythm feel", "Choose precise, laid-back, shuffled or syncopated timing behavior."],
  energyControl: ["Energy", "Raise for harder hits, greater rhythmic activity and stronger section lifts."],
  complexityControl: ["Complexity", "Raise for richer harmony, finer rhythms and more melodic motion."],
  swingControl: ["Swing", "Delay selected off-beats for bounce. Small amounts usually sound most natural."],
  humanizeControl: ["Humanize", "Add tiny timing and velocity differences so the performance is less mechanical."],
  tripletControl: ["Triplet Spice", "Allow exact-grid triplet bursts only where the phrase has room."],
  rollControl: ["Transition Rolls", "Allow snare rolls near real phrase and section endings."],
  variationControl: ["Variation", "Set how far More like this may move from the current musical identity."],
  evolutionControl: ["Phrase Evolution", "Set how strongly patterns and dynamics develop gradually across the song."],
  surpriseControl: ["Surprise", "Invite less-common genre-compatible choices without abandoning the selected style."],
});

export const ATTITUDE_HELP = Object.freeze({
  power: ["Power", "Rewrite only the selected instrument to feel more forward, dense and forceful."],
  motion: ["Motion", "Rewrite only the selected instrument with more interlaced rhythmic movement."],
  bloom: ["Bloom", "Rewrite only the selected instrument with longer notes, more space and emotional tails."],
  hush: ["Hush", "Rewrite only the selected instrument with softer, restrained phrasing."],
  neutral: ["Character Reset", "Return only the selected instrument to its neutral expression profile."],
});

export const TRACK_ACTION_HELP = Object.freeze({
  target: ["Select instrument", "Make this the only instrument affected by Power, Motion, Bloom, Hush or Character Reset."],
  mute: ["Mute", "Silence this instrument in preview and export. Its named track and sound setup remain in the file, but its notes are omitted."],
  solo: ["Solo", "Hear this instrument without the rest of the band in browser playback."],
  lock: ["Lock", "Preserve this instrument's current notes when you generate More like this."],
  reroll: ["Regenerate instrument", "Write a fresh part for only this instrument while listening to its retained musical partners."],
});

export const TRACK_CONTROL_HELP = Object.freeze({
  program: ["Sound", "Choose the General MIDI instrument program used in preview and stored in this exported track."],
  density: ["Density", "Control how often this instrument plays."],
  variation: ["Movement", "Control rhythmic and melodic variation inside this instrument's phrases."],
  octave: ["Register", "Move this pitched instrument up or down by octaves."],
  volume: ["Level", "Change this instrument's preview volume and exported MIDI volume controller without rewriting notes."],
  velocity: ["Velocity", "Scale how hard every note hits in preview and bake the same values into exported MIDI note velocities."],
  gate: ["Gate", "Scale note lengths in preview and export without rewriting the underlying phrase."],
  pan: ["Pan", "Place this instrument left, center or right in preview and exported MIDI."],
  reverb: ["Space", "Control this instrument's ambience in preview and exported MIDI reverb controller."],
  cutoff: ["Cutoff", "Darken or brighten the preview filter and export the matching General MIDI brightness controller."],
  resonance: ["Resonance", "Emphasize the preview filter and export the matching General MIDI resonance controller."],
  waveform: ["Waveform", "Choose the primary Web Audio oscillator waveform for live preview synthesis."],
  synthCutoff: ["Filter Cutoff", "Adjust the synthesizer's lowpass filter cutoff frequency in real time."],
  synthResonance: ["Resonance", "Set the filter resonance peak Q factor for sharp or smooth timbre."],
  attack: ["Attack", "Control how quickly notes reach full volume."],
  release: ["Release", "Control how long note tails ring after release."],
  detune: ["Detune", "Adjust chorus layer detune cents for rich analog thickness."],
});

export const EDITOR_ACTION_HELP = Object.freeze({
  "select-all": ["Select section notes", "Select every visible note for this instrument inside the focused section."],
  quantize: ["Quantize", "Move selected note starts to the nearest chosen grid line."],
  humanize: ["Humanize selection", "Add very small deterministic timing and velocity differences while staying inside the section."],
  "nudge-left": ["Nudge earlier", "Move selected notes earlier by one grid step."],
  "nudge-right": ["Nudge later", "Move selected notes later by one grid step."],
  shorter: ["Shorten", "Reduce selected note lengths by one grid step."],
  longer: ["Lengthen", "Extend selected note lengths by one grid step without crossing the section end."],
  "octave-down": ["Octave down", "Transpose selected pitched notes down 12 semitones."],
  "pitch-down": ["Semitone down", "Transpose selected pitched notes down one semitone."],
  "pitch-up": ["Semitone up", "Transpose selected pitched notes up one semitone."],
  "octave-up": ["Octave up", "Transpose selected pitched notes up 12 semitones."],
  duplicate: ["Duplicate", "Copy selected notes one grid step later inside this section."],
  delete: ["Delete notes", "Remove selected notes from this instrument. Undo restores them."],
});

export const WORKFLOW_COPY = Object.freeze([
  null,
  { title: "Choose your musical direction", text: "Pick a genre and adjust Energy if you want. The genre automatically chooses a musical tempo and groove.", action: "Go to song direction" },
  { title: "Listen before changing anything", text: "Press Play and listen through at least one section. If the entire idea is wrong, use New song idea again.", action: "Play the song" },
  { title: "Shape one instrument", text: "Click an instrument row, then choose Power, Motion, Bloom or Hush. Only that selected part will be rewritten.", action: "Go to instrument controls" },
  { title: "Export six separate tracks", text: "When the idea feels useful, export one .mid. FL Studio can create one channel per track from it.", action: "Export one .mid" },
]);

export function resolveControlHelp(element) {
  if (!element) return null;
  if (element.id && CONTROL_HELP[element.id]) return CONTROL_HELP[element.id];
  if (element.dataset?.attitude && ATTITUDE_HELP[element.dataset.attitude]) return ATTITUDE_HELP[element.dataset.attitude];
  if (element.dataset?.editorAction && EDITOR_ACTION_HELP[element.dataset.editorAction]) return EDITOR_ACTION_HELP[element.dataset.editorAction];
  if (element.dataset?.action && TRACK_ACTION_HELP[element.dataset.action]) return TRACK_ACTION_HELP[element.dataset.action];
  if (element.dataset?.control && TRACK_CONTROL_HELP[element.dataset.control]) return TRACK_CONTROL_HELP[element.dataset.control];
  if (element.dataset?.editorNote) return ["MIDI note", "Select this note for editing. Shift-click to select several notes at once."];
  if (element.dataset?.editorTrack) return ["Piano-roll instrument", "Show this instrument's notes inside the focused song section."];
  if (element.dataset?.workflowStep) {
    const step = Number(element.dataset.workflowStep);
    const copy = WORKFLOW_COPY[step];
    return copy ? [`Workflow step ${step}: ${copy.title}`, copy.text] : null;
  }
  if (element.dataset?.section) return ["Focus arrangement section", "Highlight this section in the song map so you can inspect which instruments play there."];
  if (element.matches?.(".advanced-controls > summary")) return ["Optional fine-tuning", "Open detailed rhythm, human feel and generation-variety controls. Beginners can safely leave these closed."];
  if (element.matches?.(".track-expression > summary")) return ["Shape instrument", "Open sound, performance and space controls for this instrument without cluttering the whole mixer."];
  if (element.matches?.(".guide-groups summary")) return ["Guide topic", "Open this topic for plain-language control explanations."];
  return null;
}
