import React, { useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies } from '@/src/context/CompaniesContext';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { Colors, radius, spacing } from '@/src/theme';
import {
  InterviewFormat, Question, ReviewResult, SelectionReview, SelfRatingKey, SelfRatings,
} from '@/src/types';
import { INTERVIEW_FORMATS, REVIEW_RESULT_OPTIONS, SELF_RATING_LABELS } from '@/src/constants';
import { frequentQuestions, todayStr, uid } from '@/src/utils';
import { DateInput } from '@/src/components/DateInput';
import { StarRating } from '@/src/components/StarRating';
import { Card, Chips, FormInput, FormLabel, SectionTitle } from '@/src/components/ui';

const COMMON_QUESTIONS = ['自己紹介', 'ガクチカ', '自己PR', '志望動機', '長所・短所', '逆質問'];

// 保存データの読み込みが終わってからフォームを初期化する（直接開いたとき空にならないように）
export default function ReviewScreen() {
  const { loading } = useCompanies();
  return loading ? null : <ReviewForm />;
}

function ReviewForm() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { cid, sid } = useLocalSearchParams<{ cid: string; sid: string }>();
  const { companies, updateSelection } = useCompanies();

  const company = companies.find((c) => c.id === cid);
  const selection = company?.flows.find((f) => f.id === sid);
  const r = selection?.review;

  const [result, setResult] = useState<ReviewResult>(r?.result ?? 'pending');
  const [date, setDate] = useState(r?.date ?? selection?.date ?? todayStr());
  const [time, setTime] = useState(r?.time ?? selection?.time ?? '');
  const [format, setFormat] = useState<InterviewFormat>(
    r?.format ?? (selection?.online ? 'オンライン' : selection?.online === false ? '対面' : ''),
  );
  const [interviewerCount, setInterviewerCount] = useState(r?.interviewerCount ?? 0);
  const [questions, setQuestions] = useState<Question[]>(r?.questions ?? []);
  const [answerNotes, setAnswerNotes] = useState(r?.answerNotes ?? '');
  const [goodPoints, setGoodPoints] = useState(r?.goodPoints ?? '');
  const [stuckPoints, setStuckPoints] = useState(r?.stuckPoints ?? '');
  const [positiveReactions, setPositiveReactions] = useState(r?.positiveReactions ?? '');
  const [improvements, setImprovements] = useState(r?.improvements ?? '');
  const [ratings, setRatings] = useState<SelfRatings>(r?.ratings ?? {});

  // 他の選考でよく聞かれた質問もワンタップで追加できるように
  const suggestions = useMemo(() => {
    const freq = frequentQuestions(companies, 8).map((q) => q.text);
    const used = new Set(questions.map((q) => q.text));
    return [...new Set([...COMMON_QUESTIONS, ...freq])].filter((t) => !used.has(t));
  }, [companies, questions]);

  if (!company || !selection) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ color: colors.fgMuted, textAlign: 'center', marginTop: 40 }}>選考が見つかりません</Text>
      </SafeAreaView>
    );
  }

  const addQuestion = (text = '') =>
    setQuestions((prev) => [...prev, { id: uid(), text, answer: '' }]);
  const updateQuestion = (id: string, data: Partial<Question>) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...data } : q)));
  const removeQuestion = (id: string) =>
    setQuestions((prev) => prev.filter((q) => q.id !== id));

  const handleSave = async () => {
    const review: SelectionReview = {
      result, date, time, format, interviewerCount,
      questions: questions.filter((q) => q.text.trim()),
      answerNotes, goodPoints, stuckPoints, positiveReactions, improvements, ratings,
      updatedAt: new Date().toISOString(),
    };
    // 結果が確定したら選考ステータスにも反映
    const status = result === 'pending' ? selection.status : result;
    await updateSelection(company.id, selection.id, { review, status });

    const next = company.flows[company.flows.findIndex((f) => f.id === selection.id) + 1];
    if (next && result === 'passed' && (improvements.trim() || positiveReactions.trim() || stuckPoints.trim())) {
      Alert.alert('保存しました', `この振り返りは「${next.name}」に引き継がれます。`);
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* ヘッダー（企業追加画面と同じ形） */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>キャンセル</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerSub} numberOfLines={1}>{company.name}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{selection.name}の振り返り</Text>
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>保存</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* 選考結果 */}
          <SectionTitle>選考結果</SectionTitle>
          <Card>
            <View style={styles.formGroup}>
              <FormLabel>結果</FormLabel>
              <Chips value={result} onChange={setResult} options={REVIEW_RESULT_OPTIONS} />
            </View>
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <FormLabel>面接日</FormLabel>
                <DateInput value={date} onChange={setDate} />
              </View>
              <View style={{ flex: 1 }}>
                <FormLabel>時間</FormLabel>
                <DateInput mode="time" value={time} onChange={setTime} clearable />
              </View>
            </View>
            <View style={styles.formGroup}>
              <FormLabel>面接形式</FormLabel>
              <Chips
                value={format}
                onChange={(v) => setFormat(v as InterviewFormat)}
                options={INTERVIEW_FORMATS.map((f) => ({ value: f, label: f }))}
                allowDeselect
              />
            </View>
            <View>
              <FormLabel>面接官の人数</FormLabel>
              <Chips
                value={interviewerCount}
                onChange={(v) => setInterviewerCount(Number(v) || 0)}
                options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 5 ? '5人以上' : `${n}人` }))}
                allowDeselect
              />
            </View>
          </Card>

          {/* 質問 */}
          <SectionTitle>面接で聞かれた質問</SectionTitle>
          <Card>
            {questions.map((q, i) => (
              <View key={q.id} style={styles.qItem}>
                <View style={styles.qTop}>
                  <Text style={styles.qNum}>Q{i + 1}</Text>
                  <TextInput
                    style={styles.qInput}
                    value={q.text}
                    onChangeText={(v) => updateQuestion(q.id, { text: v })}
                    placeholder="質問内容"
                    placeholderTextColor={colors.fgSub}
                  />
                  <TouchableOpacity onPress={() => removeQuestion(q.id)} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={22} color={colors.fgSub} />
                  </TouchableOpacity>
                </View>
                <FormInput
                  value={q.answer}
                  onChangeText={(v) => updateQuestion(q.id, { answer: v })}
                  placeholder="どう答えたか（任意）"
                  multiline
                />
              </View>
            ))}

            {suggestions.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.suggestLabel}>よくある質問から追加</Text>
                <View style={styles.suggestRow}>
                  {suggestions.slice(0, 10).map((t) => (
                    <TouchableOpacity key={t} style={styles.suggestChip} onPress={() => addQuestion(t)}>
                      <Text style={styles.suggestText}>＋ {t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.addBtn} onPress={() => addQuestion()}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addBtnText}>質問を追加</Text>
            </TouchableOpacity>
          </Card>

          {/* 振り返り */}
          <SectionTitle>自分の回答・振り返り</SectionTitle>
          <View style={styles.carryHint}>
            <Ionicons name="arrow-forward-circle" size={16} color={colors.primary} />
            <Text style={styles.carryHintText}>
              「詰まった質問」「反応が良かった話」「改善点」は、次の選考に自動で引き継がれます。1行に1つずつ書いてください。
            </Text>
          </View>
          <Card>
            <View style={styles.formGroup}>
              <FormLabel>回答内容</FormLabel>
              <FormInput value={answerNotes} onChangeText={setAnswerNotes} placeholder="全体としてどんな話をしたか" multiline />
            </View>
            <View style={styles.formGroup}>
              <FormLabel>うまく答えられたこと</FormLabel>
              <FormInput value={goodPoints} onChangeText={setGoodPoints} placeholder="例: ガクチカは具体的なエピソードで話せた" multiline />
            </View>
            <View style={styles.formGroup}>
              <FormLabel>🔄 詰まった質問</FormLabel>
              <FormInput value={stuckPoints} onChangeText={setStuckPoints} placeholder="例: なぜIT業界なのか" multiline />
            </View>
            <View style={styles.formGroup}>
              <FormLabel>⭐ 面接官の反応が良かった話</FormLabel>
              <FormInput value={positiveReactions} onChangeText={setPositiveReactions} placeholder="例: USJでの接客経験" multiline />
            </View>
            <View>
              <FormLabel>⚠️ 改善点</FormLabel>
              <FormInput value={improvements} onChangeText={setImprovements} placeholder="例: IT業界を志望する理由をもっと具体化" multiline />
            </View>
          </Card>

          {/* 自己評価 */}
          <SectionTitle>自己評価</SectionTitle>
          <Card>
            {(Object.keys(SELF_RATING_LABELS) as SelfRatingKey[]).map((k, i, arr) => (
              <View key={k} style={[styles.rateRow, i === arr.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <Text style={styles.rateLabel}>{SELF_RATING_LABELS[k]}</Text>
                <StarRating value={ratings[k]} onChange={(v) => setRatings((p) => ({ ...p, [k]: v }))} />
              </View>
            ))}
            <Text style={styles.rateHint}>★2以下の項目は、次の選考で「改善する」として引き継がれます</Text>
          </Card>

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.fg },
  headerSub: { fontSize: 11, color: colors.fgMuted },
  cancelBtn: { minWidth: 70 },
  cancelBtnText: { fontSize: 15, color: colors.fgMuted, fontWeight: '500' },
  saveBtn: {
    minWidth: 70, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, paddingHorizontal: 14,
    paddingVertical: 7, borderRadius: radius.sm,
  },
  saveBtnText: { fontSize: 15, color: '#fff', fontWeight: '700', textAlign: 'center' },

  content: { padding: spacing.md },
  formGroup: { marginBottom: 14 },
  formRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },

  qItem: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12, marginBottom: 12 },
  qTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  qNum: { fontSize: 13, fontWeight: '800', color: colors.primary, width: 26 },
  qInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: colors.fg, backgroundColor: colors.bg, fontWeight: '600',
  },
  suggestLabel: { fontSize: 12, color: colors.fgMuted, marginBottom: 6 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: colors.surface2,
  },
  suggestText: { fontSize: 12, color: colors.fgMuted, fontWeight: '500' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },

  carryHint: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: colors.primaryLight, borderRadius: radius.sm,
    padding: 10, marginBottom: 10,
  },
  carryHintText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.primary },

  rateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rateLabel: { fontSize: 14, fontWeight: '500', color: colors.fg },
  rateHint: { fontSize: 11, color: colors.fgSub, marginTop: 12 },
});
