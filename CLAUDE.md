# MIDI Arcade — Claude Code project guidance

@AGENTS.md

The canonical developer skills are in `.agents/skills/`. Claude Code slash-skill entry points are in `.claude/skills/` and refer to the same canonical sources. Before melody, groove, hook or arrangement development use `/midi-composition-review`; before Web Audio fixes use `/midi-audio-diagnostics`; before branch integration or release claims use `/midi-safe-integration`.

For defects, failing CI, unexpected musical output or build failures use `/systematic-debugging` first; for new behavior, bug fixes and refactors use `/test-driven-development` with RED → GREEN → REFACTOR before integration. Both are canonical developer-only skills under `.agents/skills/`.

See `docs/DEVELOPER_SKILLS_WORKFLOW.md`. Do not automatically install third-party skill packages, add runtime dependencies, or modify the approved audio baseline as part of this setup.
