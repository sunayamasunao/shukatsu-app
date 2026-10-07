import {
  CalendarEvent, CarryOverItem, Company, EvalKey, Flow, Priority, Selection,
  SelfRatingKey, TodoItem, Weights,
} from '../types';
import { EVAL_KEYS, SELF_RATING_LABELS } from '../constants';

/** ユニークID生成（オフラインでも複数端末で衝突しないよう、時刻 + 十分な長さの乱数） */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12).padEnd(10, '0');
}

/** Date → YYYY-MM-DD（端末のローカル日付。toISOString は UTC なので朝9時前に前日になる） */
export function toDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 今日の日付文字列 (YYYY-MM-DD) */
export function todayStr(): string {
  return toDateStr(new Date());
}

/** 選考の基準日（実施日があればそれ、なければ締切） */
export function selectionDate(s: Selection): string {
  return s.date || s.deadline || '';
}

/** 最も近い未来の締め切りフローを返す */
export function nearestDeadline(company: Company): Flow | null {
  const upcoming = (company.flows ?? [])
    .filter((f) => selectionDate(f) && f.status !== 'failed' && f.status !== 'declined')
    .filter((f) => daysUntil(selectionDate(f)) >= 0)
    .sort((a, b) => selectionDate(a).localeCompare(selectionDate(b)));

  return upcoming[0] ?? null;
}

/** 今日からn日後かを返す（負 = 過去）*/
export function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

/** 「今日！」「あと3日」「2日前」 */
export function daysLabel(days: number): string {
  return days === 0 ? '今日' : days < 0 ? `${Math.abs(days)}日前` : `あと${days}日`;
}

