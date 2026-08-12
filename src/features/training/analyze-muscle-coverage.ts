import {
  MUSCLE_GROUPS,
  type ExerciseId,
  type MovementPattern,
  type MuscleGroup,
} from '../../domain/exercise';

import type { TrainingWeekSelection } from './build-training-selection';

export interface MuscleExerciseOccurrence {
  readonly dayOrder: number;
  readonly dayName: string;
  readonly exerciseId: ExerciseId;
  readonly exerciseName: string;
  readonly movementPattern: MovementPattern;
}

export interface MuscleCoverage {
  readonly muscle: MuscleGroup;
  readonly dayCount: number;
  readonly exerciseOccurrenceCount: number;
  readonly occurrences: readonly MuscleExerciseOccurrence[];
  readonly movementPatterns: readonly MovementPattern[];
}

export interface WeeklyMuscleCoverageAnalysis {
  readonly muscles: readonly MuscleCoverage[];
  readonly uncoveredMuscles: readonly MuscleGroup[];
}

export function analyzeWeeklyMuscleCoverage(
  week: TrainingWeekSelection,
): WeeklyMuscleCoverageAnalysis {
  const muscles = MUSCLE_GROUPS.map((muscle): MuscleCoverage => {
    const coveredDayIndexes = new Set<number>();
    const occurrences: MuscleExerciseOccurrence[] = [];
    const movementPatterns: MovementPattern[] = [];

    week.days.forEach((daySelection, dayIndex) => {
      for (const exercise of daySelection.exercises) {
        if (!exercise.primaryMuscles.includes(muscle)) {
          continue;
        }

        coveredDayIndexes.add(dayIndex);
        occurrences.push({
          dayOrder: daySelection.day.order,
          dayName: daySelection.day.name,
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          movementPattern: exercise.movementPattern,
        });

        if (!movementPatterns.includes(exercise.movementPattern)) {
          movementPatterns.push(exercise.movementPattern);
        }
      }
    });

    return {
      muscle,
      dayCount: coveredDayIndexes.size,
      exerciseOccurrenceCount: occurrences.length,
      occurrences,
      movementPatterns,
    };
  });

  return {
    muscles,
    uncoveredMuscles: muscles
      .filter((coverage) => coverage.exerciseOccurrenceCount === 0)
      .map((coverage) => coverage.muscle),
  };
}
