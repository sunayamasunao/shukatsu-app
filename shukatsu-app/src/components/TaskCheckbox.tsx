import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { useTheme, useThemedStyles } from '../context/ThemeContext';

/** 準備タスクのチェックボックス。完了すると青いチェックが入り、文字に取り消し線が付く */
export function TaskCheckbox({
  label, checked, onToggle, size = 'md',
}: {
  label: string; checked: boolean; onToggle: () => void; size?: 'sm' | 'md';
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const box = size === 'sm' ? 18 : 22;
  return (
    <TouchableOpacity style={styles.row} onPress={onToggle} activeOpacity={0.6} hitSlop={4}>
      <View
        style={[
          styles.box,
          { width: box, height: box, borderRadius: size === 'sm' ? 4 : 6 },
          checked && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
      >
        {checked && <Ionicons name="checkmark" size={box - 6} color="#fff" />}
      </View>
      <Text style={[styles.label, size === 'sm' && { fontSize: 14 }, checked && styles.labelDone]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: {
    borderWidth: 2, borderColor: colors.fgSub,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { flex: 1, fontSize: 15, color: colors.fg },
  labelDone: { color: colors.fgSub, textDecorationLine: 'line-through' },
});