/** M/D 形式でフォーマット */
export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** YYYY/M/D 形式 */
export function formatDateFull(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** 複数行テキスト → 空行を除いた配列 */
export function splitLines(text?: string): string[] {
  return (text ?? '').split('\n').map((l) => l.replace(/^[・\-*\s]+/, '').trim()).filter(Boolean);
}

// ─── 業界・並び替え ────────────────────────────────

/** 業界の選択肢（就活でよく使われる分類） */
export const INDUSTRIES = [
  'メーカー',
  '商社',
  '小売・流通',
  '金融',
  '保険',
  'IT・Web',
  'SIer',
  '通信',
  'コンサル',
  '広告・マスコミ',
  'エンタメ',
  '人材',
  'インフラ',
  '不動産・建設',
  '運輸・物流',
  'サービス',
  '官公庁・公務員',
  'その他',
];

/** 業界の並び順（リスト外・未設定は最後） */
export function industryOrder(industry: string): number {
  const i = INDUSTRIES.indexOf(industry);
  return i === -1 ? INDUSTRIES.length : i;
}

const CORP_WORDS = /株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|独立行政法人|\(株\)|（株）|㈱|\(有\)|（有）|㈲/g;

/** 並び替え用の読み: 法人格を除き、全角→半角・カタカナ→ひらがな・小文字に揃える */
function nameSortKey(name: string): string {
  return name
    .replace(CORP_WORDS, '')
    .normalize('NFKC')
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .toLowerCase()
    .replace(/[\s・]/g, '');
}

/** 0: かな 1: 英字 2: 数字 3: 漢字など */
function nameGroup(key: string): number {
  const ch = key.charAt(0);
  if (/[ぁ-ゖー]/.test(ch)) return 0;
  if (/[a-z]/.test(ch)) return 1;
  if (/[0-9]/.test(ch)) return 2;
  return 3;
}

/** 企業名順: あいうえお順 → ABC順（「株式会社」などは無視） */
export function compareCompanyName(a: string, b: string): number {
  const ka = nameSortKey(a), kb = nameSortKey(b);
  const ga = nameGroup(ka), gb = nameGroup(kb);
  if (ga !== gb) return ga - gb;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

// ─── 選考 ────────────────────────────────────────

/** 面接・GDなど「準備」と「振り返り」が必要な選考か */
export function isInterviewLike(s: Selection): boolean {
  if (s.kind) return /面接|GD/.test(s.kind);
  return /面接|面談|GD|ディスカッション/.test(s.name);
}

/**
 * 前回までの選考の振り返りから、この選考への引き継ぎを作る。
 * Company → Selection → SelectionReview → 次の Selection の流れ。
 */
export function buildCarryOver(company: Company, selectionId: string): CarryOverItem[] {
  const idx = company.flows.findIndex((f) => f.id === selectionId);
  if (idx <= 0) return [];

  const items: CarryOverItem[] = [];
  const seen = new Set<string>();
  const push = (icon: CarryOverItem['icon'], text: string, from: string) => {
    if (seen.has(text)) return;
    seen.add(text);
    items.push({ icon, text, from });
  };

  // 直近の選考から順に
  const previous = company.flows.slice(0, idx).filter((f) => f.review).reverse();
  for (const prev of previous) {
    const r = prev.review!;
    splitLines(r.improvements).forEach((t) => push('⚠️', t, prev.name));
    splitLines(r.positiveReactions).forEach((t) => push('⭐', `${t}（反応が良かった）`, prev.name));
    splitLines(r.stuckPoints).forEach((t) => push('🔄', `「${t}」の回答を準備し直す`, prev.name));
    (Object.keys(SELF_RATING_LABELS) as SelfRatingKey[]).forEach((k) => {
      const v = r.ratings?.[k];
      if (k !== 'overall' && v && v <= 2) push('🔄', `${SELF_RATING_LABELS[k]}を改善する`, prev.name);
    });
  }
  return items;
}

/** 全企業の振り返りから、よく聞かれた質問を集計 */
export function frequentQuestions(companies: Company[], limit = 5): { text: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of companies) {
    for (const f of c.flows ?? []) {
      for (const q of f.review?.questions ?? []) {
        const t = q.text.trim();
        if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ─── カレンダー ───────────────────────────────────

/** 選考フローの日付・締切からカレンダーイベントを作る */
export function buildCalendarEvents(companies: Company[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const c of companies) {
    for (const f of c.flows ?? []) {
      const base = {
        companyId: c.id, companyName: c.name,
        selectionId: f.id, selectionName: f.name, status: f.status,
      };
      if (f.date) events.push({ ...base, key: `${f.id}-e`, type: 'event', date: f.date, time: f.time });
      if (f.deadline && f.deadline !== f.date) {
        events.push({ ...base, key: `${f.id}-d`, type: 'deadline', date: f.deadline });
      }
    }
  }
  return events.sort((a, b) =>
    a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99'));
}

// ─── 今日やること ─────────────────────────────────

export function priorityOf(days: number): Priority {
  if (days <= 0) return 'today';
  if (days <= 2) return 'soon';
  if (days <= 7) return 'week';
  return 'later';
}

/**
 * 「今日やること」を作る。通知過多にならないよう、
 * 1週間以内の選考と、振り返り忘れ（直近2週間）だけを対象にする。
 */
export function buildTodos(companies: Company[]): TodoItem[] {
  const todos: TodoItem[] = [];
  for (const c of companies) {
    if (c.status !== 'active') continue;
    for (const f of c.flows ?? []) {
      const date = selectionDate(f);
      if (!date) continue;
      const days = daysUntil(date);
      const base = {
        companyId: c.id, companyName: c.name,
        selectionId: f.id, selectionName: f.name, days,
      };
      const interview = isInterviewLike(f);

      // 終わった面接の振り返り忘れ
      if (days < 0) {
        if (interview && !f.review && days >= -14 && f.status !== 'failed' && f.status !== 'declined') {
          todos.push({
            ...base, key: `${f.id}-review`, kind: 'review', priority: 'week', tasks: [],
            message: '振り返りを記録して、次の選考に活かしましょう',
          });
        }
        continue;
      }

      if (days > 7 || f.status !== 'pending') continue;

      const tasks = f.tasks ?? [];
      const undone = tasks.filter((t) => !t.done);
      const priority = priorityOf(days);

      if (interview && tasks.length === 0 && days <= 3) {
        todos.push({
          ...base, key: `${f.id}-missing`, kind: 'missingPrep', priority, tasks: [],
          message: `${c.name}の${f.name}まで${days === 0 ? '今日です' : `あと${days}日です`}。まだ面接準備が登録されていません。`,
        });
      } else if (undone.length > 0) {
        todos.push({ ...base, key: `${f.id}-prep`, kind: 'prep', priority, tasks });
      } else if (tasks.length === 0) {
        todos.push({ ...base, key: `${f.id}-deadline`, kind: 'deadline', priority, tasks: [] });
      }
      // 準備タスクがすべて完了している選考は出さない
    }
  }
  const kindOrder = { missingPrep: 0, prep: 1, deadline: 2, review: 3 };
  return todos.sort((a, b) => {
    const da = a.kind === 'review' ? 99 : a.days;
    const db = b.kind === 'review' ? 99 : b.days;
    return da - db || kindOrder[a.kind] - kindOrder[b.kind];
  });
}

// ─── 企業カルテ・内定比較 ───────────────────────────

/** 最新の志望度（%）。記録がなければ評価の★から換算 */
export function latestMotivation(c: Company): number | null {
  const hist = [...(c.motivationHistory ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  if (hist.length) return hist[hist.length - 1].value;
  const star = c.evaluation?.motivation;
  return star ? star * 20 : null;
}

/**
 * 自分との相性スコア（0〜100）。
 * 「自分が何を重視するか（重み）」×「自分が登録した評価（★）」で計算する。
 * 未評価の項目は計算から除き、missing として返す。
 * 重視している項目の半分以上が未評価なら tentative（参考値）とし、ランキングでは後ろに回す。
 */
export function compatibilityScore(
  c: Company, weights: Weights,
): { score: number | null; missing: EvalKey[]; tentative: boolean } {
  let sum = 0, wsum = 0, counted = 0;
  const missing: EvalKey[] = [];
  for (const k of EVAL_KEYS) {
    const w = weights[k] ?? 0;
    if (w <= 0) continue;
    counted++;
    // 志望度は推移の最新値（%）を優先し、表の表示と揃える
    const m = k === 'motivation' ? latestMotivation(c) : null;
    const v = m !== null ? m / 20 : c.evaluation?.[k];
    if (!v) { missing.push(k); continue; }
    sum += w * (v / 5);
    wsum += w;
  }
  const score = wsum > 0 ? Math.round((sum / wsum) * 100) : null;
  return { score, missing, tentative: score !== null && missing.length * 2 >= counted };
}
