---
name: handoff
description: Save where the work stands to docs/HANDOFF.md and push, so the next session on any machine (work PC, home PC, laptop) can continue. Use when the user says they are stopping, switching machines, or runs /handoff.
---

# Handoff (end of a work session)

1. Rewrite the top section "## ตอนนี้" of `docs/HANDOFF.md`. Keep the whole file under 60 lines; move older entries into "## ก่อนหน้า" as one line each and drop entries older than ~2 weeks (git log has them).
   - เครื่อง: which machine this session ran on (ask if unknown)
   - กำลังทำ: the ticket or plan path (`docs/tasks/...`, `docs/plans/...`)
   - เสร็จแล้ว: 1–5 bullets
   - ค้างอยู่ / ขั้นต่อไป: 1–5 bullets, concrete enough to start without re-reading the chat
   - ตัดสินใจแล้ว: decisions and why (one line each)
   - ระวัง: anything half-done, failing tests, data changes
2. Update the related ticket's "บันทึก / คำตัดสินใจ" section if there is one.
3. `git status`. Commit work that is finished and passes tests. Unfinished code: commit it to a branch `wip/<slug>` instead of `main`, and write the branch name in HANDOFF.md.
4. Commit `docs/HANDOFF.md` and push.
5. Tell the user in 3 lines what was saved and the branch to continue on.
