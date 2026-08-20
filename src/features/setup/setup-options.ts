import type { ExperienceLevel, TrainingDaysPerWeek, TrainingGoal } from '@/domain/athlete';
import type { Equipment } from '@/domain/exercise';

export interface SetupOption<T> { description?: string; label: string; value: T }

export const GOAL_OPTIONS = [
  { label: 'Hipertrofia', description: 'Foco no desenvolvimento de massa muscular.', value: 'hypertrophy' },
  { label: 'Força', description: 'Foco em evoluir sua capacidade nos movimentos.', value: 'strength' },
  { label: 'Condicionamento geral', description: 'Uma rotina equilibrada para se manter ativo.', value: 'general_fitness' },
] satisfies readonly SetupOption<TrainingGoal>[];

export const EXPERIENCE_OPTIONS = [
  { label: 'Iniciante', description: 'Estou começando ou retomando agora.', value: 'beginner' },
  { label: 'Intermediário', description: 'Já treino com consistência.', value: 'intermediate' },
  { label: 'Avançado', description: 'Tenho ampla experiência com treino.', value: 'advanced' },
] satisfies readonly SetupOption<ExperienceLevel>[];

export const DAYS_OPTIONS = ([2, 3, 4, 5, 6] as const).map((value) => ({
  label: `${value} dias por semana`, value,
})) satisfies readonly SetupOption<TrainingDaysPerWeek>[];

export const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120].map((value) => ({
  label: `${value} min`, value,
})) satisfies readonly SetupOption<number>[];

export const EQUIPMENT_OPTIONS = [
  { label: 'Peso corporal', value: 'bodyweight' },
  { label: 'Barra', value: 'barbell' },
  { label: 'Halteres', value: 'dumbbell' },
  { label: 'Máquinas', value: 'machine' },
  { label: 'Polia', value: 'cable' },
  { label: 'Banco', value: 'bench' },
  { label: 'Barra fixa', value: 'pullup_bar' },
  { label: 'Smith', value: 'smith_machine' },
] satisfies readonly SetupOption<Equipment>[];

export function labelFor<T>(options: readonly SetupOption<T>[], value: T | null) {
  return options.find((option) => option.value === value)?.label ?? 'Não informado';
}
