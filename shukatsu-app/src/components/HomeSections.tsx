/**
 * ホーム画面の「今日やること」「近日中の選考」セクション
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies } from '../context/CompaniesContext';
import { useTheme, useThemedStyles } from '../context/ThemeContext';
import { Colors, radius, shadow, spacing } from '../theme';
import { Priority, TodoItem } from '../types';
import { PRIORITY_META } from '../constants';
import { TaskCheckbox } from './TaskCheckbox';
import { buildCalendarEvents, buildTodos, daysLabel, daysUntil, formatDateShort, priorityOf } from '../utils';
import { selectionHref, reviewHref } from '../routes';

const VISIBLE = 3;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function priorityColor(p: Priority, colors: Colors): string {
  return p === 'today' ? colors.danger : p === 'soon' ? colors.warning : p === 'week' ? colors.primary : colors.border;
}

function TodoCard({ item }: { item: TodoItem }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { companies, updateSelection } = useCompanies();
  const meta = PRIORITY_META[item.priority];
  const openSelection = () => router.push(selectionHref(item.companyId, item.selectionId));

  const toggleTask = (taskId: string) => {
    const sel = companies.find((c) => c.id === item.companyId)?.flows.find((f) => f.id === item.selectionId);
    if (!sel) return;
    updateSelection(item.companyId, item.selectionId, {
      tasks: (sel.tasks ?? []).map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
    });
  };

  const isReview = item.kind === 'review';
  return (
    <TouchableOpacity
      style={[styles.todoCard, { borderLeftColor: isReview ? colors.border : priorityColor(item.priority, colors) }]}
      onPress={openSelection}
      activeOpacity={0.8}
    >
      <View style={styles.todoTop}>
        <Text style={styles.todoBadge}>
          {isReview ? '📝' : meta.icon} {item.days === 0 ? '今日' : daysLabel(item.days)}
        </Text>
        <Text style={styles.todoCompany} numberOfLines={1}>{item.companyName}</Text>
      </View>
      <Text style={styles.todoTitle}>{item.selectionName}</Text>

      {item.kind === 'missingPrep' && (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>⚠️ {item.message}</Text>
          <Text style={styles.warnLink}>準備を登録する ›</Text>
        </View>
      )}

      {item.kind === 'prep' && (
        <View style={{ marginTop: 6 }}>
          <Text style={styles.taskProgress}>
            準備 {item.tasks.filter((t) => t.done).length}/{item.tasks.length} 完了
          </Text>
          {item.tasks.slice(0, 5).map((t) => (
            <View key={t.id} style={styles.taskRow}>
              <TaskCheckbox label={t.text} checked={t.done} onToggle={() => toggleTask(t.id)} size="sm" />
            </View>
          ))}
          {item.tasks.length > 5 && <Text style={styles.moreText}>ほか{item.tasks.length - 5}件</Text>}
        </View>
      )}

      {item.kind === 'deadline' && (
        <Text style={styles.subText}>準備タスクを登録しておくと、ここでチェックできます</Text>
      )}

      {isReview && (
        <TouchableOpacity onPress={() => router.push(reviewHref(item.companyId, item.selectionId))}>
          <Text style={styles.subText}>{item.message}</Text>
          <Text style={styles.warnLink}>振り返りを書く ›</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export function TodaySection() {
  const styles = useThemedStyles(makeStyles);
  const { companies } = useCompanies();
  const [expanded, setExpanded] = useState(false);
  const todos = useMemo(() => buildTodos(companies), [companies]);

  if (companies.length === 0) return null;
  const shown = expanded ? todos : todos.slice(0, VISIBLE);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>今日やること</Text>
        {todos.length > 0 && <Text style={styles.sectionCount}>{todos.length}件</Text>}
      </View>
      {todos.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>🎉 今やるべきことはありません</Text>
        </View>
      ) : (
        <>
          {shown.map((t) => <TodoCard key={t.key} item={t} />)}
          {todos.length > VISIBLE && (
            <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={styles.moreBtn}>
              <Text style={styles.moreBtnText}>
                {expanded ? '閉じる' : `すべて表示（あと${todos.length - VISIBLE}件）`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

export function UpcomingSection() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { companies } = useCompanies();

  const events = useMemo(() => buildCalendarEvents(companies)
    .filter((e) => {
      const d = daysUntil(e.date);
      return d >= 0 && d <= 14 && e.status !== 'failed' && e.status !== 'declined';
    })
    .slice(0, 5), [companies]);

  if (events.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>近日中の選考</Text>
        <TouchableOpacity onPress={() => router.push('/calendar')}>
          <Text style={styles.sectionLink}>カレンダー ›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.upCard}>
        {events.map((e, i) => {
          const d = new Date(e.date + 'T00:00:00');
          const days = daysUntil(e.date);
          const color = priorityColor(priorityOf(days), colors);
          return (
            <TouchableOpacity
              key={e.key}
              style={[styles.upRow, i === events.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => router.push(selectionHref(e.companyId, e.selectionId))}
              activeOpacity={0.7}
            >
              <View style={styles.upDate}>
                <Text style={styles.upDateText}>{formatDateShort(e.date)}</Text>
                <Text style={styles.upDow}>{WEEKDAYS[d.getDay()]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.upCompany} numberOfLines={1}>{e.companyName}</Text>
                <Text style={styles.upName} numberOfLines={1}>
                  {e.selectionName}{e.type === 'deadline' ? '（締切）' : ''}{e.time ? `  ${e.time}` : ''}
                </Text>
              </View>
              <Text style={[styles.upDays, { color: days <= 7 ? color : colors.fgMuted }]}>
                {days === 0 ? '今日' : daysLabel(days)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  section: { marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.fg },
  sectionCount: { fontSize: 13, fontWeight: '600', color: colors.fgMuted },
  sectionLink: { fontSize: 13, fontWeight: '600', color: colors.primary },

  todoCard: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderLeftWidth: 4, marginBottom: 10, ...shadow,
  },
  todoTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  todoBadge: { fontSize: 12, fontWeight: '700', color: colors.fg },
  todoCompany: { flex: 1, fontSize: 12, color: colors.fgMuted },
  todoTitle: { fontSize: 15, fontWeight: '700', color: colors.fg },

  warnBox: {
    marginTop: 8, backgroundColor: colors.warningLight,
    borderRadius: radius.sm, padding: spacing.sm,
  },
  warnText: { fontSize: 13, color: colors.fg, lineHeight: 19 },
  warnLink: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 4 },

  taskProgress: { fontSize: 12, color: colors.fgMuted, fontWeight: '600', marginBottom: 4 },
  taskRow: { flexDirection: 'row', paddingVertical: 5 },
  moreText: { fontSize: 12, color: colors.fgSub, marginTop: 2, marginLeft: 28 },
  subText: { fontSize: 12, color: colors.fgMuted, marginTop: 6, lineHeight: 18 },

  moreBtn: { alignItems: 'center', paddingVertical: 6 },
  moreBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', ...shadow,
  },
  emptyText: { fontSize: 14, color: colors.fgMuted },

  upCard: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, ...shadow,
  },
  upRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  upDate: {
    width: 46, alignItems: 'center', paddingVertical: 4,
    backgroundColor: colors.surface2, borderRadius: radius.sm,
  },
  upDateText: { fontSize: 14, fontWeight: '700', color: colors.fg },
  upDow: { fontSize: 10, color: colors.fgMuted },
  upCompany: { fontSize: 12, color: colors.fgMuted },
  upName: { fontSize: 14, fontWeight: '600', color: colors.fg, marginTop: 1 },
  upDays: { fontSize: 12, fontWeight: '700' },
});
