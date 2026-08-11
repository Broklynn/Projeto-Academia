import {
  isIntegerInRange,
  type ValidationResult,
  validationResultFromErrors,
} from '../validation';

import {
  RIR_LIMITS,
  type RepRange,
  type SetPerformance,
  type WorkoutExercise,
} from './types';

function hasValidRir(value: number): boolean {
  return isIntegerInRange(value, RIR_LIMITS.min, RIR_LIMITS.max);
}

export function validateRepRange(repRange: RepRange): ValidationResult {
  const errors: string[] = [];

  if (!Number.isInteger(repRange.min) || repRange.min <= 0) {
    errors.push('min must be a positive integer');
  }

  if (!Number.isInteger(repRange.max) || repRange.max <= 0) {
    errors.push('max must be a positive integer');
  }

  if (repRange.min > repRange.max) {
    errors.push('min must be less than or equal to max');
  }

  return validationResultFromErrors(errors);
}

export function validateWorkoutExercise(workoutExercise: WorkoutExercise): ValidationResult {
  const errors: string[] = [];

  if (workoutExercise.id.trim().length === 0) {
    errors.push('id must not be empty');
  }

  if (workoutExercise.exerciseId.trim().length === 0) {
    errors.push('exerciseId must not be empty');
  }

  if (!Number.isInteger(workoutExercise.order) || workoutExercise.order <= 0) {
    errors.push('order must be a positive integer');
  }

  if (!Number.isInteger(workoutExercise.sets) || workoutExercise.sets <= 0) {
    errors.push('sets must be a positive integer');
  }

  if (!Number.isInteger(workoutExercise.restSeconds) || workoutExercise.restSeconds < 0) {
    errors.push('restSeconds must be a non-negative integer');
  }

  if (!hasValidRir(workoutExercise.targetRir)) {
    errors.push(`targetRir must be an integer between ${RIR_LIMITS.min} and ${RIR_LIMITS.max}`);
  }

  const repRangeResult = validateRepRange(workoutExercise.repRange);
  if (!repRangeResult.valid) {
    errors.push(...repRangeResult.errors.map((error) => `repRange.${error}`));
  }

  return validationResultFromErrors(errors);
}

export function validateSetPerformance(setPerformance: SetPerformance): ValidationResult {
  const errors: string[] = [];

  if (!Number.isInteger(setPerformance.setNumber) || setPerformance.setNumber <= 0) {
    errors.push('setNumber must be a positive integer');
  }

  if (!Number.isFinite(setPerformance.weightKg) || setPerformance.weightKg < 0) {
    errors.push('weightKg must be a non-negative finite number');
  }

  if (!Number.isInteger(setPerformance.reps) || setPerformance.reps < 0) {
    errors.push('reps must be a non-negative integer');
  }

  if (!hasValidRir(setPerformance.rir)) {
    errors.push(`rir must be an integer between ${RIR_LIMITS.min} and ${RIR_LIMITS.max}`);
  }

  if (typeof setPerformance.completed !== 'boolean') {
    errors.push('completed must be a boolean');
  }

  return validationResultFromErrors(errors);
}
