import assert from 'node:assert/strict';
import test from 'node:test';

import exerciseData from '../../.expo/domain-tests/data/exercises/index.js';
import exerciseDomain from '../../.expo/domain-tests/domain/exercise/index.js';

const {
  EXERCISE_CATALOG,
  getExerciseById,
  getExercisesAvailableWithEquipment,
  getExercisesByEquipment,
  getExercisesByMovementPattern,
  getExercisesByPrimaryMuscle,
} = exerciseData;

const { EQUIPMENT, MOVEMENT_PATTERNS, MUSCLE_GROUPS } = exerciseDomain;

const REQUIRED_EXERCISE_IDS = [
  'barbell-bench-press',
  'incline-barbell-bench-press',
  'dumbbell-bench-press',
  'incline-dumbbell-press',
  'machine-chest-press',
  'cable-chest-fly',
  'push-up',
  'pull-up',
  'lat-pulldown',
  'barbell-row',
  'single-arm-dumbbell-row',
  'seated-cable-row',
  'machine-row',
  'barbell-overhead-press',
  'dumbbell-shoulder-press',
  'dumbbell-lateral-raise',
  'single-arm-cable-lateral-raise',
  'reverse-dumbbell-fly',
  'barbell-curl',
  'dumbbell-curl',
  'hammer-curl',
  'cable-curl',
  'cable-triceps-pushdown',
  'overhead-cable-triceps-extension',
  'dumbbell-overhead-triceps-extension',
  'close-grip-barbell-bench-press',
  'barbell-back-squat',
  'barbell-front-squat',
  'leg-press',
  'smith-machine-hack-squat',
  'leg-extension',
  'dumbbell-bulgarian-split-squat',
  'walking-lunge',
  'barbell-romanian-deadlift',
  'barbell-conventional-deadlift',
  'barbell-hip-thrust',
  'lying-leg-curl',
  'seated-leg-curl',
  'standing-calf-raise',
  'seated-calf-raise',
  'cable-crunch',
  'hanging-leg-raise',
  'plank',
];

const EXPECTED_EXERCISE_NAMES = {
  'barbell-bench-press': 'Supino Reto com Barra',
  'incline-barbell-bench-press': 'Supino Inclinado com Barra',
  'dumbbell-bench-press': 'Supino Reto com Halteres',
  'incline-dumbbell-press': 'Supino Inclinado com Halteres',
  'machine-chest-press': 'Supino na Máquina',
  'cable-chest-fly': 'Crucifixo na Polia',
  'push-up': 'Flexão de Braços',
  'pull-up': 'Barra Fixa',
  'lat-pulldown': 'Puxada na Frente',
  'barbell-row': 'Remada Curvada com Barra',
  'single-arm-dumbbell-row': 'Remada Unilateral com Halter',
  'seated-cable-row': 'Remada Baixa na Polia',
  'machine-row': 'Remada na Máquina',
  'barbell-overhead-press': 'Desenvolvimento com Barra',
  'dumbbell-shoulder-press': 'Desenvolvimento com Halteres',
  'dumbbell-lateral-raise': 'Elevação Lateral com Halteres',
  'single-arm-cable-lateral-raise': 'Elevação Lateral Unilateral na Polia',
  'reverse-dumbbell-fly': 'Crucifixo Inverso com Halteres',
  'barbell-curl': 'Rosca Direta com Barra',
  'dumbbell-curl': 'Rosca com Halteres',
  'hammer-curl': 'Rosca Martelo',
  'cable-curl': 'Rosca na Polia',
  'cable-triceps-pushdown': 'Tríceps na Polia',
  'overhead-cable-triceps-extension': 'Tríceps Francês na Polia',
  'dumbbell-overhead-triceps-extension': 'Tríceps Francês com Halter',
  'close-grip-barbell-bench-press': 'Supino Fechado com Barra',
  'barbell-back-squat': 'Agachamento Livre com Barra',
  'barbell-front-squat': 'Agachamento Frontal com Barra',
  'leg-press': 'Leg Press',
  'smith-machine-hack-squat': 'Agachamento Hack no Smith',
  'leg-extension': 'Cadeira Extensora',
  'dumbbell-bulgarian-split-squat': 'Agachamento Búlgaro com Halteres',
  'walking-lunge': 'Avanço Caminhando',
  'barbell-romanian-deadlift': 'Levantamento Terra Romeno com Barra',
  'barbell-conventional-deadlift': 'Levantamento Terra Convencional com Barra',
  'barbell-hip-thrust': 'Elevação Pélvica com Barra',
  'lying-leg-curl': 'Mesa Flexora',
  'seated-leg-curl': 'Cadeira Flexora',
  'standing-calf-raise': 'Elevação de Panturrilha em Pé',
  'seated-calf-raise': 'Elevação de Panturrilha Sentado',
  'cable-crunch': 'Abdominal na Polia',
  'hanging-leg-raise': 'Elevação de Pernas Suspenso',
  plank: 'Prancha',
};

