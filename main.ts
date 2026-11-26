// The World in One Picture — Thursday 26 November 2026
// A program that draws a newspaper front page summing up the day's world
// news, using only the Node standard library. No network, no fonts, no
// images: every letter is drawn from a small stroke font defined below,
// every picture is drawn with lines, rectangles and circles, and the PNG
// is encoded by hand (zlib from the standard library does the compression).
// The output is fully deterministic: the same bytes on every run.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- colours
const PAPER: [number, number, number] = [246, 241, 227];
const INK: [number, number, number] = [18, 18, 18];
const RED: [number, number, number] = [163, 22, 33];
const BLUE: [number, number, number] = [23, 63, 95];
const GOLD: [number, number, number] = [176, 124, 24];
const GREY: [number, number, number] = [110, 104, 90];
const WHITE: [number, number, number] = [250, 248, 240];
const TEAL: [number, number, number] = [24, 96, 88];

// ------------------------------------------------------------------ canvas
const buf = new Uint8Array(W * H * 3);

function fillAll(c: [number, number, number]): void {
  for (let i = 0; i < W * H; i++) {
    buf[i * 3] = c[0];
    buf[i * 3 + 1] = c[1];
    buf[i * 3 + 2] = c[2];
  }
}

function px(x: number, y: number, c: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: [number, number, number]): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
    }
  }
}

function hline(x0: number, x1: number, y: number, c: [number, number, number]): void {
  fillRect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, c);
}

function disc(cx: number, cy: number, r: number, c: [number, number, number]): void {
  const rr = Math.max(0, Math.round(r));
  for (let dy = -rr; dy <= rr; dy++) {
    const dx = Math.floor(Math.sqrt(rr * rr - dy * dy));
    for (let xx = -dx; xx <= dx; xx++) px(cx + xx, cy + dy, c);
  }
}

function circleFill(cx: number, cy: number, r: number, c: [number, number, number]): void {
  disc(cx, cy, r, c);
}

function circleRing(cx: number, cy: number, r: number, t: number, c: [number, number, number]): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      px(Math.round(cx + (r - k) * Math.cos(rad)), Math.round(cy + (r - k) * Math.sin(rad)), c);
    }
  }
}

// Bresenham line with round caps; thickness t in pixels.
function line(x0: number, y0: number, x1: number, y1: number, t: number, c: [number, number, number]): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  const r = Math.max(0.5, t / 2);
  for (;;) {
    disc(x, y, r, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function polyline(pts: Array<[number, number]>, t: number, c: [number, number, number]): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], t, c);
  }
}

function triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: [number, number, number]): void {
  // filled triangle by scanlines
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    const edges: Array<[number, number, number, number]> = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length >= 2) {
      const a = Math.min(...xs);
      const b = Math.max(...xs);
      hline(Math.round(a), Math.round(b), y, c);
    }
  }
}

