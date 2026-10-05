// ─── 選考（Selection）────────────────────────────

export type FlowStatus = 'pending' | 'done' | 'passed' | 'failed' | 'declined';
export type CompanyStatus = 'active' | 'offer' | 'declined' | 'rejected';

/** 選考の種類（テンプレート） */
export type SelectionKind =
  | 'ES' | 'Webテスト' | '1次面接' | '2次面接' | '3次面接' | '最終面接'
  | 'GD' | '説明会' | 'インターン' | 'その他';

/** 選考ごとの準備タスク */
export interface Task {
  id: string;
  text: string;
  done: boolean;
}

/** 面接で聞かれた質問 */
export interface Question {
  id: string;
  text: string;
  answer: string;
}

export type ReviewResult = 'pending' | 'passed' | 'failed' | 'declined';
export type InterviewFormat = '' | '対面' | 'オンライン' | '電話';

/** 自己評価（1〜5、0 = 未評価） */
export type SelfRatingKey = 'overall' | 'answers' | 'understanding' | 'motivation' | 'communication';
export type SelfRatings = Partial<Record<SelfRatingKey, number>>;

/** 選考の振り返り（次の選考へ引き継がれる） */
export interface SelectionReview {
  result: ReviewResult;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM
  format: InterviewFormat;
  interviewerCount: number; // 0 = 未入力
  questions: Question[];
  answerNotes: string;       // 回答内容
  goodPoints: string;        // うまく答えられたこと（1行1項目）
  stuckPoints: string;       // 詰まった質問
  positiveReactions: string; // 面接官の反応が良かった話
  improvements: string;      // 改善点
  ratings: SelfRatings;
  updatedAt: string;
}

/** 選考ステップ。保存データ上は Company.flows に入る（旧 Flow を拡張） */
export interface Selection {
  id: string;
  name: string;
  kind?: SelectionKind;
  date?: string;     // 実施日 YYYY-MM-DD
  time?: string;     // HH:MM
  online?: boolean;
  location?: string;
  deadline: string;  // 締切 YYYY-MM-DD
  status: FlowStatus;
  memo?: string;
  tasks?: Task[];
  review?: SelectionReview;
}

/** 旧名（互換用） */
export type Flow = Selection;

// ─── 企業カルテ ─────────────────────────────────

export type EvalKey =
  | 'work' | 'salary' | 'benefits' | 'culture' | 'growth' | 'location' | 'wlb' | 'motivation';

/** 自分視点の企業評価（1〜5、未設定は undefined） */
export type CompanyEvaluation = Partial<Record<EvalKey, number>>;

/** 志望度の記録（0〜100%） */
export interface MotivationRecord {
  id: string;
  date: string; // YYYY-MM-DD
  value: number;
}

/** 内定先を決めるためのメモ */
export interface DecisionNote {
  reason: string;      // この企業を選んだ理由
  hesitation: string;  // 最後まで迷った理由
  expectation: string; // 入社後に期待すること
}

export interface Company {
  id: string;
  name: string;
  jobType: string;
  industry: string;
  mypageUrl: string;
  status: CompanyStatus;
  flows: Selection[];
  // 企業情報
  avgSalary: string;
  employees: string;
  location: string;
  founded: string;
  benefits: string;
  business: string;
  notes: string;
  concerns: string;
  createdAt: string;
  // カルテ（任意）
  evaluation?: CompanyEvaluation;
  motivationHistory?: MotivationRecord[];
  decision?: DecisionNote;
}

/** 内定比較で使う重視度（%） */
export type Weights = Record<EvalKey, number>;

// ─── 派生データ（保存しない）────────────────────────

/** カレンダーに表示するイベント */
export interface CalendarEvent {
  key: string;
  type: 'deadline' | 'event';
  date: string;
  time?: string;
  companyId: string;
  companyName: string;
  selectionId: string;
  selectionName: string;
  status: FlowStatus;
}

export type Priority = 'today' | 'soon' | 'week' | 'later';

/** 「今日やること」の1項目 */
export interface TodoItem {
  key: string;
  priority: Priority;
  days: number;
  companyId: string;
  companyName: string;
  selectionId: string;
  selectionName: string;
  kind: 'prep' | 'missingPrep' | 'deadline' | 'review';
  message?: string;
  tasks: Task[];
}

/** 前回選考からの引き継ぎ項目 */
export interface CarryOverItem {
  icon: '⚠️' | '⭐' | '🔄';
  text: string;
  from: string; // 元の選考名
}
