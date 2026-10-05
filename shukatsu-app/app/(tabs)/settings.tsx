import React from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCompanies } from '@/src/context/CompaniesContext';
import { Colors, radius, shadow, spacing } from '@/src/theme';
import { useTheme, useThemedStyles } from '@/src/context/ThemeContext';
import { buildSampleCompanies } from '@/src/sampleData';

export default function SettingsScreen() {
  const { colors, isDark, setDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { companies, replaceAll } = useCompanies();

  const addSample = () => {
    replaceAll([...companies, ...buildSampleCompanies()]);
  };

  const clearAll = () => {
    Alert.alert(
      'すべてのデータを削除',
      'この操作は取り消せません。本当に削除しますか？',
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
  rowValue: { fontSize: 15, fontWeight: '600', color: colors.fgMuted },
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
