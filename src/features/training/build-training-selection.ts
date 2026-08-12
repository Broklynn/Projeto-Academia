import type { TrainingDaysPerWeek } from '../../domain/athlete';
import type { Equipment, Exercise, MovementPattern } from '../../domain/exercise';
import {
  buildHypertrophySplit,
  type TrainingSplit,
  type TrainingSplitDay,
} from '../../domain/training';
import { selectExercisesForSplitDay } from '../../data/exercises';

export interface BuildHypertrophyTrainingSelectionInput {
  readonly daysPerWeek: TrainingDaysPerWeek;
  readonly availableEquipment: readonly Equipment[];
}

export interface TrainingDaySelection {
  readonly day: TrainingSplitDay;
  readonly exercises: readonly Readonly<Exercise>[];
  readonly missingPatterns: readonly MovementPattern[];
}

export interface TrainingWeekSelection {
  readonly split: TrainingSplit;
  readonly days: readonly TrainingDaySelection[];
}

export function buildHypertrophyTrainingSelection(
  input: BuildHypertrophyTrainingSelectionInput,
): TrainingWeekSelection {
  const split = buildHypertrophySplit(input.daysPerWeek);

  return {
    split,
    days: split.days.map((day): TrainingDaySelection => {
      const selection = selectExercisesForSplitDay(
        day,
        input.availableEquipment,
      );

      return {
        day,
        exercises: selection.exercises,
        missingPatterns: selection.missingPatterns,
      };
    }),
  };
}
