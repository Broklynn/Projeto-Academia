import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingDomain from '../../.expo/domain-tests/domain/training/index.js';
import trainingFeature from '../../.expo/domain-tests/features/training/index.js';

const { EQUIPMENT, MUSCLE_GROUPS } = exerciseDomain;
const { buildDefaultHypertrophyWeeklyVolumePolicy } = trainingDomain;
const {
  analyzeWeeklyDirectSetVolume,
  analyzeWeeklyMuscleCoverage,
  buildHypertrophyTrainingSelection,
} = trainingFeature;

const ALL_EQUIPMENT = [...EQUIPMENT];

function buildWeek() {
  return buildHypertrophyTrainingSelection({
    daysPerWeek: 4,
    availableEquipment: ALL_EQUIPMENT,
  });
}

function allocationForEveryExercise(week, sets) {
  return {
    days: week.days.map((daySelection) => ({
      dayOrder: daySelection.day.order,
      exercises: daySelection.exercises.map((exercise) => ({
        exerciseId: exercise.id,
        sets,
      })),
    })),
  };
}

function chestAllocation(setsPerExercise) {
  return {
    days: [
      {
        dayOrder: 1,
        exercises: [
          { exerciseId: 'barbell-bench-press', sets: setsPerExercise },
        ],
      },
      {
        dayOrder: 3,
        exercises: [
          {
            exerciseId: 'incline-barbell-bench-press',
            sets: setsPerExercise,
          },
        ],
      },
    ],
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

function statusFor(analysis, muscle) {
  return analysis.muscles.find((status) => status.muscle === muscle);
}

function analyze(week, allocation, policy = buildDefaultHypertrophyWeeklyVolumePolicy()) {
  return analyzeWeeklyDirectSetVolume(week, allocation, policy);
}

test('counts explicit direct sets and accepts a partial allocation', () => {
  const week = buildWeek();
  const allocation = {
    days: [
      {
        dayOrder: 1,
        exercises: [{ exerciseId: 'barbell-bench-press', sets: 3 }],
      },
    ],
  };
  const analysis = requireValid(analyze(week, allocation));

  assert.deepEqual(statusFor(analysis, 'chest'), {
    muscle: 'chest',
    targetSetsPerWeek: 10,
    allocatedDirectSets: 3,
    remainingSetsToTarget: 7,
    excessSetsAboveTarget: 0,
  });
  assert.equal(statusFor(analysis, 'shoulders').allocatedDirectSets, 0);
  assert.equal(statusFor(analysis, 'triceps').allocatedDirectSets, 0);
});

test('classifies a muscle exactly at its policy target', () => {
  const analysis = requireValid(analyze(buildWeek(), chestAllocation(5)));

  assert.deepEqual(statusFor(analysis, 'chest'), {
    muscle: 'chest',
    targetSetsPerWeek: 10,
    allocatedDirectSets: 10,
    remainingSetsToTarget: 0,
    excessSetsAboveTarget: 0,
  });
  assert.deepEqual(analysis.musclesAtTarget, ['chest']);
  assert.ok(!analysis.musclesBelowTarget.includes('chest'));
  assert.ok(!analysis.musclesAboveTarget.includes('chest'));
});

test('reports excess without capping allocations above target', () => {
  const analysis = requireValid(analyze(buildWeek(), chestAllocation(6)));

  assert.deepEqual(statusFor(analysis, 'chest'), {
    muscle: 'chest',
    targetSetsPerWeek: 10,
    allocatedDirectSets: 12,
    remainingSetsToTarget: 0,
    excessSetsAboveTarget: 2,
  });
  assert.deepEqual(analysis.musclesAboveTarget, ['chest']);
});

test('reports remaining sets for an allocation below target', () => {
  const analysis = requireValid(analyze(buildWeek(), chestAllocation(3)));

  assert.deepEqual(statusFor(analysis, 'chest'), {
    muscle: 'chest',
    targetSetsPerWeek: 10,
    allocatedDirectSets: 6,
    remainingSetsToTarget: 4,
    excessSetsAboveTarget: 0,
  });
  assert.ok(analysis.musclesBelowTarget.includes('chest'));
});

test('treats an empty weekly allocation as valid zero direct sets', () => {
  const analysis = requireValid(analyze(buildWeek(), { days: [] }));

  assert.deepEqual(
    analysis.muscles.map(
      ({ muscle, targetSetsPerWeek, allocatedDirectSets, remainingSetsToTarget, excessSetsAboveTarget }) => [
        muscle,
        targetSetsPerWeek,
        allocatedDirectSets,
        remainingSetsToTarget,
        excessSetsAboveTarget,
      ],
    ),
    MUSCLE_GROUPS.map((muscle) => [muscle, 10, 0, 10, 0]),
  );
  assert.deepEqual(analysis.musclesBelowTarget, MUSCLE_GROUPS);
  assert.deepEqual(analysis.musclesAtTarget, []);
  assert.deepEqual(analysis.musclesAboveTarget, []);
});

test('matches occurrence counts only in the explicit one-set fixture', () => {
  const week = buildWeek();
  const coverage = analyzeWeeklyMuscleCoverage(week);
  const analysis = requireValid(
    analyze(week, allocationForEveryExercise(week, 1)),
  );

  for (let index = 0; index < MUSCLE_GROUPS.length; index += 1) {
    assert.equal(
      analysis.muscles[index].allocatedDirectSets,
      coverage.muscles[index].exerciseOccurrenceCount,
    );
  }
  assert.deepEqual(analysis.musclesBelowTarget, MUSCLE_GROUPS);
});

test('multiplies real allocated sets in the explicit three-set fixture', () => {
  const week = buildWeek();
  const analysis = requireValid(
    analyze(week, allocationForEveryExercise(week, 3)),
  );

  assert.deepEqual(
    Object.fromEntries(
      analysis.muscles.map((status) => [
        status.muscle,
        [
          status.targetSetsPerWeek,
          status.allocatedDirectSets,
          status.remainingSetsToTarget,
          status.excessSetsAboveTarget,
        ],
      ]),
    ),
    {
      chest: [10, 6, 4, 0],
      back: [10, 12, 0, 2],
      shoulders: [10, 12, 0, 2],
      biceps: [10, 6, 4, 0],
      triceps: [10, 6, 4, 0],
      quadriceps: [10, 12, 0, 2],
      hamstrings: [10, 12, 0, 2],
      glutes: [10, 12, 0, 2],
      calves: [10, 6, 4, 0],
      abs: [10, 6, 4, 0],
    },
  );
  assert.deepEqual(analysis.musclesBelowTarget, [
    'chest',
    'biceps',
    'triceps',
    'calves',
    'abs',
  ]);
  assert.deepEqual(analysis.musclesAtTarget, []);
  assert.deepEqual(analysis.musclesAboveTarget, [
    'back',
    'shoulders',
    'quadriceps',
    'hamstrings',
    'glutes',
  ]);
});

test('credits all primary muscles fully without crediting secondary muscles', () => {
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
  const analysis = requireValid(analyze(buildWeek(), allocation));

  assert.equal(statusFor(analysis, 'hamstrings').allocatedDirectSets, 3);
  assert.equal(statusFor(analysis, 'glutes').allocatedDirectSets, 3);
  assert.equal(statusFor(analysis, 'back').allocatedDirectSets, 0);
});

test('rejects non-positive, non-integer, and non-finite set values', () => {
  for (const sets of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = analyze(buildWeek(), {
      days: [
        {
          dayOrder: 1,
          exercises: [{ exerciseId: 'barbell-bench-press', sets }],
        },
      ],
    });

    assertInvalid(result, '.sets must be a positive integer');
  }
});

test('rejects a day that does not exist in the selected week', () => {
  const result = analyze(buildWeek(), {
    days: [{ dayOrder: 99, exercises: [] }],
  });

  assertInvalid(result, 'dayOrder 99 does not exist in week');
});

test('rejects unknown exercises and exercises allocated to another day', () => {
  for (const exerciseId of ['unknown-exercise', 'barbell-back-squat']) {
    const result = analyze(buildWeek(), {
      days: [
        {
          dayOrder: 1,
          exercises: [{ exerciseId, sets: 1 }],
        },
      ],
    });

    assertInvalid(result, `exerciseId ${exerciseId} does not exist in day 1`);
  }
});

test('rejects duplicate exercise allocations within a day', () => {
  const result = analyze(buildWeek(), {
    days: [
      {
        dayOrder: 1,
        exercises: [
          { exerciseId: 'barbell-bench-press', sets: 1 },
          { exerciseId: 'barbell-bench-press', sets: 2 },
        ],
      },
    ],
  });

  assertInvalid(result, 'exerciseId duplicates barbell-bench-press in day');
});

test('rejects duplicate day allocations', () => {
  const result = analyze(buildWeek(), {
    days: [
      { dayOrder: 1, exercises: [] },
      { dayOrder: 1, exercises: [] },
    ],
  });

  assertInvalid(result, 'dayOrder duplicates 1');
});

test('rejects incomplete, duplicated, and invalid policy targets', () => {
  const defaultPolicy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const policies = [
    {
      ...defaultPolicy,
      muscleTargets: defaultPolicy.muscleTargets.slice(0, -1),
    },
    {
      ...defaultPolicy,
      muscleTargets: [
        ...defaultPolicy.muscleTargets,
        defaultPolicy.muscleTargets[0],
      ],
    },
    {
      ...defaultPolicy,
      muscleTargets: defaultPolicy.muscleTargets.map((target) =>
        target.muscle === 'chest'
          ? { ...target, targetSetsPerWeek: 0 }
          : target,
      ),
    },
  ];
  const expectedErrors = [
    'policy is missing target for abs',
    'policy contains duplicate target for chest',
    'targetSetsPerWeek for chest must be a positive integer',
  ];

  policies.forEach((policy, index) => {
    assertInvalid(analyze(buildWeek(), { days: [] }, policy), expectedErrors[index]);
  });
});

test('preserves order, is deterministic, and does not mutate inputs', () => {
  const week = buildWeek();
  const allocation = allocationForEveryExercise(week, 3);
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const weekBefore = JSON.stringify(week);
  const allocationBefore = JSON.stringify(allocation);
  const policyBefore = JSON.stringify(policy);
  const muscleGroupsBefore = [...MUSCLE_GROUPS];
  const first = analyze(week, allocation, policy);
  const second = analyze(week, allocation, policy);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.deepEqual(
    requireValid(first).muscles.map((status) => status.muscle),
    MUSCLE_GROUPS,
  );
  assert.equal(JSON.stringify(week), weekBefore);
  assert.equal(JSON.stringify(allocation), allocationBefore);
  assert.equal(JSON.stringify(policy), policyBefore);
  assert.deepEqual(MUSCLE_GROUPS, muscleGroupsBefore);
});
