import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseData from '../../.expo/domain-tests/data/exercises/index.js';
import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingDomain from '../../.expo/domain-tests/domain/training/index.js';
import trainingFeature from '../../.expo/domain-tests/features/training/index.js';

const { EXERCISE_CATALOG } = exerciseData;
const { EQUIPMENT, MUSCLE_GROUPS } = exerciseDomain;
const {
  DEFAULT_HYPERTROPHY_INDIRECT_SET_CREDIT,
  buildDefaultHypertrophySetCreditPolicy,
  buildDefaultHypertrophyWeeklyVolumePolicy,
} = trainingDomain;
const {
  analyzeWeeklyCreditedSetVolume,
  analyzeWeeklyDirectSetVolume,
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

function buildV13Scenario(
  availableEquipment = ALL_EQUIPMENT,
  sessionDurationMinutes = 60,
  durationModel = MODEL_B,
) {
  const week = buildWeek(availableEquipment);
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const result = augmentWeeklyDirectSetTargetsWithAccessoriesWithinDuration(
    week,
    availableEquipment,
    policy,
    { maxSetsPerExerciseOccurrence: 4 },
    { maxAdditionalExercisesPerDay: 2 },
    { sessionDurationMinutes, durationModel },
  );

  return { week, policy, value: requireValid(result) };
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

function analyze(
  week,
  allocation,
  indirectSetCredit = DEFAULT_HYPERTROPHY_INDIRECT_SET_CREDIT,
  volumePolicy = buildDefaultHypertrophyWeeklyVolumePolicy(),
) {
  return analyzeWeeklyCreditedSetVolume(
    week,
    allocation,
    volumePolicy,
    { indirectSetCredit },
  );
}

function statusFor(analysis, muscle) {
  return analysis.muscles.find((status) => status.muscle === muscle);
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

function policyWithTarget(targetSetsPerWeek) {
  return {
    goal: 'hypertrophy',
    muscleTargets: MUSCLE_GROUPS.map((muscle) => ({
      muscle,
      targetSetsPerWeek,
    })),
  };
}

test('defines the reference fractional policy as 0.5', () => {
  const first = buildDefaultHypertrophySetCreditPolicy();
  const second = buildDefaultHypertrophySetCreditPolicy();

  assert.equal(DEFAULT_HYPERTROPHY_INDIRECT_SET_CREDIT, 0.5);
  assert.deepEqual(first, { indirectSetCredit: 0.5 });
  assert.deepEqual(second, { indirectSetCredit: 0.5 });
  assert.notEqual(first, second);

  first.indirectSetCredit = 0;
  assert.equal(second.indirectSetCredit, 0.5);
});

test('counts real indirect sets and applies the default fractional credit', () => {
  const week = buildWeek();
  const allocation = {
    days: [
      {
        dayOrder: 1,
        exercises: [
          { exerciseId: 'barbell-bench-press', sets: 3 },
          { exerciseId: 'barbell-row', sets: 4 },
          { exerciseId: 'barbell-overhead-press', sets: 2 },
        ],
      },
    ],
  };
  const value = requireValid(
    analyzeWeeklyCreditedSetVolume(
      week,
      allocation,
      buildDefaultHypertrophyWeeklyVolumePolicy(),
      buildDefaultHypertrophySetCreditPolicy(),
    ),
  );

  assert.deepEqual(statusFor(value, 'chest'), {
    muscle: 'chest',
    targetSetsPerWeek: 10,
    allocatedDirectSets: 3,
    allocatedIndirectSets: 0,
    creditedIndirectSets: 0,
    totalCreditedSets: 3,
    remainingCreditedSetsToTarget: 7,
    creditedSetsAboveTarget: 0,
  });
  assert.deepEqual(statusFor(value, 'shoulders'), {
    muscle: 'shoulders',
    targetSetsPerWeek: 10,
    allocatedDirectSets: 2,
    allocatedIndirectSets: 3,
    creditedIndirectSets: 1.5,
    totalCreditedSets: 3.5,
    remainingCreditedSetsToTarget: 6.5,
    creditedSetsAboveTarget: 0,
  });
  assert.equal(statusFor(value, 'biceps').allocatedIndirectSets, 4);
  assert.equal(statusFor(value, 'biceps').creditedIndirectSets, 2);
  assert.equal(statusFor(value, 'triceps').allocatedIndirectSets, 5);
  assert.equal(statusFor(value, 'triceps').creditedIndirectSets, 2.5);
});

test('keeps direct accounting exactly equivalent to V8 when credit is zero', () => {
  const { policy, value: v13 } = buildV13Scenario();
  const direct = requireValid(
    analyzeWeeklyDirectSetVolume(v13.week, v13.allocation, policy),
  );
  const credited = requireValid(
    analyze(v13.week, v13.allocation, 0, policy),
  );

  for (let index = 0; index < MUSCLE_GROUPS.length; index += 1) {
    assert.equal(
      credited.muscles[index].allocatedDirectSets,
      direct.muscles[index].allocatedDirectSets,
    );
    assert.equal(
      credited.muscles[index].totalCreditedSets,
      direct.muscles[index].allocatedDirectSets,
    );
    assert.equal(
      credited.muscles[index].remainingCreditedSetsToTarget,
      direct.muscles[index].remainingSetsToTarget,
    );
    assert.equal(
      credited.muscles[index].creditedSetsAboveTarget,
      direct.muscles[index].excessSetsAboveTarget,
    );
  }
  assert.deepEqual(
    credited.musclesBelowCreditedTarget,
    direct.musclesBelowTarget,
  );
  assert.deepEqual(credited.musclesAtCreditedTarget, direct.musclesAtTarget);
  assert.deepEqual(
    credited.musclesAboveCreditedTarget,
    direct.musclesAboveTarget,
  );
});

test('analyzes every muscle in the real V13 model B sixty-minute allocation', () => {
  const { policy, value: v13 } = buildV13Scenario();
  const value = requireValid(
    analyze(v13.week, v13.allocation, 0.5, policy),
  );

  assert.deepEqual(creditedRows(value), {
    chest: [10, 10, 0, 0, 10, 0, 0],
    back: [10, 10, 5, 2.5, 12.5, 0, 2.5],
    shoulders: [10, 10, 10, 5, 15, 0, 5],
    biceps: [10, 8, 10, 5, 13, 0, 3],
    triceps: [10, 8, 15, 7.5, 15.5, 0, 5.5],
    quadriceps: [10, 10, 2, 1, 11, 0, 1],
    hamstrings: [10, 10, 8, 4, 14, 0, 4],
    glutes: [10, 10, 5, 2.5, 12.5, 0, 2.5],
    calves: [10, 10, 0, 0, 10, 0, 0],
    abs: [10, 10, 0, 0, 10, 0, 0],
  });
  assert.deepEqual(value.musclesBelowCreditedTarget, []);
  assert.deepEqual(value.musclesAtCreditedTarget, [
    'chest',
    'calves',
    'abs',
  ]);
  assert.deepEqual(value.musclesAboveCreditedTarget, [
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'quadriceps',
    'hamstrings',
    'glutes',
  ]);
});

test('compares zero, fractional, and total indirect credit on one allocation', () => {
  const { policy, value: v13 } = buildV13Scenario();
  const allocationBefore = JSON.stringify(v13.allocation);
  const directOnly = requireValid(
    analyze(v13.week, v13.allocation, 0, policy),
  );
  const fractional = requireValid(
    analyze(v13.week, v13.allocation, 0.5, policy),
  );
  const totalCounting = requireValid(
    analyze(v13.week, v13.allocation, 1, policy),
  );

  assert.deepEqual(totalCreditedSets(directOnly), [
    10, 10, 10, 8, 8, 10, 10, 10, 10, 10,
  ]);
  assert.deepEqual(totalCreditedSets(fractional), [
    10, 12.5, 15, 13, 15.5, 11, 14, 12.5, 10, 10,
  ]);
  assert.deepEqual(totalCreditedSets(totalCounting), [
    10, 15, 20, 18, 23, 12, 18, 15, 10, 10,
  ]);
  assert.deepEqual(directOnly.musclesBelowCreditedTarget, [
    'biceps',
    'triceps',
  ]);
  assert.deepEqual(fractional.musclesBelowCreditedTarget, []);
  assert.deepEqual(totalCounting.musclesBelowCreditedTarget, []);

  for (let index = 0; index < MUSCLE_GROUPS.length; index += 1) {
    assert.equal(
      directOnly.muscles[index].allocatedIndirectSets,
      fractional.muscles[index].allocatedIndirectSets,
    );
    assert.equal(
      fractional.muscles[index].allocatedIndirectSets,
      totalCounting.muscles[index].allocatedIndirectSets,
    );
  }
  assert.equal(JSON.stringify(v13.allocation), allocationBefore);
});

test('preserves decimal fractional credit without rounding', () => {
  const allocation = {
    days: [
      {
        dayOrder: 1,
        exercises: [{ exerciseId: 'barbell-row', sets: 3 }],
      },
    ],
  };
  const value = requireValid(analyze(buildWeek(), allocation, 0.25));
  const biceps = statusFor(value, 'biceps');

  assert.equal(biceps.allocatedDirectSets, 0);
  assert.equal(biceps.allocatedIndirectSets, 3);
  assert.equal(biceps.creditedIndirectSets, 0.75);
  assert.equal(biceps.totalCreditedSets, 0.75);
  assert.equal(biceps.remainingCreditedSetsToTarget, 9.25);
});

test('keeps secondary work indirect and every primary muscle fully direct', () => {
  const week = buildWeek();
  const allocation = {
    days: [
      {
        dayOrder: 2,
        exercises: [
          { exerciseId: 'barbell-romanian-deadlift', sets: 3 },
        ],
      },
    ],
  };
  const direct = requireValid(
    analyzeWeeklyDirectSetVolume(
      week,
      allocation,
      buildDefaultHypertrophyWeeklyVolumePolicy(),
    ),
  );
  const value = requireValid(analyze(week, allocation));

  assert.equal(statusFor(value, 'hamstrings').allocatedDirectSets, 3);
  assert.equal(statusFor(value, 'glutes').allocatedDirectSets, 3);
  assert.equal(statusFor(value, 'hamstrings').creditedIndirectSets, 0);
  assert.equal(statusFor(value, 'glutes').creditedIndirectSets, 0);
  assert.equal(statusFor(value, 'back').allocatedDirectSets, 0);
  assert.equal(statusFor(value, 'back').allocatedIndirectSets, 3);
  assert.equal(statusFor(value, 'back').creditedIndirectSets, 1.5);
  assert.equal(
    statusFor(value, 'hamstrings').allocatedDirectSets,
    statusFor(direct, 'hamstrings').allocatedDirectSets,
  );
  assert.equal(
    statusFor(value, 'glutes').allocatedDirectSets,
    statusFor(direct, 'glutes').allocatedDirectSets,
  );
});

test('uses the supplied weekly volume policy instead of hardcoding ten', () => {
  const week = buildWeek();
  const allocation = {
    days: [
      {
        dayOrder: 1,
        exercises: [{ exerciseId: 'barbell-bench-press', sets: 2 }],
      },
    ],
  };
  const value = requireValid(
    analyze(week, allocation, 0.5, policyWithTarget(3)),
  );

  assert.deepEqual(statusFor(value, 'chest'), {
    muscle: 'chest',
    targetSetsPerWeek: 3,
    allocatedDirectSets: 2,
    allocatedIndirectSets: 0,
    creditedIndirectSets: 0,
    totalCreditedSets: 2,
    remainingCreditedSetsToTarget: 1,
    creditedSetsAboveTarget: 0,
  });
  assert.equal(statusFor(value, 'shoulders').targetSetsPerWeek, 3);
  assert.equal(statusFor(value, 'shoulders').totalCreditedSets, 1);
  assert.equal(statusFor(value, 'shoulders').remainingCreditedSetsToTarget, 2);
});

test('analyzes the required real V13 comparison scenarios', () => {
  const scenarios = [
    {
      equipment: ALL_EQUIPMENT,
      minutes: 60,
      model: MODEL_A,
      totals: [10, 12.5, 15, 15, 17.5, 11, 14, 12.5, 10, 10],
      below: [],
      at: ['chest', 'calves', 'abs'],
    },
    {
      equipment: ALL_EQUIPMENT,
      minutes: 45,
      model: MODEL_B,
      totals: [6, 13, 13, 9, 10, 11.5, 13.5, 12.5, 5, 5],
      below: ['chest', 'biceps', 'calves', 'abs'],
      at: ['triceps'],
    },
    {
      equipment: ALL_EQUIPMENT,
      minutes: 30,
      model: MODEL_B,
      totals: [4, 8, 6, 5, 5, 7, 8, 8, 2, 2],
      below: MUSCLE_GROUPS,
      at: [],
    },
    {
      equipment: ['dumbbell', 'bench', 'bodyweight'],
      minutes: 60,
      model: MODEL_B,
      totals: [10, 8, 15, 14, 15.5, 10, 5, 10, 0, 8],
      below: ['back', 'hamstrings', 'calves', 'abs'],
      at: ['chest', 'quadriceps', 'glutes'],
    },
    {
      equipment: ['bodyweight'],
      minutes: 60,
      model: MODEL_B,
      totals: [8, 0, 4, 0, 4, 8, 4, 8, 0, 8],
      below: MUSCLE_GROUPS,
      at: [],
    },
    {
      equipment: [],
      minutes: 60,
      model: MODEL_B,
      totals: MUSCLE_GROUPS.map(() => 0),
      below: MUSCLE_GROUPS,
      at: [],
    },
  ];

  for (const scenario of scenarios) {
    const { policy, value: v13 } = buildV13Scenario(
      scenario.equipment,
      scenario.minutes,
      scenario.model,
    );
    const value = requireValid(
      analyze(v13.week, v13.allocation, 0.5, policy),
    );

    assert.deepEqual(totalCreditedSets(value), scenario.totals);
    assert.deepEqual(value.musclesBelowCreditedTarget, scenario.below);
    assert.deepEqual(value.musclesAtCreditedTarget, scenario.at);
    assert.deepEqual(
      value.musclesAboveCreditedTarget,
      value.muscles
        .filter((status) => status.creditedSetsAboveTarget > 0)
        .map((status) => status.muscle),
    );
  }
});

test('returns ordered zero accounting for an empty allocation', () => {
  const value = requireValid(analyze(buildWeek(), { days: [] }));

  assert.deepEqual(
    value.muscles.map((status) => status.muscle),
    MUSCLE_GROUPS,
  );
  for (const status of value.muscles) {
    assert.equal(status.allocatedDirectSets, 0);
    assert.equal(status.allocatedIndirectSets, 0);
    assert.equal(status.creditedIndirectSets, 0);
    assert.equal(status.totalCreditedSets, 0);
    assert.equal(status.remainingCreditedSetsToTarget, 10);
    assert.equal(status.creditedSetsAboveTarget, 0);
  }
  assert.deepEqual(value.musclesBelowCreditedTarget, MUSCLE_GROUPS);
  assert.deepEqual(value.musclesAtCreditedTarget, []);
  assert.deepEqual(value.musclesAboveCreditedTarget, []);
});

test('validates credit policy and propagates V8 allocation and volume errors', () => {
  const week = buildWeek();

  for (const indirectSetCredit of [
    -0.1,
    1.1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    assertInvalid(
      analyze(week, { days: [] }, indirectSetCredit),
      'creditPolicy.indirectSetCredit must be a finite number between 0 and 1',
    );
  }

  for (const indirectSetCredit of [0, 1]) {
    assert.equal(
      analyze(week, { days: [] }, indirectSetCredit).valid,
      true,
    );
  }

  assertInvalid(
    analyze(week, {
      days: [
        {
          dayOrder: 1,
          exercises: [{ exerciseId: 'unknown-exercise', sets: 1 }],
        },
      ],
    }),
    'exerciseId unknown-exercise does not exist in day 1',
  );
  assertInvalid(
    analyze(
      week,
      { days: [] },
      0.5,
      {
        ...buildDefaultHypertrophyWeeklyVolumePolicy(),
        muscleTargets:
          buildDefaultHypertrophyWeeklyVolumePolicy().muscleTargets.slice(0, -1),
      },
    ),
    'policy is missing target for abs',
  );
});

test('is deterministic and does not mutate inputs, catalog, or muscle order', () => {
  const { policy, value: v13 } = buildV13Scenario();
  const creditPolicy = buildDefaultHypertrophySetCreditPolicy();
  const snapshots = [
    JSON.stringify(v13.week),
    JSON.stringify(v13.allocation),
    JSON.stringify(policy),
    JSON.stringify(creditPolicy),
    JSON.stringify(EXERCISE_CATALOG),
    JSON.stringify(MUSCLE_GROUPS),
  ];
  const first = analyzeWeeklyCreditedSetVolume(
    v13.week,
    v13.allocation,
    policy,
    creditPolicy,
  );
  const second = analyzeWeeklyCreditedSetVolume(
    v13.week,
    v13.allocation,
    policy,
    creditPolicy,
  );

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.deepEqual(
    requireValid(first).muscles.map((status) => status.muscle),
    MUSCLE_GROUPS,
  );
  assert.deepEqual(
    [
      JSON.stringify(v13.week),
      JSON.stringify(v13.allocation),
      JSON.stringify(policy),
      JSON.stringify(creditPolicy),
      JSON.stringify(EXERCISE_CATALOG),
      JSON.stringify(MUSCLE_GROUPS),
    ],
    snapshots,
  );
});
