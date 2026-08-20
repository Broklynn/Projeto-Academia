import {
  MUSCLE_GROUPS,
  type Exercise,
  type MuscleGroup,
} from '../../domain/exercise';
import type {
  HypertrophySetCreditPolicy,
  HypertrophyWeeklyVolumePolicy,
} from '../../domain/training';
import type { ValidationResult } from '../../domain/validation';

import {
  analyzeWeeklyCreditedSetVolume,
  type WeeklyCreditedSetVolumeAnalysis,
} from './analyze-credited-set-volume';
import {
  analyzeWeeklyDirectSetVolume,
  type TrainingWeekSetAllocation,
  type WeeklyDirectSetVolumeAnalysis,
} from './analyze-set-volume';
import {
  analyzeWeeklySessionDuration,
  type SessionDurationConstraint,
  type SessionDurationModel,
  type WeeklySessionDurationAnalysis,
} from './analyze-session-duration';
import type { TrainingWeekSelection } from './build-training-selection';

export interface DirectSetAllocationConstraints {
  readonly maxSetsPerExerciseOccurrence: number;
}

export interface WeeklyDirectSetAllocationResult {
  readonly allocation: TrainingWeekSetAllocation;
  readonly analysis: WeeklyDirectSetVolumeAnalysis;
}

export interface WeeklyDurationConstrainedSetAllocationResult {
  readonly allocation: TrainingWeekSetAllocation;
  readonly volumeAnalysis: WeeklyDirectSetVolumeAnalysis;
  readonly durationAnalysis: WeeklySessionDurationAnalysis;
}

export interface WeeklyCreditedSetAllocationResult {
  readonly allocation: TrainingWeekSetAllocation;
  readonly creditedVolumeAnalysis: WeeklyCreditedSetVolumeAnalysis;
  readonly durationAnalysis: WeeklySessionDurationAnalysis;
}

interface DirectSetAttempt {
  readonly dayIndex: number;
  readonly currentExerciseSets: number;
  readonly exercise: Exercise;
}

interface RoundRobinHooks {
  readonly canAddSet?: (attempt: DirectSetAttempt) => boolean;
  readonly onSetAdded?: (attempt: DirectSetAttempt) => void;
}

function validateSetConstraints(
  constraints: DirectSetAllocationConstraints,
): ValidationResult {
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

  return { valid: true };
}

function marginalDurationForSet(
  durationModel: SessionDurationModel,
  currentExerciseSets: number,
): number {
  return (
    durationModel.minutesPerSet +
    (currentExerciseSets === 0
      ? durationModel.minutesPerExerciseOverhead
      : 0)
  );
}

function allocateDirectSetsRoundRobin(
  week: TrainingWeekSelection,
  muscleTargets: readonly {
    readonly muscle: MuscleGroup;
    readonly targetSetsPerWeek: number;
  }[],
  constraints: DirectSetAllocationConstraints,
  hooks: RoundRobinHooks = {},
): TrainingWeekSetAllocation {
  const targetSetsByMuscle = new Map(
    muscleTargets.map((status) => [
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

        const canAddSetForMuscles = exercise.primaryMuscles.every((muscle) => {
          const currentMuscleSets = allocatedDirectSetsByMuscle.get(muscle) ?? 0;
          const targetMuscleSets = targetSetsByMuscle.get(muscle)!;

          return currentMuscleSets + 1 <= targetMuscleSets;
        });
        const atLeastOneMuscleNeedsSet = exercise.primaryMuscles.some(
          (muscle) =>
            (allocatedDirectSetsByMuscle.get(muscle) ?? 0) <
            targetSetsByMuscle.get(muscle)!,
        );
        const attempt = { dayIndex, currentExerciseSets, exercise };

        if (
          !canAddSetForMuscles ||
          !atLeastOneMuscleNeedsSet ||
          hooks.canAddSet?.(attempt) === false
        ) {
          return;
        }

        daySets[exerciseIndex] = currentExerciseSets + 1;
        for (const muscle of exercise.primaryMuscles) {
          allocatedDirectSetsByMuscle.set(
            muscle,
            (allocatedDirectSetsByMuscle.get(muscle) ?? 0) + 1,
          );
        }
        hooks.onSetAdded?.(attempt);
        addedSetInPass = true;
      });
    });

    if (!addedSetInPass) {
      break;
    }
  }

  return {
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
}

