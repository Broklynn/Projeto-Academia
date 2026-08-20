import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingDomain from '../../.expo/domain-tests/domain/training/index.js';
import planFeature from '../../.expo/domain-tests/features/plan/index.js';
import trainingFeature from '../../.expo/domain-tests/features/training/index.js';

const { EQUIPMENT } = exerciseDomain;
const {
  buildDefaultHypertrophySetCreditPolicy,
  buildDefaultHypertrophyWeeklyVolumePolicy,
} = trainingDomain;
const {
  PLAN_ACCESSORY_CONSTRAINTS,
  PLAN_DURATION_MODEL,
  PLAN_SET_CONSTRAINTS,
  generateHypertrophyPlan,
  parsePlanRouteParams,
  serializeEquipment,
} = planFeature;
const {
  augmentWeeklyCreditedSetTargetsWithAccessoriesWithinDuration,
  buildHypertrophyTrainingSelection,
} = trainingFeature;

const ALL_EQUIPMENT = [...EQUIPMENT];
const validSetup = {
  goal: 'hypertrophy',
  experience: 'intermediate',
  daysPerWeek: 4,
  sessionDurationMinutes: 60,
  availableEquipment: ALL_EQUIPMENT,
};

function requireValid(result) {
  assert.equal(result.valid, true, result.valid ? undefined : result.errors.join('\n'));
  return result.value;
}

function assertInvalid(result, fragment) {
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => error.includes(fragment)),
    `expected an error containing "${fragment}"`,
  );
}

function routeParams(overrides = {}) {
  return {
    goal: 'hypertrophy',
    experience: 'intermediate',
    days: '4',
    duration: '60',
    equipment: serializeEquipment(ALL_EQUIPMENT),
    ...overrides,
  };
}

test('serializes equipment canonically, deterministically, and immutably', () => {
  const equipment = ['bench', 'bodyweight', 'barbell'];
  const snapshot = [...equipment];

  assert.equal(serializeEquipment(equipment), 'bodyweight,barbell,bench');
  assert.equal(serializeEquipment([...equipment].reverse()), 'bodyweight,barbell,bench');
  assert.equal(serializeEquipment(['bench', 'bench']), 'bench');
  assert.deepEqual(equipment, snapshot);
});

test('parses valid scalar route params and preserves every declared goal', () => {
  for (const goal of ['hypertrophy', 'weight_loss', 'strength', 'general_fitness']) {
    const parsed = requireValid(parsePlanRouteParams(routeParams({ goal })));
    assert.equal(parsed.goal, goal);
    assert.deepEqual(parsed.availableEquipment, ALL_EQUIPMENT);
  }
});

test('route parsing validates required scalars, bounds, and equipment', () => {
  for (const [overrides, fragment] of [
    [{ goal: 'endurance' }, 'goal'],
    [{ experience: 'expert' }, 'experience'],
    [{ days: '1' }, 'daysPerWeek'],
    [{ days: '3.5' }, 'daysPerWeek'],
    [{ duration: '29' }, 'sessionDurationMinutes'],
    [{ duration: '60.5' }, 'sessionDurationMinutes'],
    [{ equipment: '' }, 'at least one'],
    [{ equipment: 'bench,bench' }, 'duplicate'],
    [{ equipment: 'bench,kettlebell' }, 'not supported'],
    [{ goal: ['hypertrophy', 'strength'] }, 'single value'],
  ]) {
    assertInvalid(parsePlanRouteParams(routeParams(overrides)), fragment);
  }
});

test('uses explicit stable reference policies without V17 prescription timing', () => {
  assert.deepEqual(PLAN_SET_CONSTRAINTS, { maxSetsPerExerciseOccurrence: 4 });
  assert.deepEqual(PLAN_ACCESSORY_CONSTRAINTS, { maxAdditionalExercisesPerDay: 2 });
  assert.deepEqual(PLAN_DURATION_MODEL, {
    minutesPerSet: 2,
    minutesPerExerciseOverhead: 1.5,
  });
});

