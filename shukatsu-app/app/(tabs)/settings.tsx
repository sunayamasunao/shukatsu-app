import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCompanies } from '@/src/context/CompaniesContext';
import { useAuth } from '@/src/context/AuthContext';
import { Colors, radius, readable, spacing } from '@/src/theme';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { buildSampleCompanies } from '@/src/sampleData';
import { Tone } from '@/src/presentation';
import { Group, LargeTitle, ListRow, Section } from '@/src/components/ui';

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
  // 同期状態のアイコンの色
  const syncTone: Tone =
    sync.phase === 'syncing' ? 'primary'
      : sync.phase === 'offline' ? 'neutral'
        : sync.rejected.length > 0 || sync.pending > 0 ? 'warning'
          : 'success';
  const syncIcon =
    sync.phase === 'offline' ? 'cloud-offline-outline' as const
      : sync.rejected.length > 0 || sync.pending > 0 ? 'cloud-upload-outline' as const
        : 'cloud-done-outline' as const;

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
        <LargeTitle title="設定" />

        {/* アカウント・同期 */}
        <Section title="アカウント">
          {cloud ? (
            <>
              <View style={styles.profile}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(email ?? '?').slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
                  <Text style={styles.profileSub}>ログイン中</Text>
                </View>
              </View>
              <Group>
                <ListRow
                  icon={syncIcon}
                  iconTone={syncTone}
                  title="クラウド同期"
                  subtitle={syncLabel}
                  onPress={() => syncNow()}
                  disabled={busy}
                  last={sync.conflicts.length + sync.rejected.length === 0 && localOnlyCount === 0}
                  right={sync.phase === 'syncing' || busy
                    ? <ActivityIndicator color={colors.primary} />
                    : <Text style={styles.actionText}>今すぐ同期</Text>}
                />
                {sync.conflicts.length + sync.rejected.length > 0 && (
                  <ListRow
                    icon="alert-circle"
                    iconTone="warning"
                    title={`確認が必要な変更（${sync.conflicts.length + sync.rejected.length}件）`}
                    titleColor={colors.warning}
                    onPress={() => router.push('/conflicts')}
                    chevron
                    last={localOnlyCount === 0}
                  />
                )}
                {localOnlyCount > 0 && (
                  <ListRow
                    icon="phone-portrait-outline"
                    iconTone="primary"
                    title="この端末のデータをアカウントに移行"
                    subtitle={`ログイン前に保存した${localOnlyCount}社のデータが、この端末にだけ残っています`}
                    onPress={importLocalData}
                    right={<Text style={styles.actionText}>移行</Text>}
                    last
                  />
                )}
              </Group>
              <Group style={{ marginTop: 12 }}>
                <ListRow
                  title="ログアウト"
                  titleColor={colors.primary}
                  onPress={logout}
                  disabled={busy}
                  last
                />
              </Group>
            </>
          ) : (
            <Group>
              <ListRow
                icon="phone-portrait-outline"
                title="ローカル保存モード"
                subtitle="データはこの端末だけに保存されています。.env に Supabase を設定すると、ログインと複数端末同期が有効になります。"
                last
              />
            </Group>
          )}
        </Section>

        {/* 表示 */}
        <Section title="表示">
          <Group>
            <ListRow
              icon={isDark ? 'moon' : 'moon-outline'}
              iconTone={isDark ? 'primary' : undefined}
              title="ダークモード"
              last
              right={
                <Switch
                  value={isDark}
                  onValueChange={setDark}
                  trackColor={{ false: colors.surface2, true: colors.success }}
                  thumbColor="#fff"
                  ios_backgroundColor={colors.surface2}
                />
              }
            />
          </Group>
        </Section>

        {/* データ */}
        <Section title="データ">
          <Group>
            <ListRow
              icon="briefcase-outline"
              title="登録企業数"
              right={<Text style={styles.valueText}>{companies.length}社</Text>}
            />
            <ListRow
              icon="sparkles-outline"
              title="サンプルデータを追加"
              subtitle="使い方を確認できるサンプルを追加します"
              last
              right={
                <TouchableOpacity style={styles.addBtn} onPress={addSample} activeOpacity={0.6}>
                  <Text style={styles.addBtnText}>追加</Text>
                </TouchableOpacity>
              }
            />
          </Group>
        </Section>

        {/* 危険な操作 */}
        <Section title="危険な操作" footer="どちらも取り消すことはできません。">
          <Group>
            <ListRow
              icon="trash-outline"
              iconTone="danger"
              title="すべてのデータを削除する"
              destructive
              onPress={clearAll}
              last={!cloud}
            />
            {cloud && (
              <ListRow
                icon="person-remove-outline"
                iconTone="danger"
                title="アカウントを削除する"
                destructive
                onPress={removeAccount}
                disabled={busy}
                last
              />
            )}
          </Group>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { ...readable, paddingHorizontal: spacing.screen, paddingBottom: spacing.tabBar },

  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: colors.primary },
  profileEmail: { fontSize: 17, fontWeight: '700', color: colors.fg },
  profileSub: { fontSize: 13, color: colors.fgMuted, marginTop: 2 },

  actionText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  valueText: { fontSize: 16, color: colors.fgMuted, fontVariant: ['tabular-nums'] },
  addBtn: {
    backgroundColor: colors.elevated, paddingHorizontal: 16,
    paddingVertical: 7, borderRadius: radius.full,
  },
  addBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
