import { describe, expect, it } from 'vitest';
import type { BrewfatherRecipe } from '@/types';
import {
  efficiencyFor,
  hopsByUse,
  mashPhTargetFromRecipe,
  parseOverride,
  saccharificationStep,
  toBrewSheetInput,
} from './fromRecipe';

const recipe: BrewfatherRecipe = {
  _id: 'r1',
  name: 'Test IPA',
  batchSize: 19,
  boilTime: 60,
  fermentables: [
    { name: 'Pale Ale', type: 'Grain', amount: 4.7, grainCategory: 'Base' },
    { name: 'Flaked Oats', type: 'Adjunct', amount: 0.5 },
    { name: 'Dextrose', type: 'Sugar', amount: 0.3 },
    { name: 'Crystal 40', type: 'Grain', amount: 0.2, addAfterBoil: true },
  ],
  hops: [
    { name: 'Magnum', use: 'Boil', amount: 10, time: 60 },
    { name: 'Citra', use: 'Boil', amount: 20, time: 5 },
    { name: 'Citra', use: 'Aroma', amount: 120, time: 20 },
    { name: 'Mosaic', use: 'Whirlpool', amount: 80, time: 20 },
    { name: 'Citra', use: 'Dry Hop', amount: 100, day: 7 },
    { name: 'Mosaic', use: 'Dry Hop', amount: 50, day: 3 },
  ],
  mash: { steps: [{ stepTemp: 66.7, stepTime: 60 }, { stepTemp: 75, stepTime: 10 }] },
};

describe('toBrewSheetInput', () => {
  it('maps a recipe onto calculation inputs', () => {
    expect(toBrewSheetInput(recipe)).toEqual({
      batchSizeL: 19,
      grainKg: 5.2,
      boilMinutes: 60,
      whirlpoolHopG: 200,
      mashTempC: 66.7,
      mashInTempC: undefined,
      grainTempC: 20,
      strikeWaterL: undefined,
      hasCrystalOrRoast: false,
      efficiencyPct: 76,
      fermentables: [
        { amountKg: 4.7, potential: undefined, mashed: true },
        { amountKg: 0.5, potential: undefined, mashed: true },
        { amountKg: 0.3, potential: undefined, mashed: false },
      ],
    });
  });

  it('chooses the saccharification rest over a protein rest', () => {
    const stepMash: BrewfatherRecipe = {
      ...recipe,
      mash: { steps: [{ stepTemp: 52, stepTime: 15 }, { stepTemp: 66.7, stepTime: 60 }] },
    };
    const input = toBrewSheetInput(stepMash);
    expect(input.mashTempC).toBe(66.7);
    expect(input.mashInTempC).toBe(52);
  });

  it('applies overrides', () => {
    const input = toBrewSheetInput(recipe, { batchSizeL: 21, mashTempC: 65, grainTempC: 15, strikeWaterL: 17 });
    expect(input).toMatchObject({ batchSizeL: 21, mashTempC: 65, grainTempC: 15, strikeWaterL: 17 });
  });
});

describe('mashPhTargetFromRecipe', () => {
  it('reads the per-recipe target range from notes', () => {
    expect(mashPhTargetFromRecipe({ notes: 'Mash pH target: 5.5–5.6' })).toEqual({
      low: 5.5,
      high: 5.6,
      label: '5.5–5.6',
    });
  });

  it('matches the target range instead of an earlier cooling range', () => {
    expect(mashPhTargetFromRecipe({
      notes: 'Measure pH on a sample cooled to 20–25 °C; mash pH target: 5.3–5.4',
    })?.label).toBe('5.3–5.4');
  });

  it('does not invent a target when the recipe note has none', () => {
    expect(mashPhTargetFromRecipe({ notes: 'Use Montreal water.' })).toBeUndefined();
  });

  it('rejects implausible pH ranges', () => {
    expect(mashPhTargetFromRecipe({ notes: 'Mash pH target: 3.0–3.5' })).toBeUndefined();
  });
});

describe('saccharificationStep', () => {
  it('prefers a step named or typed saccharification', () => {
    const steps = [
      { name: 'Protein rest', stepTemp: 52 },
      { name: 'Saccharification', stepTemp: 64 },
      { name: 'Beta/alpha', stepTemp: 70 },
    ];
    expect(saccharificationStep(steps)?.stepTemp).toBe(64);
  });

  it('otherwise takes the hottest rest below mash-out', () => {
    expect(saccharificationStep([{ stepTemp: 65 }, { stepTemp: 78 }])?.stepTemp).toBe(65);
    expect(saccharificationStep([{ stepTemp: 52 }, { stepTemp: 66.7 }, { stepTemp: 75 }])?.stepTemp).toBe(66.7);
  });

  it('falls back to the first step', () => {
    expect(saccharificationStep([{ stepTemp: 76 }, { stepTemp: 78 }])?.stepTemp).toBe(76);
    expect(saccharificationStep([])).toBeUndefined();
  });

  it('leaves single-infusion mashes striking to the one rest', () => {
    expect(toBrewSheetInput(recipe).mashInTempC).toBeUndefined();
  });
});

describe('efficiencyFor', () => {
  it('uses the Brewfather equipment profile, then recipe, then the 76% default', () => {
    expect(efficiencyFor({ ...recipe, equipment: { efficiency: 65 }, efficiency: 70 })).toEqual({ efficiencyPct: 65, source: 'brewfather' });
    expect(efficiencyFor({ ...recipe, efficiency: 70 })).toEqual({ efficiencyPct: 70, source: 'brewfather' });
    expect(efficiencyFor(recipe)).toEqual({ efficiencyPct: 76, source: 'default' });
  });

  it('lets ?efficiency= override everything', () => {
    expect(efficiencyFor({ ...recipe, equipment: { efficiency: 65 } }, { efficiencyPct: 80 })).toEqual({ efficiencyPct: 80, source: 'override' });
  });
});

describe('hopsByUse', () => {
  it('orders boil hops by time and dry hops by day', () => {
    const h = hopsByUse(recipe);
    expect(h.boil.map((x) => x.time)).toEqual([60, 5]);
    expect(h.dryHop.map((x) => x.day)).toEqual([3, 7]);
    expect(h.whirlpool).toHaveLength(2);
  });
});

describe('parseOverride', () => {
  it('accepts in-range numbers and ignores the rest', () => {
    expect(parseOverride('21', 1, 30)).toBe(21);
    expect(parseOverride('abc', 1, 30)).toBeUndefined();
    expect(parseOverride('99', 1, 30)).toBeUndefined();
    expect(parseOverride('', 1, 30)).toBeUndefined();
    expect(parseOverride(['1', '2'], 1, 30)).toBeUndefined();
    expect(parseOverride(undefined, 1, 30)).toBeUndefined();
  });
});
