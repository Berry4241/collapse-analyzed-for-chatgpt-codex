# Changelog

## 1.6.0 — responsiveness and scalability
- Removed the O(number of open panels × whole conversation scan) fallback loop that froze long tabs in v1.5.
- Added batched DOM changes with a single final verification scan; never claims success solely because a style property was written.
- Added event-loop yields during scanning, native control activation and visual folds.
- Memoizes DOM geometry only during a scan; clears it after yielding or modifying page contents.
- Uses a spatial index to assign STDOUT/STDERR captions to headers in near-linear time.
- Avoids speculative clicks on plain non-interactive rows, the main source of useless work on the user's page.
- Caches visual-fold markers per root rather than doing a full-document selector for every closed header.
- Coalesces rapid toolbar clicks to at most one additional queued scan.
- Preserves the extension name: **Collapse Analyzed for ChatGPT & Codex**.
- No additional permissions or network access.

## Remaining caveats
- The currently signed-in, live ChatGPT DOM has not been inspected or tested.
- Visual fallback temporarily hides blocks rather than changing ChatGPT internal state.
- Ambiguous sections may be reported `unknown` or `failed`, not removed. “Analysis paused” is not an “Analyzed” header.
- Heavy browsers or extremely long chats can still cause some delay; Chromium synthetic benchmarks are not low-end-hardware guarantees.