export function allocateWeeklyDirectSets(
  week: TrainingWeekSelection,
  policy: HypertrophyWeeklyVolumePolicy,
  constraints: DirectSetAllocationConstraints,
): ValidationResult<WeeklyDirectSetAllocationResult> {
  const constraintsValidation = validateSetConstraints(constraints);

  if (!constraintsValidation.valid) {
    return constraintsValidation;
  }

  const emptyAnalysis = analyzeWeeklyDirectSetVolume(
    week,
    { days: [] },
    policy,
  );

  if (!emptyAnalysis.valid) {
    return emptyAnalysis;
  }

  const allocation = allocateDirectSetsRoundRobin(
    week,
    emptyAnalysis.value.muscles,
    constraints,
  );
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

export function allocateWeeklyDirectSetsWithinDuration(
  week: TrainingWeekSelection,
  policy: HypertrophyWeeklyVolumePolicy,
  setConstraints: DirectSetAllocationConstraints,
  durationConstraint: SessionDurationConstraint,
): ValidationResult<WeeklyDurationConstrainedSetAllocationResult> {
  const setConstraintsValidation = validateSetConstraints(setConstraints);
  const emptyVolumeAnalysis = analyzeWeeklyDirectSetVolume(
    week,
    { days: [] },
    policy,
  );
  const emptyDurationAnalysis = analyzeWeeklySessionDuration(
    week,
    { days: [] },
    durationConstraint.sessionDurationMinutes,
    durationConstraint.durationModel,
  );

  if (
    !setConstraintsValidation.valid ||
    !emptyVolumeAnalysis.valid ||
    !emptyDurationAnalysis.valid
  ) {
    return {
      valid: false,
      errors: [
        ...(setConstraintsValidation.valid
          ? []
          : setConstraintsValidation.errors),
        ...(emptyVolumeAnalysis.valid ? [] : emptyVolumeAnalysis.errors),
        ...(emptyDurationAnalysis.valid ? [] : emptyDurationAnalysis.errors),
      ],
    };
  }

  const estimatedDurationByDay = week.days.map(() => 0);
  const allocation = allocateDirectSetsRoundRobin(
    week,
    emptyVolumeAnalysis.value.muscles,
    setConstraints,
    {
      canAddSet: ({ dayIndex, currentExerciseSets }) => {
        const marginalDuration = marginalDurationForSet(
          durationConstraint.durationModel,
          currentExerciseSets,
        );

        return (
          estimatedDurationByDay[dayIndex]! + marginalDuration <=
          durationConstraint.sessionDurationMinutes
        );
      },
      onSetAdded: ({ dayIndex, currentExerciseSets }) => {
        estimatedDurationByDay[dayIndex] =
          estimatedDurationByDay[dayIndex]! +
          marginalDurationForSet(
            durationConstraint.durationModel,
            currentExerciseSets,
          );
      },
    },
  );
  const finalVolumeAnalysis = analyzeWeeklyDirectSetVolume(
    week,
    allocation,
    policy,
  );
  const finalDurationAnalysis = analyzeWeeklySessionDuration(
    week,
    allocation,
    durationConstraint.sessionDurationMinutes,
    durationConstraint.durationModel,
  );

  if (!finalVolumeAnalysis.valid) {
    return finalVolumeAnalysis;
  }

  if (!finalDurationAnalysis.valid) {
    return finalDurationAnalysis;
  }

  return {
    valid: true,
    value: {
      allocation,
      volumeAnalysis: finalVolumeAnalysis.value,
      durationAnalysis: finalDurationAnalysis.value,
    },
  };
}

export function allocateWeeklyCreditedSetsWithinDuration(
  week: TrainingWeekSelection,
  volumePolicy: HypertrophyWeeklyVolumePolicy,
  creditPolicy: HypertrophySetCreditPolicy,
  setConstraints: DirectSetAllocationConstraints,
  durationConstraint: SessionDurationConstraint,
): ValidationResult<WeeklyCreditedSetAllocationResult> {
  const setConstraintsValidation = validateSetConstraints(setConstraints);
  const emptyCreditedVolumeAnalysis = analyzeWeeklyCreditedSetVolume(
    week,
    { days: [] },
    volumePolicy,
    creditPolicy,
  );
  const emptyDurationAnalysis = analyzeWeeklySessionDuration(
    week,
    { days: [] },
    durationConstraint.sessionDurationMinutes,
    durationConstraint.durationModel,
  );

  if (
    !setConstraintsValidation.valid ||
    !emptyCreditedVolumeAnalysis.valid ||
    !emptyDurationAnalysis.valid
  ) {
    return {
      valid: false,
      errors: [
        ...(setConstraintsValidation.valid
          ? []
          : setConstraintsValidation.errors),
        ...(emptyCreditedVolumeAnalysis.valid
          ? []
          : emptyCreditedVolumeAnalysis.errors),
        ...(emptyDurationAnalysis.valid ? [] : emptyDurationAnalysis.errors),
      ],
    };
  }

  const targetSetsByMuscle = new Map(
    emptyCreditedVolumeAnalysis.value.muscles.map((status) => [
      status.muscle,
      status.targetSetsPerWeek,
    ]),
  );
  const creditedSetsByMuscle = new Map<MuscleGroup, number>(
    MUSCLE_GROUPS.map((muscle) => [muscle, 0]),
  );
  const estimatedDurationByDay = week.days.map(() => 0);
  const allocation = allocateDirectSetsRoundRobin(
    week,
    emptyCreditedVolumeAnalysis.value.muscles,
    setConstraints,
    {
      canAddSet: ({ dayIndex, currentExerciseSets, exercise }) => {
        const marginalDuration = marginalDurationForSet(
          durationConstraint.durationModel,
          currentExerciseSets,
        );
        const fitsDuration =
          estimatedDurationByDay[dayIndex]! + marginalDuration <=
          durationConstraint.sessionDurationMinutes;
        const creditedIncrements = [
          ...exercise.primaryMuscles.map((muscle) => ({ muscle, credit: 1 })),
          ...exercise.secondaryMuscles.map((muscle) => ({
            muscle,
            credit: creditPolicy.indirectSetCredit,
          })),
        ];
        const noMuscleExceedsTarget = creditedIncrements.every(
          ({ muscle, credit }) =>
            (creditedSetsByMuscle.get(muscle) ?? 0) + credit <=
            targetSetsByMuscle.get(muscle)!,
        );
        const atLeastOneMuscleNeedsCredit = creditedIncrements.some(
          ({ muscle, credit }) =>
            credit > 0 &&
            (creditedSetsByMuscle.get(muscle) ?? 0) <
              targetSetsByMuscle.get(muscle)!,
        );

        return (
          fitsDuration &&
          noMuscleExceedsTarget &&
          atLeastOneMuscleNeedsCredit
        );
      },
      onSetAdded: ({ dayIndex, currentExerciseSets, exercise }) => {
        estimatedDurationByDay[dayIndex] =
          estimatedDurationByDay[dayIndex]! +
          marginalDurationForSet(
            durationConstraint.durationModel,
            currentExerciseSets,
          );

        for (const muscle of exercise.primaryMuscles) {
          creditedSetsByMuscle.set(
            muscle,
            (creditedSetsByMuscle.get(muscle) ?? 0) + 1,
          );
        }
        for (const muscle of exercise.secondaryMuscles) {
          creditedSetsByMuscle.set(
            muscle,
            (creditedSetsByMuscle.get(muscle) ?? 0) +
              creditPolicy.indirectSetCredit,
          );
        }
      },
    },
  );
  const finalCreditedVolumeAnalysis = analyzeWeeklyCreditedSetVolume(
    week,
    allocation,
    volumePolicy,
    creditPolicy,
  );
  const finalDurationAnalysis = analyzeWeeklySessionDuration(
    week,
    allocation,
    durationConstraint.sessionDurationMinutes,
    durationConstraint.durationModel,
  );

  if (!finalCreditedVolumeAnalysis.valid) {
    return finalCreditedVolumeAnalysis;
  }

  if (!finalDurationAnalysis.valid) {
    return finalDurationAnalysis;
  }

  return {
    valid: true,
    value: {
      allocation,
      creditedVolumeAnalysis: finalCreditedVolumeAnalysis.value,
      durationAnalysis: finalDurationAnalysis.value,
    },
  };
}
