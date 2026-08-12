import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseData from '../../.expo/domain-tests/data/exercises/index.js';
import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingDomain from '../../.expo/domain-tests/domain/training/index.js';

const {
  EXERCISE_CATALOG,
  getExerciseCandidatesForSplitDay,
  getRequiredMovementPatternsForFocus,
  selectExercisesForSplitDay,
} = exerciseData;
const { EQUIPMENT } = exerciseDomain;
const { buildHypertrophySplit } = trainingDomain;

const ALL_EQUIPMENT = [...EQUIPMENT];

const EXPECTED_PATTERNS = {
  full_body: [
    'horizontal_push',
    'horizontal_pull',
    'vertical_pull',
    'squat',
    'hinge',
    'calf_raise',
    'core',
  ],
  upper: [
    'horizontal_push',
    'horizontal_pull',
    'vertical_push',
    'vertical_pull',
    'shoulder_abduction',
    'elbow_flexion',
    'elbow_extension',
  ],
  lower: [
    'squat',
    'hinge',
    'knee_extension',
    'knee_flexion',
    'hip_extension',
    'calf_raise',
    'core',
  ],
  push: [
    'horizontal_push',
    'vertical_push',
    'shoulder_abduction',
    'elbow_extension',
  ],
  pull: ['vertical_pull', 'horizontal_pull', 'elbow_flexion'],
  legs: [
    'squat',
    'hinge',
    'knee_extension',
    'knee_flexion',
    'hip_extension',
    'calf_raise',
    'core',
  ],
};

function representativeDay(daysPerWeek, focus) {
  return buildHypertrophySplit(daysPerWeek).days.find(
    (day) => day.focus === focus,
  );
}

function selectedIds(day, availableEquipment = ALL_EQUIPMENT) {
  return selectExercisesForSplitDay(day, availableEquipment).exercises.map(
    (exercise) => exercise.id,
  );
}

test('declares the exact ordered V1 movement coverage for every focus', () => {
  for (const [focus, expectedPatterns] of Object.entries(EXPECTED_PATTERNS)) {
    assert.deepEqual(
      getRequiredMovementPatternsForFocus(focus),
      expectedPatterns,
    );
  }
});

test('returns independent pattern arrays without exposing policy templates', () => {
  const first = getRequiredMovementPatternsForFocus('push');
  const second = getRequiredMovementPatternsForFocus('push');

  assert.deepEqual(first, EXPECTED_PATTERNS.push);
  assert.deepEqual(second, EXPECTED_PATTERNS.push);
  assert.notEqual(first, second);
});

test('selects full-body exercises in slot order with broad equipment', () => {
  const day = representativeDay(2, 'full_body');
  const result = selectExercisesForSplitDay(day, ALL_EQUIPMENT);

  assert.deepEqual(
    result.exercises.map((exercise) => exercise.movementPattern),
    EXPECTED_PATTERNS.full_body,
  );
  assert.deepEqual(
    result.exercises.map((exercise) => exercise.id),
    [
      'barbell-bench-press',
      'barbell-row',
      'pull-up',
      'barbell-back-squat',
      'barbell-romanian-deadlift',
      'standing-calf-raise',
      'cable-crunch',
    ],
  );
  assert.deepEqual(result.missingPatterns, []);
});

test('selects upper exercises in slot order using canonical candidates', () => {
  const day = representativeDay(4, 'upper');
  const result = selectExercisesForSplitDay(day, ALL_EQUIPMENT);

  assert.deepEqual(
    result.exercises.map((exercise) => exercise.id),
    [
      'barbell-bench-press',
      'barbell-row',
      'barbell-overhead-press',
      'pull-up',
      'dumbbell-lateral-raise',
      'barbell-curl',
      'cable-triceps-pushdown',
    ],
  );
  assert.deepEqual(result.missingPatterns, []);
});

test('selects only required push patterns and excludes chest fly accessories', () => {
  const day = representativeDay(5, 'push');
  const result = selectExercisesForSplitDay(day, ALL_EQUIPMENT);

  assert.deepEqual(
    result.exercises.map((exercise) => exercise.movementPattern),
    EXPECTED_PATTERNS.push,
  );
  assert.ok(
    !result.exercises.some((exercise) => exercise.id === 'cable-chest-fly'),
  );
  assert.deepEqual(result.missingPatterns, []);
});

