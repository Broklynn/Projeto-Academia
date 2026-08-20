import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { useAppTheme } from '@/ui/theme';

function RootNavigator() {
  const { colors, isDark } = useAppTheme();
  return <>
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerShown: false }} />
    <StatusBar style={isDark ? 'light' : 'dark'} />
  </>;
}

export default function RootLayout() {
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <RootNavigator />
  </SafeAreaProvider>;
}
