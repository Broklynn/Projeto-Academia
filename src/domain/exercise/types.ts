export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
] as const;

export const EQUIPMENT = [
  'bodyweight',
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bench',
  'pullup_bar',
  'smith_machine',
] as const;

export const MOVEMENT_PATTERNS = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'horizontal_adduction',
  'horizontal_abduction',
  'shoulder_abduction',
  'squat',
  'hinge',
  'lunge',
  'knee_extension',
  'knee_flexion',
  'hip_extension',
  'elbow_flexion',
  'elbow_extension',
  'calf_raise',
  'core',
] as const;

export type ExerciseId = string;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
export type Equipment = (typeof EQUIPMENT)[number];
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export interface Exercise {
  id: ExerciseId;
  name: string;
  primaryMuscles: readonly [MuscleGroup, ...MuscleGroup[]];
  secondaryMuscles: readonly MuscleGroup[];
  equipment: readonly [Equipment, ...Equipment[]];
  movementPattern: MovementPattern;
  isCompound: boolean;
  isUnilateral: boolean;
}
