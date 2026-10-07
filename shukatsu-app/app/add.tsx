import React, { useCallback, useEffect, useState } from 'react';
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
import { Colors, radius, shadow, spacing } from '@/src/theme';
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

// ─── 小コンポーネント ─────────────────────────────

function SectionTitle({ children }: { children: string }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function FormLabel({ children }: { children: string }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.label}>{children}</Text>;
}

// maxLength の既定値は DB の文字数制限（supabase/migrations）以下にしてある
function FormInput({
  value, onChangeText, placeholder, multiline = false, maxLength = multiline ? 5000 : 200,
}: {
  value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean; maxLength?: number;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TextInput
      style={[styles.input, multiline && styles.inputMulti]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.fgSub}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      maxLength={maxLength}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}

// ステータス選択（横並びチップ）
function StatusChips<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.chips}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.statusChip, value === opt.value && styles.statusChipActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.statusChipText, value === opt.value && styles.statusChipTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
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
        <View style={styles.header}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>キャンセル</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editing ? '企業を編集' : '企業を追加'}</Text>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>保存</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* 基本情報 */}
          <SectionTitle>基本情報</SectionTitle>
          <View style={styles.card}>
            <View style={styles.formGroup}>
              <FormLabel>企業名 *</FormLabel>
              <FormInput value={name} onChangeText={setName} placeholder="例: 株式会社〇〇" />
            </View>
            <View style={styles.formGroup}>
              <FormLabel>業界</FormLabel>
              <View style={styles.chips}>
                {/* 以前に自由入力した業界も選択肢として残す */}
                {(industry && !INDUSTRIES.includes(industry) ? [...INDUSTRIES, industry] : INDUSTRIES).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.statusChip, industry === opt && styles.statusChipActive]}
                    onPress={() => setIndustry(industry === opt ? '' : opt)}
                  >
                    <Text style={[styles.statusChipText, industry === opt && styles.statusChipTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.formGroup}>
              <FormLabel>マイページURL</FormLabel>
              <FormInput
                value={mypageUrl} onChangeText={setMypageUrl} maxLength={2000}
                placeholder="https://..."
              />
            </View>
            <View style={styles.formGroup}>
              <FormLabel>ステータス</FormLabel>
              <StatusChips
                value={status}
                onChange={setStatus}
                options={COMPANY_STATUS_OPTIONS}
              />
            </View>
          </View>

          {/* 選考フロー */}
          <SectionTitle>選考フロー</SectionTitle>
          <View style={styles.card}>
            {flows.map((flow) => (
              <View key={flow.id} style={styles.flowItem}>
                {/* フロー名 & 削除 */}
                <View style={styles.flowTop}>
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
                  >
                    <Ionicons name="close-circle" size={22} color={colors.fgSub} />
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
                    />
                  </View>
                  <View style={styles.formGroupHalf}>
                    <FormLabel>時間</FormLabel>
                    <DateInput
                      mode="time"
                      value={flow.time ?? ''}
                      onChange={(v) => updateFlow(flow.id, { time: v })}
                      clearable
                    />
                  </View>
                </View>

                {/* 場所 / オンライン */}
                <View style={styles.formGroup}>
                  <FormLabel>場所 / オンライン</FormLabel>
                  <View style={[styles.chips, { marginBottom: 8 }]}>
                    {PLACE_OPTIONS.map(({ label, online }) => (
                      <TouchableOpacity
                        key={label}
                        style={[styles.statusChip, flow.online === online && styles.statusChipActive]}
                        onPress={() => updateFlow(flow.id, { online: flow.online === online ? undefined : online })}
                      >
                        <Text style={[styles.statusChipText, flow.online === online && styles.statusChipTextActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <FormInput
                    value={flow.location ?? ''}
                    onChangeText={(v) => updateFlow(flow.id, { location: v })}
                    placeholder={flow.online ? '例: Zoom（URLはメモへ）' : '例: 本社 3F'}
                  />
                </View>

                {/* 締め切り日 */}
                <View style={styles.formGroup}>
                  <FormLabel>締め切り日</FormLabel>
                  <DateInput
                    value={flow.deadline}
                    onChange={(v) => updateFlow(flow.id, { deadline: v })}
                    clearable
                  />
                </View>

                {/* フローステータス */}
                <View style={styles.formGroup}>
                  <FormLabel>ステータス</FormLabel>
                  <StatusChips
                    value={flow.status}
                    onChange={(v) => updateFlow(flow.id, { status: v })}
                    options={FLOW_STATUS_OPTIONS}
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
                  />
                </View>

                {/* 振り返り（保存済みの選考のみ） */}
                {editing && editing.flows.some((x) => x.id === flow.id) ? (
                  <TouchableOpacity
                    style={styles.reviewBtn}
                    onPress={() => router.push(reviewHref(editing.id, flow.id))}
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
                <View style={styles.chips}>
                  {SELECTION_KINDS.map((k) => (
                    <TouchableOpacity key={k} style={styles.kindChip} onPress={() => addFlow(k)}>
                      <Text style={styles.kindChipText}>{k}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={() => setShowKinds(false)} style={{ alignSelf: 'center', marginTop: 10 }}>
                  <Text style={styles.cancelBtnText}>閉じる</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addFlowBtn} onPress={() => setShowKinds(true)}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.addFlowBtnText}>フローを追加</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 企業情報 */}
          <SectionTitle>企業情報</SectionTitle>
          <View style={styles.card}>
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
            <View style={[styles.formGroup, { marginBottom: 0 }]}>
              <FormLabel>懸念点</FormLabel>
              <FormInput
                value={concerns} onChangeText={setConcerns} maxLength={10000}
                placeholder="不安な点・気になる口コミなど..."
                multiline
              />
            </View>
          </View>

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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.fg },
  cancelBtn: { minWidth: 70 },
  cancelBtnText: { fontSize: 15, color: colors.fgMuted, fontWeight: '500' },
  saveBtn: {
    minWidth: 70, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, paddingHorizontal: 14,
    paddingVertical: 7, borderRadius: radius.sm,
  },
  saveBtnText: { fontSize: 15, color: '#fff', fontWeight: '700', textAlign: 'center' },

  content: { padding: spacing.md },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: colors.fgMuted,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginTop: 20, marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow,
    marginBottom: 4,
  },

  formGroup: { marginBottom: 14 },
  formGroupHalf: { flex: 1, minWidth: 0 },
  formRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.fg, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.fg, backgroundColor: colors.bg,
  },
  inputMulti: { minHeight: 80, paddingTop: 10 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface2,
  },
  statusChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  statusChipText: { fontSize: 12, fontWeight: '500', color: colors.fgMuted },
  statusChipTextActive: { color: colors.primary, fontWeight: '600' },

  flowItem: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingBottom: 14, marginBottom: 14,
  },
  flowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  flowNameInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: colors.fg, backgroundColor: colors.bg,
    fontWeight: '600',
  },
  removeBtn: { padding: 4 },

  addFlowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
  },
  addFlowBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },

  kindPanel: {
    borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
    borderRadius: radius.sm, padding: 12,
  },
  kindPanelTitle: { fontSize: 13, fontWeight: '600', color: colors.fg, marginBottom: 10 },
  kindChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  kindChipText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.primaryLight,
  },
  reviewBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  reviewHint: { fontSize: 12, color: colors.fgSub, textAlign: 'center' },
});