// ------------------------------------------------------------- stroke font
// Each glyph is a list of strokes separated by "|"; each stroke is a list
// of "x,y" points on a 5-wide, 7-tall grid (y grows downwards). The font
// is all capitals: text is upper-cased before drawing, which suits a
// newspaper front page. Unknown characters render as a blank space.
const GLYPHS: Record<string, string> = {
  A: "0,6 2,0 4,6|1,4 3,4",
  B: "0,0 0,6 3,6 4,5 4,4 3,3 0,3|3,3 4,2 4,1 3,0 0,0",
  C: "4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5",
  D: "0,0 0,6 3,6 4,5 4,1 3,0 0,0",
  E: "4,0 0,0 0,6 4,6|0,3 3,3",
  F: "0,0 0,6|0,0 4,0|0,3 3,3",
  G: "4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3 2,3",
  H: "0,0 0,6|4,0 4,6|0,3 4,3",
  I: "2,0 2,6|0,0 4,0|0,6 4,6",
  J: "4,0 4,5 3,6 1,6 0,5",
  K: "0,0 0,6|4,0 0,3 4,6",
  L: "0,0 0,6 4,6",
  M: "0,6 0,0 2,3 4,0 4,6",
  N: "0,6 0,0 4,6 4,0",
  O: "1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0",
  P: "0,6 0,0 3,0 4,1 4,2 3,3 0,3",
  Q: "1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0|3,4 4,6",
  R: "0,6 0,0 3,0 4,1 4,2 3,3 0,3|2,3 4,6",
  S: "4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5",
  T: "0,0 4,0|2,0 2,6",
  U: "0,0 0,5 1,6 3,6 4,5 4,0",
  V: "0,0 2,6 4,0",
  W: "0,0 1,6 2,3 3,6 4,0",
  X: "0,0 4,6|4,0 0,6",
  Y: "0,0 2,3 4,0|2,3 2,6",
  Z: "0,0 4,0 0,6 4,6",
  "0": "1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0",
  "1": "1,1 2,0 2,6|0,6 4,6",
  "2": "0,1 1,0 3,0 4,1 4,3 0,6 4,6",
  "3": "1,0 3,0 4,1 4,2 3,3 4,4 4,5 3,6 1,6",
  "4": "0,0 0,3 4,3|3,0 3,6",
  "5": "4,0 0,0 0,3 3,3 4,4 4,5 3,6 1,6 0,5",
  "6": "4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,4 3,3 1,3",
  "7": "0,0 4,0 2,6",
  "8": "1,0 3,0 4,1 4,2 3,3 1,3 0,2 0,1 1,0|0,4 1,3 3,3 4,4 4,5 3,6 1,6 0,5 0,4",
  "9": "0,5 1,6 3,6 4,5 4,1 3,0 1,0 0,1 0,3 1,4 3,4",
  ".": "1,6 2,6",
  ",": "2,5 1,6 1,7",
  ":": "2,2 2,2|2,5 2,5",
  ";": "2,2 2,2|2,5 1,6 1,7",
  "'": "2,0 2,2",
  "!": "2,0 2,4|2,6 2,6",
  "?": "1,0 3,0 4,1 3,2 2,3 2,4|2,6 2,6",
  "-": "0,3 4,3",
  "(": "3,0 2,1 2,5 3,6",
  ")": "1,0 2,1 2,5 1,6",
  "%": "0,0 4,6|0,1 1,1 1,2 0,2 0,1|3,4 4,4 4,5 3,5 3,4",
  $: "2,0 2,6|4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5",
  "/": "4,6 0,0",
  "+": "2,1 2,5|0,3 4,3",
  "=": "0,2 4,2|0,4 4,4",
  '"': "1,0 1,2|3,0 3,2",
  "•": "1,3 3,3|1,4 3,4|2,2 2,5",
};

function glyphStrokes(ch: string): Array<Array<[number, number]>> {
  const g = GLYPHS[ch];
  if (!g) return [];
  return g.split("|").map((stroke) =>
    stroke.split(" ").map((pt) => {
      const [x, y] = pt.split(",").map(Number);
      return [x, y] as [number, number];
    }),
  );
}

// Advance width of one character, in pixels, at the given font size.
function charAdvance(size: number): number {
  return (size * 6) / 7;
}

function textWidth(text: string, size: number): number {
  return text.length * charAdvance(size);
}

function drawChar(ch: string, x: number, y: number, size: number, c: [number, number, number]): void {
  const s = size / 7;
  const t = Math.max(1, Math.round(size * 0.11));
  for (const stroke of glyphStrokes(ch)) {
    for (let i = 0; i + 1 < stroke.length; i++) {
      const [x0, y0] = stroke[i];
      const [x1, y1] = stroke[i + 1];
      line(
        Math.round(x + x0 * s),
        Math.round(y + y0 * s),
        Math.round(x + x1 * s),
        Math.round(y + y1 * s),
        t,
        c,
      );
    }
  }
}

function drawText(
  text: string,
  x: number,
  y: number,
  size: number,
  c: [number, number, number],
  align: "left" | "center" | "right" = "left",
): void {
  const t = text.toUpperCase();
  let startX = x;
  if (align === "center") startX = x - textWidth(t, size) / 2;
  if (align === "right") startX = x - textWidth(t, size);
  let cx = startX;
  for (const ch of t) {
    if (ch !== " ") drawChar(ch, cx, y, size, c);
    cx += charAdvance(size);
  }
}

