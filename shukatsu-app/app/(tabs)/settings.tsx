import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCompanies } from '@/src/context/CompaniesContext';
import { useAuth } from '@/src/context/AuthContext';
import { Colors, radius, shadow, spacing } from '@/src/theme';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { buildSampleCompanies } from '@/src/sampleData';

export default function SettingsScreen() {
  const { colors, isDark, setDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const {
    companies, replaceAll, sync, syncNow, discardLocalData, localOnlyCount, importLocalData,
  } = useCompanies();
  const { cloud, email, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);

  const lastSynced = sync.lastSyncedAt
    ? new Date(sync.lastSyncedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '未同期';
  const syncLabel =
    sync.phase === 'syncing' ? '同期中…'
      : sync.phase === 'offline' ? 'オフライン（通信が戻ると同期します）'
        : sync.rejected.length > 0 ? `保存できなかった変更 ${sync.rejected.length}件`
          : sync.pending > 0 ? `未送信 ${sync.pending}件`
          : `同期済み・${lastSynced}`;

  const logout = async () => {
    setBusy(true);
    // 未送信の変更があれば先に送る
    const pending = await syncNow();
    setBusy(false);
    const doLogout = async () => {
      await discardLocalData();
      await signOut();
    };
    Alert.alert(
      'ログアウト',
      pending > 0
        ? `まだクラウドに保存できていない変更が${pending}件あります。ログアウトするとこの変更は失われます。`
        : 'データはクラウドに保存されています。再度ログインすると復元されます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'ログアウト', style: pending > 0 ? 'destructive' : 'default', onPress: doLogout },
      ],
    );
  };

  const removeAccount = () => {
    Alert.alert(
      'アカウントを削除',
      'アカウントと、クラウドに保存されたすべての就活データが削除されます。この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する', style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const err = await deleteAccount();
            if (err) {
              setBusy(false);
              Alert.alert('削除できませんでした', err);
              return;
            }
            await discardLocalData();
          },
        },
      ],
    );
  };

  const addSample = () => {
    replaceAll([...companies, ...buildSampleCompanies()]);
  };

  const clearAll = () => {
    Alert.alert(
      'すべてのデータを削除',
      cloud
        ? 'ログイン中のすべての端末からデータが削除されます。この操作は取り消せません。本当に削除しますか？'
        : 'この操作は取り消せません。本当に削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除する', style: 'destructive', onPress: () => replaceAll([]) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>設定</Text>
        </View>

        {/* アカウント・同期 */}
        <Text style={styles.sectionTitle}>アカウント</Text>
        <View style={styles.card}>
          {cloud ? (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>ログイン中</Text>
                <Text style={styles.rowValue} numberOfLines={1}>{email}</Text>
              </View>
              <TouchableOpacity style={styles.row} onPress={() => syncNow()} disabled={busy}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>クラウド同期</Text>
                  <Text style={styles.rowSub}>{syncLabel}</Text>
                </View>
                {sync.phase === 'syncing' || busy
                  ? <ActivityIndicator color={colors.primary} />
                  : <Text style={[styles.rowValue, { color: colors.primary }]}>今すぐ同期</Text>}
              </TouchableOpacity>
              {sync.conflicts.length + sync.rejected.length > 0 && (
                <TouchableOpacity style={styles.row} onPress={() => router.push('/conflicts')}>
                  <Text style={[styles.rowLabel, { color: colors.warning }]}>
                    ⚠️ 確認が必要な変更（{sync.conflicts.length + sync.rejected.length}件）
                  </Text>
                  <Text style={styles.rowValue}>›</Text>
                </TouchableOpacity>
              )}
              {localOnlyCount > 0 && (
                <TouchableOpacity style={styles.row} onPress={importLocalData}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>この端末のデータをアカウントに移行</Text>
                    <Text style={styles.rowSub}>
                      ログイン前に保存した{localOnlyCount}社のデータが、この端末にだけ残っています
                    </Text>
                  </View>
                  <Text style={[styles.rowValue, { color: colors.primary }]}>移行</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={logout} disabled={busy}>
                <Text style={[styles.rowLabel, { color: colors.primary }]}>ログアウト</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>ローカル保存モード</Text>
                <Text style={styles.rowSub}>
                  データはこの端末だけに保存されています。.env に Supabase を設定すると、ログインと複数端末同期が有効になります。
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 表示 */}
        <Text style={styles.sectionTitle}>表示</Text>
        <View style={styles.card}>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>ダークモード</Text>
            <Switch
              value={isDark}
              onValueChange={setDark}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
              ios_backgroundColor={colors.border}
            />
          </View>
        </View>

        {/* データ */}
        <Text style={styles.sectionTitle}>データ</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>登録企業数</Text>
            <Text style={[styles.rowValue, { color: colors.primary }]}>{companies.length}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>サンプルデータを追加</Text>
              <Text style={styles.rowSub}>使い方を確認できるサンプルを追加します</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={addSample}>
              <Text style={styles.addBtnText}>追加</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 危険な操作 */}
        <Text style={styles.sectionTitle}>危険な操作</Text>
        <TouchableOpacity style={styles.dangerBtn} onPress={clearAll}>
          <Text style={styles.dangerBtnText}>すべてのデータを削除する</Text>
        </TouchableOpacity>
        {cloud && (
          <TouchableOpacity style={[styles.dangerBtn, { marginTop: 10 }]} onPress={removeAccount} disabled={busy}>
            <Text style={styles.dangerBtnText}>アカウントを削除する</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 40 },

  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '700', color: colors.fg, letterSpacing: -0.5 },

  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: colors.fgMuted,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 8, marginTop: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    ...shadow, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.fg },
  rowSub: { fontSize: 12, color: colors.fgMuted, marginTop: 2 },
  rowValue: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.fgMuted },
  addBtn: {
    backgroundColor: colors.primaryLight, paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: radius.sm,
  },
  addBtnText: { color: colors.primary, fontWeight: '600', fontSize: 13 },

  dangerBtn: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow,
  },
  dangerBtnText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
