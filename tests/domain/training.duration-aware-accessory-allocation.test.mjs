import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseData from '../../.expo/domain-tests/data/exercises/index.js';
import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingDomain from '../../.expo/domain-tests/domain/training/index.js';
import trainingFeature from '../../.expo/domain-tests/features/training/index.js';

const { EXERCISE_CATALOG } = exerciseData;
const { EQUIPMENT, MUSCLE_GROUPS } = exerciseDomain;
const { buildDefaultHypertrophyWeeklyVolumePolicy } = trainingDomain;
const {
  allocateWeeklyDirectSetsWithinDuration,
  augmentWeeklyDirectSetTargetsWithAccessories,
  augmentWeeklyDirectSetTargetsWithAccessoriesWithinDuration,
  buildHypertrophyTrainingSelection,
} = trainingFeature;

const ALL_EQUIPMENT = [...EQUIPMENT];
const MODEL_A = {
  minutesPerSet: 1.5,
  minutesPerExerciseOverhead: 1,
};
const MODEL_B = {
  minutesPerSet: 2,
  minutesPerExerciseOverhead: 1.5,
};

function buildWeek(availableEquipment = ALL_EQUIPMENT) {
  return buildHypertrophyTrainingSelection({
    daysPerWeek: 4,
    availableEquipment,
  });
}

function policyWithTargets(defaultTarget, overrides = {}) {
  return {
    goal: 'hypertrophy',
    muscleTargets: MUSCLE_GROUPS.map((muscle) => ({
      muscle,
      targetSetsPerWeek: overrides[muscle] ?? defaultTarget,
    })),
  };
}

function requireValid(result) {
  assert.equal(result.valid, true, result.valid ? undefined : result.errors.join('\n'));
  return result.value;
}

function assertInvalid(result, expectedErrorFragment) {
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => error.includes(expectedErrorFragment)),
    `expected an error containing "${expectedErrorFragment}"`,
  );
}

function augmentWithin(
  week,
  availableEquipment,
  sessionDurationMinutes,
  durationModel,
  maxSetsPerExerciseOccurrence = 4,
  maxAdditionalExercisesPerDay = 2,
  policy = buildDefaultHypertrophyWeeklyVolumePolicy(),
) {
  return augmentWeeklyDirectSetTargetsWithAccessoriesWithinDuration(
    week,
    availableEquipment,
    policy,
    { maxSetsPerExerciseOccurrence },
    { maxAdditionalExercisesPerDay },
    { sessionDurationMinutes, durationModel },
  );
}

function allocateWithin(
  week,
  sessionDurationMinutes,
  durationModel,
  policy = buildDefaultHypertrophyWeeklyVolumePolicy(),
) {
  return allocateWeeklyDirectSetsWithinDuration(
    week,
    policy,
    { maxSetsPerExerciseOccurrence: 4 },
    { sessionDurationMinutes, durationModel },
  );
}

function allocatedSetsFor(value, dayOrder, exerciseId) {
  return value.allocation.days
    .find((day) => day.dayOrder === dayOrder)
    ?.exercises.find((exercise) => exercise.exerciseId === exerciseId)?.sets ?? 0;
}

function additionSummary(value) {
  return value.accessoryAdditions.map((addition) => [
    addition.dayOrder,
    addition.exercise.id,
    allocatedSetsFor(value, addition.dayOrder, addition.exercise.id),
  ]);
}

function durationRows(analysis) {
  return analysis.days.map((day) => [
    day.dayOrder,
    day.allocatedExerciseCount,
    day.allocatedSetCount,
    day.estimatedDurationMinutes,
  ]);
}

function muscleSummary(analysis) {
  return Object.fromEntries(
    analysis.muscles.map((status) => [
      status.muscle,
      [
        status.targetSetsPerWeek,
        status.allocatedDirectSets,
        status.remainingSetsToTarget,
      ],
    ]),
  );
}

function assertInvariants(value) {
  assert.deepEqual(value.durationAnalysis.daysExceedingDuration, []);
  assert.deepEqual(value.volumeAnalysis.musclesAboveTarget, []);
  assert.ok(
    value.durationAnalysis.days.every(
      (day) =>
        day.estimatedDurationMinutes <= day.sessionDurationMinutes &&
        day.excessMinutes === 0 &&
        day.fitsDuration,
    ),
  );
}

