import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppScreen, AppText } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';
import { EXPERIENCE_OPTIONS, labelFor } from '../setup/setup-options';
import { generateHypertrophyPlan } from './generate-plan';
import { parsePlanRouteParams, type PlanRouteParams } from './plan-route';
import type { GeneratedTrainingPlan } from './plan-types';

function plural(value: number, singular: string, pluralValue: string) {
  return `${value} ${value === 1 ? singular : pluralValue}`;
}

export function PlanScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams() as PlanRouteParams;
  const parsed = parsePlanRouteParams(routeParams);

  if (!parsed.valid) {
    return <PlanMessage
      description="Revise as informações da configuração e tente gerar o treino novamente."
      onHome={() => router.replace('/')}
      onConfigure={() => router.replace('/setup')}
      title="Não foi possível abrir este plano"
    />;
  }

  if (parsed.value.goal !== 'hypertrophy') {
    return <PlanMessage
      description="Por enquanto, o DuoFit gera planos somente para Hipertrofia. Nenhum objetivo foi convertido automaticamente."
      onHome={() => router.replace('/')}
      onConfigure={() => router.replace('/setup')}
      title="Este objetivo ainda não tem geração"
    />;
  }

  const result = generateHypertrophyPlan(parsed.value);
  if (!result.valid) {
    return <PlanMessage
      description="A configuração é válida, mas o motor não conseguiu montar o plano. Volte e ajuste suas escolhas."
      onHome={() => router.replace('/')}
      onConfigure={() => router.back()}
      title="Não foi possível gerar seu treino"
    />;
  }

  return <GeneratedPlanView
    onBack={() => router.replace('/')}
    onEdit={() => router.back()}
    plan={result.value}
  />;
}

function PlanMessage({
  description,
  onHome,
  onConfigure,
  title,
}: {
  description: string;
  onHome: () => void;
  onConfigure: () => void;
  title: string;
}) {
  return <AppScreen scrollable contentContainerStyle={styles.page}>
    <View style={styles.frame}>
      <BrandHeader />
      <AppCard style={styles.messageCard}>
        <AppText tone="accent" variant="caption">PLANO INDISPONÍVEL</AppText>
        <AppText variant="title">{title}</AppText>
        <AppText tone="muted" variant="bodyMuted">{description}</AppText>
        <AppButton label="Voltar para configuração" onPress={onConfigure} />
        <AppButton label="Voltar ao início" onPress={onHome} variant="ghost" />
      </AppCard>
    </View>
  </AppScreen>;
}

function GeneratedPlanView({
  onBack,
  onEdit,
  plan,
}: {
  onBack: () => void;
  onEdit: () => void;
  plan: GeneratedTrainingPlan;
}) {
  const { colors } = useAppTheme();
  const totalExercises = plan.days.reduce(
    (total, day) => total + day.exerciseCount,
    0,
  );

  return <AppScreen scrollable contentContainerStyle={styles.page}>
    <View style={styles.frame}>
      <BrandHeader />
      <View style={styles.intro}>
        <AppText tone="accent" variant="caption">SEU PLANO SEMANAL</AppText>
        <AppText variant="title">Treino pronto para sua rotina</AppText>
        <AppText tone="muted" variant="bodyMuted">A experiência {labelFor(EXPERIENCE_OPTIONS, plan.experience).toLocaleLowerCase('pt-BR')} está registrada como contexto. Nesta versão, ela ainda não altera a alocação.</AppText>
      </View>
      <View style={styles.chips}>
        <MetaChip label={`${plan.daysPerWeek} dias`} />
        <MetaChip label={`até ${plan.requestedSessionDurationMinutes} min por sessão`} />
        <MetaChip label="Hipertrofia" />
      </View>

      {plan.totalSets === 0 ? <AppCard style={styles.messageCard}>
        <AppText variant="heading">Nenhuma série foi alocada</AppText>
        <AppText tone="muted" variant="bodyMuted">Edite os equipamentos para encontrar exercícios compatíveis.</AppText>
        <AppButton label="Editar equipamentos" onPress={onEdit} />
      </AppCard> : <>
        <AppCard style={[styles.overview, { backgroundColor: colors.surfaceMuted }]}>
          <AppText tone="muted" variant="caption">VISÃO GERAL</AppText>
          <AppText variant="heading">{plural(plan.totalSets, 'série', 'séries')} · {plural(totalExercises, 'exercício', 'exercícios')}</AppText>
        </AppCard>
        <View style={styles.dayList}>
          {plan.days.map((day) => <AppCard key={day.order} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <View style={styles.dayTitle}>
                <AppText tone="accent" variant="caption">DIA {day.order}</AppText>
                <AppText variant="heading">{day.name}</AppText>
              </View>
              <AppText tone="muted" variant="bodyMuted">{plural(day.totalSets, 'série', 'séries')}</AppText>
            </View>
            <View style={styles.exerciseList}>
              {day.exercises.map((exercise, index) => <View
                key={exercise.exerciseId}
                style={[
                  styles.exerciseRow,
                  index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 },
                ]}
              >
                <View style={styles.exerciseCopy}>
                  <AppText>{exercise.name}</AppText>
                  {exercise.isAccessory ? <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
                    <AppText tone="accent" variant="caption">COMPLEMENTAR</AppText>
                  </View> : null}
                </View>
                <AppText variant="heading">{plural(exercise.sets, 'série', 'séries')}</AppText>
              </View>)}
            </View>
          </AppCard>)}
        </View>
      </>}
      <View style={styles.actions}>
        <AppButton label="Editar configuração" onPress={onEdit} variant="secondary" />
        <AppButton label="Voltar ao início" onPress={onBack} variant="ghost" />
      </View>
    </View>
  </AppScreen>;
}

function BrandHeader() {
  const { colors } = useAppTheme();
  return <View style={styles.brand}>
    <View style={[styles.brandMark, { backgroundColor: colors.accent }]} />
    <View>
      <AppText style={styles.brandName} variant="heading">DUOFIT</AppText>
      <AppText tone="muted" variant="caption">TREINOS INTELIGENTES</AppText>
    </View>
  </View>;
}

function MetaChip({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return <View style={[styles.metaChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
    <AppText variant="bodyMuted">{label}</AppText>
  </View>;
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.xl },
  badge: { alignSelf: 'flex-start', borderRadius: radius.round, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  brand: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  brandMark: { borderRadius: radius.round, height: 8, width: 48 },
  brandName: { fontSize: 18, letterSpacing: 1.5, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.lg },
  dayCard: { gap: spacing.md },
  dayHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  dayList: { gap: spacing.md, marginTop: spacing.lg },
  dayTitle: { flex: 1, gap: spacing.xxs },
  exerciseCopy: { flex: 1, gap: spacing.xs },
  exerciseList: { gap: 0 },
  exerciseRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', paddingVertical: spacing.md },
  frame: { alignSelf: 'center', maxWidth: 680, width: '100%' },
  intro: { gap: spacing.sm },
  messageCard: { gap: spacing.lg, marginTop: spacing.xl },
  metaChip: { borderRadius: radius.round, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  overview: { gap: spacing.xs, marginTop: spacing.lg },
  page: { paddingBottom: spacing.xxl, paddingTop: spacing.md },
});
