export interface ChartSpec {
  kind: 'line' | 'bar';
  unit: string;
  series: { label: string }[];
  /** values[i] は series[i] の値。値が無い日は null */
  points: { date: string; values: (number | null)[] }[];
}
