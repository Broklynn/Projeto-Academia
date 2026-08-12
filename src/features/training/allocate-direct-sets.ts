import { MUSCLE_GROUPS, type MuscleGroup } from '../../domain/exercise';
import type { HypertrophyWeeklyVolumePolicy } from '../../domain/training';
import type { ValidationResult } from '../../domain/validation';

import {
  analyzeWeeklyDirectSetVolume,
  type TrainingWeekSetAllocation,
  type WeeklyDirectSetVolumeAnalysis,
} from './analyze-set-volume';
import type { TrainingWeekSelection } from './build-training-selection';

export interface DirectSetAllocationConstraints {
  readonly maxSetsPerExerciseOccurrence: number;
}

export interface WeeklyDirectSetAllocationResult {
  readonly allocation: TrainingWeekSetAllocation;
  readonly analysis: WeeklyDirectSetVolumeAnalysis;
}

export function allocateWeeklyDirectSets(
  week: TrainingWeekSelection,
  policy: HypertrophyWeeklyVolumePolicy,
  constraints: DirectSetAllocationConstraints,
): ValidationResult<WeeklyDirectSetAllocationResult> {
  if (
    !Number.isFinite(constraints.maxSetsPerExerciseOccurrence) ||
    !Number.isInteger(constraints.maxSetsPerExerciseOccurrence) ||
    constraints.maxSetsPerExerciseOccurrence < 1
  ) {
    return {
      valid: false,
      errors: [
        'constraints.maxSetsPerExerciseOccurrence must be a positive integer',
      ],
    };
  }

  const emptyAnalysis = analyzeWeeklyDirectSetVolume(
    week,
    { days: [] },
    policy,
  );

  if (!emptyAnalysis.valid) {
    return emptyAnalysis;
  }

  const targetSetsByMuscle = new Map(
    emptyAnalysis.value.muscles.map((status) => [
      status.muscle,
      status.targetSetsPerWeek,
    ]),
  );
  const allocatedDirectSetsByMuscle = new Map<MuscleGroup, number>(
    MUSCLE_GROUPS.map((muscle) => [muscle, 0]),
  );
  const setsByOccurrence = week.days.map((daySelection) =>
    daySelection.exercises.map(() => 0),
  );

  while (true) {
    let addedSetInPass = false;

    week.days.forEach((daySelection, dayIndex) => {
      const daySets = setsByOccurrence[dayIndex]!;

      daySelection.exercises.forEach((exercise, exerciseIndex) => {
        const currentExerciseSets = daySets[exerciseIndex] ?? 0;

        if (
          currentExerciseSets >= constraints.maxSetsPerExerciseOccurrence
        ) {
          return;
        }

        const canAddSet = exercise.primaryMuscles.every((muscle) => {
          const currentMuscleSets = allocatedDirectSetsByMuscle.get(muscle) ?? 0;
          const targetMuscleSets = targetSetsByMuscle.get(muscle)!;

          return currentMuscleSets + 1 <= targetMuscleSets;
        });
        const atLeastOneMuscleNeedsSet = exercise.primaryMuscles.some(
          (muscle) =>
            (allocatedDirectSetsByMuscle.get(muscle) ?? 0) <
            targetSetsByMuscle.get(muscle)!,
        );

        if (!canAddSet || !atLeastOneMuscleNeedsSet) {
          return;
        }

        daySets[exerciseIndex] = currentExerciseSets + 1;
        for (const muscle of exercise.primaryMuscles) {
          allocatedDirectSetsByMuscle.set(
            muscle,
            (allocatedDirectSetsByMuscle.get(muscle) ?? 0) + 1,
          );
        }
        addedSetInPass = true;
      });
    });

    if (!addedSetInPass) {
      break;
    }
  }

  const allocation: TrainingWeekSetAllocation = {
    days: week.days.flatMap((daySelection, dayIndex) => {
      const daySets = setsByOccurrence[dayIndex]!;
      const exercises = daySelection.exercises.flatMap(
        (exercise, exerciseIndex) => {
          const sets = daySets[exerciseIndex] ?? 0;

          return sets > 0 ? [{ exerciseId: exercise.id, sets }] : [];
        },
      );

      return exercises.length > 0
        ? [{ dayOrder: daySelection.day.order, exercises }]
        : [];
    }),
  };
  const finalAnalysis = analyzeWeeklyDirectSetVolume(week, allocation, policy);

  if (!finalAnalysis.valid) {
    return finalAnalysis;
  }

  return {
    valid: true,
    value: {
      allocation,
      analysis: finalAnalysis.value,
    },
  };
}
