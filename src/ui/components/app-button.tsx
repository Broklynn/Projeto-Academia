import type { ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';
import { radius, spacing, touchTarget, useAppTheme } from '../theme';
import { AppText } from './app-text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
interface Props extends Omit<ComponentProps<typeof Pressable>, 'children' | 'style'> {
  fullWidth?: boolean; label: string; style?: StyleProp<ViewStyle>; variant?: ButtonVariant;
}
export function AppButton({ accessibilityLabel, disabled = false, fullWidth = true, label, style, variant = 'primary', ...props }: Props) {
  const { colors } = useAppTheme();
  const isDisabled = disabled === true;
  const background = { primary: colors.accent, secondary: colors.surface, ghost: colors.background }[variant];
  const pressedBackground = { primary: colors.accentPressed, secondary: colors.surfaceMuted, ghost: colors.surfaceMuted }[variant];
  return <Pressable accessibilityLabel={accessibilityLabel ?? label} accessibilityRole="button" accessibilityState={{ disabled: isDisabled }} disabled={isDisabled}
    style={({ pressed }) => [styles.button, fullWidth && styles.fullWidth, {
      backgroundColor: isDisabled ? colors.disabled : pressed ? pressedBackground : background,
      borderColor: isDisabled ? colors.disabled : variant === 'secondary' ? colors.border : background,
      opacity: isDisabled ? 0.72 : 1,
    }, style]} {...props}>
    <AppText tone={isDisabled ? 'muted' : variant === 'primary' ? 'onAccent' : 'default'} variant="button">{label}</AppText>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', minHeight: touchTarget, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  fullWidth: { width: '100%' },
});
