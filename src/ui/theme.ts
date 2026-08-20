import { useColorScheme } from 'react-native';

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 18, xl: 24, round: 999 } as const;
export const touchTarget = 48;

export const typography = {
  display: { fontSize: 48, fontWeight: '800' as const, letterSpacing: -1.8, lineHeight: 50 },
  title: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.8, lineHeight: 38 },
  heading: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMuted: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  caption: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 0.8, lineHeight: 18 },
  button: { fontSize: 16, fontWeight: '700' as const, lineHeight: 20 },
} as const;

const lightColors = {
  background: '#F4F7F5', surface: '#FFFFFF', surfaceMuted: '#EAF0EC', text: '#121814',
  textMuted: '#657068', border: '#DCE5DF', accent: '#32D875', accentPressed: '#28B963',
  onAccent: '#07150D', danger: '#D94747', disabled: '#C6CEC9',
} as const;

const darkColors = {
  background: '#0C100D', surface: '#141A16', surfaceMuted: '#1A231D', text: '#F2F6F3',
  textMuted: '#9DA9A1', border: '#28342C', accent: '#45E784', accentPressed: '#38C970',
  onAccent: '#07150D', danger: '#FF6868', disabled: '#3A443D',
} as const;

export function useAppTheme() {
  const isDark = useColorScheme() === 'dark';
  return { colors: isDark ? darkColors : lightColors, isDark, radius, spacing, touchTarget, typography };
}

export type AppTheme = ReturnType<typeof useAppTheme>;
