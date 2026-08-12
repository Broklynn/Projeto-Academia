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
  allocateWeeklyDirectSets,
  augmentWeeklyDirectSetTargetsWithAccessories,
  buildHypertrophyTrainingSelection,
} = trainingFeature;

const ALL_EQUIPMENT = [...EQUIPMENT];

function buildWeek(daysPerWeek = 4, availableEquipment = ALL_EQUIPMENT) {
  return buildHypertrophyTrainingSelection({ daysPerWeek, availableEquipment });
}

function requireValid(result) {
  assert.equal(result.valid, true, result.valid ? undefined : result.errors.join('\n'));
  return result.value;
}

function augment(
  week,
  availableEquipment,
  maxSetsPerExerciseOccurrence,
  maxAdditionalExercisesPerDay,
  policy = buildDefaultHypertrophyWeeklyVolumePolicy(),
) {
  return augmentWeeklyDirectSetTargetsWithAccessories(
    week,
    availableEquipment,
    policy,
    { maxSetsPerExerciseOccurrence },
    { maxAdditionalExercisesPerDay },
  );
}

function assertInvalid(result, expectedErrorFragment) {
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => error.includes(expectedErrorFragment)),
    `expected an error containing "${expectedErrorFragment}"`,
  );
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

function statusSummary(analysis) {
  return Object.fromEntries(
    analysis.muscles.map((status) => [
      status.muscle,
      [
        status.targetSetsPerWeek,
        status.allocatedDirectSets,
        status.remainingSetsToTarget,
        status.excessSetsAboveTarget,
      ],
    ]),
  );
}

test('zero accessory capacity is equivalent to V9', () => {
  const week = buildWeek();
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const v9 = requireValid(
    allocateWeeklyDirectSets(week, policy, {
      maxSetsPerExerciseOccurrence: 4,
    }),
  );
  const v10 = requireValid(augment(week, ALL_EQUIPMENT, 4, 0, policy));

  assert.equal(v10.week, week);
  assert.deepEqual(v10.accessoryAdditions, []);
  assert.deepEqual(v10.allocation, v9.allocation);
  assert.deepEqual(v10.analysis, v9.analysis);
  assert.deepEqual(v10.analysis.musclesBelowTarget, [
    'chest',
    'biceps',
    'triceps',
    'calves',
    'abs',
  ]);
  assert.deepEqual(v10.analysis.muscles.map((status) => status.muscle), MUSCLE_GROUPS);
});

