import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingDomain from '../../.expo/domain-tests/domain/training/index.js';

const { MUSCLE_GROUPS } = exerciseDomain;
const { SPLIT_VARIANTS, buildHypertrophySplit } = trainingDomain;

const EXPECTED_TARGET_MUSCLES = {
  full_body: MUSCLE_GROUPS,
  upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  lower: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abs'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abs'],
};

function assertSplit(daysPerWeek, expectedType, expectedDays) {
  const split = buildHypertrophySplit(daysPerWeek);

  assert.equal(split.type, expectedType);
  assert.equal(split.daysPerWeek, daysPerWeek);
  assert.deepEqual(
    split.days.map(({ order, name, focus, variant }) => ({
      order,
      name,
      focus,
      variant,
    })),
    expectedDays.map(([name, focus, variant], index) => ({
      order: index + 1,
      name,
      focus,
      variant,
    })),
  );
}

test('defines the supported split variants', () => {
  assert.deepEqual(SPLIT_VARIANTS, ['A', 'B', 'C']);
});

test('builds the two-day full-body split', () => {
  assertSplit(2, 'full_body', [
    ['Corpo Inteiro A', 'full_body', 'A'],
    ['Corpo Inteiro B', 'full_body', 'B'],
  ]);

  for (const day of buildHypertrophySplit(2).days) {
    assert.deepEqual(day.targetMuscles, MUSCLE_GROUPS);
  }
});

test('builds the three-day full-body split', () => {
  assertSplit(3, 'full_body', [
    ['Corpo Inteiro A', 'full_body', 'A'],
    ['Corpo Inteiro B', 'full_body', 'B'],
    ['Corpo Inteiro C', 'full_body', 'C'],
  ]);
});

test('builds the four-day upper-lower split', () => {
  assertSplit(4, 'upper_lower', [
    ['Superior A', 'upper', 'A'],
    ['Inferior A', 'lower', 'A'],
    ['Superior B', 'upper', 'B'],
    ['Inferior B', 'lower', 'B'],
  ]);
});

test('builds the five-day upper-lower-push-pull-legs split', () => {
  assertSplit(5, 'upper_lower_push_pull_legs', [
    ['Superior', 'upper', null],
    ['Inferior', 'lower', null],
    ['Empurrar', 'push', null],
    ['Puxar', 'pull', null],
    ['Pernas', 'legs', null],
  ]);
});

test('builds the six-day push-pull-legs split', () => {
  assertSplit(6, 'push_pull_legs', [
    ['Empurrar A', 'push', 'A'],
    ['Puxar A', 'pull', 'A'],
    ['Pernas A', 'legs', 'A'],
    ['Empurrar B', 'push', 'B'],
    ['Puxar B', 'pull', 'B'],
    ['Pernas B', 'legs', 'B'],
  ]);
});

test('maps every focus to only its intended muscle groups', () => {
  const representativeDays = [
    buildHypertrophySplit(2).days[0],
    buildHypertrophySplit(4).days[0],
    buildHypertrophySplit(4).days[1],
    buildHypertrophySplit(5).days[2],
    buildHypertrophySplit(5).days[3],
    buildHypertrophySplit(5).days[4],
  ];

  for (const day of representativeDays) {
    assert.deepEqual(day.targetMuscles, EXPECTED_TARGET_MUSCLES[day.focus]);
  }
});

test('covers every muscle group at least once in every supported weekly split', () => {
  for (const daysPerWeek of [2, 3, 4, 5, 6]) {
    const split = buildHypertrophySplit(daysPerWeek);

    for (const muscle of MUSCLE_GROUPS) {
      assert.ok(
        split.days.some((day) => day.targetMuscles.includes(muscle)),
        `${daysPerWeek} days must cover ${muscle}`,
      );
    }
  }
});

test('is deterministic and returns independent structures', () => {
  const first = buildHypertrophySplit(5);
  const second = buildHypertrophySplit(5);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.days, second.days);

  for (let index = 0; index < first.days.length; index += 1) {
    assert.notEqual(first.days[index], second.days[index]);
    assert.notEqual(
      first.days[index].targetMuscles,
      second.days[index].targetMuscles,
    );
  }
});
