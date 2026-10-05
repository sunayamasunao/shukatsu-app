import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies } from '@/src/context/CompaniesContext';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { Colors, radius, shadow, spacing } from '@/src/theme';
import { EvalKey } from '@/src/types';
import { DEFAULT_WEIGHTS, EVAL_KEYS, EVAL_LABELS, STATUS_LABEL } from '@/src/constants';
import { compatibilityScore, latestMotivation } from '@/src/utils';
import { StarText } from '@/src/components/StarRating';

type Scope = 'offer' | 'all';

const LABEL_W = 96;
const COL_W = 112;

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>内定比較</Text>
          <Text style={styles.subtitle}>「自分が何を重視するか」×「自分の評価」で相性を計算します</Text>
        </View>

        {/* 対象切り替え */}
        <View style={styles.scopeRow}>
          {([['offer', `内定企業（${offerCount}）`], ['all', '選考中も含める']] as [Scope, string][]).map(([v, label]) => (
            <TouchableOpacity
              key={v}
              style={[styles.chip, effectiveScope === v && styles.chipActive]}
              onPress={() => setScope(v)}
            >
              <Text style={[styles.chipText, effectiveScope === v && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {ranked.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyTitle}>
              {effectiveScope === 'offer' ? 'まだ内定企業がありません' : '比較できる企業がありません'}
            </Text>
            <Text style={styles.emptySub}>
              企業カルテで「自分の評価」を付けると、ここで比較できます
            </Text>
          </View>
        ) : (
          <>
            {/* 相性スコア */}
            <Text style={styles.sectionTitle}>自分との相性スコア</Text>
            {ranked.map(({ company, score, missing, tentative }, i) => (
              <TouchableOpacity
                key={company.id}
                style={styles.scoreCard}
                activeOpacity={0.8}
                onPress={() => router.push(`/detail/${company.id}`)}
              >
                <Text style={[styles.rank, i === 0 && score != null && !tentative && { color: colors.warning }]}>
                  {i === 0 && score != null && !tentative ? '👑' : `${i + 1}`}
                </Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.scoreTop}>
                    <Text style={styles.scoreName} numberOfLines={1}>{company.name}</Text>
                    <Text style={styles.scoreStatus}>{STATUS_LABEL[company.status]}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${score ?? 0}%` }, tentative && { backgroundColor: colors.fgSub }]} />
                  </View>
                  {missing.length > 0 && (
                    <Text style={styles.missing} numberOfLines={1}>
                      未評価: {missing.map((k) => EVAL_LABELS[k]).join('・')}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.scoreNum, tentative && { color: colors.fgSub }]}>
                    {score ?? '-'}<Text style={styles.scoreUnit}>{score != null ? '点' : ''}</Text>
                  </Text>
                  {tentative && <Text style={styles.tentative}>参考値</Text>}
                </View>
              </TouchableOpacity>
            ))}

            {/* 比較表 */}
            <Text style={styles.sectionTitle}>比較表</Text>
            <View style={styles.tableCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={[styles.tr, styles.trHead]}>
                    <View style={[styles.th, { width: LABEL_W }]} />
                    {ranked.map(({ company }) => (
                      <TouchableOpacity
                        key={company.id}
                        style={[styles.th, { width: COL_W }]}
                        onPress={() => router.push(`/detail/${company.id}`)}
                      >
                        <Text style={styles.thText} numberOfLines={2}>{company.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {EVAL_KEYS.filter((k) => k !== 'motivation').map((k) => {
                    const best = bestOf(k);
                    return (
                      <View key={k} style={styles.tr}>
                        <View style={[styles.td, { width: LABEL_W }]}>
                          <Text style={styles.rowLabel} numberOfLines={2}>{EVAL_LABELS[k]}</Text>
                          <Text style={styles.rowWeight}>{weights[k] ?? 0}%</Text>
                        </View>
                        {ranked.map(({ company }) => {
                          const v = company.evaluation?.[k] ?? 0;
                          return (
                            <View
                              key={company.id}
                              style={[styles.td, { width: COL_W }, v > 0 && v === best && ranked.length > 1 && styles.tdBest]}
                            >
                              <StarText value={v} />
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                  <View style={styles.tr}>
                    <View style={[styles.td, { width: LABEL_W }]}>
                      <Text style={styles.rowLabel}>志望度</Text>
                      <Text style={styles.rowWeight}>{weights.motivation ?? 0}%</Text>
                    </View>
                    {ranked.map(({ company }) => {
                      const m = latestMotivation(company);
                      return (
                        <View key={company.id} style={[styles.td, { width: COL_W }]}>
                          <Text style={styles.motivation}>{m != null ? `${m}%` : '-'}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={[styles.tr, { borderBottomWidth: 0 }]}>
                    <View style={[styles.td, { width: LABEL_W }]}>
                      <Text style={[styles.rowLabel, { fontWeight: '700' }]}>相性スコア</Text>
                    </View>
                    {ranked.map(({ company, score, tentative }) => (
                      <View key={company.id} style={[styles.td, { width: COL_W }]}>
                        <Text style={[styles.tableScore, tentative && { color: colors.fgSub }]}>{score ?? '-'}</Text>
                        {tentative && <Text style={styles.tentative}>参考値</Text>}
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
          </>
        )}

        {/* 重視すること */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>あなたが重視すること</Text>
          <TouchableOpacity onPress={() => setWeights(DEFAULT_WEIGHTS)}>
            <Text style={styles.resetText}>初期値に戻す</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {EVAL_KEYS.map((k, i) => {
            const w = weights[k] ?? 0;
            const share = totalWeight > 0 ? Math.round((w / totalWeight) * 100) : 0;
            return (
              <View key={k} style={[styles.weightRow, i === EVAL_KEYS.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.weightLabel}>{EVAL_LABELS[k]}</Text>
                  <View style={styles.weightTrack}>
                    <View style={[styles.weightFill, { width: `${share}%` }]} />
                  </View>
                </View>
                <TouchableOpacity style={styles.stepBtn} onPress={() => changeWeight(k, -5)}>
                  <Ionicons name="remove" size={16} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.weightValue}>{w}%</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => changeWeight(k, 5)}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            );
          })}
          <Text style={[styles.total, totalWeight !== 100 && { color: colors.warning }]}>
            合計 {totalWeight}%{totalWeight !== 100 ? '（合計が100%でなくても比率で計算します）' : ''}
          </Text>
        </View>

        {/* 意思決定メモ */}
        {ranked.some(({ company }) => company.status === 'offer') && (
          <>
            <Text style={styles.sectionTitle}>意思決定メモ</Text>
            {ranked.filter(({ company }) => company.status === 'offer').map(({ company }) => (
              <TouchableOpacity
                key={company.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push(`/detail/${company.id}`)}
              >
                <View style={styles.decisionTop}>
                  <Text style={styles.decisionName}>{company.name}</Text>
                  <Text style={styles.resetText}>{company.decision ? '編集 ›' : 'メモを書く ›'}</Text>
                </View>
                {company.decision ? (
                  ([
                    ['選んだ理由', company.decision.reason],
                    ['迷った理由', company.decision.hesitation],
                    ['入社後に期待すること', company.decision.expectation],
                  ] as const).filter(([, v]) => v).map(([label, v]) => (
                    <View key={label} style={{ marginTop: 6 }}>
                      <Text style={styles.decisionLabel}>{label}</Text>
                      <Text style={styles.decisionText} numberOfLines={3}>{v}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.hint}>この企業を選んだ理由・迷った理由・入社後に期待することを残せます</Text>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 40 },

  header: { marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.fg, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.fgMuted, marginTop: 4, lineHeight: 19 },

  scopeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.fgMuted },
  chipTextActive: { color: colors.primary, fontWeight: '600' },

  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: colors.fgMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 20, marginBottom: 8,
  },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 20, marginBottom: 8,
  },
  resetText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.fgSub, marginTop: 4, lineHeight: 18 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, ...shadow, marginBottom: 10,
  },

  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, ...shadow, marginBottom: 10,
  },
  rank: { width: 26, fontSize: 18, fontWeight: '800', color: colors.fgSub, textAlign: 'center' },
  scoreTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  scoreName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.fg },
  scoreStatus: { fontSize: 11, color: colors.fgMuted },
  barTrack: { height: 6, backgroundColor: colors.surface2, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  missing: { fontSize: 11, color: colors.warning, marginTop: 4 },
  tentative: {
    fontSize: 10, fontWeight: '700', color: colors.fgMuted, marginTop: 2,
    backgroundColor: colors.surface2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full,
    overflow: 'hidden',
  },
  scoreNum: { fontSize: 26, fontWeight: '800', color: colors.primary, minWidth: 56, textAlign: 'right' },
  scoreUnit: { fontSize: 12, fontWeight: '600', color: colors.fgMuted },

  tableCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, ...shadow, overflow: 'hidden',
  },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  trHead: { backgroundColor: colors.surface2 },
  th: { paddingVertical: 10, paddingHorizontal: 8, justifyContent: 'center' },
  thText: { fontSize: 12, fontWeight: '700', color: colors.fg, textAlign: 'center' },
  td: { paddingVertical: 10, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  tdBest: { backgroundColor: colors.primaryLight },
  rowLabel: { fontSize: 12, fontWeight: '600', color: colors.fg, alignSelf: 'flex-start' },
  rowWeight: { fontSize: 10, color: colors.fgSub, alignSelf: 'flex-start', marginTop: 1 },
  motivation: { fontSize: 14, fontWeight: '700', color: colors.primary },
  tableScore: { fontSize: 18, fontWeight: '800', color: colors.fg },

  weightRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  weightLabel: { fontSize: 14, fontWeight: '500', color: colors.fg, marginBottom: 6 },
  weightTrack: { height: 4, backgroundColor: colors.surface2, borderRadius: 2, overflow: 'hidden', marginRight: 8 },
  weightFill: { height: '100%', backgroundColor: colors.primary },
  stepBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  weightValue: { width: 44, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.fg },
  total: { fontSize: 12, color: colors.fgMuted, marginTop: 10, textAlign: 'right' },

  decisionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  decisionName: { fontSize: 15, fontWeight: '700', color: colors.fg, flex: 1 },
  decisionLabel: { fontSize: 11, color: colors.fgMuted, fontWeight: '600' },
  decisionText: { fontSize: 13, color: colors.fg, lineHeight: 19 },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.fg },
  emptySub: { fontSize: 13, color: colors.fgMuted, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 },
});
