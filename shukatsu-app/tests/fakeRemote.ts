/**
 * テスト用のサーバー。Supabase のスキーマと同じ規則で動く:
 *   - 行は (user_id, id) で管理し、ユーザーごとに完全に分かれる
 *   - insert で version = 1、update ごとに version + 1、updated_at はサーバー時刻
 *   - update は「知っている version と一致したときだけ」成功（楽観的ロック）
 *   - 同じ id の insert は一意制約違反（→ conflict）
 */
import type { PendingChange } from '../src/sync/merge.ts';
import type { Remote, PushResult } from '../src/sync/engine.ts';
import type { ServerRow, TableName } from '../src/sync/schema.ts';

/** 子テーブル → [親を指す列, 親テーブル]（DB の外部キーと同じ） */
const PARENT: Partial<Record<TableName, [string, TableName]>> = {
  company_evaluations: ['company_id', 'companies'],
  motivation_records: ['company_id', 'companies'],
  selections: ['company_id', 'companies'],
  selection_reviews: ['selection_id', 'selections'],
  interview_questions: ['selection_id', 'selections'],
  tasks: ['selection_id', 'selections'],
};

export class FakeServer {
  /** DB の CHECK 制約の代わり（企業名は200文字まで） */
  validate(table: TableName, data: Record<string, unknown>): string | null {
    if (table === 'companies' && String(data.name ?? '').length > 200) return 'check constraint "companies_name_check"';
    return null;
  }

  /** user → table → id → row */
  private data = new Map<string, Map<TableName, Map<string, ServerRow>>>();
  private clock = Date.parse('2026-10-01T00:00:00Z');

  tick(): string {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  table(user: string, t: TableName): Map<string, ServerRow> {
    if (!this.data.has(user)) this.data.set(user, new Map());
    const u = this.data.get(user)!;
    if (!u.has(t)) u.set(t, new Map());
    return u.get(t)!;
  }

  /** 端末ごとの接続。offline = true の間はすべての通信が失敗する */
  connect(user: string): FakeRemote {
    return new FakeRemote(this, user);
  }
}

export class FakeRemote implements Remote {
  offline = false;
  pushCount = 0;
  constructor(private server: FakeServer, private user: string) {}

  private check() {
    if (this.offline) throw new Error('Network request failed');
  }

  async pull(table: TableName, since: string | null): Promise<ServerRow[]> {
    this.check();
    return [...this.server.table(this.user, table).values()]
      .filter((r) => !since || r.updatedAt > since)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .map((r) => structuredClone(r));
  }

  async push(change: PendingChange, deviceId: string): Promise<PushResult> {
    this.check();
    this.pushCount++;
    const rows = this.server.table(this.user, change.table);
    const cur = rows.get(change.id);

    if (change.op !== 'delete') {
      const err = this.server.validate(change.table, change.data);
      if (err) return { status: 'rejected', message: err };
    }

    if (change.op === 'insert') {
      if (cur) return { status: 'conflict', row: structuredClone(cur) };
      const parent = PARENT[change.table];
      if (parent && !this.server.table(this.user, parent[1]).has(String(change.data[parent[0]]))) {
        return { status: 'rejected', message: 'foreign key violation', retryable: true };
      }
      const row: ServerRow = {
        id: change.id, data: structuredClone(change.data), version: 1,
        updatedAt: this.server.tick(), updatedBy: deviceId, deleted: false,
      };
      rows.set(change.id, row);
      return { status: 'ok', row: structuredClone(row) };
    }

    if (!cur || cur.version !== change.baseVersion) {
      return { status: 'conflict', row: cur ? structuredClone(cur) : null };
    }
    const row: ServerRow = {
      ...cur,
      data: change.op === 'delete' ? cur.data : structuredClone(change.data),
      deleted: change.op === 'delete' ? true : cur.deleted,
      version: cur.version + 1,
      updatedAt: this.server.tick(),
      updatedBy: deviceId,
    };
    rows.set(change.id, row);
    return { status: 'ok', row: structuredClone(row) };
  }
}

/** AsyncStorage の代わり（端末の保存領域） */
export class MemoryStore {
  map = new Map<string, string>();
  async getItem(k: string) { return this.map.get(k) ?? null; }
  async setItem(k: string, v: string) { this.map.set(k, v); }
  async removeItem(k: string) { this.map.delete(k); }
}
