/**
 * 別の端末と同じ項目を同時に編集したときの確認画面。
 * 先にサーバーへ届いた値が表示されているので、この端末の値に戻すかを選んでもらう。
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCompanies } from '@/src/context/CompaniesContext';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { Colors, radius, shadow, spacing } from '@/src/theme';
import { ScreenHeader } from '@/src/components/ui';
import {
  EVAL_LABELS, FLOW_STATUS_LABEL, REVIEW_RESULT_OPTIONS, SELF_RATING_LABELS, STATUS_LABEL,
} from '@/src/constants';
import { FIELD_LABELS, TABLE_LABELS } from '@/src/sync/mapping';
import type { Conflict } from '@/src/sync/merge';
import { formatDateFull } from '@/src/utils';

const STAR_FIELDS = new Set(['work', 'salary', 'benefits', 'culture', 'growth', 'location', 'wlb', 'motivation']);

function formatValue(c: Conflict, v: unknown): string {
  if (v === null || v === undefined || v === '') return '（未入力）';
  const f = c.field ?? '';
  if (c.table === 'company_evaluations' && STAR_FIELDS.has(f) && typeof v === 'number') {
    return '★'.repeat(v) + '☆'.repeat(5 - v);
  }
  if (f === 'status' && typeof v === 'string') {
    return c.table === 'companies'
      ? STATUS_LABEL[v as keyof typeof STATUS_LABEL] ?? v
      : FLOW_STATUS_LABEL[v as keyof typeof FLOW_STATUS_LABEL] ?? v;
  }
  if (f === 'result') return REVIEW_RESULT_OPTIONS.find((o) => o.value === v)?.label ?? String(v);
  if (f === 'value') return `${v}%`;
  if (f === 'online') return v ? 'オンライン' : '対面';
  if (typeof v === 'boolean') return v ? 'はい' : 'いいえ';
  if ((f === 'date' || f === 'deadline') && typeof v === 'string') return formatDateFull(v);
  if (f === 'weights' && typeof v === 'object') {
    return Object.entries(v as Record<string, number>)
      .map(([k, w]) => `${EVAL_LABELS[k as keyof typeof EVAL_LABELS] ?? k} ${w}%`).join('、');
  }
  if (f === 'ratings' && typeof v === 'object') {
    return Object.entries(v as Record<string, number>)
      .map(([k, n]) => `${SELF_RATING_LABELS[k as keyof typeof SELF_RATING_LABELS] ?? k} ${n}`).join('、') || '（未入力）';
  }
  const s = String(v);
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
}

export default function ConflictsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { sync, resolveConflict, discardRejected } = useCompanies();
  const conflicts = [...sync.conflicts].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="確認が必要な変更" />
      <ScrollView contentContainerStyle={styles.content}>
        {sync.rejected.length > 0 && (
          <>
            <Text style={styles.groupTitle}>クラウドに保存できなかった変更</Text>
            <Text style={styles.lead}>
              次の変更はこの端末にだけ保存されていて、他の端末からは見えません。内容を修正すると自動で保存し直します。
            </Text>
            {sync.rejected.map((r) => (
              <View key={r.key} style={styles.card}>
                <Text style={styles.where} numberOfLines={2}>{TABLE_LABELS[r.table]}</Text>
                <Text style={styles.field}>{r.label}</Text>
                <Text style={styles.sub}>{r.message}</Text>
                <View style={styles.actions}>
                  {r.companyId && (
                    <TouchableOpacity style={styles.btnSoft} onPress={() => router.push(`/detail/${r.companyId}`)}>
                      <Text style={styles.btnSoftText}>開いて修正する</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.btnOutline} onPress={() => discardRejected(r.key)}>
                    <Text style={styles.btnOutlineText}>クラウドの内容に戻す</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {conflicts.length > 0 && <Text style={styles.groupTitle}>同時に編集された項目</Text>}
          </>
        )}

        {conflicts.length === 0 ? (sync.rejected.length > 0 ? null : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>✅ 確認が必要な更新はありません</Text>
          </View>
        )) : (
          <Text style={styles.lead}>
            同じ項目が別の端末でもほぼ同時に編集されました。現在は先に保存された内容を表示しています。
            この端末で入力した内容に戻す場合は「この端末の内容にする」を選んでください。
          </Text>
        )}

        {conflicts.map((c) => (
          <View key={c.key} style={styles.card}>
            <TouchableOpacity
              disabled={!c.companyId}
              onPress={() => c.companyId && router.push(`/detail/${c.companyId}`)}
            >
              <Text style={styles.where} numberOfLines={2}>{c.label || TABLE_LABELS[c.table]}</Text>
            </TouchableOpacity>

            {c.field === null ? (
              <>
                <Text style={styles.field}>別の端末で削除されました</Text>
                <Text style={styles.sub}>この端末で編集していた内容は反映されませんでした。</Text>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.btnSoft} onPress={() => resolveConflict(c.key, 'theirs')}>
                    <Text style={styles.btnSoftText}>確認しました</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.field}>{FIELD_LABELS[c.field] ?? c.field}</Text>
                <View style={styles.compare}>
                  <View style={[styles.valueBox, { borderColor: colors.primary }]}>
                    <Text style={[styles.valueTag, { color: colors.primary }]}>現在（別の端末）</Text>
                    <Text style={styles.value}>{formatValue(c, c.theirs)}</Text>
                  </View>
                  <View style={styles.valueBox}>
                    <Text style={styles.valueTag}>この端末</Text>
                    <Text style={styles.value}>{formatValue(c, c.mine)}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.btnSoft} onPress={() => resolveConflict(c.key, 'theirs')}>
                    <Text style={styles.btnSoftText}>このままにする</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnOutline} onPress={() => resolveConflict(c.key, 'mine')}>
                    <Text style={styles.btnOutlineText}>この端末の内容にする</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 40 },
  groupTitle: { fontSize: 15, fontWeight: '700', color: colors.fg, marginBottom: 6, marginTop: 4 },
  lead: { fontSize: 13, lineHeight: 20, color: colors.fgMuted, marginBottom: 14 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: colors.fgMuted },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: 12, ...shadow,
  },
  where: { fontSize: 12, color: colors.fgMuted },
  field: { fontSize: 16, fontWeight: '700', color: colors.fg, marginTop: 2 },
  sub: { fontSize: 13, color: colors.fgMuted, marginTop: 6 },
  compare: { gap: 8, marginTop: 10 },
  valueBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm,
  },
  valueTag: { fontSize: 11, fontWeight: '700', color: colors.fgMuted, marginBottom: 2 },
  value: { fontSize: 14, color: colors.fg, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnSoft: {
    flex: 1, backgroundColor: colors.primaryLight, borderRadius: radius.sm,
    paddingVertical: 10, alignItems: 'center',
  },
  btnSoftText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  btnOutline: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingVertical: 10, alignItems: 'center',
  },
  btnOutlineText: { color: colors.fg, fontWeight: '600', fontSize: 13 },
});
