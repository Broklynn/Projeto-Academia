import type { Equipment, Exercise } from '../../domain/exercise';
import type { TrainingSplitDay } from '../../domain/training';

import { getExercisesAvailableWithEquipment } from './queries';

export function getExerciseCandidatesForSplitDay(
  day: TrainingSplitDay,
  availableEquipment: readonly Equipment[],
): readonly Readonly<Exercise>[] {
  return getExercisesAvailableWithEquipment(availableEquipment).filter((exercise) =>
    exercise.primaryMuscles.some((muscle) => day.targetMuscles.includes(muscle)),
  );
}