function assertUnique(values, message) {
  assert.equal(new Set(values).size, values.length, message);
}

test('contains a reviewable but useful initial catalog', () => {
  assert.ok(EXERCISE_CATALOG.length >= 35);
  assert.ok(EXERCISE_CATALOG.length <= 45);
});

test('contains every required canonical exercise', () => {
  const catalogIds = new Set(EXERCISE_CATALOG.map((exercise) => exercise.id));

  for (const id of REQUIRED_EXERCISE_IDS) {
    assert.ok(catalogIds.has(id), `missing required exercise: ${id}`);
    assert.equal(
      getExerciseById(id)?.name,
      EXPECTED_EXERCISE_NAMES[id],
      `${id} must use its canonical PT-BR name`,
    );
  }
});

test('has unique valid IDs and non-empty required data', () => {
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  assertUnique(
    EXERCISE_CATALOG.map((exercise) => exercise.id),
    'exercise IDs must be unique',
  );
  assertUnique(
    EXERCISE_CATALOG.map((exercise) => exercise.name),
    'exercise names must be unique',
  );

  for (const exercise of EXERCISE_CATALOG) {
    assert.match(exercise.id, slugPattern, `invalid exercise ID: ${exercise.id}`);
    assert.ok(exercise.name.trim().length > 0, `${exercise.id} must have a name`);
    assert.ok(exercise.primaryMuscles.length > 0, `${exercise.id} needs a primary muscle`);
    assert.ok(exercise.equipment.length > 0, `${exercise.id} needs equipment`);
  }
});

test('has no duplicate or overlapping classifications within an exercise', () => {
  for (const exercise of EXERCISE_CATALOG) {
    assertUnique(exercise.primaryMuscles, `${exercise.id} repeats a primary muscle`);
    assertUnique(exercise.secondaryMuscles, `${exercise.id} repeats a secondary muscle`);
    assertUnique(exercise.equipment, `${exercise.id} repeats equipment`);

    const secondaryMuscles = new Set(exercise.secondaryMuscles);
    assert.ok(
      exercise.primaryMuscles.every((muscle) => !secondaryMuscles.has(muscle)),
      `${exercise.id} overlaps primary and secondary muscles`,
    );
  }
});

test('covers every domain muscle group with multiple primary options', () => {
  for (const muscle of MUSCLE_GROUPS) {
    const exercises = getExercisesByPrimaryMuscle(muscle);
    assert.ok(exercises.length >= 2, `${muscle} needs multiple primary exercises`);
  }
});

test('covers every domain equipment category', () => {
  for (const equipment of EQUIPMENT) {
    assert.ok(
      getExercisesByEquipment(equipment).length > 0,
      `${equipment} needs catalog coverage`,
    );
  }
});

test('covers every domain movement pattern', () => {
  for (const movementPattern of MOVEMENT_PATTERNS) {
    assert.ok(
      getExercisesByMovementPattern(movementPattern).length > 0,
      `${movementPattern} needs catalog coverage`,
    );
  }
});

test('gets an exercise by an existing ID', () => {
  assert.equal(getExerciseById('barbell-bench-press')?.name, 'Supino Reto com Barra');
});

test('returns undefined for an unknown exercise ID', () => {
  assert.equal(getExerciseById('unknown-exercise'), undefined);
});

test('filters only exercises with the requested primary muscle', () => {
  const chestExercises = getExercisesByPrimaryMuscle('chest');

  assert.ok(chestExercises.length > 0);
  assert.ok(chestExercises.every((exercise) => exercise.primaryMuscles.includes('chest')));
  assert.deepEqual(
    chestExercises,
    EXERCISE_CATALOG.filter((exercise) => exercise.primaryMuscles.includes('chest')),
  );
});

test('filters exercises by required equipment in canonical order', () => {
  const cableExercises = getExercisesByEquipment('cable');

  assert.ok(cableExercises.length > 0);
  assert.ok(cableExercises.every((exercise) => exercise.equipment.includes('cable')));
  assert.deepEqual(
    cableExercises,
    EXERCISE_CATALOG.filter((exercise) => exercise.equipment.includes('cable')),
  );
});

