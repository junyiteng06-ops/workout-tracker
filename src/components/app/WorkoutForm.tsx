import { useMemo, useRef, useState } from 'react';
import type { BodyPart } from '@/lib/database.types';

const BODY_PART_LABELS: Record<BodyPart, string> = {
  chest: '胸',
  back: '背中',
  shoulders: '肩',
  arms: '腕',
  legs: '脚',
  core: '体幹',
  other: 'その他',
};

export interface Exercise {
  id: number;
  name: string;
  body_part: BodyPart;
}

interface SetRow {
  key: number;
  weight: string;
  reps: string;
}

interface LastRecord {
  performed_on: string;
  sets: { weight: number; reps: number }[];
}

interface Block {
  key: number;
  exerciseId: number | null;
  sets: SetRow[];
  last?: LastRecord | null;
  adding?: boolean;
}

interface Props {
  exercises: Exercise[];
  today: string;
  initial?: {
    id: number;
    performed_on: string;
    note: string | null;
    blocks: { exerciseId: number; sets: { weight: number; reps: number }[] }[];
  };
}

const NEW_EXERCISE = '__new';
let nextKey = 1;
const key = () => nextKey++;
const emptySet = (): SetRow => ({ key: key(), weight: '', reps: '' });
const emptyBlock = (): Block => ({ key: key(), exerciseId: null, sets: [emptySet()] });

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
    throw new Error('ログインが必要です');
  }
  if (!res.ok) throw new Error(body.error ?? 'エラーが発生しました');
  return body as T;
}

