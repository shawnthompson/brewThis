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

export function isMashed(f: BrewfatherFermentable): boolean {
  return !f.addAfterBoil && !NOT_MASHED.test(f.type ?? '');
}

export function mashedFermentables(recipe: BrewfatherRecipe): BrewfatherFermentable[] {
  return (recipe.fermentables ?? []).filter(isMashed);
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

export function toBrewSheetInput(
  recipe: BrewfatherRecipe,
  overrides: BrewSheetOverrides = {}
): BrewSheetInput {
  const grist = mashedFermentables(recipe);
  const steps = recipe.mash?.steps ?? [];
  const sacchStep = saccharificationStep(steps);
  const mashTempC = overrides.mashTempC ?? (sacchStep && stepTemp(sacchStep)) ?? 66;

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
    strikeWaterL: overrides.strikeWaterL,
    hasCrystalOrRoast: hasCrystalOrRoast(grist),
    efficiencyPct: efficiencyFor(recipe, overrides).efficiencyPct,
    fermentables: (recipe.fermentables ?? [])
      .filter((f) => !f.addAfterBoil)
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
