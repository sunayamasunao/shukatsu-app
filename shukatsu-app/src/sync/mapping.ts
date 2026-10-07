/**
 * アプリの入れ子データ（Company → Selection → Review …）と
 * DB の正規化された行（companies / selections / selection_reviews …）の相互変換。
 *
 * 画面は今まで通り Company[] を扱い、同期エンジンは行単位で扱う。
 * flatten(assemble(x)) === x（行データとして）になるように保つこと。
 */
import type {
  Company, CompanyEvaluation, EvalKey, MotivationRecord, Question, Selection,
  SelectionReview, SelfRatings, Task, Weights,
} from '../types/index.ts';
import type { RowData, TableName, Tables } from './schema.ts';
import { emptyTables } from './schema.ts';

export interface AppData {
  companies: Company[];
  weights: Weights | null;
}

const EVAL_COLS: EvalKey[] = ['work', 'salary', 'benefits', 'culture', 'growth', 'location', 'wlb', 'motivation'];

const orNull = <T>(v: T | undefined | null | ''): T | null => (v === undefined || v === '' ? null : v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const optStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

// ─── アプリ → 行 ──────────────────────────────────

export function flatten(app: AppData, userId: string): Tables<RowData> {
  const t = emptyTables<RowData>();

  if (app.weights) t.user_settings[userId] = { weights: { ...app.weights } };

  for (const c of app.companies) {
    t.companies[c.id] = {
      name: c.name,
      job_type: c.jobType ?? '',
      industry: c.industry ?? '',
      mypage_url: c.mypageUrl ?? '',
      status: c.status,
      avg_salary: c.avgSalary ?? '',
      employees: c.employees ?? '',
      location: c.location ?? '',
      founded: c.founded ?? '',
      benefits: c.benefits ?? '',
      business: c.business ?? '',
      notes: c.notes ?? '',
      concerns: c.concerns ?? '',
      decision_reason: orNull(c.decision?.reason),
      decision_hesitation: orNull(c.decision?.hesitation),
      decision_expectation: orNull(c.decision?.expectation),
      created_at: c.createdAt || null,
    };

    if (c.evaluation) {
      const row: RowData = { company_id: c.id };
      for (const k of EVAL_COLS) row[k] = c.evaluation[k] || null;
      t.company_evaluations[c.id] = row;
    }

    for (const r of c.motivationHistory ?? []) {
      t.motivation_records[r.id] = { company_id: c.id, date: r.date, value: r.value };
    }

    (c.flows ?? []).forEach((f, i) => {
      t.selections[f.id] = {
        company_id: c.id,
        position: i,
        name: f.name,
        kind: f.kind ?? null,
        date: orNull(f.date),
        time: orNull(f.time),
        online: f.online ?? null,
        location: f.location ?? null,
        deadline: orNull(f.deadline),
        status: f.status,
        memo: f.memo ?? null,
      };
      (f.tasks ?? []).forEach((task, j) => {
        t.tasks[task.id] = { selection_id: f.id, position: j, text: task.text, done: task.done };
      });
      const r = f.review;
      if (r) {
        t.selection_reviews[f.id] = {
          selection_id: f.id,
          result: r.result,
          date: orNull(r.date),
          time: orNull(r.time),
          format: r.format ?? '',
          interviewer_count: r.interviewerCount ?? 0,
          answer_notes: r.answerNotes ?? '',
          good_points: r.goodPoints ?? '',
          stuck_points: r.stuckPoints ?? '',
          positive_reactions: r.positiveReactions ?? '',
          improvements: r.improvements ?? '',
          ratings: cleanRatings(r.ratings),
          reviewed_at: r.updatedAt || null,
        };
        (r.questions ?? []).forEach((q, j) => {
          t.interview_questions[q.id] = { selection_id: f.id, position: j, text: q.text, answer: q.answer ?? '' };
        });
      }
    });
  }
  return t;
}

function cleanRatings(r: SelfRatings | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(r ?? {})) if (typeof v === 'number' && v > 0) out[k] = v;
  return out;
}

