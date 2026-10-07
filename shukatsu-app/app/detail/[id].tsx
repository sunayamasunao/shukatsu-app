import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies } from '@/src/context/CompaniesContext';
import { Colors, radius, shadow, spacing } from '@/src/theme';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { CompanyStatus, DecisionNote, FlowStatus, MotivationRecord, Selection } from '@/src/types';
import { EVAL_KEYS, EVAL_LABELS, FLOW_STATUS_LABEL, STATUS_LABEL } from '@/src/constants';
import {
  compatibilityScore, daysLabel, daysUntil, formatDateFull, formatDateShort, latestMotivation,
  todayStr, uid,
} from '@/src/utils';
import { StarRating } from '@/src/components/StarRating';
import { FormInput, FormLabel, PrimaryButton } from '@/src/components/ui';
import { selectionHref } from '@/src/routes';
import { mergeFormEdit } from '@/src/sync/formMerge';
import { isEqual } from '@/src/sync/merge';

const EMPTY_DECISION: DecisionNote = { reason: '', hesitation: '', expectation: '' };
const DECISION_LABELS: Record<keyof DecisionNote, string> = {
  reason: 'この企業を選んだ理由', hesitation: '最後まで迷った理由', expectation: '入社後に期待すること',
};

const STATUS_COLOR_FOR = (colors: Colors): Record<CompanyStatus, { bg: string; text: string }> => ({
  active: { bg: colors.primaryLight, text: colors.primary },
  offer: { bg: colors.successLight, text: colors.success },
  declined: { bg: colors.surface2, text: colors.fgSub },
  rejected: { bg: colors.dangerLight, text: colors.danger },
});
const FLOW_BADGE_FOR = (colors: Colors): Record<FlowStatus, { bg: string; text: string }> => ({
  pending: { bg: colors.surface2, text: colors.fgSub },
  done: { bg: colors.primaryLight, text: colors.primary },
  passed: { bg: colors.successLight, text: colors.success },
  failed: { bg: colors.dangerLight, text: colors.danger },
  declined: { bg: colors.surface2, text: colors.fgSub },
});

/** 選考状況のアイコン: 完了 ✅ / 現在 🔵 / 未来 ⚪ / 不合格 ❌ / 辞退 ➖ */
function progressIcon(f: Selection, isCurrent: boolean): string {
  if (f.status === 'passed' || f.status === 'done') return '✅';
  if (f.status === 'failed') return '❌';
  if (f.status === 'declined') return '➖';
  return isCurrent ? '🔵' : '⚪';
}

function InfoRow({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoKey}>{label}</Text>
      {isLink ? (
        <TouchableOpacity onPress={() => Linking.openURL(value)} style={{ flex: 1 }}>
          <Text style={[styles.infoVal, { color: colors.primary }]} numberOfLines={2}>
            リンクを開く ↗
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.infoVal}>{value}</Text>
      )}
    </View>
  );
}

