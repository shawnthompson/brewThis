// Maps a Brewfather recipe onto calculation inputs. Pure; no I/O.
import type { BrewfatherFermentable, BrewfatherHop, BrewfatherRecipe } from '@/types';
import { DEFAULT_GRAIN_TEMP_C, hasCrystalOrRoast, type BrewSheetInput } from './calculations';

export interface BrewSheetOverrides {
  batchSizeL?: number;
  mashTempC?: number;
  grainTempC?: number;
  strikeWaterL?: number;
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
  const firstMashStep = recipe.mash?.steps?.[0];

  return {
    batchSizeL: overrides.batchSizeL ?? recipe.batchSize ?? 0,
    grainKg: sum(grist.map((f) => f.amount ?? 0)),
    boilMinutes: recipe.boilTime ?? 60,
    whirlpoolHopG: sum(hopsByUse(recipe).whirlpool.map((h) => h.amount ?? 0)),
    mashTempC: overrides.mashTempC ?? firstMashStep?.stepTemp ?? firstMashStep?.temp ?? 66,
    grainTempC: overrides.grainTempC ?? DEFAULT_GRAIN_TEMP_C,
    strikeWaterL: overrides.strikeWaterL,
    hasCrystalOrRoast: hasCrystalOrRoast(grist),
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