test('zero accessory capacity is exactly equivalent to direct V12', () => {
  const week = buildWeek();
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const v12 = requireValid(allocateWithin(week, 60, MODEL_B, policy));
  const v13 = requireValid(
    augmentWithin(week, ALL_EQUIPMENT, 60, MODEL_B, 4, 0, policy),
  );

  assert.equal(v13.week, week);
  assert.deepEqual(v13.accessoryAdditions, []);
  assert.deepEqual(v13.allocation, v12.allocation);
  assert.deepEqual(v13.volumeAnalysis, v12.volumeAnalysis);
  assert.deepEqual(v13.durationAnalysis, v12.durationAnalysis);
});

test('matches time-unaware V10 when model A has enough time', () => {
  const week = buildWeek();
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const v10 = requireValid(
    augmentWeeklyDirectSetTargetsWithAccessories(
      week,
      ALL_EQUIPMENT,
      policy,
      { maxSetsPerExerciseOccurrence: 4 },
      { maxAdditionalExercisesPerDay: 2 },
    ),
  );
  const v13 = requireValid(
    augmentWithin(week, ALL_EQUIPMENT, 60, MODEL_A, 4, 2, policy),
  );

  assert.deepEqual(v13.week, v10.week);
  assert.deepEqual(v13.accessoryAdditions, v10.accessoryAdditions);
  assert.deepEqual(v13.allocation, v10.allocation);
  assert.deepEqual(v13.volumeAnalysis, v10.analysis);
  assert.deepEqual(additionSummary(v13), [
    [1, 'incline-barbell-bench-press', 3],
    [1, 'dumbbell-curl', 3],
    [3, 'cable-triceps-pushdown', 3],
    [2, 'seated-calf-raise', 3],
    [2, 'hanging-leg-raise', 3],
  ]);
  assert.deepEqual(durationRows(v13.durationAnalysis), [
    [1, 9, 30, 54],
    [2, 9, 29, 52.5],
    [3, 8, 20, 38],
    [4, 7, 16, 31],
  ]);
  assert.deepEqual(v13.volumeAnalysis.musclesBelowTarget, []);
  assertInvariants(v13);
});

test('improves the real model B sixty-minute week without exceeding time', () => {
  const value = requireValid(
    augmentWithin(buildWeek(), ALL_EQUIPMENT, 60, MODEL_B),
  );

  assert.deepEqual(additionSummary(value), [
    [3, 'barbell-bench-press', 3],
    [4, 'standing-calf-raise', 3],
    [2, 'hanging-leg-raise', 3],
  ]);
  assert.deepEqual(durationRows(value.durationAnalysis), [
    [1, 7, 24, 58.5],
    [2, 8, 24, 60],
    [3, 8, 22, 56],
    [4, 8, 21, 54],
  ]);
  assert.deepEqual(muscleSummary(value.volumeAnalysis), {
    chest: [10, 10, 0],
    back: [10, 10, 0],
    shoulders: [10, 10, 0],
    biceps: [10, 8, 2],
    triceps: [10, 8, 2],
    quadriceps: [10, 10, 0],
    hamstrings: [10, 10, 0],
    glutes: [10, 10, 0],
    calves: [10, 10, 0],
    abs: [10, 10, 0],
  });
  assert.deepEqual(value.volumeAnalysis.musclesBelowTarget, [
    'biceps',
    'triceps',
  ]);
  assertInvariants(value);
});

test('compares structural V12, old V10 week plus V12, and V13 in model B sixty', () => {
  const week = buildWeek();
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const structural = requireValid(allocateWithin(week, 60, MODEL_B, policy));
  const v10 = requireValid(
    augmentWeeklyDirectSetTargetsWithAccessories(
      week,
      ALL_EQUIPMENT,
      policy,
      { maxSetsPerExerciseOccurrence: 4 },
      { maxAdditionalExercisesPerDay: 2 },
    ),
  );
  const oldV10Week = requireValid(
    allocateWithin(v10.week, 60, MODEL_B, policy),
  );
  const v13 = requireValid(
    augmentWithin(week, ALL_EQUIPMENT, 60, MODEL_B, 4, 2, policy),
  );

  assert.deepEqual(structural.volumeAnalysis.musclesBelowTarget, [
    'chest', 'biceps', 'triceps', 'calves', 'abs',
  ]);
  assert.deepEqual(oldV10Week.volumeAnalysis.musclesBelowTarget, [
    'chest', 'biceps', 'calves', 'abs',
  ]);
  assert.deepEqual(v13.volumeAnalysis.musclesBelowTarget, [
    'biceps', 'triceps',
  ]);
  assert.deepEqual(durationRows(oldV10Week.durationAnalysis), [
    [1, 9, 23, 59.5],
    [2, 9, 23, 59.5],
    [3, 8, 24, 60],
    [4, 7, 18, 46.5],
  ]);
  assertInvariants(v13);
});

