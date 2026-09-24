// Static, hand-written procedure content: the judgement layer of the brew sheet.
//
// ⚠️ Safety text is copied verbatim from the spec in CLAUDE.md. Never generate,
// paraphrase or template it at runtime. Edit only by hand, against the spec.

export const SAFETY = {
  maltPipeLift:
    'Heaviest, most dangerous moment of the day. Roughly 2× the dry grain weight, soaked at 75 °C. Use both handles, lift with your legs, seat it square on its supports before letting go. Keep your face out of the steam — it will scald.',
  boilOver:
    'BOIL-OVER WATCH. The danger window is the first few minutes as the hot break forms. Stay at the kettle. Cut the element the instant it climbs. Keep a spray bottle of water in reach. Boiling wort scalds badly and goes over in seconds.',
  lacticAcid:
    "Corrosive. Eye protection. Always acid into water, never water into acid. Syringe or graduated dropper only — 'about a capful' is not a dose at 88%.",
  transfer:
    'Only splash wort that is already chilled (below ~27 °C). Splashing hot wort is hot-side aeration and gives stale cardboard flavours. Never raise the BrewZilla to gain drop height — it holds ~25 kg of hot liquid and is a scald hazard if it shifts. Lower the receiver instead.',
  aerationLift:
    'A 32 L bucket holding 19 L weighs ~20 kg. Lift with your legs and get it onto a solid waist-height surface before shaking it.',
  fermenterLight:
    'Keep out of direct light — it is clear plastic and hop-forward beer lightstrikes fast.',
  fgInstrument:
    'FG must be taken on a hydrometer or Tilt, never a refractometer. Refractometers read falsely high once alcohol is present, which invents an ABV shortfall that is not real.',
} as const;

export const ACID_CAVEAT =
  'Acid doses are scaled from this brewer’s own batches, not calculated from a water report. Mash pH must be measured.';

export const PH = {
  calibrate: 'Calibrate the pH meter the day before with fresh 4.0 and 7.0 buffer.',
  target:
    'Target mash pH 5.2–5.4, measured on a sample cooled to 20–25 °C, at 15 minutes into the mash.',
  inRange: '5.2–5.4: on target. Record and continue.',
  above:
    'Above 5.4: add 1 mL lactic 88%, stir fully through the bed, recirculate, re-measure after 10 min.',
  cap: 'Hard cap: 3 mL of in-mash corrections total. Past that, record the reading and continue — a mash at 5.6 still makes good beer. Chasing further usually means the meter is wrong, not the mash.',
  below: 'Below 5.2: add nothing, record, continue. Never correct upward on brew day.',
} as const;

export const RULES = {
  whirlpool:
    'Whirlpool at 80 °C, 20 minutes. Above it you volatilise aroma and keep isomerising alpha acids; below ~70 °C spoilage organisms survive.',
  hopSocks:
    'Split whirlpool hop charges over 100 g across 2–3 loosely-filled hop socks. Pellets swell; one packed sock is a brick that neither releases aroma nor lets the pump circulate.',
  aeration:
    'Aeration: splash on transfer (free, ~2–4 ppm O₂) plus a sealed hard shake of 3–5 minutes (~8 ppm, the ceiling for any air method). Log method and duration every batch.',
  fermentationRamp:
    'Fermentation ramp: hold pitch temperature days 0–4, then allow +2 °C from ~day 5. Acetaldehyde (green apple) is an intermediate the yeast reabsorbs, and it cleans up faster warm.',
  terminalHold:
    'Hold 2–3 days at terminal gravity before crashing or packaging. Never crash on the first flat gravity reading.',
  purgeKeg: 'Purge or pressurise the receiving keg before transfer.',
} as const;

export const WHIRLPOOL_TEMP_C = 80;
export const WHIRLPOOL_MINUTES = 20;
export const HOP_SOCK_THRESHOLD_G = 100;

export const COURSE_CORRECTION = {
  intro: 'Course correction. Work in gravity points (the digits after 1.0):',
  formula: 'expected OG points ≈ pre-boil points × pre-boil volume ÷ post-boil volume',
  example: 'Example: 1.056 at 24 L boiling down to 21 L → 56 × 24 ÷ 21 = 64 → OG 1.064',
  onTarget: 'On target → proceed.',
  low: 'Significantly low → extend the boil 15–20 min to concentrate, or accept lower ABV. Do NOT add sugar.',
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
  return READINGS.findIndex((r) => r.id === id) + 1;
}

export function reading(id: ReadingId): Reading & { number: number } {
  const r = READINGS.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown reading ${id}`);
  return { ...r, number: readingNumber(id) };
}
