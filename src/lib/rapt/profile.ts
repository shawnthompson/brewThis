import type { BrewfatherHop, BrewfatherMashStep } from '@/types';
import { calculateBrewSheet, round, type BrewSheetInput } from '@/lib/brewsheet/calculations';
import { RAPT_REFERENCE_FLAGS, RAPT_SAFETY, WHIRLPOOL_MINUTES } from '@/lib/brewsheet/procedure';

export type RaptStepType = 'heat' | 'ramp';
export type RaptEndCondition = 'timer' | 'targetReached' | 'manual';
export type RaptTimerStart = 'onStepStart' | 'onTargetReached';

export type RaptAlert =
  | { when: 'stepStart'; message: string }
  | { when: 'elapsed'; elapsedMinutes: number; message: string }
  | { when: 'temperatureReached'; temperatureC: number; message: string };

export interface RaptStep {
  name: string;
  type: RaptStepType;
  targetC: number;
  endCondition: RaptEndCondition;
  timerStart?: RaptTimerStart;
  durationMinutes?: number;
  alerts: RaptAlert[];
}

export interface RaptProfile {
  name: string;
  description: string;
  steps: RaptStep[];
}

export interface RaptMiscAddition {
  name: string;
  amount?: number;
  unit?: string;
  time?: number;
  use?: string;
}

export interface RaptScheduleInput {
  recipeName: string;
  mashSteps?: BrewfatherMashStep[];
  boilHops?: Pick<BrewfatherHop, 'name' | 'amount' | 'time' | 'use'>[];
  whirlpoolHops?: Pick<BrewfatherHop, 'name' | 'amount' | 'time' | 'use'>[];
  miscAdditions?: RaptMiscAddition[];
  preBoilGravityTarget?: string;
  whirlpoolMinutes?: number;
}

export const RAPT_TYPE_LABELS = {
  heat: 'Heat/Cool to target Temperature',
  ramp: 'Gradual ramp to target over length of step',
} as const;

export const RAPT_END_LABELS = {
  timer: 'The step timer is finished',
  targetReached: 'The target temperature is reached',
  manual: 'I press a button on the device',
} as const;

const fmt = (value: number) => String(value);
const names = (items: { name?: string }[]) => [...new Set(items.map((x) => x.name?.trim()).filter(Boolean))].join(', ');
const amount = (value: number | undefined, unit = 'g') => value === undefined ? '' : `${fmt(value)} ${unit} `;

function holdWarning(): RaptAlert {
  return { when: 'stepStart', message: RAPT_SAFETY.noHeating };
}

function timedStep(
  name: string,
  targetC: number,
  durationMinutes: number,
  alerts: RaptAlert[] = [],
  timerStart: RaptTimerStart = 'onTargetReached'
): RaptStep {
  return {
    name,
    type: 'heat',
    targetC,
    endCondition: 'timer',
    timerStart,
    durationMinutes,
    alerts: [holdWarning(), ...alerts],
  };
}

function stepTemperature(step: BrewfatherMashStep): number | undefined {
  return step.stepTemp ?? step.temp;
}

function stepMinutes(step: BrewfatherMashStep): number | undefined {
  return step.stepTime ?? step.time;
}

function mashSteps(input: BrewSheetInput, schedule: RaptScheduleInput, strikeTempC: number): RaptStep[] {
  const configured = schedule.mashSteps ?? [];
  const steps: RaptStep[] = [{
    name: 'Heat strike water',
    type: 'heat',
    targetC: strikeTempC,
    endCondition: 'manual',
    alerts: [holdWarning()],
  }];

  steps.push({
    name: 'Add grains',
    type: 'heat',
    targetC: input.mashTempC,
    endCondition: 'manual',
    alerts: [holdWarning(), { when: 'stepStart', message: 'Manual point: add and mix the grain, then press the device button.' }],
  });

  const rests = configured.length > 0 ? configured : [{ stepTemp: input.mashTempC, stepTime: 60 }];
  for (const rest of rests) {
    const targetC = stepTemperature(rest);
    const durationMinutes = stepMinutes(rest);
    if (targetC === undefined || durationMinutes === undefined) continue;
    if (targetC >= 75) {
      steps.push(timedStep('Mash out', targetC, durationMinutes));
    } else {
      steps.push(timedStep('Mash rest', targetC, durationMinutes));
    }
  }
  return steps;
}

function miscLabel(item: RaptMiscAddition): string {
  const label = `${amount(item.amount, item.unit)}${item.name}`.trim();
  if (/servomyces/i.test(item.name)) return `${label} — FLAG: ${RAPT_REFERENCE_FLAGS.servomyces}`;
  if (/whirlfloc/i.test(item.name)) return `${label} — reference: ${RAPT_REFERENCE_FLAGS.whirlfloc}`;
  return label;
}

function boilHopLabel(items: RaptScheduleInput['boilHops'], minutes: number): string {
  return (items ?? [])
    .filter((item) => item.time === minutes)
    .map((item) => `${amount(item.amount)}${item.name}`.trim())
    .join(', ');
}

