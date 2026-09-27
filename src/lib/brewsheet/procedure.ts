// Static, hand-written procedure content: the judgement layer of the brew sheet.
//
// ⚠️ Safety text is copied verbatim from the spec in AGENTS.md. Never generate,
// paraphrase or template it at runtime. Edit only by hand, against the spec.

export const SAFETY = {
  acidHandling:
    'Acid into water, never water into acid; syringe or graduated dropper only; keep it away from the sanitiser bucket and the control panel.',
  coldTap:
    'Run the cold tap before filling anything.',
  maltPipeLift:
    'Heaviest, most dangerous moment of the day. Roughly 2× the dry grain weight, soaked at 75 °C. Use both handles, lift with your legs, seat it square on its supports before letting go. Keep your face out of the steam — it will scald.',
  boilOver:
    'BOIL-OVER WATCH. The danger window is the first few minutes as the hot break forms. Stay at the kettle. Cut the element the instant it climbs. Keep a spray bottle of water in reach. Boiling wort scalds badly and goes over in seconds.',
  boilOverRatio:
    '25 L / 35 L = 0.71, above the 0.65 threshold.',
  lacticAcid:
    "Corrosive. Eye protection. Always acid into water, never water into acid. Syringe or graduated dropper only — 'about a capful' is not a dose at 88%.",
  probeStorage:
    'Never store the pH probe in distilled water.',
  transfer:
    'Only splash wort that is already chilled (below ~27 °C). Splashing hot wort is hot-side aeration and gives stale cardboard flavours. Never raise the BrewZilla to gain drop height — it holds ~25 kg of hot liquid and is a scald hazard if it shifts. Lower the receiver instead.',
  hotWortSplash:
    'Never splash hot wort.',
  aerationLift:
    'A 32 L bucket holding 19 L weighs ~20 kg. Lift with your legs and get it onto a solid waist-height surface before shaking it.',
  fermenterLight:
    'Keep out of direct light — it is clear plastic and hop-forward beer lightstrikes fast.',
  vesselLimit:
    '25 L exceeds KegLand\'s recommended boil limit for the BrewZilla Gen 4.1 of 24.6 L (6.5 gal). Stop at 24.5 L and accept ~18.6 L into the fermenter.',
  fgInstrument:
    'FG must be taken on a hydrometer or Tilt, never a refractometer. Refractometers read falsely high once alcohol is present, which invents an ABV shortfall that is not real.',
} as const;

export const ACID_CAVEAT =
  "Acid doses are derived from Montreal's published water analysis (99 mg/L alkalinity as CaCO3) and deliberately only partially corrected, to stay under the ~400 mg/L lactic flavour threshold. Mash pH must be measured.";

export const PH = {
  calibrate: 'Calibrate the pH meter the day before with fresh buffer - two points, NIST set, 6.86 first then 4.00.',
  instrumentStatus:
    'Meter calibrated 2026-09-26. Do not recalibrate before brewing. Take readings through the meter display offset.',
  waterExpectedRange: { low: 5.5, high: 5.6, label: '5.5–5.6' },
  expected:
    'Measure on a sample cooled to 20–25 °C, at 15 minutes into the mash. Lactic acid reaches its ~400 mg/L flavour threshold before the mash gets down to 5.3, so the acid only partially corrects it.',
  provisionalThresholds:
    'OPEN DECISION: in-mash correction thresholds are provisional. They were derived against the old global target and must be re-derived against this recipe\'s TARGET before use.',
  cap: 'Hard cap: 2 mL of in-mash corrections total. Past that, record the reading and continue — a mash at 5.6 still makes good beer. Chasing further usually means the meter is wrong, not the mash.',
} as const;

export interface PhBranch {
  id: 'meterCheck' | 'nudge' | 'expected' | 'low';
  // Ranges are mutually exclusive and together cover every reading;
  // procedure.test.ts sweeps 4.8–6.4 to prove it.
  matches: (ph: number) => boolean;
  text: string;
  note?: string;
}

