/**
 * DB テーブル定義（supabase/migrations と対応）
 *
 * 端末内では各テーブルを「id → 行データ」の Map として持ち、
 * サーバーとは行単位・version 付きで同期する。
 */

/** 同期するテーブル。親 → 子の順（挿入時に外部キーを満たす順番） */
export const TABLES = [
  'user_settings',
  'companies',
  'company_evaluations',
  'motivation_records',
  'selections',
  'selection_reviews',
  'interview_questions',
  'tasks',
] as const;

export type TableName = (typeof TABLES)[number];

/** 各テーブルのデータ列（user_id / id / 同期メタデータを除く） */
export const COLUMNS: Record<TableName, readonly string[]> = {
  user_settings: ['weights'],
  companies: [
    'name', 'job_type', 'industry', 'mypage_url', 'status',
    'avg_salary', 'employees', 'location', 'founded', 'benefits', 'business', 'notes', 'concerns',
    'decision_reason', 'decision_hesitation', 'decision_expectation', 'created_at',
  ],
  company_evaluations: [
    'company_id', 'work', 'salary', 'benefits', 'culture', 'growth', 'location', 'wlb', 'motivation',
  ],
  motivation_records: ['company_id', 'date', 'value'],
  selections: [
    'company_id', 'position', 'name', 'kind', 'date', 'time', 'online', 'location',
    'deadline', 'status', 'memo',
  ],
  selection_reviews: [
    'selection_id', 'result', 'date', 'time', 'format', 'interviewer_count',
    'answer_notes', 'good_points', 'stuck_points', 'positive_reactions', 'improvements',
    'ratings', 'reviewed_at',
  ],
  interview_questions: ['selection_id', 'position', 'text', 'answer'],
  tasks: ['selection_id', 'position', 'text', 'done'],
};

/** 1行分のデータ（列名 → 値。DB の表現そのまま） */
export type RowData = Record<string, unknown>;

/** サーバーが確定させた行 */
export interface ServerRow {
  id: string;
  data: RowData;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
  deleted: boolean;
}

export type Tables<T> = Record<TableName, Record<string, T>>;

export function emptyTables<T>(): Tables<T> {
  return Object.fromEntries(TABLES.map((t) => [t, {}])) as unknown as Tables<T>;
}

/** 列の値を DB の行から取り出す */
export function pickColumns(table: TableName, row: Record<string, unknown>): RowData {
  const data: RowData = {};
  for (const col of COLUMNS[table]) data[col] = row[col] ?? null;
  return data;
}
