import { Platform } from 'react-native';

export const lightColors = {
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  primaryDark: '#1D4ED8',
  success: '#16A34A',
  successLight: '#DCFCE7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  bg: '#F4F6FA',
  surface: '#FFFFFF',
  surface2: '#EEF1F8',
  fg: '#1A1D26',
  fgMuted: '#6B7280',
  fgSub: '#9CA3AF',
  border: '#E2E6F0',
};

export type Colors = typeof lightColors;

export const darkColors: Colors = {
  primary: '#3B82F6',
  primaryLight: '#1E2B4D',
  primaryDark: '#2563EB',
  success: '#22C55E',
  successLight: '#143222',
  danger: '#F87171',
  dangerLight: '#3B1C1F',
  warning: '#FBBF24',
  warningLight: '#3A2C10',
  bg: '#0F1117',
  surface: '#1C1F2E',
  surface2: '#252939',
  fg: '#F1F3F8',
  fgMuted: '#A1A7B3',
  fgSub: '#6B7280',
  border: '#2A2E40',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

export const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: {
    elevation: 2,
  },
}) ?? {};
