import { getExerciseCandidatesForSplitDay } from '../../data/exercises';
import {
  MUSCLE_GROUPS,
  type Equipment,
  type Exercise,
  type ExerciseId,
  type MuscleGroup,
} from '../../domain/exercise';
import type { HypertrophyWeeklyVolumePolicy } from '../../domain/training';
import type { ValidationResult } from '../../domain/validation';

import {
  allocateWeeklyDirectSets,
  type DirectSetAllocationConstraints,
} from './allocate-direct-sets';
import type {
  TrainingWeekSetAllocation,
  WeeklyDirectSetVolumeAnalysis,
} from './analyze-set-volume';
import type { TrainingWeekSelection } from './build-training-selection';

export interface AccessoryExerciseConstraints {
  readonly maxAdditionalExercisesPerDay: number;
}

export interface AccessoryExerciseAddition {
  readonly dayOrder: number;
  readonly exercise: Readonly<Exercise>;
}

export interface WeeklyAccessoryAllocationResult {
  readonly week: TrainingWeekSelection;
  readonly accessoryAdditions: readonly AccessoryExerciseAddition[];
  readonly allocation: TrainingWeekSetAllocation;
  readonly analysis: WeeklyDirectSetVolumeAnalysis;
}

function remainingSetsFor(
  analysis: WeeklyDirectSetVolumeAnalysis,
  muscle: MuscleGroup,
): number {
  return analysis.muscles.find((status) => status.muscle === muscle)!
    .remainingSetsToTarget;
}

function hasNoWorseDeficit(
  before: WeeklyDirectSetVolumeAnalysis,
  after: WeeklyDirectSetVolumeAnalysis,
): boolean {
  return MUSCLE_GROUPS.every(
    (muscle) => remainingSetsFor(after, muscle) <= remainingSetsFor(before, muscle),
  );
}

function allocatedSetsForExercise(
  allocation: TrainingWeekSetAllocation,
  dayOrder: number,
  exerciseId: ExerciseId,
): number {
  return allocation.days
    .find((day) => day.dayOrder === dayOrder)
    ?.exercises.find((exercise) => exercise.exerciseId === exerciseId)?.sets ?? 0;
}

function appendExercise(
  week: TrainingWeekSelection,
  dayIndex: number,
  exercise: Readonly<Exercise>,
): TrainingWeekSelection {
  return {
    split: week.split,
    days: week.days.map((daySelection, index) =>
      index === dayIndex
        ? {
            ...daySelection,
            exercises: [...daySelection.exercises, exercise],
          }
        : daySelection,
    ),
  };
}

export function augmentWeeklyDirectSetTargetsWithAccessories(
  week: TrainingWeekSelection,
  availableEquipment: readonly Equipment[],
  policy: HypertrophyWeeklyVolumePolicy,
  setConstraints: DirectSetAllocationConstraints,
  accessoryConstraints: AccessoryExerciseConstraints,
): ValidationResult<WeeklyAccessoryAllocationResult> {
  if (
    !Number.isFinite(accessoryConstraints.maxAdditionalExercisesPerDay) ||
    !Number.isInteger(accessoryConstraints.maxAdditionalExercisesPerDay) ||
    accessoryConstraints.maxAdditionalExercisesPerDay < 0
  ) {
    return {
      valid: false,
      errors: [
        'accessoryConstraints.maxAdditionalExercisesPerDay must be a non-negative integer',
      ],
    };
  }

  const initialAllocation = allocateWeeklyDirectSets(
    week,
    policy,
    setConstraints,
  );

  if (!initialAllocation.valid) {
    return initialAllocation;
  }

  let currentWeek = week;
  let currentAllocation = initialAllocation.value.allocation;
  let currentAnalysis = initialAllocation.value.analysis;
  const accessoryAdditions: AccessoryExerciseAddition[] = [];
  const additionalExercisesByDay = week.days.map(() => 0);

  while (currentAnalysis.musclesBelowTarget.length > 0) {
    let addedAccessoryInPass = false;

    for (const muscle of MUSCLE_GROUPS) {
      const remainingBefore = remainingSetsFor(currentAnalysis, muscle);

      if (remainingBefore === 0) {
        continue;
      }

      let acceptedForMuscle = false;

      for (let dayIndex = 0; dayIndex < currentWeek.days.length; dayIndex += 1) {
        const daySelection = currentWeek.days[dayIndex]!;

        if (
          !daySelection.day.targetMuscles.includes(muscle) ||
          additionalExercisesByDay[dayIndex]! >=
            accessoryConstraints.maxAdditionalExercisesPerDay
        ) {
          continue;
        }

        const existingExerciseIds = new Set(
          daySelection.exercises.map((exercise) => exercise.id),
        );
        const candidates = getExerciseCandidatesForSplitDay(
          daySelection.day,
          availableEquipment,
        );

        for (const candidate of candidates) {
          if (
            !candidate.primaryMuscles.includes(muscle) ||
            existingExerciseIds.has(candidate.id)
          ) {
            continue;
          }

          const tentativeWeek = appendExercise(currentWeek, dayIndex, candidate);
          const tentativeAllocation = allocateWeeklyDirectSets(
            tentativeWeek,
            policy,
            setConstraints,
          );

          if (!tentativeAllocation.valid) {
            return tentativeAllocation;
          }

          const targetImproved =
            remainingSetsFor(tentativeAllocation.value.analysis, muscle) <
            remainingBefore;
          const noMuscleWorsened = hasNoWorseDeficit(
            currentAnalysis,
            tentativeAllocation.value.analysis,
          );
          const candidateReceivedSets =
            allocatedSetsForExercise(
              tentativeAllocation.value.allocation,
              daySelection.day.order,
              candidate.id,
            ) >= 1;

          if (!targetImproved || !noMuscleWorsened || !candidateReceivedSets) {
            continue;
          }

          currentWeek = tentativeWeek;
          currentAllocation = tentativeAllocation.value.allocation;
          currentAnalysis = tentativeAllocation.value.analysis;
          accessoryAdditions.push({
            dayOrder: daySelection.day.order,
            exercise: candidate,
          });
          additionalExercisesByDay[dayIndex] =
            additionalExercisesByDay[dayIndex]! + 1;
          addedAccessoryInPass = true;
          acceptedForMuscle = true;
          break;
        }

        if (acceptedForMuscle) {
          break;
        }
      }
    }

    if (!addedAccessoryInPass) {
      break;
    }
  }

  return {
    valid: true,
    value: {
      week: currentWeek,
      accessoryAdditions,
      allocation: currentAllocation,
      analysis: currentAnalysis,
    },
  };
}
