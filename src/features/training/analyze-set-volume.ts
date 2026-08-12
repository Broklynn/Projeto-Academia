import {
  MUSCLE_GROUPS,
  type ExerciseId,
  type MuscleGroup,
} from '../../domain/exercise';
import type { HypertrophyWeeklyVolumePolicy } from '../../domain/training';
import {
  type ValidationResult,
  validationResultFromErrors,
} from '../../domain/validation';

import type { TrainingWeekSelection } from './build-training-selection';

export interface ExerciseSetAllocation {
  readonly exerciseId: ExerciseId;
  readonly sets: number;
}

export interface TrainingDaySetAllocation {
  readonly dayOrder: number;
  readonly exercises: readonly ExerciseSetAllocation[];
}

export interface TrainingWeekSetAllocation {
  readonly days: readonly TrainingDaySetAllocation[];
}

export interface MuscleWeeklySetStatus {
  readonly muscle: MuscleGroup;
  readonly targetSetsPerWeek: number;
  readonly allocatedDirectSets: number;
  readonly remainingSetsToTarget: number;
  readonly excessSetsAboveTarget: number;
}

export interface WeeklyDirectSetVolumeAnalysis {
  readonly muscles: readonly MuscleWeeklySetStatus[];
  readonly musclesBelowTarget: readonly MuscleGroup[];
  readonly musclesAtTarget: readonly MuscleGroup[];
  readonly musclesAboveTarget: readonly MuscleGroup[];
}

function validatePolicy(policy: HypertrophyWeeklyVolumePolicy): string[] {
  const errors: string[] = [];
  const seenMuscles = new Set<MuscleGroup>();

  if (policy.goal !== 'hypertrophy') {
    errors.push('policy.goal must be hypertrophy');
  }

  policy.muscleTargets.forEach((target, targetIndex) => {
    if (!MUSCLE_GROUPS.includes(target.muscle)) {
      errors.push(`policy.muscleTargets[${targetIndex}].muscle is not supported`);
      return;
    }

    if (seenMuscles.has(target.muscle)) {
      errors.push(`policy contains duplicate target for ${target.muscle}`);
    } else {
      seenMuscles.add(target.muscle);
    }

    if (
      !Number.isFinite(target.targetSetsPerWeek) ||
      !Number.isInteger(target.targetSetsPerWeek) ||
      target.targetSetsPerWeek < 1
    ) {
      errors.push(
        `policy targetSetsPerWeek for ${target.muscle} must be a positive integer`,
      );
    }
  });

  for (const muscle of MUSCLE_GROUPS) {
    if (!seenMuscles.has(muscle)) {
      errors.push(`policy is missing target for ${muscle}`);
    }
  }

  return errors;
}

export function validateTrainingWeekSetAllocation(
  week: TrainingWeekSelection,
  allocation: TrainingWeekSetAllocation,
): ValidationResult {
  const errors: string[] = [];
  const seenDayOrders = new Set<number>();

  allocation.days.forEach((dayAllocation, dayIndex) => {
    const dayPath = `allocation.days[${dayIndex}]`;
    const daySelection = week.days.find(
      (candidate) => candidate.day.order === dayAllocation.dayOrder,
    );

    if (seenDayOrders.has(dayAllocation.dayOrder)) {
      errors.push(`${dayPath}.dayOrder duplicates ${dayAllocation.dayOrder}`);
    } else {
      seenDayOrders.add(dayAllocation.dayOrder);
    }

    if (!daySelection) {
      errors.push(`${dayPath}.dayOrder ${dayAllocation.dayOrder} does not exist in week`);
    }

    const seenExerciseIds = new Set<ExerciseId>();
    dayAllocation.exercises.forEach((exerciseAllocation, exerciseIndex) => {
      const exercisePath = `${dayPath}.exercises[${exerciseIndex}]`;

      if (seenExerciseIds.has(exerciseAllocation.exerciseId)) {
        errors.push(
          `${exercisePath}.exerciseId duplicates ${exerciseAllocation.exerciseId} in day`,
        );
      } else {
        seenExerciseIds.add(exerciseAllocation.exerciseId);
      }

      if (
        !Number.isFinite(exerciseAllocation.sets) ||
        !Number.isInteger(exerciseAllocation.sets) ||
        exerciseAllocation.sets < 1
      ) {
        errors.push(`${exercisePath}.sets must be a positive integer`);
      }

      if (
        daySelection &&
        !daySelection.exercises.some(
          (exercise) => exercise.id === exerciseAllocation.exerciseId,
        )
      ) {
        errors.push(
          `${exercisePath}.exerciseId ${exerciseAllocation.exerciseId} does not exist in day ${dayAllocation.dayOrder}`,
        );
      }
    });
  });

  return validationResultFromErrors(errors);
}

export function analyzeWeeklyDirectSetVolume(
  week: TrainingWeekSelection,
  allocation: TrainingWeekSetAllocation,
  policy: HypertrophyWeeklyVolumePolicy,
): ValidationResult<WeeklyDirectSetVolumeAnalysis> {
  const allocationValidation = validateTrainingWeekSetAllocation(
    week,
    allocation,
  );
  const errors = [...validatePolicy(policy)];

  if (!allocationValidation.valid) {
    errors.push(...allocationValidation.errors);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const targetSetsByMuscle = new Map(
    policy.muscleTargets.map((target) => [
      target.muscle,
      target.targetSetsPerWeek,
    ]),
  );
  const allocatedDirectSetsByMuscle = new Map(
    MUSCLE_GROUPS.map((muscle) => [muscle, 0]),
  );

  for (const dayAllocation of allocation.days) {
    const daySelection = week.days.find(
      (candidate) => candidate.day.order === dayAllocation.dayOrder,
    );

    if (!daySelection) {
      continue;
    }

    for (const exerciseAllocation of dayAllocation.exercises) {
      const exercise = daySelection.exercises.find(
        (candidate) => candidate.id === exerciseAllocation.exerciseId,
      );

      if (!exercise) {
        continue;
      }

      // Each primary muscle receives all allocated sets as taxonomic accounting,
      // not as a claim of identical physiological stimulus.
      for (const muscle of exercise.primaryMuscles) {
        const currentSets = allocatedDirectSetsByMuscle.get(muscle) ?? 0;
        allocatedDirectSetsByMuscle.set(
          muscle,
          currentSets + exerciseAllocation.sets,
        );
      }
    }
  }

  const muscles = MUSCLE_GROUPS.map((muscle): MuscleWeeklySetStatus => {
    const targetSetsPerWeek = targetSetsByMuscle.get(muscle)!;
    const allocatedDirectSets = allocatedDirectSetsByMuscle.get(muscle) ?? 0;

    return {
      muscle,
      targetSetsPerWeek,
      allocatedDirectSets,
      remainingSetsToTarget: Math.max(
        targetSetsPerWeek - allocatedDirectSets,
        0,
      ),
      excessSetsAboveTarget: Math.max(
        allocatedDirectSets - targetSetsPerWeek,
        0,
      ),
    };
  });

  return {
    valid: true,
    value: {
      muscles,
      musclesBelowTarget: muscles
        .filter((status) => status.remainingSetsToTarget > 0)
        .map((status) => status.muscle),
      musclesAtTarget: muscles
        .filter((status) => status.allocatedDirectSets === status.targetSetsPerWeek)
        .map((status) => status.muscle),
      musclesAboveTarget: muscles
        .filter((status) => status.excessSetsAboveTarget > 0)
        .map((status) => status.muscle),
    },
  };
}
