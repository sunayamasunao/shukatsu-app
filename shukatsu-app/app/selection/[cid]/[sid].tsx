import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies } from '@/src/context/CompaniesContext';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { Colors, radius, spacing } from '@/src/theme';
import { FlowStatus, SelectionKind, SelfRatingKey, Task } from '@/src/types';
import {
  FLOW_STATUS_OPTIONS, PREP_TEMPLATES, REVIEW_RESULT_OPTIONS,
  SELECTION_KINDS, SELF_RATING_LABELS,
} from '@/src/constants';
import {
  buildCarryOver, daysLabel, daysUntil, formatDateFull, frequentQuestions, isInterviewLike,
  splitLines, uid,
} from '@/src/utils';
import { StarRating } from '@/src/components/StarRating';
import { TaskCheckbox } from '@/src/components/TaskCheckbox';
import { Card, Chips, InfoRow, PrimaryButton, ScreenHeader } from '@/src/components/ui';
import { reviewHref } from '@/src/routes';

export default function SelectionScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { cid, sid } = useLocalSearchParams<{ cid: string; sid: string }>();
  const { companies, updateSelection } = useCompanies();
  const [newTask, setNewTask] = useState('');

  const company = companies.find((c) => c.id === cid);
  const selection = company?.flows.find((f) => f.id === sid);

  const carryOver = useMemo(
    () => (company && selection ? buildCarryOver(company, selection.id) : []),
    [company, selection],
  );
  const freqQuestions = useMemo(() => frequentQuestions(companies, 5), [companies]);

  if (!company || !selection) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="選考が見つかりません" />
      </SafeAreaView>
    );
  }

  const idx = company.flows.findIndex((f) => f.id === selection.id);
  const prev = idx > 0 ? company.flows[idx - 1] : null;
  const next = company.flows[idx + 1];
  const tasks = selection.tasks ?? [];
  const review = selection.review;
  const interview = isInterviewLike(selection);
  const kind: SelectionKind = selection.kind
    ?? SELECTION_KINDS.find((k) => selection.name.includes(k))
    ?? (interview ? '1次面接' : 'その他');

  const setTasks = (list: Task[]) => updateSelection(company.id, selection.id, { tasks: list });
  const addTasks = (texts: string[]) => {
    const existing = new Set(tasks.map((t) => t.text));
    const added = texts.filter((t) => t && !existing.has(t)).map((text) => ({ id: uid(), text, done: false }));
    if (added.length) setTasks([...tasks, ...added]);
  };
  const suggestedTasks = PREP_TEMPLATES[kind].filter((t) => !tasks.some((x) => x.text === t));
  const carryTasks = carryOver.filter((c) => c.icon !== '⭐').map((c) => c.text);
  const carryTasksNotAdded = carryTasks.filter((t) => !tasks.some((x) => x.text === t));

  const date = selection.date || selection.deadline;
  const days = date ? daysUntil(date) : null;
  const resultLabel = review ? REVIEW_RESULT_OPTIONS.find((o) => o.value === review.result)?.label : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={selection.name}
        subtitle={company.name}
        right={
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push(`/add?id=${company.id}`)}>
            <Text style={styles.editBtnText}>編集</Text>
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* 日付サマリー */}
          {date ? (
            <View style={styles.dateBanner}>
              <Ionicons name="calendar" size={18} color={colors.primary} />
              <Text style={styles.dateBannerText}>
                {formatDateFull(date)}{selection.time ? ` ${selection.time}` : ''}
              </Text>
              {days !== null && days >= 0 ? (
                <Text style={[styles.dateBannerDays, {
                  color: days <= 0 ? colors.danger : days <= 2 ? colors.warning : colors.primary,
                }]}>
                  {daysLabel(days)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* ① 前回の選考からの引き継ぎ */}
          {idx > 0 && (
            <Card title="前回の選考からの引き継ぎ" style={styles.carryCard}>
              {carryOver.length > 0 ? (
                <>
                  {carryOver.map((item, i) => (
                    <View key={i} style={styles.carryRow}>
                      <Text style={styles.carryIcon}>{item.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.carryText}>{item.text}</Text>
                        <Text style={styles.carryFrom}>{item.from}より</Text>
                      </View>
                    </View>
                  ))}
                  {carryTasksNotAdded.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <PrimaryButton
                        label="改善点を準備タスクに追加"
                        icon="checkbox-outline"
                        variant="soft"
                        onPress={() => addTasks(carryTasksNotAdded)}
                      />
                    </View>
                  )}
                </>
              ) : (
                <View>
                  <Text style={styles.emptyText}>
                    {prev ? `「${prev.name}」の振り返りがまだありません。` : ''}
                    記録すると、ここに改善点や手応えが表示されます。
                  </Text>
                  {prev && (
                    <TouchableOpacity onPress={() => router.push(reviewHref(company.id, prev.id))}>
                      <Text style={styles.link}>{prev.name}の振り返りを書く ›</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </Card>
          )}

          {/* 選考情報 */}
          <Card title="選考情報">
            <InfoRow label="種類" value={kind} />
            {selection.date ? <InfoRow label="日付" value={formatDateFull(selection.date)} /> : null}
            {selection.time ? <InfoRow label="時間" value={selection.time} /> : null}
            {selection.online !== undefined || selection.location ? (
              <InfoRow
                label="場所"
                value={[selection.online ? 'オンライン' : selection.online === false ? '対面' : '', selection.location]
                  .filter(Boolean).join('・')}
              />
            ) : null}
            {selection.deadline ? <InfoRow label="締切" value={formatDateFull(selection.deadline)} /> : null}
            {selection.memo ? <InfoRow label="メモ" value={selection.memo} /> : null}
            <View style={{ marginTop: 2 }}>
              <Text style={styles.subLabel}>ステータス</Text>
              <Chips
                value={selection.status}
                onChange={(v) => updateSelection(company.id, selection.id, { status: v as FlowStatus })}
                options={FLOW_STATUS_OPTIONS}
              />
            </View>
          </Card>

          {/* 準備タスク */}
          <Card
            title="準備タスク"
            right={tasks.length ? (
              <Text style={styles.taskCount}>{tasks.filter((t) => t.done).length}/{tasks.length} 完了</Text>
            ) : undefined}
          >
            {tasks.map((t) => (
              <View key={t.id} style={styles.taskRow}>
                <TaskCheckbox
                  label={t.text}
                  checked={t.done}
                  onToggle={() => setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                />
                <TouchableOpacity onPress={() => setTasks(tasks.filter((x) => x.id !== t.id))} hitSlop={8}>
                  <Ionicons name="close" size={18} color={colors.fgSub} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.taskInputRow}>
              <TextInput
                style={styles.taskInput}
                value={newTask}
                onChangeText={setNewTask}
                placeholder="準備することを追加"
                placeholderTextColor={colors.fgSub}
                maxLength={500}
                onSubmitEditing={() => { addTasks([newTask.trim()]); setNewTask(''); }}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.taskAddBtn}
                onPress={() => { addTasks([newTask.trim()]); setNewTask(''); }}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {suggestedTasks.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.subLabel}>おすすめ（タップで追加）</Text>
                <View style={styles.suggestRow}>
                  {suggestedTasks.map((t) => (
                    <TouchableOpacity key={t} style={styles.suggestChip} onPress={() => addTasks([t])}>
                      <Text style={styles.suggestText}>＋ {t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </Card>

          {/* 振り返り */}
          <Card title="振り返り">
            {review ? (
              <>
                <View style={styles.reviewTop}>
                  {resultLabel ? (
                    <View style={styles.resultBadge}><Text style={styles.resultText}>{resultLabel}</Text></View>
                  ) : null}
                  {review.ratings?.overall ? <StarRating value={review.ratings.overall} size={16} /> : null}
                  {review.format ? <Text style={styles.reviewMeta}>{review.format}</Text> : null}
                  {review.interviewerCount ? <Text style={styles.reviewMeta}>面接官{review.interviewerCount}人</Text> : null}
                </View>

                {review.questions.length > 0 && (
                  <View style={styles.reviewBlock}>
                    <Text style={styles.subLabel}>聞かれた質問</Text>
                    {review.questions.map((q) => (
                      <Text key={q.id} style={styles.reviewLine}>・{q.text}</Text>
                    ))}
                  </View>
                )}
                {[
                  ['うまく答えられたこと', review.goodPoints],
                  ['詰まった質問', review.stuckPoints],
                  ['反応が良かった話', review.positiveReactions],
                  ['改善点', review.improvements],
                ].map(([label, text]) => splitLines(text).length ? (
                  <View key={label} style={styles.reviewBlock}>
                    <Text style={styles.subLabel}>{label}</Text>
                    {splitLines(text).map((l, i) => <Text key={i} style={styles.reviewLine}>・{l}</Text>)}
                  </View>
                ) : null)}
                {(Object.keys(SELF_RATING_LABELS) as SelfRatingKey[]).some((k) => k !== 'overall' && review.ratings?.[k]) && (
                  <View style={styles.reviewBlock}>
                    <Text style={styles.subLabel}>自己評価</Text>
                    {(Object.keys(SELF_RATING_LABELS) as SelfRatingKey[]).filter((k) => k !== 'overall' && review.ratings?.[k]).map((k) => (
                      <View key={k} style={styles.miniRate}>
                        <Text style={styles.miniRateLabel}>{SELF_RATING_LABELS[k]}</Text>
                        <StarRating value={review.ratings[k]} size={13} />
                      </View>
                    ))}
                  </View>
                )}
                {next && (
                  <Text style={styles.nextHint}>→ 「{next.name}」に引き継がれています</Text>
                )}
                <View style={{ marginTop: 12 }}>
                  <PrimaryButton
                    label="振り返りを編集"
                    icon="create-outline"
                    variant="soft"
                    onPress={() => router.push(reviewHref(company.id, selection.id))}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.emptyText}>
                  選考が終わったら、聞かれた質問や手応えを記録しましょう。
                  {next ? `改善点は「${next.name}」に自動で引き継がれます。` : ''}
                </Text>
                <View style={{ marginTop: 12 }}>
                  <PrimaryButton
                    label="振り返りを追加"
                    icon="add-circle-outline"
                    onPress={() => router.push(reviewHref(company.id, selection.id))}
                  />
                </View>
              </>
            )}
          </Card>

          {/* 他の選考でよく聞かれた質問 */}
          {interview && freqQuestions.length > 0 && (
            <Card title="これまでによく聞かれた質問">
              {freqQuestions.map((q) => (
                <View key={q.text} style={styles.freqRow}>
                  <Text style={styles.freqText}>{q.text}</Text>
                  <Text style={styles.freqCount}>{q.count}回</Text>
                </View>
              ))}
            </Card>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 40 },

  editBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.sm,
  },
  editBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  dateBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 12, paddingHorizontal: 4,
  },
  dateBannerText: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.fg },
  dateBannerDays: { fontSize: 14, fontWeight: '700' },

  carryCard: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  carryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  carryIcon: { fontSize: 16, lineHeight: 22 },
  carryText: { fontSize: 14, fontWeight: '600', color: colors.fg, lineHeight: 21 },
  carryFrom: { fontSize: 11, color: colors.fgSub, marginTop: 2 },

  emptyText: { fontSize: 13, color: colors.fgMuted, lineHeight: 20 },
  link: { fontSize: 14, color: colors.primary, fontWeight: '600', marginTop: 8 },
  subLabel: { fontSize: 12, color: colors.fgMuted, fontWeight: '600', marginBottom: 6 },

  taskCount: { fontSize: 12, color: colors.success, fontWeight: '700' },
  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  taskInputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  taskInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: colors.fg, backgroundColor: colors.bg,
  },
  taskAddBtn: {
    width: 40, borderRadius: radius.sm, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: colors.surface2,
  },
  suggestText: { fontSize: 12, color: colors.fgMuted, fontWeight: '500' },

  reviewTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  resultBadge: {
    backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full,
  },
  resultText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  reviewMeta: { fontSize: 12, color: colors.fgMuted },
  reviewBlock: { marginTop: 12 },
  reviewLine: { fontSize: 14, color: colors.fg, lineHeight: 22 },
  miniRate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 },
  miniRateLabel: { fontSize: 13, color: colors.fg },
  nextHint: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 12 },

  freqRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  freqText: { flex: 1, fontSize: 14, color: colors.fg },
  freqCount: { fontSize: 12, color: colors.fgMuted, fontWeight: '600' },
});
