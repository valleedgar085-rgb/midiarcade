## 2026-10-28 - Dialog Focus Restoration & Dynamic ARIA Transport State
**Learning:** Modal dialogs in this single-page studio must restore focus to `guideTriggerElement` or `debuggerTriggerElement` upon closing to prevent focus loss to `<body>`. Additionally, mobile playback transport controls need dynamic `aria-label` and `aria-pressed` state synchronization alongside class toggles.
**Action:** Always capture `document.activeElement` before opening modals and call `.focus()` upon dismissal, and keep ARIA attributes in sync during playback state transitions.
