import { z } from 'astro/zod';

export const workoutInput = z.object({
  performed_on: z.iso.date(),
  note: z.string().max(1000).default(''),
  sets: z
    .array(
      z.object({
        exercise_id: z.number().int().positive(),
        weight: z.number().min(0).max(999.99),
        reps: z.number().int().min(0).max(999),
      }),
    )
    .min(1, 'セットを1つ以上入力してください')
    .max(200),
});

export type WorkoutInput = z.infer<typeof workoutInput>;

export const exerciseInput = z.object({
  name: z.string().trim().min(1, '種目名を入力してください').max(40, '種目名は40文字以内で入力してください'),
  body_part: z.enum(['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'other']),
});

export const bodyMetricInput = z
  .object({
    measured_on: z.iso.date(),
    weight: z.number().gt(0).lt(500).nullable(),
    body_fat: z.number().min(0).lt(100).nullable(),
  })
  .refine((v) => v.weight !== null || v.body_fat !== null, '体重か体脂肪率のどちらかを入力してください');

/** フォームの数値欄: 空欄は null、数値でなければ NaN(zod で弾く) */
export function optionalNumber(value: string): number | null {
  return value === '' ? null : Number(value);
}

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? '入力内容を確認してください';
}
