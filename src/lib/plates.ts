export const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export const BARS = [20, 15, 10, 0];

export interface PlateLoad {
  /** Plates for one side, heaviest first. */
  perSide: number[];
  /** Weight actually loaded (may be under the target if plates can't make it exactly). */
  total: number;
  exact: boolean;
}

/** Greedy fill per side — exact for standard plate sets. */
export function loadBar(target: number, bar: number, plates: number[]): PlateLoad | null {
  if (target < bar) return null;
  let remaining = (target - bar) / 2;
  const perSide: number[] = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (remaining >= p - 1e-9) {
      perSide.push(p);
      remaining -= p;
    }
  }
  const total = bar + perSide.reduce((s, p) => s + p, 0) * 2;
  return { perSide, total: Math.round(total * 100) / 100, exact: Math.abs(remaining) < 1e-6 };
}
