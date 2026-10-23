/**
 * 画面表示用の純粋な関数（色の意味づけ・カレンダーのマス目など）。
 * データの計算は utils に任せ、ここでは「どう見せるか」だけを決める。
 */
import { CalendarEvent, CompanyStatus, FlowStatus, Priority } from './types';

export type Tone = 'primary' | 'success' | 'danger' | 'warning' | 'neutral';

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function companyStatusTone(status: CompanyStatus): Tone {
  switch (status) {
    case 'active': return 'primary';
    case 'offer': return 'success';
    case 'rejected': return 'danger';
    default: return 'neutral';
  }
}

export function flowStatusTone(status: FlowStatus): Tone {
  switch (status) {
    case 'done': return 'primary';
    case 'passed': return 'success';
    case 'failed': return 'danger';
    default: return 'neutral';
  }
}

/** 残り日数の緊急度（3日以内は赤、1週間以内はオレンジ） */
export function daysTone(days: number): Tone {
  if (days < 0) return 'neutral';
  if (days <= 3) return 'danger';
  if (days <= 7) return 'warning';
  return 'neutral';
}

export function priorityTone(p: Priority): Tone {
  return p === 'today' ? 'danger' : p === 'soon' ? 'warning' : p === 'week' ? 'primary' : 'neutral';
}

/** カレンダーの予定の色（マーカーと一覧で共通） */
export function calendarEventTone(e: Pick<CalendarEvent, 'type' | 'status'>): Tone {
  if (e.status === 'passed') return 'success';
  if (e.status === 'failed') return 'danger';
  if (e.type === 'deadline') return 'warning';
  return 'primary';
}

export const CALENDAR_LEGEND: { tone: Tone; label: string }[] = [
  { tone: 'primary', label: '選考' },
  { tone: 'warning', label: '締切' },
  { tone: 'success', label: '通過' },
  { tone: 'danger', label: '不合格' },
];

/** YYYY-MM-DD（month は 0 始まり） */
export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 月のマス目（日曜始まり・1週ごとの配列。月の前後は null） */
export function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** 日付順に並んだ予定を、日付ごとのまとまりにする（並び順は保つ） */
export function groupByDate<T extends { date: string }>(items: T[]): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}

/** 「10月25日（土）」 */
export function formatDateJa(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

/** 企業名の頭文字（「株式会社」などを除く）。一覧のアイコンに使う */
export function companyInitial(name: string): string {
  const trimmed = name.replace(/^(株式会社|有限会社|合同会社|\(株\)|（株）)\s*/, '').trim();
  return (trimmed || name).slice(0, 1).toUpperCase();
}
