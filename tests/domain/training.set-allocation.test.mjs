import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingDomain from '../../.expo/domain-tests/domain/training/index.js';
import trainingFeature from '../../.expo/domain-tests/features/training/index.js';

const { EQUIPMENT, MUSCLE_GROUPS } = exerciseDomain;
const { buildDefaultHypertrophyWeeklyVolumePolicy } = trainingDomain;
const {
  allocateWeeklyDirectSets,
  analyzeWeeklyDirectSetVolume,
  analyzeWeeklyMuscleCoverage,
  buildHypertrophyTrainingSelection,
} = trainingFeature;

const ALL_EQUIPMENT = [...EQUIPMENT];

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

function weekWithOnly(week, exerciseIds) {
  const allowedIds = new Set(exerciseIds);

  return {
    ...week,
    days: week.days.map((daySelection) => ({
      ...daySelection,
      exercises: daySelection.exercises.filter((exercise) =>
        allowedIds.has(exercise.id),
      ),
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

function allocate(
  week,
  maxSetsPerExerciseOccurrence,
  policy = buildDefaultHypertrophyWeeklyVolumePolicy(),
) {
  return allocateWeeklyDirectSets(week, policy, {
    maxSetsPerExerciseOccurrence,
  });
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

function setsByOccurrence(allocation) {
  return Object.fromEntries(
    allocation.days.flatMap((day) =>
      day.exercises.map((exercise) => [
        `${day.dayOrder}:${exercise.exerciseId}`,
        exercise.sets,
      ]),
    ),
  );
}

test('is deterministic, reuses V8 analysis, and does not mutate inputs', () => {
  const week = buildWeek();
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const constraints = { maxSetsPerExerciseOccurrence: 3 };
  const weekBefore = JSON.stringify(week);
  const policyBefore = JSON.stringify(policy);
  const constraintsBefore = JSON.stringify(constraints);
  const muscleGroupsBefore = [...MUSCLE_GROUPS];
  const first = allocateWeeklyDirectSets(week, policy, constraints);
  const second = allocateWeeklyDirectSets(week, policy, constraints);
  const value = requireValid(first);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.deepEqual(
    analyzeWeeklyDirectSetVolume(week, value.allocation, policy),
    { valid: true, value: value.analysis },
  );
  assert.equal(JSON.stringify(week), weekBefore);
  assert.equal(JSON.stringify(policy), policyBefore);
  assert.equal(JSON.stringify(constraints), constraintsBefore);
  assert.deepEqual(MUSCLE_GROUPS, muscleGroupsBefore);
});

test('rejects non-positive, non-integer, and non-finite caps', () => {
  for (const cap of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertInvalid(
      allocate(buildWeek(), cap),
      'maxSetsPerExerciseOccurrence must be a positive integer',
    );
  }
});

test('propagates invalid policy errors from the V8 infrastructure', () => {
  const invalidPolicy = policyWithTargets(10, { chest: 0 });

  assertInvalid(
    allocate(buildWeek(), 3, invalidPolicy),
    'targetSetsPerWeek for chest must be a positive integer',
  );
});

test('cap one reproduces the one-set V8 fixture without hardcoded occurrences', () => {
  const week = buildWeek();
  const coverage = analyzeWeeklyMuscleCoverage(week);
  const { allocation, analysis } = requireValid(allocate(week, 1));

  assert.ok(
    allocation.days.every((day) =>
      day.exercises.every((exercise) => exercise.sets === 1),
    ),
  );
  assert.deepEqual(
    analysis.muscles.map((status) => status.allocatedDirectSets),
    coverage.muscles.map((muscle) => muscle.exerciseOccurrenceCount),
  );
});

test('allocates the real four-day week with cap three without excess', () => {
  const { allocation, analysis } = requireValid(allocate(buildWeek(), 3));

  assert.ok(
    allocation.days.every((day) =>
      day.exercises.every((exercise) => exercise.sets <= 3),
    ),
  );
  assert.deepEqual(statusSummary(analysis), {
    chest: [10, 6, 4, 0],
    back: [10, 10, 0, 0],
    shoulders: [10, 10, 0, 0],
    biceps: [10, 6, 4, 0],
    triceps: [10, 6, 4, 0],
    quadriceps: [10, 10, 0, 0],
    hamstrings: [10, 10, 0, 0],
    glutes: [10, 10, 0, 0],
    calves: [10, 6, 4, 0],
    abs: [10, 6, 4, 0],
  });
  assert.deepEqual(analysis.musclesBelowTarget, [
    'chest',
    'biceps',
    'triceps',
    'calves',
    'abs',
  ]);
  assert.deepEqual(analysis.musclesAboveTarget, []);
});

test('allocates the real four-day week with cap four without excess', () => {
  const { allocation, analysis } = requireValid(allocate(buildWeek(), 4));

  assert.ok(
    allocation.days.every((day) =>
      day.exercises.every((exercise) => exercise.sets <= 4),
    ),
  );
  assert.deepEqual(statusSummary(analysis), {
    chest: [10, 8, 2, 0],
    back: [10, 10, 0, 0],
    shoulders: [10, 10, 0, 0],
    biceps: [10, 8, 2, 0],
    triceps: [10, 8, 2, 0],
    quadriceps: [10, 10, 0, 0],
    hamstrings: [10, 10, 0, 0],
    glutes: [10, 10, 0, 0],
    calves: [10, 8, 2, 0],
    abs: [10, 8, 2, 0],
  });
  assert.deepEqual(analysis.musclesAboveTarget, []);
});

test('cap five reaches every target in the real four-day week', () => {
  const { allocation, analysis } = requireValid(allocate(buildWeek(), 5));

  assert.ok(
    allocation.days.every((day) =>
      day.exercises.every((exercise) => exercise.sets <= 5),
    ),
  );
  assert.deepEqual(
    statusSummary(analysis),
    Object.fromEntries(MUSCLE_GROUPS.map((muscle) => [muscle, [10, 10, 0, 0]])),
  );
  assert.deepEqual(analysis.musclesBelowTarget, []);
  assert.deepEqual(analysis.musclesAtTarget, MUSCLE_GROUPS);
  assert.deepEqual(analysis.musclesAboveTarget, []);
});

test('cap five preserves the exact canonical round-robin distribution', () => {
  const { allocation } = requireValid(allocate(buildWeek(), 5));

  assert.deepEqual(setsByOccurrence(allocation), {
    '1:barbell-bench-press': 5,
    '1:barbell-row': 3,
    '1:barbell-overhead-press': 3,
    '1:pull-up': 3,
    '1:dumbbell-lateral-raise': 3,
    '1:barbell-curl': 5,
    '1:cable-triceps-pushdown': 5,
    '2:barbell-back-squat': 3,
    '2:barbell-romanian-deadlift': 3,
    '2:leg-extension': 3,
    '2:lying-leg-curl': 3,
    '2:barbell-hip-thrust': 3,
    '2:standing-calf-raise': 5,
    '2:cable-crunch': 5,
    '3:incline-barbell-bench-press': 5,
    '3:single-arm-dumbbell-row': 2,
    '3:dumbbell-shoulder-press': 2,
    '3:lat-pulldown': 2,
    '3:single-arm-cable-lateral-raise': 2,
    '3:dumbbell-curl': 5,
    '3:overhead-cable-triceps-extension': 5,
    '4:barbell-front-squat': 2,
    '4:barbell-conventional-deadlift': 2,
    '4:leg-extension': 2,
    '4:seated-leg-curl': 2,
    '4:barbell-hip-thrust': 2,
    '4:seated-calf-raise': 5,
    '4:hanging-leg-raise': 5,
  });
});

test('round-robin balances two equivalent occurrences for an even target', () => {
  const week = weekWithOnly(buildWeek(), [
    'barbell-bench-press',
    'incline-barbell-bench-press',
  ]);
  const { allocation } = requireValid(
    allocate(week, 5, policyWithTargets(4)),
  );

  assert.deepEqual(setsByOccurrence(allocation), {
    '1:barbell-bench-press': 2,
    '3:incline-barbell-bench-press': 2,
  });
});

test('uses a custom target of three instead of hardcoding ten', () => {
  const week = weekWithOnly(buildWeek(), [
    'barbell-bench-press',
    'incline-barbell-bench-press',
  ]);
  const { allocation, analysis } = requireValid(
    allocate(week, 5, policyWithTargets(3)),
  );

  assert.deepEqual(setsByOccurrence(allocation), {
    '1:barbell-bench-press': 2,
    '3:incline-barbell-bench-press': 1,
  });
  assert.equal(
    analysis.muscles.find((status) => status.muscle === 'chest')
      .allocatedDirectSets,
    3,
  );
});

test('gives the earlier occurrence the extra set for a non-divisible target', () => {
  const week = weekWithOnly(buildWeek(), [
    'barbell-bench-press',
    'incline-barbell-bench-press',
  ]);
  const { allocation } = requireValid(
    allocate(week, 5, policyWithTargets(5)),
  );

  assert.deepEqual(setsByOccurrence(allocation), {
    '1:barbell-bench-press': 3,
    '3:incline-barbell-bench-press': 2,
  });
});

test('multi-primary coupling leaves a legitimate deficit instead of excess', () => {
  const week = weekWithOnly(buildWeek(), ['barbell-romanian-deadlift']);
  const policy = policyWithTargets(3, { hamstrings: 2, glutes: 1 });
  const { allocation, analysis } = requireValid(allocate(week, 5, policy));
  const hamstrings = analysis.muscles.find(
    (status) => status.muscle === 'hamstrings',
  );
  const glutes = analysis.muscles.find((status) => status.muscle === 'glutes');

  assert.deepEqual(setsByOccurrence(allocation), {
    '2:barbell-romanian-deadlift': 1,
  });
  assert.equal(hamstrings.allocatedDirectSets, 1);
  assert.equal(hamstrings.remainingSetsToTarget, 1);
  assert.equal(glutes.allocatedDirectSets, 1);
  assert.equal(glutes.remainingSetsToTarget, 0);
  assert.deepEqual(analysis.musclesAboveTarget, []);
});

test('a cap-caused deficit is a valid result rather than an allocation error', () => {
  const result = allocate(buildWeek(), 1);
  const { analysis } = requireValid(result);

  assert.deepEqual(analysis.musclesBelowTarget, MUSCLE_GROUPS);
  assert.deepEqual(analysis.musclesAtTarget, []);
  assert.deepEqual(analysis.musclesAboveTarget, []);
});

test('does not invent exercises or change missing patterns', () => {
  const week = buildHypertrophyTrainingSelection({
    daysPerWeek: 2,
    availableEquipment: ['bodyweight'],
  });
  const missingPatternsBefore = week.days.map((day) => [...day.missingPatterns]);
  const selectedIds = new Set(
    week.days.flatMap((day) => day.exercises.map((exercise) => exercise.id)),
  );
  const { allocation, analysis } = requireValid(allocate(week, 3));

  assert.ok(
    allocation.days.every((day) =>
      day.exercises.every((exercise) => selectedIds.has(exercise.exerciseId)),
    ),
  );
  assert.deepEqual(
    week.days.map((day) => day.missingPatterns),
    missingPatternsBefore,
  );
  for (const muscle of [
    'back',
    'biceps',
    'quadriceps',
    'hamstrings',
    'glutes',
    'calves',
  ]) {
    assert.ok(analysis.musclesBelowTarget.includes(muscle));
  }
});

test('terminates with an empty allocation when the week has zero exercises', () => {
  const week = buildHypertrophyTrainingSelection({
    daysPerWeek: 6,
    availableEquipment: [],
  });
  const { allocation, analysis } = requireValid(allocate(week, 5));

  assert.deepEqual(allocation, { days: [] });
  assert.deepEqual(analysis.musclesBelowTarget, MUSCLE_GROUPS);
  assert.ok(week.days.every((day) => day.exercises.length === 0));
  assert.ok(week.days.every((day) => day.missingPatterns.length > 0));
});