// Wrap text to lines that fit maxWidth pixels at the given size.
function wrapText(text: string, maxWidth: number, size: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, size) <= maxWidth || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawPara(
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  c: [number, number, number],
  lineGap: number = 1.28,
): number {
  const lines = wrapText(text, maxWidth, size);
  const lh = Math.round(size * lineGap);
  lines.forEach((ln, i) => drawText(ln, x, y + i * lh, size, c));
  return y + lines.length * lh;
}

// ------------------------------------------------------------ illustrations
// A cargo ship on the sea, with stacked containers and a small bar chart
// of tariff pressure rising behind it.
function drawShip(x: number, y: number, w: number, h: number): void {
  const seaY = y + h - 26;
  // sky band and sea
  fillRect(x, y, w, h, [214, 228, 233]);
  fillRect(x, seaY, w, 26, [52, 110, 138]);
  // sun
  circleFill(x + w - 52, y + 30, 16, GOLD);
  // rising bars (tariff pressure) in the background
  const bars = [18, 28, 40, 54];
  bars.forEach((bh, i) => {
    const bx = x + 22 + i * 30;
    fillRect(bx, seaY - 8 - bh, 20, bh, [163, 22, 33]);
  });
  // waves
  for (let i = 0; i < 5; i++) {
    const wx = x + 30 + i * 118;
    polyline(
      [
        [wx, seaY + 8],
        [wx + 16, seaY + 3],
        [wx + 32, seaY + 8],
        [wx + 48, seaY + 3],
        [wx + 64, seaY + 8],
      ],
      2,
      WHITE,
    );
  }
  // containers, stacked on the deck
  const deckY = seaY - 4;
  const contCols: Array<[number, number, number]> = [RED, BLUE, TEAL, GOLD];
  let cx = x + 150;
  const rows = [0, 1, 2];
  for (const r of rows) {
    for (let k = 0; k < 4 - r; k++) {
      const cw = 52;
      const ch = 22;
      const px0 = cx + k * (cw + 4);
      const py0 = deckY - (r + 1) * (ch + 3);
      fillRect(px0, py0, cw, ch, contCols[(r + k) % 4]);
      hline(px0, px0 + cw - 1, py0 + 7, INK);
      hline(px0, px0 + cw - 1, py0 + 14, INK);
    }
    cx += 10;
  }
  // bridge tower
  fillRect(x + 430, deckY - 66, 46, 66, WHITE);
  fillRect(x + 430, deckY - 66, 46, 12, BLUE);
  fillRect(x + 436, deckY - 52, 34, 8, BLUE);
  // hull
  polyline(
    [
      [x + 120, deckY],
      [x + 500, deckY],
      [x + 478, seaY + 16],
      [x + 150, seaY + 16],
      [x + 120, deckY],
    ],
    3,
    INK,
  );
  fillRect(x + 122, deckY + 1, 376, 12, INK);
  // funnel smoke, kept inside the sky band
  for (let i = 0; i < 3; i++) {
    circleFill(x + 486 + i * 8, deckY - 64 - i * 8, 7, [150, 148, 140]);
  }
}

// An oil refinery: distillation towers, a flare flame and a tanker.
function drawRefinery(x: number, y: number, w: number, h: number): void {
  const baseY = y + h - 18;
  fillRect(x, y, w, h, [232, 222, 200]);
  // sky sun haze
  circleFill(x + w - 40, y + 26, 13, GOLD);
  // flare stack with flame
  fillRect(x + 34, y + 34, 10, baseY - y - 34, INK);
  triangle(x + 30, y + 34, x + 48, y + 34, x + 39, y + 6, RED);
  triangle(x + 34, y + 34, x + 44, y + 34, x + 39, y + 16, GOLD);
  // distillation tower
  fillRect(x + 78, y + 44, 34, baseY - y - 44, BLUE);
  hline(x + 78, x + 112, y + 62, WHITE);
  hline(x + 78, x + 112, y + 84, WHITE);
  hline(x + 78, x + 112, y + 106, WHITE);
  circleFill(x + 95, y + 40, 10, BLUE);
  // second tower
  fillRect(x + 132, y + 70, 28, baseY - y - 70, TEAL);
  hline(x + 132, x + 160, y + 88, WHITE);
  // pipes
  line(x + 112, y + 96, x + 132, y + 96, 5, INK);
  line(x + 160, y + 110, x + 200, y + 110, 5, INK);
  // storage tank: a squat cylinder with a domed top
  fillRect(x + 196, y + 96, 62, baseY - y - 96, [200, 192, 172]);
  fillRect(x + 196, y + 96, 62, 3, INK);
  circleFill(x + 227, y + 96, 31, [200, 192, 172]);
  fillRect(x + 196, y + 96, 62, 14, [200, 192, 172]);
  hline(x + 196, x + 258, y + 96, INK);
  // ground
  fillRect(x, baseY, w, 18, [120, 112, 96]);
  // tanker silhouette in front
  fillRect(x + 60, baseY - 12, 180, 12, INK);
  triangle(x + 240, baseY - 12, x + 262, baseY - 12, x + 240, baseY + 2, INK);
}

