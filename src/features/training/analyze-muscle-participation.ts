import type { MovementPattern, MuscleGroup } from '../../domain/exercise';

import {
  analyzeWeeklyMuscleCoverage,
  type MuscleExerciseOccurrence,
} from './analyze-muscle-coverage';
import type { TrainingWeekSelection } from './build-training-selection';

export interface MuscleParticipation {
  readonly muscle: MuscleGroup;
  readonly directDayCount: number;
  readonly indirectDayCount: number;
  readonly directExerciseOccurrenceCount: number;
  readonly indirectExerciseOccurrenceCount: number;
  readonly directOccurrences: readonly MuscleExerciseOccurrence[];
  readonly indirectOccurrences: readonly MuscleExerciseOccurrence[];
  readonly directMovementPatterns: readonly MovementPattern[];
  readonly indirectMovementPatterns: readonly MovementPattern[];
}

export interface WeeklyMuscleParticipationAnalysis {
  readonly muscles: readonly MuscleParticipation[];
  readonly musclesWithoutDirectWork: readonly MuscleGroup[];
  readonly musclesWithoutAnyParticipation: readonly MuscleGroup[];
}

export function analyzeWeeklyMuscleParticipation(
  week: TrainingWeekSelection,
): WeeklyMuscleParticipationAnalysis {
  const directAnalysis = analyzeWeeklyMuscleCoverage(week);
  const muscles = directAnalysis.muscles.map(
    (directCoverage): MuscleParticipation => {
      const muscle = directCoverage.muscle;
      const indirectDayIndexes = new Set<number>();
      const indirectOccurrences: MuscleExerciseOccurrence[] = [];
      const indirectMovementPatterns: MovementPattern[] = [];

      week.days.forEach((daySelection, dayIndex) => {
        for (const exercise of daySelection.exercises) {
          if (!exercise.secondaryMuscles.includes(muscle)) {
            continue;
          }

          indirectDayIndexes.add(dayIndex);
          indirectOccurrences.push({
            dayOrder: daySelection.day.order,
            dayName: daySelection.day.name,
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            movementPattern: exercise.movementPattern,
          });

          if (!indirectMovementPatterns.includes(exercise.movementPattern)) {
            indirectMovementPatterns.push(exercise.movementPattern);
          }
        }
      });

      return {
        muscle,
        directDayCount: directCoverage.dayCount,
        indirectDayCount: indirectDayIndexes.size,
        directExerciseOccurrenceCount: directCoverage.exerciseOccurrenceCount,
        indirectExerciseOccurrenceCount: indirectOccurrences.length,
        directOccurrences: directCoverage.occurrences,
        indirectOccurrences,
        directMovementPatterns: directCoverage.movementPatterns,
        indirectMovementPatterns,
      };
    },
  );

  return {
    muscles,
    musclesWithoutDirectWork: muscles
      .filter((participation) => participation.directExerciseOccurrenceCount === 0)
      .map((participation) => participation.muscle),
    musclesWithoutAnyParticipation: muscles
      .filter(
        (participation) =>
          participation.directExerciseOccurrenceCount === 0 &&
          participation.indirectExerciseOccurrenceCount === 0,
      )
      .map((participation) => participation.muscle),
  };
}
