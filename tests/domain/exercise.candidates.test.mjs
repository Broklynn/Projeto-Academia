import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseData from '../../.expo/domain-tests/data/exercises/index.js';
import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingDomain from '../../.expo/domain-tests/domain/training/index.js';

const {
  EXERCISE_CATALOG,
  getExerciseCandidatesForSplitDay,
  getExercisesAvailableWithEquipment,
} = exerciseData;
const { EQUIPMENT } = exerciseDomain;
const { buildHypertrophySplit } = trainingDomain;

const ALL_EQUIPMENT = [...EQUIPMENT];

function candidateIds(day, availableEquipment = ALL_EQUIPMENT) {
  return getExerciseCandidatesForSplitDay(day, availableEquipment).map(
    (exercise) => exercise.id,
  );
}

test('returns upper-body candidates and excludes lower-body exercises', () => {
  const upperDay = buildHypertrophySplit(4).days[0];
  const candidates = candidateIds(upperDay);

  for (const id of [
    'barbell-bench-press',
    'pull-up',
    'barbell-overhead-press',
    'barbell-curl',
    'cable-triceps-pushdown',
  ]) {
    assert.ok(candidates.includes(id), `upper day must include ${id}`);
  }

  for (const id of [
    'barbell-back-squat',
    'barbell-conventional-deadlift',
    'standing-calf-raise',
    'plank',
  ]) {
    assert.ok(!candidates.includes(id), `upper day must exclude ${id}`);
  }
});

test('returns lower-body candidates and excludes upper-body exercises', () => {
  const lowerDay = buildHypertrophySplit(4).days[1];
  const candidates = candidateIds(lowerDay);

  for (const id of [
    'barbell-back-squat',
    'barbell-romanian-deadlift',
    'barbell-hip-thrust',
    'standing-calf-raise',
    'cable-crunch',
  ]) {
    assert.ok(candidates.includes(id), `lower day must include ${id}`);
  }

  for (const id of ['barbell-bench-press', 'barbell-row', 'barbell-curl']) {
    assert.ok(!candidates.includes(id), `lower day must exclude ${id}`);
  }
});

test('returns push candidates across different movement patterns', () => {
  const pushDay = buildHypertrophySplit(5).days[2];
  const candidates = candidateIds(pushDay);

  for (const id of [
    'barbell-bench-press',
    'cable-chest-fly',
    'barbell-overhead-press',
    'dumbbell-lateral-raise',
    'cable-triceps-pushdown',
  ]) {
    assert.ok(candidates.includes(id), `push day must include ${id}`);
  }
});

test('returns pull candidates across vertical, horizontal, and elbow flexion patterns', () => {
  const pullDay = buildHypertrophySplit(5).days[3];
  const candidates = candidateIds(pullDay);

  for (const id of [
    'pull-up',
    'lat-pulldown',
    'barbell-row',
    'barbell-curl',
  ]) {
    assert.ok(candidates.includes(id), `pull day must include ${id}`);
  }
});

test('keeps all eligible movement patterns in a broad legs candidate pool', () => {
  const legsDay = buildHypertrophySplit(5).days[4];
  const movementPatterns = new Set(
    getExerciseCandidatesForSplitDay(legsDay, ALL_EQUIPMENT).map(
      (exercise) => exercise.movementPattern,
    ),
  );

  for (const movementPattern of [
    'squat',
    'hinge',
    'lunge',
    'knee_extension',
    'knee_flexion',
    'hip_extension',
    'calf_raise',
    'core',
  ]) {
    assert.ok(
      movementPatterns.has(movementPattern),
      `legs day must keep ${movementPattern} candidates`,
    );
  }
});

test('does not use secondary muscles to make an exercise eligible', () => {
  const upperDay = buildHypertrophySplit(4).days[0];

  assert.ok(
    !candidateIds(upperDay).includes('barbell-conventional-deadlift'),
  );
});

test('requires every equipment item for multi-equipment candidates', () => {
  const upperDay = buildHypertrophySplit(4).days[0];
  const withDumbbellAndBench = candidateIds(upperDay, ['dumbbell', 'bench']);
  const withDumbbellOnly = candidateIds(upperDay, ['dumbbell']);

  assert.ok(withDumbbellAndBench.includes('dumbbell-bench-press'));
  assert.ok(!withDumbbellOnly.includes('dumbbell-bench-press'));
});

test('requires bodyweight explicitly for bodyweight candidates', () => {
  const pushDay = buildHypertrophySplit(5).days[2];

  assert.ok(candidateIds(pushDay, ['bodyweight']).includes('push-up'));
  assert.ok(!candidateIds(pushDay, []).includes('push-up'));
});

test('matches equipment availability exactly for a full-body day', () => {
  const fullBodyDay = buildHypertrophySplit(2).days[0];
  const availableEquipment = ['barbell', 'bench', 'bodyweight'];

  assert.deepEqual(
    getExerciseCandidatesForSplitDay(fullBodyDay, availableEquipment),
    getExercisesAvailableWithEquipment(availableEquipment),
  );
});

test('is deterministic and preserves canonical catalog order', () => {
  const pushDay = buildHypertrophySplit(5).days[2];
  const first = candidateIds(pushDay);
  const second = candidateIds(pushDay);
  const expected = EXERCISE_CATALOG.filter((exercise) =>
    exercise.primaryMuscles.some((muscle) =>
      pushDay.targetMuscles.includes(muscle),
    ),
  ).map((exercise) => exercise.id);

  assert.deepEqual(first, second);
  assert.deepEqual(first, expected);
});

test('does not mutate the day, equipment, or catalog', () => {
  const day = buildHypertrophySplit(4).days[0];
  const availableEquipment = ['barbell', 'bench'];
  const dayBefore = JSON.stringify(day);
  const equipmentBefore = [...availableEquipment];
  const catalogIdsBefore = EXERCISE_CATALOG.map((exercise) => exercise.id);

  getExerciseCandidatesForSplitDay(day, availableEquipment);

  assert.equal(JSON.stringify(day), dayBefore);
  assert.deepEqual(availableEquipment, equipmentBefore);
  assert.deepEqual(
    EXERCISE_CATALOG.map((exercise) => exercise.id),
    catalogIdsBefore,
  );
});
