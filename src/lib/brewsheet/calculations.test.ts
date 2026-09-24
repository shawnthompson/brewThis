import { describe, expect, it } from 'vitest';
import {
  abv,
  calculateBrewSheet,
  expectedOG,
  hasCrystalOrRoast,
  strikeTemperatureC,
  targetPreBoilGravity,
} from './calculations';

// Citra IPA (September 2026) — hand-verified regression baseline.
const citraIPA = {
  batchSizeL: 19,
  grainKg: 5.2,
  boilMinutes: 60,
  whirlpoolHopG: 200,
  mashTempC: 66.7,
  grainTempC: 20,
  hasCrystalOrRoast: false,
};

describe('calculateBrewSheet — Citra IPA golden fixture', () => {
  const c = calculateBrewSheet(citraIPA);

  it('matches exact fields', () => {
    expect(c.grainAbsorptionL).toBeCloseTo(5.2, 10);
    expect(c.boilOffL).toBeCloseTo(3.0, 10);
    expect(c.hopLossL).toBeCloseTo(0.9, 10);
    expect(c.strikeAcidMl).toBe(4.0);
  });

  it('matches toleranced fields', () => {
    expect(Math.abs(c.preBoilVolumeL - 23.9)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(c.totalWaterL - 29.1)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(c.strikeWaterL - 18.2)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(c.spargeWaterL - 10.9)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(c.strikeTempC - 72.2)).toBeLessThanOrEqual(0.3);
  });

  it('scales sparge acid at ~1.5 mL per 11 L', () => {
    expect(c.spargeAcidMl).toBe(1.5);
  });

  it('flags boil-over risk above 65% fill', () => {
    expect(c.preBoilFillRatio).toBeCloseTo(23.9 / 35, 5);
    expect(c.boilOverRisk).toBe(true);
  });
});

describe('calculateBrewSheet — variations', () => {
  it('uses 3.0 mL strike acid when the grist has crystal or roast', () => {
    expect(calculateBrewSheet({ ...citraIPA, hasCrystalOrRoast: true }).strikeAcidMl).toBe(3.0);
  });

  it('gives zero hop loss with no whirlpool hops', () => {
    expect(calculateBrewSheet({ ...citraIPA, whirlpoolHopG: 0 }).hopLossL).toBe(0);
  });

  it('boils off 4.5 L over 90 minutes', () => {
    expect(calculateBrewSheet({ ...citraIPA, boilMinutes: 90 }).boilOffL).toBeCloseTo(4.5, 10);
  });

  it('recalculates strike temperature when strike volume is overridden', () => {
    const c = calculateBrewSheet({ ...citraIPA, strikeWaterL: 16 });
    expect(c.strikeWaterL).toBe(16);
    expect(c.strikeTempC).toBeCloseTo(strikeTemperatureC(16, 5.2, 66.7, 20), 10);
    expect(c.strikeTempC).toBeGreaterThan(calculateBrewSheet(citraIPA).strikeTempC);
    expect(c.spargeWaterL).toBeCloseTo(c.totalWaterL - 16, 10);
  });

  it('keeps the boil-over flag off for small batches', () => {
    expect(calculateBrewSheet({ ...citraIPA, batchSizeL: 10 }).boilOverRisk).toBe(false);
  });

  it('rejects an empty grist', () => {
    expect(() => calculateBrewSheet({ ...citraIPA, grainKg: 0 })).toThrow();
  });
});

describe('hasCrystalOrRoast', () => {
  it('detects crystal, roast and dark malts by name, type or category', () => {
    expect(hasCrystalOrRoast([{ name: 'Pale Ale' }, { name: 'Crystal 60' }])).toBe(true);
    expect(hasCrystalOrRoast([{ name: 'CaraMunich', grainCategory: 'Crystal/Caramel' }])).toBe(true);
    expect(hasCrystalOrRoast([{ name: 'Roasted Barley' }])).toBe(true);
    expect(hasCrystalOrRoast([{ name: 'Carafa Special III' }])).toBe(true);
    expect(hasCrystalOrRoast([{ name: 'Special B' }])).toBe(true);
    expect(hasCrystalOrRoast([{ name: 'Pale Chocolate' }])).toBe(true);
  });

  it('treats pale grists as pale', () => {
    expect(
      hasCrystalOrRoast([
        { name: 'Floor-Malted Bohemian Pilsner Malt', grainCategory: 'Base (Pilsner)' },
        { name: 'Vienna Malt', grainCategory: 'Base (Vienna)' },
        { name: 'Flaked Oats', type: 'Adjunct' },
      ])
    ).toBe(false);
  });
});

describe('gravity helpers', () => {
  it('computes ABV as (og - fg) × 131.25', () => {
    expect(abv(1.062, 1.012)).toBeCloseTo(6.5625, 10);
  });

  it('concentrates pre-boil gravity to expected OG', () => {
    expect(expectedOG(1.05, 24, 20)).toBeCloseTo(1.06, 10);
  });

  it('round-trips target pre-boil gravity', () => {
    const pre = targetPreBoilGravity(1.062, 23.9, 20.9);
    expect(expectedOG(pre, 23.9, 20.9)).toBeCloseTo(1.062, 10);
  });
});