test('selects pull exercises in vertical, horizontal, and elbow flexion order', () => {
  const day = representativeDay(5, 'pull');
  const result = selectExercisesForSplitDay(day, ALL_EQUIPMENT);

  assert.deepEqual(
    result.exercises.map((exercise) => exercise.movementPattern),
    EXPECTED_PATTERNS.pull,
  );
  assert.deepEqual(selectedIds(day), ['pull-up', 'barbell-row', 'barbell-curl']);
  assert.deepEqual(result.missingPatterns, []);
});

test('uses the same current coverage for lower and legs', () => {
  const lowerDay = representativeDay(4, 'lower');
  const legsDay = representativeDay(5, 'legs');
  const expectedIds = [
    'barbell-back-squat',
    'barbell-romanian-deadlift',
    'leg-extension',
    'lying-leg-curl',
    'barbell-hip-thrust',
    'standing-calf-raise',
    'cable-crunch',
  ];

  assert.deepEqual(selectedIds(lowerDay), expectedIds);
  assert.deepEqual(selectedIds(legsDay), expectedIds);
  assert.deepEqual(
    getRequiredMovementPatternsForFocus('lower'),
    getRequiredMovementPatternsForFocus('legs'),
  );
});

test('keeps selecting available slots and reports limited-equipment gaps in policy order', () => {
  const day = representativeDay(4, 'upper');
  const result = selectExercisesForSplitDay(day, ['barbell', 'bench']);

  assert.deepEqual(
    result.exercises.map((exercise) => exercise.id),
    [
      'barbell-bench-press',
      'barbell-row',
      'barbell-overhead-press',
      'barbell-curl',
    ],
  );
  assert.deepEqual(result.missingPatterns, [
    'vertical_pull',
    'shoulder_abduction',
    'elbow_extension',
  ]);
});

test('returns all slots as missing when no exercise is executable', () => {
  const day = representativeDay(4, 'upper');

  assert.deepEqual(selectExercisesForSplitDay(day, []), {
    exercises: [],
    missingPatterns: EXPECTED_PATTERNS.upper,
  });
});

test('requires bodyweight explicitly instead of treating no equipment as bodyweight', () => {
  const day = representativeDay(5, 'push');

  assert.ok(selectedIds(day, ['bodyweight']).includes('push-up'));
  assert.deepEqual(selectedIds(day, []), []);
});

test('uses the same selection for A and B days with equal focus and equipment', () => {
  const [pushA, , , pushB] = buildHypertrophySplit(6).days;

  assert.deepEqual(selectedIds(pushA), selectedIds(pushB));
});

test('is deterministic, duplicate-free, and does not mutate its inputs or sources', () => {
  const day = representativeDay(4, 'upper');
  const availableEquipment = ['barbell', 'bench'];
  const dayBefore = JSON.stringify(day);
  const equipmentBefore = [...availableEquipment];
  const catalogIdsBefore = EXERCISE_CATALOG.map((exercise) => exercise.id);
  const candidateIdsBefore = getExerciseCandidatesForSplitDay(
    day,
    availableEquipment,
  ).map((exercise) => exercise.id);
  const first = selectExercisesForSplitDay(day, availableEquipment);
  const second = selectExercisesForSplitDay(day, availableEquipment);
  const selectedExerciseIds = first.exercises.map((exercise) => exercise.id);

  assert.deepEqual(first, second);
  assert.equal(new Set(selectedExerciseIds).size, selectedExerciseIds.length);
  assert.equal(JSON.stringify(day), dayBefore);
  assert.deepEqual(availableEquipment, equipmentBefore);
  assert.deepEqual(
    EXERCISE_CATALOG.map((exercise) => exercise.id),
    catalogIdsBefore,
  );
  assert.deepEqual(
    getExerciseCandidatesForSplitDay(day, availableEquipment).map(
      (exercise) => exercise.id,
    ),
    candidateIdsBefore,
  );
});