// A mine headframe with a shaft, cable and rescue lamp dots.
function drawMine(x: number, y: number, w: number, h: number): void {
  const groundY = y + h - 24;
  fillRect(x, y, w, h, [228, 218, 196]);
  // sky
  circleFill(x + w - 34, y + 26, 13, GOLD);
  // headframe (A-frame tower)
  line(x + 60, groundY, x + 108, y + 22, 6, INK);
  line(x + 156, groundY, x + 108, y + 22, 6, INK);
  line(x + 60, groundY, x + 156, groundY, 6, INK);
  line(x + 78, groundY - 34, x + 138, groundY - 34, 4, INK);
  line(x + 88, groundY - 68, x + 128, groundY - 68, 4, INK);
  // sheave wheel
  circleRing(x + 108, y + 26, 14, 4, INK);
  // cable down the shaft
  line(x + 108, y + 40, x + 108, groundY + 8, 3, INK);
  // shaft opening
  fillRect(x + 84, groundY, 48, 24, INK);
  // lamp dots (rescue lights)
  circleFill(x + 40, groundY - 10, 4, GOLD);
  circleFill(x + 182, groundY - 10, 4, GOLD);
  // ground
  fillRect(x, groundY + 24, w, 2, INK);
}

// ------------------------------------------------------------------- layout
const M = 36; // page margin
const R = 988; // right edge of content

function rule(y: number, t: number, c: [number, number, number] = INK): void {
  fillRect(M, y, R - M, t, c);
}

function drawMasthead(): void {
  // small globe mark left of the title
  const gx = 64;
  const gy = 62;
  circleRing(gx, gy, 22, 3, BLUE);
  line(gx - 22, gy, gx + 22, gy, 2, BLUE);
  line(gx, gy - 22, gx, gy + 22, 2, BLUE);
  // meridians as arcs approximated with short lines
  polyline(
    [
      [gx - 11, gy - 19],
      [gx - 15, gy - 7],
      [gx - 15, gy + 7],
      [gx - 11, gy + 19],
    ],
    2,
    BLUE,
  );
  polyline(
    [
      [gx + 11, gy - 19],
      [gx + 15, gy - 7],
      [gx + 15, gy + 7],
      [gx + 11, gy + 19],
    ],
    2,
    BLUE,
  );
  drawText("THE WORLD TODAY", 512, 34, 62, INK, "center");
  rule(112, 3);
  rule(118, 1);
  drawText("THURSDAY 26 NOVEMBER 2026", M, 130, 20, RED, "left");
  drawText("ONE DAY, ONE PAGE", R, 130, 20, INK, "right");
  rule(162, 2);
}

function drawLead(): void {
  // Left: lead story — US tariffs
  drawText("TRADE  •  WASHINGTON", M, 182, 16, RED, "left");
  drawText("US TARIFFS", M, 206, 52, INK, "left");
  drawText("SHAKE WORLD", M, 262, 52, INK, "left");
  drawText("TRADE", M, 318, 52, INK, "left");
  drawPara(
    "Washington proposes new duties on 14 trading partners to fight excess factory capacity. China faces the highest rates.",
    M,
    380,
    596,
    17,
    INK,
  );
  drawPara(
    "The duties would not stack on those imposed in July, officials said. Markets steadied in Asia after a sharp sell-off.",
    M,
    456,
    596,
    14,
    GREY,
  );
  drawShip(M, 504, 596, 136);

  // Right: oil story
  const rx = 668;
  const rw = R - rx;
  drawText("ENERGY  •  MIDDLE EAST", rx, 182, 16, RED, "left");
  drawText("OIL JUMPS", rx, 206, 25, INK, "left");
  drawText("AFTER HOUTHI", rx, 234, 25, INK, "left");
  drawText("STRIKE HITS", rx, 262, 25, INK, "left");
  drawText("SAUDI REFINERY", rx, 290, 25, INK, "left");
  drawRefinery(rx, 322, rw, 140);
  drawPara(
    "Yemen's Houthis said they hit Saudi Arabia's largest oil refinery. Iran said mines hit two ships in the Strait of Hormuz. Brent rose to $94.71 a barrel.",
    rx,
    476,
    rw,
    15,
    INK,
  );
  // vertical divider between lead and oil story
  fillRect(648, 182, 2, 458, GREY);
}

