import React, { useCallback, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies } from '@/src/context/CompaniesContext';
import { Colors, readable, spacing, toneColors, type } from '@/src/theme';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { Company, CompanyStatus } from '@/src/types';
import { TodaySection, UpcomingSection } from '@/src/components/HomeSections';
import { SyncBanner } from '@/src/components/SyncBanner';
import { EmptyState, IconButton, LargeTitle, PrimaryButton } from '@/src/components/ui';
import {
  companyInitial, companyStatusTone, daysTone, formatDateJa,
} from '@/src/presentation';
import {
  compareCompanyName, daysUntil, formatDateShort, industryOrder, nearestDeadline, selectionDate, todayStr,
} from '@/src/utils';

type SortMode = 'deadline' | 'industry' | 'company' | 'status';

const STATUS_LABEL: Record<CompanyStatus, string> = {
  active: '選考中',
  offer: '内定',
  declined: '辞退',
  rejected: '不合格',
};

const SORT_OPTIONS: [SortMode, string][] = [
  ['deadline', '締め切り順'],
  ['industry', '業界別'],
  ['company', '企業名順'],
  ['status', 'ステータス'],
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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

  // 並べ替え: iOS はアクションシート、それ以外は順に切り替える
  const chooseSort = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: '並べ替え',
          options: [...SORT_OPTIONS.map(([, label]) => label), 'キャンセル'],
          cancelButtonIndex: SORT_OPTIONS.length,
        },
        (i) => { if (i < SORT_OPTIONS.length) setSortMode(SORT_OPTIONS[i][0]); },
      );
      return;
    }
    const i = SORT_OPTIONS.findIndex(([m]) => m === sortMode);
    setSortMode(SORT_OPTIONS[(i + 1) % SORT_OPTIONS.length][0]);
  };

  const renderCompany = useCallback(({ item }: { item: Company }) => {
    const nd = nearestDeadline(item);
    const tone = toneColors(colors, companyStatusTone(item.status));
    const days = nd ? daysUntil(selectionDate(nd)) : null;
    const daysStr = days === null ? '' : days === 0 ? '今日' : days < 0 ? `${Math.abs(days)}日前` : `あと${days}日`;
    const dTone = days === null ? null : daysTone(days);
    const daysColor = dTone && dTone !== 'neutral' ? toneColors(colors, dTone).fg : colors.fgMuted;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/detail/${item.id}`)}
        activeOpacity={0.6}
        accessibilityRole="button"
      >
        <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
          <Text style={[styles.avatarText, { color: tone.fg }]}>{companyInitial(item.name)}</Text>
        </View>

        <View style={styles.rowBody}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            <Text style={{ color: tone.fg, fontWeight: '600' }}>{STATUS_LABEL[item.status]}</Text>
            {item.industry ? `  ·  ${item.industry}` : ''}
          </Text>
        </View>

        {nd ? (
          <View style={styles.rowRight}>
            <Text style={[styles.rowDays, { color: daysColor }]}>{daysStr}</Text>
            <Text style={styles.rowNext} numberOfLines={1}>
              {nd.name} {formatDateShort(selectionDate(nd))}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }, [router, colors, styles]);

  // 企業数の内訳（選考中・内定・不合格・その他=辞退）
  const others = Math.max(0, stats.total - stats.active - stats.offer - stats.rejected);
  const segments = [
    { n: stats.active, color: colors.primary },
    { n: stats.offer, color: colors.success },
    { n: stats.rejected, color: colors.danger },
    { n: others, color: colors.fgSub },
  ].filter((s) => s.n > 0);

  const listHeader = (
    <View>
      <LargeTitle
        eyebrow={formatDateJa(todayStr())}
        title="ホーム"
        right={<IconButton icon="add" onPress={() => router.push('/add')} accessibilityLabel="企業を追加" size={40} />}
      />

      <SyncBanner />

      {/* 企業数の内訳 */}
      <View style={styles.overview}>
        <View style={styles.overviewTop}>
          <Text style={styles.totalNum}>{stats.total}</Text>
          <Text style={styles.totalUnit}>社を管理中</Text>
        </View>
        <View style={styles.pipeline}>
          {segments.length === 0
            ? <View style={[styles.pipeSeg, { flex: 1, backgroundColor: colors.surface }]} />
            : segments.map((s, i) => (
              <View key={i} style={[styles.pipeSeg, { flex: s.n, backgroundColor: s.color }]} />
            ))}
        </View>
        <View style={styles.legend}>
          {[
            { num: stats.active, label: '選考中', color: colors.primary },
            { num: stats.offer, label: '内定', color: colors.success },
            { num: stats.rejected, label: '不合格', color: colors.danger },
          ].map(({ num, label, color }) => (
            <View key={label} style={styles.legendItem}>
              <View style={styles.legendLabelRow}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendLabel}>{label}</Text>
              </View>
              <Text style={styles.legendNum}>{num}<Text style={styles.legendUnit}> 社</Text></Text>
            </View>
          ))}
        </View>
      </View>

      {/* 今日やること / 近日中の選考 */}
      <TodaySection />
      <UpcomingSection />

      {/* 企業一覧 */}
      {companies.length > 0 && (
        <View style={styles.listHead}>
          <Text style={styles.listTitle}>企業一覧</Text>
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={chooseSort}
            activeOpacity={0.6}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="並べ替え"
          >
            <Text style={styles.sortText}>{SORT_OPTIONS.find(([m]) => m === sortMode)?.[1]}</Text>
            <Ionicons name="chevron-down" size={15} color={colors.fg} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={renderCompany}
        ListHeaderComponent={listHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon="briefcase-outline"
            title="企業がまだありません"
            message="右上の「＋」ボタンから就活先の企業を追加しましょう"
          >
            <View style={{ marginTop: 12, alignSelf: 'stretch', paddingHorizontal: 40 }}>
              <PrimaryButton label="企業を追加" icon="add" onPress={() => router.push('/add')} />
            </View>
          </EmptyState>
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  listContent: { ...readable, paddingHorizontal: spacing.screen, paddingBottom: spacing.tabBar },

  overview: { marginBottom: spacing.section },
  overviewTop: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 12 },
  totalNum: { ...type.number, fontSize: 40, lineHeight: 46, color: colors.fg },
  totalUnit: { fontSize: 15, fontWeight: '600', color: colors.fgMuted },
  pipeline: {
    flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2,
    marginBottom: 14,
  },
  pipeSeg: { height: '100%' },
  legend: { flexDirection: 'row' },
  legendItem: { flex: 1 },
  legendLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 13, color: colors.fgMuted },
  legendNum: { ...type.number, fontSize: 20, color: colors.fg, marginTop: 4 },
  legendUnit: { fontSize: 13, fontWeight: '500', color: colors.fgMuted },

  listHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  listTitle: { ...type.headline, color: colors.fg },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  sortText: { fontSize: 14, fontWeight: '700', color: colors.fg },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, minHeight: 68 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '800' },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.fg },
  rowMeta: { fontSize: 13, color: colors.fgMuted, marginTop: 3 },
  rowRight: { alignItems: 'flex-end', maxWidth: 130 },
  rowDays: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rowNext: { fontSize: 12, color: colors.fgMuted, marginTop: 3 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 58 },
});
