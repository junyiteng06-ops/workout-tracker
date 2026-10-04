import type { BodyPart } from '@/lib/database.types';

export const BODY_PARTS: Record<BodyPart, string> = {
  chest: '胸',
  back: '背中',
  shoulders: '肩',
  arms: '腕',
  legs: '脚',
  core: '体幹',
  other: 'その他',
};

export interface SetWithExercise {
  set_no: number;
  weight: number;
  reps: number;
  exercise_id: number;
  exercises: { name: string } | null;
}

export interface ExerciseGroup {
  exerciseId: number;
  name: string;
  sets: { weight: number; reps: number }[];
}

/** 連続する同じ種目のセットを1グループにまとめる(入力した順番を保つ) */
export function groupSets(sets: SetWithExercise[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  for (const s of [...sets].sort((a, b) => a.set_no - b.set_no)) {
    const last = groups.at(-1);
    if (last && last.exerciseId === s.exercise_id) {
      last.sets.push({ weight: s.weight, reps: s.reps });
    } else {
      groups.push({ exerciseId: s.exercise_id, name: s.exercises?.name ?? '(削除された種目)', sets: [{ weight: s.weight, reps: s.reps }] });
    }
  }
  return groups;
}

export function formatWeight(weight: number): string {
  return `${Number(weight)}kg`;
}

/** 総ボリューム(重量×回数の合計) */
export function totalVolume(sets: { weight: number; reps: number }[]): number {
  return sets.reduce((sum, s) => sum + Number(s.weight) * s.reps, 0);
}

export function formatDateJa(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}/${m}/${d}(${wd})`;
}

export const WORKOUT_SELECT = 'id, performed_on, note, workout_sets(set_no, weight, reps, exercise_id, exercises(name))' as const;
