import type { Equipment, Exercise, ExerciseId } from '../../domain/exercise';

import {
  getExerciseById,
  getExercisesAvailableWithEquipment,
} from './queries';

function sharesPrimaryMuscle(
  reference: Readonly<Exercise>,
  candidate: Readonly<Exercise>,
): boolean {
  return reference.primaryMuscles.some((muscle) =>
    candidate.primaryMuscles.includes(muscle),
  );
}

export function getExerciseSubstitutes(
  exerciseId: ExerciseId,
  availableEquipment: readonly Equipment[],
): readonly Readonly<Exercise>[] {
  const reference = getExerciseById(exerciseId);

  if (!reference) {
    return [];
  }

  return getExercisesAvailableWithEquipment(availableEquipment).filter(
    (candidate) =>
      candidate.id !== reference.id &&
      candidate.movementPattern === reference.movementPattern &&
      sharesPrimaryMuscle(reference, candidate),
  );
}