test('rejects the time-blocked canonical candidate and continues to a fitting day', () => {
  const week = buildWeek();
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const timeUnaware = requireValid(
    augmentWeeklyDirectSetTargetsWithAccessories(
      week,
      ALL_EQUIPMENT,
      policy,
      { maxSetsPerExerciseOccurrence: 4 },
      { maxAdditionalExercisesPerDay: 2 },
    ),
  );
  const timeAware = requireValid(
    augmentWithin(week, ALL_EQUIPMENT, 60, MODEL_B, 4, 2, policy),
  );

  assert.deepEqual(
    [
      timeUnaware.accessoryAdditions[0].dayOrder,
      timeUnaware.accessoryAdditions[0].exercise.id,
    ],
    [1, 'incline-barbell-bench-press'],
  );
  assert.ok(
    !timeAware.accessoryAdditions.some(
      (addition) =>
        addition.dayOrder === 1 &&
        addition.exercise.id === 'incline-barbell-bench-press',
    ),
  );
  assert.deepEqual(
    [
      timeAware.accessoryAdditions[0].dayOrder,
      timeAware.accessoryAdditions[0].exercise.id,
    ],
    [3, 'barbell-bench-press'],
  );
  assert.equal(
    timeAware.volumeAnalysis.muscles.find(
      (status) => status.muscle === 'chest',
    ).remainingSetsToTarget,
    0,
  );
  assertInvariants(timeAware);
});

test('adds no accessories when model B forty-five minutes is already full', () => {
  const week = buildWeek();
  const direct = requireValid(allocateWithin(week, 45, MODEL_B));
  const value = requireValid(
    augmentWithin(week, ALL_EQUIPMENT, 45, MODEL_B),
  );

  assert.deepEqual(value.accessoryAdditions, []);
  assert.deepEqual(value.allocation, direct.allocation);
  assert.deepEqual(durationRows(value.durationAnalysis), [
    [1, 7, 17, 44.5],
    [2, 7, 17, 44.5],
    [3, 7, 17, 44.5],
    [4, 7, 17, 44.5],
  ]);
  assert.deepEqual(value.volumeAnalysis.musclesBelowTarget, [
    'chest', 'biceps', 'triceps', 'calves', 'abs',
  ]);
  assertInvariants(value);
});

test('adds no accessories and keeps every day below thirty minutes in model B', () => {
  const value = requireValid(
    augmentWithin(buildWeek(), ALL_EQUIPMENT, 30, MODEL_B),
  );

  assert.deepEqual(value.accessoryAdditions, []);
  assert.deepEqual(durationRows(value.durationAnalysis), [
    [1, 7, 9, 28.5],
    [2, 7, 9, 28.5],
    [3, 7, 9, 28.5],
    [4, 7, 9, 28.5],
  ]);
  assert.deepEqual(value.volumeAnalysis.musclesBelowTarget, MUSCLE_GROUPS);
  assertInvariants(value);
});

test('respects limited equipment and reports unresolved deficits', () => {
  const equipment = ['dumbbell', 'bench', 'bodyweight'];
  const value = requireValid(
    augmentWithin(buildWeek(equipment), equipment, 60, MODEL_B),
  );

  assert.deepEqual(additionSummary(value), [
    [3, 'dumbbell-bench-press', 3],
    [3, 'dumbbell-curl', 3],
    [2, 'dumbbell-bulgarian-split-squat', 4],
    [2, 'walking-lunge', 3],
    [4, 'dumbbell-bulgarian-split-squat', 3],
  ]);
  assert.ok(
    value.accessoryAdditions.every((addition) =>
      addition.exercise.equipment.every((item) => equipment.includes(item)),
    ),
  );
  assert.deepEqual(value.volumeAnalysis.musclesBelowTarget, [
    'back', 'triceps', 'hamstrings', 'calves', 'abs',
  ]);
  assertInvariants(value);
});

test('returns an empty valid result with zero equipment', () => {
  const week = buildWeek([]);
  const value = requireValid(augmentWithin(week, [], 60, MODEL_B));

  assert.equal(value.week, week);
  assert.deepEqual(value.accessoryAdditions, []);
  assert.deepEqual(value.allocation, { days: [] });
  assert.deepEqual(value.volumeAnalysis.musclesBelowTarget, MUSCLE_GROUPS);
  assert.deepEqual(
    durationRows(value.durationAnalysis),
    week.days.map((day) => [day.day.order, 0, 0, 0]),
  );
  assertInvariants(value);
});

