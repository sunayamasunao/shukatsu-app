/**
 * 同期の判定ロジック（純粋関数）
 *
 * 端末は2種類の行を持つ:
 *   base  … 最後にサーバーから受け取った行（version 付き）
 *   local … 端末での現在の値（null は「この端末で削除した」）
 * local と base の差分が「未送信の変更」になる。
 *
 * 競合時のルール（mergeRemoteRow）
 *   1. 別々の項目を同時に編集 → 両方の変更を残す（自動マージ）
 *   2. 同じ項目を別の値に編集 → 先にサーバーに届いた値を採用し、
 *      この端末の値は Conflict として残してユーザーに選んでもらう
 *   3. 削除と編集がぶつかった → 削除を優先（編集が消えた場合は通知）
 *   4. サーバーより古い version を元にした更新は受け付けない（楽観的ロック）
 *      ので、古いデータが新しいデータを黙って上書きすることはない
 */
import type { RowData, ServerRow, TableName, Tables } from './schema.ts';
import { COLUMNS, TABLES } from './schema.ts';

export type LocalTables = Tables<RowData | null>;

export interface Conflict {
  key: string;
  table: TableName;
  rowId: string;
  /** null = 行ごと削除された通知 */
  field: string | null;
  mine: unknown;
  theirs: unknown;
  detectedAt: string;
  /** 「株式会社A / 1次面接」など（エンジンが付ける） */
  label: string;
  companyId: string | null;
}

export interface PendingChange {
  table: TableName;
  id: string;
  op: 'insert' | 'update' | 'delete';
  data: RowData;
  /** update / delete のとき、どの version を元にした変更か */
  baseVersion: number;
}

/** 並び順などは利用者に聞いても意味がないので、競合を通知せずサーバー側を採用する */
const SILENT_FIELDS = new Set(['position', 'created_at', 'reviewed_at', 'company_id', 'selection_id']);

// ─── 比較 ────────────────────────────────────────

/** undefined と null を同一視し、オブジェクトのキー順を無視して比較 */
export function isEqual(a: unknown, b: unknown): boolean {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => isEqual(v, bb[i]));
  }
  const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) if (!isEqual(ao[k], bo[k])) return false;
  return true;
}

export function rowEquals(table: TableName, a: RowData, b: RowData): boolean {
  return COLUMNS[table].every((c) => isEqual(a[c], b[c]));
}

// ─── 端末での編集 ──────────────────────────────────

/**
 * 画面での編集結果を local に反映する。
 * prev / next は編集前後のアプリデータを行にしたもの。
 * 編集で消えた行は削除（null）、変わった行だけ上書きする。
 * 画面に出ていない行（親が別端末で削除された子など）には触らない。
 */
export function applyLocalEdit(
  local: LocalTables, prev: Tables<RowData>, next: Tables<RowData>, keepTombstones: boolean,
): LocalTables {
  const out = {} as LocalTables;
  for (const t of TABLES) {
    const rows = { ...local[t] };
    for (const id of Object.keys(prev[t])) {
      if (!(id in next[t])) {
        if (keepTombstones) rows[id] = null;
        else delete rows[id];
      }
    }
    for (const [id, data] of Object.entries(next[t])) {
      const cur = rows[id];
      if (!cur || !rowEquals(t, cur, data)) rows[id] = data;
    }
    out[t] = rows;
  }
  return out;
}

// ─── 送信する変更 ──────────────────────────────────

export function pendingChanges(
  local: LocalTables, base: Tables<ServerRow>, skip?: (table: TableName, id: string, data: RowData | null) => boolean,
): PendingChange[] {
  const changes: PendingChange[] = [];
  for (const t of TABLES) {
    for (const [id, data] of Object.entries(local[t])) {
      if (skip?.(t, id, data)) continue;
      const b = base[t][id];
      if (data === null) {
        if (b && !b.deleted) changes.push({ table: t, id, op: 'delete', data: {}, baseVersion: b.version });
      } else if (!b) {
        changes.push({ table: t, id, op: 'insert', data, baseVersion: 0 });
      } else if (!b.deleted && !rowEquals(t, data, b.data)) {
        changes.push({ table: t, id, op: 'update', data, baseVersion: b.version });
      }
    }
  }
  return changes;
}

/** 送信も削除もしなくてよい行（作ってすぐ消した行など）を local から掃除する */
export function dropSettledTombstones(local: LocalTables, base: Tables<ServerRow>): LocalTables {
  const out = {} as LocalTables;
  for (const t of TABLES) {
    const rows: Record<string, RowData | null> = {};
    for (const [id, data] of Object.entries(local[t])) {
      const b = base[t][id];
      if (data === null && (!b || b.deleted)) continue;
      rows[id] = data;
    }
    out[t] = rows;
  }
  return out;
}

// ─── サーバーの行を取り込む ─────────────────────────

export interface MergeResult {
  /** 取り込み後の local の値。undefined = local から消す */
  local: RowData | null | undefined;
  base: ServerRow;
  conflicts: Conflict[];
  changed: boolean;
}

/**
 * サーバーから届いた行を、この端末の行と3方向マージする。
 * 共通の祖先 = base（最後に受け取ったサーバーの行）。
 * base が無い場合（両端末が同じ id の行を同時に作った）は空の行を祖先とみなす。
 */
export function mergeRemoteRow(
  table: TableName,
  remote: ServerRow,
  base: ServerRow | undefined,
  local: RowData | null | undefined,
  now: string,
): MergeResult | null {
  if (base && remote.version <= base.version) return null; // 既に知っている版

  const conflicts: Conflict[] = [];
  const notice = (field: string | null, mine: unknown, theirs: unknown) =>
    conflicts.push({ key: `${table}:${remote.id}:${field ?? '*'}`, table, rowId: remote.id, field, mine, theirs, detectedAt: now, label: '', companyId: null });

  const ancestor: RowData = base && !base.deleted ? base.data : {};
  const dirty = local !== undefined && local !== null && (!base || base.deleted || !rowEquals(table, local, base.data));

  // まだ端末に無い行 → そのまま受け取る
  if (local === undefined) {
    return { local: remote.deleted ? undefined : remote.data, base: remote, conflicts, changed: !remote.deleted };
  }

  // この端末で削除済み → 削除を優先（相手が編集していても削除のまま送る）
  if (local === null) {
    return { local: remote.deleted ? undefined : null, base: remote, conflicts, changed: false };
  }

  // 別の端末で削除された → 削除を優先。この端末の未送信の編集があれば通知
  if (remote.deleted) {
    if (dirty) notice(null, null, null);
    return { local: undefined, base: remote, conflicts, changed: true };
  }

  if (!dirty) return { local: remote.data, base: remote, conflicts, changed: true };

  // 3方向マージ
  const merged: RowData = {};
  for (const col of COLUMNS[table]) {
    const mine = local[col], theirs = remote.data[col], anc = ancestor[col];
    if (isEqual(mine, anc) || isEqual(mine, theirs)) merged[col] = theirs ?? null;
    else if (isEqual(theirs, anc)) merged[col] = mine ?? null;
    else {
      merged[col] = theirs ?? null;
      if (!SILENT_FIELDS.has(col)) notice(col, mine, theirs);
    }
  }
  return { local: merged, base: remote, conflicts, changed: true };
}