function drawMineStory(): void {
  const y = 670;
  rule(656, 2);
  drawMine(M, y + 14, 240, 136);
  const tx = 300;
  drawText("ASIA  •  INDONESIA", tx, y + 14, 16, RED, "left");
  drawText("13 DEAD, 13 TRAPPED", tx, y + 38, 32, INK, "left");
  drawText("IN ILLEGAL GOLD MINE", tx, y + 74, 32, INK, "left");
  drawPara(
    "Rescuers resumed the search on Thursday for 13 workers trapped underground in an illegal gold mine in West Java. Thirteen others were confirmed dead, police said.",
    tx,
    y + 116,
    R - tx,
    15,
    INK,
  );
}

interface Card {
  kicker: string;
  title: string;
  body: string;
}

const CARDS: Card[] = [
  {
    kicker: "THANKSGIVING",
    title: "PARADE PUT OFF BY STORMS",
    body: "New York delays its Thanksgiving parade for the first time ever as severe weather bears down.",
  },
  {
    kicker: "EUROPE",
    title: "UK TO PUBLISH EU TREATIES",
    body: "London will publish new treaties agreed with the EU, with a 10-year clause on border checks.",
  },
  {
    kicker: "EGYPT",
    title: "31 KILLED IN CAIRO FIRE",
    body: "A fuel tanker crashed on a Cairo highway, sparking a huge fire that killed 31 people.",
  },
  {
    kicker: "SPACE",
    title: "SPACEX GETS 1M SATELLITES",
    body: "US regulators approve SpaceX's plan to put a million data satellites into orbit.",
  },
  {
    kicker: "MUSIC",
    title: "DURAN DURAN STAR DIES AT 65",
    body: "Andy Taylor, guitarist of Duran Duran, has died aged 65.",
  },
];

function drawCards(): void {
  // Five short cards: kicker plus a two-line title each. Bodies stay in
  // the code as the source of the titles; the card itself is kept short
  // so nothing collides with the ticker below.
  const y = 872;
  rule(858, 2);
  const gap = 13;
  const cw = Math.floor((R - M - gap * 4) / 5);
  CARDS.forEach((card, i) => {
    const x = M + i * (cw + gap);
    if (i > 0) fillRect(x - gap + 4, y, 1, 56, GREY);
    drawText(card.kicker, x, y, 12, RED, "left");
    let ty = y + 18;
    const titleLines = wrapText(card.title, cw, 14);
    titleLines.forEach((ln) => {
      drawText(ln, x, ty, 14, INK, "left");
      ty += 18;
    });
  });
}

function drawTicker(): void {
  const y = 940;
  fillRect(M, y, R - M, 60, INK);
  drawText(
    "MARKETS:  NIKKEI +1.6%  •  KOSPI +1.9%  •  BRENT $94.71  •  WTI $84.03",
    512,
    y + 10,
    14,
    WHITE,
    "center",
  );
  drawText(
    "GOLD $3,566  •  EURO $1.0973  •  DOLLAR INDEX 103.71  •  REUTERS, BBC",
    512,
    y + 32,
    13,
    WHITE,
    "center",
  );
}

// ---------------------------------------------------------------- PNG codec
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // raw scanlines: one filter byte (0 = none) per row, then RGB bytes
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}

// --------------------------------------------------------------------- main
function main(): void {
  fillAll(PAPER);
  drawMasthead();
  drawLead();
  drawMineStory();
  drawCards();
  drawTicker();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, encodePNG());
}

main();
