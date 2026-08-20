import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, useAppTheme } from '../theme';

interface Props extends PropsWithChildren { contentContainerStyle?: StyleProp<ViewStyle>; scrollable?: boolean }
export function AppScreen({ children, contentContainerStyle, scrollable = false }: Props) {
  const { colors } = useAppTheme();
  const contentStyle = [styles.content, contentContainerStyle];
  return <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={[styles.screen, { backgroundColor: colors.background }]}>
    {scrollable ? <ScrollView contentContainerStyle={contentStyle} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}>{children}</ScrollView>
      : <View style={contentStyle}>{children}</View>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
