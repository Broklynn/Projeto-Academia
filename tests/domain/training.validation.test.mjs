import assert from 'node:assert/strict';
import test from 'node:test';

import trainingValidation from '../../.expo/domain-tests/training/validation.js';

const { validateRepRange, validateSetPerformance, validateWorkoutExercise } = trainingValidation;

const validWorkoutExercise = {
  id: 'prescription-1',
  exerciseId: 'bench-press',
  order: 1,
  sets: 3,
  repRange: { min: 8, max: 12 },
  restSeconds: 120,
  targetRir: 2,
};

const validSetPerformance = {
  setNumber: 1,
  weightKg: 80,
  reps: 10,
  rir: 2,
  completed: true,
};

function workoutExerciseWith(overrides = {}) {
  return { ...validWorkoutExercise, ...overrides };
}

function setPerformanceWith(overrides = {}) {
  return { ...validSetPerformance, ...overrides };
}

function assertInvalid(result, expectedErrorFragment) {
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.ok(
    result.errors.some((error) => error.includes(expectedErrorFragment)),
    `expected an error containing "${expectedErrorFragment}"`,
  );
}

test('accepts valid repetition ranges', () => {
  for (const repRange of [
    { min: 8, max: 12 },
    { min: 1, max: 1 },
  ]) {
    assert.deepEqual(validateRepRange(repRange), { valid: true });
  }
});

test('returns structured errors for invalid repetition ranges without throwing', () => {
  const invalidRanges = [
    { min: 0, max: 10 },
    { min: -1, max: 10 },
    { min: 12, max: 8 },
    { min: 8.5, max: 12 },
    { min: 8, max: 12.5 },
  ];

  for (const repRange of invalidRanges) {
    const result = validateRepRange(repRange);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  }
});

test('accepts a valid workout exercise prescription', () => {
  assert.deepEqual(validateWorkoutExercise(validWorkoutExercise), { valid: true });
});

test('rejects invalid workout exercise fields', () => {
  const cases = [
    [{ id: '' }, 'id'],
    [{ id: '   ' }, 'id'],
    [{ exerciseId: '' }, 'exerciseId'],
    [{ sets: 0 }, 'sets'],
    [{ sets: -1 }, 'sets'],
    [{ order: 0 }, 'order'],
    [{ order: 1.5 }, 'order'],
    [{ restSeconds: -1 }, 'restSeconds'],
    [{ restSeconds: 1.5 }, 'restSeconds'],
    [{ targetRir: -1 }, 'targetRir'],
    [{ targetRir: 6 }, 'targetRir'],
  ];

  for (const [overrides, expectedErrorFragment] of cases) {
    assertInvalid(
      validateWorkoutExercise(workoutExerciseWith(overrides)),
      expectedErrorFragment,
    );
  }
});

test('propagates repetition range errors through workout exercise validation', () => {
  const result = validateWorkoutExercise(
    workoutExerciseWith({ repRange: { min: 12, max: 8 } }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.startsWith('repRange.')));
});

test('accepts a completed set and supported zero and RIR boundaries', () => {
  assert.deepEqual(validateSetPerformance(validSetPerformance), { valid: true });
  assert.deepEqual(
    validateSetPerformance(
      setPerformanceWith({
        weightKg: 0,
        reps: 0,
        rir: 0,
      }),
    ),
    { valid: true },
  );
  assert.deepEqual(validateSetPerformance(setPerformanceWith({ rir: 5 })), { valid: true });
});

test('rejects invalid runtime set performance fields', () => {
  const cases = [
    [{ setNumber: 0 }, 'setNumber'],
    [{ setNumber: -1 }, 'setNumber'],
    [{ weightKg: -1 }, 'weightKg'],
    [{ weightKg: Number.NaN }, 'weightKg'],
    [{ weightKg: Number.POSITIVE_INFINITY }, 'weightKg'],
    [{ reps: -1 }, 'reps'],
    [{ reps: 1.5 }, 'reps'],
    [{ rir: -1 }, 'rir'],
    [{ rir: 6 }, 'rir'],
    [{ rir: 1.5 }, 'rir'],
    [{ completed: 'true' }, 'completed'],
  ];

  for (const [overrides, expectedErrorFragment] of cases) {
    assertInvalid(
      validateSetPerformance(setPerformanceWith(overrides)),
      expectedErrorFragment,
    );
  }
});
