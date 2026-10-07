-- ============================================================
-- 就活ノート 初期スキーマ
--
-- 設計方針
--   * すべての行は user_id を持ち、主キーは (user_id, id)。
--     子テーブルの外部キーも (user_id, 親id) の複合キーにすることで、
--     「他人の企業に自分の選考をぶら下げる」ことを DB レベルで不可能にする。
--   * 行レベルセキュリティ (RLS) で user_id = auth.uid() の行だけを読み書き可能にする。
--   * 同期用メタデータ: version（楽観的ロック）/ updated_at（差分取得）/
--     updated_by（更新した端末）/ deleted（削除を他端末へ伝える論理削除）。
--     version と updated_at はトリガーでサーバーが決める（端末の時計は信用しない）。
--   * id はクライアント側で生成する（オフライン中でも行を作れるように）。
-- ============================================================

-- ─── 共通トリガー ───────────────────────────────────

create or replace function public.set_sync_meta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
  else
    if new.user_id <> old.user_id or new.id <> old.id then
      raise exception 'user_id / id cannot be changed';
    end if;
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ─── テーブル ─────────────────────────────────────

-- ユーザー設定（内定比較の重視度など）。id = user_id の1行だけ
create table public.user_settings (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  weights    jsonb not null default '{}'::jsonb,
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted    boolean not null default false,
  primary key (user_id, id),
  check (id = user_id::text)
);

create table public.companies (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null check (char_length(id) between 1 and 64),
  name       text not null check (char_length(name) between 1 and 200),
  job_type   text not null default '' check (char_length(job_type) <= 200),
  industry   text not null default '' check (char_length(industry) <= 100),
  mypage_url text not null default '' check (char_length(mypage_url) <= 2000),
  status     text not null default 'active' check (status in ('active', 'offer', 'declined', 'rejected')),
  avg_salary text not null default '' check (char_length(avg_salary) <= 200),
  employees  text not null default '' check (char_length(employees) <= 200),
  location   text not null default '' check (char_length(location) <= 500),
  founded    text not null default '' check (char_length(founded) <= 100),
  benefits   text not null default '' check (char_length(benefits) <= 5000),
  business   text not null default '' check (char_length(business) <= 5000),
  notes      text not null default '' check (char_length(notes) <= 10000),
  concerns   text not null default '' check (char_length(concerns) <= 10000),
  -- 意思決定メモ（Company と 1:1 で常に一緒に編集されるので同じ行に持つ）
  decision_reason      text check (char_length(decision_reason) <= 5000),
  decision_hesitation  text check (char_length(decision_hesitation) <= 5000),
  decision_expectation text check (char_length(decision_expectation) <= 5000),
  created_at timestamptz default now(),
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted    boolean not null default false,
  primary key (user_id, id)
);

-- 自分視点の企業評価（1〜5）。id = company_id の 1:1
create table public.company_evaluations (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  company_id text not null,
  work       smallint check (work between 1 and 5),
  salary     smallint check (salary between 1 and 5),
  benefits   smallint check (benefits between 1 and 5),
  culture    smallint check (culture between 1 and 5),
  growth     smallint check (growth between 1 and 5),
  location   smallint check (location between 1 and 5),
  wlb        smallint check (wlb between 1 and 5),
  motivation smallint check (motivation between 1 and 5),
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted    boolean not null default false,
  primary key (user_id, id),
  check (id = company_id),
  foreign key (user_id, company_id) references public.companies (user_id, id) on delete cascade
);

-- 志望度の推移（0〜100%）。1企業1日1件にしたいので id は「企業id:日付」で決定的に作る
create table public.motivation_records (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null check (char_length(id) between 1 and 100),
  company_id text not null,
  date       date not null,
  value      smallint not null check (value between 0 and 100),
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted    boolean not null default false,
  primary key (user_id, id),
  foreign key (user_id, company_id) references public.companies (user_id, id) on delete cascade
);

