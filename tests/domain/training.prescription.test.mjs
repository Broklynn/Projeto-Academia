import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingDomain from '../../.expo/domain-tests/domain/training/index.js';
import trainingValidation from '../../.expo/domain-tests/domain/training/validation.js';
import trainingFeature from '../../.expo/domain-tests/features/training/index.js';

const { EQUIPMENT } = exerciseDomain;
const { buildDefaultHypertrophyWeeklyVolumePolicy } = trainingDomain;
const { validateWorkoutExercise } = trainingValidation;
const {
  augmentWeeklyCreditedSetTargetsWithAccessoriesWithinDuration,
  buildHypertrophyTrainingSelection,
  prescribeTrainingWeek,
} = trainingFeature;

const ALL_EQUIPMENT = [...EQUIPMENT];
const MODEL_B = {
  minutesPerSet: 2,
  minutesPerExerciseOverhead: 1.5,
};
const DEFAULT_FIXTURE_RULE = {
  repRange: { min: 8, max: 12 },
  restSeconds: 90,
  targetRir: 2,
  notes: 'Fixture de software V17',
};
const OVERRIDE_FIXTURE_RULE = {
  repRange: { min: 5, max: 8 },
  restSeconds: 150,
  targetRir: 3,
  notes: 'Fixture de override V17',
};

function buildWeek() {
  return buildHypertrophyTrainingSelection({
    daysPerWeek: 4,
    availableEquipment: ALL_EQUIPMENT,
  });
}

