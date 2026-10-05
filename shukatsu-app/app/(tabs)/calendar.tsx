import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies } from '@/src/context/CompaniesContext';
import { Colors, radius, shadow, spacing } from '@/src/theme';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { CalendarEvent } from '@/src/types';
import { buildCalendarEvents, daysUntil, formatDateFull, todayStr as getToday } from '@/src/utils';
import { selectionHref } from '@/src/routes';

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export default function CalendarScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { companies } = useCompanies();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const todayStr = getToday();

  // 選考フローの実施日・締切 → 日付ごとのイベント一覧
  const eventMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    buildCalendarEvents(companies).forEach((e) => {
      (map[e.date] ??= []).push(e);
    });
    return map;
  }, [companies]);

  // カレンダーグリッド生成
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=日

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  // 今月のイベント一覧（日順）
  const monthEvents = useMemo(() => {
    const list: CalendarEvent[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      list.push(...(eventMap[key] ?? []));
    }
    return list;
  }, [eventMap, year, month, daysInMonth]);

  // カレンダーセルを配列で生成
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* ヘッダー */}
        <View style={styles.calHeader}>
          <Text style={styles.monthLabel}>{year}年{month + 1}月</Text>
          <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
            <Ionicons name="chevron-back" size={18} color={colors.fg} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
            <Ionicons name="chevron-forward" size={18} color={colors.fg} />
          </TouchableOpacity>
        </View>

        {/* 曜日ヘッダー */}
        <View style={styles.dowRow}>
          {DOW_LABELS.map((d, i) => (
            <Text key={d} style={styles.dowText}>{d}</Text>
          ))}
        </View>

        {/* カレンダーグリッド */}
        <View style={styles.grid}>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {Array.from({ length: 7 }).map((_, ci) => {
                const day = row[ci] ?? null;
                if (!day) return <View key={ci} style={styles.cell} />;
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const events = eventMap[dateKey] ?? [];
                const isToday = dateKey === todayStr;
                return (
                  <View key={ci} style={styles.cell}>
                    <View style={[styles.dayCircle, isToday && styles.dayCircleToday]}>
                      <Text style={[styles.dayText, isToday && styles.dayTextToday]}>{day}</Text>
                    </View>
                    {/* イベントドット */}
                    {events.length > 0 && (
                      <View style={styles.dots}>
                        {events.slice(0, 3).map((e) => (
                          <View
                            key={e.key}
                            style={[styles.dot, {
                              backgroundColor: e.type === 'deadline' ? colors.warning : colors.primary,
                            }]}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* 今月のイベント一覧 */}
        {monthEvents.length === 0 ? (
          <View style={styles.emptyEvents}>
            <Text style={styles.emptyEventsText}>この月の予定はありません</Text>
          </View>
        ) : (
          <View style={styles.eventList}>
            <Text style={styles.eventListTitle}>今月の予定</Text>
            {monthEvents.map((ev) => {
              const days = daysUntil(ev.date);
              const daysStr =
                days === 0 ? '今日' : days < 0 ? `${Math.abs(days)}日前` : `あと${days}日`;
              const daysColor =
                days <= 3 ? colors.danger : days <= 7 ? colors.warning : colors.fgSub;
              const dotColor =
                ev.status === 'passed' ? colors.success
                : ev.status === 'failed' ? colors.danger
                : ev.type === 'deadline' ? colors.warning
                : colors.primary;
              return (
                <TouchableOpacity
                  key={ev.key}
                  style={styles.eventItem}
                  activeOpacity={0.7}
                  onPress={() => router.push(selectionHref(ev.companyId, ev.selectionId))}
                >
                  <View style={[styles.eventDot, { backgroundColor: dotColor }]} />
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventCompany}>{ev.companyName}</Text>
                    <Text style={styles.eventFlow}>
                      {ev.selectionName}
                      {ev.type === 'deadline' ? '（締切）' : ''}
                      {ev.time ? `  ${ev.time}` : ''}
                    </Text>
                  </View>
                  <View style={styles.eventRight}>
                    <Text style={styles.eventDate}>{formatDateFull(ev.date)}</Text>
                    <Text style={[styles.eventDays, { color: daysColor }]}>{daysStr}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.fgSub} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 40 },

  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  monthLabel: { flex: 1, fontSize: 26, fontWeight: '700', color: colors.fg, letterSpacing: -0.5 },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    ...shadow,
  },

  dowRow: { flexDirection: 'row', marginBottom: 8 },
  dowText: {
    flex: 1, textAlign: 'center',
    fontSize: 12, fontWeight: '600', color: colors.fgSub,
    paddingVertical: 6,
  },

  grid: { marginBottom: 24 },
  row: { flexDirection: 'row' },
  cell: {
    flex: 1, minHeight: 58,
    alignItems: 'center', justifyContent: 'flex-start',
    paddingTop: 4,
  },
  dayCircle: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  dayCircleToday: { backgroundColor: colors.primary },
  dayText: { fontSize: 15, fontWeight: '600', color: colors.fg },
  dayTextToday: { color: '#fff', fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },

  eventListTitle: {
    fontSize: 13, fontWeight: '700',
    color: colors.fgMuted, letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 10,
  },
  emptyEvents: { alignItems: 'center', paddingVertical: 40 },
  emptyEventsText: { fontSize: 15, color: colors.fgMuted },
  eventList: { gap: 8 },
  eventItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, ...shadow,
  },
  eventDot: { width: 10, height: 10, borderRadius: 5 },
  eventInfo: { flex: 1 },
  eventCompany: { fontSize: 14, fontWeight: '600', color: colors.fg },
  eventFlow: { fontSize: 12, color: colors.fgMuted, marginTop: 2 },
  eventRight: { alignItems: 'flex-end' },
  eventDate: { fontSize: 12, color: colors.fgMuted },
  eventDays: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
