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
  allocateWeeklyCreditedSetsWithinDuration,
  allocateWeeklyDirectSetsWithinDuration,
  analyzeWeeklyCreditedSetVolume,
  analyzeWeeklySessionDuration,
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

function allocateV15({
  week = buildWeek(),
  volumePolicy = buildDefaultHypertrophyWeeklyVolumePolicy(),
  indirectSetCredit = 0.5,
  maxSetsPerExerciseOccurrence = 4,
  sessionDurationMinutes = 60,
  durationModel = MODEL_B,
} = {}) {
  return allocateWeeklyCreditedSetsWithinDuration(
    week,
    volumePolicy,
    { indirectSetCredit },
    { maxSetsPerExerciseOccurrence },
    { sessionDurationMinutes, durationModel },
  );
}

function weeklySetCount(allocation) {
  return allocation.days.reduce(
    (weekTotal, day) =>
      weekTotal +
      day.exercises.reduce(
        (dayTotal, exercise) => dayTotal + exercise.sets,
        0,
      ),
    0,
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

function allocationRows(allocation) {
  return allocation.days.map((day) => [
    day.dayOrder,
    day.exercises.map((exercise) => [exercise.exerciseId, exercise.sets]),
  ]);
}

function creditedRows(analysis) {
  return Object.fromEntries(
    analysis.muscles.map((status) => [
      status.muscle,
      [
        status.targetSetsPerWeek,
        status.allocatedDirectSets,
        status.allocatedIndirectSets,
        status.creditedIndirectSets,
        status.totalCreditedSets,
        status.remainingCreditedSetsToTarget,
        status.creditedSetsAboveTarget,
      ],
    ]),
  );
}

function totalCreditedSets(analysis) {
  return analysis.muscles.map((status) => status.totalCreditedSets);
}

function statusFor(analysis, muscle) {
  return analysis.muscles.find((status) => status.muscle === muscle);
}

function assertInvariants(value) {
  assert.deepEqual(
    value.creditedVolumeAnalysis.musclesAboveCreditedTarget,
    [],
  );
  assert.deepEqual(value.durationAnalysis.daysExceedingDuration, []);
  assert.ok(
    value.creditedVolumeAnalysis.muscles.every(
      (status) => status.totalCreditedSets <= status.targetSetsPerWeek,
    ),
  );
  assert.ok(
    value.durationAnalysis.days.every(
      (day) =>
        day.estimatedDurationMinutes <= day.sessionDurationMinutes &&
        day.fitsDuration,
    ),
  );
  assert.ok(
    value.allocation.days.every((day) =>
      day.exercises.every((exercise) => exercise.sets > 0),
    ),
  );
}

test('is structurally equivalent to V12 when indirect credit is zero', () => {
  const week = buildWeek();
  const volumePolicy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const v12 = requireValid(
    allocateWeeklyDirectSetsWithinDuration(
      week,
      volumePolicy,
      { maxSetsPerExerciseOccurrence: 4 },
      { sessionDurationMinutes: 60, durationModel: MODEL_B },
    ),
  );
  const v15 = requireValid(
    allocateV15({ week, volumePolicy, indirectSetCredit: 0 }),
  );

  assert.deepEqual(v15.allocation, v12.allocation);
  assert.deepEqual(v15.durationAnalysis, v12.durationAnalysis);
  assert.equal(weeklySetCount(v15.allocation), 85);
  assert.deepEqual(durationRows(v15.durationAnalysis), [
    [1, 7, 24, 58.5],
    [2, 7, 23, 56.5],
    [3, 7, 20, 50.5],
    [4, 7, 18, 46.5],
  ]);

  for (let index = 0; index < MUSCLE_GROUPS.length; index += 1) {
    const creditedStatus = v15.creditedVolumeAnalysis.muscles[index];
    const directStatus = v12.volumeAnalysis.muscles[index];

    assert.equal(
      creditedStatus.allocatedDirectSets,
      directStatus.allocatedDirectSets,
    );
    assert.equal(
      creditedStatus.totalCreditedSets,
      directStatus.allocatedDirectSets,
    );
  }
  assertInvariants(v15);
});

test('allocates the real structural model B sixty-minute week with half credit', () => {
  const value = requireValid(allocateV15());

  assert.equal(weeklySetCount(value.allocation), 68);
  assert.deepEqual(allocationRows(value.allocation), [
    [
      1,
      [
        ['barbell-bench-press', 2],
        ['barbell-row', 2],
        ['barbell-overhead-press', 2],
        ['pull-up', 2],
        ['dumbbell-lateral-raise', 2],
        ['barbell-curl', 3],
        ['cable-triceps-pushdown', 3],
      ],
    ],
    [
      2,
      [
        ['barbell-back-squat', 2],
        ['barbell-romanian-deadlift', 2],
        ['leg-extension', 3],
        ['lying-leg-curl', 2],
        ['barbell-hip-thrust', 2],
        ['standing-calf-raise', 4],
        ['cable-crunch', 4],
      ],
    ],
    [
      3,
      [
        ['incline-barbell-bench-press', 2],
        ['single-arm-dumbbell-row', 2],
        ['dumbbell-shoulder-press', 2],
        ['lat-pulldown', 2],
        ['single-arm-cable-lateral-raise', 2],
        ['dumbbell-curl', 3],
        ['overhead-cable-triceps-extension', 3],
      ],
    ],
    [
      4,
      [
        ['barbell-front-squat', 2],
        ['barbell-conventional-deadlift', 2],
        ['leg-extension', 2],
        ['seated-leg-curl', 1],
        ['barbell-hip-thrust', 2],
        ['seated-calf-raise', 4],
        ['hanging-leg-raise', 4],
      ],
    ],
  ]);
  assert.deepEqual(durationRows(value.durationAnalysis), [
    [1, 7, 16, 42.5],
    [2, 7, 19, 48.5],
    [3, 7, 16, 42.5],
    [4, 7, 17, 44.5],
  ]);
  assert.deepEqual(creditedRows(value.creditedVolumeAnalysis), {
    chest: [10, 4, 0, 0, 4, 6, 0],
    back: [10, 8, 4, 2, 10, 0, 0],
    shoulders: [10, 8, 4, 2, 10, 0, 0],
    biceps: [10, 6, 8, 4, 10, 0, 0],
    triceps: [10, 6, 8, 4, 10, 0, 0],
    quadriceps: [10, 9, 2, 1, 10, 0, 0],
    hamstrings: [10, 7, 6, 3, 10, 0, 0],
    glutes: [10, 8, 4, 2, 10, 0, 0],
    calves: [10, 8, 0, 0, 8, 2, 0],
    abs: [10, 8, 0, 0, 8, 2, 0],
  });
  assert.deepEqual(
    value.creditedVolumeAnalysis.musclesBelowCreditedTarget,
    ['chest', 'calves', 'abs'],
  );
  assert.deepEqual(value.creditedVolumeAnalysis.musclesAtCreditedTarget, [
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'quadriceps',
    'hamstrings',
    'glutes',
  ]);
  assertInvariants(value);
});

test('compares credit zero, half, and one on the same structural week', () => {
  const week = buildWeek();
  const volumePolicy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const values = [0, 0.5, 1].map((indirectSetCredit) =>
    requireValid(
      allocateV15({ week, volumePolicy, indirectSetCredit }),
    ),
  );

  assert.deepEqual(values.map((value) => weeklySetCount(value.allocation)), [
    85, 68, 56,
  ]);
  assert.deepEqual(
    values.map((value) => durationRows(value.durationAnalysis)),
    [
      [
        [1, 7, 24, 58.5],
        [2, 7, 23, 56.5],
        [3, 7, 20, 50.5],
        [4, 7, 18, 46.5],
      ],
      [
        [1, 7, 16, 42.5],
        [2, 7, 19, 48.5],
        [3, 7, 16, 42.5],
        [4, 7, 17, 44.5],
      ],
      [
        [1, 7, 14, 38.5],
        [2, 7, 18, 46.5],
        [3, 7, 9, 28.5],
        [4, 7, 15, 40.5],
      ],
    ],
  );
  assert.deepEqual(
    values.map((value) =>
      totalCreditedSets(value.creditedVolumeAnalysis),
    ),
    [
      [8, 10, 10, 8, 8, 10, 10, 10, 8, 8],
      [4, 10, 10, 10, 10, 10, 10, 10, 8, 8],
      [4, 10, 10, 10, 10, 10, 10, 9, 8, 8],
    ],
  );
  assert.deepEqual(
    values.map(
      (value) => value.creditedVolumeAnalysis.musclesBelowCreditedTarget,
    ),
    [
      ['chest', 'biceps', 'triceps', 'calves', 'abs'],
      ['chest', 'calves', 'abs'],
      ['chest', 'glutes', 'calves', 'abs'],
    ],
  );
  assert.deepEqual(
    values.map(
      (value) => value.creditedVolumeAnalysis.musclesAboveCreditedTarget,
    ),
    [[], [], []],
  );
  values.forEach(assertInvariants);
});

test('blocks a primary set solely because a secondary would exceed target', () => {
  const week = weekWithOnly(buildWeek(), ['barbell-bench-press']);
  const volumePolicy = policyWithTargets(10, { chest: 3, triceps: 1 });
  const creditAware = requireValid(
    allocateV15({ week, volumePolicy, indirectSetCredit: 0.5 }),
  );
  const directOnly = requireValid(
    allocateV15({ week, volumePolicy, indirectSetCredit: 0 }),
  );

  assert.deepEqual(allocationRows(creditAware.allocation), [
    [1, [['barbell-bench-press', 2]]],
  ]);
  assert.deepEqual(allocationRows(directOnly.allocation), [
    [1, [['barbell-bench-press', 3]]],
  ]);
  assert.equal(statusFor(creditAware.creditedVolumeAnalysis, 'chest').totalCreditedSets, 2);
  assert.equal(
    statusFor(creditAware.creditedVolumeAnalysis, 'chest')
      .remainingCreditedSetsToTarget,
    1,
  );
  assert.equal(
    statusFor(creditAware.creditedVolumeAnalysis, 'triceps')
      .totalCreditedSets,
    1,
  );
  assert.equal(
    statusFor(creditAware.creditedVolumeAnalysis, 'triceps')
      .creditedSetsAboveTarget,
    0,
  );
  assert.deepEqual(durationRows(creditAware.durationAnalysis), [
    [1, 1, 2, 5.5],
    [2, 0, 0, 0],
    [3, 0, 0, 0],
    [4, 0, 0, 0],
  ]);
  assertInvariants(creditAware);
});

test('credits every primary fully in a multi-primary exercise', () => {
  const week = weekWithOnly(buildWeek(), ['barbell-romanian-deadlift']);
  const volumePolicy = policyWithTargets(10, {
    hamstrings: 2,
    glutes: 2,
    back: 1,
  });
  const value = requireValid(allocateV15({ week, volumePolicy }));

  assert.deepEqual(allocationRows(value.allocation), [
    [2, [['barbell-romanian-deadlift', 2]]],
  ]);
  assert.equal(
    statusFor(value.creditedVolumeAnalysis, 'hamstrings').allocatedDirectSets,
    2,
  );
  assert.equal(
    statusFor(value.creditedVolumeAnalysis, 'glutes').allocatedDirectSets,
    2,
  );
  assert.equal(
    statusFor(value.creditedVolumeAnalysis, 'back').creditedIndirectSets,
    1,
  );
  assertInvariants(value);
});

test('uses V14 and V11 as the final sources of truth', () => {
  const week = buildWeek();
  const volumePolicy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const creditPolicy = { indirectSetCredit: 0.5 };
  const durationConstraint = {
    sessionDurationMinutes: 60,
    durationModel: MODEL_B,
  };
  const value = requireValid(
    allocateWeeklyCreditedSetsWithinDuration(
      week,
      volumePolicy,
      creditPolicy,
      { maxSetsPerExerciseOccurrence: 4 },
      durationConstraint,
    ),
  );
  const independentCreditedAnalysis = requireValid(
    analyzeWeeklyCreditedSetVolume(
      week,
      value.allocation,
      volumePolicy,
      creditPolicy,
    ),
  );
  const independentDurationAnalysis = requireValid(
    analyzeWeeklySessionDuration(
      week,
      value.allocation,
      durationConstraint.sessionDurationMinutes,
      durationConstraint.durationModel,
    ),
  );

  assert.deepEqual(
    value.creditedVolumeAnalysis,
    independentCreditedAnalysis,
  );
  assert.deepEqual(value.durationAnalysis, independentDurationAnalysis);
});

test('reallocates a ready V13 week without adding or removing exercises', () => {
  const structuralWeek = buildWeek();
  const volumePolicy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const v13 = requireValid(
    augmentWeeklyDirectSetTargetsWithAccessoriesWithinDuration(
      structuralWeek,
      ALL_EQUIPMENT,
      volumePolicy,
      { maxSetsPerExerciseOccurrence: 4 },
      { maxAdditionalExercisesPerDay: 2 },
      { sessionDurationMinutes: 60, durationModel: MODEL_B },
    ),
  );
  const v13WeekBefore = JSON.stringify(v13.week);
  const reallocated = requireValid(
    allocateV15({ week: v13.week, volumePolicy }),
  );

  assert.equal(weeklySetCount(v13.allocation), 91);
  assert.equal(weeklySetCount(reallocated.allocation), 72);
  assert.deepEqual(
    v13.durationAnalysis.days.map((day) => day.estimatedDurationMinutes),
    [58.5, 60, 56, 54],
  );
  assert.deepEqual(durationRows(reallocated.durationAnalysis), [
    [1, 7, 16, 42.5],
    [2, 8, 22, 56],
    [3, 8, 16, 44],
    [4, 8, 18, 48],
  ]);
  assert.deepEqual(
    reallocated.creditedVolumeAnalysis.musclesBelowCreditedTarget,
    ['chest'],
  );
  assert.deepEqual(
    totalCreditedSets(reallocated.creditedVolumeAnalysis),
    [6, 10, 10, 10, 10, 10, 10, 10, 10, 10],
  );
  assert.equal(JSON.stringify(v13.week), v13WeekBefore);

  reallocated.allocation.days.forEach((dayAllocation) => {
    const selectedDay = v13.week.days.find(
      (day) => day.day.order === dayAllocation.dayOrder,
    );
    assert.ok(selectedDay);
    assert.ok(
      dayAllocation.exercises.every((exerciseAllocation) =>
        selectedDay.exercises.some(
          (exercise) => exercise.id === exerciseAllocation.exerciseId,
        ),
      ),
    );
  });
  assertInvariants(reallocated);
});

test('uses the same credit allocation in model A when time is not binding', () => {
  const modelB = requireValid(allocateV15());
  const modelA = requireValid(allocateV15({ durationModel: MODEL_A }));

  assert.deepEqual(modelA.allocation, modelB.allocation);
  assert.deepEqual(
    modelA.creditedVolumeAnalysis,
    modelB.creditedVolumeAnalysis,
  );
  assert.deepEqual(durationRows(modelA.durationAnalysis), [
    [1, 7, 16, 31],
    [2, 7, 19, 35.5],
    [3, 7, 16, 31],
    [4, 7, 17, 32.5],
  ]);
  assertInvariants(modelA);
});

test('respects model B forty-five and thirty-minute budgets', () => {
  const fortyFive = requireValid(
    allocateV15({ sessionDurationMinutes: 45 }),
  );
  const thirty = requireValid(
    allocateV15({ sessionDurationMinutes: 30 }),
  );

  assert.equal(weeklySetCount(fortyFive.allocation), 66);
  assert.deepEqual(durationRows(fortyFive.durationAnalysis), [
    [1, 7, 16, 42.5],
    [2, 7, 17, 44.5],
    [3, 7, 16, 42.5],
    [4, 7, 17, 44.5],
  ]);
  assert.deepEqual(
    fortyFive.creditedVolumeAnalysis.musclesBelowCreditedTarget,
    ['chest', 'calves', 'abs'],
  );

  assert.equal(weeklySetCount(thirty.allocation), 36);
  assert.deepEqual(durationRows(thirty.durationAnalysis), [
    [1, 7, 9, 28.5],
    [2, 7, 9, 28.5],
    [3, 7, 9, 28.5],
    [4, 7, 9, 28.5],
  ]);
  assert.deepEqual(
    thirty.creditedVolumeAnalysis.musclesBelowCreditedTarget,
    MUSCLE_GROUPS,
  );
  assertInvariants(fortyFive);
  assertInvariants(thirty);
});

test('respects cap one across every structural occurrence', () => {
  const value = requireValid(
    allocateV15({ maxSetsPerExerciseOccurrence: 1 }),
  );

  assert.equal(weeklySetCount(value.allocation), 28);
  assert.ok(
    value.allocation.days.every((day) =>
      day.exercises.every((exercise) => exercise.sets === 1),
    ),
  );
  assert.deepEqual(durationRows(value.durationAnalysis), [
    [1, 7, 7, 24.5],
    [2, 7, 7, 24.5],
    [3, 7, 7, 24.5],
    [4, 7, 7, 24.5],
  ]);
  assert.deepEqual(
    value.creditedVolumeAnalysis.musclesBelowCreditedTarget,
    MUSCLE_GROUPS,
  );
  assertInvariants(value);
});

test('uses custom volume and quarter-credit policies explicitly', () => {
  const customVolume = requireValid(
    allocateV15({ volumePolicy: policyWithTargets(3) }),
  );
  const quarterCredit = requireValid(
    allocateV15({ indirectSetCredit: 0.25 }),
  );

  assert.ok(
    customVolume.creditedVolumeAnalysis.muscles.every(
      (status) =>
        status.targetSetsPerWeek === 3 && status.totalCreditedSets <= 3,
    ),
  );
  assert.deepEqual(
    totalCreditedSets(quarterCredit.creditedVolumeAnalysis),
    [8, 10, 10, 9.25, 10, 9.5, 9.75, 9.25, 8, 8],
  );
  assert.equal(weeklySetCount(quarterCredit.allocation), 76);
  assert.deepEqual(durationRows(quarterCredit.durationAnalysis), [
    [1, 7, 21, 52.5],
    [2, 7, 19, 48.5],
    [3, 7, 18, 46.5],
    [4, 7, 18, 46.5],
  ]);
  assertInvariants(customVolume);
  assertInvariants(quarterCredit);
});

test('handles limited and zero equipment without inventing exercises', () => {
  const limitedEquipment = ['dumbbell', 'bench', 'bodyweight'];
  const limited = requireValid(
    allocateV15({ week: buildWeek(limitedEquipment) }),
  );
  const zero = requireValid(allocateV15({ week: buildWeek([]) }));

  assert.equal(weeklySetCount(limited.allocation), 40);
  assert.deepEqual(durationRows(limited.durationAnalysis), [
    [1, 6, 16, 41],
    [2, 1, 4, 9.5],
    [3, 6, 16, 41],
    [4, 1, 4, 9.5],
  ]);
  assert.deepEqual(
    limited.creditedVolumeAnalysis.musclesBelowCreditedTarget,
    ['chest', 'back', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs'],
  );
  assert.deepEqual(zero.allocation, { days: [] });
  assert.equal(weeklySetCount(zero.allocation), 0);
  assert.deepEqual(
    durationRows(zero.durationAnalysis),
    buildWeek([]).days.map((day) => [day.day.order, 0, 0, 0]),
  );
  assert.deepEqual(
    zero.creditedVolumeAnalysis.musclesBelowCreditedTarget,
    MUSCLE_GROUPS,
  );
  assertInvariants(limited);
  assertInvariants(zero);
});

test('propagates set, credit, volume, and duration validation errors', () => {
  for (const maxSetsPerExerciseOccurrence of [
    0,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    assertInvalid(
      allocateV15({ maxSetsPerExerciseOccurrence }),
      'maxSetsPerExerciseOccurrence must be a positive integer',
    );
  }

  for (const indirectSetCredit of [
    -0.1,
    1.1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    assertInvalid(
      allocateV15({ indirectSetCredit }),
      'creditPolicy.indirectSetCredit must be a finite number between 0 and 1',
    );
  }

  assertInvalid(
    allocateV15({ sessionDurationMinutes: 29 }),
    'sessionDurationMinutes must be an integer between 30 and 120',
  );
  assertInvalid(
    allocateV15({
      durationModel: {
        minutesPerSet: 0,
        minutesPerExerciseOverhead: 1,
      },
    }),
    'minutesPerSet must be a positive finite number',
  );
  assertInvalid(
    allocateV15({
      volumePolicy: policyWithTargets(10, { chest: 0 }),
    }),
    'targetSetsPerWeek for chest must be a positive integer',
  );
});

test('is deterministic and does not mutate inputs, catalog, or muscle order', () => {
  const week = buildWeek();
  const volumePolicy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const creditPolicy = { indirectSetCredit: 0.5 };
  const setConstraints = { maxSetsPerExerciseOccurrence: 4 };
  const durationConstraint = {
    sessionDurationMinutes: 60,
    durationModel: { ...MODEL_B },
  };
  const snapshots = [
    JSON.stringify(week),
    JSON.stringify(volumePolicy),
    JSON.stringify(creditPolicy),
    JSON.stringify(setConstraints),
    JSON.stringify(durationConstraint),
    JSON.stringify(EXERCISE_CATALOG),
    JSON.stringify(MUSCLE_GROUPS),
  ];
  const first = allocateWeeklyCreditedSetsWithinDuration(
    week,
    volumePolicy,
    creditPolicy,
    setConstraints,
    durationConstraint,
  );
  const second = allocateWeeklyCreditedSetsWithinDuration(
    week,
    volumePolicy,
    creditPolicy,
    setConstraints,
    durationConstraint,
  );

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.deepEqual(
    requireValid(first).creditedVolumeAnalysis.muscles.map(
      (status) => status.muscle,
    ),
    MUSCLE_GROUPS,
  );
  assert.deepEqual(
    [
      JSON.stringify(week),
      JSON.stringify(volumePolicy),
      JSON.stringify(creditPolicy),
      JSON.stringify(setConstraints),
      JSON.stringify(durationConstraint),
      JSON.stringify(EXERCISE_CATALOG),
      JSON.stringify(MUSCLE_GROUPS),
    ],
    snapshots,
  );
});
