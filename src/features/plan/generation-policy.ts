import type {
  AccessoryExerciseConstraints,
  DirectSetAllocationConstraints,
  SessionDurationModel,
} from '../training';

// Product-reference caps for this first executable plan. They are technical
// defaults for deterministic allocation, not universal or optimal physiology.
export const PLAN_SET_CONSTRAINTS = {
  maxSetsPerExerciseOccurrence: 4,
} as const satisfies DirectSetAllocationConstraints;

export const PLAN_ACCESSORY_CONSTRAINTS = {
  maxAdditionalExercisesPerDay: 2,
} as const satisfies AccessoryExerciseConstraints;

// This abstract budgeting model estimates allocation capacity only. It is not
// literal session timing and deliberately does not reuse V17 restSeconds.
export const PLAN_DURATION_MODEL = {
  minutesPerSet: 2,
  minutesPerExerciseOverhead: 1.5,
} as const satisfies SessionDurationModel;
