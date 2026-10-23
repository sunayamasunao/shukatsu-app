/**
 * アプリ全体で共通に使う部品。
 * 影や枠線で囲む代わりに、余白・文字の大きさ・薄い塗りで情報のまとまりを表す。
 */
import React from 'react';
import {
  StyleProp, StyleSheet, Text, TextInput, TextStyle, TouchableOpacity, View, ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, shadow, spacing, toneColors, type } from '../theme';
import { Tone } from '../presentation';
import { useTheme, useThemedStyles } from '../context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** 丸いアイコンボタン（戻る・追加・削除など） */
export function IconButton({
  icon, onPress, tone, accessibilityLabel, size = 36, disabled,
}: {
  icon: IconName; onPress: () => void; tone?: Tone;
  accessibilityLabel: string; size?: number; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const t = tone ? toneColors(colors, tone) : { fg: colors.fg, bg: colors.surface };
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.55)} color={t.fg} />
    </TouchableOpacity>
  );
}

/** 文字だけのボタン（ナビゲーションバーの「キャンセル」「保存」など） */
export function TextButton({
  label, onPress, strong, color, disabled,
}: { label: string; onPress: () => void; strong?: boolean; color?: string; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.5} hitSlop={10} accessibilityRole="button">
      <Text style={{
        fontSize: 16, fontWeight: strong ? '700' : '400',
        color: color ?? colors.primary, opacity: disabled ? 0.4 : 1,
      }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** 戻るボタン付きヘッダー（詳細画面用） */
export function ScreenHeader({
  title, subtitle, right,
}: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  return (
    <View style={styles.header}>
      <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="戻る" />
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

/** モーダル（シート）用のヘッダー: キャンセル ─ タイトル ─ 保存 */
export function SheetHeader({
  title, subtitle, onCancel, onSave, saveLabel = '保存',
}: { title: string; subtitle?: string; onCancel: () => void; onSave: () => void; saveLabel?: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.sheetHeader}>
      <View style={styles.sheetSide}>
        <TextButton label="キャンセル" onPress={onCancel} color={colors.fgMuted} />
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {subtitle ? <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
        <Text style={styles.sheetTitle} numberOfLines={1}>{title}</Text>
      </View>
      <View style={[styles.sheetSide, { alignItems: 'flex-end' }]}>
        <TextButton label={saveLabel} onPress={onSave} strong />
      </View>
    </View>
  );
}

/** タブ画面の大きな見出し */
export function LargeTitle({
  title, eyebrow, subtitle, right,
}: { title: string; eyebrow?: string; subtitle?: string; right?: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.largeTitleWrap}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.largeTitle} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
        {subtitle ? <Text style={styles.largeSub}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.largeRight}>{right}</View> : null}
    </View>
  );
}

/** 見出し付きのまとまり。見出しは本文より一段大きく、カードで囲まない */
export function Section({
  title, right, children, style, footer,
}: {
  title?: string; right?: React.ReactNode; children: React.ReactNode;
  style?: StyleProp<ViewStyle>; footer?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

/** 薄い塗りで囲んだグループ（設定の行・入力欄のまとまりなど） */
export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.group, style]}>{children}</View>;
}

/** 見出し＋塗りのブロック（従来の Card と同じ使い方） */
export function Card({
  title, children, style, right,
}: { title?: string; children: React.ReactNode; style?: StyleProp<ViewStyle>; right?: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {right}
        </View>
      ) : null}
      <View style={[styles.card, style]}>{children}</View>
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.sectionRow, { marginTop: spacing.lg }]}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

/** 設定画面などの1行 */
export function ListRow({
  title, subtitle, icon, iconTone, right, onPress, chevron, destructive, last, disabled, titleColor,
}: {
  title: string; subtitle?: string; icon?: IconName; iconTone?: Tone;
  right?: React.ReactNode; onPress?: () => void; chevron?: boolean;
  destructive?: boolean; last?: boolean; disabled?: boolean; titleColor?: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tone = iconTone ? toneColors(colors, iconTone) : null;
  const body = (
    <View style={styles.listRow}>
      {icon ? (
        <View style={[styles.listIcon, tone && { backgroundColor: tone.bg }]}>
          <Ionicons name={icon} size={17} color={tone?.fg ?? colors.fgMuted} />
        </View>
      ) : null}
      <View style={[styles.listBody, !last && styles.listDivider]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.listTitle, destructive && { color: colors.danger }, titleColor ? { color: titleColor } : null]}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.listSub}>{subtitle}</Text> : null}
        </View>
        {right}
        {chevron ? <Ionicons name="chevron-forward" size={17} color={colors.fgSub} /> : null}
      </View>
    </View>
  );
  if (!onPress) return body;
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.6} accessibilityRole="button">
      {body}
    </TouchableOpacity>
  );
}

