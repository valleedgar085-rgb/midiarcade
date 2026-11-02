## 2025-05-18 - Keyboard Skip Links and HTML Size Budgeting
**Learning:** In strict static-compiled web apps with automated asset quality gates (like `check-build-quality.js` byte limits on `www/index.html`), adding accessibility skip-to-content links requires pairing minimal HTML overhead with CSS `:focus` absolute positioning to avoid page layout jumps while serving screen readers and keyboard navigation.
**Action:** Always include a visual focus state for skip links and ensure index.html size budgets are accounted for when expanding markup.
