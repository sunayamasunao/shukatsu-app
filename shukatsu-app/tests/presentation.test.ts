/**
 * 画面表示用の関数（src/presentation.ts）のテスト。
 * 色の意味づけやカレンダーのマス目が崩れると、見た目の回帰になるため確認しておく。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthGrid, calendarEventTone, companyInitial, companyStatusTone, dateKey, daysTone,
  flowStatusTone, formatDateJa, groupByDate, priorityTone,
} from '../src/presentation';

test('buildMonthGrid: 2026年10月は木曜始まり・31日・5週', () => {
  const rows = buildMonthGrid(2026, 9);
  assert.equal(rows.length, 5);
  assert.ok(rows.every((r) => r.length === 7));
  assert.deepEqual(rows[0].slice(0, 5), [null, null, null, null, 1]);
  const days = rows.flat().filter((d): d is number => d !== null);
  assert.equal(days.length, 31);
  assert.deepEqual(days, Array.from({ length: 31 }, (_, i) => i + 1));
});

test('buildMonthGrid: 日曜始まりで28日の月は4週ちょうど', () => {
  // 2026年2月1日は日曜
  const rows = buildMonthGrid(2026, 1);
  assert.equal(rows.length, 4);
  assert.equal(rows[0][0], 1);
  assert.equal(rows[3][6], 28);
});

test('dateKey: ゼロ埋めした YYYY-MM-DD を返す（月は0始まり）', () => {
  assert.equal(dateKey(2026, 0, 5), '2026-01-05');
  assert.equal(dateKey(2026, 11, 31), '2026-12-31');
});

test('groupByDate: 同じ日付をまとめ、順序を保つ', () => {
  const groups = groupByDate([
    { date: '2026-10-01', id: 'a' },
    { date: '2026-10-01', id: 'b' },
    { date: '2026-10-03', id: 'c' },
  ]);
  assert.deepEqual(groups.map((g) => [g.date, g.items.map((i) => i.id)]), [
    ['2026-10-01', ['a', 'b']],
    ['2026-10-03', ['c']],
  ]);
  assert.deepEqual(groupByDate([]), []);
});

test('ステータスの色: 意味ごとに一貫している', () => {
  assert.equal(companyStatusTone('active'), 'primary');
  assert.equal(companyStatusTone('offer'), 'success');
  assert.equal(companyStatusTone('rejected'), 'danger');
  assert.equal(companyStatusTone('declined'), 'neutral');
  assert.equal(flowStatusTone('passed'), 'success');
  assert.equal(flowStatusTone('failed'), 'danger');
  assert.equal(flowStatusTone('pending'), 'neutral');
});

test('カレンダーの予定の色: 結果 → 締切 → 選考 の順に判定する', () => {
  assert.equal(calendarEventTone({ type: 'event', status: 'passed' }), 'success');
  assert.equal(calendarEventTone({ type: 'deadline', status: 'failed' }), 'danger');
  assert.equal(calendarEventTone({ type: 'deadline', status: 'pending' }), 'warning');
  assert.equal(calendarEventTone({ type: 'event', status: 'pending' }), 'primary');
});

test('残り日数の緊急度', () => {
  assert.equal(daysTone(-1), 'neutral');
  assert.equal(daysTone(0), 'danger');
  assert.equal(daysTone(3), 'danger');
  assert.equal(daysTone(7), 'warning');
  assert.equal(daysTone(8), 'neutral');
  assert.equal(priorityTone('today'), 'danger');
  assert.equal(priorityTone('later'), 'neutral');
});

test('formatDateJa / companyInitial', () => {
  assert.equal(formatDateJa('2026-10-23'), '10月23日（金）');
  assert.equal(companyInitial('株式会社サンプル'), 'サ');
  assert.equal(companyInitial('（株）テスト'), 'テ');
  assert.equal(companyInitial('acme'), 'A');
  assert.equal(companyInitial('株式会社'), '株');
});
