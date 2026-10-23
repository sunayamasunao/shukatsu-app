/**
 * ホーム画面の「今日やること」「近日中の選考」セクション
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies } from '../context/CompaniesContext';
import { useTheme, useThemedStyles } from '../context/ThemeContext';
import { Colors, radius, spacing, toneColors, type } from '../theme';
import { TodoItem } from '../types';
import { TaskCheckbox } from './TaskCheckbox';
import { ProgressBar } from './ui';
import { buildCalendarEvents, buildTodos, daysLabel, daysUntil, priorityOf } from '../utils';
import { priorityTone, WEEKDAYS } from '../presentation';
import { selectionHref, reviewHref } from '../routes';

const VISIBLE = 3;

function TodoCard({ item }: { item: TodoItem }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { companies, updateSelection } = useCompanies();
  const openSelection = () => router.push(selectionHref(item.companyId, item.selectionId));

  const toggleTask = (taskId: string) => {
    const sel = companies.find((c) => c.id === item.companyId)?.flows.find((f) => f.id === item.selectionId);
    if (!sel) return;
    updateSelection(item.companyId, item.selectionId, {
      tasks: (sel.tasks ?? []).map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
    });
  };

  const isReview = item.kind === 'review';
  const tone = isReview ? toneColors(colors, 'neutral') : toneColors(colors, priorityTone(item.priority));
  const doneCount = item.tasks.filter((t) => t.done).length;

  return (
    <TouchableOpacity style={styles.todoCard} onPress={openSelection} activeOpacity={0.7}>
      <View style={styles.todoTop}>
        {isReview
          ? <Ionicons name="document-text-outline" size={14} color={colors.fgMuted} />
          : <View style={[styles.dot, { backgroundColor: tone.fg }]} />}
        <Text style={[styles.todoWhen, { color: tone.fg }]}>
          {item.days === 0 ? '今日' : daysLabel(item.days)}
        </Text>
        <Text style={styles.todoCompany} numberOfLines={1}>{item.companyName}</Text>
      </View>
      <Text style={styles.todoTitle}>{item.selectionName}</Text>

      {item.kind === 'missingPrep' && (
        <View style={styles.warnRow}>
          <Ionicons name="alert-circle" size={16} color={colors.warning} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warnText}>{item.message}</Text>
            <Text style={styles.link}>準備を登録する ›</Text>
          </View>
        </View>
      )}

      {item.kind === 'prep' && (
        <View style={{ marginTop: 12 }}>
          <View style={styles.progressRow}>
            <ProgressBar
              value={item.tasks.length ? doneCount / item.tasks.length : 0}
              tone={doneCount === item.tasks.length ? 'success' : 'primary'}
              height={4}
              style={{ flex: 1 }}
            />
            <Text style={styles.taskProgress}>
              準備 {doneCount}/{item.tasks.length} 完了
            </Text>
          </View>
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
        <TouchableOpacity onPress={() => router.push(reviewHref(item.companyId, item.selectionId))} activeOpacity={0.6}>
          <Text style={styles.subText}>{item.message}</Text>
          <Text style={styles.link}>振り返りを書く ›</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export function TodaySection() {
  const { colors } = useTheme();
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
        {todos.length > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{todos.length}件</Text>
          </View>
        )}
      </View>
      {todos.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <Text style={styles.emptyText}>今やるべきことはありません</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {shown.map((t) => <TodoCard key={t.key} item={t} />)}
          {todos.length > VISIBLE && (
            <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={styles.moreBtn} activeOpacity={0.6}>
              <Text style={styles.moreBtnText}>
                {expanded ? '閉じる' : `すべて表示（あと${todos.length - VISIBLE}件）`}
              </Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
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
        <TouchableOpacity onPress={() => router.push('/calendar')} hitSlop={8} activeOpacity={0.6}>
          <Text style={styles.sectionLink}>カレンダー ›</Text>
        </TouchableOpacity>
      </View>
      <View>
        {events.map((e, i) => {
          const d = new Date(e.date + 'T00:00:00');
          const days = daysUntil(e.date);
          const tone = priorityTone(priorityOf(days));
          const daysColor = days <= 7 && tone !== 'neutral' ? toneColors(colors, tone).fg : colors.fgMuted;
          const isDeadline = e.type === 'deadline';
          return (
            <TouchableOpacity
              key={e.key}
              style={[styles.upRow, i === events.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => router.push(selectionHref(e.companyId, e.selectionId))}
              activeOpacity={0.6}
            >
              <View style={styles.upDate}>
                <Text style={styles.upMonth}>{d.getMonth() + 1}月</Text>
                <Text style={styles.upDay}>{d.getDate()}</Text>
                <Text style={styles.upDow}>{WEEKDAYS[d.getDay()]}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.upCompany} numberOfLines={1}>{e.companyName}</Text>
                <Text style={styles.upName} numberOfLines={1}>
                  {e.selectionName}{isDeadline ? '（締切）' : ''}{e.time ? `  ${e.time}` : ''}
                </Text>
              </View>
              <Text style={[styles.upDays, { color: daysColor }]}>
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
  section: { marginBottom: spacing.section },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: { ...type.headline, color: colors.fg },
  countPill: {
    backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3,
  },
  countText: { fontSize: 13, fontWeight: '700', color: colors.fgMuted },
  sectionLink: { fontSize: 14, fontWeight: '600', color: colors.primary },

  todoCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md + 2,
  },
  todoTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  todoWhen: { fontSize: 13, fontWeight: '800' },
  todoCompany: { flex: 1, fontSize: 13, color: colors.fgMuted, marginLeft: 2 },
  todoTitle: { fontSize: 18, fontWeight: '700', color: colors.fg, lineHeight: 24 },

  warnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  warnText: { fontSize: 14, color: colors.fg, lineHeight: 20 },
  link: { fontSize: 14, color: colors.primary, fontWeight: '700', marginTop: 6 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  taskProgress: { fontSize: 12, color: colors.fgMuted, fontWeight: '600', fontVariant: ['tabular-nums'] },
  taskRow: { flexDirection: 'row', paddingVertical: 7 },
  moreText: { fontSize: 13, color: colors.fgSub, marginTop: 2, marginLeft: 32 },
  subText: { fontSize: 14, color: colors.fgMuted, marginTop: 8, lineHeight: 20 },

  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  moreBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },

  emptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md + 2,
  },
  emptyText: { fontSize: 15, color: colors.fg, fontWeight: '500' },

  upRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  upDate: { width: 44, alignItems: 'center' },
  upMonth: { fontSize: 10, fontWeight: '600', color: colors.fgMuted },
  upDay: { ...type.number, fontSize: 22, lineHeight: 26, color: colors.fg },
  upDow: { fontSize: 11, color: colors.fgMuted },
  upCompany: { fontSize: 13, color: colors.fgMuted },
  upName: { fontSize: 16, fontWeight: '600', color: colors.fg, marginTop: 2 },
  upDays: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