// ─── 行 → アプリ ──────────────────────────────────

const byPosition = (a: [string, RowData], b: [string, RowData]) =>
  (num(a[1].position) ?? 0) - (num(b[1].position) ?? 0) || a[0].localeCompare(b[0]);

/** 削除済み（null）の行と、親が存在しない行は無視して組み立てる */
export function assemble(rows: Tables<RowData | null>, userId: string): AppData {
  const live = <T extends TableName>(table: T) =>
    Object.entries(rows[table]).filter((e): e is [string, RowData] => e[1] !== null);

  const group = (table: TableName, parentCol: string) => {
    const m = new Map<string, [string, RowData][]>();
    for (const e of live(table)) {
      const p = str(e[1][parentCol]);
      if (!m.has(p)) m.set(p, []);
      m.get(p)!.push(e);
    }
    return m;
  };

  const selectionsBy = group('selections', 'company_id');
  const motivationBy = group('motivation_records', 'company_id');
  const tasksBy = group('tasks', 'selection_id');
  const questionsBy = group('interview_questions', 'selection_id');

  const companies: Company[] = live('companies')
    .sort((a, b) => str(a[1].created_at).localeCompare(str(b[1].created_at)) || a[0].localeCompare(b[0]))
    .map(([id, r]) => {
      const company: Company = {
        id,
        name: str(r.name),
        jobType: str(r.job_type),
        industry: str(r.industry),
        mypageUrl: str(r.mypage_url),
        status: str(r.status) as Company['status'],
        flows: (selectionsBy.get(id) ?? []).sort(byPosition).map(([sid, s]) => toSelection(sid, s, tasksBy, questionsBy, rows)),
        avgSalary: str(r.avg_salary),
        employees: str(r.employees),
        location: str(r.location),
        founded: str(r.founded),
        benefits: str(r.benefits),
        business: str(r.business),
        notes: str(r.notes),
        concerns: str(r.concerns),
        createdAt: str(r.created_at),
      };

      const ev = rows.company_evaluations[id];
      if (ev) {
        const evaluation: CompanyEvaluation = {};
        for (const k of EVAL_COLS) if (typeof ev[k] === 'number') evaluation[k] = ev[k] as number;
        company.evaluation = evaluation;
      }

      const hist = motivationBy.get(id);
      if (hist) {
        company.motivationHistory = hist
          .map(([mid, m]): MotivationRecord => ({ id: mid, date: str(m.date), value: num(m.value) ?? 0 }))
          .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
      }

      if (r.decision_reason !== null || r.decision_hesitation !== null || r.decision_expectation !== null) {
        company.decision = {
          reason: str(r.decision_reason),
          hesitation: str(r.decision_hesitation),
          expectation: str(r.decision_expectation),
        };
      }
      return company;
    });

  const settings = rows.user_settings[userId];
  const weights = settings && settings.weights && typeof settings.weights === 'object'
    ? (settings.weights as Weights)
    : null;

  return { companies, weights };
}

function toSelection(
  id: string, s: RowData,
  tasksBy: Map<string, [string, RowData][]>,
  questionsBy: Map<string, [string, RowData][]>,
  rows: Tables<RowData | null>,
): Selection {
  const sel: Selection = {
    id,
    name: str(s.name),
    deadline: str(s.deadline),
    status: str(s.status) as Selection['status'],
  };
  if (s.kind !== null) sel.kind = s.kind as Selection['kind'];
  if (s.date !== null) sel.date = str(s.date);
  if (s.time !== null) sel.time = str(s.time);
  if (typeof s.online === 'boolean') sel.online = s.online;
  if (s.location !== null) sel.location = optStr(s.location);
  if (s.memo !== null) sel.memo = optStr(s.memo);

  const tasks = tasksBy.get(id);
  if (tasks) {
    sel.tasks = tasks.sort(byPosition).map(([tid, t]): Task => ({ id: tid, text: str(t.text), done: t.done === true }));
  }

  const r = rows.selection_reviews[id];
  if (r) {
    const review: SelectionReview = {
      result: str(r.result) as SelectionReview['result'],
      date: str(r.date),
      time: str(r.time),
      format: str(r.format) as SelectionReview['format'],
      interviewerCount: num(r.interviewer_count) ?? 0,
      questions: (questionsBy.get(id) ?? []).sort(byPosition)
        .map(([qid, q]): Question => ({ id: qid, text: str(q.text), answer: str(q.answer) })),
      answerNotes: str(r.answer_notes),
      goodPoints: str(r.good_points),
      stuckPoints: str(r.stuck_points),
      positiveReactions: str(r.positive_reactions),
      improvements: str(r.improvements),
      ratings: (r.ratings && typeof r.ratings === 'object' ? r.ratings : {}) as SelfRatings,
      updatedAt: str(r.reviewed_at),
    };
    sel.review = review;
  }
  return sel;
}

