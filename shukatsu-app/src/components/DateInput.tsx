import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, spacing } from '../theme';
import { useTheme, useThemedStyles } from '../context/ThemeContext';
import { formatDateFull, toDateStr } from '../utils';

interface DateInputProps {
  value: string; // YYYY-MM-DD / HH:MM or ''
  onChange: (v: string) => void;
  placeholder?: string;
  mode?: 'date' | 'time';
  clearable?: boolean;
}

export function DateInput({
  value, onChange, placeholder, mode = 'date', clearable = false,
}: DateInputProps) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [show, setShow] = useState(false);
  const dateObj = !value ? new Date()
    : mode === 'time' ? new Date(`2000-01-01T${value}:00`)
    : new Date(value + 'T00:00:00');
  const label = !value ? (placeholder ?? (mode === 'time' ? '時間を選択' : '日付を選択'))
    : mode === 'time' ? value : formatDateFull(value);

  const handleChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selected) {
      onChange(mode === 'time'
        ? `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`
        : toDateStr(selected));
    }
  };

  return (
    <View>
      <TouchableOpacity style={styles.btn} onPress={() => setShow(true)} activeOpacity={0.7}>
        <Ionicons name={mode === 'time' ? 'time-outline' : 'calendar-outline'} size={15} color={colors.fgMuted} />
        <Text style={[value ? styles.valueText : styles.placeholder, { flex: 1 }]}>{label}</Text>
        {clearable && value ? (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.fgSub} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          value={dateObj}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          locale="ja-JP"
          themeVariant={isDark ? 'dark' : 'light'}
        />
      )}

      {/* iOS: 完了ボタン */}
      {show && Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.doneBtn} onPress={() => setShow(false)}>
          <Text style={styles.doneBtnText}>完了</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  placeholder: {
    fontSize: 14,
    color: colors.fgSub,
  },
  valueText: {
    fontSize: 14,
    color: colors.fg,
    fontWeight: '500',
  },
  doneBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  doneBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
