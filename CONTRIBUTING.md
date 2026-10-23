# Contributing

Bug reports, performance measurements, and pull requests are welcome.

1. Confirm that the issue occurs on the latest release.
2. Avoid attaching sensitive conversation text, session tokens, cookies, private URLs, or personal information to Issues or pull requests.
3. Include a reproducible test case, preferably an **offline HTML fixture**.
4. Run `python tests/regression.py` (requires Python, Playwright, and Chromium) before proposing changes.
5. Preserve collapse-only behavior, minimal permissions, local-only processing, and the safety rules that protect normal answer content.
6. Explain any new browser permissions or network requests in the pull request.

The ChatGPT interface changes over time, so a test that depends on a particular HTML structure should include a fallback and documented limitations.
