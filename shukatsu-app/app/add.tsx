import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanies } from '@/src/context/CompaniesContext';
import { DateInput } from '@/src/components/DateInput';
import { Chips, FormInput, FormLabel, SectionTitle, SheetHeader } from '@/src/components/ui';
import { Colors, radius, readable, spacing } from '@/src/theme';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { Company, CompanyStatus, Flow, SelectionKind } from '@/src/types';
import { FLOW_STATUS_OPTIONS, SELECTION_KINDS } from '@/src/constants';
import { INDUSTRIES, uid } from '@/src/utils';
import { reviewHref } from '@/src/routes';
import { mergeFormEdit } from '@/src/sync/formMerge';

/** フォームで編集する項目（保存時に他端末の変更とマージする） */
const COMPANY_FORM_LABELS = {
  name: '企業名', industry: '業界', mypageUrl: 'マイページURL', status: 'ステータス',
  avgSalary: '平均年収', employees: '従業員数', location: '勤務地', founded: '設立年',
  benefits: '福利厚生', business: '事業内容', notes: '魅力・メモ', concerns: '懸念点',
} as const satisfies Partial<Record<keyof Company, string>>;
const FLOW_FORM_LABELS = {
  name: '名称', kind: '種類', date: '日付', time: '時間', online: '形式',
  location: '場所', deadline: '締切', status: 'ステータス', memo: 'メモ',
} as const satisfies Partial<Record<keyof Flow, string>>;
const COMPANY_FORM_KEYS = Object.keys(COMPANY_FORM_LABELS) as (keyof typeof COMPANY_FORM_LABELS)[];
const FLOW_FORM_KEYS = Object.keys(FLOW_FORM_LABELS) as (keyof typeof FLOW_FORM_LABELS)[];

/** 別端末で削除された企業を新しい企業として保存し直すため、id を振り直す */
function withNewIds(c: Company): Company {
  return {
    ...c,
    id: uid(),
    flows: c.flows.map((f) => ({
      ...f,
      id: uid(),
      tasks: f.tasks?.map((t) => ({ ...t, id: uid() })),
      review: f.review && { ...f.review, questions: f.review.questions.map((q) => ({ ...q, id: uid() })) },
    })),
    motivationHistory: undefined,
  };
}

const PLACE_OPTIONS: { label: string; online: boolean }[] = [
  { label: '対面', online: false },
  { label: 'オンライン', online: true },
];

const COMPANY_STATUS_OPTIONS: { value: CompanyStatus; label: string }[] = [
  { value: 'active', label: '選考中' },
  { value: 'offer', label: '内定' },
  { value: 'declined', label: '辞退' },
  { value: 'rejected', label: '不合格' },
];


// ─── メイン画面 ───────────────────────────────────

// 保存データの読み込みが終わってからフォームを初期化する
export default function AddScreen() {
  const { loading } = useCompanies();
  return loading ? null : <AddForm />;
}

