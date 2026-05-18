import {
  calculateTDEE,
  calculateTargets,
  getMacroColor,
  getProgressPercent,
  formatMacro,
  getRemainingCalories,
  getMacroPercentage,
} from '../../lib/nutrition';

describe('calculateTDEE', () => {
  it('calculates TDEE for a sedentary male', () => {
    // BMR = 10*80 + 6.25*175 - 5*25 + 5 = 800 + 1093.75 - 125 + 5 = 1773.75
    // TDEE = 1773.75 * 1.2 = 2128.5 ≈ 2129
    const result = calculateTDEE(80, 175, 25, 'sedentary', true);
    expect(result).toBe(2129);
  });

  it('calculates TDEE for a very active female', () => {
    // BMR = 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
    // TDEE = 1320.25 * 1.725 ≈ 2277
    const result = calculateTDEE(60, 165, 30, 'very_active', false);
    expect(result).toBe(2277);
  });

  it('calculates TDEE for moderately active male', () => {
    const result = calculateTDEE(90, 183, 22, 'moderately_active', true);
    expect(result).toBeGreaterThan(2500);
    expect(result).toBeLessThan(3500);
  });

  it('returns higher TDEE for extremely active than sedentary', () => {
    const sedentary = calculateTDEE(80, 175, 25, 'sedentary', true);
    const extremelyActive = calculateTDEE(80, 175, 25, 'extremely_active', true);
    expect(extremelyActive).toBeGreaterThan(sedentary);
  });

  it('returns higher TDEE for male than female with same stats', () => {
    const male = calculateTDEE(70, 170, 28, 'moderately_active', true);
    const female = calculateTDEE(70, 170, 28, 'moderately_active', false);
    expect(male).toBeGreaterThan(female);
  });
});

describe('calculateTargets', () => {
  it('reduces calories for weight_loss goal', () => {
    const tdee = 2500;
    const result = calculateTargets(tdee, 'weight_loss', 80);
    expect(result.calories).toBe(2000); // 2500 - 500
  });

  it('increases calories for muscle_gain goal', () => {
    const tdee = 2500;
    const result = calculateTargets(tdee, 'muscle_gain', 80);
    expect(result.calories).toBe(2800); // 2500 + 300
  });

  it('keeps calories at TDEE for general_fitness', () => {
    const tdee = 2500;
    const result = calculateTargets(tdee, 'general_fitness', 80);
    expect(result.calories).toBe(2500);
  });

  it('calculates higher protein for athletic_performance', () => {
    const resultAthletic = calculateTargets(2500, 'athletic_performance', 80);
    const resultGeneral = calculateTargets(2500, 'general_fitness', 80);
    expect(resultAthletic.protein).toBeGreaterThan(resultGeneral.protein);
  });

  it('returns non-negative carbs', () => {
    const result = calculateTargets(1500, 'weight_loss', 80);
    expect(result.carbs).toBeGreaterThanOrEqual(0);
  });

  it('returns positive fat values', () => {
    const result = calculateTargets(2500, 'strength', 80);
    expect(result.fat).toBeGreaterThan(0);
  });

  it('protein equals weight * multiplier for muscle_gain', () => {
    const result = calculateTargets(2500, 'muscle_gain', 80);
    // 2.2 * 80 = 176
    expect(result.protein).toBe(176);
  });
});

describe('getMacroColor', () => {
  it('returns yellow/amber for calories', () => {
    expect(getMacroColor('calories')).toBe('#f59e0b');
  });

  it('returns green for protein', () => {
    expect(getMacroColor('protein')).toBe('#22c55e');
  });

  it('returns blue for carbs', () => {
    expect(getMacroColor('carbs')).toBe('#60a5fa');
  });

  it('returns red for fat', () => {
    expect(getMacroColor('fat')).toBe('#f87171');
  });
});

describe('getProgressPercent', () => {
  it('returns 0 when current is 0', () => {
    expect(getProgressPercent(0, 100)).toBe(0);
  });

  it('returns 50 for halfway', () => {
    expect(getProgressPercent(50, 100)).toBe(50);
  });

  it('returns 100 for target met', () => {
    expect(getProgressPercent(100, 100)).toBe(100);
  });

  it('caps at 100 when over target', () => {
    expect(getProgressPercent(150, 100)).toBe(100);
  });

  it('handles fractional values', () => {
    expect(getProgressPercent(75, 200)).toBe(38); // 37.5 rounded
  });
});

describe('formatMacro', () => {
  it('formats with default grams unit', () => {
    expect(formatMacro(150)).toBe('150g');
  });

  it('formats with custom unit', () => {
    expect(formatMacro(2500, 'kcal')).toBe('2500kcal');
  });

  it('rounds float values', () => {
    expect(formatMacro(150.7)).toBe('151g');
  });
});

describe('getRemainingCalories', () => {
  it('returns remaining when under target', () => {
    expect(getRemainingCalories(1500, 2500)).toBe(1000);
  });

  it('returns 0 when at target', () => {
    expect(getRemainingCalories(2500, 2500)).toBe(0);
  });

  it('returns 0 when over target', () => {
    expect(getRemainingCalories(3000, 2500)).toBe(0);
  });
});

describe('getMacroPercentage', () => {
  it('calculates protein percentage correctly', () => {
    // protein: 100g = 400 kcal, carbs: 100g = 400 kcal, fat: 44g ≈ 400 kcal → total ≈ 1200
    const totals = { protein: 100, carbs: 100, fat: 44 };
    const pct = getMacroPercentage('protein', totals);
    expect(pct).toBeGreaterThan(30);
    expect(pct).toBeLessThan(40);
  });

  it('returns 0 when all macros are 0', () => {
    expect(getMacroPercentage('protein', { protein: 0, carbs: 0, fat: 0 })).toBe(0);
  });

  it('fat uses 9 cal/g multiplier', () => {
    // 100g fat = 900 kcal, 100g protein = 400 kcal → fat % = 900/1300 ≈ 69%
    const totals = { protein: 100, carbs: 0, fat: 100 };
    const pct = getMacroPercentage('fat', totals);
    expect(pct).toBeGreaterThan(65);
    expect(pct).toBeLessThan(75);
  });
});
