/**
 * オフラインファーストの同期エンジン
 *
 *   画面で編集 ──▶ 端末に即保存（local）──▶ 未送信の変更を送信（version チェック付き）
 *                                    ▲                │
 *                                    └── 取り込み ◀──┘ 他端末の変更（差分 / Realtime）
 *
 * - 編集は必ず先に端末へ保存するので、通信できなくても入力は消えない
 * - 通信が戻ったら（再起動後でも）未送信の変更をまとめて送る
 * - 送信は「自分が知っている version と一致したときだけ更新」（楽観的ロック）。
 *   一致しなければ最新の行を取り込み、3方向マージしてから送り直す
 *
 * React Native に依存しないので、Node のテストから2台の端末を再現できる。
 */
import type { Weights } from '../types/index.ts';
import type { RowData, ServerRow, TableName, Tables } from './schema.ts';
import { emptyTables, TABLES } from './schema.ts';
import type { AppData } from './mapping.ts';
import { assemble, companyIdOf, describeRow, flatten } from './mapping.ts';
import type { Conflict, LocalTables, PendingChange } from './merge.ts';
import { applyLocalEdit, dropSettledTombstones, isEqual, mergeRemoteRow, pendingChanges } from './merge.ts';

// ─── 外部とのインターフェース ───────────────────────

export type PushResult =
  | { status: 'ok'; row: ServerRow }
  /** version が合わなかった（row = サーバーの最新。行が無ければ null） */
  | { status: 'conflict'; row: ServerRow | null }
  /** 入力値がDBの制約に違反した等、送り直しても成功しない */
  /** retryable = 親の行が未保存などで、親が保存されれば成功する見込みがある */
  | { status: 'rejected'; message: string; retryable?: boolean };

export interface Remote {
  /** since より後に更新された行（削除済みを含む）。since = null なら全件 */
  pull(table: TableName, since: string | null): Promise<ServerRow[]>;
  /** 通信エラーなど一時的な失敗は throw する */
  push(change: PendingChange, deviceId: string): Promise<PushResult>;
}

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type SyncPhase = 'local' | 'idle' | 'syncing' | 'offline' | 'error';

/** DB に拒否され、クラウドに保存できていない変更 */
export interface RejectedChange {
  key: string;
  table: TableName;
  rowId: string;
  label: string;
  companyId: string | null;
  message: string;
}

export interface SyncStatus {
  phase: SyncPhase;
  /** 未送信の変更（拒否されたものを含まない） */
  pending: number;
  /** クラウドに保存できなかった変更。端末にだけ残っているので、利用者に対応してもらう */
  rejected: RejectedChange[];
  conflicts: Conflict[];
  lastSyncedAt: string | null;
  error: string | null;
}

export interface Snapshot extends AppData {
  status: SyncStatus;
}

interface PersistedState {
  v: 1;
  local: LocalTables;
  base: Tables<ServerRow>;
  cursors: Partial<Record<TableName, string>>;
  conflicts: Conflict[];
  /** DB に拒否された変更（同じ内容のまま送り直さない）。key = table:id */
  rejected: Record<string, { data: string; message: string; label: string; companyId: string | null; retryable?: boolean }>;
  lastSyncedAt: string | null;
}

/** 差分取得の重なり幅。同時刻付近にコミットされた行の取りこぼしを防ぐ */
const PULL_OVERLAP_MS = 5 * 60 * 1000;
/** 1回の同期で「競合 → 取り込み → 送り直し」を繰り返す上限 */
const MAX_ROUNDS = 3;

export const storageKey = (userId: string) => `@shukatsu:sync_v1:${userId}`;

export class SyncEngine {
  readonly userId: string;
  private readonly deviceId: string;
  private readonly remote: Remote | null;
  private readonly store: KeyValueStore;
  private readonly now: () => string;

  private state: PersistedState = newState();
  private view: AppData = { companies: [], weights: null };
  private status: SyncStatus;
  private snapshot: Snapshot;
  private listeners = new Set<() => void>();
  private saving: Promise<void> = Promise.resolve();
  private running: Promise<void> | null = null;
  private rerun = false;
  private disposed = false;
  private cleared = false;

  constructor(opts: { userId: string; deviceId: string; remote: Remote | null; store: KeyValueStore; now?: () => string }) {
    this.userId = opts.userId;
    this.deviceId = opts.deviceId;
    this.remote = opts.remote;
    this.store = opts.store;
    this.now = opts.now ?? (() => new Date().toISOString());
    this.status = { phase: this.remote ? 'idle' : 'local', pending: 0, rejected: [], conflicts: [], lastSyncedAt: null, error: null };
    this.snapshot = { ...this.view, status: this.status };
  }

