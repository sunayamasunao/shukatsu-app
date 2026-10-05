import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface StarRatingProps {
  value?: number; // 1〜5、未評価は 0 / undefined
  onChange?: (v: number) => void; // 省略時は表示のみ
  size?: number;
}

/** 5段階の★評価。同じ★をもう一度押すと未評価に戻る */
export function StarRating({ value = 0, onChange, size = 22 }: StarRatingProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: onChange ? 4 : 1 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = (
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={size}
            color={n <= value ? colors.warning : colors.border}
          />
        );
        return onChange ? (
          <TouchableOpacity key={n} onPress={() => onChange(n === value ? 0 : n)} hitSlop={4}>
            {icon}
          </TouchableOpacity>
        ) : (
          <View key={n}>{icon}</View>
        );
      })}
    </View>
  );
}

/** 表の中で使う文字の★（★★★★☆） */
export function StarText({ value = 0, size = 13 }: { value?: number; size?: number }) {
  const { colors } = useTheme();
  if (!value) return <Text style={{ fontSize: size, color: colors.fgSub }}>未評価</Text>;
  return (
    <Text style={{ fontSize: size, letterSpacing: 1 }}>
      <Text style={{ color: colors.warning }}>{'★'.repeat(value)}</Text>
      <Text style={{ color: colors.border }}>{'★'.repeat(5 - value)}</Text>
    </Text>
  );
}
