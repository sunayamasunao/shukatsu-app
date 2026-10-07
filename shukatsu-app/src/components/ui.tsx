/**
 * 新しい画面で共通に使う部品。見た目は既存画面（add / detail）のスタイルに合わせている。
 */
import React from 'react';
import {
  StyleProp, StyleSheet, Text, TextInput, TouchableOpacity, View, ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, shadow, spacing } from '../theme';
import { useTheme, useThemedStyles } from '../context/ThemeContext';

/** 戻るボタン付きヘッダー（企業詳細と同じ形） */
export function ScreenHeader({
  title, subtitle, right,
}: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={colors.fg} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Card({
  title, children, style, right,
}: { title?: string; children: React.ReactNode; style?: StyleProp<ViewStyle>; right?: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function FormLabel({ children, hint }: { children: string; hint?: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={styles.label}>{children}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

// maxLength の既定値は DB の文字数制限（supabase/migrations）以下にしてある
export function FormInput({
  value, onChangeText, placeholder, multiline = false, keyboardType, maxLength = multiline ? 5000 : 200,
}: {
  value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: 'default' | 'number-pad'; maxLength?: number;
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
      keyboardType={keyboardType}
      maxLength={maxLength}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}

export function Chips<T extends string | number>({
  value, onChange, options, allowDeselect = false,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  allowDeselect?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.chips}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={String(opt.value)}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(active && allowDeselect ? ('' as T) : opt.value)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** カード内の「ラベル ─ 値」行 */
export function InfoRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0, paddingBottom: 0 }]}>
      <Text style={styles.infoKey}>{label}</Text>
      {typeof value === 'string' ? <Text style={styles.infoVal}>{value}</Text> : <View style={{ flex: 1 }}>{value}</View>}
    </View>
  );
}

export function PrimaryButton({
  label, onPress, icon, variant = 'solid',
}: {
  label: string; onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  variant?: 'solid' | 'soft' | 'dashed';
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const color = variant === 'solid' ? '#fff' : colors.primary;
  return (
    <TouchableOpacity
      style={[styles.btn, variant === 'soft' && styles.btnSoft, variant === 'dashed' && styles.btnDashed]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <Text style={[styles.btnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const makeStyles = (colors: Colors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.fg },
  headerSub: { fontSize: 12, color: colors.fgMuted, marginBottom: 1 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, ...shadow, marginBottom: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: {
    fontSize: 12, fontWeight: '700', color: colors.fgMuted,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },

  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 20, marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: colors.fgMuted,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },

  label: { fontSize: 13, fontWeight: '600', color: colors.fg },
  hint: { fontSize: 11, color: colors.fgSub, marginTop: 2 },
  input: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.fg, backgroundColor: colors.bg,
  },
  inputMulti: { minHeight: 80, paddingTop: 10 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface2,
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '500', color: colors.fgMuted },
  chipTextActive: { color: colors.primary, fontWeight: '600' },

  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingBottom: 10, marginBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoKey: { width: 84, fontSize: 13, color: colors.fgMuted, fontWeight: '500' },
  infoVal: { flex: 1, fontSize: 14, color: colors.fg, lineHeight: 20 },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 12,
  },
  btnSoft: { backgroundColor: colors.primaryLight },
  btnDashed: {
    backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
  },
  btnText: { fontSize: 14, fontWeight: '700' },
});