test('uses a custom policy without hardcoding the default target', () => {
  const policy = policyWithTargets(3);
  const value = requireValid(
    augmentWithin(buildWeek(), ALL_EQUIPMENT, 60, MODEL_B, 1, 2, policy),
  );

  assert.deepEqual(additionSummary(value), [
    [1, 'incline-barbell-bench-press', 1],
    [1, 'dumbbell-curl', 1],
    [3, 'cable-triceps-pushdown', 1],
    [2, 'seated-calf-raise', 1],
    [2, 'hanging-leg-raise', 1],
  ]);
  assert.ok(
    value.volumeAnalysis.muscles.every(
      (status) =>
        status.targetSetsPerWeek === 3 &&
        status.allocatedDirectSets === 3,
    ),
  );
  assert.deepEqual(value.volumeAnalysis.musclesBelowTarget, []);
  assertInvariants(value);
});

test('preserves canonical order, same-day uniqueness, and missing patterns', () => {
  const week = buildWeek();
  const value = requireValid(
    augmentWithin(week, ALL_EQUIPMENT, 60, MODEL_B),
  );

  value.week.days.forEach((daySelection, dayIndex) => {
    const ids = daySelection.exercises.map((exercise) => exercise.id);

    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(
      ids.slice(0, week.days[dayIndex].exercises.length),
      week.days[dayIndex].exercises.map((exercise) => exercise.id),
    );
    assert.deepEqual(
      daySelection.missingPatterns,
      week.days[dayIndex].missingPatterns,
    );
  });
  assert.ok(
    week.days[0].exercises.some(
      (exercise) => exercise.id === 'barbell-bench-press',
    ),
  );
  assert.ok(
    value.week.days[2].exercises.some(
      (exercise) => exercise.id === 'barbell-bench-press',
    ),
  );
});

test('propagates accessory, V12, policy, and duration validation errors', () => {
  for (const accessoryCap of [
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    assertInvalid(
      augmentWithin(buildWeek(), ALL_EQUIPMENT, 60, MODEL_B, 4, accessoryCap),
      'maxAdditionalExercisesPerDay must be a non-negative integer',
    );
  }

  assertInvalid(
    augmentWithin(buildWeek(), ALL_EQUIPMENT, 60, MODEL_B, 0),
    'maxSetsPerExerciseOccurrence must be a positive integer',
  );
  assertInvalid(
    augmentWithin(buildWeek(), ALL_EQUIPMENT, 29, MODEL_B),
    'sessionDurationMinutes must be an integer between 30 and 120',
  );
  assertInvalid(
    augmentWithin(buildWeek(), ALL_EQUIPMENT, 60, {
      minutesPerSet: 0,
      minutesPerExerciseOverhead: 1,
    }),
    'minutesPerSet must be a positive finite number',
  );
  assertInvalid(
    augmentWithin(
      buildWeek(),
      ALL_EQUIPMENT,
      60,
      MODEL_B,
      4,
      2,
      policyWithTargets(10, { chest: 0 }),
    ),
    'targetSetsPerWeek for chest must be a positive integer',
  );
});

test('is deterministic and does not mutate inputs, catalog, or muscle groups', () => {
  const week = buildWeek();
  const equipment = [...ALL_EQUIPMENT];
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const setConstraints = { maxSetsPerExerciseOccurrence: 4 };
  const accessoryConstraints = { maxAdditionalExercisesPerDay: 2 };
  const durationConstraint = {
    sessionDurationMinutes: 60,
    durationModel: { ...MODEL_B },
  };
  const snapshots = [
    JSON.stringify(week),
    JSON.stringify(equipment),
    JSON.stringify(policy),
    JSON.stringify(setConstraints),
    JSON.stringify(accessoryConstraints),
    JSON.stringify(durationConstraint),
    JSON.stringify(EXERCISE_CATALOG),
    JSON.stringify(MUSCLE_GROUPS),
  ];
  const first = augmentWeeklyDirectSetTargetsWithAccessoriesWithinDuration(
    week,
    equipment,
    policy,
    setConstraints,
    accessoryConstraints,
    durationConstraint,
  );
  const second = augmentWeeklyDirectSetTargetsWithAccessoriesWithinDuration(
    week,
    equipment,
    policy,
    setConstraints,
    accessoryConstraints,
    durationConstraint,
  );

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.deepEqual(
    [
      JSON.stringify(week),
      JSON.stringify(equipment),
      JSON.stringify(policy),
      JSON.stringify(setConstraints),
      JSON.stringify(accessoryConstraints),
      JSON.stringify(durationConstraint),
      JSON.stringify(EXERCISE_CATALOG),
      JSON.stringify(MUSCLE_GROUPS),
    ],
    snapshots,
  );
});
