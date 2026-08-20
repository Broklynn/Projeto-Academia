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
  allocateWeeklyDirectSetsWithinDuration,
  type DirectSetAllocationConstraints,
} from './allocate-direct-sets';
import type {
  SessionDurationConstraint,
  WeeklySessionDurationAnalysis,
} from './analyze-session-duration';
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

export interface WeeklyDurationAwareAccessoryAllocationResult {
  readonly week: TrainingWeekSelection;
  readonly accessoryAdditions: readonly AccessoryExerciseAddition[];
  readonly allocation: TrainingWeekSetAllocation;
  readonly volumeAnalysis: WeeklyDirectSetVolumeAnalysis;
  readonly durationAnalysis: WeeklySessionDurationAnalysis;
}

interface AccessoryAllocationSnapshot {
  readonly allocation: TrainingWeekSetAllocation;
  readonly volumeAnalysis: WeeklyDirectSetVolumeAnalysis;
  readonly durationAnalysis: WeeklySessionDurationAnalysis | undefined;
}

interface AccessoryAugmentationCoreResult {
  readonly week: TrainingWeekSelection;
  readonly accessoryAdditions: readonly AccessoryExerciseAddition[];
  readonly snapshot: AccessoryAllocationSnapshot;
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

function validateAccessoryConstraints(
  accessoryConstraints: AccessoryExerciseConstraints,
): ValidationResult {
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

  return { valid: true };
}

function augmentWithAccessories(
  week: TrainingWeekSelection,
  availableEquipment: readonly Equipment[],
  accessoryConstraints: AccessoryExerciseConstraints,
  allocate: (
    candidateWeek: TrainingWeekSelection,
  ) => ValidationResult<AccessoryAllocationSnapshot>,
): ValidationResult<AccessoryAugmentationCoreResult> {
  const accessoryConstraintsValidation = validateAccessoryConstraints(
    accessoryConstraints,
  );

  if (!accessoryConstraintsValidation.valid) {
    return accessoryConstraintsValidation;
  }

  const initialAllocation = allocate(week);

  if (!initialAllocation.valid) {
    return initialAllocation;
  }

  let currentWeek = week;
  let currentSnapshot = initialAllocation.value;
  const accessoryAdditions: AccessoryExerciseAddition[] = [];
  const additionalExercisesByDay = week.days.map(() => 0);

  while (currentSnapshot.volumeAnalysis.musclesBelowTarget.length > 0) {
    let addedAccessoryInPass = false;

    for (const muscle of MUSCLE_GROUPS) {
      const remainingBefore = remainingSetsFor(
        currentSnapshot.volumeAnalysis,
        muscle,
      );

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
          const tentativeAllocation = allocate(tentativeWeek);

          if (!tentativeAllocation.valid) {
            return tentativeAllocation;
          }

          const targetImproved =
            remainingSetsFor(
              tentativeAllocation.value.volumeAnalysis,
              muscle,
            ) < remainingBefore;
          const noMuscleWorsened = hasNoWorseDeficit(
            currentSnapshot.volumeAnalysis,
            tentativeAllocation.value.volumeAnalysis,
          );
          const candidateReceivedSets =
            allocatedSetsForExercise(
              tentativeAllocation.value.allocation,
              daySelection.day.order,
              candidate.id,
            ) >= 1;
          const durationFits =
            !tentativeAllocation.value.durationAnalysis ||
            tentativeAllocation.value.durationAnalysis.daysExceedingDuration
              .length === 0;

          if (
            !targetImproved ||
            !noMuscleWorsened ||
            !candidateReceivedSets ||
            !durationFits
          ) {
            continue;
          }

          currentWeek = tentativeWeek;
          currentSnapshot = tentativeAllocation.value;
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
      snapshot: currentSnapshot,
    },
  };
}

export function augmentWeeklyDirectSetTargetsWithAccessories(
  week: TrainingWeekSelection,
  availableEquipment: readonly Equipment[],
  policy: HypertrophyWeeklyVolumePolicy,
  setConstraints: DirectSetAllocationConstraints,
  accessoryConstraints: AccessoryExerciseConstraints,
): ValidationResult<WeeklyAccessoryAllocationResult> {
  const result = augmentWithAccessories(
    week,
    availableEquipment,
    accessoryConstraints,
    (candidateWeek) => {
      const allocation = allocateWeeklyDirectSets(
        candidateWeek,
        policy,
        setConstraints,
      );

      return allocation.valid
        ? {
            valid: true,
            value: {
              allocation: allocation.value.allocation,
              volumeAnalysis: allocation.value.analysis,
              durationAnalysis: undefined,
            },
          }
        : allocation;
    },
  );

  if (!result.valid) {
    return result;
  }

  return {
    valid: true,
    value: {
      week: result.value.week,
      accessoryAdditions: result.value.accessoryAdditions,
      allocation: result.value.snapshot.allocation,
      analysis: result.value.snapshot.volumeAnalysis,
    },
  };
}

export function augmentWeeklyDirectSetTargetsWithAccessoriesWithinDuration(
  week: TrainingWeekSelection,
  availableEquipment: readonly Equipment[],
  policy: HypertrophyWeeklyVolumePolicy,
  setConstraints: DirectSetAllocationConstraints,
  accessoryConstraints: AccessoryExerciseConstraints,
  durationConstraint: SessionDurationConstraint,
): ValidationResult<WeeklyDurationAwareAccessoryAllocationResult> {
  const result = augmentWithAccessories(
    week,
    availableEquipment,
    accessoryConstraints,
    (candidateWeek) =>
      allocateWeeklyDirectSetsWithinDuration(
        candidateWeek,
        policy,
        setConstraints,
        durationConstraint,
      ),
  );

  if (!result.valid) {
    return result;
  }

  const durationAnalysis = result.value.snapshot.durationAnalysis;

  if (!durationAnalysis) {
    return {
      valid: false,
      errors: ['duration-aware allocation must include durationAnalysis'],
    };
  }

  return {
    valid: true,
    value: {
      week: result.value.week,
      accessoryAdditions: result.value.accessoryAdditions,
      allocation: result.value.snapshot.allocation,
      volumeAnalysis: result.value.snapshot.volumeAnalysis,
      durationAnalysis,
    },
  };
}
