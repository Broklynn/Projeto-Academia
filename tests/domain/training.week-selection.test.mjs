import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseData from '../../.expo/domain-tests/data/exercises/index.js';
import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingDomain from '../../.expo/domain-tests/domain/training/index.js';
import trainingFeature from '../../.expo/domain-tests/features/training/index.js';

const { selectExercisesForSplitDay } = exerciseData;
const { EQUIPMENT } = exerciseDomain;
const { buildHypertrophySplit } = trainingDomain;
const { buildHypertrophyTrainingSelection } = trainingFeature;

const ALL_EQUIPMENT = [...EQUIPMENT];

function buildWeek(daysPerWeek, availableEquipment = ALL_EQUIPMENT) {
  return buildHypertrophyTrainingSelection({
    daysPerWeek,
    availableEquipment,
  });
}

function exerciseIds(daySelection) {
  return daySelection.exercises.map((exercise) => exercise.id);
}

test('keeps split and weekly day counts aligned for every supported frequency', () => {
  for (const daysPerWeek of [2, 3, 4, 5, 6]) {
    const result = buildWeek(daysPerWeek);

    assert.equal(result.split.days.length, daysPerWeek);
    assert.equal(result.days.length, daysPerWeek);

    for (let index = 0; index < daysPerWeek; index += 1) {
      assert.equal(result.days[index].day, result.split.days[index]);
    }
  }
});

test('builds two full-body days and preserves A/B variation', () => {
  const result = buildWeek(2);

  assert.deepEqual(
    result.days.map(({ day }) => [day.order, day.name, day.variant]),
    [
      [1, 'Corpo Inteiro A', 'A'],
      [2, 'Corpo Inteiro B', 'B'],
    ],
  );
  assert.notDeepEqual(exerciseIds(result.days[0]), exerciseIds(result.days[1]));
});

test('builds full-body A/B/C in order and preserves C fallbacks', () => {
  const result = buildWeek(3);

  assert.deepEqual(
    result.days.map(({ day }) => [day.order, day.variant]),
    [
      [1, 'A'],
      [2, 'B'],
      [3, 'C'],
    ],
  );
  assert.deepEqual(exerciseIds(result.days[2]), [
    'dumbbell-bench-press',
    'seated-cable-row',
    'pull-up',
    'leg-press',
    'barbell-romanian-deadlift',
    'standing-calf-raise',
    'plank',
  ]);
});

test('builds the real four-day upper/lower week with deterministic variation', () => {
  const result = buildWeek(4);

  assert.deepEqual(
    result.days.map(({ day }) => [day.name, day.focus, day.variant]),
    [
      ['Superior A', 'upper', 'A'],
      ['Inferior A', 'lower', 'A'],
      ['Superior B', 'upper', 'B'],
      ['Inferior B', 'lower', 'B'],
    ],
  );
  assert.deepEqual(exerciseIds(result.days[0]), [
    'barbell-bench-press',
    'barbell-row',
    'barbell-overhead-press',
    'pull-up',
    'dumbbell-lateral-raise',
    'barbell-curl',
    'cable-triceps-pushdown',
  ]);
  assert.deepEqual(exerciseIds(result.days[1]), [
    'barbell-back-squat',
    'barbell-romanian-deadlift',
    'leg-extension',
    'lying-leg-curl',
    'barbell-hip-thrust',
    'standing-calf-raise',
    'cable-crunch',
  ]);
  assert.deepEqual(exerciseIds(result.days[2]), [
    'incline-barbell-bench-press',
    'single-arm-dumbbell-row',
    'dumbbell-shoulder-press',
    'lat-pulldown',
    'single-arm-cable-lateral-raise',
    'dumbbell-curl',
    'overhead-cable-triceps-extension',
  ]);
  assert.deepEqual(exerciseIds(result.days[3]), [
    'barbell-front-squat',
    'barbell-conventional-deadlift',
    'leg-extension',
    'seated-leg-curl',
    'barbell-hip-thrust',
    'seated-calf-raise',
    'hanging-leg-raise',
  ]);
});

