import type {
  Equipment,
  Exercise,
  ExerciseId,
  MovementPattern,
  MuscleGroup,
} from '../../domain/exercise';

import { EXERCISE_CATALOG } from './catalog';

const exerciseCatalog: readonly Readonly<Exercise>[] = EXERCISE_CATALOG;

export function getExerciseById(id: ExerciseId): Readonly<Exercise> | undefined {
  return exerciseCatalog.find((exercise) => exercise.id === id);
}

export function getExercisesByPrimaryMuscle(
  muscle: MuscleGroup,
): readonly Readonly<Exercise>[] {
  return exerciseCatalog.filter((exercise) => exercise.primaryMuscles.includes(muscle));
}

export function getExercisesByEquipment(
  equipment: Equipment,
): readonly Readonly<Exercise>[] {
  return exerciseCatalog.filter((exercise) => exercise.equipment.includes(equipment));
}

export function getExercisesByMovementPattern(
  movementPattern: MovementPattern,
): readonly Readonly<Exercise>[] {
  return exerciseCatalog.filter(
    (exercise) => exercise.movementPattern === movementPattern,
  );
}

export function getExercisesAvailableWithEquipment(
  availableEquipment: readonly Equipment[],
): readonly Readonly<Exercise>[] {
  return exerciseCatalog.filter((exercise) =>
    exercise.equipment.every((requiredEquipment) =>
      availableEquipment.includes(requiredEquipment),
    ),
  );
}
