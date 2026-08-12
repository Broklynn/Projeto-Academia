import assert from 'node:assert/strict';
import test from 'node:test';

import athleteValidation from '../../.expo/domain-tests/domain/athlete/validation.js';

const { validateAthleteProfile } = athleteValidation;

const validAthlete = {
  id: 'athlete-1',
  displayName: 'Gabriel',
  goal: 'hypertrophy',
  experienceLevel: 'intermediate',
  daysPerWeek: 4,
  sessionDurationMinutes: 60,
  availableEquipment: ['barbell', 'bench'],
  priorityMuscles: ['chest'],
  movementRestrictions: ['avoid deep knee flexion'],
  createdAt: '2026-08-11T12:00:00.000Z',
  updatedAt: '2026-08-11T12:00:00.000Z',
};

function athleteWith(overrides = {}) {
  return { ...validAthlete, ...overrides };
}

function assertInvalid(result, expectedErrorFragment) {
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.ok(
    result.errors.some((error) => error.includes(expectedErrorFragment)),
    `expected an error containing "${expectedErrorFragment}"`,
  );
}

test('accepts a valid intermediate hypertrophy athlete profile', () => {
  assert.deepEqual(validateAthleteProfile(validAthlete), { valid: true });
});

test('accepts the training day and session duration boundaries', () => {
  for (const daysPerWeek of [2, 6]) {
    assert.deepEqual(validateAthleteProfile(athleteWith({ daysPerWeek })), { valid: true });
  }

  for (const sessionDurationMinutes of [30, 120]) {
    assert.deepEqual(validateAthleteProfile(athleteWith({ sessionDurationMinutes })), {
      valid: true,
    });
  }
});

test('rejects invalid runtime values for training days per week', () => {
  for (const daysPerWeek of [1, 7, 2.5]) {
    assertInvalid(validateAthleteProfile(athleteWith({ daysPerWeek })), 'daysPerWeek');
  }
});

test('rejects session durations outside the supported range', () => {
  for (const sessionDurationMinutes of [29, 121]) {
    assertInvalid(
      validateAthleteProfile(athleteWith({ sessionDurationMinutes })),
      'sessionDurationMinutes',
    );
  }
});

test('rejects empty and whitespace-only required strings', () => {
  const cases = [
    [{ id: '' }, 'id'],
    [{ id: '   ' }, 'id'],
    [{ displayName: '' }, 'displayName'],
    [{ displayName: '   ' }, 'displayName'],
    [{ movementRestrictions: [''] }, 'movementRestrictions'],
    [{ movementRestrictions: ['   '] }, 'movementRestrictions'],
  ];

  for (const [overrides, expectedErrorFragment] of cases) {
    assertInvalid(
      validateAthleteProfile(athleteWith(overrides)),
      expectedErrorFragment,
    );
  }
});

test('returns multiple structured errors in a single validation pass', () => {
  const result = validateAthleteProfile(
    athleteWith({
      displayName: ' ',
      daysPerWeek: 1,
      sessionDurationMinutes: 29,
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3);
  assert.ok(result.errors.some((error) => error.includes('displayName')));
  assert.ok(result.errors.some((error) => error.includes('daysPerWeek')));
  assert.ok(result.errors.some((error) => error.includes('sessionDurationMinutes')));
});
