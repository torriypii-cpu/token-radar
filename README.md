# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/torriypii-cpu/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/torriypii-cpu/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar over the sealed DefiLlama snapshot: every watchlist protocol, plus 160 early pre-token protocols below the floor, ranked by implied value, with a farm plan for each row. The model's base multiple is not a constant — it is the market's own figure, the median market-cap / TVL ratio of the protocol's category among the snapshot's live-token protocols (clamped, with the all-category median as fallback), adjusted by seven-day growth and by how long the protocol has run with no token. Live-token protocols are set aside and shown at their market caps, never mixed into the ranking. The static dashboard is sortable and filterable, with a detail view that recomputes each row's implied value from the snapshot figures and shows its farm plan; it renders with no network.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
