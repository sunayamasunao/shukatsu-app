/**
 * 同期エンジン ⇔ Supabase (PostgREST) のアダプター
 *
 * - user_id での絞り込みは RLS でも強制されるが、インデックスを使うため明示する
 * - 更新は「.eq('version', 知っている version)」付き。0件なら他端末が先に更新している
 */
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Remote, PushResult } from './engine';
import type { PendingChange } from './merge';
import type { ServerRow, TableName } from './schema';
import { pickColumns } from './schema';

const PAGE = 1000;

function toServerRow(table: TableName, row: Record<string, unknown>): ServerRow {
  return {
    id: String(row.id),
    data: pickColumns(table, row),
    version: Number(row.version),
    updatedAt: String(row.updated_at),
    updatedBy: (row.updated_by as string | null) ?? null,
    deleted: row.deleted === true,
  };
}

/** 入力値の問題（送り直しても無駄）か、通信などの一時的な問題か */
function isPermanent(error: PostgrestError): boolean {
  // 22xxx: 値の形式 / 23xxx: 制約違反 / 42501: 権限（RLS）
  return /^(22|23)/.test(error.code ?? '') || error.code === '42501';
}

/** 拒否理由を利用者向けの日本語にする */
function rejectionMessage(error: PostgrestError): string {
  if (error.code === '23514' || error.code?.startsWith('22')) return '文字数が上限を超えているか、値の形式が正しくありません';
  if (error.code === '23503') return '関連する企業・選考がクラウドに保存されていません';
  if (error.code === '42501') return 'このデータを保存する権限がありません';
  return error.message;
}

export function createSupabaseRemote(client: SupabaseClient, userId: string): Remote {
  const fetchRow = async (table: TableName, id: string): Promise<ServerRow | null> => {
    const { data, error } = await client.from(table).select('*')
      .eq('user_id', userId).eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toServerRow(table, data) : null;
  };

  return {
    async pull(table, since) {
      const rows: ServerRow[] = [];
      for (let from = 0; ; from += PAGE) {
        let q = client.from(table).select('*').eq('user_id', userId);
        if (since) q = q.gt('updated_at', since);
        const { data, error } = await q.order('updated_at').order('id').range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        rows.push(...(data ?? []).map((r) => toServerRow(table, r)));
        if (!data || data.length < PAGE) break;
      }
      return rows;
    },

    async push(change: PendingChange, deviceId: string): Promise<PushResult> {
      const { table, id } = change;

      if (change.op === 'insert') {
        const { data, error } = await client.from(table)
          .insert({ ...change.data, user_id: userId, id, updated_by: deviceId })
          .select().single();
        if (!error) return { status: 'ok', row: toServerRow(table, data) };
        // 同じ id の行を別の端末が先に作っていた
        if (error.code === '23505') return { status: 'conflict', row: await fetchRow(table, id) };
        if (isPermanent(error)) return { status: 'rejected', message: rejectionMessage(error), retryable: error.code === '23503' };
        throw new Error(error.message);
      }

      const payload = change.op === 'delete'
        ? { deleted: true, updated_by: deviceId }
        : { ...change.data, updated_by: deviceId };
      const { data, error } = await client.from(table).update(payload)
        .eq('user_id', userId).eq('id', id).eq('version', change.baseVersion)
        .select();
      if (error) {
        if (isPermanent(error)) return { status: 'rejected', message: rejectionMessage(error), retryable: error.code === '23503' };
        throw new Error(error.message);
      }
      if (data && data.length === 1) return { status: 'ok', row: toServerRow(table, data[0]) };
      return { status: 'conflict', row: await fetchRow(table, id) };
    },
  };
}