-- 選考ステップ（ES・面接など）
create table public.selections (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null check (char_length(id) between 1 and 64),
  company_id text not null,
  position   integer not null default 0,
  name       text not null check (char_length(name) between 1 and 200),
  kind       text check (kind in ('ES', 'Webテスト', '1次面接', '2次面接', '3次面接', '最終面接', 'GD', '説明会', 'インターン', 'その他')),
  date       date,
  time       text check (time ~ '^\d{2}:\d{2}$'),
  online     boolean,
  location   text check (char_length(location) <= 500),
  deadline   date,
  status     text not null default 'pending' check (status in ('pending', 'done', 'passed', 'failed', 'declined')),
  memo       text check (char_length(memo) <= 10000),
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted    boolean not null default false,
  primary key (user_id, id),
  foreign key (user_id, company_id) references public.companies (user_id, id) on delete cascade
);

-- 選考の振り返り。id = selection_id の 1:1
create table public.selection_reviews (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  selection_id text not null,
  result     text not null default 'pending' check (result in ('pending', 'passed', 'failed', 'declined')),
  date       date,
  time       text check (time ~ '^\d{2}:\d{2}$'),
  format     text not null default '' check (format in ('', '対面', 'オンライン', '電話')),
  interviewer_count  smallint not null default 0 check (interviewer_count between 0 and 99),
  answer_notes       text not null default '' check (char_length(answer_notes) <= 20000),
  good_points        text not null default '' check (char_length(good_points) <= 10000),
  stuck_points       text not null default '' check (char_length(stuck_points) <= 10000),
  positive_reactions text not null default '' check (char_length(positive_reactions) <= 10000),
  improvements       text not null default '' check (char_length(improvements) <= 10000),
  ratings    jsonb not null default '{}'::jsonb check (jsonb_typeof(ratings) = 'object'),
  reviewed_at timestamptz,
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted    boolean not null default false,
  primary key (user_id, id),
  check (id = selection_id),
  foreign key (user_id, selection_id) references public.selections (user_id, id) on delete cascade
);

-- 面接で聞かれた質問
create table public.interview_questions (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null check (char_length(id) between 1 and 64),
  selection_id text not null,
  position   integer not null default 0,
  text       text not null check (char_length(text) between 1 and 1000),
  answer     text not null default '' check (char_length(answer) <= 10000),
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted    boolean not null default false,
  primary key (user_id, id),
  foreign key (user_id, selection_id) references public.selections (user_id, id) on delete cascade
);

-- 選考ごとの準備タスク
create table public.tasks (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null check (char_length(id) between 1 and 64),
  selection_id text not null,
  position   integer not null default 0,
  text       text not null check (char_length(text) between 1 and 500),
  done       boolean not null default false,
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted    boolean not null default false,
  primary key (user_id, id),
  foreign key (user_id, selection_id) references public.selections (user_id, id) on delete cascade
);

-- ─── トリガー・インデックス・RLS（全テーブル共通） ─────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'user_settings', 'companies', 'company_evaluations', 'motivation_records',
    'selections', 'selection_reviews', 'interview_questions', 'tasks'
  ] loop
    execute format(
      'create trigger set_sync_meta before insert or update on public.%I
         for each row execute function public.set_sync_meta()', t);

    -- 差分取得（updated_at > 前回同期時刻）用
    execute format('create index %I on public.%I (user_id, updated_at)', t || '_sync_idx', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    -- (select auth.uid()) と書くと行ごとではなくクエリごとに1回だけ評価される
    execute format(
      'create policy "own rows: select" on public.%I for select to authenticated
         using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows: insert" on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows: update" on public.%I for update to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows: delete" on public.%I for delete to authenticated
         using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- 子テーブルの外部キー検索用
create index selections_company_idx on public.selections (user_id, company_id);
create index motivation_records_company_idx on public.motivation_records (user_id, company_id);
create index interview_questions_selection_idx on public.interview_questions (user_id, selection_id);
create index tasks_selection_idx on public.tasks (user_id, selection_id);

-- ─── Realtime（他端末の変更をすぐ受け取る） ─────────────
-- RLS が適用されるので、自分の行の変更だけが届く

alter publication supabase_realtime add table
  public.user_settings, public.companies, public.company_evaluations, public.motivation_records,
  public.selections, public.selection_reviews, public.interview_questions, public.tasks;

-- ─── アカウント削除（App Store 審査要件） ──────────────
-- auth.users を消すと on delete cascade で全データが消える

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
