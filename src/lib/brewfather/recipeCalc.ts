// Recalculates a recipe's derived values after an edit. Pure; no I/O.
//
// Brewfather does not recalculate anything when a recipe is written through
// the API (verified 2026-09-25: OG/FG/ABV/IBU/colour all stay empty or stale),
// so the app computes them and sends them with every save. Formulas were
// calibrated against Brewfather's own values for 21 of Shawn's recipes:
// typical gap OG 0.4 pt, colour 0.2 SRM, FG 2.4 pt. IBU is the weakest:
// Brewfather's hopstand model is temperature-dependent and not reproduced
// here, so expect IBU within roughly ±30% of what Brewfather would show.
import type { BrewfatherFermentable, BrewfatherRecipe } from '@/types';
import { abv, DEFAULT_EQUIPMENT, PPG_TO_POINTS_L_PER_KG } from '@/lib/brewsheet/calculations';
import { isAddedAfterBoil, isMashed } from '@/lib/brewsheet/fromRecipe';

// Brewfather's default aroma-hop (whirlpool/hopstand) utilisation at ~80 °C,
// used when the recipe has no equipment profile of its own.
export const DEFAULT_AROMA_HOP_UTILIZATION = 0.23;

type RecipeLike = Pick<
  BrewfatherRecipe,
  'batchSize' | 'boilTime' | 'efficiency' | 'fermentables' | 'hops' | 'yeasts' | 'equipment'
>;

export interface DerivedValues {
  og: number;
  fg: number;
  abv: number;
  ibu: number;
  color: number; // SRM, as Brewfather stores it
  fermentablePercentages: number[]; // by weight, same order as fermentables
}

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function points(f: BrewfatherFermentable): number {
  if (f.potential === undefined || !(f.amount! > 0)) return 0;
  return (f.potential - 1) * 1000 * PPG_TO_POINTS_L_PER_KG * f.amount!;
}

// Tinseth: utilisation = bigness(gravity) × boil-time factor.
const tinsethTime = (minutes: number) => (1 - Math.exp(-0.04 * minutes)) / 4.15;
const tinsethBigness = (gravity: number) => 1.65 * 0.000125 ** (gravity - 1);

export function calculateDerived(recipe: RecipeLike): DerivedValues {
  const fermentables = recipe.fermentables ?? [];
  const batchSizeL = recipe.batchSize && recipe.batchSize > 0 ? recipe.batchSize : undefined;
  const efficiency = (recipe.efficiency ?? recipe.equipment?.efficiency ?? DEFAULT_EQUIPMENT.efficiencyPct) / 100;
  const inKettle = fermentables.filter((f) => !isAddedAfterBoil(f));

  // OG: brewhouse efficiency is measured into the fermenter, so extract is
  // spread over the batch size; boil sugars dissolve fully.
  const mashedPoints = sum(inKettle.filter(isMashed).map(points));
  const boilPoints = sum(inKettle.filter((f) => !isMashed(f)).map(points));
  const og = batchSizeL ? 1 + (mashedPoints * efficiency + boilPoints) / batchSizeL / 1000 : 1;

  // FG from the most attenuative yeast; no yeast means no fermentation.
  const attenuation = Math.max(0, ...(recipe.yeasts ?? []).map((y) => y.attenuation ?? 0));
  const fg = 1 + (og - 1) * (1 - attenuation / 100);

  // IBU: Tinseth at batch size. Aroma/whirlpool additions isomerise at the
  // aroma utilisation; boil hops also keep isomerising through the hopstand.
  const hops = recipe.hops ?? [];
  const aromaUse = /aroma|whirlpool|hopstand/i;
  const aromaUtil = recipe.equipment?.aromaHopUtilization ?? DEFAULT_AROMA_HOP_UTILIZATION;
  const hopstandMinutes = Math.max(0, ...hops.filter((h) => aromaUse.test(h.use ?? '')).map((h) => h.time ?? 0));
  const ibu = batchSizeL
    ? sum(
        hops.map((h) => {
          const mgPerL = (((h.alpha ?? 0) / 100) * (h.amount ?? 0) * 1000) / batchSizeL;
          const use = h.use ?? '';
          let utilization = 0;
          if (/^boil$/i.test(use)) {
            utilization = tinsethTime(h.time ?? 0) + aromaUtil * tinsethTime(hopstandMinutes);
          } else if (/first wort/i.test(use)) {
            utilization = 1.1 * (tinsethTime(recipe.boilTime ?? 60) + aromaUtil * tinsethTime(hopstandMinutes));
          } else if (aromaUse.test(use)) {
            utilization = aromaUtil * tinsethTime(h.time ?? 0);
          }
          return tinsethBigness(og) * utilization * mgPerL;
        })
      )
    : 0;

  // Colour: Morey, at the post-boil volume (closest match to Brewfather).
  const whirlpoolG = sum(hops.filter((h) => aromaUse.test(h.use ?? '')).map((h) => h.amount ?? 0));
  const postBoilL =
    recipe.equipment?.postBoilKettleVol ??
    (batchSizeL ? batchSizeL + DEFAULT_EQUIPMENT.trubLossL + (whirlpoolG * DEFAULT_EQUIPMENT.hopAbsorptionMlPerG) / 1000 : undefined);
  const mcu = postBoilL
    ? sum(fermentables.map((f) => (f.color ?? 0) * (f.amount ?? 0) * PPG_TO_POINTS_L_PER_KG)) / postBoilL
    : 0;
  const color = mcu > 0 ? 1.4922 * mcu ** 0.6859 : 0;

  const totalKg = sum(fermentables.map((f) => f.amount ?? 0));

  // Brewfather rounds FG to 3 decimals and takes ABV from the rounded values.
  const ogRounded = round(og, 4);
  const fgRounded = round(fg, 3);

  return {
    og: ogRounded,
    fg: fgRounded,
    abv: round(Math.max(0, abv(ogRounded, fgRounded)), 2),
    ibu: round(ibu, 1),
    color: round(color, 1),
    fermentablePercentages: fermentables.map((f) => (totalKg > 0 ? round(((f.amount ?? 0) / totalKg) * 100, 1) : 0)),
  };
}

/**
 * Adds the derived values to a write payload. `current` is the recipe as
 * Brewfather has it (for PATCH); fields in `changes` take precedence.
 */
export function withDerivedValues<T extends Partial<BrewfatherRecipe>>(
  changes: T,
  current?: BrewfatherRecipe
): T & Pick<BrewfatherRecipe, 'og' | 'fg' | 'abv' | 'ibu' | 'color' | 'fermentables'> {
  const merged = { ...(current ?? {}), ...changes } as RecipeLike;
  const d = calculateDerived(merged);
  const fermentables = merged.fermentables?.map((f, i) => ({ ...f, percentage: d.fermentablePercentages[i] }));
  return { ...changes, fermentables, og: d.og, fg: d.fg, abv: d.abv, ibu: d.ibu, color: d.color };
}
