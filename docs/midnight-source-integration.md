# Midnight Studio source integration

The uploaded `midi-arcade-midnight-source.zip` supplies the visual reference for
this first integration pass. Its React prototype uses demonstration notes,
generation progress, meters and export messages. The production app continues
to use its existing engine, song state, section editor, player and MIDI exporter.

The integration maps the reference palette, compact cards, heading hierarchy,
form fields, focus outlines and four-tab navigation onto the existing DOM IDs.
The same header and navigation presentation now applies to every workspace.
The transport remains available above navigation, and Finish retains the real
export action. Advanced instrument controls remain accessible in their existing
disclosures. Dynamic song artwork remains owned by the production cover engine.

The preview command now uses a Node static server and accepts the host and port
arguments passed by the managed preview service. It no longer depends on a
missing `python` executable.

## Validation

- `npm run quality`: 167 test files passed, web build passed, quality gate passed.
- Initial HTML: 94 buttons; global CSS: 182189 / 186368 bytes.
- `node --check scripts/serve-preview.mjs` and `git diff --check`: passed.
- Visual QA: blocked. The managed preview started successfully, but the cloud
  browser refused the local URL under its security policy. No screenshot or
  interaction verification is claimed.
- Android APK: not built in this pass.

## Remaining work

This is a presentation integration, not an exact reproduction of every prototype
screen. The prototype's settings drawer, saved-song carousel and section editor
layout still need production-specific integration. Before release, verify all
four workspaces at 320–600px widths, scroll Create until the compact player
appears, change tabs, adjust a section/instrument target, audition mix changes
and export a MIDI file on Android. Check that navigation, transport and final
content do not overlap, including with large text and safe-area insets.
