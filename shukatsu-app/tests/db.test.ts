/**
 * supabase/migrations の SQL を本物の Postgres（PGlite = WASM 版 Postgres）で実行し、
 * RLS・version トリガー・複合外部キーを検証する。
 * Supabase 固有の auth.uid() / ロール / Realtime の publication は最小限のスタブを用意する。
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

let db: PGlite;

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create publication supabase_realtime;
`;

/** ログイン中のユーザーとしてSQLを実行する（Supabase の PostgREST と同じく authenticated ロール） */
async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ?? '']);
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

before(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(import.meta.dirname, '..', 'supabase', 'migrations');
  for (const f of readdirSync(dir).filter((x: string) => x.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  await db.query('insert into auth.users (id, email) values ($1, $2), ($3, $4)', [A, 'a@example.com', B, 'b@example.com']);
});

test('自分の行は作成・取得できる（user_id は自動で自分になる）', async () => {
  await as(A, `insert into companies (id, name) values ('a-c1', 'A社')`);
  await as(A, `insert into selections (id, company_id, name, date, time) values ('a-s1', 'a-c1', '1次面接', '2026-10-08', '10:00')`);
  await as(A, `insert into selection_reviews (id, selection_id, improvements) values ('a-s1', 'a-s1', '志望理由を具体化')`);
  const rows = await as(A, 'select user_id, id, version from companies');
  assert.deepEqual(rows, [{ user_id: A, id: 'a-c1', version: 1 }]);
});

test('ユーザーBはユーザーAの企業・選考・振り返りを取得できない', async () => {
  for (const t of ['companies', 'selections', 'selection_reviews']) {
    assert.equal((await as(B, `select * from ${t}`)).length, 0, t);
    assert.equal((await as(B, `select * from ${t} where user_id = $1`, [A])).length, 0, t);
  }
});

test('ユーザーBはユーザーAの行を更新・削除できない（0件になる）', async () => {
  await as(B, `update companies set name = '乗っ取り' where id = 'a-c1'`);
  await as(B, `delete from companies where id = 'a-c1'`);
  const [row] = await as<{ name: string }>(A, `select name from companies where id = 'a-c1'`);
  assert.equal(row.name, 'A社');
});

test('ユーザーBは user_id を偽ってユーザーAとして書き込めない', async () => {
  await assert.rejects(
    as(B, `insert into companies (user_id, id, name) values ($1, 'fake', '偽装')`, [A]),
    /row-level security/,
  );
});

test('他人の企業に自分の選考をぶら下げられない（複合外部キー）', async () => {
  await assert.rejects(
    as(B, `insert into selections (id, company_id, name) values ('b-s1', 'a-c1', '1次面接')`),
    /foreign key/,
  );
});

test('未ログイン（anon）はどのテーブルにもアクセスできない', async () => {
  await assert.rejects(as(null, 'select * from companies'), /permission denied/);
});

test('version は更新ごとにサーバーで +1 され、古い version を条件にした更新は0件になる', async () => {
  // 端末が送る version は無視され、サーバーが決める
  await as(A, `update companies set notes = 'v2', version = 999 where id = 'a-c1' and version = 1`);
  const [r1] = await as<{ version: number }>(A, `select version from companies where id = 'a-c1'`);
  assert.equal(r1.version, 2);

  // 楽観的ロック: 古い version (1) を元にした更新は反映されない
  const stale = await as(A, `update companies set notes = '古い' where id = 'a-c1' and version = 1 returning id`);
  assert.equal(stale.length, 0);
  const [r2] = await as<{ notes: string }>(A, `select notes from companies where id = 'a-c1'`);
  assert.equal(r2.notes, 'v2');
});

test('不正な値はDBで拒否される（★は1〜5、志望度は0〜100、時刻はHH:MM）', async () => {
  await assert.rejects(as(A, `insert into company_evaluations (id, company_id, work) values ('a-c1', 'a-c1', 6)`), /check constraint/);
  await assert.rejects(as(A, `insert into motivation_records (id, company_id, date, value) values ('m', 'a-c1', '2026-10-01', 120)`), /check constraint/);
  await assert.rejects(as(A, `insert into selections (id, company_id, name, time) values ('bad', 'a-c1', 'x', '9時')`), /check constraint/);
});

test('アカウント削除で、そのユーザーのデータだけがすべて消える', async () => {
  await as(B, `insert into companies (id, name) values ('b-c1', 'B社')`);
  await as(A, 'select public.delete_my_account()');
  await db.exec('reset role');
  const left = await db.query<{ user_id: string }>('select user_id from companies');
  assert.deepEqual(left.rows.map((r) => r.user_id), [B]);
  assert.equal((await db.query('select * from selections')).rows.length, 0);
  assert.equal((await db.query('select * from selection_reviews')).rows.length, 0);
});
