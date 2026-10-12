-- IRON LOG 初期スキーマ
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行する(1回だけ)

-- 種目(user_id が NULL のものは全員共通のプリセット)
create table public.exercises (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  body_part text not null default 'other'
    check (body_part in ('chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'other')),
  created_at timestamptz not null default now(),
  unique nulls not distinct (user_id, name)
);

-- トレーニング(1日1回とは限らないので日付はユニークにしない)
create table public.workouts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  performed_on date not null,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workouts_user_date_idx on public.workouts (user_id, performed_on desc, id desc);

-- セット(user_id は種目別の推移グラフを速く引くために冗長に持つ)
create table public.workout_sets (
  id bigint generated always as identity primary key,
  workout_id bigint not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  exercise_id bigint not null references public.exercises (id) on delete restrict,
  set_no smallint not null check (set_no between 1 and 200),
  weight numeric(6, 2) not null check (weight >= 0 and weight < 1000),
  reps smallint not null check (reps between 0 and 999),
  unique (workout_id, set_no)
);
create index workout_sets_workout_idx on public.workout_sets (workout_id);
create index workout_sets_user_exercise_idx on public.workout_sets (user_id, exercise_id);
create index workout_sets_exercise_idx on public.workout_sets (exercise_id);

-- 体重・体脂肪率(1日1件)
create table public.body_metrics (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  measured_on date not null,
  weight numeric(5, 2) check (weight > 0 and weight < 500),
  body_fat numeric(4, 1) check (body_fat >= 0 and body_fat < 100),
  created_at timestamptz not null default now(),
  unique (user_id, measured_on),
  check (weight is not null or body_fat is not null)
);

-- ===== Row Level Security: 自分のデータだけ読み書きできる =====
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.body_metrics enable row level security;

create policy "exercises: read presets and own" on public.exercises
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "exercises: insert own" on public.exercises
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "exercises: update own" on public.exercises
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "exercises: delete own" on public.exercises
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "workouts: own" on public.workouts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "workout_sets: read own" on public.workout_sets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "workout_sets: delete own" on public.workout_sets
  for delete to authenticated using (user_id = (select auth.uid()));
-- 他人のトレーニングや他人のカスタム種目にセットを紐づけられないようにする
create policy "workout_sets: insert own" on public.workout_sets
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.user_id is null or e.user_id = (select auth.uid()))
    )
  );

create policy "body_metrics: own" on public.body_metrics
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ===== Data API への公開(ログインユーザーのみ。未ログインの anon には何も公開しない) =====
grant select, insert, update, delete on public.exercises to authenticated;
grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, delete on public.workout_sets to authenticated;
grant select, insert, update, delete on public.body_metrics to authenticated;

-- ===== トレーニングと全セットを1トランザクションで保存する =====
-- p_workout_id が NULL なら新規作成、指定があれば更新(セットは全件入れ替え)
create function public.save_workout(
  p_workout_id bigint,
  p_performed_on date,
  p_note text,
  p_sets jsonb
) returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) = 0 then
    raise exception 'sets must be a non-empty array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_sets) > 200 then
    raise exception 'too many sets' using errcode = '22023';
  end if;

  if p_workout_id is null then
    insert into public.workouts (performed_on, note)
    values (p_performed_on, nullif(btrim(p_note), ''))
    returning id into v_id;
  else
    update public.workouts
    set performed_on = p_performed_on, note = nullif(btrim(p_note), ''), updated_at = now()
    where id = p_workout_id
    returning id into v_id;
    if v_id is null then
      raise exception 'workout not found' using errcode = 'P0002';
    end if;
    delete from public.workout_sets where workout_id = v_id;
  end if;

  insert into public.workout_sets (workout_id, exercise_id, set_no, weight, reps)
  select v_id, (s.item ->> 'exercise_id')::bigint, s.ord, (s.item ->> 'weight')::numeric, (s.item ->> 'reps')::smallint
  from jsonb_array_elements(p_sets) with ordinality as s(item, ord);

  return v_id;
end;
$$;

revoke execute on function public.save_workout(bigint, date, text, jsonb) from public, anon;
grant execute on function public.save_workout(bigint, date, text, jsonb) to authenticated;

-- ===== プリセット種目 =====
insert into public.exercises (user_id, name, body_part) values
  (null, 'ベンチプレス', 'chest'),
  (null, 'インクラインベンチプレス', 'chest'),
  (null, 'ダンベルプレス', 'chest'),
  (null, 'インクラインダンベルプレス', 'chest'),
  (null, 'ダンベルフライ', 'chest'),
  (null, 'チェストプレス', 'chest'),
  (null, 'ディップス', 'chest'),
  (null, '腕立て伏せ', 'chest'),
  (null, 'デッドリフト', 'back'),
  (null, '懸垂(チンニング)', 'back'),
  (null, 'ラットプルダウン', 'back'),
  (null, 'ベントオーバーロウ', 'back'),
  (null, 'ワンハンドロウ', 'back'),
  (null, 'シーテッドロウ', 'back'),
  (null, 'ショルダープレス', 'shoulders'),
  (null, 'ダンベルショルダープレス', 'shoulders'),
  (null, 'サイドレイズ', 'shoulders'),
  (null, 'リアレイズ', 'shoulders'),
  (null, 'アップライトロウ', 'shoulders'),
  (null, 'バーベルカール', 'arms'),
  (null, 'ダンベルカール', 'arms'),
  (null, 'ハンマーカール', 'arms'),
  (null, 'トライセプスエクステンション', 'arms'),
  (null, 'ケーブルプッシュダウン', 'arms'),
  (null, 'ナローベンチプレス', 'arms'),
  (null, 'スクワット', 'legs'),
  (null, 'フロントスクワット', 'legs'),
  (null, 'ブルガリアンスクワット', 'legs'),
  (null, 'レッグプレス', 'legs'),
  (null, 'ルーマニアンデッドリフト', 'legs'),
  (null, 'レッグエクステンション', 'legs'),
  (null, 'レッグカール', 'legs'),
  (null, 'カーフレイズ', 'legs'),
  (null, 'ヒップスラスト', 'legs'),
  (null, 'クランチ', 'core'),
  (null, 'レッグレイズ', 'core'),
  (null, 'アブローラー', 'core');
