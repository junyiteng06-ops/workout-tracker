import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type Plugin,
  type TooltipItem,
} from 'chart.js';
import type { ChartSpec } from '@/lib/charts/types';

Chart.register(LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Tooltip);

const DAY = 86_400_000;
/** これより点が多いと、点のリングが線を覆ってしまうため終点以外の点を省く(ホバー時は表示) */
const MAX_VISIBLE_POINTS = 24;

function tokens(el: Element) {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    surface: v('--color-bg'),
    text: v('--color-text'),
    secondary: v('--color-muted'),
    muted: v('--chart-muted'),
    grid: v('--chart-grid'),
    axis: v('--chart-axis'),
    series: [v('--series-1'), v('--series-2')],
    font: v('--font-sans') || 'system-ui, sans-serif',
  };
}

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const md = (t: number, withYear: boolean) => {
  const d = new Date(t);
  return withYear ? `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}` : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
const fmt = (n: number, unit: string) => `${n.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}${unit}`;

/** ポインタ位置の縦の補助線(クロスヘア) */
const crosshair: Plugin = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements();
    if (!active?.length) return;
    const x = active[0].element.x;
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = (chart.options.plugins as { crosshairColor?: string }).crosshairColor ?? '#999';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, top);
    ctx.lineTo(Math.round(x) + 0.5, bottom);
    ctx.stroke();
    ctx.restore();
  },
};

/** 折れ線の終点に「系列名 値」を直接表示する。ラベル同士が重なる場合は凡例とツールチップに任せて描かない */
function endLabels(spec: ChartSpec, color: string): Plugin {
  return {
    id: 'endLabels',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = `600 12px ${chart.options.font?.family ?? 'sans-serif'}`;
      ctx.fillStyle = color;
      ctx.textBaseline = 'middle';
      const labels = chart.data.datasets.flatMap((ds, i) => {
        const meta = chart.getDatasetMeta(i);
        const lastIndex = (ds.data as ({ y: number | null } | null)[]).findLastIndex((p) => p?.y != null);
        const point = meta.data[lastIndex];
        if (!point) return [];
        const y = (ds.data[lastIndex] as { y: number }).y;
        const text = spec.series.length > 1 ? `${spec.series[i].label} ${fmt(y, spec.unit)}` : fmt(y, spec.unit);
        return [{ x: point.x + 8, y: point.y, text }];
      });
      const sorted = [...labels].sort((a, b) => a.y - b.y);
      const collide = sorted.some((l, i) => i > 0 && l.y - sorted[i - 1].y < 14);
      if (!collide) for (const l of labels) ctx.fillText(l.text, l.x, l.y);
      ctx.restore();
    },
  };
}