  // ─── 読み込み・購読 ─────────────────────────────

  async load(): Promise<void> {
    const raw = await this.store.getItem(storageKey(this.userId));
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.v === 1) this.state = { ...newState(), ...parsed };
    }
    this.refresh(true);
  }

  getSnapshot = (): Snapshot => this.snapshot;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  /** クラウドにまだ無い変更（未送信 + 拒否された変更）があるか */
  hasPendingChanges(): boolean {
    return this.pending().length > 0 || this.rejectedList().length > 0;
  }

  // ─── 端末での編集 ───────────────────────────────

  /** 画面からの編集。端末への保存が終わったら resolve する（送信は待たない） */
  mutate(fn: (data: AppData) => AppData): Promise<void> {
    const next = fn(this.view);
    const prevRows = flatten(this.view, this.userId);
    const nextRows = flatten(next, this.userId);
    this.state.local = applyLocalEdit(this.state.local, prevRows, nextRows, this.remote !== null);
    this.refresh(true);
    return this.persist();
  }

  /** 競合の解決。mine = この端末の値で上書き / theirs = 別端末の値のまま */
  resolveConflict(key: string, choice: 'mine' | 'theirs'): Promise<void> {
    const c = this.state.conflicts.find((x) => x.key === key);
    this.state.conflicts = this.state.conflicts.filter((x) => x.key !== key);
    if (c && choice === 'mine' && c.field) {
      const row = this.state.local[c.table][c.rowId];
      if (row) this.state.local[c.table] = { ...this.state.local[c.table], [c.rowId]: { ...row, [c.field]: c.mine } };
    }
    this.refresh(true);
    return this.persist();
  }

  /** 拒否された変更を取り消し、クラウドの内容に戻す */
  discardRejected(key: string): Promise<void> {
    const [table, ...rest] = key.split(':') as [TableName, ...string[]];
    const id = rest.join(':');
    delete this.state.rejected[key];
    const rows = { ...this.state.local[table] };
    const b = this.state.base[table]?.[id];
    if (b && !b.deleted) rows[id] = b.data;
    else delete rows[id];
    this.state.local[table] = rows;
    this.refresh(true);
    return this.persist();
  }

  /** ログアウト時など。端末内のこのユーザーのデータを消す */
  async clearLocal(): Promise<void> {
    this.dispose();
    this.cleared = true;
    await this.saving;
    await this.store.removeItem(storageKey(this.userId));
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  // ─── 同期 ──────────────────────────────────────

  /** 取り込み → 送信。実行中に呼ばれたら、終わった後にもう一度だけ実行する */
  sync(): Promise<void> {
    if (!this.remote || this.disposed) return Promise.resolve();
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.rerun = false;
        await this.syncOnce();
      } while (this.rerun && !this.disposed);
    })().finally(() => { this.running = null; });
    return this.running;
  }

  private async syncOnce(): Promise<void> {
    const remote = this.remote!;
    this.setPhase('syncing');
    try {
      await this.pullAll(remote);
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const changes = this.pending(true);
        if (changes.length === 0) break;
        let conflicted = false;
        for (const change of changes) {
          if (this.disposed) return;
          const result = await remote.push(change, this.deviceId);
          conflicted = this.applyPushResult(change, result) || conflicted;
        }
        await this.persist();
        if (!conflicted) break;
      }
      this.state.lastSyncedAt = this.now();
      this.status.error = null;
      this.setPhase('idle');
    } catch (e) {
      // 通信エラー: 端末のデータはそのまま残し、次の機会に送り直す
      this.status.error = e instanceof Error ? e.message : String(e);
      this.setPhase('offline');
    }
    await this.persist();
  }

  private async pullAll(remote: Remote): Promise<void> {
    let changed = false;
    for (const t of TABLES) {
      const cursor = this.state.cursors[t];
      const since = cursor ? new Date(new Date(cursor).getTime() - PULL_OVERLAP_MS).toISOString() : null;
      const rows = await remote.pull(t, since);
      for (const row of rows) {
        changed = this.mergeRemote(t, row) || changed;
        if (row.updatedAt > (this.state.cursors[t] ?? '')) this.state.cursors[t] = row.updatedAt;
      }
    }
    if (changed) this.refresh(true);
  }

  private mergeRemote(table: TableName, row: ServerRow): boolean {
    const res = mergeRemoteRow(table, row, this.state.base[table][row.id], this.state.local[table][row.id], this.now());
    if (!res) return false;
    // ラベルは行が消える前に作る
    for (const c of res.conflicts) {
      c.label = describeRow(this.state.local, table, row.id, row.data);
      c.companyId = companyIdOf(this.state.local, table, row.id);
    }
    this.state.base[table][row.id] = res.base;
    const local = { ...this.state.local[table] };
    if (res.local === undefined) delete local[row.id];
    else local[row.id] = res.local;
    this.state.local[table] = local;
    if (res.conflicts.length) {
      const keys = new Set(res.conflicts.map((c) => c.key));
      this.state.conflicts = [...this.state.conflicts.filter((c) => !keys.has(c.key)), ...res.conflicts];
    }
    return res.changed || res.conflicts.length > 0;
  }

  /** @returns 競合が起きて送り直しが必要なら true */
  private applyPushResult(change: PendingChange, result: PushResult): boolean {
    const { table, id } = change;
    const rkey = `${table}:${id}`;
    if (result.status === 'ok') {
      delete this.state.rejected[rkey];
      this.state.base[table][id] = result.row;
      const local = { ...this.state.local[table] };
      const cur = local[id];
      if (result.row.deleted) {
        if (cur === null) delete local[id];
      } else if (cur && isEqual(cur, change.data)) {
        // 送信中に編集されていなければ、サーバーが正規化した値（日時の表記など）に揃える
        local[id] = result.row.data;
      }
      this.state.local[table] = local;
      this.refresh(false);
      return false;
    }
    if (result.status === 'rejected') {
      this.state.rejected[rkey] = {
        data: JSON.stringify(change.data),
        message: result.message,
        label: describeRow(this.state.local, table, id, change.data),
        companyId: companyIdOf(this.state.local, table, id),
        retryable: result.retryable,
      };
      this.status.error = result.message;
      this.refresh(false);
      return false;
    }
    // 競合: サーバーの最新を取り込んでから送り直す
    if (result.row) {
      this.mergeRemote(table, result.row);
    } else {
      // サーバーに行が無い（完全に削除された）
      const local = { ...this.state.local[table] };
      delete local[id];
      this.state.local[table] = local;
      delete this.state.base[table][id];
    }
    this.refresh(true);
    return true;
  }

  // ─── 内部 ──────────────────────────────────────

  /**
   * 送信する変更。拒否された変更は内容が変わるまで送らない。
   * ただし forPush のときは、親の保存待ちで拒否されたもの（retryable）も送り直す。
   */
  private pending(forPush = false): PendingChange[] {
    if (!this.remote) return [];
    return pendingChanges(this.state.local, this.state.base, (t, id, data) => {
      const r = this.state.rejected[`${t}:${id}`];
      return r?.data === JSON.stringify(data ?? {}) && !(forPush && r.retryable);
    });
  }

  /** 拒否された変更のうち、まだ端末に同じ内容で残っているもの（編集し直されたら再送対象に戻る） */
  private rejectedList(): RejectedChange[] {
    const out: RejectedChange[] = [];
    for (const [key, r] of Object.entries(this.state.rejected)) {
      if (typeof r !== 'object') continue;
      const [table, ...rest] = key.split(':') as [TableName, ...string[]];
      const id = rest.join(':');
      const cur = this.state.local[table]?.[id];
      if (cur === undefined || JSON.stringify(cur ?? {}) !== r.data) continue;
      out.push({ key, table, rowId: id, label: r.label, companyId: r.companyId, message: r.message });
    }
    return out;
  }

  private setPhase(phase: SyncPhase) {
    this.status.phase = phase;
    this.refresh(false);
  }

  /** 状態が変わったら画面に通知する */
  private refresh(dataChanged: boolean) {
    if (dataChanged) {
      this.state.local = dropSettledTombstones(this.state.local, this.state.base);
      this.view = assemble(this.state.local, this.userId);
    }
    this.status = {
      ...this.status,
      pending: this.pending().length,
      rejected: this.rejectedList(),
      conflicts: this.state.conflicts,
      lastSyncedAt: this.state.lastSyncedAt,
    };
    this.snapshot = { ...this.view, status: this.status };
    if (!this.disposed) this.listeners.forEach((fn) => fn());
  }

  /** 書き込み順が入れ替わらないよう直列に保存する */
  private persist(): Promise<void> {
    if (this.cleared) return this.saving;
    const json = JSON.stringify(this.state);
    const key = storageKey(this.userId);
    this.saving = this.saving.catch(() => {}).then(() => this.store.setItem(key, json));
    return this.saving;
  }
}

function newState(): PersistedState {
  return {
    v: 1,
    local: emptyTables<RowData | null>(),
    base: emptyTables<ServerRow>(),
    cursors: {},
    conflicts: [],
    rejected: {},
    lastSyncedAt: null,
  };
}

export type { AppData, Conflict, Weights };
