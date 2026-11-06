---
name: ship
description: Commit, push, and deploy finished work to the live VPS through the ops agent.
disable-model-invocation: true
---

# Ship (only when the user runs /ship)

1. `git status`. Make sure no secrets or `data/`/`backup/` files are staged.
2. qa-tester: all tests must pass. If not, stop.
3. Commit file by file with a short Thai message, then `git push`.
4. Ask the user to confirm the deploy time (online players disconnect briefly if server code changed).
5. ops: run `deploy.sh --check`, then `deploy.sh -y` over SSH as described in `docs/OPS.md`, and report health.