/** 志望度の推移（棒グラフ） */
function MotivationChart({ history, onPressBar }: {
  history: MotivationRecord[]; onPressBar: (r: MotivationRecord) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return <Text style={styles.emptyText}>まだ記録がありません。下のボタンから今日の志望度を記録しましょう。</Text>;
  }
  const first = sorted[0], last = sorted[sorted.length - 1];
  const diff = last.value - first.value;

  return (
    <View>
      {sorted.length > 1 && (
        <Text style={styles.trendText}>
          {formatDateShort(first.date)} {first.value}% → {formatDateShort(last.date)} {last.value}%
          <Text style={{ color: diff > 0 ? colors.success : diff < 0 ? colors.danger : colors.fgMuted, fontWeight: '700' }}>
            {'  '}{diff > 0 ? `▲${diff}` : diff < 0 ? `▼${Math.abs(diff)}` : '±0'}%
          </Text>
        </Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chart}>
        {sorted.map((r, i) => {
          const prev = sorted[i - 1];
          const up = prev ? r.value - prev.value : 0;
          return (
            <TouchableOpacity key={r.id} style={styles.barCol} onLongPress={() => onPressBar(r)} activeOpacity={0.7}>
              <Text style={styles.barValue}>{r.value}%</Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar, {
                  height: `${Math.max(r.value, 3)}%`,
                  backgroundColor: i === sorted.length - 1 ? colors.primary : colors.primaryLight,
                }]} />
              </View>
              <Text style={styles.barDate}>{formatDateShort(r.date)}</Text>
              <Text style={[styles.barDiff, { color: up > 0 ? colors.success : up < 0 ? colors.danger : 'transparent' }]}>
                {up > 0 ? `▲${up}` : up < 0 ? `▼${Math.abs(up)}` : '-'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={styles.chartHint}>長押しで記録を削除できます</Text>
    </View>
  );
}

export default function DetailScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const STATUS_COLOR = STATUS_COLOR_FOR(colors);
  const FLOW_BADGE = FLOW_BADGE_FOR(colors);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { companies, deleteCompany, updateCompany, weights } = useCompanies();

  const company = companies.find((c) => c.id === id);

  // 志望度の入力値（最新の記録から開始）
  const [motivation, setMotivation] = useState(50);
  useEffect(() => {
    if (company) setMotivation(latestMotivation(company) ?? 50);
    // 企業が切り替わったときだけ初期化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  // 意思決定メモ。編集していない間は、別の端末での更新にも追従する
  const savedDecision = company?.decision ?? EMPTY_DECISION;
  const [decision, setDecision] = useState<DecisionNote>(EMPTY_DECISION);
  const [decisionBase, setDecisionBase] = useState<DecisionNote>(EMPTY_DECISION);
  useEffect(() => {
    if (!company) return;
    // 編集中（未保存の入力あり）なら入力を残し、比較の基準も動かさない
    if (isEqual(decision, decisionBase)) {
      setDecision(savedDecision);
      setDecisionBase(savedDecision);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, JSON.stringify(savedDecision)]);
  const decisionDirty = !isEqual(decision, savedDecision);

  const score = useMemo(() => (company ? compatibilityScore(company, weights) : null), [company, weights]);

  if (!company) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.fgMuted }}>企業が見つかりません</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.primary }}>戻る</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sc = STATUS_COLOR[company.status] ?? STATUS_COLOR.active;
  const currentIdx = company.flows.findIndex((f) => f.status === 'pending');
  const doneCount = company.flows.filter((f) => f.status === 'passed' || f.status === 'done').length;
  const latest = latestMotivation(company);

  const setEval = (key: string, v: number) =>
    updateCompany(company.id, { evaluation: { ...company.evaluation, [key]: v || undefined } });

  const recordMotivation = () => {
    const today = todayStr();
    const others = (company.motivationHistory ?? []).filter((r) => r.date !== today);
    updateCompany(company.id, {
      // 1企業1日1件。id を日付から決めることで、2台で同じ日に記録しても行が重複しない
      motivationHistory: [...others, { id: `${company.id}_${today}`, date: today, value: motivation }],
    });
  };

  const saveDecision = () => {
    const keys = Object.keys(DECISION_LABELS) as (keyof DecisionNote)[];
    // decisionBase = 編集を始めた時点の保存値
    const m = mergeFormEdit(decisionBase, decision, savedDecision, keys);
    const save = (d: DecisionNote) => {
      updateCompany(company.id, { decision: d });
      setDecision(d);
      setDecisionBase(d);
    };
    if (m.conflicts.length === 0) return save(m.merged);
    Alert.alert(
      '別の端末でこのデータが更新されています',
      m.conflicts.map((k) => `・${DECISION_LABELS[k]}`).join('\n'),
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '別の端末の内容を残す', onPress: () => save(m.keepLatest) },
        { text: 'この端末の内容で上書き', style: 'destructive', onPress: () => save(m.merged) },
      ],
    );
  };

  const removeRecord = (r: MotivationRecord) => {
    Alert.alert('記録を削除', `${formatDateFull(r.date)}の記録（${r.value}%）を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除する', style: 'destructive',
        onPress: () => updateCompany(company.id, {
          motivationHistory: (company.motivationHistory ?? []).filter((x) => x.id !== r.id),
        }),
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      '企業を削除しますか？',
      `「${company.name}」のデータがすべて削除されます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            await deleteCompany(company.id);
            router.back();
          },
        },
      ],
    );
  };

  const hasBasic = company.industry || company.mypageUrl || company.avgSalary || company.employees
    || company.location || company.founded || company.benefits || company.business;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.fg} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{company.name}</Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push(`/add?id=${company.id}`)}
        >
          <Text style={styles.editBtnText}>編集</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* ステータスバッジ */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusBadgeText, { color: sc.text }]}>
              {STATUS_LABEL[company.status]}
            </Text>
          </View>
          {company.industry ? (
            <View style={styles.jobTag}>
              <Ionicons name="business-outline" size={13} color={colors.fgMuted} />
              <Text style={styles.jobTagText}>{company.industry}</Text>
            </View>
          ) : null}
          <Text style={styles.karteLabel}>企業カルテ</Text>
        </View>

        {/* サマリー: 志望度・相性・進捗 */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNum, { color: colors.primary }]}>{latest !== null ? `${latest}%` : '-'}</Text>
            <Text style={styles.summaryLabel}>志望度</Text>
          </View>
          <TouchableOpacity style={styles.summaryCard} onPress={() => router.push('/compare')}>
            <Text style={[styles.summaryNum, { color: score?.tentative ? colors.fgSub : colors.success }]}>{score?.score ?? '-'}</Text>
            <Text style={styles.summaryLabel}>{score?.tentative ? '相性（参考値）' : '相性スコア'}</Text>
          </TouchableOpacity>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{doneCount}/{company.flows.length}</Text>
            <Text style={styles.summaryLabel}>選考進捗</Text>
          </View>
        </View>

        {/* 選考状況 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>選考状況</Text>
          {company.flows.length === 0 ? (
            <Text style={styles.emptyText}>「編集」から選考フロー（ES・面接など）を追加しましょう。</Text>
          ) : company.flows.map((flow, i) => {
            const badge = FLOW_BADGE[flow.status] ?? FLOW_BADGE.pending;
            const date = flow.date || flow.deadline;
            const days = date ? daysUntil(date) : null;
            const daysColor =
              days !== null && days <= 3 ? colors.danger
              : days !== null && days <= 7 ? colors.warning
              : colors.fgSub;
            const isCurrent = i === currentIdx;

            return (
              <TouchableOpacity
                key={flow.id}
                style={[styles.flowStep, i === company.flows.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => router.push(selectionHref(company.id, flow.id))}
                activeOpacity={0.7}
              >
                <Text style={styles.flowIcon}>{progressIcon(flow, isCurrent)}</Text>
                <View style={styles.flowBody}>
                  <View style={styles.flowTopRow}>
                    <Text style={[styles.flowName, isCurrent && { color: colors.primary }]}>{flow.name}</Text>
                    {flow.review ? (
                      <View style={styles.reviewTag}>
                        <Ionicons name="document-text" size={11} color={colors.primary} />
                        <Text style={styles.reviewTagText}>振り返り</Text>
                      </View>
                    ) : null}
                    <View style={[styles.flowBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.flowBadgeText, { color: badge.text }]}>
                        {FLOW_STATUS_LABEL[flow.status]}
                      </Text>
                    </View>
                  </View>
                  {date ? (
                    <View style={styles.flowDateRow}>
                      <Ionicons name="calendar-outline" size={12} color={colors.fgSub} />
                      <Text style={styles.flowDate}>
                        {formatDateFull(date)}{flow.time ? ` ${flow.time}` : ''}
                      </Text>
                      {days !== null && flow.status === 'pending' ? (
                        <Text style={[styles.flowDays, { color: daysColor }]}>{daysLabel(days)}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.fgSub} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 基本情報 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>基本情報</Text>
          {hasBasic ? (
            <>
              <InfoRow label="業界" value={company.industry} />
              <InfoRow label="マイページ" value={company.mypageUrl} isLink />
              <InfoRow label="平均年収" value={company.avgSalary} />
              <InfoRow label="従業員数" value={company.employees} />
              <InfoRow label="勤務地" value={company.location} />
              <InfoRow label="設立年" value={company.founded} />
              <InfoRow label="福利厚生" value={company.benefits} />
              <InfoRow label="事業内容" value={company.business} />
            </>
          ) : (
            <Text style={styles.emptyText}>「編集」から年収・勤務地などを登録できます。</Text>
          )}
        </View>

        {/* 自分の評価 */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>自分の評価</Text>
            {score?.score != null ? (
              <Text style={[styles.scoreInline, score.tentative && { color: colors.fgMuted }]}>
                相性 {score.score}点{score.tentative ? '（参考値）' : ''}
              </Text>
            ) : null}
          </View>
          {EVAL_KEYS.map((k, i) => (
            <View key={k} style={[styles.evalRow, i === EVAL_KEYS.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.evalLabel}>{EVAL_LABELS[k]}</Text>
              <StarRating value={company.evaluation?.[k]} onChange={(v) => setEval(k, v)} />
            </View>
          ))}
          <Text style={styles.chartHint}>★をタップするとすぐ保存されます。内定比較タブで重視度と掛け合わせてスコアを計算します。</Text>
        </View>

        {/* 志望度の推移 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>志望度の推移</Text>
          <MotivationChart history={company.motivationHistory ?? []} onPressBar={removeRecord} />
          <View style={styles.motivationInput}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setMotivation((v) => Math.max(0, v - 5))}>
              <Ionicons name="remove" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.motivationValue}>{motivation}%</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setMotivation((v) => Math.min(100, v + 5))}>
              <Ionicons name="add" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <PrimaryButton label="今日の志望度を記録" icon="trending-up" variant="soft" onPress={recordMotivation} />
        </View>

        {/* 魅力・懸念点 */}
        {company.notes ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>魅力・メモ</Text>
            <Text style={styles.noteText}>{company.notes}</Text>
          </View>
        ) : null}
        {company.concerns ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>懸念点</Text>
            <Text style={styles.noteText}>{company.concerns}</Text>
          </View>
        ) : null}

        {/* 意思決定メモ（内定時・記入済みのとき） */}
        {(company.status === 'offer' || company.decision) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>意思決定メモ</Text>
            <View style={styles.formGroup}>
              <FormLabel>この企業を選んだ理由</FormLabel>
              <FormInput value={decision.reason} onChangeText={(v) => setDecision((d) => ({ ...d, reason: v }))} multiline placeholder="決め手になったこと" />
            </View>
            <View style={styles.formGroup}>
              <FormLabel>最後まで迷った理由</FormLabel>
              <FormInput value={decision.hesitation} onChangeText={(v) => setDecision((d) => ({ ...d, hesitation: v }))} multiline placeholder="他社と比べて気になったこと" />
            </View>
            <View style={styles.formGroup}>
              <FormLabel>入社後に期待すること</FormLabel>
              <FormInput value={decision.expectation} onChangeText={(v) => setDecision((d) => ({ ...d, expectation: v }))} multiline placeholder="挑戦したいこと・身につけたいこと" />
            </View>
            {decisionDirty && (
              <PrimaryButton label="メモを保存" onPress={saveDecision} />
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.fg },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.dangerLight,
    alignItems: 'center', justifyContent: 'center',
  },
  editBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.sm,
  },
  editBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  content: { padding: spacing.md },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: radius.full },
  statusBadgeText: { fontSize: 13, fontWeight: '700' },
  jobTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface2, paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: radius.full,
  },
  jobTagText: { fontSize: 12, color: colors.fgMuted, fontWeight: '500' },
  karteLabel: { marginLeft: 'auto', fontSize: 11, color: colors.fgSub, fontWeight: '600' },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    paddingVertical: 12, alignItems: 'center', ...shadow,
  },
  summaryNum: { fontSize: 20, fontWeight: '700', color: colors.fg },
  summaryLabel: { fontSize: 11, color: colors.fgMuted, marginTop: 2 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, ...shadow, marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12, fontWeight: '700', color: colors.fgMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  emptyText: { fontSize: 13, color: colors.fgMuted, lineHeight: 20 },
  noteText: { fontSize: 14, color: colors.fg, lineHeight: 22 },

  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoKey: { width: 80, fontSize: 13, color: colors.fgMuted, flexShrink: 0 },
  infoVal: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.fg, lineHeight: 20 },

  flowStep: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  flowIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  flowBody: { flex: 1 },
  flowTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  flowName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.fg },
  reviewTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  reviewTagText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  flowBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  flowBadgeText: { fontSize: 11, fontWeight: '600' },
  flowDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  flowDate: { fontSize: 12, color: colors.fgMuted },
  flowDays: { fontSize: 12, fontWeight: '600' },

  scoreInline: { fontSize: 13, fontWeight: '700', color: colors.success },
  evalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  evalLabel: { fontSize: 14, color: colors.fg, fontWeight: '500', flexShrink: 1 },

  trendText: { fontSize: 13, color: colors.fgMuted, marginBottom: 8 },
  chart: { gap: 10, paddingVertical: 4, minWidth: '100%' },
  barCol: { width: 44, alignItems: 'center' },
  barValue: { fontSize: 11, fontWeight: '700', color: colors.fg, marginBottom: 4 },
  barTrack: {
    width: 26, height: 110, justifyContent: 'flex-end',
    backgroundColor: colors.surface2, borderRadius: 6, overflow: 'hidden',
  },
  bar: { width: '100%', borderRadius: 6 },
  barDate: { fontSize: 11, color: colors.fgMuted, marginTop: 4 },
  barDiff: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  chartHint: { fontSize: 11, color: colors.fgSub, marginTop: 8, lineHeight: 16 },

  motivationInput: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 20, marginVertical: 14,
  },
  stepBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  motivationValue: { fontSize: 26, fontWeight: '700', color: colors.fg, minWidth: 80, textAlign: 'center' },

  formGroup: { marginBottom: 14 },
});
