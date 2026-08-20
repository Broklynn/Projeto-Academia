import assert from 'node:assert/strict';
import test from 'node:test';

import athleteDomain from '../../.expo/domain-tests/domain/athlete/index.js';
import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import setupFeature from '../../.expo/domain-tests/features/setup/complete-setup.js';

const { TRAINING_GOALS } = athleteDomain;
const { EQUIPMENT } = exerciseDomain;
const { completeSetupDraft } = setupFeature;

const validDraft = {
  goal: 'hypertrophy',
  experience: 'intermediate',
  daysPerWeek: 4,
  sessionDurationMinutes: 60,
  availableEquipment: ['barbell', 'bench'],
};

function assertInvalid(result, fragment) {
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => error.includes(fragment)),
    `expected an error containing "${fragment}"`,
  );
}

test('exposes the four product goals in canonical order', () => {
  assert.deepEqual(TRAINING_GOALS, [
    'hypertrophy',
    'weight_loss',
    'strength',
    'general_fitness',
  ]);
});

test('completes a valid setup without mutating or sharing its equipment array', () => {
  const snapshot = JSON.stringify(validDraft);
  const result = completeSetupDraft(validDraft);

  assert.equal(result.valid, true);
  assert.deepEqual(result.value, validDraft);
  assert.notEqual(result.value.availableEquipment, validDraft.availableEquipment);
  assert.equal(JSON.stringify(validDraft), snapshot);
});

test('accepts zero equipment at setup completion for an explicit UI state', () => {
  const result = completeSetupDraft({ ...validDraft, availableEquipment: [] });

  assert.equal(result.valid, true);
  assert.deepEqual(result.value.availableEquipment, []);
});

test('accepts every declared goal without converting its meaning', () => {
  for (const goal of TRAINING_GOALS) {
    const result = completeSetupDraft({ ...validDraft, goal });
    assert.equal(result.valid, true);
    assert.equal(result.value.goal, goal);
  }
});

test('rejects missing and unsupported goal or experience values', () => {
  for (const [overrides, fragment] of [
    [{ goal: null }, 'goal'],
    [{ goal: 'endurance' }, 'goal'],
    [{ experience: null }, 'experience'],
    [{ experience: 'expert' }, 'experience'],
  ]) {
    assertInvalid(completeSetupDraft({ ...validDraft, ...overrides }), fragment);
  }
});

test('rejects invalid days and duration values including non-integers', () => {
  for (const daysPerWeek of [null, 1, 7, 3.5]) {
    assertInvalid(
      completeSetupDraft({ ...validDraft, daysPerWeek }),
      'daysPerWeek',
    );
  }
  for (const sessionDurationMinutes of [null, 29, 121, 60.5]) {
    assertInvalid(
      completeSetupDraft({ ...validDraft, sessionDurationMinutes }),
      'sessionDurationMinutes',
    );
  }
});

test('rejects unknown and duplicate equipment while accepting the canonical set', () => {
  assertInvalid(
    completeSetupDraft({ ...validDraft, availableEquipment: ['kettlebell'] }),
    'not supported',
  );
  assertInvalid(
    completeSetupDraft({ ...validDraft, availableEquipment: ['bench', 'bench'] }),
    'duplicate bench',
  );
  const all = completeSetupDraft({ ...validDraft, availableEquipment: [...EQUIPMENT] });
  assert.equal(all.valid, true);
});

test('collects independent setup errors in one validation pass', () => {
  const result = completeSetupDraft({
    goal: null,
    experience: null,
    daysPerWeek: 1,
    sessionDurationMinutes: 20,
    availableEquipment: ['unknown', 'unknown'],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 6);
});
