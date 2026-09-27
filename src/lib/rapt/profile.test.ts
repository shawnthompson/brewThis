import { describe, expect, it } from 'vitest';
import { RAPT_SAFETY } from '@/lib/brewsheet/procedure';
import { buildRaptProfile, renderRaptProfile } from './profile';

const citraInput = {
  batchSizeL: 19, grainKg: 5.2, boilMinutes: 60, whirlpoolHopG: 200,
  mashTempC: 66.7, grainTempC: 20, hasCrystalOrRoast: false,
};

function citraProfile(mashSteps = [{ stepTemp: 66.7, stepTime: 60 }, { stepTemp: 75, stepTime: 10 }]) {
  return buildRaptProfile(citraInput, {
    recipeName: 'Citra IPA',
    mashSteps,
    boilHops: [{ name: 'Cascade', amount: 50, time: 60, use: 'Boil' }],
    miscAdditions: [{ name: 'Servomyces + Whirlfloc', amount: 0.5, unit: 'tsp', time: 15, use: 'Boil' }],
    whirlpoolHops: [{ name: 'Citra', amount: 200, time: 20, use: 'Whirlpool' }],
    preBoilGravityTarget: '~1.054 at 25 L',
  });
}

describe('buildRaptProfile — Citra IPA golden fixture', () => {
  const profile = citraProfile();

  it('uses calculated strike liquor temperature and the corrected physical sequence', () => {
    expect(profile.steps.map((step) => step.name)).toEqual([
      'Heat strike water',
      'Add grains',
      'Mash rest',
      'Mash out',
      'Sparging',
      'Check gravity (pre-boil)',
      'Boil heat',
      'Boil',
      'Whirlpool',
      'Flameout and chill',
    ]);
    expect(profile.steps.map((step) => step.targetC)).toEqual([72.2, 66.7, 66.7, 75, 80, 80, 105, 105, 80, 80]);
    expect(profile.steps.map((step) => step.endCondition)).toEqual([
      'manual', 'manual', 'timer', 'timer', 'manual', 'manual', 'manual', 'timer', 'timer', 'manual',
    ]);
  });

  it('uses explicit timer starts and keeps unreachable timers on step start', () => {
    const timers = profile.steps.filter((step) => step.endCondition === 'timer');
    expect(timers.every((step) => step.timerStart !== undefined)).toBe(true);
    expect(profile.steps[3]).toMatchObject({ targetC: 75, durationMinutes: 10, timerStart: 'onTargetReached' });
    expect(profile.steps[7]).toMatchObject({ targetC: 105, timerStart: 'onStepStart', durationMinutes: 60 });
    expect(profile.steps[8]).toMatchObject({ targetC: 80, timerStart: 'onStepStart', durationMinutes: 20 });
  });

  it('supports all three alert triggers and rejects an unreachable temperature trigger', () => {
    const alerts = profile.steps.flatMap((step) => step.alerts);
    expect(alerts.some((alert) => alert.when === 'stepStart')).toBe(true);
    expect(alerts.some((alert) => alert.when === 'elapsed')).toBe(true);
    expect(alerts.some((alert) => alert.when === 'temperatureReached')).toBe(true);
    expect(alerts.filter((alert) => alert.when === 'temperatureReached').every((alert) => alert.temperatureC < 100)).toBe(true);
    expect(profile.steps[6].alerts.find((alert) => alert.when === 'temperatureReached')).toMatchObject({ temperatureC: 98 });
  });

  it('keeps the recipe additions and visible manufacturer flag', () => {
    const alerts = profile.steps.flatMap((step) => step.alerts.map((alert) => alert.message)).join('\n');
    expect(alerts).toContain('50 g Cascade');
    expect(profile.steps[7].alerts).toContainEqual(expect.objectContaining({ when: 'elapsed', elapsedMinutes: 45 }));
    expect(alerts).toContain('Servomyces');
    expect(alerts).toContain('FLAG');
    expect(alerts).toContain('~1.054 at 25 L');
    expect(alerts).toContain('refractometer');
  });

  it('puts the canonical safety text into copied output with exact portal vocabulary', () => {
    const copied = renderRaptProfile(profile);
    expect(copied).toContain(RAPT_SAFETY.boilOverWatch);
    expect(copied).toContain('Heat/Cool to target Temperature');
    expect(copied).toContain('The step timer is finished');
    expect(copied).toContain('I press a button on the device');
    expect(copied).toContain('Timer starts: onStepStart');
    expect(copied).toContain('°C');
  });

  it('gives every step a live-setpoint dry-fire warning', () => {
    expect(profile.steps.every((step) => step.alerts.some((alert) => alert.message === RAPT_SAFETY.noHeating))).toBe(true);
  });

  it('renders the live-setpoint warning for every generated step', () => {
    const copied = renderRaptProfile(profile);
    expect(copied.split(RAPT_SAFETY.noHeating).length - 1).toBe(profile.steps.length + 1);
  });

  it('does not create an alert-only or merged stage', () => {
    expect(profile.steps.every((step) => step.name.length > 0 && Number.isFinite(step.targetC))).toBe(true);
    expect('mergedSteps' in profile).toBe(false);
  });
});

describe('mash schedule preservation', () => {
  it('emits every configured rest instead of collapsing intermediate rests', () => {
    const profile = citraProfile([
      { stepTemp: 52, stepTime: 15 },
      { stepTemp: 66.7, stepTime: 60 },
      { stepTemp: 75, stepTime: 10 },
    ]);
    expect(profile.steps.map((step) => step.name)).toContain('Mash rest');
    expect(profile.steps.filter((step) => step.name === 'Mash rest')).toHaveLength(2);
  });
});
