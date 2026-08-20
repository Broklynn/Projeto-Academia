import type { AccessibilityRole, StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, touchTarget, useAppTheme } from '../theme';
import { AppText } from './app-text';

interface Props { accessibilityLabel?: string; accessibilityRole?: AccessibilityRole; description?: string; label: string; onPress: () => void; selected: boolean; style?: StyleProp<ViewStyle> }
export function ChoiceChip({ accessibilityLabel, accessibilityRole = 'radio', description, label, onPress, selected, style }: Props) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityLabel={accessibilityLabel ?? label} accessibilityRole={accessibilityRole} accessibilityState={{ selected }} onPress={onPress}
    style={({ pressed }) => [styles.container, { backgroundColor: selected || pressed ? colors.surfaceMuted : colors.surface, borderColor: selected ? colors.accent : colors.border }, style]}>
    <View style={styles.copy}>
      <AppText variant="button">{label}</AppText>
      {description ? <AppText tone="muted" variant="bodyMuted">{description}</AppText> : null}
    </View>
    <View style={[styles.marker, { backgroundColor: selected ? colors.accent : colors.surface, borderColor: selected ? colors.accent : colors.border }]}>
      {selected ? <AppText style={styles.check} tone="onAccent" variant="caption">✓</AppText> : null}
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  container: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: touchTarget, padding: spacing.md },
  copy: { flex: 1, gap: spacing.xxs },
  marker: { alignItems: 'center', borderRadius: radius.round, borderWidth: 1, height: 24, justifyContent: 'center', width: 24 },
  check: { letterSpacing: 0 },
});
