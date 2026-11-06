---
name: bugfix
description: Fix a reported bug with the smallest change and a regression test. Use when the user reports something broken or a player bug report (#id) is given.
---

# Bugfix pipeline

1. If a bug id is given, read it with `node tools/bugs.js <id>`.
2. Explore: find where the behavior happens. Ask for a likely root cause, not a fix.
3. If the fix is under ~20 lines in one file you already understand, do it yourself. Otherwise give it to the owning agent (server-dev / client-dev / pixel-artist / economy-designer).
4. qa-tester: add a regression test when the bug is in server rules, then run all tests.
5. code-reviewer: review the diff.
6. Summarize root cause and fix in 5 lines. Commit after the user agrees. To mark a player bug fixed: `node tools/bugs.js fix <id>`.
