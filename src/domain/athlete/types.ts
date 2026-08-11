import type { Equipment, MuscleGroup } from '../exercise/types';
import type { IsoDateTimeString } from '../types';

export const TRAINING_GOALS = ['hypertrophy', 'strength', 'general_fitness'] as const;
export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

export const TRAINING_DAYS_PER_WEEK_LIMITS = {
  min: 2,
  max: 6,
} as const;

export const SESSION_DURATION_MINUTES_LIMITS = {
  min: 30,
  max: 120,
} as const;

export type AthleteId = string;
export type TrainingGoal = (typeof TRAINING_GOALS)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type TrainingDaysPerWeek = 2 | 3 | 4 | 5 | 6;
export type MovementRestriction = string;

export interface TrainingPreferences {
  goal: TrainingGoal;
  daysPerWeek: TrainingDaysPerWeek;
  sessionDurationMinutes: number;
  availableEquipment: readonly Equipment[];
  priorityMuscles: readonly MuscleGroup[];
  movementRestrictions: readonly MovementRestriction[];
}

export interface AthleteProfile extends TrainingPreferences {
  id: AthleteId;
  displayName: string;
  experienceLevel: ExperienceLevel;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
