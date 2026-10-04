import type { Supabase } from '@/lib/supabase';
import { json } from '@/lib/http';
import { firstIssue, workoutInput } from '@/lib/validation';

/** 新規作成(workoutId = null)と更新の共通処理 */
export async function saveWorkout(request: Request, supabase: Supabase, workoutId: number | null): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = workoutInput.safeParse(body);
  if (!parsed.success) return json({ error: firstIssue(parsed.error) }, 400);

  const { performed_on, note, sets } = parsed.data;
  const { data, error } = await supabase.rpc('save_workout', {
    p_workout_id: workoutId,
    p_performed_on: performed_on,
    p_note: note,
    p_sets: sets,
  });
  if (error) {
    if (error.code === 'P0002') return json({ error: 'トレーニングが見つかりません' }, 404);
    // RLS 違反(他人の種目を指定した等)や制約違反
    if (error.code === '42501' || error.code?.startsWith('23')) return json({ error: '入力内容が正しくありません' }, 400);
    return json({ error: '保存に失敗しました。時間をおいてもう一度お試しください。' }, 500);
  }
  return json({ id: data });
}

export function parseId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
