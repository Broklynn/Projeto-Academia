import type { TrainingDaysPerWeek } from '../athlete/types';
import { MUSCLE_GROUPS, type MuscleGroup } from '../exercise/types';

import type {
  SplitFocus,
  SplitType,
  TrainingSplit,
  TrainingSplitDay,
} from './types';

interface SplitDayTemplate {
  readonly name: string;
  readonly focus: SplitFocus;
}

interface SplitTemplate {
  readonly type: SplitType;
  readonly days: readonly SplitDayTemplate[];
}

const UPPER_TARGET_MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
] as const satisfies readonly MuscleGroup[];

const LOWER_TARGET_MUSCLES = [
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
] as const satisfies readonly MuscleGroup[];

const PUSH_TARGET_MUSCLES = [
  'chest',
  'shoulders',
  'triceps',
] as const satisfies readonly MuscleGroup[];

const PULL_TARGET_MUSCLES = [
  'back',
  'biceps',
] as const satisfies readonly MuscleGroup[];

const TARGET_MUSCLES_BY_FOCUS = {
  full_body: MUSCLE_GROUPS,
  upper: UPPER_TARGET_MUSCLES,
  lower: LOWER_TARGET_MUSCLES,
  push: PUSH_TARGET_MUSCLES,
  pull: PULL_TARGET_MUSCLES,
  legs: LOWER_TARGET_MUSCLES,
} as const satisfies Readonly<Record<SplitFocus, readonly MuscleGroup[]>>;

const HYPERTROPHY_SPLIT_TEMPLATES = {
  2: {
    type: 'full_body',
    days: [
      { name: 'Corpo Inteiro A', focus: 'full_body' },
      { name: 'Corpo Inteiro B', focus: 'full_body' },
    ],
  },
  3: {
    type: 'full_body',
    days: [
      { name: 'Corpo Inteiro A', focus: 'full_body' },
      { name: 'Corpo Inteiro B', focus: 'full_body' },
      { name: 'Corpo Inteiro C', focus: 'full_body' },
    ],
  },
  4: {
    type: 'upper_lower',
    days: [
      { name: 'Superior A', focus: 'upper' },
      { name: 'Inferior A', focus: 'lower' },
      { name: 'Superior B', focus: 'upper' },
      { name: 'Inferior B', focus: 'lower' },
    ],
  },
  5: {
    type: 'upper_lower_push_pull_legs',
    days: [
      { name: 'Superior', focus: 'upper' },
      { name: 'Inferior', focus: 'lower' },
      { name: 'Empurrar', focus: 'push' },
      { name: 'Puxar', focus: 'pull' },
      { name: 'Pernas', focus: 'legs' },
    ],
  },
  6: {
    type: 'push_pull_legs',
    days: [
      { name: 'Empurrar A', focus: 'push' },
      { name: 'Puxar A', focus: 'pull' },
      { name: 'Pernas A', focus: 'legs' },
      { name: 'Empurrar B', focus: 'push' },
      { name: 'Puxar B', focus: 'pull' },
      { name: 'Pernas B', focus: 'legs' },
    ],
  },
} as const satisfies Readonly<Record<TrainingDaysPerWeek, SplitTemplate>>;

export function buildHypertrophySplit(
  daysPerWeek: TrainingDaysPerWeek,
): TrainingSplit {
  const template = HYPERTROPHY_SPLIT_TEMPLATES[daysPerWeek];

  return {
    type: template.type,
    daysPerWeek,
    days: template.days.map((day, index): TrainingSplitDay => ({
      order: index + 1,
      name: day.name,
      focus: day.focus,
      targetMuscles: [...TARGET_MUSCLES_BY_FOCUS[day.focus]],
    })),
  };
}
