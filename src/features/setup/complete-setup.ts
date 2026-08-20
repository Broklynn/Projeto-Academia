import {
  EXPERIENCE_LEVELS,
  TRAINING_DAYS_PER_WEEK_LIMITS,
  TRAINING_GOALS,
  validateSessionDurationMinutes,
} from '../../domain/athlete';
import { EQUIPMENT, type Equipment } from '../../domain/exercise';
import {
  isIntegerInRange,
  type ValidationResult,
} from '../../domain/validation';

import type { CompleteSetup, SetupDraft } from './setup-types';

export function completeSetupDraft(
  draft: SetupDraft,
): ValidationResult<CompleteSetup> {
  const errors: string[] = [];

  if (draft.goal === null || !TRAINING_GOALS.includes(draft.goal)) {
    errors.push('goal must be a supported training goal');
  }

  if (
    draft.experience === null ||
    !EXPERIENCE_LEVELS.includes(draft.experience)
  ) {
    errors.push('experience must be a supported experience level');
  }

  if (
    draft.daysPerWeek === null ||
    !isIntegerInRange(
      draft.daysPerWeek,
      TRAINING_DAYS_PER_WEEK_LIMITS.min,
      TRAINING_DAYS_PER_WEEK_LIMITS.max,
    )
  ) {
    errors.push(
      `daysPerWeek must be an integer between ${TRAINING_DAYS_PER_WEEK_LIMITS.min} and ${TRAINING_DAYS_PER_WEEK_LIMITS.max}`,
    );
  }

  if (draft.sessionDurationMinutes === null) {
    errors.push('sessionDurationMinutes must be informed');
  } else {
    const durationValidation = validateSessionDurationMinutes(
      draft.sessionDurationMinutes,
    );
    if (!durationValidation.valid) {
      errors.push(...durationValidation.errors);
    }
  }

  const seenEquipment = new Set<Equipment>();
  draft.availableEquipment.forEach((equipment, index) => {
    if (!EQUIPMENT.includes(equipment)) {
      errors.push(`availableEquipment[${index}] is not supported`);
      return;
    }
    if (seenEquipment.has(equipment)) {
      errors.push(`availableEquipment contains duplicate ${equipment}`);
      return;
    }
    seenEquipment.add(equipment);
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      availableEquipment: [...draft.availableEquipment],
      daysPerWeek: draft.daysPerWeek!,
      experience: draft.experience!,
      goal: draft.goal!,
      sessionDurationMinutes: draft.sessionDurationMinutes!,
    },
  };
}