test('rejects invalid accessory capacities while accepting zero', () => {
  for (const accessoryCap of [
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    assertInvalid(
      augment(buildWeek(), ALL_EQUIPMENT, 4, accessoryCap),
      'maxAdditionalExercisesPerDay must be a non-negative integer',
    );
  }

  assert.equal(augment(buildWeek(), ALL_EQUIPMENT, 4, 0).valid, true);
});

test('propagates invalid policy and V9 set constraint errors', () => {
  assertInvalid(
    augment(
      buildWeek(),
      ALL_EQUIPMENT,
      4,
      1,
      policyWithTargets(10, { chest: 0 }),
    ),
    'targetSetsPerWeek for chest must be a positive integer',
  );
  assertInvalid(
    augment(buildWeek(), ALL_EQUIPMENT, 0, 1),
    'maxSetsPerExerciseOccurrence must be a positive integer',
  );
});

test('cap four with one accessory per day resolves four deficits in canonical order', () => {
  const value = requireValid(augment(buildWeek(), ALL_EQUIPMENT, 4, 1));

  assert.deepEqual(additionSummary(value), [
    [1, 'incline-barbell-bench-press', 3],
    [3, 'barbell-curl', 3],
    [2, 'seated-calf-raise', 3],
    [4, 'cable-crunch', 3],
  ]);
  assert.deepEqual(value.analysis.musclesBelowTarget, ['triceps']);
  assert.deepEqual(
    statusSummary(value.analysis),
    {
      chest: [10, 10, 0, 0],
      back: [10, 10, 0, 0],
      shoulders: [10, 10, 0, 0],
      biceps: [10, 10, 0, 0],
      triceps: [10, 8, 2, 0],
      quadriceps: [10, 10, 0, 0],
      hamstrings: [10, 10, 0, 0],
      glutes: [10, 10, 0, 0],
      calves: [10, 10, 0, 0],
      abs: [10, 10, 0, 0],
    },
  );
});

test('cap four with two accessories per day reaches every target with five additions', () => {
  const value = requireValid(augment(buildWeek(), ALL_EQUIPMENT, 4, 2));

  assert.deepEqual(additionSummary(value), [
    [1, 'incline-barbell-bench-press', 3],
    [1, 'dumbbell-curl', 3],
    [3, 'cable-triceps-pushdown', 3],
    [2, 'seated-calf-raise', 3],
    [2, 'hanging-leg-raise', 3],
  ]);
  assert.deepEqual(
    statusSummary(value.analysis),
    Object.fromEntries(MUSCLE_GROUPS.map((muscle) => [muscle, [10, 10, 0, 0]])),
  );
  assert.deepEqual(value.analysis.musclesBelowTarget, []);
  assert.ok(
    value.accessoryAdditions.every(
      (addition) =>
        allocatedSetsFor(value, addition.dayOrder, addition.exercise.id) >= 1,
    ),
  );
});

test('cap three with two accessories per day leaves biceps and triceps at nine', () => {
  const value = requireValid(augment(buildWeek(), ALL_EQUIPMENT, 3, 2));

  assert.deepEqual(additionSummary(value), [
    [1, 'incline-barbell-bench-press', 3],
    [1, 'dumbbell-curl', 3],
    [3, 'cable-triceps-pushdown', 3],
    [2, 'seated-calf-raise', 3],
    [2, 'hanging-leg-raise', 3],
    [3, 'barbell-bench-press', 2],
    [4, 'standing-calf-raise', 2],
    [4, 'cable-crunch', 2],
  ]);
  assert.deepEqual(value.analysis.musclesBelowTarget, ['biceps', 'triceps']);
  assert.equal(statusSummary(value.analysis).biceps[1], 9);
  assert.equal(statusSummary(value.analysis).triceps[1], 9);
});

test('compares cap five alone with cap four and accessories structurally', () => {
  const week = buildWeek();
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const capFive = requireValid(
    allocateWeeklyDirectSets(week, policy, {
      maxSetsPerExerciseOccurrence: 5,
    }),
  );
  const capFourAccessories = requireValid(
    augment(week, ALL_EQUIPMENT, 4, 2, policy),
  );
  const originalExerciseCount = week.days.reduce(
    (total, day) => total + day.exercises.length,
    0,
  );

  assert.deepEqual(capFive.analysis.musclesBelowTarget, []);
  assert.deepEqual(capFourAccessories.analysis.musclesBelowTarget, []);
  assert.equal(
    Math.max(
      ...capFive.allocation.days.flatMap((day) =>
        day.exercises.map((exercise) => exercise.sets),
      ),
    ),
    5,
  );
  assert.equal(
    Math.max(
      ...capFourAccessories.allocation.days.flatMap((day) =>
        day.exercises.map((exercise) => exercise.sets),
      ),
    ),
    4,
  );
  assert.equal(originalExerciseCount, 28);
  assert.equal(capFourAccessories.accessoryAdditions.length, 5);
  assert.equal(
    capFourAccessories.week.days.reduce(
      (total, day) => total + day.exercises.length,
      0,
    ),
    33,
  );
});

test('accepts useful multi-primary accessories without assigning a bonus', () => {
  const equipment = ['dumbbell', 'bench', 'bodyweight'];
  const value = requireValid(augment(buildWeek(4, equipment), equipment, 4, 2));

  assert.deepEqual(
    value.accessoryAdditions
      .filter((addition) => addition.exercise.primaryMuscles.length > 1)
      .map((addition) => [
        addition.dayOrder,
        addition.exercise.id,
        allocatedSetsFor(value, addition.dayOrder, addition.exercise.id),
      ]),
    [
      [2, 'dumbbell-bulgarian-split-squat', 4],
      [2, 'walking-lunge', 3],
      [4, 'dumbbell-bulgarian-split-squat', 3],
    ],
  );
  assert.equal(statusSummary(value.analysis).quadriceps[1], 10);
  assert.equal(statusSummary(value.analysis).glutes[1], 10);
});

test('rejects blocked multi-primary candidates and continues to a useful candidate', () => {
  const baseWeek = buildWeek();
  const lowerDay = baseWeek.days[1];
  const hipThrust = lowerDay.exercises.find(
    (exercise) => exercise.id === 'barbell-hip-thrust',
  );
  const week = {
    ...baseWeek,
    days: [{
      ...lowerDay,
      exercises: [hipThrust],
    }],
  };
  const policy = policyWithTargets(1, { hamstrings: 2 });
  const value = requireValid(augment(week, ALL_EQUIPMENT, 2, 5, policy));
  const addedIds = value.accessoryAdditions.map(
    (addition) => addition.exercise.id,
  );

  assert.ok(!addedIds.includes('barbell-romanian-deadlift'));
  assert.ok(!addedIds.includes('barbell-conventional-deadlift'));
  assert.ok(addedIds.includes('lying-leg-curl'));
  assert.equal(allocatedSetsFor(value, 2, 'lying-leg-curl'), 2);
  assert.equal(statusSummary(value.analysis).hamstrings[2], 0);
  assert.equal(statusSummary(value.analysis).glutes[3], 0);
});

test('skips same-day duplicates, permits weekly repetition, and preserves order', () => {
  const week = buildWeek();
  const value = requireValid(augment(week, ALL_EQUIPMENT, 4, 2));

  value.week.days.forEach((daySelection, dayIndex) => {
    const ids = daySelection.exercises.map((exercise) => exercise.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(
      ids.slice(0, week.days[dayIndex].exercises.length),
      week.days[dayIndex].exercises.map((exercise) => exercise.id),
    );
  });
  assert.deepEqual(
    value.week.days[0].exercises.slice(week.days[0].exercises.length).map(
      (exercise) => exercise.id,
    ),
    ['incline-barbell-bench-press', 'dumbbell-curl'],
  );
  assert.ok(
    week.days[2].exercises.some(
      (exercise) => exercise.id === 'incline-barbell-bench-press',
    ),
  );
  assert.ok(
    value.week.days[0].exercises.some(
      (exercise) => exercise.id === 'incline-barbell-bench-press',
    ),
  );
});

test('limited equipment adds only compatible exercises and leaves explicit deficits', () => {
  const equipment = ['dumbbell', 'bench', 'bodyweight'];
  const value = requireValid(augment(buildWeek(4, equipment), equipment, 4, 2));

  assert.ok(
    value.accessoryAdditions.every((addition) =>
      addition.exercise.equipment.every((item) => equipment.includes(item)),
    ),
  );
  assert.deepEqual(value.analysis.musclesBelowTarget, [
    'back',
    'triceps',
    'hamstrings',
    'calves',
    'abs',
  ]);
  assert.equal(statusSummary(value.analysis).hamstrings[1], 0);
  assert.equal(statusSummary(value.analysis).calves[1], 0);
});

test('zero equipment terminates with no exercises or accessories', () => {
  const week = buildWeek(4, []);
  const value = requireValid(augment(week, [], 4, 2));

  assert.equal(value.week, week);
  assert.deepEqual(value.accessoryAdditions, []);
  assert.deepEqual(value.allocation, { days: [] });
  assert.deepEqual(value.analysis.musclesBelowTarget, MUSCLE_GROUPS);
});

test('bodyweight is explicit and secondary muscles do not receive direct credit', () => {
  const equipment = ['bodyweight'];
  const value = requireValid(augment(buildWeek(4, equipment), equipment, 4, 2));

  assert.deepEqual(additionSummary(value), [
    [2, 'walking-lunge', 4],
    [4, 'walking-lunge', 4],
  ]);
  assert.ok(
    value.accessoryAdditions.every((addition) =>
      addition.exercise.equipment.every((item) => item === 'bodyweight'),
    ),
  );
  assert.equal(statusSummary(value.analysis).shoulders[1], 0);
  assert.equal(statusSummary(value.analysis).triceps[1], 0);
});

test('uses a custom policy without hardcoding the default target', () => {
  const policy = policyWithTargets(3);
  const value = requireValid(augment(buildWeek(), ALL_EQUIPMENT, 1, 2, policy));

  assert.ok(
    value.analysis.muscles.every(
      (status) =>
        status.targetSetsPerWeek === 3 &&
        status.allocatedDirectSets <= status.targetSetsPerWeek,
    ),
  );
  assert.ok(value.accessoryAdditions.length > 0);
});

test('is deterministic and does not mutate inputs, missing patterns, or catalog', () => {
  const week = buildWeek();
  const equipment = [...ALL_EQUIPMENT];
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const setConstraints = { maxSetsPerExerciseOccurrence: 4 };
  const accessoryConstraints = { maxAdditionalExercisesPerDay: 2 };
  const weekBefore = JSON.stringify(week);
  const equipmentBefore = [...equipment];
  const policyBefore = JSON.stringify(policy);
  const setConstraintsBefore = JSON.stringify(setConstraints);
  const accessoryConstraintsBefore = JSON.stringify(accessoryConstraints);
  const catalogBefore = EXERCISE_CATALOG.map((exercise) => exercise.id);
  const muscleGroupsBefore = [...MUSCLE_GROUPS];
  const first = augmentWeeklyDirectSetTargetsWithAccessories(
    week,
    equipment,
    policy,
    setConstraints,
    accessoryConstraints,
  );
  const second = augmentWeeklyDirectSetTargetsWithAccessories(
    week,
    equipment,
    policy,
    setConstraints,
    accessoryConstraints,
  );

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(JSON.stringify(week), weekBefore);
  assert.deepEqual(equipment, equipmentBefore);
  assert.equal(JSON.stringify(policy), policyBefore);
  assert.equal(JSON.stringify(setConstraints), setConstraintsBefore);
  assert.equal(JSON.stringify(accessoryConstraints), accessoryConstraintsBefore);
  assert.deepEqual(
    week.days.map((day) => day.missingPatterns),
    requireValid(first).week.days.map((day) => day.missingPatterns),
  );
  assert.deepEqual(
    EXERCISE_CATALOG.map((exercise) => exercise.id),
    catalogBefore,
  );
  assert.deepEqual(MUSCLE_GROUPS, muscleGroupsBefore);
});
