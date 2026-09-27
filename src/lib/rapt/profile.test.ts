import { describe, expect, it } from 'vitest';
import { buildRaptProfile } from './profile';

const citraInput = {
  batchSizeL: 19, grainKg: 5.2, boilMinutes: 60, whirlpoolHopG: 200,
  mashTempC: 66.7, grainTempC: 20, hasCrystalOrRoast: false,
};

describe('buildRaptProfile — Citra IPA golden fixture', () => {
  const profile = buildRaptProfile(citraInput, {
    recipeName: 'Citra IPA',
    mashSteps: [{ stepTemp: 66.7, stepTime: 60 }, { stepTemp: 75, stepTime: 10 }],
    boilHops: [{ name: 'Cascade', amount: 50, time: 60, use: 'Boil' }],
    miscAdditions: [{ name: 'Whirlfloc + Servomyces', time: 15, use: 'Boil' }],
    whirlpoolHops: [{ name: 'Citra', amount: 200, time: 20, use: 'Whirlpool' }],
  });

  it('emits a full list and a six-stage handoff', () => {
    expect(profile.steps).toHaveLength(8);
    expect(profile.mergedSteps).toHaveLength(6);
  });

  it('keeps manual points, the mash-out climb, and recipe-driven alerts', () => {
    expect(profile.steps.map((s) => s.endCondition)).toEqual([
      'manual', 'timer', 'targetReached', 'timer', 'manual', 'manual', 'timer', 'manual',
    ]);
    expect(profile.steps[2]).toMatchObject({ type: 'ramp', targetC: 75, endCondition: 'targetReached' });
    expect(profile.steps[5].alert).toContain('Cascade');
    expect(profile.steps[6].alert).toContain('Whirlfloc + Servomyces');
    expect(profile.steps[7].alert).toContain('Citra');
  });
});
