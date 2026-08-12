import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';
import trainingFeature from '../../.expo/domain-tests/features/training/index.js';

const { EQUIPMENT, MUSCLE_GROUPS } = exerciseDomain;
const {
  analyzeWeeklyMuscleCoverage,
  analyzeWeeklyMuscleParticipation,
  buildHypertrophyTrainingSelection,
} = trainingFeature;

const ALL_EQUIPMENT = [...EQUIPMENT];

const EXPECTED_FOUR_DAY_PARTICIPATION = {
  chest: [2, 2, 0, 0, ['horizontal_push'], []],
  back: [2, 4, 2, 2, ['horizontal_pull', 'vertical_pull'], ['hinge']],
  shoulders: [
    2,
    4,
    2,
    2,
    ['vertical_push', 'shoulder_abduction'],
    ['horizontal_push'],
  ],
  biceps: [
    2,
    2,
    2,
    4,
    ['elbow_flexion'],
    ['horizontal_pull', 'vertical_pull'],
  ],
  triceps: [
    2,
    2,
    2,
    4,
    ['elbow_extension'],
    ['horizontal_push', 'vertical_push'],
  ],
  quadriceps: [2, 4, 1, 1, ['squat', 'knee_extension'], ['hinge']],
  hamstrings: [
    2,
    4,
    2,
    3,
    ['hinge', 'knee_flexion'],
    ['squat', 'hip_extension'],
  ],
  glutes: [2, 4, 2, 2, ['hinge', 'hip_extension'], ['squat']],
  calves: [2, 2, 0, 0, ['calf_raise'], []],
  abs: [2, 2, 0, 0, ['core'], []],
};

function buildWeek(daysPerWeek, availableEquipment = ALL_EQUIPMENT) {
  return buildHypertrophyTrainingSelection({
    daysPerWeek,
    availableEquipment,
  });
}

function participationByMuscle(analysis, muscle) {
  return analysis.muscles.find(
    (participation) => participation.muscle === muscle,
  );
}

function participationSummary(analysis) {
  return Object.fromEntries(
    analysis.muscles.map((participation) => [
      participation.muscle,
      [
        participation.directDayCount,
        participation.directExerciseOccurrenceCount,
        participation.indirectDayCount,
        participation.indirectExerciseOccurrenceCount,
        participation.directMovementPatterns,
        participation.indirectMovementPatterns,
      ],
    ]),
  );
}

function occurrenceDetails(occurrences) {
  return occurrences.map(
    ({ dayOrder, dayName, exerciseName, movementPattern }) => [
      dayOrder,
      dayName,
      exerciseName,
      movementPattern,
    ],
  );
}

test('analyzes direct and indirect participation in the real four-day week', () => {
  const analysis = analyzeWeeklyMuscleParticipation(buildWeek(4));

  assert.deepEqual(
    analysis.muscles.map((participation) => participation.muscle),
    MUSCLE_GROUPS,
  );
  assert.deepEqual(
    participationSummary(analysis),
    EXPECTED_FOUR_DAY_PARTICIPATION,
  );
  assert.deepEqual(analysis.musclesWithoutDirectWork, []);
  assert.deepEqual(analysis.musclesWithoutAnyParticipation, []);
});

