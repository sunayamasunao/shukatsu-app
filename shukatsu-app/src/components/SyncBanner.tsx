/**
 * ホーム上部の同期のお知らせ。普段は何も出さず、
 * 「別の端末と同じ項目を同時に編集した」「オフラインで未送信がある」ときだけ表示する。
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCompanies } from '../context/CompaniesContext';
import { useThemedStyles } from '../context/ThemeContext';
import { Colors, radius, spacing } from '../theme';

export function SyncBanner() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { sync } = useCompanies();

  if (sync.conflicts.length > 0 || sync.rejected.length > 0) {
    return (
      <TouchableOpacity style={[styles.box, styles.warn]} onPress={() => router.push('/conflicts')} activeOpacity={0.8}>
        {sync.rejected.length > 0 && (
          <Text style={styles.text}>⚠️ クラウドに保存できなかった変更があります（{sync.rejected.length}件）</Text>
        )}
        {sync.conflicts.length > 0 && (
          <Text style={styles.text}>⚠️ 別の端末でこのデータが更新されています（{sync.conflicts.length}件）</Text>
        )}
        <Text style={styles.link}>確認する ›</Text>
      </TouchableOpacity>
    );
  }
  if (sync.phase === 'offline' && sync.pending > 0) {
    return (
      <View style={[styles.box, styles.info]}>
        <Text style={styles.text}>
          📶 オフラインです。{sync.pending}件の変更はこの端末に保存済みで、通信が戻ると自動で同期します。
        </Text>
      </View>
    );
  }
  return null;
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  box: { borderRadius: radius.md, padding: spacing.sm + 4, marginBottom: 12 },
  warn: { backgroundColor: colors.warningLight },
  info: { backgroundColor: colors.surface2 },
  text: { fontSize: 13, color: colors.fg, lineHeight: 19 },
  link: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 4 },
});
