import type { APIRoute } from 'astro';
import { json } from '@/lib/http';
import { exerciseInput, firstIssue } from '@/lib/validation';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const parsed = exerciseInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: firstIssue(parsed.error) }, 400);

  const { data, error } = await locals.supabase
    .from('exercises')
    .insert({ ...parsed.data, user_id: locals.user!.id })
    .select('id, name, body_part')
    .single();
  if (error) {
    if (error.code === '23505') return json({ error: '同じ名前の種目がすでにあります' }, 409);
    return json({ error: '種目の追加に失敗しました' }, 500);
  }
  return json(data, 201);
};
