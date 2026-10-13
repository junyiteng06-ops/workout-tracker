import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/** 入力が止まってから自動保存するまでの待ち時間 */
const AUTOSAVE_DELAY_MS = 1000;

export interface Exercise {
  id: number;
  name: string;
  body_part: BodyPart;
}

interface SetRow {
  key: number;
  weight: string;
  reps: string;
  /** 前回の値。入力欄にグレーで表示するだけで、保存はされない */
  hint?: { weight: number; reps: number };
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

interface Payload {
  performed_on: string;
  note: string;
  sets: { exercise_id: number; weight: number; reps: number }[];
}

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const NEW_EXERCISE = '__new';
let nextKey = 1;
const key = () => nextKey++;
const emptySet = (): SetRow => ({ key: key(), weight: '', reps: '' });
const emptyBlock = (): Block => ({ key: key(), exerciseId: null, sets: [emptySet()] });

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new Error('通信できませんでした。電波の良い場所で「再試行」を押してください');
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
    throw new Error('ログインが必要です');
  }
  if (!res.ok) throw new Error(body.error ?? 'エラーが発生しました');
  return body as T;
}

const validWeight = (s: string) => s !== '' && Number.isFinite(Number(s)) && Number(s) >= 0 && Number(s) < 1000;
const validReps = (s: string) => s !== '' && Number.isInteger(Number(s)) && Number(s) >= 0 && Number(s) <= 999;

/** 自動保存の対象: 種目が選ばれていて、重量と回数の両方が正しく入っているセットだけ */
function completeSets(blocks: Block[]): Payload['sets'] {
  return blocks.flatMap((b) =>
    b.exerciseId === null
      ? []
      : b.sets
          .filter((s) => validWeight(s.weight) && validReps(s.reps))
          .map((s) => ({ exercise_id: b.exerciseId!, weight: Number(s.weight), reps: Number(s.reps) })),
  );
}

/** 「完了」を押したときに、保存されずに残っている入力があれば理由を返す */
function unsavedProblem(blocks: Block[]): string | null {
  for (const [i, b] of blocks.entries()) {
    const touched = b.sets.filter((s) => s.weight !== '' || s.reps !== '');
    if (touched.length === 0) continue;
    if (b.exerciseId === null) return `${i + 1}つ目の種目を選択してください`;
    for (const s of touched) {
      if (!validWeight(s.weight)) return '重量は0〜999.99kgの範囲で入力してください(自重の場合は0)';
      if (!validReps(s.reps)) return '回数は0〜999の整数で入力してください';
    }
  }
  return null;
}

