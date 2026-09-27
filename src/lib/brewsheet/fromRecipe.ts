// Maps a Brewfather recipe onto calculation inputs. Pure; no I/O.
import type {
  BrewfatherFermentable,
  BrewfatherHop,
  BrewfatherMashStep,
  BrewfatherRecipe,
} from '@/types';
import {
  DEFAULT_EQUIPMENT,
  DEFAULT_GRAIN_TEMP_C,
  hasCrystalOrRoast,
  type BrewSheetInput,
} from './calculations';

export interface BrewSheetOverrides {
  batchSizeL?: number;
  mashTempC?: number;
  grainTempC?: number;
  strikeWaterL?: number;
  efficiencyPct?: number;
}

export interface MashPhTarget {
  low: number;
  high: number;
  label: string;
}

export interface BrewSheetPlan {
  brewDate?: string;
  fgUnknown?: boolean;
  targetOg?: string;
  targetAbv?: string;
  packagedVolume?: string;
  strikeWaterL?: number;
  spargePrepareL?: number;
  spargeMarkL?: number;
  preBoilGravity?: string;
  spargeAcidMl?: number;
  packaging?: string;
}

export type EfficiencySource = 'override' | 'brewfather' | 'default';

// Steps at or above this are mash-out, not a conversion rest.
const MASH_OUT_MIN_C = 75;

const stepTemp = (s: BrewfatherMashStep) => s.stepTemp ?? s.temp;

// The conversion rest: a step named or typed saccharification, else the
// hottest step below mash-out, else the first step.
export function saccharificationStep(
  steps: BrewfatherMashStep[]
): BrewfatherMashStep | undefined {
  const named = steps.find((s) => /sacch/i.test(`${s.type ?? ''} ${s.name ?? ''}`));
  if (named) return named;
  const rests = steps.filter((s) => (stepTemp(s) ?? Infinity) < MASH_OUT_MIN_C);
  if (rests.length > 0) {
    return rests.reduce((best, s) => ((stepTemp(s) ?? 0) > (stepTemp(best) ?? 0) ? s : best));
  }
  return steps[0];
}

export function brewfatherEfficiency(recipe: BrewfatherRecipe): number | undefined {
  return recipe.equipment?.efficiency ?? recipe.efficiency;
}

export function efficiencyFor(
  recipe: BrewfatherRecipe,
  overrides: BrewSheetOverrides = {}
): { efficiencyPct: number; source: EfficiencySource } {
  if (overrides.efficiencyPct !== undefined) {
    return { efficiencyPct: overrides.efficiencyPct, source: 'override' };
  }
  const fromBrewfather = brewfatherEfficiency(recipe);
  if (fromBrewfather !== undefined) return { efficiencyPct: fromBrewfather, source: 'brewfather' };
  return { efficiencyPct: DEFAULT_EQUIPMENT.efficiencyPct, source: 'default' };
}

const NOT_MASHED = /sugar|extract|juice|honey/i;
const WHIRLPOOL_USES = /aroma|whirlpool|hopstand/i;

// Brewfather sometimes stores flags as the strings "TRUE"/"FALSE" (seen on
// imported recipes); a plain truthiness check reads "FALSE" as true.
export function isFlagSet(value: unknown): boolean {
  return value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
}

export function isAddedAfterBoil(f: BrewfatherFermentable): boolean {
  return isFlagSet(f.addAfterBoil);
}

export function isMashed(f: BrewfatherFermentable): boolean {
  return !isAddedAfterBoil(f) && !NOT_MASHED.test(f.type ?? '');
}

export function mashedFermentables(recipe: BrewfatherRecipe): BrewfatherFermentable[] {
  return (recipe.fermentables ?? []).filter(isMashed);
}

/** Reads a per-recipe mash pH range from the recipe notes. */
export function mashPhTargetFromRecipe(recipe: Pick<BrewfatherRecipe, 'notes'>): MashPhTarget | undefined {
  const notes = recipe.notes ?? '';
  const targetPattern = /(?:mash\s*pH\s*target|target\s*(?:mash\s*)?pH|pH\s*target)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)/i;
  const match = notes
    .split(/\r?\n/)
    .map((line) => line.match(targetPattern))
    .find((candidate): candidate is RegExpMatchArray => candidate !== null);
  if (!match) return undefined;

  const low = Number(match[1]);
  const high = Number(match[2]);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low > high || low < 4 || high > 7) {
    return undefined;
  }
  return { low, high, label: `${low.toFixed(1)}–${high.toFixed(1)}` };
}

