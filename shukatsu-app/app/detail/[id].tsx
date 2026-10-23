import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies } from '@/src/context/CompaniesContext';
import { Colors, radius, readable, spacing, toneColors, type } from '@/src/theme';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { DecisionNote, MotivationRecord, Selection } from '@/src/types';
import { EVAL_KEYS, EVAL_LABELS, FLOW_STATUS_LABEL, STATUS_LABEL } from '@/src/constants';
import {
  compatibilityScore, daysLabel, daysUntil, formatDateFull, formatDateShort, latestMotivation,
  todayStr, uid,
} from '@/src/utils';
import { companyStatusTone, daysTone, flowStatusTone } from '@/src/presentation';
import { StarRating } from '@/src/components/StarRating';
import {
  FormInput, FormLabel, IconButton, Pill, PrimaryButton, Section,
} from '@/src/components/ui';
import { selectionHref } from '@/src/routes';
import { mergeFormEdit } from '@/src/sync/formMerge';
import { isEqual } from '@/src/sync/merge';

const EMPTY_DECISION: DecisionNote = { reason: '', hesitation: '', expectation: '' };
const DECISION_LABELS: Record<keyof DecisionNote, string> = {
  reason: 'この企業を選んだ理由', hesitation: '最後まで迷った理由', expectation: '入社後に期待すること',
};

