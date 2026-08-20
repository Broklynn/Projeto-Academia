import {
  buildDefaultHypertrophySetCreditPolicy,
  buildDefaultHypertrophyWeeklyVolumePolicy,
} from '../../domain/training';
import type { ValidationResult } from '../../domain/validation';
import type { CompleteSetup } from '../setup/setup-types';
import {
  augmentWeeklyCreditedSetTargetsWithAccessoriesWithinDuration,
  buildHypertrophyTrainingSelection,
  type WeeklyCreditedAccessoryAllocationResult,
} from '../training';
import {
  PLAN_ACCESSORY_CONSTRAINTS,
  PLAN_DURATION_MODEL,
  PLAN_SET_CONSTRAINTS,
} from './generation-policy';
import type {
  GeneratedExercise,
  GeneratedTrainingDay,
  GeneratedTrainingPlan,
} from './plan-types';

export function buildGeneratedTrainingPlan(
  setup: CompleteSetup,
  result: WeeklyCreditedAccessoryAllocationResult,
): GeneratedTrainingPlan {
  const accessoryKeys = new Set(
    result.accessoryAdditions.map(
      (addition) => `${addition.dayOrder}:${addition.exercise.id}`,
    ),
  );

  const days = result.week.days.map((daySelection): GeneratedTrainingDay => {
    const dayAllocation = result.allocation.days.find(
      (candidate) => candidate.dayOrder === daySelection.day.order,
    );
    const exercises = daySelection.exercises.flatMap(
      (exercise): GeneratedExercise[] => {
        const sets = dayAllocation?.exercises.find(
          (candidate) => candidate.exerciseId === exercise.id,
        )?.sets;

        if (sets === undefined || sets <= 0) {
          return [];
        }

        return [{
          exerciseId: exercise.id,
          name: exercise.name,
          sets,
          isAccessory: accessoryKeys.has(
            `${daySelection.day.order}:${exercise.id}`,
          ),
        }];
      },
    );

    return {
      order: daySelection.day.order,
      name: daySelection.day.name,
      exerciseCount: exercises.length,
      totalSets: exercises.reduce((total, exercise) => total + exercise.sets, 0),
      exercises,
    };
  });

  return {
    goal: 'hypertrophy',
    experience: setup.experience,
    daysPerWeek: setup.daysPerWeek,
    requestedSessionDurationMinutes: setup.sessionDurationMinutes,
    totalSets: days.reduce((total, day) => total + day.totalSets, 0),
    days,
  };
}

export function generateHypertrophyPlan(
  setup: CompleteSetup,
): ValidationResult<GeneratedTrainingPlan> {
  if (setup.goal !== 'hypertrophy') {
    return {
      valid: false,
      errors: [`goal ${setup.goal} is not supported for plan generation`],
    };
  }

  const week = buildHypertrophyTrainingSelection({
    daysPerWeek: setup.daysPerWeek,
    availableEquipment: setup.availableEquipment,
  });
  const result =
    augmentWeeklyCreditedSetTargetsWithAccessoriesWithinDuration(
      week,
      setup.availableEquipment,
      buildDefaultHypertrophyWeeklyVolumePolicy(),
      buildDefaultHypertrophySetCreditPolicy(),
      PLAN_SET_CONSTRAINTS,
      PLAN_ACCESSORY_CONSTRAINTS,
      {
        sessionDurationMinutes: setup.sessionDurationMinutes,
        durationModel: PLAN_DURATION_MODEL,
      },
    );

  if (!result.valid) {
    return result;
  }

  return {
    valid: true,
    value: buildGeneratedTrainingPlan(setup, result.value),
  };
}
