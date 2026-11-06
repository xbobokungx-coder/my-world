---
name: lottery-system-map
description: Where the Lucky Lotto (หวย) system lives in server.js/shared.js/game.js, its World state fields, and how it is saved/loaded
metadata:
  type: project
---

Lucky Lotto (หวยประจำวัน) is fully server-authoritative, owned by `World` in `server.js` (section header "กองกลาง + หวยประจำวัน").

Key methods (grep names, not line numbers): `toPot` (money into pot), `lottoDraw` (draw + payout + reseal next round), `lottoTick` (called from `World.tick`), `lottoBuy` (msg `{t:'lotto', a:'buy', nums}`), `lottoPub` (client view incl. hash of sealed nums), `lottoOk`/`nearLucky` (gates: final starter + level >= S.LOTTO.minLv, stand near the LUCKY cabinet), `lottoSeal`/`lottoHash` (sha256 commit of 3 winning numbers), `loadLotto`.

State: `World.lotto = { pot, round, sealed:{nums,salt,hash}, tickets:{playerKey:[3-digit]}, last, hist (max 30) }`.

Persistence: `World.save` writes `lotto: this.lotto` into the room file `DATA_DIR/<room>.json` (atomic tmp+rename). Load path: `loadTown` picks `d.lotto` and calls `loadLotto`. Note the sealed nums+salt are in the plaintext save file.

Constants: `shared.js` `LOTTO` (price, maxTickets, revealHour 21, closeMs, seed, minLv, prize tiers). `LUCKY` tile position and `townAt` in shared.js.

Client: `public/game.js` `lottoCard`, `bindLotto`, `openTown` (tab 'lotto'), msg case 'lotto'.

Message types: client->server `lotto` (a: 'get' | 'buy'); server->client `lotto` (field `l`), `msg`.

**Why:** needed to answer "where is lottery code" questions quickly.
**How to apply:** verify with grep before citing; line numbers drift.
