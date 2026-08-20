import type { ExerciseId } from '../../domain/exercise';
import {
  RIR_LIMITS,
  validateRepRange,
  validateWorkoutExercise,
  type RepRange,
  type Rir,
  type WorkoutExercise,
} from '../../domain/training';
import type { ValidationResult } from '../../domain/validation';

import {
  validateTrainingWeekSetAllocation,
  type TrainingWeekSetAllocation,
} from './analyze-set-volume';
import type { TrainingWeekSelection } from './build-training-selection';

export interface ExercisePrescriptionRule {
  readonly repRange: RepRange;
  readonly restSeconds: number;
  readonly targetRir: Rir;
  readonly notes?: string;
}

export interface ExercisePrescriptionOverride {
  readonly exerciseId: ExerciseId;
  readonly rule: ExercisePrescriptionRule;
}

export interface TrainingPrescriptionPolicy {
  readonly defaultRule: ExercisePrescriptionRule;
  readonly exerciseOverrides: readonly ExercisePrescriptionOverride[];
}

export interface PrescribedTrainingDay {
  readonly dayOrder: number;
  readonly dayName: string;
  readonly exercises: readonly WorkoutExercise[];
}

export interface PrescribedTrainingWeek {
  readonly days: readonly PrescribedTrainingDay[];
}

function validatePrescriptionRule(
  rule: ExercisePrescriptionRule,
  path: string,
): string[] {
  const errors: string[] = [];
  const repRangeValidation = validateRepRange(rule.repRange);

  if (!repRangeValidation.valid) {
    errors.push(
      ...repRangeValidation.errors.map((error) => `${path}.repRange.${error}`),
    );
  }

  if (!Number.isInteger(rule.restSeconds) || rule.restSeconds < 0) {
    errors.push(`${path}.restSeconds must be a non-negative integer`);
  }

  if (
    !Number.isInteger(rule.targetRir) ||
    rule.targetRir < RIR_LIMITS.min ||
    rule.targetRir > RIR_LIMITS.max
  ) {
    errors.push(
      `${path}.targetRir must be an integer between ${RIR_LIMITS.min} and ${RIR_LIMITS.max}`,
    );
  }

  if (rule.notes !== undefined && typeof rule.notes !== 'string') {
    errors.push(`${path}.notes must be a string when provided`);
  }

  return errors;
}

function validatePrescriptionPolicy(
  week: TrainingWeekSelection,
  policy: TrainingPrescriptionPolicy,
): string[] {
  const errors = validatePrescriptionRule(
    policy.defaultRule,
    'policy.defaultRule',
  );
  const weekExerciseIds = new Set(
    week.days.flatMap((day) =>
      day.exercises.map((exercise) => exercise.id),
    ),
  );
  const seenOverrideExerciseIds = new Set<ExerciseId>();

  policy.exerciseOverrides.forEach((override, overrideIndex) => {
    const path = `policy.exerciseOverrides[${overrideIndex}]`;

    if (override.exerciseId.trim().length === 0) {
      errors.push(`${path}.exerciseId must not be empty`);
    } else if (!weekExerciseIds.has(override.exerciseId)) {
      errors.push(`${path}.exerciseId ${override.exerciseId} does not exist in week`);
    }

    if (seenOverrideExerciseIds.has(override.exerciseId)) {
      errors.push(`${path}.exerciseId duplicates ${override.exerciseId}`);
    } else {
      seenOverrideExerciseIds.add(override.exerciseId);
    }

    errors.push(...validatePrescriptionRule(override.rule, `${path}.rule`));
  });

  return errors;
}

export function prescribeTrainingWeek(
  week: TrainingWeekSelection,
  allocation: TrainingWeekSetAllocation,
  policy: TrainingPrescriptionPolicy,
): ValidationResult<PrescribedTrainingWeek> {
  const allocationValidation = validateTrainingWeekSetAllocation(
    week,
    allocation,
  );
  const errors = validatePrescriptionPolicy(week, policy);

  if (!allocationValidation.valid) {
    errors.push(...allocationValidation.errors);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const overridesByExerciseId = new Map(
    policy.exerciseOverrides.map((override) => [
      override.exerciseId,
      override.rule,
    ]),
  );
  const days: PrescribedTrainingDay[] = [];

  for (const daySelection of week.days) {
    const dayAllocation = allocation.days.find(
      (candidate) => candidate.dayOrder === daySelection.day.order,
    );

    if (!dayAllocation || dayAllocation.exercises.length === 0) {
      continue;
    }

    const exercises: WorkoutExercise[] = [];

    daySelection.exercises.forEach((exercise, exerciseIndex) => {
      const exerciseAllocation = dayAllocation.exercises.find(
        (candidate) => candidate.exerciseId === exercise.id,
      );

      if (!exerciseAllocation) {
        return;
      }

      const rule = overridesByExerciseId.get(exercise.id) ?? policy.defaultRule;
      const workoutExercise: WorkoutExercise = {
        id: `${daySelection.day.order}:${exercise.id}`,
        exerciseId: exercise.id,
        order: exerciseIndex + 1,
        sets: exerciseAllocation.sets,
        repRange: {
          min: rule.repRange.min,
          max: rule.repRange.max,
        },
        restSeconds: rule.restSeconds,
        targetRir: rule.targetRir,
        ...(rule.notes === undefined ? {} : { notes: rule.notes }),
      };
      const workoutExerciseValidation = validateWorkoutExercise(workoutExercise);

      if (!workoutExerciseValidation.valid) {
        errors.push(
          ...workoutExerciseValidation.errors.map(
            (error) =>
              `prescription day ${daySelection.day.order} exercise ${exercise.id}: ${error}`,
          ),
        );
        return;
      }

      exercises.push(workoutExercise);
    });

    if (exercises.length > 0) {
      days.push({
        dayOrder: daySelection.day.order,
        dayName: daySelection.day.name,
        exercises,
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, value: { days } };
}
