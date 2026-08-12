import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseData from '../../.expo/domain-tests/data/exercises/index.js';

const { getExerciseSubstitutes } = exerciseData;

function substituteIds(exerciseId, availableEquipment) {
  return getExerciseSubstitutes(exerciseId, availableEquipment).map(
    (exercise) => exercise.id,
  );
}

test('returns bench press substitutes in canonical catalog order', () => {
  assert.deepEqual(
    substituteIds('barbell-bench-press', [
      'barbell',
      'dumbbell',
      'bench',
      'machine',
      'bodyweight',
      'cable',
    ]),
    [
      'incline-barbell-bench-press',
      'dumbbell-bench-press',
      'incline-dumbbell-press',
      'machine-chest-press',
      'push-up',
    ],
  );
});

test('excludes mechanically incompatible exercises despite a shared primary muscle', () => {
  const substitutes = substituteIds('barbell-bench-press', ['cable']);

  assert.ok(!substitutes.includes('cable-chest-fly'));
});

test('requires every equipment item needed by a substitute', () => {
  const withDumbbellAndBench = substituteIds('barbell-bench-press', [
    'dumbbell',
    'bench',
  ]);
  const withDumbbellOnly = substituteIds('barbell-bench-press', ['dumbbell']);

  assert.ok(withDumbbellAndBench.includes('dumbbell-bench-press'));
  assert.ok(!withDumbbellOnly.includes('dumbbell-bench-press'));
});

test('substitutes knee flexion machine exercises', () => {
  assert.deepEqual(substituteIds('lying-leg-curl', ['machine']), [
    'seated-leg-curl',
  ]);
});

test('substitutes shoulder abduction exercises across equipment categories', () => {
  assert.deepEqual(substituteIds('dumbbell-lateral-raise', ['cable']), [
    'single-arm-cable-lateral-raise',
  ]);
});

test('never returns the reference exercise itself', () => {
  const substitutes = substituteIds('barbell-bench-press', ['barbell', 'bench']);

  assert.ok(!substitutes.includes('barbell-bench-press'));
});

test('returns an empty collection for an unknown reference ID', () => {
  assert.deepEqual(
    getExerciseSubstitutes('exercicio-que-nao-existe', ['bodyweight']),
    [],
  );
});

test('does not accept a muscle found only among candidate secondary muscles', () => {
  const substitutes = substituteIds('barbell-bench-press', ['barbell', 'bench']);

  assert.ok(!substitutes.includes('close-grip-barbell-bench-press'));
});

test('requires bodyweight explicitly for bodyweight substitutes', () => {
  const withBodyweight = substituteIds('barbell-bench-press', ['bodyweight']);
  const withoutEquipment = substituteIds('barbell-bench-press', []);

  assert.ok(withBodyweight.includes('push-up'));
  assert.ok(!withoutEquipment.includes('push-up'));
});
