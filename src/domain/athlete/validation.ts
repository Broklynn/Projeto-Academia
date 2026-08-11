import {
  isIntegerInRange,
  type ValidationResult,
  validationResultFromErrors,
} from '../validation';

import {
  SESSION_DURATION_MINUTES_LIMITS,
  TRAINING_DAYS_PER_WEEK_LIMITS,
  type AthleteProfile,
} from './types';

export function validateAthleteProfile(profile: AthleteProfile): ValidationResult {
  const errors: string[] = [];

  if (profile.id.trim().length === 0) {
    errors.push('id must not be empty');
  }

  if (profile.displayName.trim().length === 0) {
    errors.push('displayName must not be empty');
  }

  if (
    !isIntegerInRange(
      profile.daysPerWeek,
      TRAINING_DAYS_PER_WEEK_LIMITS.min,
      TRAINING_DAYS_PER_WEEK_LIMITS.max,
    )
  ) {
    errors.push(
      `daysPerWeek must be an integer between ${TRAINING_DAYS_PER_WEEK_LIMITS.min} and ${TRAINING_DAYS_PER_WEEK_LIMITS.max}`,
    );
  }

  if (
    !isIntegerInRange(
      profile.sessionDurationMinutes,
      SESSION_DURATION_MINUTES_LIMITS.min,
      SESSION_DURATION_MINUTES_LIMITS.max,
    )
  ) {
    errors.push(
      `sessionDurationMinutes must be an integer between ${SESSION_DURATION_MINUTES_LIMITS.min} and ${SESSION_DURATION_MINUTES_LIMITS.max}`,
    );
  }

  if (profile.movementRestrictions.some((restriction) => restriction.trim().length === 0)) {
    errors.push('movementRestrictions must not contain empty values');
  }

  return validationResultFromErrors(errors);
}
