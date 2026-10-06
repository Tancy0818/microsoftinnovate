import type { Forecast } from "../../src/types/planner.ts";
export interface Hour {
  time: string;
  arrivals: number;
}
const round = (n: number) => Math.round(n * 100) / 100;
function features(time: string) {
  const d = new Date(Date.parse(time) + 330 * 60000),
    h = d.getUTCHours();
  return [
    1,
    Math.sin((h * Math.PI) / 12),
    Math.cos((h * Math.PI) / 12),
    Math.sin((h * Math.PI) / 6),
    Math.cos((h * Math.PI) / 6),
    ...Array.from({ length: 6 }, (_, i) => Number(d.getUTCDay() === i)),
  ];
}
function fit(rows: Hour[]) {
  const n = features(rows[0].time).length;
  const a = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) =>
      i === j ? (i === 0 ? 0.001 : 2) : 0,
    ),
  );
  for (const r of rows) {
    const x = features(r.time);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) a[i][j] += x[i] * x[j];
      a[i][n] += x[i] * r.arrivals;
    }
  }
  // Pivoted Gaussian elimination for a small ridge regression normal equation.
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++)
      if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    const divisor = a[i][i];
    for (let k = i; k <= n; k++) a[i][k] /= divisor;
    for (let j = 0; j < n; j++)
      if (j !== i) {
        const factor = a[j][i];
        for (let k = i; k <= n; k++) a[j][k] -= factor * a[i][k];
      }
  }
  const weights = a.map((r) => r[n]);
  return (time: string) =>
    Math.max(
      0,
      features(time).reduce((sum, x, i) => sum + x * weights[i], 0),
    );
}
function seasonal(rows: Hour[]) {
  const buckets = Array.from({ length: 24 }, () => [] as number[]);
  for (const r of rows)
    buckets[new Date(Date.parse(r.time) + 330 * 60000).getUTCHours()].push(
      r.arrivals,
    );
  return (time: string) => {
    const b = buckets[new Date(Date.parse(time) + 330 * 60000).getUTCHours()];
    return b.reduce((s, v) => s + v, 0) / Math.max(1, b.length);
  };
}
export function trainForecast(input: Hour[], anchor: string): Forecast | null {
  const rows = [...input].sort(
    (a, b) => Date.parse(a.time) - Date.parse(b.time),
  );
  if (rows.length < 24 * 14) return null;
  for (let i = 0; i < rows.length; i++) {
    if (
      !Number.isInteger(rows[i].arrivals) ||
      rows[i].arrivals < 0 ||
      !Number.isFinite(Date.parse(rows[i].time)) ||
      (i > 0 &&
        Date.parse(rows[i].time) - Date.parse(rows[i - 1].time) !== 3600000)
    )
      return null;
  }
  const split = Math.floor(rows.length * 0.6),
    end = Math.floor(rows.length * 0.8);
  const train = rows.slice(0, split),
    validation = rows.slice(split, end),
    test = rows.slice(end);
  const ml = fit(train),
    base = seasonal(train);
  const mae = (r: Hour[], p: (t: string) => number) =>
    r.reduce((s, x) => s + Math.abs(x.arrivals - p(x.time)), 0) / r.length;
  const useML = mae(validation, ml) < mae(validation, base);
  const selected = useML ? ml : base;
  const errors = validation
    .map((r) => Math.abs(r.arrivals - selected(r.time)))
    .sort((a, b) => a - b);
  const width =
    errors[
      Math.min(errors.length - 1, Math.ceil((errors.length + 1) * 0.8) - 1)
    ];
  const final = useML ? fit(rows) : seasonal(rows);
  const next = Math.floor(Date.parse(anchor) / 3600000) * 3600000 + 3600000;
  // Round the UTC clock to an IST hour (IST is offset by 30 minutes).
  const start =
    Math.floor((Date.parse(anchor) + 330 * 60000) / 3600000) * 3600000 -
    330 * 60000 +
    3600000;
  if (!Number.isFinite(next)) return null;
  return {
    model: useML
      ? "Ridge regression · hour + weekday"
      : "Hourly seasonal mean · validation winner",
    trainedFrom: rows[0].time,
    trainedThrough: new Date(
      Date.parse(rows.at(-1)!.time) + 3600000,
    ).toISOString(),
    hours: rows.length,
    validationMae: round(mae(validation, selected)),
    baselineMae: round(mae(validation, base)),
    testMae: round(mae(test, selected)),
    testBaselineMae: round(mae(test, base)),
    testHours: test.length,
    coverage: round(
      (test.filter((r) => Math.abs(r.arrivals - selected(r.time)) <= width)
        .length /
        test.length) *
        100,
    ),
    stale: Date.parse(anchor) - Date.parse(rows.at(-1)!.time) > 48 * 3600000,
    points: Array.from({ length: 24 }, (_, i) => {
      const time = new Date(start + i * 3600000).toISOString(),
        expected = final(time);
      return {
        time,
        expected: round(expected),
        lower: Math.max(0, Math.floor(expected - width)),
        upper: Math.ceil(expected + width),
      };
    }),
  };
}