// ─── 競合表示用のラベル ─────────────────────────────

export const TABLE_LABELS: Record<TableName, string> = {
  user_settings: '内定比較の重視度',
  companies: '企業情報',
  company_evaluations: '自分の評価',
  motivation_records: '志望度',
  selections: '選考',
  selection_reviews: '振り返り',
  interview_questions: '聞かれた質問',
  tasks: '準備タスク',
};

export const FIELD_LABELS: Record<string, string> = {
  name: '名称', job_type: '職種', industry: '業界', mypage_url: 'マイページURL', status: 'ステータス',
  avg_salary: '平均年収', employees: '従業員数', location: '勤務地・場所', founded: '設立年',
  benefits: '福利厚生', business: '事業内容', notes: '魅力・メモ', concerns: '懸念点',
  decision_reason: 'この企業を選んだ理由', decision_hesitation: '最後まで迷った理由',
  decision_expectation: '入社後に期待すること',
  work: '仕事内容', salary: '年収', culture: '社風', growth: '成長環境', wlb: 'ワークライフバランス',
  motivation: '志望度', value: '志望度', date: '日付', time: '時間', kind: '種類', online: '形式',
  deadline: '締切', memo: 'メモ', result: '選考結果', format: '面接形式', interviewer_count: '面接官人数',
  answer_notes: '自分の回答', good_points: 'うまく答えられたこと', stuck_points: '詰まった質問',
  positive_reactions: '面接官の反応が良かった話', improvements: '改善点', ratings: '自己評価',
  text: '内容', answer: '回答', done: '完了', weights: '重視度',
};

/** 「株式会社A / 1次面接」のような、どのデータかが分かるラベル */
export function describeRow(rows: Tables<RowData | null>, table: TableName, id: string, fallback?: RowData): string {
  const row = rows[table][id] ?? fallback ?? null;
  const companyName = (cid: unknown) => str(rows.companies[str(cid)]?.name) || '削除された企業';
  const selectionLabel = (sid: unknown) => {
    const s = rows.selections[str(sid)];
    return s ? `${companyName(s.company_id)} / ${str(s.name)}` : '削除された選考';
  };
  switch (table) {
    case 'user_settings': return TABLE_LABELS[table];
    case 'companies': return str(row?.name) || '企業';
    case 'company_evaluations':
    case 'motivation_records': return `${companyName(row?.company_id)} / ${TABLE_LABELS[table]}`;
    case 'selections': return `${companyName(row?.company_id)} / ${str(row?.name)}`;
    case 'selection_reviews': return `${selectionLabel(row?.selection_id)} / 振り返り`;
    case 'interview_questions':
    case 'tasks': return `${selectionLabel(row?.selection_id)} / ${TABLE_LABELS[table]}`;
  }
}

/** この行が属する企業 ID（競合画面から企業詳細へ飛ぶため） */
export function companyIdOf(rows: Tables<RowData | null>, table: TableName, id: string): string | null {
  const row = rows[table][id];
  if (!row) return null;
  if (table === 'companies') return id;
  if ('company_id' in row) return str(row.company_id);
  const sid = str(row.selection_id);
  return str(rows.selections[sid]?.company_id) || null;
}
