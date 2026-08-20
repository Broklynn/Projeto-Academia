import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppScreen, AppText, SectionTitle } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';

const FEATURES = [
  { number: '01', title: 'Dias', description: 'Treine na frequência que realmente cabe na sua semana.' },
  { number: '02', title: 'Volume', description: 'Organize as séries de cada grupo muscular com clareza.' },
  { number: '03', title: 'Tempo', description: 'Planeje sessões que respeitam o tempo que você informou.' },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();

  return <AppScreen scrollable contentContainerStyle={styles.page}>
    <View style={styles.frame}>
      <View style={styles.brand}>
        <View style={[styles.brandMark, { backgroundColor: colors.accent }]}>
          <View style={[styles.brandCut, { backgroundColor: colors.onAccent }]} />
        </View>
        <View>
          <AppText style={styles.brandName} variant="heading">DUOFIT</AppText>
          <AppText tone="muted" variant="caption">TREINOS INTELIGENTES</AppText>
        </View>
      </View>

      <AppCard style={styles.hero}>
        <View style={styles.decoration}>
          <View style={[styles.decorativeCircle, { borderColor: colors.accent }]} />
          <View style={[styles.decorativeLine, { backgroundColor: colors.accent }]} />
        </View>
        <View style={styles.heroCopy}>
          <AppText tone="accent" variant="caption">SIMPLES. DIRETO. SEU.</AppText>
          <AppText style={styles.heroTitle} variant="display">Seu treino.{`\n`}Sua rotina.</AppText>
          <AppText tone="muted" variant="bodyMuted">Monte um plano baseado nos seus dias, no tempo disponível e nos equipamentos que você tem.</AppText>
        </View>
        <AppButton accessibilityLabel="Montar meu treino" label="Montar meu treino  →" onPress={() => router.push('/setup')} />
      </AppCard>

      <View style={styles.section}>
        <SectionTitle eyebrow="Feito para sua rotina" title="Preferências reais, semana organizada." />
        <View style={styles.featureList}>
          {FEATURES.map((feature) => <AppCard key={feature.title} style={styles.featureCard}>
            <View style={[styles.featureNumber, { backgroundColor: colors.surfaceMuted }]}>
              <AppText tone="accent" variant="caption">{feature.number}</AppText>
            </View>
            <View style={styles.featureCopy}>
              <AppText variant="heading">{feature.title}</AppText>
              <AppText tone="muted" variant="bodyMuted">{feature.description}</AppText>
            </View>
          </AppCard>)}
        </View>
      </View>

      <AppCard style={[styles.closing, { backgroundColor: colors.surfaceMuted }]}>
        <AppText tone="muted" variant="caption">UM PASSO DE CADA VEZ</AppText>
        <AppText variant="heading">Você escolhe. O DuoFit organiza.</AppText>
        <AppText tone="muted" variant="bodyMuted">Conte como é sua rotina e confira todas as escolhas antes de avançar.</AppText>
      </AppCard>
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  page: { paddingBottom: spacing.xxl, paddingTop: spacing.md },
  frame: { alignSelf: 'center', maxWidth: 680, width: '100%' },
  brand: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  brandMark: { alignItems: 'center', borderRadius: radius.sm, height: 42, justifyContent: 'center', transform: [{ rotate: '-7deg' }], width: 42 },
  brandCut: { borderRadius: radius.round, height: 6, width: 22 },
  brandName: { fontSize: 18, letterSpacing: 1.5, lineHeight: 21 },
  hero: { gap: spacing.xl, overflow: 'hidden', padding: spacing.xl },
  heroCopy: { gap: spacing.md, maxWidth: 480 },
  heroTitle: { maxWidth: 340 },
  decoration: { height: 116, pointerEvents: 'none', position: 'absolute', right: -30, top: -22, width: 116 },
  decorativeCircle: { borderRadius: radius.round, borderWidth: 18, height: 116, opacity: 0.17, width: 116 },
  decorativeLine: { borderRadius: radius.round, bottom: 8, height: 8, position: 'absolute', right: 10, transform: [{ rotate: '-35deg' }], width: 72 },
  section: { gap: spacing.xl, marginTop: spacing.xxl },
  featureList: { gap: spacing.sm },
  featureCard: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  featureNumber: { alignItems: 'center', borderRadius: radius.sm, justifyContent: 'center', minHeight: 44, minWidth: 44 },
  featureCopy: { flex: 1, gap: spacing.xxs },
  closing: { gap: spacing.sm, marginTop: spacing.xxl },
});
