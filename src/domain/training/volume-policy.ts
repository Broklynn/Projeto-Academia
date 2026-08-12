import { MUSCLE_GROUPS, type MuscleGroup } from '../exercise/types';

// DuoFit's initial weekly hypertrophy baseline per muscle; later layers individualize it.
export const DEFAULT_HYPERTROPHY_WEEKLY_SET_TARGET = 10;

export interface MuscleWeeklyVolumeTarget {
  readonly muscle: MuscleGroup;
  readonly targetSetsPerWeek: number;
}

export interface HypertrophyWeeklyVolumePolicy {
  readonly goal: 'hypertrophy';
  readonly muscleTargets: readonly MuscleWeeklyVolumeTarget[];
}

export function buildDefaultHypertrophyWeeklyVolumePolicy(): HypertrophyWeeklyVolumePolicy {
  return {
    goal: 'hypertrophy',
    muscleTargets: MUSCLE_GROUPS.map((muscle): MuscleWeeklyVolumeTarget => ({
      muscle,
      targetSetsPerWeek: DEFAULT_HYPERTROPHY_WEEKLY_SET_TARGET,
    })),
  };
}
