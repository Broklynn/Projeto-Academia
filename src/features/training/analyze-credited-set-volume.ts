import { MUSCLE_GROUPS, type MuscleGroup } from '../../domain/exercise';
import type {
  HypertrophySetCreditPolicy,
  HypertrophyWeeklyVolumePolicy,
} from '../../domain/training';
import type { ValidationResult } from '../../domain/validation';

import {
  analyzeWeeklyDirectSetVolume,
  type TrainingWeekSetAllocation,
} from './analyze-set-volume';
import type { TrainingWeekSelection } from './build-training-selection';

export interface MuscleCreditedSetStatus {
  readonly muscle: MuscleGroup;
  readonly targetSetsPerWeek: number;
  readonly allocatedDirectSets: number;
  readonly allocatedIndirectSets: number;
  readonly creditedIndirectSets: number;
  readonly totalCreditedSets: number;
  readonly remainingCreditedSetsToTarget: number;
  readonly creditedSetsAboveTarget: number;
}

export interface WeeklyCreditedSetVolumeAnalysis {
  readonly muscles: readonly MuscleCreditedSetStatus[];
  readonly musclesBelowCreditedTarget: readonly MuscleGroup[];
  readonly musclesAtCreditedTarget: readonly MuscleGroup[];
  readonly musclesAboveCreditedTarget: readonly MuscleGroup[];
}

function validateCreditPolicy(policy: HypertrophySetCreditPolicy): string[] {
  if (
    !Number.isFinite(policy.indirectSetCredit) ||
    policy.indirectSetCredit < 0 ||
    policy.indirectSetCredit > 1
  ) {
    return ['creditPolicy.indirectSetCredit must be a finite number between 0 and 1'];
  }

  return [];
}

export function analyzeWeeklyCreditedSetVolume(
  week: TrainingWeekSelection,
  allocation: TrainingWeekSetAllocation,
  volumePolicy: HypertrophyWeeklyVolumePolicy,
  creditPolicy: HypertrophySetCreditPolicy,
): ValidationResult<WeeklyCreditedSetVolumeAnalysis> {
  const directAnalysis = analyzeWeeklyDirectSetVolume(
    week,
    allocation,
    volumePolicy,
  );
  const errors = validateCreditPolicy(creditPolicy);

  if (!directAnalysis.valid) {
    errors.push(...directAnalysis.errors);
  }

  if (errors.length > 0 || !directAnalysis.valid) {
    return { valid: false, errors };
  }

  const allocatedIndirectSetsByMuscle = new Map(
    MUSCLE_GROUPS.map((muscle) => [muscle, 0]),
  );

  for (const dayAllocation of allocation.days) {
    const daySelection = week.days.find(
      (candidate) => candidate.day.order === dayAllocation.dayOrder,
    )!;

    for (const exerciseAllocation of dayAllocation.exercises) {
      const exercise = daySelection.exercises.find(
        (candidate) => candidate.id === exerciseAllocation.exerciseId,
      )!;

      for (const muscle of exercise.secondaryMuscles) {
        const currentSets = allocatedIndirectSetsByMuscle.get(muscle) ?? 0;
        allocatedIndirectSetsByMuscle.set(
          muscle,
          currentSets + exerciseAllocation.sets,
        );
      }
    }
  }

  const muscles = directAnalysis.value.muscles.map(
    (directStatus): MuscleCreditedSetStatus => {
      const allocatedIndirectSets =
        allocatedIndirectSetsByMuscle.get(directStatus.muscle) ?? 0;
      const creditedIndirectSets =
        allocatedIndirectSets * creditPolicy.indirectSetCredit;
      const totalCreditedSets =
        directStatus.allocatedDirectSets + creditedIndirectSets;

      return {
        muscle: directStatus.muscle,
        targetSetsPerWeek: directStatus.targetSetsPerWeek,
        allocatedDirectSets: directStatus.allocatedDirectSets,
        allocatedIndirectSets,
        creditedIndirectSets,
        totalCreditedSets,
        remainingCreditedSetsToTarget: Math.max(
          directStatus.targetSetsPerWeek - totalCreditedSets,
          0,
        ),
        creditedSetsAboveTarget: Math.max(
          totalCreditedSets - directStatus.targetSetsPerWeek,
          0,
        ),
      };
    },
  );

  return {
    valid: true,
    value: {
      muscles,
      musclesBelowCreditedTarget: muscles
        .filter((status) => status.remainingCreditedSetsToTarget > 0)
        .map((status) => status.muscle),
      musclesAtCreditedTarget: muscles
        .filter(
          (status) => status.totalCreditedSets === status.targetSetsPerWeek,
        )
        .map((status) => status.muscle),
      musclesAboveCreditedTarget: muscles
        .filter((status) => status.creditedSetsAboveTarget > 0)
        .map((status) => status.muscle),
    },
  };
}