/** 小さなラベル（ステータスなど） */
export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const t = toneColors(colors, tone);
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      {icon ? <Ionicons name={icon} size={11} color={t.fg} /> : null}
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/** iOS のセグメントコントロール */
export function Segmented<T extends string>({
  value, options, onChange,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.segItem, active && styles.segItemActive]}
            onPress={() => onChange(o.value)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** 横棒の進捗 */
export function ProgressBar({
  value, tone = 'primary', height = 6, style,
}: { value: number; tone?: Tone; height?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const fill = tone === 'neutral' ? colors.fgSub : toneColors(colors, tone).fg;
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: colors.surface2, overflow: 'hidden' }, style]}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height / 2, backgroundColor: fill }} />
    </View>
  );
}

/** 空のときの案内 */
export function EmptyState({
  icon, title, message, children,
}: { icon: IconName; title: string; message?: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.fgMuted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMsg}>{message}</Text> : null}
      {children}
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
  style, inset,
}: {
  value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: 'default' | 'number-pad'; maxLength?: number;
  style?: StyleProp<TextStyle>;
  /** 塗りのブロックの中に置くとき（背景色を一段変える） */
  inset?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TextInput
      style={[styles.input, inset && styles.inputInset, multiline && styles.inputMulti, style]}
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
  value, onChange, options, allowDeselect = false, inset,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  allowDeselect?: boolean;
  inset?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.chips}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={String(opt.value)}
            style={[styles.chip, inset && styles.chipInset, active && styles.chipActive]}
            onPress={() => onChange(active && allowDeselect ? ('' as T) : opt.value)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** 「ラベル ─ 値」行 */
export function InfoRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoKey}>{label}</Text>
      {typeof value === 'string' ? <Text style={styles.infoVal}>{value}</Text> : <View style={{ flex: 1 }}>{value}</View>}
    </View>
  );
}

export function PrimaryButton({
  label, onPress, icon, variant = 'solid',
}: {
  label: string; onPress: () => void;
  icon?: IconName;
  variant?: 'solid' | 'soft' | 'dashed';
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const color = variant === 'solid' ? colors.onPrimary : colors.primary;
  return (
    <TouchableOpacity
      style={[styles.btn, variant === 'soft' && styles.btnSoft, variant === 'dashed' && styles.btnDashed]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <Text style={[styles.btnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const makeStyles = (colors: Colors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.md, paddingTop: 6, paddingBottom: 10,
    backgroundColor: colors.bg,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.fg },
  headerSub: { fontSize: 12, color: colors.fgMuted, marginBottom: 1 },

  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  sheetSide: { minWidth: 84 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.fg },

  largeTitleWrap: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 12,
    paddingTop: spacing.md, paddingBottom: spacing.md,
  },
  eyebrow: { ...type.subhead, fontWeight: '600', color: colors.fgMuted, marginBottom: 2 },
  largeTitle: { ...type.largeTitle, color: colors.fg },
  largeSub: { ...type.subhead, color: colors.fgMuted, marginTop: 6 },
  largeRight: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },

  section: { marginBottom: spacing.section },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, gap: 12,
  },
  sectionTitle: { ...type.headline, color: colors.fg, flexShrink: 1 },
  footer: { ...type.caption, fontWeight: '400', color: colors.fgSub, marginTop: 8, paddingHorizontal: 4, lineHeight: 17 },

  group: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },

  listRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.md, minHeight: 50 },
  listIcon: {
    width: 30, height: 30, borderRadius: 8, marginRight: 12,
    backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
  },
  listBody: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingRight: spacing.md,
  },
  listDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  listTitle: { fontSize: 16, color: colors.fg },
  listSub: { ...type.subhead, color: colors.fgMuted, marginTop: 2 },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, alignSelf: 'flex-start',
  },
  pillText: { fontSize: 11, fontWeight: '700' },

  segment: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.full, padding: 3,
  },
  segItem: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', borderRadius: radius.full },
  segItemActive: { backgroundColor: colors.elevated, ...shadow },
  segText: { fontSize: 13, fontWeight: '600', color: colors.fgMuted },
  segTextActive: { color: colors.fg, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emptyTitle: { ...type.headline, color: colors.fg, textAlign: 'center' },
  emptyMsg: { ...type.subhead, color: colors.fgMuted, textAlign: 'center', lineHeight: 20 },

  label: { fontSize: 13, fontWeight: '600', color: colors.fgMuted },
  hint: { fontSize: 12, color: colors.fgSub, marginTop: 2 },
  input: {
    borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: colors.fg, backgroundColor: colors.surface,
  },
  inputInset: { backgroundColor: colors.bg },
  inputMulti: { minHeight: 92, paddingTop: 12, lineHeight: 22 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: colors.surface,
  },
  chipInset: { backgroundColor: colors.elevated },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.fg },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },

  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  infoKey: { width: 84, fontSize: 14, color: colors.fgMuted },
  infoVal: { flex: 1, fontSize: 15, color: colors.fg, lineHeight: 21 },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: radius.full, paddingVertical: 14, minHeight: 48,
  },
  btnSoft: { backgroundColor: colors.primaryLight },
  btnDashed: {
    backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
  },
  btnText: { fontSize: 15, fontWeight: '700' },
});