function AddForm() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { companies, addCompany, updateCompany } = useCompanies();

  // フォームを開いた時点の値（保存時に、他端末での変更と区別するために使う）
  const [editing] = useState(() => (id ? companies.find((c) => c.id === id) ?? null : null));

  // 基本情報
  const [name, setName] = useState(editing?.name ?? '');
  const [industry, setIndustry] = useState(editing?.industry ?? '');
  const [mypageUrl, setMypageUrl] = useState(editing?.mypageUrl ?? '');
  const [status, setStatus] = useState<CompanyStatus>(editing?.status ?? 'active');

  // 選考フロー
  const [flows, setFlows] = useState<Flow[]>(editing?.flows ?? []);

  // 企業情報
  const [avgSalary, setAvgSalary] = useState(editing?.avgSalary ?? '');
  const [employees, setEmployees] = useState(editing?.employees ?? '');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [founded, setFounded] = useState(editing?.founded ?? '');
  const [benefits, setBenefits] = useState(editing?.benefits ?? '');
  const [business, setBusiness] = useState(editing?.business ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [concerns, setConcerns] = useState(editing?.concerns ?? '');

  // 「＋ フローを追加」→ 種類を選んで追加
  const [showKinds, setShowKinds] = useState(false);
  const addFlow = (kind: SelectionKind) => {
    setFlows((prev) => [
      ...prev,
      { id: uid(), name: kind === 'その他' ? '' : kind, kind, deadline: '', status: 'pending' },
    ]);
    setShowKinds(false);
  };

  const updateFlow = useCallback(
    (fid: string, data: Partial<Flow>) =>
      setFlows((prev) => prev.map((f) => (f.id === fid ? { ...f, ...data } : f))),
    [],
  );

  const removeFlow = useCallback(
    (fid: string) => setFlows((prev) => prev.filter((f) => f.id !== fid)),
    [],
  );

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('入力エラー', '企業名を入力してください');
      return;
    }

    const edited: Company = {
      ...(editing ?? {}),
      id: editing?.id ?? uid(),
      name: name.trim(),
      jobType: editing?.jobType ?? '',
      industry,
      mypageUrl: mypageUrl.trim(),
      status,
      flows: flows.filter((f) => f.name.trim()),
      avgSalary: avgSalary.trim(),
      employees: employees.trim(),
      location: location.trim(),
      founded: founded.trim(),
      benefits: benefits.trim(),
      business: business.trim(),
      notes: notes.trim(),
      concerns: concerns.trim(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };

    if (!editing) {
      await addCompany(edited);
      router.back();
      return;
    }

    const latest = companies.find((c) => c.id === editing.id);
    if (!latest) {
      Alert.alert(
        'この企業は別の端末で削除されています',
        '入力した内容を新しい企業として保存しますか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '新しく保存する', onPress: async () => { await addCompany(withNewIds(edited)); router.back(); } },
        ],
      );
      return;
    }

    // フォームで変更した項目だけを最新の値に重ねる（振り返り・準備タスクは別画面で保存されるので最新を使う）
    const top = mergeFormEdit(editing, edited, latest, COMPANY_FORM_KEYS);
    const conflictLabels: string[] = top.conflicts.map((k) => COMPANY_FORM_LABELS[k as keyof typeof COMPANY_FORM_LABELS]);
    const initialFlows = new Map(editing.flows.map((f) => [f.id, f]));
    const latestFlows = new Map(latest.flows.map((f) => [f.id, f]));
    const flowsMerged: Flow[] = [];
    const flowsKeep: Flow[] = [];
    for (const f of edited.flows) {
      const init = initialFlows.get(f.id);
      const cur = latestFlows.get(f.id);
      if (!init) {
        flowsMerged.push(f);
        flowsKeep.push(f);
      } else if (cur) {
        const m = mergeFormEdit(init, f, cur, FLOW_FORM_KEYS);
        flowsMerged.push(m.merged);
        flowsKeep.push(m.keepLatest);
        conflictLabels.push(...m.conflicts.map((k) => `${cur.name}の${FLOW_FORM_LABELS[k as keyof typeof FLOW_FORM_LABELS]}`));
      }
      // init はあるが cur が無い = 別の端末で削除された選考 → 削除を優先
    }
    // フォームを開いた後に別の端末で追加された選考は残す
    for (const f of latest.flows) {
      if (!initialFlows.has(f.id)) {
        flowsMerged.push(f);
        flowsKeep.push(f);
      }
    }

    const save = async (useLatestOnConflict: boolean) => {
      const base = useLatestOnConflict ? top.keepLatest : top.merged;
      await updateCompany(editing.id, { ...base, flows: useLatestOnConflict ? flowsKeep : flowsMerged });
      router.back();
    };

    if (conflictLabels.length === 0) {
      await save(false);
      return;
    }
    Alert.alert(
      '別の端末でこのデータが更新されています',
      `この画面を開いた後に、次の項目が別の端末で変更されました。\n\n${conflictLabels.map((l) => `・${l}`).join('\n')}`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '別の端末の内容を残す', onPress: () => save(true) },
        { text: 'この端末の内容で上書き', style: 'destructive', onPress: () => save(false) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ヘッダー */}
        <SheetHeader
          title={editing ? '企業を編集' : '企業を追加'}
          onCancel={() => router.back()}
          onSave={handleSave}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* 基本情報 */}
          <SectionTitle>基本情報</SectionTitle>
          <View style={styles.formGroup}>
            <FormLabel>企業名 *</FormLabel>
            <FormInput
              value={name} onChangeText={setName} placeholder="例: 株式会社〇〇"
              style={styles.nameInput}
            />
          </View>
          <View style={styles.formGroup}>
            <FormLabel>業界</FormLabel>
            {/* 以前に自由入力した業界も選択肢として残す */}
            <Chips
              value={industry || null}
              onChange={(v) => setIndustry(industry === v ? '' : v)}
              options={(industry && !INDUSTRIES.includes(industry) ? [...INDUSTRIES, industry] : INDUSTRIES)
                .map((opt) => ({ value: opt, label: opt }))}
            />
          </View>
          <View style={styles.formGroup}>
            <FormLabel>マイページURL</FormLabel>
            <FormInput
              value={mypageUrl} onChangeText={setMypageUrl} maxLength={2000}
              placeholder="https://..."
            />
          </View>
          <View>
            <FormLabel>ステータス</FormLabel>
            <Chips
              value={status}
              onChange={setStatus}
              options={COMPANY_STATUS_OPTIONS}
            />
          </View>

          {/* 選考フロー */}
          <SectionTitle>選考フロー</SectionTitle>
          {flows.map((flow, i) => (
            <View key={flow.id} style={styles.flowItem}>
              {/* フロー名 & 削除 */}
              <View style={styles.flowTop}>
                <Text style={styles.flowNum}>{i + 1}</Text>
                <TextInput
                  style={styles.flowNameInput}
                  value={flow.name}
                  onChangeText={(v) => updateFlow(flow.id, { name: v })}
                  placeholder="例: ES、1次面接、最終面接..."
                  placeholderTextColor={colors.fgSub}
                  maxLength={200}
                />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeFlow(flow.id)}
                  accessibilityLabel="この選考を削除"
                  activeOpacity={0.5}
                >
                  <Ionicons name="close-circle" size={24} color={colors.fgSub} />
                </TouchableOpacity>
              </View>

              {/* 日付・時間 */}
              <View style={styles.formRow}>
                <View style={styles.formGroupHalf}>
                  <FormLabel>日付</FormLabel>
                  <DateInput
                    value={flow.date ?? ''}
                    onChange={(v) => updateFlow(flow.id, { date: v })}
                    clearable
                    inset
                  />
                </View>
                <View style={styles.formGroupHalf}>
                  <FormLabel>時間</FormLabel>
                  <DateInput
                    mode="time"
                    value={flow.time ?? ''}
                    onChange={(v) => updateFlow(flow.id, { time: v })}
                    clearable
                    inset
                  />
                </View>
              </View>

              {/* 場所 / オンライン */}
              <View style={styles.formGroup}>
                <FormLabel>場所 / オンライン</FormLabel>
                <View style={[styles.chipsRow, { marginBottom: 8 }]}>
                  {PLACE_OPTIONS.map(({ label, online }) => {
                    const active = flow.online === online;
                    return (
                      <TouchableOpacity
                        key={label}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => updateFlow(flow.id, { online: flow.online === online ? undefined : online })}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <FormInput
                  value={flow.location ?? ''}
                  onChangeText={(v) => updateFlow(flow.id, { location: v })}
                  placeholder={flow.online ? '例: Zoom（URLはメモへ）' : '例: 本社 3F'}
                  inset
                />
              </View>

              {/* 締め切り日 */}
              <View style={styles.formGroup}>
                <FormLabel>締め切り日</FormLabel>
                <DateInput
                  value={flow.deadline}
                  onChange={(v) => updateFlow(flow.id, { deadline: v })}
                  clearable
                  inset
                />
              </View>

              {/* フローステータス */}
              <View style={styles.formGroup}>
                <FormLabel>ステータス</FormLabel>
                <Chips
                  value={flow.status}
                  onChange={(v) => updateFlow(flow.id, { status: v })}
                  options={FLOW_STATUS_OPTIONS}
                  inset
                />
              </View>

              {/* メモ */}
              <View style={styles.formGroup}>
                <FormLabel>メモ</FormLabel>
                <FormInput
                  value={flow.memo ?? ''}
                  onChangeText={(v) => updateFlow(flow.id, { memo: v })}
                  placeholder="持ち物・URL・面接官の名前など"
                  maxLength={10000}
                  multiline
                  inset
                />
              </View>

              {/* 振り返り（保存済みの選考のみ） */}
              {editing && editing.flows.some((x) => x.id === flow.id) ? (
                <TouchableOpacity
                  style={styles.reviewBtn}
                  onPress={() => router.push(reviewHref(editing.id, flow.id))}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name={editing.flows.find((x) => x.id === flow.id)?.review ? 'document-text' : 'create-outline'}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.reviewBtnText}>
                    {editing.flows.find((x) => x.id === flow.id)?.review ? '振り返りを編集' : '振り返りを追加'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.reviewHint}>保存後に振り返りを追加できます</Text>
              )}
            </View>
          ))}

          {showKinds ? (
            <View style={styles.kindPanel}>
              <Text style={styles.kindPanelTitle}>追加する選考を選択</Text>
              <View style={styles.chipsRow}>
                {SELECTION_KINDS.map((k) => (
                  <TouchableOpacity key={k} style={styles.kindChip} onPress={() => addFlow(k)} activeOpacity={0.6}>
                    <Text style={styles.kindChipText}>{k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={() => setShowKinds(false)} style={{ alignSelf: 'center', marginTop: 14 }} hitSlop={8}>
                <Text style={styles.closeText}>閉じる</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addFlowBtn} onPress={() => setShowKinds(true)} activeOpacity={0.6}>
              <Ionicons name="add-circle" size={20} color={colors.primary} />
              <Text style={styles.addFlowBtnText}>フローを追加</Text>
            </TouchableOpacity>
          )}

          {/* 企業情報 */}
          <SectionTitle>企業情報</SectionTitle>
          <View style={styles.formRow}>
            <View style={styles.formGroupHalf}>
              <FormLabel>平均年収</FormLabel>
              <FormInput value={avgSalary} onChangeText={setAvgSalary} placeholder="例: 450万円" />
            </View>
            <View style={styles.formGroupHalf}>
              <FormLabel>従業員数</FormLabel>
              <FormInput value={employees} onChangeText={setEmployees} placeholder="例: 1,200名" />
            </View>
          </View>
          <View style={styles.formRow}>
            <View style={styles.formGroupHalf}>
              <FormLabel>勤務地</FormLabel>
              <FormInput value={location} onChangeText={setLocation} placeholder="例: 東京都" />
            </View>
            <View style={styles.formGroupHalf}>
              <FormLabel>設立年</FormLabel>
              <FormInput value={founded} onChangeText={setFounded} maxLength={100} placeholder="例: 2000年" />
            </View>
          </View>
          <View style={styles.formGroup}>
            <FormLabel>福利厚生</FormLabel>
            <FormInput
              value={benefits} onChangeText={setBenefits}
              placeholder="完全週休2日・リモート可..."
              multiline
            />
          </View>
          <View style={styles.formGroup}>
            <FormLabel>事業内容</FormLabel>
            <FormInput
              value={business} onChangeText={setBusiness}
              placeholder="どんなサービス・事業をしているか..."
              multiline
            />
          </View>
          <View style={styles.formGroup}>
            <FormLabel>魅力・メモ</FormLabel>
            <FormInput
              value={notes} onChangeText={setNotes} maxLength={10000}
              placeholder="気になった点・志望動機など..."
              multiline
            />
          </View>
          <View>
            <FormLabel>懸念点</FormLabel>
            <FormInput
              value={concerns} onChangeText={setConcerns} maxLength={10000}
              placeholder="不安な点・気になる口コミなど..."
              multiline
            />
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  content: { ...readable, paddingHorizontal: spacing.screen, paddingBottom: 24 },

  formGroup: { marginBottom: 18 },
  formGroupHalf: { flex: 1, minWidth: 0 },
  formRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  nameInput: { fontSize: 17, fontWeight: '600' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: colors.elevated,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.fg },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },

  flowItem: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: 12,
  },
  flowTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  flowNum: {
    width: 26, height: 26, borderRadius: 13, overflow: 'hidden',
    backgroundColor: colors.fg, color: colors.bg,
    textAlign: 'center', lineHeight: 26, fontSize: 13, fontWeight: '800',
  },
  flowNameInput: {
    flex: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 16, color: colors.fg, backgroundColor: colors.bg,
    fontWeight: '700',
  },
  removeBtn: { padding: 2 },

  addFlowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
  },
  addFlowBtnText: { fontSize: 15, fontWeight: '700', color: colors.primary },

  kindPanel: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
  },
  kindPanelTitle: { fontSize: 15, fontWeight: '700', color: colors.fg, marginBottom: 12 },
  kindChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.full,
    backgroundColor: colors.elevated,
  },
  kindChipText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  closeText: { fontSize: 15, color: colors.fgMuted, fontWeight: '500' },

  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: radius.full, backgroundColor: colors.elevated,
  },
  reviewBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  reviewHint: { fontSize: 12, color: colors.fgSub, textAlign: 'center' },
});
