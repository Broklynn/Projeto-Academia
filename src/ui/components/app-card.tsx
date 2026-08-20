import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { radius, spacing, useAppTheme } from '../theme';

interface Props extends PropsWithChildren { style?: StyleProp<ViewStyle> }
export function AppCard({ children, style }: Props) {
  const { colors } = useAppTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}
const styles = StyleSheet.create({ card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg } });
