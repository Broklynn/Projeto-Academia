import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingFeature from '../../.expo/domain-tests/features/training/index.js';

const { EQUIPMENT, MUSCLE_GROUPS } = exerciseDomain;
const {
  analyzeWeeklyMuscleCoverage,
  buildHypertrophyTrainingSelection,
} = trainingFeature;

const ALL_EQUIPMENT = [...EQUIPMENT];

const EXPECTED_COMPLETE_COVERAGE = {
  chest: [2, 2, ['horizontal_push']],
  back: [2, 4, ['horizontal_pull', 'vertical_pull']],
  shoulders: [2, 4, ['vertical_push', 'shoulder_abduction']],
  biceps: [2, 2, ['elbow_flexion']],
  triceps: [2, 2, ['elbow_extension']],
  quadriceps: [2, 4, ['squat', 'knee_extension']],
  hamstrings: [2, 4, ['hinge', 'knee_flexion']],
  glutes: [2, 4, ['hinge', 'hip_extension']],
  calves: [2, 2, ['calf_raise']],
  abs: [2, 2, ['core']],
};

function buildWeek(daysPerWeek, availableEquipment = ALL_EQUIPMENT) {
  return buildHypertrophyTrainingSelection({
    daysPerWeek,
    availableEquipment,
  });
}

function coverageByMuscle(analysis, muscle) {
  return analysis.muscles.find((coverage) => coverage.muscle === muscle);
}

function coverageSummary(analysis) {
  return Object.fromEntries(
    analysis.muscles.map((coverage) => [
      coverage.muscle,
      [
        coverage.dayCount,
        coverage.exerciseOccurrenceCount,
        coverage.movementPatterns,
      ],
    ]),
  );
}

test('analyzes the real four-day week in official muscle and occurrence order', () => {
  const analysis = analyzeWeeklyMuscleCoverage(buildWeek(4));

  assert.deepEqual(
    analysis.muscles.map((coverage) => coverage.muscle),
    MUSCLE_GROUPS,
  );
  assert.deepEqual(coverageSummary(analysis), EXPECTED_COMPLETE_COVERAGE);
  assert.deepEqual(analysis.uncoveredMuscles, []);
});

test('preserves detailed PT-BR occurrences for representative muscles', () => {
  const analysis = analyzeWeeklyMuscleCoverage(buildWeek(4));

  assert.deepEqual(coverageByMuscle(analysis, 'chest').occurrences, [
    {
      dayOrder: 1,
      dayName: 'Superior A',
      exerciseId: 'barbell-bench-press',
      exerciseName: 'Supino Reto com Barra',
      movementPattern: 'horizontal_push',
    },
    {
      dayOrder: 3,
      dayName: 'Superior B',
      exerciseId: 'incline-barbell-bench-press',
      exerciseName: 'Supino Inclinado com Barra',
      movementPattern: 'horizontal_push',
    },
  ]);
  assert.deepEqual(
    coverageByMuscle(analysis, 'back').occurrences.map(
      ({ dayOrder, dayName, exerciseId, exerciseName }) => [
        dayOrder,
        dayName,
        exerciseId,
        exerciseName,
      ],
    ),
    [
      [1, 'Superior A', 'barbell-row', 'Remada Curvada com Barra'],
      [1, 'Superior A', 'pull-up', 'Barra Fixa'],
      [3, 'Superior B', 'single-arm-dumbbell-row', 'Remada Unilateral com Halter'],
      [3, 'Superior B', 'lat-pulldown', 'Puxada na Frente'],
    ],
  );
  assert.deepEqual(
    coverageByMuscle(analysis, 'quadriceps').occurrences.map(
      ({ dayOrder, dayName, exerciseId, exerciseName }) => [
        dayOrder,
        dayName,
        exerciseId,
        exerciseName,
      ],
    ),
    [
      [2, 'Inferior A', 'barbell-back-squat', 'Agachamento Livre com Barra'],
      [2, 'Inferior A', 'leg-extension', 'Cadeira Extensora'],
      [4, 'Inferior B', 'barbell-front-squat', 'Agachamento Frontal com Barra'],
      [4, 'Inferior B', 'leg-extension', 'Cadeira Extensora'],
    ],
  );
  assert.deepEqual(
    coverageByMuscle(analysis, 'glutes').occurrences.map(
      ({ dayOrder, dayName, exerciseId, exerciseName }) => [
        dayOrder,
        dayName,
        exerciseId,
        exerciseName,
      ],
    ),
    [
      [2, 'Inferior A', 'barbell-romanian-deadlift', 'Levantamento Terra Romeno com Barra'],
      [2, 'Inferior A', 'barbell-hip-thrust', 'Elevação Pélvica com Barra'],
      [4, 'Inferior B', 'barbell-conventional-deadlift', 'Levantamento Terra Convencional com Barra'],
      [4, 'Inferior B', 'barbell-hip-thrust', 'Elevação Pélvica com Barra'],
    ],
  );
});

test('counts every declared primary muscle without counting secondary muscles', () => {
  const analysis = analyzeWeeklyMuscleCoverage(buildWeek(4));
  const multiPrimaryExerciseIds = [
    'barbell-romanian-deadlift',
    'barbell-conventional-deadlift',
  ];
  const occurrenceIds = (muscle) =>
    coverageByMuscle(analysis, muscle).occurrences.map(
      (occurrence) => occurrence.exerciseId,
    );

  for (const exerciseId of multiPrimaryExerciseIds) {
    assert.ok(occurrenceIds('hamstrings').includes(exerciseId));
    assert.ok(occurrenceIds('glutes').includes(exerciseId));
  }
  assert.ok(!occurrenceIds('triceps').includes('barbell-bench-press'));
  assert.ok(!occurrenceIds('shoulders').includes('barbell-bench-press'));
  assert.ok(!occurrenceIds('back').includes('barbell-romanian-deadlift'));
  assert.ok(!occurrenceIds('quadriceps').includes('barbell-conventional-deadlift'));
});

