import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies } from '@/src/context/CompaniesContext';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { Colors, radius, readable, spacing, type } from '@/src/theme';
import { EvalKey } from '@/src/types';
import { DEFAULT_WEIGHTS, EVAL_KEYS, EVAL_LABELS, STATUS_LABEL } from '@/src/constants';
import { compatibilityScore, latestMotivation } from '@/src/utils';
import { StarText } from '@/src/components/StarRating';
import { EmptyState, LargeTitle, ProgressBar, Section, Segmented } from '@/src/components/ui';

type Scope = 'offer' | 'all';

const LABEL_W = 108;
const COL_W = 116;
const HEAD_H = 56;
const ROW_H = 50;

export default function CompareScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { companies, weights, setWeights } = useCompanies();

  const offerCount = companies.filter((c) => c.status === 'offer').length;
  const [scope, setScope] = useState<Scope | null>(null);
  const effectiveScope: Scope = scope ?? (offerCount >= 1 ? 'offer' : 'all');

  const targets = useMemo(() => companies.filter((c) =>
    effectiveScope === 'offer' ? c.status === 'offer' : c.status === 'offer' || c.status === 'active'),
  [companies, effectiveScope]);

  // 相性スコア順
  const ranked = useMemo(() => targets
    .map((c) => ({ company: c, ...compatibilityScore(c, weights) }))
    .sort((a, b) => {
      const rank = (r: { score: number | null; tentative: boolean }) => (r.score === null ? 2 : r.tentative ? 1 : 0);
      return rank(a) - rank(b) || (b.score ?? -1) - (a.score ?? -1);
    }),
  [targets, weights]);

  const totalWeight = EVAL_KEYS.reduce((s, k) => s + (weights[k] ?? 0), 0);
  const changeWeight = (k: EvalKey, delta: number) =>
    setWeights({ ...weights, [k]: Math.max(0, Math.min(100, (weights[k] ?? 0) + delta)) });

  // 各行の最高評価を強調
  const bestOf = (k: EvalKey) => Math.max(0, ...ranked.map((r) => r.company.evaluation?.[k] ?? 0));

  // 1位（スコアが確定している場合のみ）は大きく見せる
  const leader = ranked[0] && ranked[0].score != null && !ranked[0].tentative ? ranked[0] : null;
  const rest = leader ? ranked.slice(1) : ranked;
  const tableKeys = EVAL_KEYS.filter((k) => k !== 'motivation');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <LargeTitle
          title="内定比較"
          subtitle="「自分が何を重視するか」×「自分の評価」で相性を計算します"
        />

        {/* 対象切り替え */}
        <View style={{ marginBottom: spacing.lg }}>
          <Segmented
            value={effectiveScope}
            onChange={setScope}
            options={[
              { value: 'offer', label: `内定企業（${offerCount}）` },
              { value: 'all', label: '選考中も含める' },
            ]}
          />
        </View>

        {ranked.length === 0 ? (
          <EmptyState
            icon="podium-outline"
            title={effectiveScope === 'offer' ? 'まだ内定企業がありません' : '比較できる企業がありません'}
            message="企業カルテで「自分の評価」を付けると、ここで比較できます"
          />
        ) : (
          <>
            {/* 相性スコア */}
            <Section title="自分との相性スコア">
              {leader && (
                <TouchableOpacity
                  style={styles.hero}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/detail/${leader.company.id}`)}
                >
                  <Text style={styles.heroCaption}>1位・いちばん相性が良い企業</Text>
                  <View style={styles.heroRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.heroName} numberOfLines={2}>{leader.company.name}</Text>
                      <Text style={styles.heroStatus}>{STATUS_LABEL[leader.company.status]}</Text>
                    </View>
                    <Text style={styles.heroScore}>
                      {leader.score}<Text style={styles.heroUnit}> 点</Text>
                    </Text>
                  </View>
                  <ProgressBar value={(leader.score ?? 0) / 100} height={8} style={{ marginTop: 14 }} />
                  {leader.missing.length > 0 && (
                    <Text style={styles.missing} numberOfLines={2}>
                      未評価: {leader.missing.map((k) => EVAL_LABELS[k]).join('・')}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {rest.map(({ company, score, missing, tentative }, j) => {
                const i = leader ? j + 1 : j;
                return (
                  <TouchableOpacity
                    key={company.id}
                    style={[styles.scoreRow, j === rest.length - 1 && { borderBottomWidth: 0 }]}
                    activeOpacity={0.6}
                    onPress={() => router.push(`/detail/${company.id}`)}
                  >
                    <Text style={styles.rank}>{i + 1}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.scoreTop}>
                        <Text style={styles.scoreName} numberOfLines={1}>{company.name}</Text>
                        <Text style={styles.scoreStatus}>{STATUS_LABEL[company.status]}</Text>
                      </View>
                      <ProgressBar value={(score ?? 0) / 100} tone={tentative ? 'neutral' : 'primary'} height={5} />
                      {missing.length > 0 && (
                        <Text style={styles.missing} numberOfLines={1}>
                          未評価: {missing.map((k) => EVAL_LABELS[k]).join('・')}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', minWidth: 56 }}>
                      <Text style={[styles.scoreNum, tentative && { color: colors.fgSub }]}>
                        {score ?? '-'}<Text style={styles.scoreUnit}>{score != null ? '点' : ''}</Text>
                      </Text>
                      {tentative && <Text style={styles.tentative}>参考値</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Section>

            {/* 比較表（左の項目名は固定し、企業の列だけ横にスクロール） */}
            <Section title="比較表">
              <View style={styles.table}>
                <View style={[styles.labelCol, { width: LABEL_W }]}>
                  <View style={[styles.cell, styles.headCell, { height: HEAD_H }]} />
                  {tableKeys.map((k) => (
                    <View key={k} style={[styles.cell, styles.labelCell, { height: ROW_H }]}>
                      <Text style={styles.rowLabel} numberOfLines={2}>{EVAL_LABELS[k]}</Text>
                      <Text style={styles.rowWeight}>重み {weights[k] ?? 0}%</Text>
                    </View>
                  ))}
                  <View style={[styles.cell, styles.labelCell, { height: ROW_H }]}>
                    <Text style={styles.rowLabel}>志望度</Text>
                    <Text style={styles.rowWeight}>重み {weights.motivation ?? 0}%</Text>
                  </View>
                  <View style={[styles.cell, styles.labelCell, { height: ROW_H, borderBottomWidth: 0 }]}>
                    <Text style={[styles.rowLabel, { fontWeight: '800' }]}>相性スコア</Text>
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={ranked.length > 2} style={{ flex: 1 }}>
                  <View>
                    <View style={styles.tr}>
                      {ranked.map(({ company }) => (
                        <TouchableOpacity
                          key={company.id}
                          style={[styles.cell, styles.headCell, { width: COL_W, height: HEAD_H }]}
                          onPress={() => router.push(`/detail/${company.id}`)}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.thText} numberOfLines={2}>{company.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {tableKeys.map((k) => {
                      const best = bestOf(k);
                      return (
                        <View key={k} style={styles.tr}>
                          {ranked.map(({ company }) => {
                            const v = company.evaluation?.[k] ?? 0;
                            const isBest = v > 0 && v === best && ranked.length > 1;
                            return (
                              <View key={company.id} style={[styles.cell, { width: COL_W, height: ROW_H }]}>
                                <View style={[styles.cellInner, isBest && styles.tdBest]}>
                                  <StarText value={v} size={14} />
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                    <View style={styles.tr}>
                      {ranked.map(({ company }) => {
                        const m = latestMotivation(company);
                        return (
                          <View key={company.id} style={[styles.cell, { width: COL_W, height: ROW_H }]}>
                            <Text style={styles.motivation}>{m != null ? `${m}%` : '-'}</Text>
                          </View>
                        );
                      })}
                    </View>
                    <View style={styles.tr}>
                      {ranked.map(({ company, score, tentative }) => (
                        <View key={company.id} style={[styles.cell, { width: COL_W, height: ROW_H, borderBottomWidth: 0 }]}>
                          <Text style={[styles.tableScore, tentative && { color: colors.fgSub }]}>{score ?? '-'}</Text>
                          {tentative && <Text style={styles.tentativeSmall}>参考値</Text>}
                        </View>
                      ))}
                    </View>
                  </View>
                </ScrollView>
              </View>
              <Text style={styles.hint}>企業名をタップすると企業カルテで評価を編集できます</Text>
              {ranked.some((r) => r.tentative) && (
                <Text style={styles.hint}>「参考値」は重視する項目の半分以上が未評価のため、順位の後ろに表示しています</Text>
              )}
            </Section>
          </>
        )}

        {/* 重視すること */}
        <Section
          title="あなたが重視すること"
          right={
            <TouchableOpacity onPress={() => setWeights(DEFAULT_WEIGHTS)} hitSlop={8} activeOpacity={0.6}>
              <Text style={styles.resetText}>初期値に戻す</Text>
            </TouchableOpacity>
          }
        >
          <View style={styles.group}>
            {EVAL_KEYS.map((k, i) => {
              const w = weights[k] ?? 0;
              const share = totalWeight > 0 ? Math.round((w / totalWeight) * 100) : 0;
              return (
                <View key={k} style={[styles.weightRow, i === EVAL_KEYS.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.weightLabel} numberOfLines={1}>{EVAL_LABELS[k]}</Text>
                    <ProgressBar value={share / 100} height={4} style={{ marginRight: 8 }} />
                  </View>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => changeWeight(k, -5)}
                      accessibilityLabel={`${EVAL_LABELS[k]}を下げる`}
                      activeOpacity={0.5}
                    >
                      <Ionicons name="remove" size={18} color={colors.fg} />
                    </TouchableOpacity>
                    <Text style={styles.weightValue}>{w}%</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => changeWeight(k, 5)}
                      accessibilityLabel={`${EVAL_LABELS[k]}を上げる`}
                      activeOpacity={0.5}
                    >
                      <Ionicons name="add" size={18} color={colors.fg} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={[styles.total, totalWeight !== 100 && { color: colors.warning }]}>
            合計 {totalWeight}%{totalWeight !== 100 ? '（合計が100%でなくても比率で計算します）' : ''}
          </Text>
        </Section>

        {/* 意思決定メモ */}
        {ranked.some(({ company }) => company.status === 'offer') && (
          <Section title="意思決定メモ">
            <View style={{ gap: 10 }}>
              {ranked.filter(({ company }) => company.status === 'offer').map(({ company }) => (
                <TouchableOpacity
                  key={company.id}
                  style={styles.memoCard}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/detail/${company.id}`)}
                >
                  <View style={styles.decisionTop}>
                    <Text style={styles.decisionName} numberOfLines={1}>{company.name}</Text>
                    <Text style={styles.resetText}>{company.decision ? '編集 ›' : 'メモを書く ›'}</Text>
                  </View>
                  {company.decision ? (
                    ([
                      ['選んだ理由', company.decision.reason],
                      ['迷った理由', company.decision.hesitation],
                      ['入社後に期待すること', company.decision.expectation],
                    ] as const).filter(([, v]) => v).map(([label, v]) => (
                      <View key={label} style={{ marginTop: 10 }}>
                        <Text style={styles.decisionLabel}>{label}</Text>
                        <Text style={styles.decisionText} numberOfLines={3}>{v}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.hint}>この企業を選んだ理由・迷った理由・入社後に期待することを残せます</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { ...readable, paddingHorizontal: spacing.screen, paddingBottom: spacing.tabBar },

  resetText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.fgSub, marginTop: 8, lineHeight: 18 },

  hero: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md + 4, marginBottom: 8,
  },
  heroCaption: { fontSize: 13, fontWeight: '600', color: colors.fgMuted, marginBottom: 6 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  heroName: { ...type.title, color: colors.fg },
  heroStatus: { fontSize: 13, color: colors.fgMuted, marginTop: 2 },
  heroScore: { ...type.number, fontSize: 48, lineHeight: 54, color: colors.primary },
  heroUnit: { fontSize: 16, fontWeight: '700', color: colors.fgMuted, letterSpacing: 0 },

  scoreRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  rank: {
    width: 22, fontSize: 17, fontWeight: '800', color: colors.fgSub, textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  scoreTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  scoreName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.fg },
  scoreStatus: { fontSize: 12, color: colors.fgMuted },
  missing: { fontSize: 12, color: colors.warning, marginTop: 6 },
  tentative: {
    fontSize: 10, fontWeight: '700', color: colors.fgMuted, marginTop: 3,
    backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full,
    overflow: 'hidden',
  },
  tentativeSmall: { fontSize: 10, fontWeight: '700', color: colors.fgMuted, marginTop: 1 },
  scoreNum: { ...type.number, fontSize: 24, color: colors.fg },
  scoreUnit: { fontSize: 12, fontWeight: '600', color: colors.fgMuted, letterSpacing: 0 },

  table: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden',
  },
  labelCol: {
    borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border,
  },
  tr: { flexDirection: 'row' },
  cell: {
    paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headCell: { backgroundColor: colors.surface2 },
  labelCell: { alignItems: 'flex-start' },
  cellInner: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  tdBest: { backgroundColor: colors.primaryLight },
  thText: { fontSize: 13, fontWeight: '700', color: colors.fg, textAlign: 'center' },
  rowLabel: { fontSize: 13, fontWeight: '600', color: colors.fg },
  rowWeight: { fontSize: 11, color: colors.fgSub, marginTop: 2, fontVariant: ['tabular-nums'] },
  motivation: { fontSize: 15, fontWeight: '700', color: colors.primary, fontVariant: ['tabular-nums'] },
  tableScore: { ...type.number, fontSize: 20, color: colors.fg },

  group: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md },
  weightRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  weightLabel: { fontSize: 15, fontWeight: '500', color: colors.fg, marginBottom: 8 },
  stepper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.elevated, borderRadius: radius.full,
  },
  stepBtn: { width: 38, height: 34, alignItems: 'center', justifyContent: 'center' },
  weightValue: {
    width: 44, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.fg,
    fontVariant: ['tabular-nums'],
  },
  total: { fontSize: 12, color: colors.fgMuted, marginTop: 8, textAlign: 'right' },

  memoCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  decisionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  decisionName: { fontSize: 16, fontWeight: '700', color: colors.fg, flex: 1 },
  decisionLabel: { fontSize: 12, color: colors.fgMuted, fontWeight: '600' },
  decisionText: { fontSize: 14, color: colors.fg, lineHeight: 21, marginTop: 2 },
});
