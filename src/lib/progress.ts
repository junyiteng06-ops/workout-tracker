import { estimate1RM, MAX_REPS_FOR_ESTIMATE } from '@/lib/oneRepMax';
import type { Supabase } from '@/lib/supabase';

export interface SessionPoint {
  date: string;
  maxWeight: number;
  /** 1〜12回のセットが無い日は null */
  e1rm: number | null;
  volume: number;
  sets: number;
}

export const RANGES = {
  '3m': { label: '3か月', months: 3 },
  '6m': { label: '6か月', months: 6 },
  '1y': { label: '1年', months: 12 },
  all: { label: '全期間', months: null },
} as const;

export type RangeKey = keyof typeof RANGES;

export function parseRange(value: string | null): RangeKey {
  return value && value in RANGES ? (value as RangeKey) : '6m';
}

/** 期間の開始日(YYYY-MM-DD)。全期間なら null */
export function rangeStart(range: RangeKey, today: string): string | null {
  const months = RANGES[range].months;
  if (months === null) return null;
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 - months, d));
  return date.toISOString().slice(0, 10);
}

const PAGE = 1000;
const MAX_PAGES = 20;

/** 種目ごとの推移を日付単位で集計する(PostgREST の1回あたり上限を超える場合はページングで取得) */
export async function exerciseProgress(supabase: Supabase, exerciseId: number, from: string | null): Promise<SessionPoint[]> {
  const rows: { weight: number; reps: number; workouts: { performed_on: string } }[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    let query = supabase
      .from('workout_sets')
      .select('weight, reps, workouts!inner(performed_on)')
      .eq('exercise_id', exerciseId)
      .order('id')
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (from) query = query.gte('workouts.performed_on', from);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  const byDate = new Map<string, SessionPoint>();
  for (const { weight, reps, workouts } of rows) {
    const w = Number(weight);
    const date = workouts.performed_on;
    const point = byDate.get(date) ?? { date, maxWeight: 0, e1rm: null, volume: 0, sets: 0 };
    point.maxWeight = Math.max(point.maxWeight, w);
    point.volume += w * reps;
    point.sets += 1;
    if (w > 0 && reps >= 1 && reps <= MAX_REPS_FOR_ESTIMATE) {
      const e = estimate1RM(w, reps);
      point.e1rm = point.e1rm === null ? e : Math.max(point.e1rm, e);
    }
    byDate.set(date, point);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** 記録したことのある種目(最近記録した順) */
export async function loggedExercises(supabase: Supabase) {
  const { data, error } = await supabase
    .from('workout_sets')
    .select('exercise_id, exercises(name)')
    .order('id', { ascending: false })
    .limit(PAGE);
  if (error) throw error;
  const seen = new Map<number, string>();
  for (const row of data) {
    if (!seen.has(row.exercise_id)) seen.set(row.exercise_id, row.exercises?.name ?? '(削除された種目)');
  }
  return [...seen].map(([id, name]) => ({ id, name }));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
