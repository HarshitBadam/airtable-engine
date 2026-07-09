/**
 * Renders benchmark-results/offset-sweep.csv (produced by latency-benchmark.ts)
 * into a log-scale SVG line chart at benchmark-results/offset-sweep.svg.
 *
 * No dependencies — pure SVG string assembly, so the chart is reproducible
 * alongside the benchmark itself.
 *
 * Usage: npx tsx render-sweep-chart.ts
 */

import { readFileSync, writeFileSync } from "node:fs";

const CSV_PATH = "benchmark-results/offset-sweep.csv";
const SVG_PATH = "benchmark-results/offset-sweep.svg";

interface Series {
  label: string;
  sub: string;
  color: string;
  dash?: string;
  points: { offset: number; ms: number }[];
}

// label = short tier name (bold, colored); sub = description (gray, line 2).
const SERIES_META: Record<string, { label: string; sub: string; color: string; dash?: string; order: number }> = {
  naive_offset: { label: "Naive OFFSET", sub: "the unoptimized baseline", color: "#e5484d", dash: "7 5", order: 2 },
  tier1_rowindex_seek: { label: "Tier 1", sub: "rowIndex seek", color: "#0090ff", order: 0 },
  tier2_viewrowrank: { label: "Tier 2", sub: "ViewRowRank lookup", color: "#46a758", order: 1 },
  tier3_sorted_deferred_join: { label: "Tier 3", sub: "ad-hoc sort, no anchor", color: "#f76b15", order: 3 },
};

// --- Parse -----------------------------------------------------------------

const rows = readFileSync(CSV_PATH, "utf8")
  .trim()
  .split("\n")
  .slice(1) // header
  .map((line) => {
    const [offset, path, ms] = line.split(",");
    return { offset: Number(offset), path: path!, ms: Number(ms) };
  });

const byPath = new Map<string, Series>();
for (const r of rows) {
  const meta = SERIES_META[r.path];
  if (!meta) continue;
  let s = byPath.get(r.path);
  if (!s) {
    s = { label: meta.label, sub: meta.sub, color: meta.color, dash: meta.dash, points: [] };
    byPath.set(r.path, s);
  }
  s.points.push({ offset: r.offset, ms: r.ms });
}
const series = [...byPath.entries()]
  .sort((a, b) => SERIES_META[a[0]]!.order - SERIES_META[b[0]]!.order)
  .map(([, s]) => s);
for (const s of series) s.points.sort((a, b) => a.offset - b.offset);

const maxOffset = Math.max(...rows.map((r) => r.offset));

// --- Scales ------------------------------------------------------------------

const W = 1000;
const H = 480;
const PLOT = { left: 70, right: 740, top: 62, bottom: 404 };

const Y_MIN_MS = 0.1;
const Y_MAX_MS = 2000;

const x = (offset: number) =>
  PLOT.left + (offset / maxOffset) * (PLOT.right - PLOT.left);
const y = (ms: number) => {
  const v = Math.log10(Math.max(ms, Y_MIN_MS));
  const lo = Math.log10(Y_MIN_MS);
  const hi = Math.log10(Y_MAX_MS);
  return PLOT.bottom - ((v - lo) / (hi - lo)) * (PLOT.bottom - PLOT.top);
};

// --- Assemble ------------------------------------------------------------------

const parts: string[] = [];

parts.push(
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif">`,
  `<rect width="${W}" height="${H}" rx="8" fill="#ffffff" stroke="#d0d7de"/>`,
  `<text x="${PLOT.left}" y="30" font-size="17" font-weight="600" fill="#1f2328">Jump latency as the jump gets deeper, on a 1,000,000-row table</text>`,
  `<text x="${PLOT.left}" y="49" font-size="12" fill="#57606a">Server-side query execution time. Median of 5 warm runs, log scale.</text>`,
);

// Y gridlines + labels (decades)
for (const ms of [0.1, 1, 10, 100, 1000]) {
  const yy = y(ms);
  parts.push(
    `<line x1="${PLOT.left}" y1="${yy.toFixed(1)}" x2="${PLOT.right}" y2="${yy.toFixed(1)}" stroke="#eaeef2"/>`,
    `<text x="${PLOT.left - 8}" y="${(yy + 4).toFixed(1)}" font-size="11" fill="#57606a" text-anchor="end">${ms < 1 ? ms : ms.toLocaleString()} ms</text>`,
  );
}

// X ticks + labels (full numbers with separators so depth is unambiguous)
for (const o of [0, 250_000, 500_000, 750_000, maxOffset]) {
  const xx = x(o);
  parts.push(
    `<line x1="${xx.toFixed(1)}" y1="${PLOT.bottom}" x2="${xx.toFixed(1)}" y2="${PLOT.bottom + 5}" stroke="#8c959f"/>`,
    `<text x="${xx.toFixed(1)}" y="${PLOT.bottom + 20}" font-size="11" fill="#57606a" text-anchor="middle">${o.toLocaleString("en-US")}</text>`,
  );
}

// Axes
parts.push(
  `<line x1="${PLOT.left}" y1="${PLOT.top}" x2="${PLOT.left}" y2="${PLOT.bottom}" stroke="#8c959f"/>`,
  `<line x1="${PLOT.left}" y1="${PLOT.bottom}" x2="${PLOT.right}" y2="${PLOT.bottom}" stroke="#8c959f"/>`,
  `<text x="${(PLOT.left + PLOT.right) / 2}" y="${PLOT.bottom + 44}" font-size="12" fill="#57606a" text-anchor="middle">Jump depth: which row the user jumped to (row offset into the table)</text>`,
);

// Series lines + endpoint dots + direct labels at the right edge
const usedLabelYs: number[] = [];
function nudge(target: number): number {
  // Push 3-line label blocks apart vertically so they never overlap.
  let yy = target;
  let moved = true;
  while (moved) {
    moved = false;
    for (const used of usedLabelYs) {
      if (Math.abs(yy - used) < 40) {
        yy = used + 40;
        moved = true;
      }
    }
  }
  usedLabelYs.push(yy);
  return yy;
}

for (const s of series) {
  const pts = s.points.map((p) => `${x(p.offset).toFixed(1)},${y(p.ms).toFixed(1)}`).join(" ");
  const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : "";
  parts.push(
    `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.5"${dash} stroke-linejoin="round" stroke-linecap="round"/>`,
  );
  for (const p of s.points) {
    parts.push(
      `<circle cx="${x(p.offset).toFixed(1)}" cy="${y(p.ms).toFixed(1)}" r="3" fill="${s.color}"/>`,
    );
  }
  const last = s.points[s.points.length - 1]!;
  const blockTop = nudge(y(last.ms) - 8);
  const lastMs = last.ms >= 1000 ? `${(last.ms / 1000).toFixed(1)} s` : `${last.ms < 1 ? last.ms.toFixed(1) : Math.round(last.ms)} ms`;
  const lx = PLOT.right + 12;
  parts.push(
    `<text x="${lx}" y="${blockTop.toFixed(1)}" font-size="13" font-weight="700" fill="${s.color}">${s.label}</text>`,
    `<text x="${lx}" y="${(blockTop + 14).toFixed(1)}" font-size="11" fill="#57606a">${s.sub}</text>`,
    `<text x="${lx}" y="${(blockTop + 28).toFixed(1)}" font-size="12" font-weight="600" fill="#3a4149">${lastMs}</text>`,
  );
}

parts.push(`</svg>`);

writeFileSync(SVG_PATH, parts.join("\n") + "\n");
console.log(`Wrote ${SVG_PATH} (${series.length} series, ${rows.length} data points)`);
