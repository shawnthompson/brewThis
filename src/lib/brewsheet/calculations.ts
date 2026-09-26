// Pure brew-day calculations. No I/O. Every output here decides a real
// ingredient quantity, so each formula is covered by calculations.test.ts.

export interface EquipmentProfile {
  kettleVolumeL: number;
  boilOffRateLPerHour: number; // ESTIMATED, never measured
  grainAbsorptionLPerKg: number;
  hopAbsorptionMlPerG: number;
  trubLossL: number;
  efficiencyPct: number; // ASSUMED, never measured
}

// BrewZilla Gen 4.1 35 L
export const DEFAULT_EQUIPMENT: EquipmentProfile = {
  kettleVolumeL: 35,
  boilOffRateLPerHour: 3.0,
  grainAbsorptionLPerKg: 1.0,
  hopAbsorptionMlPerG: 4.5,
  trubLossL: 1.0,
  efficiencyPct: 76,
};

// Matches the BrewZilla malt pipe and this brewer's proven batches.
// Not the 2.78 L/kg (1.33 qt/lb) three-vessel convention.
export const DEFAULT_MASH_THICKNESS_L_PER_KG = 3.5;
export const DEFAULT_GRAIN_TEMP_C = 20;

// Pre-boil fill ratio above which the boil-over warning is shown.
export const BOIL_OVER_FILL_RATIO = 0.65;

const CRYSTAL_OR_ROAST = /crystal|caramel|roast|chocolate|black|carafa|special ?b/i;

export interface GristItem {
  name?: string;
  type?: string;
  grainCategory?: string;
}

export interface BrewSheetInput {
  batchSizeL: number;
  grainKg: number;
  boilMinutes: number;
  whirlpoolHopG: number;
  mashTempC: number; // saccharification rest
  mashInTempC?: number; // first step of a step mash; strike water targets this when set
  grainTempC?: number;
  strikeWaterL?: number; // override; strike temp is always recalculated from it
  hasCrystalOrRoast?: boolean;
  efficiencyPct?: number; // brewhouse (into fermenter); defaults to equipment.efficiencyPct
  preBoilVolumeL?: number; // recipe-specific measured-hot plan; otherwise derive from the baseline formula
  totalWaterL?: number; // recipe-specific water chain; otherwise derive from pre-boil volume + absorption
  fermentables?: ExtractItem[]; // enables gravity prediction
}

export interface ExtractItem {
  amountKg: number;
  potential?: number; // SG of 1 lb in 1 US gal, as Brewfather supplies it
  mashed: boolean; // false for sugars/extracts added to the boil
}

export interface GravityPrediction {
  efficiencyPct: number;
  predictedOG: number; // est.
  predictedPreBoilGravity: number; // est.
  potentialEstimated: boolean; // a fermentable had no potential; FALLBACK_POTENTIAL used
}

export interface BrewSheetCalc {
  grainAbsorptionL: number;
  boilOffL: number; // est.
  hopLossL: number;
  preBoilVolumeL: number; // est.
  postBoilVolumeL: number; // est.
  totalWaterL: number; // est.
  strikeWaterL: number;
  spargeWaterL: number; // est.
  strikeTempC: number;
  strikeAcidMl: number;
  spargeAcidMl: number; // est.
  preBoilFillRatio: number; // est.
  boilOverRisk: boolean;
  gravity?: GravityPrediction;
}

// Used only when a fermentable has no `potential` in the recipe payload.
export const FALLBACK_POTENTIAL = 1.037;

// Brewfather's `potential` is in points per lb per US gallon. Convert to
// points per kg per L from the unit definitions, not a rounded constant.
const LB_PER_KG = 1 / 0.45359237;
const L_PER_US_GAL = 3.785411784;
export const PPG_TO_POINTS_L_PER_KG = LB_PER_KG * L_PER_US_GAL;

function extractPointsL(item: ExtractItem): number {
  const potential = item.potential ?? FALLBACK_POTENTIAL;
  return (potential - 1) * 1000 * PPG_TO_POINTS_L_PER_KG * item.amountKg;
}

// Brewhouse efficiency is measured into the fermenter, so mashed extract is
// spread over batchSizeL; boil additions dissolve fully in the post-boil volume.
// Pre-boil gravity is the mashed extract before the boil concentrates it.
export function predictGravity(
  fermentables: ExtractItem[],
  efficiencyPct: number,
  volumes: { batchSizeL: number; preBoilVolumeL: number; postBoilVolumeL: number }
): GravityPrediction {
  const mashedPoints = fermentables.filter((f) => f.mashed).reduce((t, f) => t + extractPointsL(f), 0);
  const boilPoints = fermentables.filter((f) => !f.mashed).reduce((t, f) => t + extractPointsL(f), 0);

  const mashedOGPoints = (mashedPoints * (efficiencyPct / 100)) / volumes.batchSizeL;
  const ogPoints = mashedOGPoints + boilPoints / volumes.postBoilVolumeL;
  const preBoilPoints = (mashedOGPoints * volumes.postBoilVolumeL) / volumes.preBoilVolumeL;

  return {
    efficiencyPct,
    predictedOG: 1 + ogPoints / 1000,
    predictedPreBoilGravity: 1 + preBoilPoints / 1000,
    potentialEstimated: fermentables.some((f) => f.potential === undefined),
  };
}