const timeLabel = (d: Date) => d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

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
  const [workoutId, setWorkoutId] = useState<number | null>(initial?.id ?? null);
  const [status, setStatus] = useState<SaveStatus>(initial ? 'saved' : 'idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [leaving, setLeaving] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const payload = useMemo<Payload | null>(() => {
    const sets = completeSets(blocks);
    return sets.length > 0 ? { performed_on: date, note, sets } : null;
  }, [blocks, date, note]);
  const payloadKey = payload ? JSON.stringify(payload) : '';

  // 非同期の保存処理から最新の値を参照するための ref
  const idRef = useRef<number | null>(initial?.id ?? null);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const savedKeyRef = useRef(payloadKey);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  /** 最新の入力内容を保存する。保存中に変更があれば、終わったあとにもう一度保存する */
  const save = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) {
      await inFlightRef.current.catch(() => {});
      return save();
    }
    const current = payloadRef.current;
    const currentKey = current ? JSON.stringify(current) : '';
    if (!current || currentKey === savedKeyRef.current) return;

    setStatus('saving');
    const task = (async () => {
      const id = idRef.current;
      const res = await request<{ id: number }>(id ? `/api/workouts/${id}` : '/api/workouts', {
        method: id ? 'PUT' : 'POST',
        body: currentKey,
      });
      if (!id) {
        idRef.current = res.id;
        setWorkoutId(res.id);
        // 再読み込みしても同じ記録を編集できるよう、URLを編集画面に切り替える
        history.replaceState(null, '', `/app/log/${res.id}`);
      }
      savedKeyRef.current = currentKey;
    })();
    inFlightRef.current = task;
    try {
      await task;
      setError('');
      setSavedAt(new Date());
      const latest = payloadRef.current ? JSON.stringify(payloadRef.current) : '';
      setStatus(latest && latest !== savedKeyRef.current ? 'pending' : 'saved');
    } catch (err) {
      setStatus('error');
      setError(`自動保存できませんでした: ${(err as Error).message}`);
      throw err;
    } finally {
      inFlightRef.current = null;
    }
  }, []);

  // 入力が止まって少ししたら自動保存
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!payloadKey || payloadKey === savedKeyRef.current) {
      setStatus((s) => (s === 'pending' ? (idRef.current ? 'saved' : 'idle') : s));
      return;
    }
    setStatus((s) => (s === 'saving' ? s : 'pending'));
    timerRef.current = setTimeout(() => void save().catch(() => {}), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [payloadKey, save]);

  // アプリを切り替えたときはすぐ保存し、ページを閉じるときは閉じたあとも届く方法で送る
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      clearTimeout(timerRef.current);
      void save().catch(() => {});
    };
    const onPageHide = (e: PageTransitionEvent) => {
      // bfcache で戻ってくる可能性がある場合は通常の保存(新規作成の二重登録を防ぐ)
      if (e.persisted) return onVisibility();
      const current = payloadRef.current;
      const currentKey = current ? JSON.stringify(current) : '';
      if (!current || currentKey === savedKeyRef.current || inFlightRef.current) return;
      const id = idRef.current;
      void fetch(id ? `/api/workouts/${id}` : '/api/workouts', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: currentKey,
        keepalive: true,
      });
      savedKeyRef.current = currentKey;
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [save]);

  async function loadLast(blockKey: number, exerciseId: number) {
    try {
      const params = new URLSearchParams({ exercise_id: String(exerciseId) });
      if (idRef.current) params.set('exclude', String(idRef.current));
      const { last } = await request<{ last: LastRecord | null }>(`/api/last-sets?${params}`);
      updateBlock(blockKey, (b) => {
        if (b.exerciseId !== exerciseId) return b;
        const untouched = b.sets.every((s) => s.weight === '' && s.reps === '');
        // 未入力なら前回のセット数だけ行を用意し、前回の値をヒントとして表示する(保存はしない)
        const sets = untouched && last ? last.sets.map((s) => ({ ...emptySet(), hint: s })) : b.sets;
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
    updateBlock(blockKey, (b) => ({
      ...b,
      exerciseId,
      last: undefined,
      adding: false,
      sets: b.sets.map(({ hint: _, ...s }) => s),
    }));
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

  /** 前回の値をまとめて入力する(ユーザーが明示的に押したときだけ) */
  function fillFromLast(blockKey: number) {
    updateBlock(blockKey, (b) => {
      if (!b.last) return b;
      const filled = b.last.sets.map((s) => ({ key: key(), weight: String(s.weight), reps: String(s.reps) }));
      const rest = b.sets.filter((s) => s.weight !== '' || s.reps !== '');
      return { ...b, sets: rest.length > 0 ? [...rest, ...filled] : filled };
    });
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

  async function onFinish(e: { preventDefault(): void }) {
    e.preventDefault();
    const problem = unsavedProblem(blocks);
    if (problem) {
      showError(problem);
      return;
    }
    if (!payload) {
      showError(
        idRef.current
          ? 'セットが1つもないため保存できません。この記録を消す場合は「この記録を削除」を押してください'
          : '重量と回数を1セット以上入力してください',
      );
      return;
    }
    clearTimeout(timerRef.current);
    setLeaving(true);
    try {
      await save();
      location.href = '/app/history?saved=1';
    } catch {
      setLeaving(false);
    }
  }

  async function onDelete() {
    if (!idRef.current || !confirm('このトレーニングの記録を削除します。よろしいですか?')) return;
    clearTimeout(timerRef.current);
    setLeaving(true);
    try {
      await inFlightRef.current?.catch(() => {});
      await request(`/api/workouts/${idRef.current}`, { method: 'DELETE' });
      savedKeyRef.current = payloadKey;
      location.href = '/app/history?deleted=1';
    } catch (err) {
      showError((err as Error).message);
      setLeaving(false);
    }
  }

  const statusText: Record<SaveStatus, string> = {
    idle: '重量と回数を入力すると自動で保存されます',
    pending: '変更を保存します…',
    saving: '保存中…',
    saved: savedAt ? `✓ 自動保存しました(${timeLabel(savedAt)})` : '✓ 保存済み',
    error: '保存できませんでした',
  };

  return (
    <form className="wf" onSubmit={onFinish} noValidate>
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
            <div className="wf-last">
              <span>
                前回({block.last.performed_on.slice(5).replace('-', '/')}):{' '}
                {block.last.sets.map((s) => `${Number(s.weight)}kg×${s.reps}`).join(' / ')}
              </span>
              <button type="button" className="wf-last__fill" onClick={() => fillFromLast(block.key)}>
                前回と同じ値を入れる
              </button>
            </div>
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
                  placeholder={set.hint ? String(set.hint.weight) : undefined}
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
                  placeholder={set.hint ? String(set.hint.reps) : undefined}
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

      {workoutId && (
        <button type="button" className="btn btn--danger" onClick={onDelete} disabled={leaving}>
          この記録を削除
        </button>
      )}

      <div className="wf-bar">
        <p className={`wf-status wf-status--${status}`} role="status" aria-live="polite">
          {workoutId && !payloadKey ? 'セットが空のため、変更は保存されていません' : statusText[status]}
          {status === 'error' && (
            <button type="button" className="wf-status__retry" onClick={() => void save().catch(() => {})}>
              再試行
            </button>
          )}
        </p>
        <button type="submit" className="btn wf-done" disabled={leaving}>
          {leaving ? '保存中…' : '完了'}
        </button>
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
