import type { BrewfatherHop, BrewfatherMashStep } from '@/types';
import { calculateBrewSheet, round, type BrewSheetInput } from '@/lib/brewsheet/calculations';
import { RAPT_REFERENCE_FLAGS, RAPT_SAFETY, WHIRLPOOL_MINUTES, WHIRLPOOL_TEMP_C } from '@/lib/brewsheet/procedure';

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
  whirlpoolHops?: Pick<BrewfatherHop, 'name' | 'amount' | 'time' | 'temp' | 'use'>[];
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

function liveSetpointWarning(): RaptAlert {
  return { when: 'stepStart', message: RAPT_SAFETY.liveSetpointWarning };
}

function stepWarnings(step: Pick<RaptStep, 'endCondition' | 'targetC' | 'timerStart'>): RaptAlert[] {
  const isManualHold = step.endCondition === 'manual';
  const isLiveHold = step.targetC >= 80;
  return isManualHold || isLiveHold ? [liveSetpointWarning()] : [];
}

function timedStep(
  name: string,
  targetC: number,
  durationMinutes: number,
  alerts: RaptAlert[] = [],
  timerStart: RaptTimerStart = 'onTargetReached'
): RaptStep {
  const step: RaptStep = {
    name,
    type: 'heat',
    targetC,
    endCondition: 'timer',
    timerStart,
    durationMinutes,
    alerts: [],
  };
  step.alerts = [...stepWarnings(step), ...alerts];
  return step;
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
    alerts: stepWarnings({ endCondition: 'manual', targetC: strikeTempC }),
  }];

  steps.push({
    name: 'Add grains',
    type: 'heat',
    targetC: input.mashTempC,
    endCondition: 'manual',
    alerts: [],
  });
  steps[1].alerts = [...stepWarnings(steps[1]), { when: 'stepStart', message: 'Manual point: add and mix the grain, then press the device button.' }];

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

function miscReferenceFlag(item: RaptMiscAddition, batchSizeL: number): string | undefined {
  if (item.amount === undefined) return undefined;
  const unit = normalizeRaptMiscUnit(item.name, item.unit)?.toLowerCase() ?? '';
  if (/servomyces/i.test(item.name)) {
    const capsuleDoseIsInRange = /capsule/.test(unit) && item.amount === 1 && batchSizeL >= 4 && batchSizeL <= 26;
    const low = batchSizeL * 0.01;
    const high = batchSizeL * 0.02;
    const gramDoseIsInRange = /\bg\b|gram/.test(unit) && item.amount >= low && item.amount <= high;
    if (capsuleDoseIsInRange || gramDoseIsInRange) return undefined;
    if (!/\bg\b|gram/.test(unit)) return `FLAG: ${RAPT_REFERENCE_FLAGS.servomycesCheck}`;
    const reference = item.amount < low ? low : high;
    return `FLAG: ${renderReference(RAPT_REFERENCE_FLAGS.servomyces, {
      amount: formatGrams(item.amount),
      ratio: formatRatio(item.amount < low ? reference / item.amount : item.amount / reference),
      direction: item.amount < low ? 'below' : 'above',
      batchSizeL,
      low: formatGrams(low),
      high: formatGrams(high),
    })}`;
  }
  return undefined;
}

export function normalizeRaptMiscUnit(name: string, unit: string | undefined): string | undefined {
  return /whirlfloc/i.test(name) && unit?.toLowerCase() === 'items' ? 'tablet' : unit;
}

function formatGrams(value: number): string {
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatRatio(value: number): string {
  return value < 2 ? value.toFixed(1) : String(Math.round(value));
}

function renderReference(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key]));
}

function miscLabel(item: RaptMiscAddition, batchSizeL: number): string {
  const label = `${amount(item.amount, normalizeRaptMiscUnit(item.name, item.unit))}${item.name}`.trim();
  const flag = miscReferenceFlag(item, batchSizeL);
  return flag ? `${label} — ${flag}` : label;
}

