import type { APIRoute } from 'astro';
import { saveWorkout } from '@/lib/workoutApi';

export const prerender = false;

export const POST: APIRoute = ({ request, locals }) => saveWorkout(request, locals.supabase, null);
