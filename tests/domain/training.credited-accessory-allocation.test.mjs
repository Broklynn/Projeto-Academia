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
  augmentWeeklyCreditedSetTargetsWithAccessoriesWithinDuration,
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

function runV16({
  week = buildWeek(),
  availableEquipment = ALL_EQUIPMENT,
  volumePolicy = buildDefaultHypertrophyWeeklyVolumePolicy(),
  indirectSetCredit = 0.5,
  maxSetsPerExerciseOccurrence = 4,
  maxAdditionalExercisesPerDay = 2,
  sessionDurationMinutes = 60,
  durationModel = MODEL_B,
} = {}) {
  return augmentWeeklyCreditedSetTargetsWithAccessoriesWithinDuration(
    week,
    availableEquipment,
    volumePolicy,
    { indirectSetCredit },
    { maxSetsPerExerciseOccurrence },
    { maxAdditionalExercisesPerDay },
    { sessionDurationMinutes, durationModel },
  );
}

function runV15({
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

function allocatedSetsFor(value, dayOrder, exerciseId) {
  return value.allocation.days
    .find((day) => day.dayOrder === dayOrder)
    ?.exercises.find((exercise) => exercise.exerciseId === exerciseId)?.sets ?? 0;
}

function additionRows(value) {
  return value.accessoryAdditions.map((addition) => [
    addition.dayOrder,
    addition.exercise.id,
    addition.exercise.name,
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

function assertInvariants(value) {
  assert.deepEqual(value.creditedVolumeAnalysis.musclesAboveCreditedTarget, []);
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
  value.week.days.forEach((day) => {
    const ids = day.exercises.map((exercise) => exercise.id);
    assert.equal(new Set(ids).size, ids.length);
  });
}

test('improves the real model B sixty week by credited volume and reports exact cost', () => {
  const week = buildWeek();
  const v15 = requireValid(runV15({ week }));
  const v16 = requireValid(runV16({ week }));

  assert.equal(weeklySetCount(v15.allocation), 68);
  assert.deepEqual(durationRows(v15.durationAnalysis), [
    [1, 7, 16, 42.5],
    [2, 7, 19, 48.5],
    [3, 7, 16, 42.5],
    [4, 7, 17, 44.5],
  ]);
  assert.deepEqual(totalCreditedSets(v15.creditedVolumeAnalysis), [
    4, 10, 10, 10, 10, 10, 10, 10, 8, 8,
  ]);
  assert.deepEqual(v15.creditedVolumeAnalysis.musclesBelowCreditedTarget, [
    'chest',
    'calves',
    'abs',
  ]);

  assert.equal(weeklySetCount(v16.allocation), 72);
  assert.deepEqual(additionRows(v16), [
    [1, 'incline-barbell-bench-press', 'Supino Inclinado com Barra', 2],
    [2, 'seated-calf-raise', 'Elevação de Panturrilha Sentado', 3],
    [2, 'hanging-leg-raise', 'Elevação de Pernas Suspenso', 3],
  ]);
  assert.deepEqual(durationRows(v16.durationAnalysis), [
    [1, 8, 18, 48],
    [2, 9, 23, 59.5],
    [3, 7, 14, 38.5],
    [4, 7, 17, 44.5],
  ]);
  assert.deepEqual(creditedRows(v16.creditedVolumeAnalysis), {
    chest: [10, 6, 0, 0, 6, 4, 0],
    back: [10, 8, 4, 2, 10, 0, 0],
    shoulders: [10, 7, 6, 3, 10, 0, 0],
    biceps: [10, 6, 8, 4, 10, 0, 0],
    triceps: [10, 5, 10, 5, 10, 0, 0],
    quadriceps: [10, 9, 2, 1, 10, 0, 0],
    hamstrings: [10, 7, 6, 3, 10, 0, 0],
    glutes: [10, 8, 4, 2, 10, 0, 0],
    calves: [10, 10, 0, 0, 10, 0, 0],
    abs: [10, 10, 0, 0, 10, 0, 0],
  });
  assert.deepEqual(v16.creditedVolumeAnalysis.musclesBelowCreditedTarget, [
    'chest',
  ]);
  assert.deepEqual(v16.creditedVolumeAnalysis.musclesAtCreditedTarget, [
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'quadriceps',
    'hamstrings',
    'glutes',
    'calves',
    'abs',
  ]);
  assertInvariants(v16);
});

test('uses a ready V13 augmented week strictly as input', () => {
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
  const v15 = requireValid(runV15({ week: v13.week, volumePolicy }));
  const v16 = requireValid(runV16({ week: v13.week, volumePolicy }));

  assert.equal(weeklySetCount(v15.allocation), 72);
  assert.deepEqual(durationRows(v15.durationAnalysis), [
    [1, 7, 16, 42.5],
    [2, 8, 22, 56],
    [3, 8, 16, 44],
    [4, 8, 18, 48],
  ]);
  assert.deepEqual(totalCreditedSets(v15.creditedVolumeAnalysis), [
    6, 10, 10, 10, 10, 10, 10, 10, 10, 10,
  ]);
  assert.deepEqual(v16.accessoryAdditions, []);
  assert.equal(v16.week, v13.week);
  assert.deepEqual(v16.allocation, v15.allocation);
  assert.deepEqual(v16.creditedVolumeAnalysis, v15.creditedVolumeAnalysis);
  assert.deepEqual(v16.durationAnalysis, v15.durationAnalysis);
  assert.deepEqual(v16.creditedVolumeAnalysis.musclesBelowCreditedTarget, [
    'chest',
  ]);
  assertInvariants(v16);
});

test('reports exact model A sixty and model B forty-five and thirty results', () => {
  const week = buildWeek();
  const modelA = requireValid(runV16({ week, durationModel: MODEL_A }));
  const fortyFive = requireValid(
    runV16({ week, sessionDurationMinutes: 45 }),
  );
  const thirty = requireValid(
    runV16({ week, sessionDurationMinutes: 30 }),
  );

  assert.equal(weeklySetCount(modelA.allocation), 72);
  assert.deepEqual(additionRows(modelA), [
    [1, 'incline-barbell-bench-press', 'Supino Inclinado com Barra', 2],
    [2, 'seated-calf-raise', 'Elevação de Panturrilha Sentado', 3],
    [2, 'hanging-leg-raise', 'Elevação de Pernas Suspenso', 3],
  ]);
  assert.deepEqual(durationRows(modelA.durationAnalysis), [
    [1, 8, 18, 35],
    [2, 9, 25, 46.5],
    [3, 7, 14, 28],
    [4, 7, 15, 29.5],
  ]);
  assert.deepEqual(modelA.creditedVolumeAnalysis.musclesBelowCreditedTarget, [
    'chest',
  ]);

  assert.equal(weeklySetCount(fortyFive.allocation), 66);
  assert.deepEqual(additionRows(fortyFive), [
    [1, 'incline-barbell-bench-press', 'Supino Inclinado com Barra', 2],
  ]);
  assert.deepEqual(durationRows(fortyFive.durationAnalysis), [
    [1, 8, 16, 44],
    [2, 7, 17, 44.5],
    [3, 7, 16, 42.5],
    [4, 7, 17, 44.5],
  ]);
  assert.deepEqual(
    fortyFive.creditedVolumeAnalysis.musclesBelowCreditedTarget,
    ['chest', 'calves', 'abs'],
  );

  assert.equal(weeklySetCount(thirty.allocation), 36);
  assert.deepEqual(thirty.accessoryAdditions, []);
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
  [modelA, fortyFive, thirty].forEach(assertInvariants);
});

test('zero accessory capacity is exactly equivalent to V15', () => {
  const week = buildWeek();
  const volumePolicy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const v15 = requireValid(runV15({ week, volumePolicy }));
  const v16 = requireValid(
    runV16({
      week,
      volumePolicy,
      maxAdditionalExercisesPerDay: 0,
    }),
  );

  assert.equal(v16.week, week);
  assert.deepEqual(v16.accessoryAdditions, []);
  assert.deepEqual(v16.allocation, v15.allocation);
  assert.deepEqual(v16.creditedVolumeAnalysis, v15.creditedVolumeAnalysis);
  assert.deepEqual(v16.durationAnalysis, v15.durationAnalysis);
  assertInvariants(v16);
});

test('credit zero reduces to direct semantics and matches equivalent V13', () => {
  const week = buildWeek();
  const volumePolicy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const v13 = requireValid(
    augmentWeeklyDirectSetTargetsWithAccessoriesWithinDuration(
      week,
      ALL_EQUIPMENT,
      volumePolicy,
      { maxSetsPerExerciseOccurrence: 4 },
      { maxAdditionalExercisesPerDay: 2 },
      { sessionDurationMinutes: 60, durationModel: MODEL_B },
    ),
  );
  const v16 = requireValid(
    runV16({ week, volumePolicy, indirectSetCredit: 0 }),
  );

  assert.deepEqual(v16.week, v13.week);
  assert.deepEqual(v16.accessoryAdditions, v13.accessoryAdditions);
  assert.deepEqual(v16.allocation, v13.allocation);
  assert.deepEqual(v16.durationAnalysis, v13.durationAnalysis);
  assert.equal(weeklySetCount(v16.allocation), 91);
  assert.deepEqual(additionRows(v16), [
    [3, 'barbell-bench-press', 'Supino Reto com Barra', 3],
    [4, 'standing-calf-raise', 'Elevação de Panturrilha em Pé', 3],
    [2, 'hanging-leg-raise', 'Elevação de Pernas Suspenso', 3],
  ]);
  assert.deepEqual(totalCreditedSets(v16.creditedVolumeAnalysis), [
    10, 10, 10, 8, 8, 10, 10, 10, 10, 10,
  ]);
  assert.deepEqual(v16.creditedVolumeAnalysis.musclesBelowCreditedTarget, [
    'biceps',
    'triceps',
  ]);
  for (let index = 0; index < MUSCLE_GROUPS.length; index += 1) {
    assert.equal(
      v16.creditedVolumeAnalysis.muscles[index].totalCreditedSets,
      v13.volumeAnalysis.muscles[index].allocatedDirectSets,
    );
  }
  assertInvariants(v16);
});

test('respects cap one, total indirect credit, and custom targets', () => {
  const capOne = requireValid(
    runV16({ maxSetsPerExerciseOccurrence: 1 }),
  );
  const totalCredit = requireValid(runV16({ indirectSetCredit: 1 }));
  const custom = requireValid(
    runV16({
      volumePolicy: policyWithTargets(3),
      maxSetsPerExerciseOccurrence: 1,
    }),
  );

  assert.equal(weeklySetCount(capOne.allocation), 36);
  assert.equal(capOne.accessoryAdditions.length, 8);
  assert.ok(
    capOne.allocation.days.every((day) =>
      day.exercises.every((exercise) => exercise.sets === 1),
    ),
  );
  assert.deepEqual(durationRows(capOne.durationAnalysis), [
    [1, 9, 9, 31.5],
    [2, 9, 9, 31.5],
    [3, 9, 9, 31.5],
    [4, 9, 9, 31.5],
  ]);

  assert.equal(weeklySetCount(totalCredit.allocation), 59);
  assert.deepEqual(additionRows(totalCredit), [
    [2, 'dumbbell-bulgarian-split-squat', 'Agachamento Búlgaro com Halteres', 1],
    [2, 'seated-calf-raise', 'Elevação de Panturrilha Sentado', 3],
    [4, 'cable-crunch', 'Abdominal na Polia', 3],
  ]);
  assert.deepEqual(totalCreditedSets(totalCredit.creditedVolumeAnalysis), [
    4, 10, 10, 10, 10, 10, 10, 10, 10, 10,
  ]);

  assert.equal(weeklySetCount(custom.allocation), 21);
  assert.deepEqual(additionRows(custom), [
    [2, 'seated-calf-raise', 'Elevação de Panturrilha Sentado', 1],
    [2, 'hanging-leg-raise', 'Elevação de Pernas Suspenso', 1],
  ]);
  assert.ok(
    custom.creditedVolumeAnalysis.muscles.every(
      (status) =>
        status.targetSetsPerWeek === 3 && status.totalCreditedSets <= 3,
    ),
  );
  assert.deepEqual(custom.creditedVolumeAnalysis.musclesBelowCreditedTarget, [
    'chest',
    'back',
    'triceps',
  ]);
  [capOne, totalCredit, custom].forEach(assertInvariants);
});

test('respects limited and zero equipment without inventing accessories', () => {
  const equipment = ['dumbbell', 'bench', 'bodyweight'];
  const limited = requireValid(
    runV16({
      week: buildWeek(equipment),
      availableEquipment: equipment,
    }),
  );
  const zeroWeek = buildWeek([]);
  const zero = requireValid(
    runV16({ week: zeroWeek, availableEquipment: [] }),
  );

  assert.equal(weeklySetCount(limited.allocation), 50);
  assert.deepEqual(additionRows(limited), [
    [1, 'incline-dumbbell-press', 'Supino Inclinado com Halteres', 2],
    [2, 'dumbbell-bulgarian-split-squat', 'Agachamento Búlgaro com Halteres', 4],
    [2, 'walking-lunge', 'Avanço Caminhando', 3],
    [4, 'dumbbell-bulgarian-split-squat', 'Agachamento Búlgaro com Halteres', 3],
  ]);
  assert.ok(
    limited.accessoryAdditions.every((addition) =>
      addition.exercise.equipment.every((item) => equipment.includes(item)),
    ),
  );
  assert.deepEqual(limited.creditedVolumeAnalysis.musclesBelowCreditedTarget, [
    'chest',
    'back',
    'hamstrings',
    'calves',
    'abs',
  ]);

  assert.equal(zero.week, zeroWeek);
  assert.deepEqual(zero.accessoryAdditions, []);
  assert.deepEqual(zero.allocation, { days: [] });
  assert.deepEqual(
    zero.creditedVolumeAnalysis.musclesBelowCreditedTarget,
    MUSCLE_GROUPS,
  );
  assert.deepEqual(
    durationRows(zero.durationAnalysis),
    zeroWeek.days.map((day) => [day.day.order, 0, 0, 0]),
  );
  assertInvariants(limited);
  assertInvariants(zero);
});

test('rejects a canonical primary candidate through real secondary credit and continues', () => {
  const structuralWeek = buildWeek();
  const tricepsPushdown = EXERCISE_CATALOG.find(
    (exercise) => exercise.id === 'cable-triceps-pushdown',
  );
  assert.ok(tricepsPushdown);
  const week = {
    ...structuralWeek,
    days: [
      {
        ...structuralWeek.days[0],
        exercises: [tricepsPushdown],
      },
    ],
  };
  const value = requireValid(
    runV16({
      week,
      availableEquipment: ['barbell', 'bench', 'cable'],
      volumePolicy: policyWithTargets(10, { chest: 2, triceps: 1 }),
      maxSetsPerExerciseOccurrence: 2,
      maxAdditionalExercisesPerDay: 1,
    }),
  );

  assert.deepEqual(additionRows(value), [
    [1, 'cable-chest-fly', 'Crucifixo na Polia', 2],
  ]);
  assert.ok(
    !value.week.days[0].exercises.some(
      (exercise) => exercise.id === 'barbell-bench-press',
    ),
  );
  assert.equal(
    value.creditedVolumeAnalysis.muscles.find(
      (status) => status.muscle === 'triceps',
    ).totalCreditedSets,
    1,
  );
  assert.equal(
    value.creditedVolumeAnalysis.muscles.find(
      (status) => status.muscle === 'chest',
    ).remainingCreditedSetsToTarget,
    0,
  );
  assertInvariants(value);
});

test('rejects the first time-blocked chest candidate and continues on a later day', () => {
  const week = buildWeek();
  const v15 = requireValid(runV15({ week, indirectSetCredit: 0 }));
  const value = requireValid(runV16({ week, indirectSetCredit: 0 }));

  assert.equal(
    v15.durationAnalysis.days[0].estimatedDurationMinutes,
    58.5,
  );
  assert.ok(
    !value.accessoryAdditions.some(
      (addition) =>
        addition.dayOrder === 1 &&
        addition.exercise.id === 'incline-barbell-bench-press',
    ),
  );
  assert.deepEqual(additionRows(value)[0], [
    3,
    'barbell-bench-press',
    'Supino Reto com Barra',
    3,
  ]);
  assert.equal(
    value.creditedVolumeAnalysis.muscles.find(
      (status) => status.muscle === 'chest',
    ).remainingCreditedSetsToTarget,
    0,
  );
  assertInvariants(value);
});

test('preserves the known V10, V13, and V15 regression results', () => {
  const week = buildWeek();
  const volumePolicy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const v10 = requireValid(
    augmentWeeklyDirectSetTargetsWithAccessories(
      week,
      ALL_EQUIPMENT,
      volumePolicy,
      { maxSetsPerExerciseOccurrence: 4 },
      { maxAdditionalExercisesPerDay: 2 },
    ),
  );
  const v13 = requireValid(
    augmentWeeklyDirectSetTargetsWithAccessoriesWithinDuration(
      week,
      ALL_EQUIPMENT,
      volumePolicy,
      { maxSetsPerExerciseOccurrence: 4 },
      { maxAdditionalExercisesPerDay: 2 },
      { sessionDurationMinutes: 60, durationModel: MODEL_B },
    ),
  );
  const v15 = requireValid(runV15({ week, volumePolicy }));

  assert.deepEqual(
    v10.accessoryAdditions.map((addition) => [
      addition.dayOrder,
      addition.exercise.id,
    ]),
    [
      [1, 'incline-barbell-bench-press'],
      [1, 'dumbbell-curl'],
      [3, 'cable-triceps-pushdown'],
      [2, 'seated-calf-raise'],
      [2, 'hanging-leg-raise'],
    ],
  );
  assert.deepEqual(
    v13.accessoryAdditions.map((addition) => [
      addition.dayOrder,
      addition.exercise.id,
    ]),
    [
      [3, 'barbell-bench-press'],
      [4, 'standing-calf-raise'],
      [2, 'hanging-leg-raise'],
    ],
  );
  assert.equal(weeklySetCount(v15.allocation), 68);
  assert.deepEqual(totalCreditedSets(v15.creditedVolumeAnalysis), [
    4, 10, 10, 10, 10, 10, 10, 10, 8, 8,
  ]);
});

test('propagates accessory, V15, policy, credit, and duration errors', () => {
  for (const maxAdditionalExercisesPerDay of [
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    assertInvalid(
      runV16({ maxAdditionalExercisesPerDay }),
      'maxAdditionalExercisesPerDay must be a non-negative integer',
    );
  }
  assertInvalid(
    runV16({ maxSetsPerExerciseOccurrence: 0 }),
    'maxSetsPerExerciseOccurrence must be a positive integer',
  );
  assertInvalid(
    runV16({ indirectSetCredit: 1.1 }),
    'indirectSetCredit must be a finite number between 0 and 1',
  );
  assertInvalid(
    runV16({ sessionDurationMinutes: 29 }),
    'sessionDurationMinutes must be an integer between 30 and 120',
  );
  assertInvalid(
    runV16({
      durationModel: {
        minutesPerSet: 0,
        minutesPerExerciseOverhead: 1,
      },
    }),
    'minutesPerSet must be a positive finite number',
  );
  assertInvalid(
    runV16({ volumePolicy: policyWithTargets(10, { chest: 0 }) }),
    'targetSetsPerWeek for chest must be a positive integer',
  );
});

test('is deterministic, immutable, canonical, and preserves missing patterns', () => {
  const week = buildWeek();
  const equipment = [...ALL_EQUIPMENT];
  const volumePolicy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const creditPolicy = { indirectSetCredit: 0.5 };
  const setConstraints = { maxSetsPerExerciseOccurrence: 4 };
  const accessoryConstraints = { maxAdditionalExercisesPerDay: 2 };
  const durationConstraint = {
    sessionDurationMinutes: 60,
    durationModel: { ...MODEL_B },
  };
  const snapshots = [
    JSON.stringify(week),
    JSON.stringify(equipment),
    JSON.stringify(volumePolicy),
    JSON.stringify(creditPolicy),
    JSON.stringify(setConstraints),
    JSON.stringify(accessoryConstraints),
    JSON.stringify(durationConstraint),
    JSON.stringify(EXERCISE_CATALOG),
    JSON.stringify(MUSCLE_GROUPS),
  ];
  const args = [
    week,
    equipment,
    volumePolicy,
    creditPolicy,
    setConstraints,
    accessoryConstraints,
    durationConstraint,
  ];
  const first = augmentWeeklyCreditedSetTargetsWithAccessoriesWithinDuration(
    ...args,
  );
  const second = augmentWeeklyCreditedSetTargetsWithAccessoriesWithinDuration(
    ...args,
  );
  const value = requireValid(first);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  value.week.days.forEach((day, dayIndex) => {
    const originalIds = week.days[dayIndex].exercises.map(
      (exercise) => exercise.id,
    );
    assert.deepEqual(
      day.exercises.slice(0, originalIds.length).map((exercise) => exercise.id),
      originalIds,
    );
    assert.deepEqual(day.missingPatterns, week.days[dayIndex].missingPatterns);
  });
  assert.deepEqual(
    [
      JSON.stringify(week),
      JSON.stringify(equipment),
      JSON.stringify(volumePolicy),
      JSON.stringify(creditPolicy),
      JSON.stringify(setConstraints),
      JSON.stringify(accessoryConstraints),
      JSON.stringify(durationConstraint),
      JSON.stringify(EXERCISE_CATALOG),
      JSON.stringify(MUSCLE_GROUPS),
    ],
    snapshots,
  );
  assertInvariants(value);
});