test('keeps every five-day split variant null and first-candidate based', () => {
  const result = buildWeek(5);

  assert.deepEqual(
    result.days.map(({ day }) => day.variant),
    [null, null, null, null, null],
  );
  assert.deepEqual(exerciseIds(result.days[2]), [
    'barbell-bench-press',
    'barbell-overhead-press',
    'dumbbell-lateral-raise',
    'cable-triceps-pushdown',
  ]);
});

test('builds six ordered push/pull/legs days with A/B variety', () => {
  const result = buildWeek(6);

  assert.deepEqual(
    result.days.map(({ day }) => [day.order, day.focus, day.variant]),
    [
      [1, 'push', 'A'],
      [2, 'pull', 'A'],
      [3, 'legs', 'A'],
      [4, 'push', 'B'],
      [5, 'pull', 'B'],
      [6, 'legs', 'B'],
    ],
  );
  assert.notDeepEqual(exerciseIds(result.days[0]), exerciseIds(result.days[3]));
  assert.notDeepEqual(exerciseIds(result.days[1]), exerciseIds(result.days[4]));
  assert.notDeepEqual(exerciseIds(result.days[2]), exerciseIds(result.days[5]));
});

test('keeps limited-equipment missing patterns attached to each day', () => {
  const result = buildWeek(4, ['dumbbell', 'bench', 'bodyweight']);

  assert.deepEqual(result.days[0].missingPatterns, ['vertical_pull']);
  assert.deepEqual(result.days[1].missingPatterns, [
    'squat',
    'hinge',
    'knee_extension',
    'knee_flexion',
    'hip_extension',
    'calf_raise',
  ]);
  assert.deepEqual(result.days[2].missingPatterns, ['vertical_pull']);
  assert.deepEqual(result.days[3].missingPatterns, [
    'squat',
    'hinge',
    'knee_extension',
    'knee_flexion',
    'hip_extension',
    'calf_raise',
  ]);
  assert.deepEqual(exerciseIds(result.days[1]), ['plank']);
  assert.deepEqual(exerciseIds(result.days[3]), ['plank']);
});

test('builds every day with no exercises and ordered gaps when equipment is empty', () => {
  const result = buildWeek(6, []);

  assert.equal(result.days.length, 6);
  assert.ok(result.days.every((day) => day.exercises.length === 0));
  assert.ok(result.days.every((day) => day.missingPatterns.length > 0));
});

test('keeps bodyweight explicit for a full-body week', () => {
  const result = buildWeek(2, ['bodyweight']);

  for (const day of result.days) {
    assert.deepEqual(exerciseIds(day), ['push-up', 'plank']);
    assert.deepEqual(day.missingPatterns, [
      'horizontal_pull',
      'vertical_pull',
      'squat',
      'hinge',
      'calf_raise',
    ]);
  }
});

test('is exactly equivalent to splitting and selecting each day manually', () => {
  const input = {
    daysPerWeek: 4,
    availableEquipment: ['dumbbell', 'bench', 'bodyweight'],
  };
  const result = buildHypertrophyTrainingSelection(input);
  const split = buildHypertrophySplit(input.daysPerWeek);
  const expectedDays = split.days.map((day) => ({
    day,
    ...selectExercisesForSplitDay(day, input.availableEquipment),
  }));

  assert.deepEqual(result, { split, days: expectedDays });
});

test('is deterministic and does not mutate available equipment', () => {
  const availableEquipment = ['barbell', 'bench'];
  const equipmentBefore = [...availableEquipment];
  const input = { daysPerWeek: 4, availableEquipment };
  const first = buildHypertrophyTrainingSelection(input);
  const second = buildHypertrophyTrainingSelection(input);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.split, second.split);
  assert.notEqual(first.days, second.days);
  assert.deepEqual(availableEquipment, equipmentBefore);
});
