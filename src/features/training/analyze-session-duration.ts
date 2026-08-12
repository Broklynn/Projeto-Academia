import { validateSessionDurationMinutes } from '../../domain/athlete';
import type { ValidationResult } from '../../domain/validation';

import {
  validateTrainingWeekSetAllocation,
  type TrainingWeekSetAllocation,
} from './analyze-set-volume';
import type { TrainingWeekSelection } from './build-training-selection';

export interface SessionDurationModel {
  readonly minutesPerSet: number;
  readonly minutesPerExerciseOverhead: number;
}

export interface SessionDurationConstraint {
  readonly sessionDurationMinutes: number;
  readonly durationModel: SessionDurationModel;
}

export interface TrainingDayDurationStatus {
  readonly dayOrder: number;
  readonly dayName: string;
  readonly allocatedExerciseCount: number;
  readonly allocatedSetCount: number;
  readonly estimatedDurationMinutes: number;
  readonly sessionDurationMinutes: number;
  readonly remainingMinutes: number;
  readonly excessMinutes: number;
  readonly fitsDuration: boolean;
}

export interface WeeklySessionDurationAnalysis {
  readonly days: readonly TrainingDayDurationStatus[];
  readonly daysWithinDuration: readonly number[];
  readonly daysExceedingDuration: readonly number[];
}

export function analyzeWeeklySessionDuration(
  week: TrainingWeekSelection,
  allocation: TrainingWeekSetAllocation,
  sessionDurationMinutes: number,
  durationModel: SessionDurationModel,
): ValidationResult<WeeklySessionDurationAnalysis> {
  const errors: string[] = [];
  const sessionDurationValidation = validateSessionDurationMinutes(
    sessionDurationMinutes,
  );
  const allocationValidation = validateTrainingWeekSetAllocation(
    week,
    allocation,
  );

  if (!sessionDurationValidation.valid) {
    errors.push(...sessionDurationValidation.errors);
  }

  if (
    !Number.isFinite(durationModel.minutesPerSet) ||
    durationModel.minutesPerSet <= 0
  ) {
    errors.push('durationModel.minutesPerSet must be a positive finite number');
  }

  if (
    !Number.isFinite(durationModel.minutesPerExerciseOverhead) ||
    durationModel.minutesPerExerciseOverhead < 0
  ) {
    errors.push(
      'durationModel.minutesPerExerciseOverhead must be a non-negative finite number',
    );
  }

  if (!allocationValidation.valid) {
    errors.push(...allocationValidation.errors);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const days = week.days.map((daySelection): TrainingDayDurationStatus => {
    const dayAllocation = allocation.days.find(
      (candidate) => candidate.dayOrder === daySelection.day.order,
    );
    const allocatedExerciseCount = dayAllocation?.exercises.length ?? 0;
    const allocatedSetCount =
      dayAllocation?.exercises.reduce(
        (total, exercise) => total + exercise.sets,
        0,
      ) ?? 0;
    const estimatedDurationMinutes =
      allocatedSetCount * durationModel.minutesPerSet +
      allocatedExerciseCount * durationModel.minutesPerExerciseOverhead;

    return {
      dayOrder: daySelection.day.order,
      dayName: daySelection.day.name,
      allocatedExerciseCount,
      allocatedSetCount,
      estimatedDurationMinutes,
      sessionDurationMinutes,
      remainingMinutes: Math.max(
        sessionDurationMinutes - estimatedDurationMinutes,
        0,
      ),
      excessMinutes: Math.max(
        estimatedDurationMinutes - sessionDurationMinutes,
        0,
      ),
      fitsDuration: estimatedDurationMinutes <= sessionDurationMinutes,
    };
  });

  return {
    valid: true,
    value: {
      days,
      daysWithinDuration: days
        .filter((day) => day.fitsDuration)
        .map((day) => day.dayOrder),
      daysExceedingDuration: days
        .filter((day) => !day.fitsDuration)
        .map((day) => day.dayOrder),
    },
  };
}
