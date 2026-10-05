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
import { colors, radius, spacing } from '../theme';
import { formatDateFull } from '../utils';

interface DateInputProps {
  value: string; // YYYY-MM-DD or ''
  onChange: (v: string) => void;
  placeholder?: string;
}

export function DateInput({ value, onChange, placeholder = '日付を選択' }: DateInputProps) {
  const [show, setShow] = useState(false);
  const dateObj = value ? new Date(value + 'T00:00:00') : new Date();

  const handleChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selected) {
      onChange(selected.toISOString().slice(0, 10));
    }
  };

  return (
    <View>
      <TouchableOpacity style={styles.btn} onPress={() => setShow(true)} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={15} color={colors.fgMuted} />
        <Text style={value ? styles.valueText : styles.placeholder}>
          {value ? formatDateFull(value) : placeholder}
        </Text>
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          locale="ja-JP"
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

const styles = StyleSheet.create({
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
