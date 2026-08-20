import { useCallback, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import type { Equipment } from '@/domain/exercise';
import { serializeEquipment } from '@/features/plan';
import { AppButton, AppCard, AppScreen, AppText, ChoiceChip } from '@/ui/components';
import { radius, spacing, useAppTheme } from '@/ui/theme';
import {
  DAYS_OPTIONS,
  DURATION_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  labelFor,
} from './setup-options';
import { completeSetupDraft } from './complete-setup';
import { INITIAL_SETUP_DRAFT, type SetupDraft, type SetupStep, type SetupView } from './setup-types';

const STEP_COPY = {
  1: { title: 'Qual é seu objetivo?', description: 'Escolha o foco principal desta rotina.' },
  2: { title: 'Qual é sua experiência?', description: 'Informe seu nível atual de experiência com treino.' },
  3: { title: 'Quantos dias você quer treinar?', description: 'Considere uma frequência que caiba de verdade na sua semana.' },
  4: { title: 'Quanto tempo você tem por treino?', description: 'Use o tempo que costuma estar disponível em cada sessão.' },
  5: { title: 'Quais equipamentos você tem?', description: 'Marque quantos quiser. Você também pode seguir sem selecionar nenhum.' },
} as const;

export function SetupWizard() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState<SetupDraft>(INITIAL_SETUP_DRAFT);
  const [view, setView] = useState<SetupView>(1);

  const goBack = useCallback(() => {
    if (view === 'summary') { setView(5); return; }
    if (view > 1) { setView((view - 1) as SetupStep); return; }
    router.back();
  }, [router, view]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view === 1) return false;
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack, view]));

  function toggleEquipment(equipment: Equipment) {
    setDraft((current) => ({
      ...current,
      availableEquipment: current.availableEquipment.includes(equipment)
        ? current.availableEquipment.filter((item) => item !== equipment)
        : [...current.availableEquipment, equipment],
    }));
  }

  function canContinue(step: SetupStep) {
    if (step === 1) return draft.goal !== null;
    if (step === 2) return draft.experience !== null;
    if (step === 3) return draft.daysPerWeek !== null;
    if (step === 4) return draft.sessionDurationMinutes !== null;
    return true;
  }

  function continueFlow(step: SetupStep) {
    if (!canContinue(step)) return;
    setView(step === 5 ? 'summary' : ((step + 1) as SetupStep));
  }

  if (view === 'summary') {
    const equipmentLabels = draft.availableEquipment.map((equipment) => labelFor(EQUIPMENT_OPTIONS, equipment));
    const completedSetup = completeSetupDraft(draft);
    const canGenerate = completedSetup.valid && completedSetup.value.goal === 'hypertrophy' && completedSetup.value.availableEquipment.length > 0;
    const unsupportedGoal = completedSetup.valid && completedSetup.value.goal !== 'hypertrophy';
    const missingEquipment = completedSetup.valid && completedSetup.value.goal === 'hypertrophy' && completedSetup.value.availableEquipment.length === 0;

    function generatePlan() {
      if (!completedSetup.valid || !canGenerate) return;
      const setup = completedSetup.value;
      router.push({
        pathname: '/plan',
        params: {
          days: String(setup.daysPerWeek),
          duration: String(setup.sessionDurationMinutes),
          equipment: serializeEquipment(setup.availableEquipment),
          experience: setup.experience,
          goal: setup.goal,
        },
      });
    }

    return <AppScreen key="summary" scrollable contentContainerStyle={styles.page}>
      <View style={styles.frame}>
        <View style={styles.summaryIntro}>
          <View style={[styles.brandMark, { backgroundColor: colors.accent }]} />
          <AppText tone="muted" variant="caption">CONFIGURAÇÃO CONCLUÍDA</AppText>
          <AppText variant="title">Confira suas escolhas</AppText>
          <AppText tone="muted" variant="bodyMuted">Nada foi salvo ainda. Revise as preferências desta sessão antes de voltar.</AppText>
        </View>
        <AppCard style={styles.summaryCard}>
          <SummaryRow label="Objetivo" value={labelFor(GOAL_OPTIONS, draft.goal)} />
          <SummaryDivider />
          <SummaryRow label="Experiência" value={labelFor(EXPERIENCE_OPTIONS, draft.experience)} />
          <SummaryDivider />
          <SummaryRow label="Dias por semana" value={labelFor(DAYS_OPTIONS, draft.daysPerWeek)} />
          <SummaryDivider />
          <SummaryRow label="Duração" value={labelFor(DURATION_OPTIONS, draft.sessionDurationMinutes)} />
          <SummaryDivider />
          <SummaryRow label="Equipamentos" value={equipmentLabels.length > 0 ? equipmentLabels.join(', ') : 'Nenhum equipamento selecionado'} />
        </AppCard>
        {unsupportedGoal ? <AppCard style={[styles.callout, { backgroundColor: colors.surfaceMuted }]}>
          <AppText variant="heading">{labelFor(GOAL_OPTIONS, draft.goal)} está chegando</AppText>
          <AppText tone="muted" variant="bodyMuted">Por enquanto, o DuoFit gera planos somente para Hipertrofia. Suas escolhas continuam aqui para você editar.</AppText>
          <AppButton label="Editar objetivo" onPress={() => setView(1)} variant="secondary" />
        </AppCard> : null}
        {missingEquipment ? <AppCard style={[styles.callout, { backgroundColor: colors.surfaceMuted }]}>
          <AppText variant="heading">Selecione ao menos um equipamento</AppText>
          <AppText tone="muted" variant="bodyMuted">Precisamos dessa informação para montar exercícios compatíveis com sua rotina.</AppText>
          <AppButton label="Editar equipamentos" onPress={() => setView(5)} variant="secondary" />
        </AppCard> : null}
        <View style={styles.actions}>
          {canGenerate ? <AppButton label="Gerar meu treino" onPress={generatePlan} /> : null}
          <AppButton label="Editar escolhas" onPress={() => setView(1)} variant="secondary" />
          <AppButton label="Voltar ao início" onPress={() => router.replace('/')} variant="ghost" />
        </View>
      </View>
    </AppScreen>;
  }

  const copy = STEP_COPY[view];
  return <AppScreen key={view} scrollable contentContainerStyle={styles.page}>
    <View style={styles.frame}>
      <View style={styles.header}>
        <AppButton accessibilityLabel="Voltar" fullWidth={false} label="←  Voltar" onPress={goBack} style={styles.backButton} variant="ghost" />
        <AppText tone="muted" variant="caption">PASSO {view} DE 5</AppText>
      </View>
      <View accessibilityLabel={`Passo ${view} de 5`} style={styles.progress}>
        {[1, 2, 3, 4, 5].map((step) => <View key={step} style={[styles.progressSegment, { backgroundColor: step <= view ? colors.accent : colors.border }]} />)}
      </View>
      <View style={styles.intro}>
        <AppText variant="title">{copy.title}</AppText>
        <AppText tone="muted" variant="bodyMuted">{copy.description}</AppText>
      </View>
      <View style={styles.options}>
        {view === 1 ? GOAL_OPTIONS.map((option) => <ChoiceChip key={option.value} {...option} onPress={() => setDraft((current) => ({ ...current, goal: option.value }))} selected={draft.goal === option.value} />) : null}
        {view === 2 ? EXPERIENCE_OPTIONS.map((option) => <ChoiceChip key={option.value} {...option} onPress={() => setDraft((current) => ({ ...current, experience: option.value }))} selected={draft.experience === option.value} />) : null}
        {view === 3 ? DAYS_OPTIONS.map((option) => <ChoiceChip key={option.value} label={option.label} onPress={() => setDraft((current) => ({ ...current, daysPerWeek: option.value }))} selected={draft.daysPerWeek === option.value} />) : null}
        {view === 4 ? DURATION_OPTIONS.map((option) => <ChoiceChip key={option.value} label={option.label} onPress={() => setDraft((current) => ({ ...current, sessionDurationMinutes: option.value }))} selected={draft.sessionDurationMinutes === option.value} />) : null}
        {view === 5 ? EQUIPMENT_OPTIONS.map((option) => <ChoiceChip accessibilityRole="checkbox" key={option.value} label={option.label} onPress={() => toggleEquipment(option.value)} selected={draft.availableEquipment.includes(option.value)} />) : null}
      </View>
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {view === 5 ? <AppText tone="muted" variant="bodyMuted">Selecionar equipamentos é opcional nesta etapa.</AppText> : null}
        <AppButton disabled={!canContinue(view)} label="Continuar" onPress={() => continueFlow(view)} />
      </View>
    </View>
  </AppScreen>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.summaryRow}>
    <AppText tone="muted" variant="caption">{label.toLocaleUpperCase('pt-BR')}</AppText>
    <AppText variant="heading">{value}</AppText>
  </View>;
}
function SummaryDivider() {
  const { colors } = useAppTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  page: { paddingBottom: spacing.xxl, paddingTop: spacing.xs },
  frame: { alignSelf: 'center', flex: 1, maxWidth: 620, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 56 },
  backButton: { marginLeft: -spacing.sm, paddingHorizontal: spacing.sm },
  progress: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  progressSegment: { borderRadius: radius.round, flex: 1, height: 5 },
  intro: { gap: spacing.sm, marginTop: spacing.xxl },
  options: { gap: spacing.sm, marginTop: spacing.xl },
  footer: { borderTopWidth: 1, gap: spacing.md, marginTop: spacing.xxl, paddingTop: spacing.xl },
  brandMark: { borderRadius: radius.round, height: 8, width: 48 },
  summaryIntro: { gap: spacing.sm, marginTop: spacing.xl },
  summaryCard: { gap: spacing.md, marginTop: spacing.xl },
  summaryRow: { gap: spacing.xs },
  divider: { height: 1, width: '100%' },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
  callout: { gap: spacing.md, marginTop: spacing.md },
});