function miscLabelAt(items: RaptMiscAddition[] | undefined, minutes: number): string {
  return (items ?? []).filter((item) => item.use === undefined || /boil/i.test(item.use))
    .filter((item) => item.time === minutes)
    .map(miscLabel)
    .join(', ');
}

export function raptAlertTriggerLabel(alert: RaptAlert): string {
  if (alert.when === 'stepStart') return 'The Step Starts';
  if (alert.when === 'elapsed') return `${alert.elapsedMinutes} minutes after the step starts`;
  return `The specified temperature is reached: ${fmt(alert.temperatureC)} °C`;
}

export function buildRaptProfile(input: BrewSheetInput, schedule: RaptScheduleInput): RaptProfile {
  const calculated = calculateBrewSheet(input);
  const strikeTempC = round(calculated.strikeTempC, 1);
  const boilStart = boilHopLabel(schedule.boilHops, input.boilMinutes);
  const boilMisc = miscLabelAt(schedule.miscAdditions, 15);
  const whirlpoolNames = names(schedule.whirlpoolHops ?? []);
  const whirlpoolMinutes = schedule.whirlpoolMinutes
    ?? Math.max(...(schedule.whirlpoolHops ?? []).map((hop) => hop.time ?? 0), WHIRLPOOL_MINUTES);
  const gravityTarget = schedule.preBoilGravityTarget
    ?? 'Target not supplied by recipe — add a target before brew day.';

  const steps: RaptStep[] = [
    ...mashSteps(input, schedule, strikeTempC),
    {
      name: 'Sparging',
      type: 'heat', targetC: 80, endCondition: 'manual', alerts: [holdWarning(), {
        when: 'stepStart', message: 'Manual point: sparge with the kettle holding the first runnings; do not run this step on a low kettle.',
      }],
    },
    {
      name: 'Check gravity (pre-boil)',
      type: 'heat', targetC: 80, endCondition: 'manual', alerts: [holdWarning(), {
        when: 'stepStart', message: `Manual point: check approximately ${gravityTarget} with a refractometer and record the reading.`,
      }],
    },
    {
      // This split is driven by the unreachable 105 °C setpoint and timer
      // semantics, not by the placement of an alert.
      name: 'Boil heat',
      type: 'heat', targetC: 105, endCondition: 'manual', alerts: [holdWarning(), {
        when: 'temperatureReached', temperatureC: 98, message: `${RAPT_SAFETY.boilImminent} ${RAPT_SAFETY.boilOverWatch}`,
      }],
    },
    {
      name: 'Boil',
      type: 'heat', targetC: 105, endCondition: 'timer', timerStart: 'onStepStart', durationMinutes: input.boilMinutes,
      alerts: [holdWarning(), {
        when: 'stepStart', message: boilStart ? `Add ${boilStart}.` : 'Follow the recipe boil additions at step start.',
      }, ...(boilMisc ? [{ when: 'elapsed' as const, elapsedMinutes: 45, message: `Add ${boilMisc}.` }] : [])],
    },
    {
      name: 'Whirlpool',
      type: 'heat', targetC: 80, endCondition: 'timer', timerStart: 'onStepStart', durationMinutes: whirlpoolMinutes,
      alerts: [holdWarning(), { when: 'stepStart', message: whirlpoolNames ? `Add ${whirlpoolNames} and start the whirlpool.` : 'Start the whirlpool according to the recipe.' }],
    },
    {
      name: 'Flameout and chill',
      type: 'heat', targetC: 80, endCondition: 'manual', alerts: [holdWarning(), {
        when: 'stepStart', message: 'Manual point: flameout, pull the hop sock, and begin chilling.',
      }],
    },
  ];

  return {
    name: `${schedule.recipeName} — RAPT BrewZilla`,
    description: 'Paste-ready RAPT BrewZilla profile. Temperatures are °C. Manual steps require the brewer at the kettle; no API upload or device control is performed.',
    steps,
  };
}

export function renderRaptProfile(profile: RaptProfile): string {
  return [
    profile.name,
    profile.description,
    RAPT_SAFETY.energisesDevice,
    RAPT_SAFETY.boilOverWatch,
    RAPT_SAFETY.noHeating,
    '',
    ...profile.steps.map((step, index) => [
      `${index + 1}. ${step.name}`,
      `Type: ${RAPT_TYPE_LABELS[step.type]}`,
      `Target: ${fmt(step.targetC)} °C`,
      `End: ${RAPT_END_LABELS[step.endCondition]}`,
      ...(step.durationMinutes === undefined ? [] : [`Duration: ${step.durationMinutes} minutes`, `Timer starts: ${step.timerStart}`]),
      ...step.alerts.map((alert) => `Alert: ${raptAlertTriggerLabel(alert)} — ${alert.message}`),
    ].join(' | ')),
  ].join('\n');
}
