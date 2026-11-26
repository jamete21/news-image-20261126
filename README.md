[![make.fun · news-image-20261126](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/jamete21/news-image-20261126/rank.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/jamete21/news-image-20261126/reward.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)

# The World in One Picture — Thursday 26 November 2026

A newspaper front page that sums up Thursday 26 November 2026 in one
1024×1024 image, drawn entirely in code by `main.ts` (Node 22, standard
library only — no network, no fonts, no image files).

## What the picture shows

- **Lead story — US tariffs shake world trade.** Washington proposes new
  duties on 14 trading partners to fight excess factory capacity, with
  China facing the highest rates. Illustrated with a cargo ship and a
  rising bar chart.
- **Oil jumps after a Houthi strike on a Saudi refinery.** Yemen's Houthis
  said they hit Saudi Arabia's largest refinery, and Iran said mines hit
  two ships in the Strait of Hormuz. Brent rose to $94.71 a barrel.
- **13 dead, 13 trapped in an illegal gold mine in Indonesia.** Rescuers
  resumed the search in West Java on Thursday.
- **Five more stories:** Macy's Thanksgiving parade put off by severe
  weather, the UK to publish new EU treaties, 31 killed in a Cairo fuel
  tanker fire, SpaceX cleared for a million satellites, and Duran Duran
  guitarist Andy Taylor dies at 65 — plus a markets ticker (Nikkei +1.6%,
  KOSPI +1.9%, Brent $94.71, WTI $84.03, gold $3,566).

Sources: Reuters and BBC, as reported on 26 November 2026.

## Verification (local, 26 November 2026)

- `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` run twice, with
  `out/entry.png` deleted between runs: both runs produced the same file,
  sha256 `39b8687b1427173098f4cd9726b65636e96e7a5585d7a2be0829af9574f5c7d6`.
- `entry.png`: 1024×1024, 36,428 bytes (limit 1 MiB), PNG 8-bit RGB.
- The rendered page was inspected visually: no overlapping or cut-off
  text, all five cards fit in two lines, and the markets ticker fits
  inside its black bar.

## How to run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024×1024, under 1 MiB). The program is
deterministic: two runs produce byte-identical files.

## How it works

`main.ts` contains its own tiny graphics stack: a pixel buffer, line and
filled-shape drawing, a hand-made stroke font (every letter is a set of
line segments on a 5×7 grid), three code-drawn illustrations (cargo ship,
oil refinery, mine headframe), and a hand-written PNG encoder (CRC32 +
`zlib` deflate from the Node standard library). All news text is
hard-coded as constants in the program.

## License

MIT — see [LICENSE](LICENSE).
