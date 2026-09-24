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
  mashTempC: number;
  grainTempC?: number;
  strikeWaterL?: number; // override; strike temp is always recalculated from it
  hasCrystalOrRoast?: boolean;
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

// ~1.5 mL of 88% lactic per 11 L, scaled from this brewer's batches.
export function spargeAcidMl(spargeWaterL: number): number {
  return round(spargeWaterL * 0.135, 1);
}

export function abv(og: number, fg: number): number {
  return (og - fg) * 131.25;
}

// Gravity after boiling preBoilVolumeL down to postBoilVolumeL.
export function expectedOG(
  preBoilGravity: number,
  preBoilVolumeL: number,
  postBoilVolumeL: number
): number {
  return 1 + ((preBoilGravity - 1) * preBoilVolumeL) / postBoilVolumeL;
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
  const preBoilVolumeL = input.batchSizeL + boilOffL + hopLossL + equipment.trubLossL;
  const totalWaterL = preBoilVolumeL + grainAbsorptionL;
  const strikeWaterL = input.strikeWaterL ?? input.grainKg * DEFAULT_MASH_THICKNESS_L_PER_KG;
  const spargeWaterL = totalWaterL - strikeWaterL;
  const preBoilFillRatio = preBoilVolumeL / equipment.kettleVolumeL;

  return {
    grainAbsorptionL,
    boilOffL,
    hopLossL,
    preBoilVolumeL,
    postBoilVolumeL: preBoilVolumeL - boilOffL,
    totalWaterL,
    strikeWaterL,
    spargeWaterL,
    strikeTempC: strikeTemperatureC(strikeWaterL, input.grainKg, input.mashTempC, input.grainTempC),
    strikeAcidMl: strikeAcidMl(input.hasCrystalOrRoast ?? false),
    spargeAcidMl: spargeAcidMl(spargeWaterL),
    preBoilFillRatio,
    boilOverRisk: preBoilFillRatio > BOIL_OVER_FILL_RATIO,
  };
}