export function round(value: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function hasCrystalOrRoast(grist: GristItem[]): boolean {
  return grist.some((g) =>
    [g.name, g.type, g.grainCategory].some((s) => !!s && CRYSTAL_OR_ROAST.test(s))
  );
}

export function strikeTemperatureC(
  strikeWaterL: number,
  grainKg: number,
  mashTempC: number,
  grainTempC = DEFAULT_GRAIN_TEMP_C
): number {
  const r = strikeWaterL / grainKg;
  return (0.41 / r) * (mashTempC - grainTempC) + mashTempC;
}

export function strikeAcidMl(crystalOrRoast: boolean): number {
  return crystalOrRoast ? 3.0 : 4.0;
}

// ~1.5 mL of 88% lactic per 11 L. Basis and limits: ACID_CAVEAT in procedure.ts.
export function spargeAcidMl(spargeWaterL: number): number {
  return round(spargeWaterL * 0.135, 1);
}

export function abv(og: number, fg: number): number {
  return (og - fg) * 131.25;
}

// Gravity after boiling preBoilVolumeL down to postBoilVolumeL.
// Gravity points are the digits after 1.0: 1.056 → 56.
export function gravityPoints(sg: number): number {
  return (sg - 1) * 1000;
}

// Only the points scale with volume; multiplying raw SG gives nonsense.
export function expectedOGPoints(
  preBoilPoints: number,
  preBoilVolumeL: number,
  postBoilVolumeL: number
): number {
  return (preBoilPoints * preBoilVolumeL) / postBoilVolumeL;
}

export function expectedOG(
  preBoilGravity: number,
  preBoilVolumeL: number,
  postBoilVolumeL: number
): number {
  return 1 + expectedOGPoints(gravityPoints(preBoilGravity), preBoilVolumeL, postBoilVolumeL) / 1000;
}

// Pre-boil gravity that concentrates to targetOG over the boil.
export function targetPreBoilGravity(
  targetOG: number,
  preBoilVolumeL: number,
  postBoilVolumeL: number
): number {
  return 1 + ((targetOG - 1) * postBoilVolumeL) / preBoilVolumeL;
}

export function calculateBrewSheet(
  input: BrewSheetInput,
  equipment: EquipmentProfile = DEFAULT_EQUIPMENT
): BrewSheetCalc {
  if (!(input.grainKg > 0)) throw new Error('grainKg must be greater than 0');
  if (!(input.batchSizeL > 0)) throw new Error('batchSizeL must be greater than 0');

  const grainAbsorptionL = input.grainKg * equipment.grainAbsorptionLPerKg;
  const boilOffL = equipment.boilOffRateLPerHour * (input.boilMinutes / 60);
  const hopLossL = (input.whirlpoolHopG * equipment.hopAbsorptionMlPerG) / 1000;
  const preBoilVolumeL = input.preBoilVolumeL ?? input.batchSizeL + boilOffL + hopLossL + equipment.trubLossL;
  const totalWaterL = input.totalWaterL ?? preBoilVolumeL + grainAbsorptionL;
  const strikeWaterL = input.strikeWaterL ?? input.grainKg * DEFAULT_MASH_THICKNESS_L_PER_KG;
  const spargeWaterL = totalWaterL - strikeWaterL;
  const preBoilFillRatio = preBoilVolumeL / equipment.kettleVolumeL;
  const postBoilVolumeL = preBoilVolumeL - boilOffL;

  return {
    grainAbsorptionL,
    boilOffL,
    hopLossL,
    preBoilVolumeL,
    postBoilVolumeL,
    totalWaterL,
    strikeWaterL,
    spargeWaterL,
    strikeTempC: strikeTemperatureC(
      strikeWaterL,
      input.grainKg,
      input.mashInTempC ?? input.mashTempC,
      input.grainTempC
    ),
    strikeAcidMl: strikeAcidMl(input.hasCrystalOrRoast ?? false),
    spargeAcidMl: spargeAcidMl(spargeWaterL),
    preBoilFillRatio,
    boilOverRisk: preBoilFillRatio > BOIL_OVER_FILL_RATIO,
    gravity: input.fermentables
      ? predictGravity(input.fermentables, input.efficiencyPct ?? equipment.efficiencyPct, {
          batchSizeL: input.batchSizeL,
          preBoilVolumeL,
          postBoilVolumeL,
        })
      : undefined,
  };
}
