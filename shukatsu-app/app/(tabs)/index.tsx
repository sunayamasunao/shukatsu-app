import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies } from '@/src/context/CompaniesContext';
import { Colors, radius, shadow, spacing } from '@/src/theme';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { Company, CompanyStatus } from '@/src/types';
import { TodaySection, UpcomingSection } from '@/src/components/HomeSections';
import { SyncBanner } from '@/src/components/SyncBanner';
import {
  compareCompanyName, daysUntil, formatDateShort, industryOrder, nearestDeadline, selectionDate,
} from '@/src/utils';

type SortMode = 'deadline' | 'industry' | 'company' | 'status';

const STATUS_LABEL: Record<CompanyStatus, string> = {
  active: '選考中',
  offer: '内定',
  declined: '辞退',
  rejected: '不合格',
};
const STATUS_COLOR_FOR = (colors: Colors): Record<CompanyStatus, { bg: string; text: string }> => ({
  active: { bg: colors.primaryLight, text: colors.primary },
  offer: { bg: colors.successLight, text: colors.success },
  declined: { bg: colors.surface2, text: colors.fgSub },
  rejected: { bg: colors.dangerLight, text: colors.danger },
});
const STATUS_BORDER_FOR = (colors: Colors): Record<CompanyStatus, string> => ({
  active: colors.primary,
  offer: colors.success,
  declined: colors.border,
  rejected: colors.danger,
});

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const STATUS_COLOR = useMemo(() => STATUS_COLOR_FOR(colors), [colors]);
  const STATUS_BORDER = useMemo(() => STATUS_BORDER_FOR(colors), [colors]);
  const router = useRouter();
  const { companies } = useCompanies();
  const [sortMode, setSortMode] = useState<SortMode>('deadline');

  const stats = useMemo(() => ({
    total: companies.length,
    active: companies.filter((c) => c.status === 'active').length,
    offer: companies.filter((c) => c.status === 'offer').length,
    rejected: companies.filter((c) => c.status === 'rejected').length,
  }), [companies]);

  const sorted = useMemo(() => {
    const list = [...companies];
    switch (sortMode) {
      case 'deadline':
        return list.sort((a, b) => {
          const na = nearestDeadline(a), nb = nearestDeadline(b);
          if (!na && !nb) return compareCompanyName(a.name, b.name);
          if (!na) return 1;
          if (!nb) return -1;
          return selectionDate(na).localeCompare(selectionDate(nb));
        });
      case 'industry':
        return list.sort(
          (a, b) => industryOrder(a.industry) - industryOrder(b.industry) || compareCompanyName(a.name, b.name),
        );
      case 'company':
        return list.sort((a, b) => compareCompanyName(a.name, b.name));
      case 'status': {
        const order: Record<CompanyStatus, number> = { active: 0, offer: 1, declined: 2, rejected: 3 };
        return list.sort(
          (a, b) => (order[a.status] ?? 0) - (order[b.status] ?? 0) || compareCompanyName(a.name, b.name),
        );
      }
      default:
        return list;
    }
  }, [companies, sortMode]);

  const renderCompany = useCallback(({ item }: { item: Company }) => {
    const nd = nearestDeadline(item);
    const sc = STATUS_COLOR[item.status] ?? STATUS_COLOR.active;
    const borderColor = STATUS_BORDER[item.status] ?? colors.border;

    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: borderColor }]}
        onPress={() => router.push(`/detail/${item.id}`)}
        activeOpacity={0.75}
      >
        {/* 企業名・ステータス */}
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.text }]}>{STATUS_LABEL[item.status]}</Text>
          </View>
        </View>

        {/* 業界タグ */}
        {item.industry ? (
          <View style={styles.cardMeta}>
            <View style={styles.tag}>
              <Ionicons name="business-outline" size={11} color={colors.fgMuted} />
              <Text style={styles.tagText}>{item.industry}</Text>
            </View>
          </View>
        ) : null}

        {/* 次の締め切り */}
        {nd ? (() => {
          const days = daysUntil(selectionDate(nd));
          const daysStr =
            days === 0 ? '今日！' : days < 0 ? `${Math.abs(days)}日前` : `あと${days}日`;
          const dateColor =
            days <= 3 ? colors.danger : days <= 7 ? colors.warning : colors.primary;
          return (
            <View style={styles.deadline}>
              <Text style={styles.deadlineLabel}>次の締切</Text>
              <Text style={styles.deadlineName} numberOfLines={1}>{nd.name}</Text>
              <Text style={[styles.deadlineDate, { color: dateColor }]}>
                {formatDateShort(selectionDate(nd))}（{daysStr}）
              </Text>
            </View>
          );
        })() : null}
      </TouchableOpacity>
    );
  }, [router, colors, styles, STATUS_COLOR, STATUS_BORDER]);

  const listHeader = (
    <View>
      <SyncBanner />

      {/* 統計タイル */}
      <View style={styles.statsRow}>
        {[
          { num: stats.total, label: '企業数', color: colors.fg },
          { num: stats.active, label: '選考中', color: colors.primary },
          { num: stats.offer, label: '内定', color: colors.success },
          { num: stats.rejected, label: '不合格', color: colors.danger },
        ].map(({ num, label, color }) => (
          <View key={label} style={styles.statCard}>
            <Text style={[styles.statNum, { color }]}>{num}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ④ 今日やること / 近日中の選考 */}
      <TodaySection />
      <UpcomingSection />

      {/* 企業一覧 */}
      <Text style={styles.listTitle}>企業一覧</Text>

      {/* 並べ替えチップ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sortScroll}
        contentContainerStyle={styles.sortContent}
      >
        {(
          [
            ['deadline', '締め切り順'],
            ['industry', '業界別'],
            ['company', '企業名順'],
            ['status', 'ステータス'],
          ] as [SortMode, string][]
        ).map(([mode, label]) => (
          <TouchableOpacity
            key={mode}
            style={[styles.chip, sortMode === mode && styles.chipActive]}
            onPress={() => setSortMode(mode)}
          >
            <Text style={[styles.chipText, sortMode === mode && styles.chipTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>ホーム</Text>
      </View>

      {/* 企業リスト */}
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={renderCompany}
        ListHeaderComponent={listHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>企業がまだありません</Text>
            <Text style={styles.emptySub}>右下の「＋」ボタンから就活先の企業を追加しましょう</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/add')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.fg, letterSpacing: -0.5 },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    ...shadow,
  },
  statNum: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: colors.fgMuted, marginTop: 2 },

  sortScroll: { flexGrow: 0, flexShrink: 0, marginBottom: 12, marginHorizontal: -spacing.md },
  listTitle: { fontSize: 17, fontWeight: '700', color: colors.fg, marginBottom: 10 },
  sortContent: { paddingHorizontal: spacing.md, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.fgMuted },
  chipTextActive: { color: colors.primary, fontWeight: '600' },

  listContent: { paddingHorizontal: spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 4,
    ...shadow,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  cardName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.fg },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { fontSize: 12, color: colors.fgMuted },
  deadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  deadlineLabel: { fontSize: 11, color: colors.fgSub },
  deadlineName: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.fg },
  deadlineDate: { fontSize: 12, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyIcon: { fontSize: 56, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.fg },
  emptySub: { fontSize: 15, lineHeight: 24, color: colors.fgMuted, textAlign: 'center', paddingHorizontal: 40 },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
