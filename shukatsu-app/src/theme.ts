import { Platform, TextStyle } from 'react-native';
import type { Tone } from './presentation';

/**
 * デザイントークン。
 * 背景は白（ダークでは黒に近いグレー）、情報のまとまりは影ではなく薄い塗り（surface）で表す。
 * primary（青）は主要アクション・選択状態・「今」を示す場所だけに使う。
 */
export const lightColors = {
  primary: '#2F5BEA',
  primaryLight: '#EAF0FE',
  primaryDark: '#2049CC',
  success: '#1E9E5A',
  successLight: '#E5F5EC',
  danger: '#E5484D',
  dangerLight: '#FDECEC',
  warning: '#D9822B',
  warningLight: '#FDF1E3',
  /** 画面の背景 */
  bg: '#FFFFFF',
  /** グループ・入力欄などの塗り */
  surface: '#F4F4F6',
  /** surface の上に重ねる要素（トラック・押下状態など） */
  surface2: '#E8E8EC',
  fg: '#16171B',
  fgMuted: '#6E6E76',
  fgSub: '#A1A1A8',
  /** 区切り線 */
  border: '#E6E6EA',
  /** 塗りの上に置くボタン・選択中のセグメント（ダークでは一段明るく） */
  elevated: '#FFFFFF',
  /** 主要ボタン上の文字 */
  onPrimary: '#FFFFFF',
};

export type Colors = typeof lightColors;

export const darkColors: Colors = {
  primary: '#6B8CFF',
  primaryLight: '#1C2440',
  primaryDark: '#4F74F5',
  success: '#3CCB7F',
  successLight: '#132A1E',
  danger: '#FF6B6E',
  dangerLight: '#341819',
  warning: '#F2A24B',
  warningLight: '#33240F',
  bg: '#0C0C0E',
  surface: '#1C1C1F',
  surface2: '#2A2A2F',
  fg: '#F4F4F6',
  fgMuted: '#A3A3AB',
  fgSub: '#6C6C74',
  border: '#2A2A2F',
  elevated: '#3A3A41',
  onPrimary: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  /** 画面左右の余白 */
  screen: 20,
  /** セクション同士の間隔 */
  section: 32,
  /** 浮いているタブバーに内容が隠れないための下余白 */
  tabBar: 128,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  full: 999,
};

/** iPad などの広い画面で、読みやすい幅に収める */
export const READABLE_WIDTH = 720;
export const readable = { width: '100%', maxWidth: READABLE_WIDTH, alignSelf: 'center' } as const;

/** 文字の階層（システムフォント） */
export const type = {
  largeTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, lineHeight: 40 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, lineHeight: 28 },
  headline: { fontSize: 17, fontWeight: '700', lineHeight: 23 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  subhead: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  /** 数字は桁がそろう等幅数字にする */
  number: { fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
} satisfies Record<string, TextStyle>;

/** 浮かせたい要素（セグメントの選択中など）だけに使う、ごく弱い影 */
export const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  android: {
    elevation: 1,
  },
}) ?? {};

/** 企業ステータス・選考ステータスなどの意味ごとの色 */
export function toneColors(colors: Colors, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'primary': return { fg: colors.primary, bg: colors.primaryLight };
    case 'success': return { fg: colors.success, bg: colors.successLight };
    case 'danger': return { fg: colors.danger, bg: colors.dangerLight };
    case 'warning': return { fg: colors.warning, bg: colors.warningLight };
    default: return { fg: colors.fgMuted, bg: colors.surface };
  }
}