function config(spec: ChartSpec, t: ReturnType<typeof tokens>, endLabelWidth: number): ChartConfiguration {
  const isLine = spec.kind === 'line';
  const times = spec.points.map((p) => toTime(p.date));
  const spanYears = times.length > 1 && times.at(-1)! - times[0] > 300 * DAY;

  const datasets = spec.series.map((s, i) => {
    const color = t.series[i] ?? t.series[0];
    const data = spec.points.map((p, j) => ({ x: isLine ? times[j] : j, y: p.values[i] }));
    const lastIndex = data.findLastIndex((p) => p.y != null);
    const dense = data.length > MAX_VISIBLE_POINTS;
    return isLine
      ? {
          type: 'line' as const,
          label: s.label,
          data,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          borderCapStyle: 'round' as const,
          borderJoinStyle: 'round' as const,
          pointRadius: dense ? data.map((_, j) => (j === lastIndex ? 4 : 0)) : 4,
          pointHoverRadius: 5,
          pointBorderWidth: 2,
          pointBorderColor: t.surface,
          pointBackgroundColor: color,
          pointHitRadius: 12,
          spanGaps: true,
        }
      : {
          type: 'bar' as const,
          label: s.label,
          data,
          backgroundColor: color,
          hoverBackgroundColor: color,
          maxBarThickness: 24,
          borderRadius: 4,
          borderSkipped: 'start' as const,
        };
  });

  const axisTicks = { color: t.muted, font: { size: 11, family: t.font } };
  return {
    type: spec.kind,
    data: isLine ? { datasets } : { labels: spec.points.map((p) => p.date), datasets },
    options: {
      animation: false,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, right: isLine ? endLabelWidth : 4 } },
      font: { family: t.font },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: isLine
          ? {
              type: 'linear',
              min: times.length === 1 ? times[0] - 7 * DAY : times[0],
              max: times.length === 1 ? times[0] + 7 * DAY : times.at(-1),
              grid: { display: false },
              border: { color: t.axis },
              ticks: { ...axisTicks, maxTicksLimit: 5, maxRotation: 0, callback: (v) => md(Number(v), spanYears) },
            }
          : {
              type: 'category',
              grid: { display: false },
              border: { color: t.axis },
              ticks: { ...axisTicks, maxRotation: 0, autoSkipPadding: 12, callback: (_v, i) => md(times[i], spanYears) },
            },
        y: {
          beginAtZero: !isLine,
          grace: isLine ? '8%' : 0,
          grid: { color: t.grid, lineWidth: 1 },
          border: { display: false },
          ticks: { ...axisTicks, maxTicksLimit: 5, callback: (v) => Number(v).toLocaleString('ja-JP') },
        },
      },
      plugins: {
        crosshairColor: t.axis,
        tooltip: {
          backgroundColor: t.surface,
          borderColor: t.grid,
          borderWidth: 1,
          titleColor: t.secondary,
          bodyColor: t.text,
          titleFont: { size: 12, weight: 'normal' },
          bodyFont: { size: 13, weight: 'bold' },
          padding: 10,
          caretSize: 0,
          usePointStyle: true,
          boxWidth: 12,
          boxHeight: 2,
          callbacks: {
            title: (items: TooltipItem<'line' | 'bar'>[]) => {
              const p = spec.points[items[0].dataIndex];
              return p ? p.date.replaceAll('-', '/') : '';
            },
            label: (item: TooltipItem<'line' | 'bar'>) => (item.raw as { y: number | null }).y == null ? `- ${item.dataset.label}` : `${fmt((item.raw as { y: number }).y, spec.unit)}  ${item.dataset.label}`,
            labelPointStyle: () => ({ pointStyle: 'line', rotation: 0 }),
            labelColor: (item: TooltipItem<'line' | 'bar'>) => {
              const color = t.series[item.datasetIndex] ?? t.series[0];
              return { borderColor: color, backgroundColor: color, borderWidth: 3 };
            },
          },
        },
      } as never,
    },
    plugins: isLine ? [crosshair, endLabels(spec, t.secondary)] : [],
  } as ChartConfiguration;
}

/** キーボード(←→)でも各データ点のツールチップを確認できるようにする */
function bindKeyboard(canvas: HTMLCanvasElement, getChart: () => Chart, count: number) {
  let index = -1;
  canvas.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(e.key)) return;
    e.preventDefault();
    const chart = getChart();
    if (e.key === 'Escape') index = -1;
    else if (e.key === 'Home') index = 0;
    else if (e.key === 'End') index = count - 1;
    else index = Math.min(count - 1, Math.max(0, index + (e.key === 'ArrowRight' ? 1 : -1)));
    const active = index < 0 ? [] : chart.data.datasets.map((_, datasetIndex) => ({ datasetIndex, index }));
    const el = active[0] && chart.getDatasetMeta(0).data[index];
    chart.tooltip?.setActiveElements(active, el ? { x: el.x, y: el.y } : { x: 0, y: 0 });
    chart.setActiveElements(active);
    chart.update();
  });
  canvas.addEventListener('blur', () => {
    index = -1;
    const chart = getChart();
    chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
    chart.setActiveElements([]);
    chart.update();
  });
}

function measureEndLabels(spec: ChartSpec): number {
  if (spec.kind !== 'line') return 4;
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = '600 12px system-ui, sans-serif';
  const widths = spec.series.map((s, i) => {
    const last = [...spec.points].reverse().find((p) => p.values[i] != null)?.values[i];
    if (last == null) return 0;
    return ctx.measureText(spec.series.length > 1 ? `${s.label} ${fmt(last, spec.unit)}` : fmt(last, spec.unit)).width;
  });
  return Math.ceil(Math.max(0, ...widths)) + 14;
}

export function renderCharts(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLElement>('[data-chart-spec]')) {
    const canvas = el.querySelector('canvas')!;
    const spec = JSON.parse(el.dataset.chartSpec!) as ChartSpec;
    const endLabelWidth = measureEndLabels(spec);
    let chart = new Chart(canvas, config(spec, tokens(el), endLabelWidth));
    bindKeyboard(canvas, () => chart, spec.points.length);
    // OSのダーク/ライト切り替えに合わせて、そのモード用の色で描き直す
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      chart.destroy();
      chart = new Chart(canvas, config(spec, tokens(el), endLabelWidth));
    });
  }
}