/** 選考状況のタイムラインの点: 完了 ✓ / 現在 ● / 未来 ○ / 不合格 × / 辞退 − */
function ProgressNode({ flow, isCurrent }: { flow: Selection; isCurrent: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  if (flow.status === 'pending') {
    return (
      <View style={[styles.node, styles.nodeHollow, isCurrent && { borderColor: colors.primary }]}>
        {isCurrent ? <View style={styles.nodeCore} /> : null}
      </View>
    );
  }
  const t = toneColors(colors, flowStatusTone(flow.status));
  const icon = flow.status === 'failed' ? 'close' : flow.status === 'declined' ? 'remove' : 'checkmark';
  return (
    <View style={[styles.node, { backgroundColor: flow.status === 'declined' ? colors.surface2 : t.fg }]}>
      <Ionicons name={icon} size={13} color={flow.status === 'declined' ? colors.fgMuted : colors.onPrimary} />
    </View>
  );
}

function InfoRow({ label, value, isLink, last }: { label: string; value: string; isLink?: boolean; last?: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  if (!value) return null;
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoKey}>{label}</Text>
      {isLink ? (
        <TouchableOpacity onPress={() => Linking.openURL(value)} style={{ flex: 1 }} activeOpacity={0.6}>
          <Text style={[styles.infoVal, { color: colors.primary, fontWeight: '600' }]} numberOfLines={2}>
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
        <View style={styles.trendRow}>
          <Text style={styles.trendText}>
            {formatDateShort(first.date)} {first.value}% → {formatDateShort(last.date)} {last.value}%
          </Text>
          <Text style={[styles.trendDiff, { color: diff > 0 ? colors.success : diff < 0 ? colors.danger : colors.fgMuted }]}>
            {diff > 0 ? `▲${diff}` : diff < 0 ? `▼${Math.abs(diff)}` : '±0'}%
          </Text>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chart}>
        {sorted.map((r, i) => {
          const prev = sorted[i - 1];
          const up = prev ? r.value - prev.value : 0;
          const isLast = i === sorted.length - 1;
          return (
            <TouchableOpacity key={r.id} style={styles.barCol} onLongPress={() => onPressBar(r)} activeOpacity={0.7}>
              <Text style={[styles.barValue, isLast && { color: colors.primary }]}>{r.value}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar, {
                  height: `${Math.max(r.value, 3)}%`,
                  backgroundColor: isLast ? colors.primary : colors.fgSub,
                  opacity: isLast ? 1 : 0.45,
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
      {/* ナビゲーションバー */}
      <View style={styles.navBar}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="戻る" />
        <View style={{ flex: 1 }} />
        <IconButton icon="trash-outline" tone="danger" onPress={handleDelete} accessibilityLabel="企業を削除" />
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push(`/add?id=${company.id}`)}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={styles.editBtnText}>編集</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* 企業名・ステータス */}
          <View style={styles.hero}>
            <View style={styles.statusRow}>
              <Pill label={STATUS_LABEL[company.status]} tone={companyStatusTone(company.status)} />
              {company.industry ? <Text style={styles.industry}>{company.industry}</Text> : null}
              <Text style={styles.karteLabel}>企業カルテ</Text>
            </View>
            <Text style={styles.heroName}>{company.name}</Text>

            {/* サマリー: 志望度・相性・進捗 */}
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>志望度</Text>
                <Text style={[styles.metricNum, { color: latest !== null ? colors.primary : colors.fgSub }]}>
                  {latest !== null ? latest : '-'}
                  {latest !== null ? <Text style={styles.metricUnit}>%</Text> : null}
                </Text>
              </View>
              <View style={styles.metricDivider} />
              <TouchableOpacity style={styles.metric} onPress={() => router.push('/compare')} activeOpacity={0.6}>
                <Text style={styles.metricLabel}>{score?.tentative ? '相性（参考値）' : '相性スコア'}</Text>
                <Text style={[styles.metricNum, { color: score?.score == null || score.tentative ? colors.fgSub : colors.fg }]}>
                  {score?.score ?? '-'}
                </Text>
              </TouchableOpacity>
              <View style={styles.metricDivider} />
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>選考進捗</Text>
                <Text style={styles.metricNum}>
                  {doneCount}<Text style={styles.metricUnit}>/{company.flows.length}</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* 選考状況（タイムライン） */}
          <Section title="選考状況">
            {company.flows.length === 0 ? (
              <View style={styles.block}>
                <Text style={styles.emptyText}>「編集」から選考フロー（ES・面接など）を追加しましょう。</Text>
              </View>
            ) : company.flows.map((flow, i) => {
              const date = flow.date || flow.deadline;
              const days = date ? daysUntil(date) : null;
              const dt = days !== null ? daysTone(days) : 'neutral';
              const daysColor = dt === 'neutral' ? colors.fgSub : toneColors(colors, dt).fg;
              const isCurrent = i === currentIdx;
              const isLast = i === company.flows.length - 1;

              return (
                <TouchableOpacity
                  key={flow.id}
                  style={styles.flowStep}
                  onPress={() => router.push(selectionHref(company.id, flow.id))}
                  activeOpacity={0.6}
                >
                  <View style={styles.rail}>
                    <ProgressNode flow={flow} isCurrent={isCurrent} />
                    {!isLast ? <View style={styles.railLine} /> : null}
                  </View>
                  <View style={[styles.flowBody, !isLast && styles.flowBodyDivider]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.flowName, isCurrent && { color: colors.primary }]} numberOfLines={2}>
                        {flow.name}
                      </Text>
                      {date ? (
                        <View style={styles.flowDateRow}>
                          <Text style={styles.flowDate}>
                            {formatDateFull(date)}{flow.time ? ` ${flow.time}` : ''}
                          </Text>
                          {days !== null && flow.status === 'pending' ? (
                            <Text style={[styles.flowDays, { color: daysColor }]}>{daysLabel(days)}</Text>
                          ) : null}
                        </View>
                      ) : null}
                      <View style={styles.flowTags}>
                        <Pill label={FLOW_STATUS_LABEL[flow.status]} tone={flowStatusTone(flow.status)} />
                        {flow.review ? <Pill label="振り返り" tone="primary" icon="document-text" /> : null}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.fgSub} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </Section>

          {/* 基本情報 */}
          <Section title="基本情報">
            <View style={styles.block}>
              {hasBasic ? (
                <>
                  <InfoRow label="業界" value={company.industry} />
                  <InfoRow label="マイページ" value={company.mypageUrl} isLink />
                  <InfoRow label="平均年収" value={company.avgSalary} />
                  <InfoRow label="従業員数" value={company.employees} />
                  <InfoRow label="勤務地" value={company.location} />
                  <InfoRow label="設立年" value={company.founded} />
                  <InfoRow label="福利厚生" value={company.benefits} />
                  <InfoRow label="事業内容" value={company.business} last />
                </>
              ) : (
                <Text style={styles.emptyText}>「編集」から年収・勤務地などを登録できます。</Text>
              )}
            </View>
          </Section>

          {/* 自分の評価 */}
          <Section
            title="自分の評価"
            right={score?.score != null ? (
              <Text style={[styles.scoreInline, score.tentative && { color: colors.fgMuted }]}>
                相性 {score.score}点{score.tentative ? '（参考値）' : ''}
              </Text>
            ) : undefined}
            footer="★をタップするとすぐ保存されます。内定比較タブで重視度と掛け合わせてスコアを計算します。"
          >
            <View style={styles.block}>
              {EVAL_KEYS.map((k, i) => (
                <View key={k} style={[styles.evalRow, i === EVAL_KEYS.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={styles.evalLabel}>{EVAL_LABELS[k]}</Text>
                  <StarRating value={company.evaluation?.[k]} onChange={(v) => setEval(k, v)} />
                </View>
              ))}
            </View>
          </Section>

          {/* 志望度の推移 */}
          <Section title="志望度の推移">
            <View style={styles.block}>
              <MotivationChart history={company.motivationHistory ?? []} onPressBar={removeRecord} />
              <View style={styles.motivationInput}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setMotivation((v) => Math.max(0, v - 5))}
                  accessibilityLabel="志望度を下げる"
                  activeOpacity={0.6}
                >
                  <Ionicons name="remove" size={22} color={colors.fg} />
                </TouchableOpacity>
                <Text style={styles.motivationValue}>
                  {motivation}<Text style={styles.motivationUnit}>%</Text>
                </Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setMotivation((v) => Math.min(100, v + 5))}
                  accessibilityLabel="志望度を上げる"
                  activeOpacity={0.6}
                >
                  <Ionicons name="add" size={22} color={colors.fg} />
                </TouchableOpacity>
              </View>
              <PrimaryButton label="今日の志望度を記録" icon="trending-up" onPress={recordMotivation} />
            </View>
          </Section>

          {/* 魅力・懸念点 */}
          {company.notes ? (
            <Section title="魅力・メモ">
              <Text style={styles.noteText}>{company.notes}</Text>
            </Section>
          ) : null}
          {company.concerns ? (
            <Section title="懸念点">
              <Text style={styles.noteText}>{company.concerns}</Text>
            </Section>
          ) : null}

          {/* 意思決定メモ（内定時・記入済みのとき） */}
          {(company.status === 'offer' || company.decision) && (
            <Section title="意思決定メモ">
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
            </Section>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  navBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.md, paddingTop: 6, paddingBottom: 8,
  },
  editBtn: {
    height: 36, justifyContent: 'center',
    backgroundColor: colors.fg,
    paddingHorizontal: 18, borderRadius: radius.full,
  },
  editBtnText: { color: colors.bg, fontWeight: '700', fontSize: 15 },

  content: { ...readable, paddingHorizontal: spacing.screen, paddingBottom: 56 },

  hero: { paddingTop: spacing.sm, marginBottom: spacing.section },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  industry: { fontSize: 13, color: colors.fgMuted, fontWeight: '500' },
  karteLabel: { marginLeft: 'auto', fontSize: 12, color: colors.fgSub, fontWeight: '600' },
  heroName: { ...type.largeTitle, fontSize: 30, lineHeight: 38, color: colors.fg },

  metrics: {
    flexDirection: 'row', alignItems: 'stretch', marginTop: spacing.lg,
    backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 14,
  },
  metric: { flex: 1, alignItems: 'center' },
  metricDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  metricLabel: { fontSize: 12, color: colors.fgMuted, fontWeight: '500' },
  metricNum: { ...type.number, fontSize: 26, lineHeight: 32, color: colors.fg, marginTop: 4 },
  metricUnit: { fontSize: 14, fontWeight: '600', color: colors.fgMuted, letterSpacing: 0 },

  block: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  emptyText: { fontSize: 14, color: colors.fgMuted, lineHeight: 21 },
  noteText: { fontSize: 15, color: colors.fg, lineHeight: 24 },

  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  infoKey: { width: 80, fontSize: 14, color: colors.fgMuted, flexShrink: 0, lineHeight: 21 },
  infoVal: { flex: 1, fontSize: 15, color: colors.fg, lineHeight: 21 },

  flowStep: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  rail: { width: 24, alignItems: 'center', paddingTop: 14 },
  railLine: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 4, marginBottom: -14, borderRadius: 1 },
  node: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nodeHollow: { borderWidth: 2, borderColor: colors.fgSub, backgroundColor: colors.bg },
  nodeCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  flowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  flowBodyDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  flowName: { fontSize: 16, fontWeight: '700', color: colors.fg },
  flowDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  flowDate: { fontSize: 13, color: colors.fgMuted, fontVariant: ['tabular-nums'] },
  flowDays: { fontSize: 13, fontWeight: '700' },
  flowTags: { flexDirection: 'row', gap: 6, marginTop: 8 },

  scoreInline: { fontSize: 14, fontWeight: '700', color: colors.success },
  evalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  evalLabel: { fontSize: 15, color: colors.fg, flexShrink: 1 },

  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  trendText: { fontSize: 13, color: colors.fgMuted, fontVariant: ['tabular-nums'] },
  trendDiff: { fontSize: 14, fontWeight: '800' },
  chart: { gap: 10, paddingVertical: 4, minWidth: '100%' },
  barCol: { width: 40, alignItems: 'center' },
  barValue: { fontSize: 12, fontWeight: '700', color: colors.fgMuted, marginBottom: 4, fontVariant: ['tabular-nums'] },
  barTrack: {
    width: 22, height: 110, justifyContent: 'flex-end',
    backgroundColor: colors.bg, borderRadius: 6, overflow: 'hidden',
  },
  bar: { width: '100%', borderRadius: 6 },
  barDate: { fontSize: 11, color: colors.fgMuted, marginTop: 6, fontVariant: ['tabular-nums'] },
  barDiff: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  chartHint: { fontSize: 12, color: colors.fgSub, marginTop: 8, lineHeight: 16 },

  motivationInput: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 24, marginTop: 20, marginBottom: 16,
  },
  stepBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
  motivationValue: { ...type.number, fontSize: 34, color: colors.fg, minWidth: 90, textAlign: 'center' },
  motivationUnit: { fontSize: 16, fontWeight: '700', color: colors.fgMuted, letterSpacing: 0 },

  formGroup: { marginBottom: 16 },
});