test('generates every supported weekly frequency from two through six days', () => {
  for (const daysPerWeek of [2, 3, 4, 5, 6]) {
    const plan = requireValid(
      generateHypertrophyPlan({ ...validSetup, daysPerWeek }),
    );
    assert.equal(plan.goal, 'hypertrophy');
    assert.equal(plan.daysPerWeek, daysPerWeek);
    assert.equal(plan.days.length, daysPerWeek);
    assert.ok(plan.totalSets > 0);
    assert.ok(plan.days.every((day) => day.exercises.every((exercise) => exercise.sets > 0)));
  }
});

test('rejects every unsupported goal instead of silently mapping to hypertrophy', () => {
  for (const goal of ['weight_loss', 'strength', 'general_fitness']) {
    const result = generateHypertrophyPlan({ ...validSetup, goal });
    assertInvalid(result, `goal ${goal}`);
  }
});

test('generates compatible plans for limited and bodyweight-only equipment', () => {
  for (const availableEquipment of [
    ['dumbbell', 'bench'],
    ['bodyweight'],
  ]) {
    const plan = requireValid(
      generateHypertrophyPlan({ ...validSetup, availableEquipment }),
    );
    assert.ok(plan.totalSets > 0);
    assert.ok(plan.days.some((day) => day.exerciseCount > 0));
  }
});

test('keeps a controlled zero-allocation model if called without equipment', () => {
  const plan = requireValid(
    generateHypertrophyPlan({ ...validSetup, availableEquipment: [] }),
  );
  assert.equal(plan.totalSets, 0);
  assert.ok(plan.days.every((day) => day.exercises.length === 0));
});

test('principal 4d/60/all-equipment fixture reports exact totals, days, and accessories', () => {
  const plan = requireValid(generateHypertrophyPlan(validSetup));
  const exercises = plan.days.flatMap((day) => day.exercises);

  assert.equal(plan.totalSets, 72);
  assert.deepEqual(plan.days.map((day) => day.name), [
    'Superior A',
    'Inferior A',
    'Superior B',
    'Inferior B',
  ]);
  assert.deepEqual(plan.days.map((day) => [day.exerciseCount, day.totalSets]), [
    [8, 18],
    [9, 23],
    [7, 14],
    [7, 17],
  ]);
  assert.deepEqual(
    exercises.filter((exercise) => exercise.isAccessory).map((exercise) => exercise.name),
    [
      'Supino Inclinado com Barra',
      'Elevação de Panturrilha Sentado',
      'Elevação de Pernas Suspenso',
    ],
  );
});

test('view model exactly follows V16 week order and allocation values', () => {
  const week = buildHypertrophyTrainingSelection({
    daysPerWeek: validSetup.daysPerWeek,
    availableEquipment: validSetup.availableEquipment,
  });
  const engine = requireValid(
    augmentWeeklyCreditedSetTargetsWithAccessoriesWithinDuration(
      week,
      validSetup.availableEquipment,
      buildDefaultHypertrophyWeeklyVolumePolicy(),
      buildDefaultHypertrophySetCreditPolicy(),
      PLAN_SET_CONSTRAINTS,
      PLAN_ACCESSORY_CONSTRAINTS,
      {
        sessionDurationMinutes: validSetup.sessionDurationMinutes,
        durationModel: PLAN_DURATION_MODEL,
      },
    ),
  );
  const plan = requireValid(generateHypertrophyPlan(validSetup));

  assert.deepEqual(
    plan.days.flatMap((day) => day.exercises.map((exercise) => [day.order, exercise.exerciseId, exercise.sets])),
    engine.week.days.flatMap((day) => {
      const allocation = engine.allocation.days.find((item) => item.dayOrder === day.day.order);
      return day.exercises.flatMap((exercise) => {
        const sets = allocation?.exercises.find((item) => item.exerciseId === exercise.id)?.sets;
        return sets ? [[day.day.order, exercise.id, sets]] : [];
      });
    }),
  );
});

test('generation is deterministic and does not mutate setup or catalog inputs', () => {
  const setup = { ...validSetup, availableEquipment: [...validSetup.availableEquipment] };
  const snapshot = JSON.stringify(setup);
  const first = generateHypertrophyPlan(setup);
  const second = generateHypertrophyPlan(setup);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(JSON.stringify(setup), snapshot);
});

test('propagates duration validation errors from the real allocation pipeline', () => {
  assertInvalid(
    generateHypertrophyPlan({ ...validSetup, sessionDurationMinutes: 29 }),
    'sessionDurationMinutes',
  );
});
