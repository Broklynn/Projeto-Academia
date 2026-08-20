import { StyleSheet, View } from 'react-native';
import { spacing, useAppTheme } from '../theme';
import { AppText } from './app-text';

interface Props { eyebrow: string; title?: string }
export function SectionTitle({ eyebrow, title }: Props) {
  const { colors } = useAppTheme();
  return <View style={styles.container}>
    <View style={[styles.rule, { backgroundColor: colors.accent }]} />
    <View style={styles.copy}>
      <AppText tone="muted" variant="caption">{eyebrow.toLocaleUpperCase('pt-BR')}</AppText>
      {title ? <AppText variant="heading">{title}</AppText> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  copy: { flex: 1, gap: spacing.xxs },
  rule: { borderRadius: 2, height: 34, width: 4 },
});
