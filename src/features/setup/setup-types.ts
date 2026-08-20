import type { ExperienceLevel, TrainingDaysPerWeek, TrainingGoal } from '@/domain/athlete';
import type { Equipment } from '@/domain/exercise';

export interface SetupDraft {
  availableEquipment: Equipment[];
  daysPerWeek: TrainingDaysPerWeek | null;
  experience: ExperienceLevel | null;
  goal: TrainingGoal | null;
  sessionDurationMinutes: number | null;
}

export type SetupStep = 1 | 2 | 3 | 4 | 5;
export type SetupView = SetupStep | 'summary';

export const INITIAL_SETUP_DRAFT: SetupDraft = {
  availableEquipment: [],
  daysPerWeek: null,
  experience: null,
  goal: null,
  sessionDurationMinutes: null,
};
