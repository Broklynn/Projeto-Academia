import type { ComponentProps } from 'react';
import { Text } from 'react-native';
import { typography, useAppTheme } from '../theme';

type TextTone = 'default' | 'muted' | 'accent' | 'onAccent' | 'danger';
interface AppTextProps extends ComponentProps<typeof Text> { tone?: TextTone; variant?: keyof typeof typography }

export function AppText({ style, tone = 'default', variant = 'body', ...props }: AppTextProps) {
  const { colors } = useAppTheme();
  const color = { default: colors.text, muted: colors.textMuted, accent: colors.accent,
    onAccent: colors.onAccent, danger: colors.danger }[tone];
  return <Text style={[typography[variant], { color }, style]} {...props} />;
}
