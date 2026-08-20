import type {
  ExperienceLevel,
  TrainingDaysPerWeek,
} from '../../domain/athlete';
import type { ExerciseId } from '../../domain/exercise';

export interface GeneratedExercise {
  readonly exerciseId: ExerciseId;
  readonly name: string;
  readonly sets: number;
  readonly isAccessory: boolean;
}

export interface GeneratedTrainingDay {
  readonly order: number;
  readonly name: string;
  readonly exerciseCount: number;
  readonly totalSets: number;
  readonly exercises: readonly GeneratedExercise[];
}

export interface GeneratedTrainingPlan {
  readonly goal: 'hypertrophy';
  readonly experience: ExperienceLevel;
  readonly daysPerWeek: TrainingDaysPerWeek;
  readonly requestedSessionDurationMinutes: number;
  readonly totalSets: number;
  readonly days: readonly GeneratedTrainingDay[];
}
