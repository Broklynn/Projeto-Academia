import type { Equipment, Exercise, MovementPattern } from '../../domain/exercise';
import type { SplitFocus, TrainingSplitDay } from '../../domain/training';

import { getExerciseCandidatesForSplitDay } from './candidates';

const LOWER_BODY_PATTERNS = [
  'squat',
  'hinge',
  'knee_extension',
  'knee_flexion',
  'hip_extension',
  'calf_raise',
  'core',
] as const satisfies readonly MovementPattern[];

const REQUIRED_PATTERNS_BY_FOCUS = {
  full_body: [
    'horizontal_push',
    'horizontal_pull',
    'vertical_pull',
    'squat',
    'hinge',
    'calf_raise',
    'core',
  ],
  upper: [
    'horizontal_push',
    'horizontal_pull',
    'vertical_push',
    'vertical_pull',
    'shoulder_abduction',
    'elbow_flexion',
    'elbow_extension',
  ],
  lower: LOWER_BODY_PATTERNS,
  push: [
    'horizontal_push',
    'vertical_push',
    'shoulder_abduction',
    'elbow_extension',
  ],
  pull: ['vertical_pull', 'horizontal_pull', 'elbow_flexion'],
  legs: LOWER_BODY_PATTERNS,
} as const satisfies Readonly<Record<SplitFocus, readonly MovementPattern[]>>;

export interface ExerciseSelectionResult {
  readonly exercises: readonly Readonly<Exercise>[];
  readonly missingPatterns: readonly MovementPattern[];
}

export function getRequiredMovementPatternsForFocus(
  focus: SplitFocus,
): readonly MovementPattern[] {
  return [...REQUIRED_PATTERNS_BY_FOCUS[focus]];
}

export function selectExercisesForSplitDay(
  day: TrainingSplitDay,
  availableEquipment: readonly Equipment[],
): ExerciseSelectionResult {
  const candidates = getExerciseCandidatesForSplitDay(day, availableEquipment);
  const selectedExerciseIds = new Set<string>();
  const exercises: Readonly<Exercise>[] = [];
  const missingPatterns: MovementPattern[] = [];

  for (const movementPattern of REQUIRED_PATTERNS_BY_FOCUS[day.focus]) {
    const exercise = candidates.find(
      (candidate) =>
        candidate.movementPattern === movementPattern &&
        !selectedExerciseIds.has(candidate.id),
    );

    if (exercise) {
      exercises.push(exercise);
      selectedExerciseIds.add(exercise.id);
    } else {
      missingPatterns.push(movementPattern);
    }
  }

  return { exercises, missingPatterns };
}
