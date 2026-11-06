---
name: feature
description: Run the studio pipeline for a new or changed game feature (ticket, scout, plan, build, test, review, docs). Use when the user asks to add or change gameplay, UI, or art.
---

# Feature pipeline (main session = producer)

1. Write a ticket at `docs/tasks/<slug>.md` from `docs/tasks/_TEMPLATE.md`. Keep it under 40 lines. Every subagent gets the ticket path instead of a long re-explanation.
2. Explore: ask for the locations the ticket touches. Add the file:line map to the ticket.
3. If the feature touches 2+ systems, a new message type, or the save format: architect writes `docs/plans/<slug>.md`. Otherwise skip.
4. If numbers are involved: economy-designer sets them first.
5. Build: server-dev, then client-dev, then pixel-artist if art is needed. Run two writers in parallel only if their files do not overlap; otherwise run them one after another.
6. qa-tester: run all tests; add a test for the new server rule.
7. code-reviewer: review the diff. Fix every "must fix" with the owning developer agent.
8. doc-writer: update GAME-DESIGN.md / HOW-TO-PLAY.md if rules or numbers changed.
9. Show the user a 10-line summary and the diff stat. Commit file by file only after the user agrees. Do not deploy; that is the `ship` skill.

Tell each subagent to keep its report short. Do not paste their full reports back to the user.
