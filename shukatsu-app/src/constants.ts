import {
  CompanyStatus, EvalKey, FlowStatus, InterviewFormat, Priority, ReviewResult,
  SelectionKind, SelfRatingKey, Weights,
} from './types';

export const STATUS_LABEL: Record<CompanyStatus, string> = {
  active: '選考中', offer: '内定', declined: '辞退', rejected: '不合格',
};

export const FLOW_STATUS_LABEL: Record<FlowStatus, string> = {
  pending: '未対応', done: '提出済', passed: '通過', failed: '不合格', declined: '辞退',
};

export const FLOW_STATUS_OPTIONS: { value: FlowStatus; label: string }[] = [
  { value: 'pending', label: '未対応' },
  { value: 'done', label: '提出済' },
  { value: 'passed', label: '通過' },
  { value: 'failed', label: '不合格' },
  { value: 'declined', label: '辞退' },
];

/** 「＋ フローを追加」で選べる選考の種類 */
export const SELECTION_KINDS: SelectionKind[] = [
  'ES', 'Webテスト', '1次面接', '2次面接', '3次面接', '最終面接',
  'GD', '説明会', 'インターン', 'その他',
];

/** 選考の種類ごとのおすすめ準備タスク */
export const PREP_TEMPLATES: Record<SelectionKind, string[]> = {
  ES: ['自己PRを推敲', '志望動機を作成', '誤字脱字チェック'],
  Webテスト: ['問題集を1周', '受検環境を確認'],
  '1次面接': ['企業研究', '想定質問10個作成', '志望動機確認', '模擬面接'],
  '2次面接': ['前回の振り返りを確認', '企業研究を深める', '逆質問を3つ用意', '模擬面接'],
  '3次面接': ['前回の振り返りを確認', '中期経営計画を読む', '逆質問を3つ用意'],
  最終面接: ['前回の振り返りを確認', '入社後にやりたいことを整理', '志望度の伝え方を確認'],
  GD: ['GDの役割と進め方を確認', '業界ニュースをチェック'],
  説明会: ['質問したいことを3つ用意'],
  インターン: ['持ち物・服装を確認', '参加目的を整理'],
  その他: [],
};

export const REVIEW_RESULT_OPTIONS: { value: ReviewResult; label: string }[] = [
  { value: 'passed', label: '通過' },
  { value: 'failed', label: '不合格' },
  { value: 'declined', label: '辞退' },
  { value: 'pending', label: '未確定' },
];

export const INTERVIEW_FORMATS: Exclude<InterviewFormat, ''>[] = ['対面', 'オンライン', '電話'];

export const SELF_RATING_LABELS: Record<SelfRatingKey, string> = {
  overall: '全体評価',
  answers: '回答',
  understanding: '企業理解',
  motivation: '志望動機',
  communication: '受け答え',
};

export const EVAL_LABELS: Record<EvalKey, string> = {
  work: '仕事内容',
  salary: '年収',
  benefits: '福利厚生',
  culture: '社風',
  growth: '成長環境',
  location: '勤務地',
  wlb: 'ワークライフバランス',
  motivation: '志望度',
};

export const EVAL_KEYS = Object.keys(EVAL_LABELS) as EvalKey[];

export const DEFAULT_WEIGHTS: Weights = {
  work: 30, salary: 15, benefits: 10, culture: 15,
  growth: 10, location: 5, wlb: 10, motivation: 5,
};

export const PRIORITY_META: Record<Priority, { icon: string; label: string }> = {
  today: { icon: '🔴', label: '今日' },
  soon: { icon: '🟠', label: '2日以内' },
  week: { icon: '🟡', label: '1週間以内' },
  later: { icon: '⚪', label: 'それ以降' },
};