function policyWith(overrides = [], defaultRule = DEFAULT_FIXTURE_RULE) {
  return {
    defaultRule,
    exerciseOverrides: overrides,
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

function firstDayAllocation(week, structuralIndexes, sets = 2) {
  return {
    days: [
      {
        dayOrder: week.days[0].day.order,
        exercises: structuralIndexes.map((index) => ({
          exerciseId: week.days[0].exercises[index].id,
          sets,
        })),
      },
    ],
  };
}

function flattenExercises(prescription) {
  return prescription.days.flatMap((day) => day.exercises);
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

test('applies the explicit default rule and copies allocated sets', () => {
  const week = buildWeek();
  const allocation = firstDayAllocation(week, [0, 1], 3);
  const value = requireValid(
    prescribeTrainingWeek(week, allocation, policyWith()),
  );

  assert.deepEqual(value, {
    days: [
      {
        dayOrder: 1,
        dayName: week.days[0].day.name,
        exercises: [
          {
            id: `1:${week.days[0].exercises[0].id}`,
            exerciseId: week.days[0].exercises[0].id,
            order: 1,
            sets: 3,
            repRange: { min: 8, max: 12 },
            restSeconds: 90,
            targetRir: 2,
            notes: 'Fixture de software V17',
          },
          {
            id: `1:${week.days[0].exercises[1].id}`,
            exerciseId: week.days[0].exercises[1].id,
            order: 2,
            sets: 3,
            repRange: { min: 8, max: 12 },
            restSeconds: 90,
            targetRir: 2,
            notes: 'Fixture de software V17',
          },
        ],
      },
    ],
  });
  flattenExercises(value).forEach((exercise) => {
    assert.deepEqual(validateWorkoutExercise(exercise), { valid: true });
  });
});

test('uses an exact exercise override without changing other exercises', () => {
  const week = buildWeek();
  const allocation = firstDayAllocation(week, [0, 1]);
  const overriddenExerciseId = week.days[0].exercises[1].id;
  const value = requireValid(
    prescribeTrainingWeek(
      week,
      allocation,
      policyWith([
        {
          exerciseId: overriddenExerciseId,
          rule: OVERRIDE_FIXTURE_RULE,
        },
      ]),
    ),
  );

  assert.deepEqual(value.days[0].exercises[0].repRange, { min: 8, max: 12 });
  assert.equal(value.days[0].exercises[0].restSeconds, 90);
  assert.equal(value.days[0].exercises[0].targetRir, 2);
  assert.deepEqual(value.days[0].exercises[1].repRange, { min: 5, max: 8 });
  assert.equal(value.days[0].exercises[1].restSeconds, 150);
  assert.equal(value.days[0].exercises[1].targetRir, 3);
  assert.equal(value.days[0].exercises[1].notes, 'Fixture de override V17');
});

test('rejects duplicate, empty, and out-of-week overrides', () => {
  const week = buildWeek();
  const exerciseId = week.days[0].exercises[0].id;
  const allocation = firstDayAllocation(week, [0]);

  assertInvalid(
    prescribeTrainingWeek(
      week,
      allocation,
      policyWith([
        { exerciseId, rule: DEFAULT_FIXTURE_RULE },
        { exerciseId, rule: OVERRIDE_FIXTURE_RULE },
      ]),
    ),
    `duplicates ${exerciseId}`,
  );
  assertInvalid(
    prescribeTrainingWeek(
      week,
      allocation,
      policyWith([{ exerciseId: '', rule: DEFAULT_FIXTURE_RULE }]),
    ),
    'exerciseId must not be empty',
  );
  assertInvalid(
    prescribeTrainingWeek(
      week,
      allocation,
      policyWith([
        { exerciseId: 'not-in-week', rule: DEFAULT_FIXTURE_RULE },
      ]),
    ),
    'does not exist in week',
  );
});

test('rejects invalid rep ranges, rest, RIR, and notes in every rule', () => {
  const week = buildWeek();
  const exerciseId = week.days[0].exercises[0].id;
  const allocation = firstDayAllocation(week, [0]);
  const invalidRules = [
    [{ ...DEFAULT_FIXTURE_RULE, repRange: { min: 12, max: 8 } }, 'repRange'],
    [{ ...DEFAULT_FIXTURE_RULE, restSeconds: -1 }, 'restSeconds'],
    [{ ...DEFAULT_FIXTURE_RULE, restSeconds: 90.5 }, 'restSeconds'],
    [{ ...DEFAULT_FIXTURE_RULE, targetRir: -1 }, 'targetRir'],
    [{ ...DEFAULT_FIXTURE_RULE, targetRir: 6 }, 'targetRir'],
    [{ ...DEFAULT_FIXTURE_RULE, notes: 17 }, 'notes'],
  ];

  for (const [rule, expectedErrorFragment] of invalidRules) {
    assertInvalid(
      prescribeTrainingWeek(week, allocation, policyWith([], rule)),
      `policy.defaultRule.${expectedErrorFragment}`,
    );
    assertInvalid(
      prescribeTrainingWeek(
        week,
        allocation,
        policyWith([{ exerciseId, rule }]),
      ),
      `.rule.${expectedErrorFragment}`,
    );
  }
});

test('propagates the common allocation validation without duplicating it', () => {
  const week = buildWeek();
  const exerciseId = week.days[0].exercises[0].id;
  const cases = [
    [
      { days: [{ dayOrder: 99, exercises: [] }] },
      'dayOrder 99 does not exist in week',
    ],
    [
      {
        days: [
          {
            dayOrder: 1,
            exercises: [{ exerciseId: 'unknown', sets: 1 }],
          },
        ],
      },
      'exerciseId unknown does not exist in day 1',
    ],
    [
      {
        days: [
          {
            dayOrder: 1,
            exercises: [
              { exerciseId, sets: 1 },
              { exerciseId, sets: 1 },
            ],
          },
        ],
      },
      `duplicates ${exerciseId} in day`,
    ],
    [
      {
        days: [
          {
            dayOrder: 1,
            exercises: [{ exerciseId, sets: 0 }],
          },
        ],
      },
      'sets must be a positive integer',
    ],
  ];

  for (const [allocation, expectedErrorFragment] of cases) {
    assertInvalid(
      prescribeTrainingWeek(week, allocation, policyWith()),
      expectedErrorFragment,
    );
  }
});

test('returns no days for a zero allocation', () => {
  const value = requireValid(
    prescribeTrainingWeek(buildWeek(), { days: [] }, policyWith()),
  );

  assert.deepEqual(value, { days: [] });
});

test('preserves structural positions in a partial and out-of-order allocation', () => {
  const week = buildWeek();
  const allocatedIndexes = [3, 0, 2];
  const allocation = firstDayAllocation(week, allocatedIndexes);
  const value = requireValid(
    prescribeTrainingWeek(week, allocation, policyWith()),
  );

  assert.deepEqual(
    value.days[0].exercises.map((exercise) => [
      exercise.exerciseId,
      exercise.order,
    ]),
    [
      [week.days[0].exercises[0].id, 1],
      [week.days[0].exercises[2].id, 3],
      [week.days[0].exercises[3].id, 4],
    ],
  );
});

test('creates deterministic unique IDs and copies rep ranges without mutating inputs', () => {
  const week = buildWeek();
  const allocation = {
    days: week.days.slice(0, 2).map((day) => ({
      dayOrder: day.day.order,
      exercises: [{ exerciseId: day.exercises[0].id, sets: 2 }],
    })),
  };
  const policy = policyWith();
  const snapshots = [
    JSON.stringify(week),
    JSON.stringify(allocation),
    JSON.stringify(policy),
  ];
  const first = prescribeTrainingWeek(week, allocation, policy);
  const second = prescribeTrainingWeek(week, allocation, policy);
  const firstValue = requireValid(first);
  const exercises = flattenExercises(firstValue);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(new Set(exercises.map((exercise) => exercise.id)).size, exercises.length);
  firstValue.days.forEach((day) => {
    day.exercises.forEach((exercise) => {
      assert.equal(exercise.id, `${day.dayOrder}:${exercise.exerciseId}`);
    });
  });
  assert.ok(
    exercises.every(
      (exercise) => exercise.repRange !== policy.defaultRule.repRange,
    ),
  );
  exercises[0].repRange.min = 99;
  assert.deepEqual(policy.defaultRule.repRange, { min: 8, max: 12 });
  assert.deepEqual(
    [JSON.stringify(week), JSON.stringify(allocation), JSON.stringify(policy)],
    snapshots,
  );
});

test('transforms the real V16 model B sixty allocation without changing 72 sets', () => {
  const structuralWeek = buildWeek();
  const v16 = requireValid(
    augmentWeeklyCreditedSetTargetsWithAccessoriesWithinDuration(
      structuralWeek,
      ALL_EQUIPMENT,
      buildDefaultHypertrophyWeeklyVolumePolicy(),
      { indirectSetCredit: 0.5 },
      { maxSetsPerExerciseOccurrence: 4 },
      { maxAdditionalExercisesPerDay: 2 },
      { sessionDurationMinutes: 60, durationModel: MODEL_B },
    ),
  );
  const overrideExerciseId = 'incline-barbell-bench-press';
  const policy = policyWith([
    {
      exerciseId: overrideExerciseId,
      rule: OVERRIDE_FIXTURE_RULE,
    },
  ]);
  const prescription = requireValid(
    prescribeTrainingWeek(v16.week, v16.allocation, policy),
  );
  const prescribedExercises = flattenExercises(prescription);
  const allocatedExercises = v16.allocation.days.flatMap((day) => day.exercises);

  assert.equal(weeklySetCount(v16.allocation), 72);
  assert.equal(
    prescribedExercises.reduce((total, exercise) => total + exercise.sets, 0),
    72,
  );
  assert.equal(prescribedExercises.length, allocatedExercises.length);
  assert.equal(
    new Set(prescribedExercises.map((exercise) => exercise.id)).size,
    prescribedExercises.length,
  );
  prescribedExercises.forEach((exercise) => {
    assert.deepEqual(validateWorkoutExercise(exercise), { valid: true });
  });
  for (const day of prescription.days) {
    const allocationDay = v16.allocation.days.find(
      (candidate) => candidate.dayOrder === day.dayOrder,
    );
    assert.ok(allocationDay);
    for (const exercise of day.exercises) {
      assert.equal(
        exercise.sets,
        allocationDay.exercises.find(
          (candidate) => candidate.exerciseId === exercise.exerciseId,
        ).sets,
      );
    }
  }
  const overridden = prescribedExercises.find(
    (exercise) => exercise.exerciseId === overrideExerciseId,
  );
  assert.ok(overridden);
  assert.deepEqual(overridden.repRange, { min: 5, max: 8 });
  assert.equal(overridden.restSeconds, 150);
  assert.equal(overridden.targetRir, 3);
  assert.ok(
    prescribedExercises
      .filter((exercise) => exercise.exerciseId !== overrideExerciseId)
      .every(
        (exercise) =>
          exercise.repRange.min === 8 &&
          exercise.repRange.max === 12 &&
          exercise.restSeconds === 90 &&
          exercise.targetRir === 2,
      ),
  );
});
