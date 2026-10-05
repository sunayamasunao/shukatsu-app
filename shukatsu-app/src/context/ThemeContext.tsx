import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, darkColors, lightColors } from '../theme';

const STORAGE_KEY = '@shukatsu:dark_mode_v1';

interface ThemeContextValue {
  isDark: boolean;
  colors: Colors;
  setDark: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  // null = 端末の設定に従う
  const [override, setOverride] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw !== null) setOverride(raw === '1');
      })
      .catch(console.error);
  }, []);

  const isDark = override ?? system === 'dark';

  const value = useMemo<ThemeContextValue>(() => ({
    isDark,
    colors: isDark ? darkColors : lightColors,
    setDark: (v: boolean) => {
      setOverride(v);
      AsyncStorage.setItem(STORAGE_KEY, v ? '1' : '0').catch(console.error);
    },
  }), [isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** テーマ色から StyleSheet を生成（色が変わったときだけ作り直す） */
export function useThemedStyles<T>(factory: (c: Colors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
