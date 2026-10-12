import type { Supabase } from '@/lib/supabase';

/** プリセット(登録順)→ 自分で追加した種目の順に返す */
export async function listExercises(supabase: Supabase) {
  return supabase
    .from('exercises')
    .select('id, name, body_part')
    .order('user_id', { ascending: true, nullsFirst: true })
    .order('id');
}