test('separates complete direct and indirect upper-body occurrences', () => {
  const analysis = analyzeWeeklyMuscleParticipation(buildWeek(4));
  const chest = participationByMuscle(analysis, 'chest');
  const shoulders = participationByMuscle(analysis, 'shoulders');
  const biceps = participationByMuscle(analysis, 'biceps');
  const triceps = participationByMuscle(analysis, 'triceps');

  assert.deepEqual(occurrenceDetails(chest.directOccurrences), [
    [1, 'Superior A', 'Supino Reto com Barra', 'horizontal_push'],
    [3, 'Superior B', 'Supino Inclinado com Barra', 'horizontal_push'],
  ]);
  assert.deepEqual(chest.indirectOccurrences, []);

  assert.deepEqual(occurrenceDetails(shoulders.directOccurrences), [
    [1, 'Superior A', 'Desenvolvimento com Barra', 'vertical_push'],
    [1, 'Superior A', 'Elevação Lateral com Halteres', 'shoulder_abduction'],
    [3, 'Superior B', 'Desenvolvimento com Halteres', 'vertical_push'],
    [3, 'Superior B', 'Elevação Lateral Unilateral na Polia', 'shoulder_abduction'],
  ]);
  assert.deepEqual(occurrenceDetails(shoulders.indirectOccurrences), [
    [1, 'Superior A', 'Supino Reto com Barra', 'horizontal_push'],
    [3, 'Superior B', 'Supino Inclinado com Barra', 'horizontal_push'],
  ]);

  assert.deepEqual(occurrenceDetails(biceps.directOccurrences), [
    [1, 'Superior A', 'Rosca Direta com Barra', 'elbow_flexion'],
    [3, 'Superior B', 'Rosca com Halteres', 'elbow_flexion'],
  ]);
  assert.deepEqual(occurrenceDetails(biceps.indirectOccurrences), [
    [1, 'Superior A', 'Remada Curvada com Barra', 'horizontal_pull'],
    [1, 'Superior A', 'Barra Fixa', 'vertical_pull'],
    [3, 'Superior B', 'Remada Unilateral com Halter', 'horizontal_pull'],
    [3, 'Superior B', 'Puxada na Frente', 'vertical_pull'],
  ]);

  assert.deepEqual(occurrenceDetails(triceps.directOccurrences), [
    [1, 'Superior A', 'Tríceps na Polia', 'elbow_extension'],
    [3, 'Superior B', 'Tríceps Francês na Polia', 'elbow_extension'],
  ]);
  assert.deepEqual(occurrenceDetails(triceps.indirectOccurrences), [
    [1, 'Superior A', 'Supino Reto com Barra', 'horizontal_push'],
    [1, 'Superior A', 'Desenvolvimento com Barra', 'vertical_push'],
    [3, 'Superior B', 'Supino Inclinado com Barra', 'horizontal_push'],
    [3, 'Superior B', 'Desenvolvimento com Halteres', 'vertical_push'],
  ]);
});

test('keeps multiple primary muscles direct and lower-body secondary roles indirect', () => {
  const analysis = analyzeWeeklyMuscleParticipation(buildWeek(4));
  const occurrenceIds = (muscle, role) =>
    participationByMuscle(analysis, muscle)[`${role}Occurrences`].map(
      (occurrence) => occurrence.exerciseId,
    );
  const deadliftIds = [
    'barbell-romanian-deadlift',
    'barbell-conventional-deadlift',
  ];

  for (const exerciseId of deadliftIds) {
    assert.ok(occurrenceIds('hamstrings', 'direct').includes(exerciseId));
    assert.ok(occurrenceIds('glutes', 'direct').includes(exerciseId));
  }
  assert.deepEqual(occurrenceIds('back', 'indirect'), deadliftIds);
  assert.deepEqual(occurrenceIds('quadriceps', 'indirect'), [
    'barbell-conventional-deadlift',
  ]);
  assert.deepEqual(occurrenceIds('hamstrings', 'indirect'), [
    'barbell-back-squat',
    'barbell-hip-thrust',
    'barbell-hip-thrust',
  ]);
  assert.deepEqual(occurrenceIds('glutes', 'indirect'), [
    'barbell-back-squat',
    'barbell-front-squat',
  ]);
});

