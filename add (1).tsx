import { Company, Flow } from '../types';

/** ユニークID生成 */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** 最も近い未来の締め切りフローを返す */
export function nearestDeadline(company: Company): Flow | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcoming = (company.flows ?? [])
    .filter((f) => f.deadline && f.status !== 'failed')
    .filter((f) => new Date(f.deadline + 'T00:00:00') >= now)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  return upcoming[0] ?? null;
}

/** 今日からn日後かを返す（負 = 過去）*/
export function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
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

/** 今日の日付文字列 (YYYY-MM-DD) */
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
