import { describe, expect, it } from 'vitest';
import { RAPT_SAFETY } from '@/lib/brewsheet/procedure';
import { buildRaptProfile, renderRaptProfile } from './profile';

const citraInput = {
  batchSizeL: 19, grainKg: 5.2, boilMinutes: 60, whirlpoolHopG: 200,
  mashTempC: 66.7, grainTempC: 20, hasCrystalOrRoast: false,
};

function citraProfile(
  mashSteps = [{ stepTemp: 66.7, stepTime: 60 }, { stepTemp: 75, stepTime: 10 }],
  miscAdditions = [
    { name: 'Servomyces', amount: 1, unit: 'capsule', time: 15, use: 'Boil' },
    // Deliberately outside the manufacturer reference rate for this 19 L batch.
    { name: 'Whirlfloc', amount: 1, unit: 'items', time: 15, use: 'Boil' },
  ]
) {
  return buildRaptProfile(citraInput, {
    recipeName: 'Citra IPA',
    mashSteps,
    boilHops: [{ name: 'Cascade', amount: 50, time: 60, use: 'Boil' }],
    miscAdditions,
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
    expect(alerts).toContain('Whirlfloc');
    expect(alerts).toContain('1 tablet Whirlfloc');
    expect(alerts).not.toContain('Servomyces — FLAG');
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

  it('keeps the live-setpoint warning on the kettle-risk steps', () => {
    const warned = profile.steps.filter((step) => step.alerts.some((alert) => alert.message === RAPT_SAFETY.liveSetpointWarning));
    expect(warned.map((step) => step.name)).toEqual(['Heat strike water', 'Add grains', 'Sparging', 'Check gravity (pre-boil)', 'Boil heat', 'Boil', 'Whirlpool', 'Flameout and chill']);
  });

  it('renders the live-setpoint warning once at the top and on kettle-risk steps', () => {
    const copied = renderRaptProfile(profile);
    expect(copied.split(RAPT_SAFETY.liveSetpointWarning).length - 1).toBe(9);
  });

  it('keeps the boil as the only intentionally split pair', () => {
    expect(profile.steps.every((step) => step.name.length > 0 && Number.isFinite(step.targetC))).toBe(true);
    expect(profile.steps.filter((step) => step.targetC === 105).map((step) => step.name)).toEqual(['Boil heat', 'Boil']);
    expect(profile.steps.filter((step) => step.name === 'Boil heat' || step.name === 'Boil')).toHaveLength(2);
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

describe('amount-aware manufacturer reference flags', () => {
  const misc = (amount: number, unit = 'g') => [{ name: 'Servomyces', amount, unit, time: 15, use: 'Boil' }];
  const boilAlert = (amount: number, unit = 'g') => citraProfile(undefined, misc(amount, unit)).steps[7].alerts
    .find((alert) => alert.when === 'elapsed')?.message ?? '';

  it('reports the direction and range for low Servomyces', () => {
    expect(boilAlert(0.05)).toContain('Servomyces 0.05 g is ~4× below the reference for a 19 L batch (use 0.19–0.38 g).');
  });

  it('does not flag in-range Servomyces at 0.19 g or 0.3 g', () => {
    expect(boilAlert(0.19)).not.toContain('FLAG');
    expect(boilAlert(0.3)).not.toContain('FLAG');
  });

  it('accepts one capsule for a 19 L batch', () => {
    expect(boilAlert(1, 'capsule')).not.toContain('FLAG');
  });
});
