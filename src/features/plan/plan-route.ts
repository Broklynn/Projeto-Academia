import {
  EXPERIENCE_LEVELS,
  TRAINING_GOALS,
  type ExperienceLevel,
  type TrainingGoal,
} from '../../domain/athlete';
import { EQUIPMENT, type Equipment } from '../../domain/exercise';
import type { ValidationResult } from '../../domain/validation';
import { completeSetupDraft } from '../setup/complete-setup';
import type { CompleteSetup, SetupDraft } from '../setup/setup-types';

export interface PlanRouteParams {
  readonly goal?: string | readonly string[];
  readonly experience?: string | readonly string[];
  readonly days?: string | readonly string[];
  readonly duration?: string | readonly string[];
  readonly equipment?: string | readonly string[];
}

export function serializeEquipment(
  availableEquipment: readonly Equipment[],
): string {
  const selected = new Set(availableEquipment);
  return EQUIPMENT.filter((equipment) => selected.has(equipment)).join(',');
}

function scalar(
  value: string | readonly string[] | undefined,
): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function parsePlanRouteParams(
  params: PlanRouteParams,
): ValidationResult<CompleteSetup> {
  const goalValue = scalar(params.goal);
  const experienceValue = scalar(params.experience);
  const daysValue = scalar(params.days);
  const durationValue = scalar(params.duration);
  const equipmentValue = scalar(params.equipment);
  const routeErrors: string[] = [];

  if (params.goal !== undefined && goalValue === undefined) {
    routeErrors.push('goal must be a single value');
  }
  if (params.experience !== undefined && experienceValue === undefined) {
    routeErrors.push('experience must be a single value');
  }
  if (params.days !== undefined && daysValue === undefined) {
    routeErrors.push('days must be a single value');
  }
  if (params.duration !== undefined && durationValue === undefined) {
    routeErrors.push('duration must be a single value');
  }
  if (params.equipment !== undefined && equipmentValue === undefined) {
    routeErrors.push('equipment must be a single value');
  }

  const equipmentParts = equipmentValue?.split(',') ?? [];
  if (equipmentParts.length === 0 || equipmentParts.some((item) => item === '')) {
    routeErrors.push('equipment must contain at least one supported item');
  }

  const draft: SetupDraft = {
    goal:
      goalValue && TRAINING_GOALS.includes(goalValue as TrainingGoal)
        ? (goalValue as TrainingGoal)
        : null,
    experience:
      experienceValue &&
      EXPERIENCE_LEVELS.includes(experienceValue as ExperienceLevel)
        ? (experienceValue as ExperienceLevel)
        : null,
    daysPerWeek:
      daysValue !== undefined && /^\d+$/.test(daysValue)
        ? (Number(daysValue) as SetupDraft['daysPerWeek'])
        : null,
    sessionDurationMinutes:
      durationValue !== undefined && /^\d+$/.test(durationValue)
        ? Number(durationValue)
        : null,
    availableEquipment: equipmentParts.filter((item) => item !== '') as Equipment[],
  };
  const completion = completeSetupDraft(draft);

  if (routeErrors.length > 0 || !completion.valid) {
    return {
      valid: false,
      errors: [
        ...routeErrors,
        ...(completion.valid ? [] : completion.errors),
      ],
    };
  }

  return completion;
}