test('filters exercises by movement pattern in canonical order', () => {
  const hingeExercises = getExercisesByMovementPattern('hinge');

  assert.ok(hingeExercises.length > 0);
  assert.ok(
    hingeExercises.every((exercise) => exercise.movementPattern === 'hinge'),
  );
  assert.deepEqual(
    hingeExercises,
    EXERCISE_CATALOG.filter((exercise) => exercise.movementPattern === 'hinge'),
  );
});

test('assigns refined canonical patterns to isolation exercises', () => {
  const expectedPatterns = {
    'cable-chest-fly': 'horizontal_adduction',
    'reverse-dumbbell-fly': 'horizontal_abduction',
    'dumbbell-lateral-raise': 'shoulder_abduction',
    'single-arm-cable-lateral-raise': 'shoulder_abduction',
    'leg-extension': 'knee_extension',
    'lying-leg-curl': 'knee_flexion',
    'seated-leg-curl': 'knee_flexion',
    'barbell-hip-thrust': 'hip_extension',
  };

  for (const [id, movementPattern] of Object.entries(expectedPatterns)) {
    assert.equal(
      getExerciseById(id)?.movementPattern,
      movementPattern,
      `${id} must use ${movementPattern}`,
    );
  }
});

test('preserves canonical patterns for compound exercises', () => {
  const expectedPatterns = {
    'barbell-back-squat': 'squat',
    'barbell-romanian-deadlift': 'hinge',
    'barbell-overhead-press': 'vertical_push',
    'barbell-row': 'horizontal_pull',
    'pull-up': 'vertical_pull',
    'barbell-bench-press': 'horizontal_push',
  };

  for (const [id, movementPattern] of Object.entries(expectedPatterns)) {
    assert.equal(
      getExerciseById(id)?.movementPattern,
      movementPattern,
      `${id} must remain ${movementPattern}`,
    );
  }
});

test('filters knee flexion exercises without including hip hinges', () => {
  assert.deepEqual(
    getExercisesByMovementPattern('knee_flexion').map((exercise) => exercise.name),
    ['Mesa Flexora', 'Cadeira Flexora'],
  );
  assert.ok(
    !getExercisesByMovementPattern('knee_flexion').some(
      (exercise) => exercise.id === 'barbell-romanian-deadlift',
    ),
  );
});

test('filters shoulder abduction exercises in canonical order', () => {
  assert.deepEqual(
    getExercisesByMovementPattern('shoulder_abduction').map(
      (exercise) => exercise.name,
    ),
    ['Elevação Lateral com Halteres', 'Elevação Lateral Unilateral na Polia'],
  );
});

test('requires every equipment item for multi-equipment exercises', () => {
  const withDumbbellAndBench = getExercisesAvailableWithEquipment([
    'dumbbell',
    'bench',
  ]);
  const withDumbbellOnly = getExercisesAvailableWithEquipment(['dumbbell']);

  assert.ok(
    withDumbbellAndBench.some((exercise) => exercise.id === 'dumbbell-bench-press'),
  );
  assert.ok(
    !withDumbbellOnly.some((exercise) => exercise.id === 'dumbbell-bench-press'),
  );
});

test('treats bodyweight and pull-up bar as explicit independent requirements', () => {
  const bodyweightOnly = getExercisesAvailableWithEquipment(['bodyweight']);
  const bodyweightAndBar = getExercisesAvailableWithEquipment([
    'bodyweight',
    'pullup_bar',
  ]);

  assert.ok(bodyweightOnly.some((exercise) => exercise.id === 'push-up'));
  assert.ok(!bodyweightOnly.some((exercise) => exercise.id === 'pull-up'));
  assert.ok(bodyweightAndBar.some((exercise) => exercise.id === 'pull-up'));
});

test('equipment availability returns only executable exercises in canonical order', () => {
  const availableEquipment = ['barbell', 'bench'];
  const availableExercises = getExercisesAvailableWithEquipment(availableEquipment);

  assert.ok(
    availableExercises.every((exercise) =>
      exercise.equipment.every((equipment) => availableEquipment.includes(equipment)),
    ),
  );
  assert.deepEqual(
    availableExercises,
    EXERCISE_CATALOG.filter((exercise) =>
      exercise.equipment.every((equipment) => availableEquipment.includes(equipment)),
    ),
  );
});
