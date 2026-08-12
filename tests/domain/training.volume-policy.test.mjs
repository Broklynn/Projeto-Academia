import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingDomain from '../../.expo/domain-tests/domain/training/index.js';

const { MUSCLE_GROUPS } = exerciseDomain;
const {
  buildDefaultHypertrophyWeeklyVolumePolicy,
  DEFAULT_HYPERTROPHY_WEEKLY_SET_TARGET,
} = trainingDomain;

test('defines the deliberate V1 hypertrophy weekly set baseline as 10', () => {
  assert.equal(DEFAULT_HYPERTROPHY_WEEKLY_SET_TARGET, 10);
});

test('builds a policy specifically for hypertrophy', () => {
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();

  assert.equal(policy.goal, 'hypertrophy');
});

test('includes every muscle exactly once in official order', () => {
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const muscles = policy.muscleTargets.map((target) => target.muscle);

  assert.equal(policy.muscleTargets.length, MUSCLE_GROUPS.length);
  assert.equal(new Set(muscles).size, MUSCLE_GROUPS.length);
  assert.deepEqual(muscles, MUSCLE_GROUPS);
});

test('assigns the finite positive integer default target to every muscle', () => {
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();

  for (const target of policy.muscleTargets) {
    assert.equal(
      target.targetSetsPerWeek,
      DEFAULT_HYPERTROPHY_WEEKLY_SET_TARGET,
    );
    assert.ok(Number.isFinite(target.targetSetsPerWeek));
    assert.ok(Number.isInteger(target.targetSetsPerWeek));
    assert.ok(target.targetSetsPerWeek > 0);
  }
});

test('keeps the default policy independent from athletes and selected weeks', () => {
  const policy = buildDefaultHypertrophyWeeklyVolumePolicy();

  assert.equal(buildDefaultHypertrophyWeeklyVolumePolicy.length, 0);
  assert.deepEqual(Object.keys(policy), ['goal', 'muscleTargets']);
  for (const target of policy.muscleTargets) {
    assert.deepEqual(Object.keys(target), ['muscle', 'targetSetsPerWeek']);
  }
});

test('is deterministic and returns independent readonly-compatible structures', () => {
  const first = buildDefaultHypertrophyWeeklyVolumePolicy();
  const second = buildDefaultHypertrophyWeeklyVolumePolicy();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.muscleTargets, second.muscleTargets);
  for (let index = 0; index < MUSCLE_GROUPS.length; index += 1) {
    assert.notEqual(first.muscleTargets[index], second.muscleTargets[index]);
  }
});

test('does not expose internal templates through a returned policy', () => {
  const externalPolicy = buildDefaultHypertrophyWeeklyVolumePolicy();
  const muscleGroupsBefore = [...MUSCLE_GROUPS];

  externalPolicy.muscleTargets[0].targetSetsPerWeek = 999;
  externalPolicy.muscleTargets.reverse();

  const freshPolicy = buildDefaultHypertrophyWeeklyVolumePolicy();

  assert.deepEqual(
    freshPolicy.muscleTargets.map((target) => target.muscle),
    MUSCLE_GROUPS,
  );
  assert.ok(
    freshPolicy.muscleTargets.every(
      (target) =>
        target.targetSetsPerWeek ===
        DEFAULT_HYPERTROPHY_WEEKLY_SET_TARGET,
    ),
  );
  assert.deepEqual(MUSCLE_GROUPS, muscleGroupsBefore);
});