test('keeps direct participation equivalent to the primary-only analysis', () => {
  const scenarios = [
    ...[2, 3, 4, 5, 6].map((daysPerWeek) => buildWeek(daysPerWeek)),
    buildWeek(4, ['dumbbell', 'bench', 'bodyweight']),
    buildWeek(2, ['bodyweight']),
    buildWeek(6, []),
  ];

  for (const week of scenarios) {
    const coverageAnalysis = analyzeWeeklyMuscleCoverage(week);
    const participationAnalysis = analyzeWeeklyMuscleParticipation(week);

    for (let index = 0; index < MUSCLE_GROUPS.length; index += 1) {
      const coverage = coverageAnalysis.muscles[index];
      const participation = participationAnalysis.muscles[index];

      assert.equal(participation.muscle, coverage.muscle);
      assert.equal(participation.directDayCount, coverage.dayCount);
      assert.equal(
        participation.directExerciseOccurrenceCount,
        coverage.exerciseOccurrenceCount,
      );
      assert.deepEqual(participation.directOccurrences, coverage.occurrences);
      assert.deepEqual(
        participation.directMovementPatterns,
        coverage.movementPatterns,
      );
    }
  }
});

test('analyzes the real six-day PPL A/B week', () => {
  const analysis = analyzeWeeklyMuscleParticipation(buildWeek(6));
  const expectedParticipation = {
    ...EXPECTED_FOUR_DAY_PARTICIPATION,
    back: [2, 4, 2, 2, ['vertical_pull', 'horizontal_pull'], ['hinge']],
    biceps: [
      2,
      2,
      2,
      4,
      ['elbow_flexion'],
      ['vertical_pull', 'horizontal_pull'],
    ],
  };

  assert.deepEqual(participationSummary(analysis), expectedParticipation);
  assert.deepEqual(analysis.musclesWithoutDirectWork, []);
  assert.deepEqual(analysis.musclesWithoutAnyParticipation, []);
});

test('reports both absence lists for a limited-equipment week', () => {
  const week = buildWeek(4, ['dumbbell', 'bench', 'bodyweight']);
  const analysis = analyzeWeeklyMuscleParticipation(week);

  assert.ok(week.days.some((day) => day.missingPatterns.length > 0));
  assert.deepEqual(analysis.musclesWithoutDirectWork, [
    'quadriceps',
    'hamstrings',
    'glutes',
    'calves',
  ]);
  assert.deepEqual(analysis.musclesWithoutAnyParticipation, [
    'quadriceps',
    'hamstrings',
    'glutes',
    'calves',
  ]);
  assert.deepEqual(participationSummary(analysis), {
    chest: [2, 2, 0, 0, ['horizontal_push'], []],
    back: [2, 2, 0, 0, ['horizontal_pull'], []],
    shoulders: [
      2,
      4,
      2,
      2,
      ['vertical_push', 'shoulder_abduction'],
      ['horizontal_push'],
    ],
    biceps: [2, 2, 2, 2, ['elbow_flexion'], ['horizontal_pull']],
    triceps: [
      2,
      2,
      2,
      4,
      ['elbow_extension'],
      ['horizontal_push', 'vertical_push'],
    ],
    quadriceps: [0, 0, 0, 0, [], []],
    hamstrings: [0, 0, 0, 0, [], []],
    glutes: [0, 0, 0, 0, [], []],
    calves: [0, 0, 0, 0, [], []],
    abs: [2, 2, 0, 0, ['core'], []],
  });
});

test('returns complete empty participation for a week with zero equipment', () => {
  const analysis = analyzeWeeklyMuscleParticipation(buildWeek(6, []));

  for (const participation of analysis.muscles) {
    assert.equal(participation.directDayCount, 0);
    assert.equal(participation.indirectDayCount, 0);
    assert.equal(participation.directExerciseOccurrenceCount, 0);
    assert.equal(participation.indirectExerciseOccurrenceCount, 0);
    assert.deepEqual(participation.directOccurrences, []);
    assert.deepEqual(participation.indirectOccurrences, []);
    assert.deepEqual(participation.directMovementPatterns, []);
    assert.deepEqual(participation.indirectMovementPatterns, []);
  }
  assert.deepEqual(analysis.musclesWithoutDirectWork, MUSCLE_GROUPS);
  assert.deepEqual(analysis.musclesWithoutAnyParticipation, MUSCLE_GROUPS);
});

