import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingDomain from '../../.expo/domain-tests/domain/training/index.js';
import trainingFeature from '../../.expo/domain-tests/features/training/index.js';

const { EQUIPMENT, MUSCLE_GROUPS } = exerciseDomain;
const { buildDefaultHypertrophyWeeklyVolumePolicy } = trainingDomain;
const {
  allocateWeeklyDirectSets,
  allocateWeeklyDirectSetsWithinDuration,
  analyzeWeeklyDirectSetVolume,
  analyzeWeeklySessionDuration,
  augmentWeeklyDirectSetTargetsWithAccessories,
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

function buildWeek() {
  return buildHypertrophyTrainingSelection({
    daysPerWeek: 4,
    availableEquipment: ALL_EQUIPMENT,
  });
}

function buildSingleDayWeek(exerciseIds) {
  const week = buildWeek();
  const firstDay = week.days[0];
  const exercises = week.days.flatMap((day) => day.exercises);

  return {
    ...week,
    days: [{
      ...firstDay,
      exercises: exerciseIds.map((exerciseId) =>
        exercises.find((exercise) => exercise.id === exerciseId),
      ),
    }],
  };
}

function buildV10Week() {
  const week = buildWeek();
  const value = requireValid(
    augmentWeeklyDirectSetTargetsWithAccessories(
      week,
      ALL_EQUIPMENT,
      buildDefaultHypertrophyWeeklyVolumePolicy(),
      { maxSetsPerExerciseOccurrence: 4 },
      { maxAdditionalExercisesPerDay: 2 },
    ),
  );

  return value.week;
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

function allocateWithin(
  week,
  sessionDurationMinutes,
  durationModel,
  maxSetsPerExerciseOccurrence = 4,
  policy = buildDefaultHypertrophyWeeklyVolumePolicy(),
) {
  return allocateWeeklyDirectSetsWithinDuration(
    week,
    policy,
    { maxSetsPerExerciseOccurrence },
    { sessionDurationMinutes, durationModel },
  );
}

function durationRows(analysis) {
  return analysis.days.map((day) => [
    day.dayOrder,
    day.allocatedExerciseCount,
    day.allocatedSetCount,
    day.estimatedDurationMinutes,
  ]);
}

function muscleAllocationSummary(analysis) {
  return Object.fromEntries(
    analysis.muscles.map((status) => [
      status.muscle,
      [status.allocatedDirectSets, status.remainingSetsToTarget],
    ]),
  );
}

function assertConstrainedInvariants(value) {
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

test('matches V9 when the temporal constraint is not binding', () => {
  const week = buildWeek();
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const setConstraints = { maxSetsPerExerciseOccurrence: 4 };
  const v9 = requireValid(
    allocateWeeklyDirectSets(week, policy, setConstraints),
  );
  const v12 = requireValid(
    allocateWeeklyDirectSetsWithinDuration(
      week,
      policy,
      setConstraints,
      {
        sessionDurationMinutes: 120,
        durationModel: {
          minutesPerSet: 1,
          minutesPerExerciseOverhead: 0,
        },
      },
    ),
  );

  assert.deepEqual(v12.allocation, v9.allocation);
  assert.deepEqual(v12.volumeAnalysis, v9.analysis);
  assertConstrainedInvariants(v12);
});

test('matches V9 cap one when duration is ample', () => {
  const week = buildWeek();
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const constraints = { maxSetsPerExerciseOccurrence: 1 };
  const v9 = requireValid(allocateWeeklyDirectSets(week, policy, constraints));
  const v12 = requireValid(
    allocateWeeklyDirectSetsWithinDuration(
      week,
      policy,
      constraints,
      {
        sessionDurationMinutes: 120,
        durationModel: MODEL_B,
      },
    ),
  );

  assert.deepEqual(v12.allocation, v9.allocation);
  assert.deepEqual(v12.volumeAnalysis, v9.analysis);
});

test('counts exercise overhead once and blocks the next set at the exact limit', () => {
  const week = buildSingleDayWeek([
    'barbell-bench-press',
    'incline-barbell-bench-press',
  ]);
  const value = requireValid(
    allocateWithin(
      week,
      30,
      { minutesPerSet: 2, minutesPerExerciseOverhead: 1 },
      20,
      policyWithTargets(20),
    ),
  );

  assert.deepEqual(value.allocation, {
    days: [{
      dayOrder: 1,
      exercises: [
        { exerciseId: 'barbell-bench-press', sets: 7 },
        { exerciseId: 'incline-barbell-bench-press', sets: 7 },
      ],
    }],
  });
  assert.deepEqual(durationRows(value.durationAnalysis), [[1, 2, 14, 30]]);
  assert.equal(
    value.volumeAnalysis.muscles.find((status) => status.muscle === 'chest')
      .remainingSetsToTarget,
    6,
  );
  assertConstrainedInvariants(value);
});

test('uses structural order when only two first exercise sets fit', () => {
  const week = buildSingleDayWeek([
    'barbell-bench-press',
    'barbell-row',
    'barbell-overhead-press',
  ]);
  const value = requireValid(
    allocateWithin(
      week,
      30,
      { minutesPerSet: 10, minutesPerExerciseOverhead: 5 },
      1,
    ),
  );

  assert.deepEqual(value.allocation, {
    days: [{
      dayOrder: 1,
      exercises: [
        { exerciseId: 'barbell-bench-press', sets: 1 },
        { exerciseId: 'barbell-row', sets: 1 },
      ],
    }],
  });
  assert.deepEqual(durationRows(value.durationAnalysis), [[1, 2, 2, 30]]);
});

test('applies target, cap, and time together to a multi-primary exercise', () => {
  const baseWeek = buildWeek();
  const lowerDay = baseWeek.days[1];
  const week = {
    ...baseWeek,
    days: [{
      ...lowerDay,
      exercises: [
        lowerDay.exercises.find(
          (exercise) => exercise.id === 'barbell-romanian-deadlift',
        ),
      ],
    }],
  };
  const value = requireValid(
    allocateWithin(
      week,
      30,
      { minutesPerSet: 8, minutesPerExerciseOverhead: 6 },
      4,
      policyWithTargets(10, { hamstrings: 4, glutes: 4 }),
    ),
  );

  assert.deepEqual(value.allocation.days[0].exercises, [
    { exerciseId: 'barbell-romanian-deadlift', sets: 3 },
  ]);
  assert.deepEqual(durationRows(value.durationAnalysis), [[2, 1, 3, 30]]);
  assert.deepEqual(
    value.volumeAnalysis.muscles
      .filter((status) => ['hamstrings', 'glutes'].includes(status.muscle))
      .map((status) => [status.muscle, status.allocatedDirectSets, status.remainingSetsToTarget]),
    [
      ['hamstrings', 3, 1],
      ['glutes', 3, 1],
    ],
  );
  assertConstrainedInvariants(value);
});

test('reports exact structural-week results for sixty minutes in models A and B', () => {
  const week = buildWeek();
  const modelA = requireValid(allocateWithin(week, 60, MODEL_A));
  const modelB = requireValid(allocateWithin(week, 60, MODEL_B));
  const expectedMuscles = {
    chest: [8, 2],
    back: [10, 0],
    shoulders: [10, 0],
    biceps: [8, 2],
    triceps: [8, 2],
    quadriceps: [10, 0],
    hamstrings: [10, 0],
    glutes: [10, 0],
    calves: [8, 2],
    abs: [8, 2],
  };

  assert.deepEqual(durationRows(modelA.durationAnalysis), [
    [1, 7, 24, 43],
    [2, 7, 23, 41.5],
    [3, 7, 20, 37],
    [4, 7, 18, 34],
  ]);
  assert.deepEqual(durationRows(modelB.durationAnalysis), [
    [1, 7, 24, 58.5],
    [2, 7, 23, 56.5],
    [3, 7, 20, 50.5],
    [4, 7, 18, 46.5],
  ]);
  assert.deepEqual(muscleAllocationSummary(modelA.volumeAnalysis), expectedMuscles);
  assert.deepEqual(muscleAllocationSummary(modelB.volumeAnalysis), expectedMuscles);
  assertConstrainedInvariants(modelA);
  assertConstrainedInvariants(modelB);
});

test('reports exact structural-week results for forty-five minutes', () => {
  const week = buildWeek();
  const modelA = requireValid(allocateWithin(week, 45, MODEL_A));
  const modelB = requireValid(allocateWithin(week, 45, MODEL_B));

  assert.deepEqual(durationRows(modelA.durationAnalysis), [
    [1, 7, 24, 43],
    [2, 7, 23, 41.5],
    [3, 7, 20, 37],
    [4, 7, 18, 34],
  ]);
  assert.deepEqual(modelA.volumeAnalysis.musclesBelowTarget, [
    'chest', 'biceps', 'triceps', 'calves', 'abs',
  ]);
  assert.deepEqual(durationRows(modelB.durationAnalysis), [
    [1, 7, 17, 44.5],
    [2, 7, 17, 44.5],
    [3, 7, 17, 44.5],
    [4, 7, 17, 44.5],
  ]);
  assert.deepEqual(muscleAllocationSummary(modelB.volumeAnalysis), {
    chest: [6, 4],
    back: [10, 0],
    shoulders: [10, 0],
    biceps: [4, 6],
    triceps: [4, 6],
    quadriceps: [10, 0],
    hamstrings: [10, 0],
    glutes: [10, 0],
    calves: [5, 5],
    abs: [5, 5],
  });
  assertConstrainedInvariants(modelA);
  assertConstrainedInvariants(modelB);
});

test('keeps every structural-week day within thirty minutes', () => {
  const week = buildWeek();
  const modelA = requireValid(allocateWithin(week, 30, MODEL_A));
  const modelB = requireValid(allocateWithin(week, 30, MODEL_B));

  assert.deepEqual(durationRows(modelA.durationAnalysis), [
    [1, 7, 15, 29.5],
    [2, 7, 15, 29.5],
    [3, 7, 15, 29.5],
    [4, 7, 15, 29.5],
  ]);
  assert.deepEqual(muscleAllocationSummary(modelA.volumeAnalysis), {
    chest: [6, 4],
    back: [8, 2],
    shoulders: [8, 2],
    biceps: [4, 6],
    triceps: [4, 6],
    quadriceps: [10, 0],
    hamstrings: [8, 2],
    glutes: [8, 2],
    calves: [4, 6],
    abs: [4, 6],
  });
  assert.deepEqual(durationRows(modelB.durationAnalysis), [
    [1, 7, 9, 28.5],
    [2, 7, 9, 28.5],
    [3, 7, 9, 28.5],
    [4, 7, 9, 28.5],
  ]);
  assert.deepEqual(muscleAllocationSummary(modelB.volumeAnalysis), {
    chest: [4, 6],
    back: [6, 4],
    shoulders: [4, 6],
    biceps: [2, 8],
    triceps: [2, 8],
    quadriceps: [6, 4],
    hamstrings: [6, 4],
    glutes: [6, 4],
    calves: [2, 8],
    abs: [2, 8],
  });
  assertConstrainedInvariants(modelA);
  assertConstrainedInvariants(modelB);
});

test('matches V9 for the structural week in model B at sixty minutes', () => {
  const week = buildWeek();
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const constraints = { maxSetsPerExerciseOccurrence: 4 };
  const v9 = requireValid(allocateWeeklyDirectSets(week, policy, constraints));
  const v9Duration = requireValid(
    analyzeWeeklySessionDuration(week, v9.allocation, 60, MODEL_B),
  );
  const v12 = requireValid(
    allocateWeeklyDirectSetsWithinDuration(
      week,
      policy,
      constraints,
      { sessionDurationMinutes: 60, durationModel: MODEL_B },
    ),
  );

  assert.deepEqual(v12.allocation, v9.allocation);
  assert.deepEqual(v12.volumeAnalysis, v9.analysis);
  assert.deepEqual(v12.durationAnalysis, v9Duration);
  assert.deepEqual(v9Duration.daysExceedingDuration, []);
});

test('reaches every target on the V10-augmented week in model A at sixty minutes', () => {
  const week = buildV10Week();
  const value = requireValid(allocateWithin(week, 60, MODEL_A));

  assert.deepEqual(durationRows(value.durationAnalysis), [
    [1, 9, 30, 54],
    [2, 9, 29, 52.5],
    [3, 8, 20, 38],
    [4, 7, 16, 31],
  ]);
  assert.deepEqual(
    muscleAllocationSummary(value.volumeAnalysis),
    Object.fromEntries(MUSCLE_GROUPS.map((muscle) => [muscle, [10, 0]])),
  );
  assertConstrainedInvariants(value);
});

test('constrains the V10-augmented week in model B at sixty minutes', () => {
  const week = buildV10Week();
  const value = requireValid(allocateWithin(week, 60, MODEL_B));

  assert.deepEqual(durationRows(value.durationAnalysis), [
    [1, 9, 23, 59.5],
    [2, 9, 23, 59.5],
    [3, 8, 24, 60],
    [4, 7, 18, 46.5],
  ]);
  assert.deepEqual(muscleAllocationSummary(value.volumeAnalysis), {
    chest: [9, 1],
    back: [10, 0],
    shoulders: [10, 0],
    biceps: [8, 2],
    triceps: [10, 0],
    quadriceps: [10, 0],
    hamstrings: [10, 0],
    glutes: [10, 0],
    calves: [8, 2],
    abs: [8, 2],
  });
  assert.deepEqual(value.volumeAnalysis.musclesBelowTarget, [
    'chest', 'biceps', 'calves', 'abs',
  ]);
  assertConstrainedInvariants(value);
});

test('reuses V8 and V11 as the final sources of truth', () => {
  const week = buildV10Week();
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const value = requireValid(
    allocateWeeklyDirectSetsWithinDuration(
      week,
      policy,
      { maxSetsPerExerciseOccurrence: 4 },
      { sessionDurationMinutes: 60, durationModel: MODEL_B },
    ),
  );

  assert.deepEqual(
    analyzeWeeklyDirectSetVolume(week, value.allocation, policy),
    { valid: true, value: value.volumeAnalysis },
  );
  assert.deepEqual(
    analyzeWeeklySessionDuration(week, value.allocation, 60, MODEL_B),
    { valid: true, value: value.durationAnalysis },
  );
});

test('rejects invalid session duration through the official validator', () => {
  for (const duration of [29, 121, 60.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertInvalid(
      allocateWithin(buildWeek(), duration, MODEL_A),
      'sessionDurationMinutes must be an integer between 30 and 120',
    );
  }
});

test('rejects invalid duration models and accepts zero overhead', () => {
  for (const minutesPerSet of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertInvalid(
      allocateWithin(buildWeek(), 60, {
        minutesPerSet,
        minutesPerExerciseOverhead: 1,
      }),
      'minutesPerSet must be a positive finite number',
    );
  }

  for (const minutesPerExerciseOverhead of [
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    assertInvalid(
      allocateWithin(buildWeek(), 60, {
        minutesPerSet: 2,
        minutesPerExerciseOverhead,
      }),
      'minutesPerExerciseOverhead must be a non-negative finite number',
    );
  }

  assert.equal(
    allocateWithin(buildWeek(), 60, {
      minutesPerSet: 2.75,
      minutesPerExerciseOverhead: 0,
    }).valid,
    true,
  );
});

test('propagates invalid set cap and policy errors', () => {
  for (const cap of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertInvalid(
      allocateWithin(buildWeek(), 60, MODEL_A, cap),
      'maxSetsPerExerciseOccurrence must be a positive integer',
    );
  }

  assertInvalid(
    allocateWithin(
      buildWeek(),
      60,
      MODEL_A,
      4,
      policyWithTargets(10, { chest: 0 }),
    ),
    'targetSetsPerWeek for chest must be a positive integer',
  );
});

test('is deterministic and does not mutate any input or muscle groups', () => {
  const week = buildV10Week();
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const setConstraints = { maxSetsPerExerciseOccurrence: 4 };
  const durationConstraint = {
    sessionDurationMinutes: 60,
    durationModel: { ...MODEL_B },
  };
  const snapshots = [
    JSON.stringify(week),
    JSON.stringify(policy),
    JSON.stringify(setConstraints),
    JSON.stringify(durationConstraint),
    JSON.stringify(MUSCLE_GROUPS),
  ];
  const first = allocateWeeklyDirectSetsWithinDuration(
    week,
    policy,
    setConstraints,
    durationConstraint,
  );
  const second = allocateWeeklyDirectSetsWithinDuration(
    week,
    policy,
    setConstraints,
    durationConstraint,
  );

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.deepEqual(
    [
      JSON.stringify(week),
      JSON.stringify(policy),
      JSON.stringify(setConstraints),
      JSON.stringify(durationConstraint),
      JSON.stringify(MUSCLE_GROUPS),
    ],
    snapshots,
  );
});
