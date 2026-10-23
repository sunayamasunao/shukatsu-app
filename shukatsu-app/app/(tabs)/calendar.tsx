import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies } from '@/src/context/CompaniesContext';
import { Colors, radius, readable, spacing, toneColors, type } from '@/src/theme';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { CalendarEvent } from '@/src/types';
import { buildCalendarEvents, daysUntil, todayStr as getToday } from '@/src/utils';
import {
  buildMonthGrid, CALENDAR_LEGEND, calendarEventTone, dateKey, daysTone, formatDateJa, groupByDate, WEEKDAYS,
} from '@/src/presentation';
import { IconButton } from '@/src/components/ui';
import { selectionHref } from '@/src/routes';

function daysText(days: number): string {
  return days === 0 ? '今日' : days < 0 ? `${Math.abs(days)}日前` : `あと${days}日`;
}

export default function CalendarScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { companies } = useCompanies();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  // 選択中の日付（null = 月全体の予定を表示）
  const [selected, setSelected] = useState<string | null>(null);

  const todayStr = getToday();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // 選考フローの実施日・締切 → 日付ごとのイベント一覧
  const eventMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    buildCalendarEvents(companies).forEach((e) => {
      (map[e.date] ??= []).push(e);
    });
    return map;
  }, [companies]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setSelected(null);
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    setSelected(null);
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };
  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelected(todayStr);
  };

  // 今月のイベント一覧（日順）
  const monthEvents = useMemo(() => {
    const list: CalendarEvent[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      list.push(...(eventMap[dateKey(year, month, d)] ?? []));
    }
    return list;
  }, [eventMap, year, month, daysInMonth]);

  const rows = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const groups = useMemo(
    () => groupByDate(selected ? (eventMap[selected] ?? []) : monthEvents),
    [selected, eventMap, monthEvents],
  );

  const renderEvent = (ev: CalendarEvent, last: boolean) => {
    const tone = toneColors(colors, calendarEventTone(ev));
    return (
      <TouchableOpacity
        key={ev.key}
        style={[styles.eventItem, last && { borderBottomWidth: 0 }]}
        activeOpacity={0.6}
        onPress={() => router.push(selectionHref(ev.companyId, ev.selectionId))}
      >
        <View style={[styles.eventBar, { backgroundColor: tone.fg }]} />
        <View style={styles.eventInfo}>
          <Text style={styles.eventCompany} numberOfLines={1}>{ev.companyName}</Text>
          <Text style={styles.eventFlow} numberOfLines={1}>
            {ev.selectionName}
            {ev.type === 'deadline' ? '（締切）' : ''}
          </Text>
        </View>
        {ev.time ? <Text style={styles.eventTime}>{ev.time}</Text> : null}
        <Ionicons name="chevron-forward" size={16} color={colors.fgSub} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* ヘッダー */}
        <View style={styles.calHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.yearLabel}>{year}年</Text>
            <Text style={styles.monthLabel}>{month + 1}月</Text>
          </View>
          {!isCurrentMonth || (selected !== null && selected !== todayStr) ? (
            <TouchableOpacity style={styles.todayBtn} onPress={goToday} activeOpacity={0.6}>
              <Text style={styles.todayBtnText}>今日</Text>
            </TouchableOpacity>
          ) : null}
          <IconButton icon="chevron-back" onPress={prevMonth} accessibilityLabel="前の月" />
          <IconButton icon="chevron-forward" onPress={nextMonth} accessibilityLabel="次の月" />
        </View>

        {/* 曜日ヘッダー */}
        <View style={styles.dowRow}>
          {WEEKDAYS.map((d, i) => (
            <Text
              key={d}
              style={[styles.dowText, i === 0 && { color: colors.danger }, i === 6 && { color: colors.primary }]}
            >
              {d}
            </Text>
          ))}
        </View>

        {/* カレンダーグリッド */}
        <View style={styles.grid}>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map((day, ci) => {
                if (!day) return <View key={ci} style={styles.cell} />;
                const key = dateKey(year, month, day);
                const events = eventMap[key] ?? [];
                const isToday = key === todayStr;
                const isSelected = key === selected;
                return (
                  <TouchableOpacity
                    key={ci}
                    style={styles.cell}
                    onPress={() => setSelected(isSelected ? null : key)}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${month + 1}月${day}日 予定${events.length}件`}
                  >
                    <View style={[
                      styles.dayCircle,
                      isSelected && { backgroundColor: isToday ? colors.primary : colors.fg },
                    ]}>
                      <Text style={[
                        styles.dayText,
                        isToday && { color: colors.primary, fontWeight: '800' },
                        isSelected && { color: isToday ? colors.onPrimary : colors.bg, fontWeight: '800' },
                      ]}>
                        {day}
                      </Text>
                    </View>
                    {/* 予定マーカー */}
                    <View style={styles.dots}>
                      {events.slice(0, 3).map((e) => (
                        <View
                          key={e.key}
                          style={[styles.dot, { backgroundColor: toneColors(colors, calendarEventTone(e)).fg }]}
                        />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* 凡例 */}
        <View style={styles.legend}>
          {CALENDAR_LEGEND.map((l) => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: toneColors(colors, l.tone).fg }]} />
              <Text style={styles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>

        {/* 予定一覧 */}
        <View style={styles.listHead}>
          <Text style={styles.listTitle}>{selected ? formatDateJa(selected) : '今月の予定'}</Text>
          {selected ? (
            <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8} activeOpacity={0.6}>
              <Text style={styles.listLink}>月全体を表示</Text>
            </TouchableOpacity>
          ) : monthEvents.length > 0 ? (
            <Text style={styles.listCount}>{monthEvents.length}件</Text>
          ) : null}
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyEvents}>
            <Ionicons name="calendar-clear-outline" size={22} color={colors.fgSub} />
            <Text style={styles.emptyEventsText}>
              {selected ? 'この日の予定はありません' : 'この月の予定はありません'}
            </Text>
          </View>
        ) : (
          groups.map((g) => {
            const d = new Date(g.date + 'T00:00:00');
            const days = daysUntil(g.date);
            const dt = daysTone(days);
            const daysColor = dt === 'neutral' ? colors.fgSub : toneColors(colors, dt).fg;
            return (
              <View key={g.date} style={styles.dayGroup}>
                {!selected && (
                  <View style={styles.dayHead}>
                    <Text style={styles.dayHeadNum}>{d.getDate()}</Text>
                    <Text style={styles.dayHeadDow}>{WEEKDAYS[d.getDay()]}曜日</Text>
                    <Text style={[styles.dayHeadDays, { color: daysColor }]}>{daysText(days)}</Text>
                  </View>
                )}
                {selected && (
                  <Text style={[styles.dayHeadDays, { color: daysColor, marginBottom: 6 }]}>{daysText(days)}</Text>
                )}
                <View style={styles.eventGroup}>
                  {g.items.map((ev, i) => renderEvent(ev, i === g.items.length - 1))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { ...readable, paddingHorizontal: spacing.screen, paddingBottom: spacing.tabBar },

  calHeader: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingTop: spacing.md, marginBottom: spacing.lg,
  },
  yearLabel: { ...type.subhead, fontWeight: '600', color: colors.fgMuted },
  monthLabel: { ...type.largeTitle, color: colors.fg },
  todayBtn: {
    height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center',
    backgroundColor: colors.primaryLight, marginRight: 4,
  },
  todayBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },

  dowRow: { flexDirection: 'row', marginBottom: 4 },
  dowText: {
    flex: 1, textAlign: 'center',
    fontSize: 12, fontWeight: '600', color: colors.fgSub,
    paddingVertical: 6,
  },

  grid: { marginBottom: 12 },
  row: { flexDirection: 'row' },
  cell: {
    flex: 1, minHeight: 54,
    alignItems: 'center', justifyContent: 'flex-start',
    paddingTop: 4,
  },
  dayCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  dayText: { fontSize: 17, fontWeight: '500', color: colors.fg, fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', gap: 3, marginTop: 3, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    paddingBottom: spacing.lg, marginBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 12, color: colors.fgMuted },

  listHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  listTitle: { ...type.headline, color: colors.fg },
  listCount: { fontSize: 14, fontWeight: '600', color: colors.fgMuted },
  listLink: { fontSize: 14, fontWeight: '600', color: colors.primary },

  emptyEvents: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 28, backgroundColor: colors.surface, borderRadius: radius.md,
  },
  emptyEventsText: { fontSize: 15, color: colors.fgMuted },

  dayGroup: { marginBottom: 20 },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  dayHeadNum: { ...type.number, fontSize: 22, color: colors.fg },
  dayHeadDow: { fontSize: 13, color: colors.fgMuted, flex: 1 },
  dayHeadDays: { fontSize: 13, fontWeight: '700' },

  eventGroup: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
  eventItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingRight: spacing.md, marginLeft: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  eventBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  eventInfo: { flex: 1, minWidth: 0 },
  eventCompany: { fontSize: 16, fontWeight: '600', color: colors.fg },
  eventFlow: { fontSize: 13, color: colors.fgMuted, marginTop: 2 },
  eventTime: { fontSize: 14, fontWeight: '600', color: colors.fg, fontVariant: ['tabular-nums'] },
});