test('analyzes the real six-day PPL A/B week', () => {
  const analysis = analyzeWeeklyMuscleCoverage(buildWeek(6));
  const expectedCoverage = {
    ...EXPECTED_COMPLETE_COVERAGE,
    back: [2, 4, ['vertical_pull', 'horizontal_pull']],
  };

  assert.deepEqual(coverageSummary(analysis), expectedCoverage);
  assert.deepEqual(analysis.uncoveredMuscles, []);
});

test('reports uncovered muscles with limited equipment despite missing patterns', () => {
  const week = buildWeek(4, ['dumbbell', 'bench', 'bodyweight']);
  const analysis = analyzeWeeklyMuscleCoverage(week);

  assert.ok(week.days.some((day) => day.missingPatterns.length > 0));
  assert.deepEqual(analysis.uncoveredMuscles, [
    'quadriceps',
    'hamstrings',
    'glutes',
    'calves',
  ]);
  assert.deepEqual(coverageSummary(analysis), {
    chest: [2, 2, ['horizontal_push']],
    back: [2, 2, ['horizontal_pull']],
    shoulders: [2, 4, ['vertical_push', 'shoulder_abduction']],
    biceps: [2, 2, ['elbow_flexion']],
    triceps: [2, 2, ['elbow_extension']],
    quadriceps: [0, 0, []],
    hamstrings: [0, 0, []],
    glutes: [0, 0, []],
    calves: [0, 0, []],
    abs: [2, 2, ['core']],
  });
});

test('returns complete empty coverage for a week with zero equipment', () => {
  const analysis = analyzeWeeklyMuscleCoverage(buildWeek(6, []));

  assert.equal(analysis.muscles.length, MUSCLE_GROUPS.length);
  for (const coverage of analysis.muscles) {
    assert.equal(coverage.dayCount, 0);
    assert.equal(coverage.exerciseOccurrenceCount, 0);
    assert.deepEqual(coverage.occurrences, []);
    assert.deepEqual(coverage.movementPatterns, []);
  }
  assert.deepEqual(analysis.uncoveredMuscles, MUSCLE_GROUPS);
});

test('reflects only the selected exercises in a bodyweight week', () => {
  const analysis = analyzeWeeklyMuscleCoverage(buildWeek(2, ['bodyweight']));

  assert.deepEqual(coverageSummary(analysis), {
    chest: [2, 2, ['horizontal_push']],
    back: [0, 0, []],
    shoulders: [0, 0, []],
    biceps: [0, 0, []],
    triceps: [0, 0, []],
    quadriceps: [0, 0, []],
    hamstrings: [0, 0, []],
    glutes: [0, 0, []],
    calves: [0, 0, []],
    abs: [2, 2, ['core']],
  });
  assert.deepEqual(analysis.uncoveredMuscles, [
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'quadriceps',
    'hamstrings',
    'glutes',
    'calves',
  ]);
});

test('maintains count, day, uncovered, and order invariants', () => {
  const scenarios = [
    ...[2, 3, 4, 5, 6].map((daysPerWeek) => buildWeek(daysPerWeek)),
    buildWeek(4, ['dumbbell', 'bench', 'bodyweight']),
    buildWeek(2, ['bodyweight']),
    buildWeek(6, []),
  ];

  for (const week of scenarios) {
    const analysis = analyzeWeeklyMuscleCoverage(week);

    for (const coverage of analysis.muscles) {
      assert.ok(coverage.dayCount >= 0);
      assert.ok(coverage.exerciseOccurrenceCount >= 0);
      assert.ok(coverage.dayCount <= week.days.length);
      assert.equal(
        coverage.exerciseOccurrenceCount,
        coverage.occurrences.length,
      );

      const distinctDays = new Set(
        coverage.occurrences.map((occurrence) => occurrence.dayOrder),
      );
      assert.equal(coverage.dayCount, distinctDays.size);
      assert.deepEqual(
        coverage.movementPatterns,
        [...new Set(
          coverage.occurrences.map((occurrence) => occurrence.movementPattern),
        )],
      );

      if (coverage.exerciseOccurrenceCount === 0) {
        assert.deepEqual(coverage.occurrences, []);
        assert.deepEqual(coverage.movementPatterns, []);
      }
    }

    assert.deepEqual(
      analysis.uncoveredMuscles,
      analysis.muscles
        .filter((coverage) => coverage.exerciseOccurrenceCount === 0)
        .map((coverage) => coverage.muscle),
    );
  }
});

test('is deterministic and does not mutate the week or official muscle groups', () => {
  const week = buildWeek(4);
  const weekBefore = JSON.stringify(week);
  const muscleGroupsBefore = [...MUSCLE_GROUPS];
  const first = analyzeWeeklyMuscleCoverage(week);
  const second = analyzeWeeklyMuscleCoverage(week);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.muscles, second.muscles);
  assert.equal(JSON.stringify(week), weekBefore);
  assert.deepEqual(MUSCLE_GROUPS, muscleGroupsBefore);
});