export function hopsByUse(recipe: BrewfatherRecipe) {
  const hops = recipe.hops ?? [];
  const use = (h: BrewfatherHop) => h.use ?? '';
  return {
    mash: hops.filter((h) => /mash/i.test(use(h))),
    firstWort: hops.filter((h) => /first wort/i.test(use(h))),
    boil: hops
      .filter((h) => /^boil$/i.test(use(h)))
      .sort((a, b) => (b.time ?? 0) - (a.time ?? 0)),
    whirlpool: hops.filter((h) => WHIRLPOOL_USES.test(use(h))),
    dryHop: hops
      .filter((h) => /dry hop/i.test(use(h)))
      .sort((a, b) => (a.day ?? 0) - (b.day ?? 0)),
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function noteLine(notes: string | undefined, label: string): string | undefined {
  return notes?.split(/\r?\n/).find((line) => new RegExp(`^\\s*${label}\\s*:`, 'i').test(line));
}

function noteNumber(notes: string | undefined, label: string): number | undefined {
  const line = noteLine(notes, label);
  const match = line?.match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : undefined;
}

export function brewSheetPlanFromRecipe(recipe: Pick<BrewfatherRecipe, 'notes'>): BrewSheetPlan {
  return {
    brewDate: noteLine(recipe.notes, 'Brew date')?.split(':').slice(1).join(':').trim(),
    fgUnknown: /^unknown/i.test(noteLine(recipe.notes, 'FG')?.split(':').slice(1).join(':').trim() ?? ''),
    targetOg: noteLine(recipe.notes, 'Target OG')?.split(':').slice(1).join(':').trim(),
    targetAbv: noteLine(recipe.notes, 'Target ABV')?.split(':').slice(1).join(':').trim(),
    packagedVolume: noteLine(recipe.notes, 'Expected packaged volume')?.split(':').slice(1).join(':').trim(),
    strikeWaterL: noteNumber(recipe.notes, 'Strike water'),
    spargePrepareL: noteNumber(recipe.notes, 'Sparge prepare'),
    spargeMarkL: noteNumber(recipe.notes, 'Sparge mark'),
    preBoilGravity: noteLine(recipe.notes, 'Pre-boil gravity')?.split(':').slice(1).join(':').trim(),
    spargeAcidMl: noteNumber(recipe.notes, 'Sparge acid'),
    packaging: recipe.notes?.match(/Packaging:\s*([^\n]+)/i)?.[1]?.trim(),
  };
}

export function toBrewSheetInput(
  recipe: BrewfatherRecipe,
  overrides: BrewSheetOverrides = {}
): BrewSheetInput {
  const grist = mashedFermentables(recipe);
  const steps = recipe.mash?.steps ?? [];
  const sacchStep = saccharificationStep(steps);
  const mashTempC = overrides.mashTempC ?? (sacchStep && stepTemp(sacchStep)) ?? 66;
  const preBoilVolumeL = noteNumber(recipe.notes, 'Pre-boil volume');
  const totalWaterL = noteNumber(recipe.notes, 'Total water');

  // On a step mash (e.g. a 52 °C protein rest first) the strike water must hit
  // the first rest, not the conversion rest, or the earlier rest is skipped.
  const firstTemp = steps[0] && stepTemp(steps[0]);
  const mashInTempC =
    steps.length > 1 && steps[0] !== sacchStep && firstTemp !== undefined && firstTemp < mashTempC
      ? firstTemp
      : undefined;

  return {
    batchSizeL: overrides.batchSizeL ?? recipe.batchSize ?? 0,
    grainKg: sum(grist.map((f) => f.amount ?? 0)),
    boilMinutes: recipe.boilTime ?? 60,
    whirlpoolHopG: sum(hopsByUse(recipe).whirlpool.map((h) => h.amount ?? 0)),
    mashTempC,
    mashInTempC,
    grainTempC: overrides.grainTempC ?? DEFAULT_GRAIN_TEMP_C,
    strikeWaterL: overrides.strikeWaterL ?? brewSheetPlanFromRecipe(recipe).strikeWaterL,
    hasCrystalOrRoast: hasCrystalOrRoast(grist),
    efficiencyPct: efficiencyFor(recipe, overrides).efficiencyPct,
    ...(preBoilVolumeL !== undefined ? { preBoilVolumeL } : {}),
    ...(totalWaterL !== undefined ? { totalWaterL } : {}),
    fermentables: (recipe.fermentables ?? [])
      .filter((f) => !isAddedAfterBoil(f))
      .map((f) => ({ amountKg: f.amount ?? 0, potential: f.potential, mashed: isMashed(f) })),
  };
}

// Parses a numeric query param inside [min, max]; anything else is ignored.
export function parseOverride(
  value: string | string[] | undefined,
  min: number,
  max: number
): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}