// Listed in evaluation order: the 5.8 branch before the 5.6 branch.
export const PH_BRANCHES: PhBranch[] = [
  {
    id: 'meterCheck',
    matches: (ph) => ph > 5.8,
    text: 'Above 5.8: check the meter against a second reference BEFORE adding acid (a meter 0.3 high reads exactly here); record and continue either way.',
  },
  {
    id: 'nudge',
    matches: (ph) => ph > 5.6 && ph <= 5.8,
    text: 'Above 5.6: may add 1 mL lactic 88%, stir fully through the bed, recirculate, re-measure after 10 min (R6).',
    note: '1 mL of lactic moves this mash ~0.05 pH (~9 mL for a 0.40 pH drop, modelled) - a nudge, not a correction. Dose once, re-measure; if it barely moved, that is the expected result.',
  },
  {
    id: 'expected',
    matches: (ph) => ph >= 5.5 && ph <= 5.6,
    text: '5.5–5.6: expected on this water. Record and continue.',
  },
  {
    id: 'low',
    matches: (ph) => ph < 5.5,
    text: 'Below 5.5: add nothing, record, continue. Never correct upward on brew day.',
  },
];

export function phBranch(ph: number): PhBranch | undefined {
  return PH_BRANCHES.find((b) => b.matches(ph));
}

export const RULES = {
  whirlpool:
    'Whirlpool at 80 °C, 20 minutes. Above it you volatilise aroma and keep isomerising alpha acids; below ~70 °C spoilage organisms survive.',
  aeration:
    'Aeration: splash on transfer (free, ~2–4 ppm O₂) plus a sealed hard shake of 3–5 minutes (~8 ppm, the ceiling for any air method). Log method and duration every batch.',
  fermentationRamp:
    'Fermentation ramp: hold pitch temperature days 0–4, then allow +2 °C from ~day 5. Acetaldehyde (green apple) is an intermediate the yeast reabsorbs, and it cleans up faster warm.',
  terminalHold:
    'Hold 2–3 days at terminal gravity before crashing or packaging. Never crash on the first flat gravity reading.',
  purgeKeg: 'Purge or pressurise the receiving keg before transfer.',
  cleanup:
    'Cleanup: use ~12 L water and ~168 g PBW in the BrewZilla, soak overnight, then rinse thoroughly the next day. Wash hop bags and socks immediately; spent hops sour fast. If it boiled over, hand-wash the jacket separately in warm soapy water and hang to dry.',
  afterBrewDay:
    'After brew day: hold 19–20 °C days 0–4; dry hop day 4 with 250 g in 4 bags (~62 g each) for 3-day contact, open briefly and do not stir; from ~day 5 allow +2 °C to 21–22 °C; hold 2–3 days at terminal gravity before crashing or packaging — never crash on the first flat reading; cold crash 0–3 °C for 2–5 days if keezer space allows; FG on the Tilt, never the refractometer; purge or pressurise the receiving keg before transfer; carbonate 2.4 volumes (= 10 PSI at 3 °C); expect 15.5–17 L packaged.',
} as const;

export const PH_INSTRUMENT = {
  id: '2025-all-new-ph-meter',
  label: '2025 All-New pH Meter',
  displayOffsetLow: -0.10,
  displayOffsetHigh: -0.05,
  measuredDate: '2026-09-26',
} as const;

export function expectedMashPhDisplay(target: { low: number; high: number }, instrument = PH_INSTRUMENT) {
  const low = target.low + instrument.displayOffsetLow;
  const high = target.high + instrument.displayOffsetHigh;
  return { low, high, label: `${low.toFixed(2)}–${high.toFixed(2)}` };
}

export const SANITISE_DURING_MASH =
  'Mix StarSan (2 tbsp (30 mL) per 19 L). Sanitise fermenter, lid, temp probe, Tilt, auto-siphon and hose, dry-hop bag, sample jar.';

