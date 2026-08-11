import type { AthleteId, TrainingGoal } from '../athlete/types';
import type { ExerciseId } from '../exercise/types';
import type { IsoDateTimeString } from '../types';

export const RIR_LIMITS = {
  min: 0,
  max: 5,
} as const;

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type WorkoutPlanId = string;
export type WorkoutDayId = string;
export type WorkoutExerciseId = string;
export type WorkoutSessionId = string;
export type Rir = 0 | 1 | 2 | 3 | 4 | 5;
export type Weekday = (typeof WEEKDAYS)[number];

export interface RepRange {
  min: number;
  max: number;
}

export interface WorkoutExercise {
  id: WorkoutExerciseId;
  exerciseId: ExerciseId;
  order: number;
  sets: number;
  repRange: RepRange;
  restSeconds: number;
  targetRir: Rir;
  notes?: string;
}

export interface WorkoutDay {
  id: WorkoutDayId;
  name: string;
  order: number;
  scheduledWeekday?: Weekday;
  exercises: readonly WorkoutExercise[];
}

export interface WorkoutPlan {
  id: WorkoutPlanId;
  athleteId: AthleteId;
  name: string;
  goal: TrainingGoal;
  days: readonly WorkoutDay[];
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface SetPerformance {
  setNumber: number;
  weightKg: number;
  reps: number;
  rir: Rir;
  completed: boolean;
}

export interface ExercisePerformance {
  workoutExerciseId: WorkoutExerciseId;
  exerciseId: ExerciseId;
  order: number;
  sets: readonly SetPerformance[];
  notes?: string;
}

export interface WorkoutSession {
  id: WorkoutSessionId;
  workoutPlanId: WorkoutPlanId;
  workoutDayId: WorkoutDayId;
  athleteId: AthleteId;
  startedAt: IsoDateTimeString;
  completedAt: IsoDateTimeString | null;
  exercises: readonly ExercisePerformance[];
  notes?: string;
}

export type ProgressionAction =
  | 'keep_weight'
  | 'increase_weight'
  | 'decrease_weight'
  | 'increase_reps'
  | 'deload';

export interface ProgressionInput {
  prescription: WorkoutExercise;
  recentPerformances: readonly ExercisePerformance[];
}

export interface ProgressionRecommendation {
  action: ProgressionAction;
  recommendedWeightKg?: number;
  recommendedRepRange?: RepRange;
  reason: string;
}
