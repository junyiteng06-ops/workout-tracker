/** Epley式: 1RM = 重量 × (1 + 回数 / 30) */
export function epley(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

/** Brzycki式: 1RM = 重量 × 36 / (37 - 回数)。回数が多いと発散するため 36回以下に限定 */
export function brzycki(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return (weight * 36) / (37 - Math.min(reps, 36));
}

/** 各回数で扱える重量の目安(%1RM)。一般的に用いられる換算表 */
export const REP_PERCENTAGES: ReadonlyArray<{ reps: number; percent: number }> = [
  { reps: 1, percent: 100 },
  { reps: 2, percent: 95 },
  { reps: 3, percent: 93 },
  { reps: 4, percent: 90 },
  { reps: 5, percent: 87 },
  { reps: 6, percent: 85 },
  { reps: 8, percent: 80 },
  { reps: 10, percent: 75 },
  { reps: 12, percent: 70 },
  { reps: 15, percent: 65 },
];

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