export default function WorkoutForm({ exercises: initialExercises, today, initial }: Props) {
  const [exercises, setExercises] = useState(initialExercises);
  const [date, setDate] = useState(initial?.performed_on ?? today);
  const [note, setNote] = useState(initial?.note ?? '');
  const [blocks, setBlocks] = useState<Block[]>(() =>
    initial
      ? initial.blocks.map((b) => ({
          key: key(),
          exerciseId: b.exerciseId,
          sets: b.sets.map((s) => ({ key: key(), weight: String(s.weight), reps: String(s.reps) })),
        }))
      : [emptyBlock()],
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const grouped = useMemo(() => {
    const map = new Map<BodyPart, Exercise[]>();
    for (const e of exercises) map.set(e.body_part, [...(map.get(e.body_part) ?? []), e]);
    return (Object.keys(BODY_PART_LABELS) as BodyPart[]).filter((p) => map.has(p)).map((p) => [p, map.get(p)!] as const);
  }, [exercises]);

  const updateBlock = (blockKey: number, fn: (b: Block) => Block) =>
    setBlocks((prev) => prev.map((b) => (b.key === blockKey ? fn(b) : b)));

  const showError = (message: string) => {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  async function loadLast(blockKey: number, exerciseId: number) {
    try {
      const params = new URLSearchParams({ exercise_id: String(exerciseId) });
      if (initial) params.set('exclude', String(initial.id));
      const { last } = await request<{ last: LastRecord | null }>(`/api/last-sets?${params}`);
      updateBlock(blockKey, (b) => {
        if (b.exerciseId !== exerciseId) return b;
        const untouched = b.sets.every((s) => s.weight === '' && s.reps === '');
        // 未入力なら前回の重量・回数をそのまま入れておく(前回と同じかそれ以上を目指せる)
        const sets = untouched && last ? last.sets.map((s) => ({ key: key(), weight: String(s.weight), reps: String(s.reps) })) : b.sets;
        return { ...b, last, sets };
      });
    } catch {
      updateBlock(blockKey, (b) => ({ ...b, last: null }));
    }
  }

  function selectExercise(blockKey: number, value: string) {
    if (value === NEW_EXERCISE) {
      updateBlock(blockKey, (b) => ({ ...b, adding: true }));
      return;
    }
    const exerciseId = value ? Number(value) : null;
    updateBlock(blockKey, (b) => ({ ...b, exerciseId, last: undefined, adding: false }));
    if (exerciseId) void loadLast(blockKey, exerciseId);
  }

  async function addExercise(blockKey: number, name: string, bodyPart: BodyPart) {
    try {
      const created = await request<Exercise>('/api/exercises', {
        method: 'POST',
        body: JSON.stringify({ name, body_part: bodyPart }),
      });
      setExercises((prev) => [...prev, created]);
      updateBlock(blockKey, (b) => ({ ...b, exerciseId: created.id, adding: false, last: null }));
      setError('');
    } catch (e) {
      showError((e as Error).message);
    }
  }

  function addSet(blockKey: number) {
    updateBlock(blockKey, (b) => {
      const prev = b.sets.at(-1);
      return { ...b, sets: [...b.sets, { key: key(), weight: prev?.weight ?? '', reps: prev?.reps ?? '' }] };
    });
  }

  function updateSet(blockKey: number, setKey: number, field: 'weight' | 'reps', value: string) {
    updateBlock(blockKey, (b) => ({ ...b, sets: b.sets.map((s) => (s.key === setKey ? { ...s, [field]: value } : s)) }));
  }

  function removeSet(blockKey: number, setKey: number) {
    updateBlock(blockKey, (b) => ({ ...b, sets: b.sets.filter((s) => s.key !== setKey) }));
  }

  function buildPayload() {
    const sets: { exercise_id: number; weight: number; reps: number }[] = [];
    for (const [i, b] of blocks.entries()) {
      const filled = b.sets.filter((s) => s.weight !== '' || s.reps !== '');
      if (filled.length === 0) continue;
      if (!b.exerciseId) throw new Error(`${i + 1}つ目の種目を選択してください`);
      for (const s of filled) {
        const weight = Number(s.weight);
        const reps = Number(s.reps);
        if (s.weight === '' || !Number.isFinite(weight) || weight < 0 || weight >= 1000) {
          throw new Error('重量は0〜999.99kgの範囲で入力してください(自重の場合は0)');
        }
        if (s.reps === '' || !Number.isInteger(reps) || reps < 0 || reps > 999) {
          throw new Error('回数は0〜999の整数で入力してください');
        }
        sets.push({ exercise_id: b.exerciseId, weight, reps });
      }
    }
    if (sets.length === 0) throw new Error('重量と回数を1セット以上入力してください');
    return { performed_on: date, note, sets };
  }

  async function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    let payload;
    try {
      payload = buildPayload();
    } catch (err) {
      showError((err as Error).message);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await request(initial ? `/api/workouts/${initial.id}` : '/api/workouts', {
        method: initial ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      location.href = '/app/history?saved=1';
    } catch (err) {
      showError((err as Error).message);
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!initial || !confirm('このトレーニングの記録を削除します。よろしいですか?')) return;
    setSaving(true);
    try {
      await request(`/api/workouts/${initial.id}`, { method: 'DELETE' });
      location.href = '/app/history?deleted=1';
    } catch (err) {
      showError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form className="wf" onSubmit={onSubmit} noValidate>
      {error && (
        <p className="wf-error" role="alert" ref={errorRef}>
          {error}
        </p>
      )}

      <label className="field wf-date">
        日付
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
      </label>

      {blocks.map((block, index) => (
        <fieldset className="wf-block app-card" key={block.key}>
          <legend className="visually-hidden">{index + 1}つ目の種目</legend>
          <div className="wf-block__head">
            <select
              aria-label={`${index + 1}つ目の種目`}
              value={block.adding ? NEW_EXERCISE : (block.exerciseId ?? '')}
              onChange={(e) => selectExercise(block.key, e.target.value)}
            >
              <option value="">種目を選択</option>
              {grouped.map(([part, list]) => (
                <optgroup key={part} label={BODY_PART_LABELS[part]}>
                  {list.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value={NEW_EXERCISE}>＋ 新しい種目を追加</option>
            </select>
            {blocks.length > 1 && (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => setBlocks((prev) => prev.filter((b) => b.key !== block.key))}
                aria-label={`${index + 1}つ目の種目を削除`}
              >
                削除
              </button>
            )}
          </div>

          {block.adding && (
            <NewExerciseForm
              onCancel={() => updateBlock(block.key, (b) => ({ ...b, adding: false }))}
              onSubmit={(name, part) => addExercise(block.key, name, part)}
            />
          )}

          {block.last && (
            <p className="wf-last">
              前回({block.last.performed_on.slice(5).replace('-', '/')}):{' '}
              {block.last.sets.map((s) => `${Number(s.weight)}kg×${s.reps}`).join(' / ')}
            </p>
          )}

          <div className="wf-sets">
            <div className="wf-set wf-set--head" aria-hidden="true">
              <span>セット</span>
              <span>重量(kg)</span>
              <span>回数</span>
              <span />
            </div>
            {block.sets.map((set, i) => (
              <div className="wf-set" key={set.key}>
                <span className="wf-set__no">{i + 1}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.25"
                  min="0"
                  max="999.99"
                  aria-label={`${i + 1}セット目の重量(kg)`}
                  value={set.weight}
                  onChange={(e) => updateSet(block.key, set.key, 'weight', e.target.value)}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="0"
                  max="999"
                  aria-label={`${i + 1}セット目の回数`}
                  value={set.reps}
                  onChange={(e) => updateSet(block.key, set.key, 'reps', e.target.value)}
                />
                <button
                  type="button"
                  className="wf-set__remove"
                  onClick={() => removeSet(block.key, set.key)}
                  disabled={block.sets.length === 1}
                  aria-label={`${i + 1}セット目を削除`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn--ghost btn--small wf-add-set" onClick={() => addSet(block.key)}>
            ＋ セットを追加
          </button>
        </fieldset>
      ))}

      <button type="button" className="btn btn--outline wf-add-block" onClick={() => setBlocks((prev) => [...prev, emptyBlock()])}>
        ＋ 種目を追加
      </button>

      <label className="field">
        メモ(任意)
        <textarea value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="体調、フォームの気づきなど" />
      </label>

      <div className="wf-actions">
        <button type="submit" className="btn wf-save" disabled={saving}>
          {saving ? '保存中…' : '保存する'}
        </button>
        {initial && (
          <button type="button" className="btn btn--danger" onClick={onDelete} disabled={saving}>
            この記録を削除
          </button>
        )}
      </div>
    </form>
  );
}

function NewExerciseForm({ onSubmit, onCancel }: { onSubmit: (name: string, part: BodyPart) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [part, setPart] = useState<BodyPart>('other');
  return (
    <div className="wf-new">
      <input type="text" value={name} maxLength={40} placeholder="種目名(例: ケーブルクロスオーバー)" aria-label="新しい種目名" onChange={(e) => setName(e.target.value)} />
      <select value={part} aria-label="部位" onChange={(e) => setPart(e.target.value as BodyPart)}>
        {(Object.keys(BODY_PART_LABELS) as BodyPart[]).map((p) => (
          <option key={p} value={p}>
            {BODY_PART_LABELS[p]}
          </option>
        ))}
      </select>
      <div className="wf-new__actions">
        <button type="button" className="btn btn--small" disabled={!name.trim()} onClick={() => onSubmit(name.trim(), part)}>
          追加
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </div>
  );
}
