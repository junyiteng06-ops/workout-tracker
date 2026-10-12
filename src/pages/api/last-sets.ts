import type { APIRoute } from 'astro';
import { json } from '@/lib/http';
import { parseId } from '@/lib/workoutApi';

export const prerender = false;

// 指定した種目を最後に行ったトレーニングのセット(「前回の記録」表示用)
export const GET: APIRoute = async ({ url, locals }) => {
  const exerciseId = parseId(url.searchParams.get('exercise_id') ?? undefined);
  if (!exerciseId) return json({ error: 'exercise_id が不正です' }, 400);
  const excludeId = parseId(url.searchParams.get('exclude') ?? undefined);

  let query = locals.supabase
    .from('workouts')
    .select('id, performed_on, workout_sets!inner(set_no, weight, reps, exercise_id)')
    .eq('workout_sets.exercise_id', exerciseId)
    .order('performed_on', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);
  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) return json({ error: '前回の記録を取得できませんでした' }, 500);
  const last = data[0];
  if (!last) return json({ last: null });
  return json({
    last: {
      performed_on: last.performed_on,
      sets: [...last.workout_sets].sort((a, b) => a.set_no - b.set_no).map(({ weight, reps }) => ({ weight, reps })),
    },
  });
};
