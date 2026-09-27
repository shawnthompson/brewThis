import type { BrewfatherHop, BrewfatherMashStep } from '@/types';
import type { BrewSheetInput } from '@/lib/brewsheet/calculations';

export type RaptStepType = 'heat' | 'ramp';
export type RaptEndCondition = 'timer' | 'targetReached' | 'manual';

export interface RaptStep {
  name: string;
  type: RaptStepType;
  targetC: number;
  endCondition: RaptEndCondition;
  durationMinutes?: number;
  alert?: string;
}

export interface RaptProfile {
  name: string;
  description: string;
  steps: RaptStep[];
  mergedSteps: RaptStep[];
}

export interface RaptScheduleInput {
  recipeName: string;
  mashSteps?: BrewfatherMashStep[];
  boilHops?: Pick<BrewfatherHop, 'name' | 'amount' | 'time' | 'use'>[];
  whirlpoolHops?: Pick<BrewfatherHop, 'name' | 'amount' | 'time' | 'use'>[];
  miscAdditions?: { name: string; time?: number; use?: string }[];
  ambientC?: number;
}

const fmt = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
const names = (items: { name?: string }[]) => [...new Set(items.map((x) => x.name?.trim()).filter(Boolean))].join(', ');

function additionsAt(items: { name?: string; time?: number }[], minutes: number): string {
  const selected = items.filter((item) => item.time === minutes);
  return names(selected);
}

function stepMash(input: BrewSheetInput, schedule: RaptScheduleInput): RaptStep[] {
  const mashSteps = schedule.mashSteps ?? [];
  const mashIn = input.mashInTempC;
  const mashTemp = input.mashTempC;
  const mashMinutes = mashSteps.find((s) => (s.stepTemp ?? s.temp) === mashTemp)?.stepTime
    ?? mashSteps.find((s) => (s.stepTemp ?? s.temp) === mashTemp)?.time
    ?? 60;
  const mashOut = mashSteps.find((s) => (s.stepTemp ?? s.temp ?? 0) >= 75);
  const mashOutTemp = mashOut ? (mashOut.stepTemp ?? mashOut.temp ?? 75) : 75;
  const mashOutMinutes = mashOut?.stepTime ?? mashOut?.time ?? 10;
  const steps: RaptStep[] = [];

  if (mashIn !== undefined) {
    steps.push({
      name: `Heat to mash-in — ${fmt(mashIn)} °C, then dough in`,
      type: 'heat', targetC: mashIn, endCondition: 'manual',
      alert: 'Manual point: confirm dough-in and press the device button after the grain is mixed in.',
    });
  } else {
    steps.push({
      name: `Heat to strike — ${fmt(input.mashTempC)} °C, then dough in`,
      type: 'heat', targetC: input.mashTempC, endCondition: 'manual',
      alert: 'Manual point: confirm dough-in and press the device button after the grain is mixed in.',
    });
  }

  steps.push({ name: `Mash rest — ${fmt(mashTemp)} °C`, type: 'heat', targetC: mashTemp, endCondition: 'timer', durationMinutes: mashMinutes });
  steps.push({ name: `Mash-out climb — ${fmt(mashOutTemp)} °C`, type: 'ramp', targetC: mashOutTemp, endCondition: 'targetReached' });
  steps.push({ name: `Mash-out hold — ${fmt(mashOutTemp)} °C`, type: 'heat', targetC: mashOutTemp, endCondition: 'timer', durationMinutes: mashOutMinutes });
  return steps;
}

export function buildRaptProfile(input: BrewSheetInput, schedule: RaptScheduleInput): RaptProfile {
  const ambientC = schedule.ambientC ?? 20;
  const boilHops = schedule.boilHops ?? [];
  const misc = schedule.miscAdditions ?? [];
  const whirlpool = schedule.whirlpoolHops ?? [];
  const boil60 = additionsAt(boilHops, input.boilMinutes);
  const boil15 = additionsAt([...boilHops, ...misc], 15);
  const fullSteps: RaptStep[] = [
    ...stepMash(input, schedule),
    {
      name: 'Lauter and sparge — no heating', type: 'heat', targetC: ambientC, endCondition: 'manual',
      alert: 'No-heating step: the target is ambient deliberately so the element does not fire. Manual point: lauter and sparge.',
    },
    {
      name: 'Heat to boil — stay at the kettle', type: 'heat', targetC: 100, endCondition: 'manual',
      alert: `Manual point: watch the kettle. ${boil60 ? `At boil start: add ${boil60}.` : 'Add the recipe boil charge at boil start.'} ${'Stay beside the kettle; full power can cause a boil-over.'}`,
    },
    {
      name: `Boil — ${input.boilMinutes} minutes`, type: 'heat', targetC: 100, endCondition: 'timer', durationMinutes: input.boilMinutes,
      alert: boil15 ? `At 15 minutes remaining: add ${boil15}.` : 'Follow the recipe hop and misc schedule at the recorded times.',
    },
    {
      name: 'Flameout and chill — no heating', type: 'heat', targetC: ambientC, endCondition: 'manual',
      alert: `No-heating step: ${fmt(ambientC)} °C is deliberate; the element must not fire. Manual point: flameout, whirlpool${whirlpool.length ? ` (${names(whirlpool)}),` : ''} pull the hop sock, and chill.`,
    },
  ];

  // The portal's six-stage limit is unverified. The merged handoff combines
  // only adjacent stages: dough-in with the following rest, and the manual
  // heat-to-boil transition with the boil timer. The full profile remains the
  // authoritative version when the portal accepts more stages.
  const mergedSteps = fullSteps.length <= 6 ? fullSteps : [
    {
      ...fullSteps[1],
      name: `${fullSteps[0].name}; then ${fullSteps[1].name}`,
      alert: `${fullSteps[0].alert ?? ''} Start the mash timer after dough-in is confirmed.`.trim(),
    },
    fullSteps[2],
    fullSteps[3],
    fullSteps[4],
    {
      ...fullSteps[6],
      name: `${fullSteps[5].name}; then ${fullSteps[6].name}`,
      alert: `${fullSteps[5].alert ?? ''} ${fullSteps[6].alert ?? ''}`.trim(),
    },
    fullSteps[7],
  ];

  return {
    name: `${schedule.recipeName} — RAPT BrewZilla`,
    description: 'Paste-ready RAPT BrewZilla profile. Temperatures are °C. Manual steps require the brewer at the kettle; no API upload or device control is performed.',
    steps: fullSteps,
    mergedSteps,
  };
}
