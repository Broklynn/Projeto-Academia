import type {
  AthleteId,
  TrainingDaysPerWeek,
  TrainingGoal,
} from '../athlete/types';
import type { ExerciseId, MuscleGroup } from '../exercise/types';
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

export const SPLIT_TYPES = [
  'full_body',
  'upper_lower',
  'upper_lower_push_pull_legs',
  'push_pull_legs',
] as const;

export const SPLIT_FOCUSES = [
  'full_body',
  'upper',
  'lower',
  'push',
  'pull',
  'legs',
] as const;

export type WorkoutPlanId = string;
export type WorkoutDayId = string;
export type WorkoutExerciseId = string;
export type WorkoutSessionId = string;
export type Rir = 0 | 1 | 2 | 3 | 4 | 5;
export type Weekday = (typeof WEEKDAYS)[number];
export type SplitType = (typeof SPLIT_TYPES)[number];
export type SplitFocus = (typeof SPLIT_FOCUSES)[number];

export interface TrainingSplitDay {
  readonly order: number;
  readonly name: string;
  readonly focus: SplitFocus;
  readonly targetMuscles: readonly MuscleGroup[];
}

export interface TrainingSplit {
  readonly type: SplitType;
  readonly daysPerWeek: TrainingDaysPerWeek;
  readonly days: readonly TrainingSplitDay[];
}

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
