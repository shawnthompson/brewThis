import { describe, expect, it } from 'vitest';
import {
  abv,
  calculateBrewSheet,
  expectedOG,
  expectedOGPoints,
  gravityPoints,
  hasCrystalOrRoast,
  predictGravity,
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

  it('flags the revised Citra de Victo 25 L hot pre-boil plan', () => {
    const revised = calculateBrewSheet({
      ...citraIPA,
      preBoilVolumeL: 25,
      totalWaterL: 30.2,
      strikeWaterL: 18,
    });
    expect(revised.preBoilVolumeL).toBe(25);
    expect(revised.totalWaterL).toBe(30.2);
    expect(revised.spargeWaterL).toBeCloseTo(12.2, 10);
    expect(revised.preBoilFillRatio).toBeCloseTo(25 / 35, 10);
    expect(revised.boilOverRisk).toBe(true);
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

describe('predictGravity — efficiency diagnostic', () => {
  // Citra grist: 5.20 kg, 23.9 L pre-boil, 20.9 L post-boil, 19 L into fermenter.
  const citraVolumes = { batchSizeL: 19, preBoilVolumeL: 23.9, postBoilVolumeL: 20.9 };
  const citraGrist = [{ amountKg: 5.2, potential: 1.037, mashed: true }];

  it('predicts pre-boil gravity roughly 8 points apart at 76% and 65%', () => {
    const at76 = predictGravity(citraGrist, 76, citraVolumes);
    const at65 = predictGravity(citraGrist, 65, citraVolumes);
    const diffPoints = (at76.predictedPreBoilGravity - at65.predictedPreBoilGravity) * 1000;
    expect(diffPoints).toBeGreaterThan(7);
    expect(diffPoints).toBeLessThan(9);
    expect(at76.predictedPreBoilGravity).toBeCloseTo(1.056, 3);
    expect(at65.predictedPreBoilGravity).toBeCloseTo(1.048, 3);
    expect(at76.predictedOG).toBeCloseTo(1.064, 3);
    expect(at65.predictedOG).toBeCloseTo(1.055, 3);
    expect(at76.potentialEstimated).toBe(false);
  });

  it('matches Brewfather for Plansmash West Coast IPA (65%, OG 1.053, pre-boil 1.047)', () => {
    const p = predictGravity(
      [
        { amountKg: 4.65, potential: 1.034, mashed: true },
        { amountKg: 0.93, potential: 1.038, mashed: true },
      ],
      65,
      { batchSizeL: 20, preBoilVolumeL: 25.92, postBoilVolumeL: 22.92 }
    );
    // Within 1 gravity point of Brewfather's own figures (1.0531 / 1.047).
    expect(Math.abs(p.predictedOG - 1.0531)).toBeLessThan(0.001);
    expect(Math.abs(p.predictedPreBoilGravity - 1.047)).toBeLessThan(0.001);
  });

  it('falls back to 1.037 potential and flags the result as estimated', () => {
    const missing = predictGravity([{ amountKg: 5.2, mashed: true }], 76, citraVolumes);
    expect(missing.potentialEstimated).toBe(true);
    expect(missing.predictedPreBoilGravity).toBeCloseTo(
      predictGravity(citraGrist, 76, citraVolumes).predictedPreBoilGravity,
      10
    );
  });

  it('adds boil sugars to OG but not to pre-boil gravity', () => {
    const withSugar = predictGravity(
      [...citraGrist, { amountKg: 0.5, potential: 1.046, mashed: false }],
      76,
      citraVolumes
    );
    const base = predictGravity(citraGrist, 76, citraVolumes);
    expect(withSugar.predictedPreBoilGravity).toBeCloseTo(base.predictedPreBoilGravity, 10);
    expect(withSugar.predictedOG).toBeGreaterThan(base.predictedOG);
  });

  it('uses the efficiency passed to calculateBrewSheet, defaulting to the equipment profile', () => {
    const fermentables = citraGrist;
    expect(calculateBrewSheet({ ...citraIPA, fermentables }).gravity?.efficiencyPct).toBe(76);
    expect(calculateBrewSheet({ ...citraIPA, fermentables, efficiencyPct: 65 }).gravity?.efficiencyPct).toBe(65);
    expect(calculateBrewSheet(citraIPA).gravity).toBeUndefined();
  });

  it('leaves the golden water values unchanged when efficiency changes', () => {
    const a = calculateBrewSheet({ ...citraIPA, fermentables: citraGrist, efficiencyPct: 65 });
    const b = calculateBrewSheet(citraIPA);
    expect(a.totalWaterL).toBe(b.totalWaterL);
    expect(a.strikeTempC).toBe(b.strikeTempC);
  });
});

describe('step mash strike temperature', () => {
  it('targets the mash-in step when one is set', () => {
    const c = calculateBrewSheet({ ...citraIPA, mashInTempC: 52 });
    expect(c.strikeTempC).toBeCloseTo(strikeTemperatureC(18.2, 5.2, 52, 20), 10);
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

  it('course-corrects in gravity points: 1.056 at 24 L down to 21 L → 64 points, OG 1.064', () => {
    expect(gravityPoints(1.056)).toBeCloseTo(56, 10);
    expect(Math.abs(expectedOGPoints(gravityPoints(1.056), 24, 21) - 64)).toBeLessThanOrEqual(1);
    expect(Math.abs(expectedOG(1.056, 24, 21) - 1.064)).toBeLessThanOrEqual(0.001);
  });

  it('concentrates pre-boil gravity to expected OG', () => {
    expect(expectedOG(1.05, 24, 20)).toBeCloseTo(1.06, 10);
  });

  it('round-trips target pre-boil gravity', () => {
    const pre = targetPreBoilGravity(1.062, 23.9, 20.9);
    expect(expectedOG(pre, 23.9, 20.9)).toBeCloseTo(1.062, 10);
  });
});
