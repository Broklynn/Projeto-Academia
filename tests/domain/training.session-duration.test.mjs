import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingDomain from '../../.expo/domain-tests/domain/training/index.js';
import trainingFeature from '../../.expo/domain-tests/features/training/index.js';

const { EQUIPMENT } = exerciseDomain;
const { buildDefaultHypertrophyWeeklyVolumePolicy } = trainingDomain;
const {
  allocateWeeklyDirectSets,
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

function allocationForDay(dayOrder, exercises) {
  return { days: [{ dayOrder, exercises }] };
}

function buildV10Prescription() {
  const week = buildWeek();
  const result = requireValid(
    augmentWeeklyDirectSetTargetsWithAccessories(
      week,
      ALL_EQUIPMENT,
      buildDefaultHypertrophyWeeklyVolumePolicy(),
      { maxSetsPerExerciseOccurrence: 4 },
      { maxAdditionalExercisesPerDay: 2 },
    ),
  );

  return { week: result.week, allocation: result.allocation };
}

function buildCapFivePrescription() {
  const week = buildWeek();
  const result = requireValid(
    allocateWeeklyDirectSets(
      week,
      buildDefaultHypertrophyWeeklyVolumePolicy(),
      { maxSetsPerExerciseOccurrence: 5 },
    ),
  );

  return { week, allocation: result.allocation };
}

function durationRows(analysis) {
  return analysis.days.map((day) => [
    day.dayOrder,
    day.allocatedSetCount,
    day.allocatedExerciseCount,
    day.estimatedDurationMinutes,
    day.remainingMinutes,
    day.excessMinutes,
    day.fitsDuration,
  ]);
}

test('calculates nine sets and three exercise overheads as twenty-one minutes', () => {
  const week = buildWeek();
  const analysis = requireValid(
    analyzeWeeklySessionDuration(
      week,
      allocationForDay(1, [
        { exerciseId: 'barbell-bench-press', sets: 4 },
        { exerciseId: 'barbell-row', sets: 3 },
        { exerciseId: 'barbell-overhead-press', sets: 2 },
      ]),
      30,
      { minutesPerSet: 2, minutesPerExerciseOverhead: 1 },
    ),
  );

  assert.deepEqual(analysis.days[0], {
    dayOrder: 1,
    dayName: 'Superior A',
    allocatedExerciseCount: 3,
    allocatedSetCount: 9,
    estimatedDurationMinutes: 21,
    sessionDurationMinutes: 30,
    remainingMinutes: 9,
    excessMinutes: 0,
    fitsDuration: true,
  });
});

test('preserves decimal duration without rounding', () => {
  const week = buildWeek();
  const exercises = week.days[0].exercises.map((exercise, index) => ({
    exerciseId: exercise.id,
    sets: index < 3 ? 3 : 2,
  }));
  const analysis = requireValid(
    analyzeWeeklySessionDuration(
      week,
      allocationForDay(1, exercises),
      60,
      { minutesPerSet: 1.5, minutesPerExerciseOverhead: 0.75 },
    ),
  );

  assert.equal(analysis.days[0].allocatedSetCount, 17);
  assert.equal(analysis.days[0].allocatedExerciseCount, 7);
  assert.equal(analysis.days[0].estimatedDurationMinutes, 30.75);
  assert.equal(analysis.days[0].remainingMinutes, 29.25);
});

test('treats exact equality as fitting the duration', () => {
  const week = buildWeek();
  const analysis = requireValid(
    analyzeWeeklySessionDuration(
      week,
      allocationForDay(1, [
        { exerciseId: 'barbell-bench-press', sets: 4 },
        { exerciseId: 'barbell-row', sets: 3 },
        { exerciseId: 'barbell-overhead-press', sets: 2 },
      ]),
      30,
      { minutesPerSet: 3, minutesPerExerciseOverhead: 1 },
    ),
  );

  assert.equal(analysis.days[0].estimatedDurationMinutes, 30);
  assert.equal(analysis.days[0].remainingMinutes, 0);
  assert.equal(analysis.days[0].excessMinutes, 0);
  assert.equal(analysis.days[0].fitsDuration, true);
});

test('reports one minute excess above and six minutes remaining below', () => {
  const week = buildWeek();
  const above = requireValid(
    analyzeWeeklySessionDuration(
      week,
      allocationForDay(1, [
        { exerciseId: 'barbell-bench-press', sets: 30 },
      ]),
      60,
      { minutesPerSet: 2, minutesPerExerciseOverhead: 1 },
    ),
  );
  const below = requireValid(
    analyzeWeeklySessionDuration(
      week,
      allocationForDay(1, [
        { exerciseId: 'barbell-bench-press', sets: 13 },
        { exerciseId: 'barbell-row', sets: 13 },
      ]),
      60,
      { minutesPerSet: 2, minutesPerExerciseOverhead: 1 },
    ),
  );

  assert.deepEqual(
    [
      above.days[0].estimatedDurationMinutes,
      above.days[0].remainingMinutes,
      above.days[0].excessMinutes,
      above.days[0].fitsDuration,
    ],
    [61, 0, 1, false],
  );
  assert.deepEqual(
    [
      below.days[0].estimatedDurationMinutes,
      below.days[0].remainingMinutes,
      below.days[0].excessMinutes,
      below.days[0].fitsDuration,
    ],
    [54, 6, 0, true],
  );
});

test('treats days without allocated exercises as zero-duration sessions', () => {
  const week = buildWeek();
  const analysis = requireValid(
    analyzeWeeklySessionDuration(week, { days: [] }, 45, MODEL_A),
  );

  assert.deepEqual(
    analysis.days.map((day) => [
      day.allocatedExerciseCount,
      day.allocatedSetCount,
      day.estimatedDurationMinutes,
      day.remainingMinutes,
      day.excessMinutes,
      day.fitsDuration,
    ]),
    week.days.map(() => [0, 0, 0, 45, 0, true]),
  );
  assert.deepEqual(analysis.daysWithinDuration, [1, 2, 3, 4]);
  assert.deepEqual(analysis.daysExceedingDuration, []);
});

test('validates duration model values and accepts decimal inputs and zero overhead', () => {
  const week = buildWeek();

  for (const minutesPerSet of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertInvalid(
      analyzeWeeklySessionDuration(week, { days: [] }, 60, {
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
      analyzeWeeklySessionDuration(week, { days: [] }, 60, {
        minutesPerSet: 1.5,
        minutesPerExerciseOverhead,
      }),
      'minutesPerExerciseOverhead must be a non-negative finite number',
    );
  }

  assert.equal(
    analyzeWeeklySessionDuration(week, { days: [] }, 60, {
      minutesPerSet: 2.75,
      minutesPerExerciseOverhead: 0,
    }).valid,
    true,
  );
});

test('reuses the official session duration limits', () => {
  const week = buildWeek();

  for (const duration of [30, 120]) {
    assert.equal(
      analyzeWeeklySessionDuration(week, { days: [] }, duration, MODEL_A).valid,
      true,
    );
  }

  for (const duration of [29, 121, 60.5, Number.NaN]) {
    assertInvalid(
      analyzeWeeklySessionDuration(week, { days: [] }, duration, MODEL_A),
      'sessionDurationMinutes must be an integer between 30 and 120',
    );
  }
});

test('rejects allocations that do not correspond to the selected week', () => {
  const week = buildWeek();

  assertInvalid(
    analyzeWeeklySessionDuration(
      week,
      allocationForDay(99, []),
      60,
      MODEL_A,
    ),
    'dayOrder 99 does not exist in week',
  );
  assertInvalid(
    analyzeWeeklySessionDuration(
      week,
      allocationForDay(1, [{ exerciseId: 'barbell-back-squat', sets: 3 }]),
      60,
      MODEL_A,
    ),
    'barbell-back-squat does not exist in day 1',
  );
});

test('analyzes the real V10 prescription at sixty minutes with model A', () => {
  const prescription = buildV10Prescription();
  const analysis = requireValid(
    analyzeWeeklySessionDuration(
      prescription.week,
      prescription.allocation,
      60,
      MODEL_A,
    ),
  );

  assert.deepEqual(durationRows(analysis), [
    [1, 30, 9, 54, 6, 0, true],
    [2, 29, 9, 52.5, 7.5, 0, true],
    [3, 20, 8, 38, 22, 0, true],
    [4, 16, 7, 31, 29, 0, true],
  ]);
  assert.deepEqual(analysis.daysWithinDuration, [1, 2, 3, 4]);
  assert.deepEqual(analysis.daysExceedingDuration, []);
});

test('analyzes the real V10 prescription at sixty minutes with model B', () => {
  const prescription = buildV10Prescription();
  const analysis = requireValid(
    analyzeWeeklySessionDuration(
      prescription.week,
      prescription.allocation,
      60,
      MODEL_B,
    ),
  );

  assert.deepEqual(durationRows(analysis), [
    [1, 30, 9, 73.5, 0, 13.5, false],
    [2, 29, 9, 71.5, 0, 11.5, false],
    [3, 20, 8, 52, 8, 0, true],
    [4, 16, 7, 42.5, 17.5, 0, true],
  ]);
  assert.deepEqual(analysis.daysWithinDuration, [3, 4]);
  assert.deepEqual(analysis.daysExceedingDuration, [1, 2]);
});

test('identifies V10 days exceeding forty-five minutes in both models', () => {
  const prescription = buildV10Prescription();
  const modelA = requireValid(
    analyzeWeeklySessionDuration(
      prescription.week,
      prescription.allocation,
      45,
      MODEL_A,
    ),
  );
  const modelB = requireValid(
    analyzeWeeklySessionDuration(
      prescription.week,
      prescription.allocation,
      45,
      MODEL_B,
    ),
  );

  assert.deepEqual(modelA.daysWithinDuration, [3, 4]);
  assert.deepEqual(modelA.daysExceedingDuration, [1, 2]);
  assert.deepEqual(modelB.daysWithinDuration, [4]);
  assert.deepEqual(modelB.daysExceedingDuration, [1, 2, 3]);
});

test('identifies every V10 day as exceeding thirty minutes in both models', () => {
  const prescription = buildV10Prescription();

  for (const durationModel of [MODEL_A, MODEL_B]) {
    const analysis = requireValid(
      analyzeWeeklySessionDuration(
        prescription.week,
        prescription.allocation,
        30,
        durationModel,
      ),
    );

    assert.deepEqual(analysis.daysWithinDuration, []);
    assert.deepEqual(analysis.daysExceedingDuration, [1, 2, 3, 4]);
  }
});

test('compares cap five and accessory strategies with the same duration model', () => {
  const capFive = buildCapFivePrescription();
  const accessories = buildV10Prescription();
  const capFiveAnalysis = requireValid(
    analyzeWeeklySessionDuration(
      capFive.week,
      capFive.allocation,
      60,
      MODEL_A,
    ),
  );
  const accessoryAnalysis = requireValid(
    analyzeWeeklySessionDuration(
      accessories.week,
      accessories.allocation,
      60,
      MODEL_A,
    ),
  );

  assert.deepEqual(
    capFiveAnalysis.days.map((day) => [
      day.dayOrder,
      day.allocatedSetCount,
      day.allocatedExerciseCount,
      day.estimatedDurationMinutes,
    ]),
    [
      [1, 27, 7, 47.5],
      [2, 25, 7, 44.5],
      [3, 23, 7, 41.5],
      [4, 20, 7, 37],
    ],
  );
  assert.deepEqual(
    accessoryAnalysis.days.map((day) => [
      day.dayOrder,
      day.allocatedSetCount,
      day.allocatedExerciseCount,
      day.estimatedDurationMinutes,
    ]),
    [
      [1, 30, 9, 54],
      [2, 29, 9, 52.5],
      [3, 20, 8, 38],
      [4, 16, 7, 31],
    ],
  );
  assert.equal(
    capFiveAnalysis.days.reduce(
      (total, day) => total + day.estimatedDurationMinutes,
      0,
    ),
    170.5,
  );
  assert.equal(
    accessoryAnalysis.days.reduce(
      (total, day) => total + day.estimatedDurationMinutes,
      0,
    ),
    175.5,
  );
});

test('preserves day order, is deterministic, and does not mutate inputs', () => {
  const prescription = buildV10Prescription();
  const model = { ...MODEL_A };
  const weekBefore = JSON.stringify(prescription.week);
  const allocationBefore = JSON.stringify(prescription.allocation);
  const modelBefore = JSON.stringify(model);
  const first = analyzeWeeklySessionDuration(
    prescription.week,
    prescription.allocation,
    45,
    model,
  );
  const second = analyzeWeeklySessionDuration(
    prescription.week,
    prescription.allocation,
    45,
    model,
  );

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.deepEqual(
    requireValid(first).days.map((day) => day.dayOrder),
    prescription.week.days.map((day) => day.day.order),
  );
  assert.equal(JSON.stringify(prescription.week), weekBefore);
  assert.equal(JSON.stringify(prescription.allocation), allocationBefore);
  assert.equal(JSON.stringify(model), modelBefore);
});