function boilHopLabel(items: RaptScheduleInput['boilHops'], minutes: number): string {
  return (items ?? [])
    .filter((item) => item.time === minutes)
    .map((item) => `${amount(item.amount)}${item.name}`.trim())
    .join(', ');
}

function miscLabelAt(items: RaptMiscAddition[] | undefined, minutes: number, batchSizeL: number): string {
  return (items ?? []).filter((item) => item.use === undefined || /boil/i.test(item.use))
    .filter((item) => item.time === minutes)
    .map((item) => miscLabel(item, batchSizeL))
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
  const boilMisc = miscLabelAt(schedule.miscAdditions, 15, input.batchSizeL);
  const whirlpoolNames = names(schedule.whirlpoolHops ?? []);
  const whirlpoolTempC = schedule.whirlpoolHops?.find((hop) => hop.temp !== undefined)?.temp ?? WHIRLPOOL_TEMP_C;
  const whirlpoolMinutes = schedule.whirlpoolMinutes
    ?? Math.max(...(schedule.whirlpoolHops ?? []).map((hop) => hop.time ?? 0), WHIRLPOOL_MINUTES);
  const gravityTarget = schedule.preBoilGravityTarget
    ?? 'Target not supplied by recipe — add a target before brew day.';

  const steps: RaptStep[] = [
    ...mashSteps(input, schedule, strikeTempC),
    {
      name: 'Sparging',
      type: 'heat', targetC: 80, endCondition: 'manual', alerts: [...stepWarnings({ endCondition: 'manual', targetC: 80 }), {
        when: 'stepStart', message: 'Manual point: sparge with the kettle holding the first runnings; do not run this step on a low kettle.',
      }],
    },
    {
      name: 'Check gravity (pre-boil)',
      type: 'heat', targetC: 80, endCondition: 'manual', alerts: [...stepWarnings({ endCondition: 'manual', targetC: 80 }), {
        when: 'stepStart', message: `Manual point: check approximately ${gravityTarget} with a refractometer and record the reading.`,
      }],
    },
    {
      // This split is driven by the unreachable 105 °C setpoint and timer
      // semantics, not by the placement of an alert.
      name: 'Boil heat',
      type: 'heat', targetC: 105, endCondition: 'manual', alerts: [...stepWarnings({ endCondition: 'manual', targetC: 105 }), {
        when: 'temperatureReached', temperatureC: 98, message: `${RAPT_SAFETY.boilImminent} ${RAPT_SAFETY.boilOverWatch}`,
      }],
    },
    {
      name: 'Boil',
      type: 'heat', targetC: 105, endCondition: 'timer', timerStart: 'onStepStart', durationMinutes: input.boilMinutes,
      alerts: [...stepWarnings({ endCondition: 'timer', targetC: 105, timerStart: 'onStepStart' }), {
        when: 'stepStart', message: boilStart ? `Add ${boilStart}.` : 'Follow the recipe boil additions at step start.',
      }, ...(boilMisc ? [{ when: 'elapsed' as const, elapsedMinutes: 45, message: `Add ${boilMisc}.` }] : [])],
    },
    {
      name: 'Whirlpool',
      // The step-start alert adds the chiller; the hop addition waits for the recipe target.
      type: 'heat', targetC: whirlpoolTempC, endCondition: 'timer', timerStart: 'onTargetReached', durationMinutes: whirlpoolMinutes,
      alerts: [...stepWarnings({ endCondition: 'timer', targetC: whirlpoolTempC, timerStart: 'onTargetReached' }),
        { when: 'stepStart', message: 'Add the chiller to the kettle.' },
        ...(whirlpoolNames ? [{ when: 'temperatureReached' as const, temperatureC: whirlpoolTempC, message: `Add ${whirlpoolNames}.` }] : [])],
    },
    {
      name: 'Cooling',
      type: 'heat', targetC: 20, endCondition: 'manual', alerts: [...stepWarnings({ endCondition: 'manual', targetC: 20 }),
        { when: 'stepStart', message: 'Pull hops out.' },
        { when: 'temperatureReached', temperatureC: 30, message: 'Take the OG sample.' }],
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
    RAPT_SAFETY.liveSetpointWarning,
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