export const WHIRLPOOL_TEMP_C = 80;
export const WHIRLPOOL_MINUTES = 20;
export const HOP_SOCK_THRESHOLD_G = 100;

export const COURSE_CORRECTION = {
  intro: 'Course correction. Work in gravity points (the digits after 1.0):',
  formula: 'expected kettle points ≈ R9 points × R8 litres ÷ post-boil litres; ÷ 0.96 for cooling shrinkage → OG',
  example: 'Example: 1.056 at 24 L boiling down to 21 L → 56 × 24 ÷ 21 = 64 ÷ 0.96 ≈ 67 → OG 1.067',
  onTarget: 'On target → proceed.',
  low: 'Low → extend the boil 15–20 min or accept the lower ABV. ⚠ Do not add sugar — it thins the body and gives a cidery edge, which is the fault under investigation.',
  high: 'High → top up with hot water.',
} as const;

export const EFFICIENCY_CHECK_NOTE =
  'Record this number. It settles which efficiency this system actually delivers.';

export type ReadingId =
  | 'untreatedWaterPh'
  | 'strikeWaterPh'
  | 'spargeWaterPh'
  | 'mashInTemp'
  | 'mashPh15'
  | 'mashPhCorrected'
  | 'spargePhBeforeUse'
  | 'preBoilVolume'
  | 'preBoilGravity'
  | 'preBoilDeadspace'
  | 'whirlpoolTemp'
  | 'whirlpoolDuration'
  | 'transferTemp'
  | 'fermenterVolume'
  | 'og'
  | 'aeration'
  | 'fermentationTemp'
  | 'gravityStableDate'
  | 'fg';

export interface Reading {
  id: ReadingId;
  label: string;
  unit?: string;
  counts?: boolean;
  displayNumber?: string;
}

// Master list, in the order the readings are taken. Numbers are position + 1.
export const READINGS: Reading[] = [
  { id: 'untreatedWaterPh', label: 'Untreated water pH' },
  { id: 'strikeWaterPh', label: 'Strike water pH' },
  { id: 'spargeWaterPh', label: 'Sparge water pH' },
  { id: 'mashInTemp', label: 'Actual mash-in temp', unit: '°C' },
  { id: 'mashPh15', label: 'Mash pH at 15 min' },
  { id: 'mashPhCorrected', label: 'Mash pH after correction' },
  { id: 'spargePhBeforeUse', label: 'Sparge pH before use' },
  { id: 'preBoilVolume', label: 'Pre-boil volume', unit: 'L' },
  { id: 'preBoilGravity', label: 'Pre-boil gravity', unit: 'SG' },
  { id: 'preBoilDeadspace', label: 'Malt-pipe deadspace', unit: 'L', counts: false, displayNumber: '9b' },
  { id: 'whirlpoolTemp', label: 'Whirlpool temp', unit: '°C' },
  { id: 'whirlpoolDuration', label: 'Whirlpool duration', unit: 'min' },
  { id: 'transferTemp', label: 'Temp at transfer', unit: '°C' },
  { id: 'fermenterVolume', label: 'Volume into fermenter', unit: 'L' },
  { id: 'og', label: 'OG', unit: 'SG' },
  { id: 'aeration', label: 'Aeration method and duration' },
  { id: 'fermentationTemp', label: 'Fermentation holding temp', unit: '°C' },
  { id: 'gravityStableDate', label: 'Date gravity stops moving' },
  { id: 'fg', label: 'FG', unit: 'SG' },
];

export function readingNumber(id: ReadingId): number {
  return READINGS.filter((r) => r.counts !== false).findIndex((r) => r.id === id) + 1;
}

export function reading(id: ReadingId): Reading & { number: number | string } {
  const r = READINGS.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown reading ${id}`);
  return { ...r, number: r.displayNumber ?? readingNumber(id) };
}