test('distinguishes indirect-only participation in a bodyweight week', () => {
  const analysis = analyzeWeeklyMuscleParticipation(
    buildWeek(2, ['bodyweight']),
  );

  assert.deepEqual(analysis.musclesWithoutDirectWork, [
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'quadriceps',
    'hamstrings',
    'glutes',
    'calves',
  ]);
  assert.deepEqual(analysis.musclesWithoutAnyParticipation, [
    'back',
    'biceps',
    'quadriceps',
    'hamstrings',
    'glutes',
    'calves',
  ]);
  assert.deepEqual(participationSummary(analysis), {
    chest: [2, 2, 0, 0, ['horizontal_push'], []],
    back: [0, 0, 0, 0, [], []],
    shoulders: [0, 0, 2, 2, [], ['horizontal_push']],
    biceps: [0, 0, 0, 0, [], []],
    triceps: [0, 0, 2, 2, [], ['horizontal_push']],
    quadriceps: [0, 0, 0, 0, [], []],
    hamstrings: [0, 0, 0, 0, [], []],
    glutes: [0, 0, 0, 0, [], []],
    calves: [0, 0, 0, 0, [], []],
    abs: [2, 2, 0, 0, ['core'], []],
  });
});

test('maintains direct, indirect, absence, and order invariants', () => {
  const scenarios = [
    ...[2, 3, 4, 5, 6].map((daysPerWeek) => buildWeek(daysPerWeek)),
    buildWeek(4, ['dumbbell', 'bench', 'bodyweight']),
    buildWeek(2, ['bodyweight']),
    buildWeek(6, []),
  ];

  for (const week of scenarios) {
    const analysis = analyzeWeeklyMuscleParticipation(week);

    assert.deepEqual(
      analysis.muscles.map((participation) => participation.muscle),
      MUSCLE_GROUPS,
    );
    for (const participation of analysis.muscles) {
      assert.equal(
        participation.directExerciseOccurrenceCount,
        participation.directOccurrences.length,
      );
      assert.equal(
        participation.indirectExerciseOccurrenceCount,
        participation.indirectOccurrences.length,
      );
      assert.ok(participation.directDayCount >= 0);
      assert.ok(participation.indirectDayCount >= 0);
      assert.ok(participation.directDayCount <= week.days.length);
      assert.ok(participation.indirectDayCount <= week.days.length);

      for (const role of ['direct', 'indirect']) {
        const occurrences = participation[`${role}Occurrences`];
        const movementPatterns = participation[`${role}MovementPatterns`];

        assert.equal(
          participation[`${role}DayCount`],
          new Set(occurrences.map((occurrence) => occurrence.dayOrder)).size,
        );
        assert.deepEqual(
          movementPatterns,
          [...new Set(
            occurrences.map((occurrence) => occurrence.movementPattern),
          )],
        );
      }
    }

    assert.deepEqual(
      analysis.musclesWithoutDirectWork,
      analysis.muscles
        .filter(
          (participation) =>
            participation.directExerciseOccurrenceCount === 0,
        )
        .map((participation) => participation.muscle),
    );
    assert.deepEqual(
      analysis.musclesWithoutAnyParticipation,
      analysis.muscles
        .filter(
          (participation) =>
            participation.directExerciseOccurrenceCount === 0 &&
            participation.indirectExerciseOccurrenceCount === 0,
        )
        .map((participation) => participation.muscle),
    );
  }
});

test('is deterministic and does not mutate the week or official muscle groups', () => {
  const week = buildWeek(4);
  const weekBefore = JSON.stringify(week);
  const muscleGroupsBefore = [...MUSCLE_GROUPS];
  const first = analyzeWeeklyMuscleParticipation(week);
  const second = analyzeWeeklyMuscleParticipation(week);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.muscles, second.muscles);
  assert.equal(JSON.stringify(week), weekBefore);
  assert.deepEqual(MUSCLE_GROUPS, muscleGroupsBefore);
});
