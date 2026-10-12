import type { APIRoute } from 'astro';
import { json } from '@/lib/http';
import { parseId, saveWorkout } from '@/lib/workoutApi';

export const prerender = false;

export const PUT: APIRoute = ({ params, request, locals }) => {
  const id = parseId(params.id);
  if (!id) return json({ error: 'トレーニングが見つかりません' }, 404);
  return saveWorkout(request, locals.supabase, id);
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const id = parseId(params.id);
  if (!id) return json({ error: 'トレーニングが見つかりません' }, 404);
  const { data, error } = await locals.supabase.from('workouts').delete().eq('id', id).select('id');
  if (error) return json({ error: '削除に失敗しました' }, 500);
  if (data.length === 0) return json({ error: 'トレーニングが見つかりません' }, 404);
  return json({ ok: true });
};
