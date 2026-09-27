# AGENTS.md — brewThis

This file is source code for the agent. Keep it under 150 lines. Edit it by
hand and review changes in PRs. Do not regenerate it or use @-imports.

## Product

brewThis is a personal brewing app for a BrewZilla Gen 4.1 35 L system. Its
purpose is a printable, equipment-specific brew-day sheet:

```
Brewfather API  -> quantities (recipe, mash steps, batches)
Procedure      -> judgement (safety, sequencing, readings)
Brew sheet     -> both, optimized for printing
```

The app does not replace Brewfather.

## Non-negotiable rules

1. Never commit or log secrets. Brewfather credentials are only in `.env` as
   `BREWFATHER_USERID` and `BREWFATHER_API`.
2. Safety text is static hand-written template constants copied verbatim.
   Never generate, paraphrase, or LLM-write a warning at runtime.
3. Brewfather recipes are read/write/delete; inventory is read-only. Batches are
   read-only except measured-values PATCH (`batches.write`), which is permitted
   only from an explicit user-triggered action that previews exactly which fields
   it sends — never automatically, and never as a side effect of saving a reading.
   Use `recipes.read`, `recipes.write`, `recipes.delete`, `batches.read`,
   `batches.write`, and `inventory.read`. The API permits 500 calls/hour: cache
   reads and avoid redundant calls. Recipe writes must use complete ingredient
   arrays, fresh-read `_rev` version checks, same-origin/editable-field guards,
   typed-name delete confirmation, and cache invalidation after every write.
4. Metric throughout: L, kg, g, °C, and SG. Do not add unit conversion.
5. Calculations are pure functions with unit tests. They determine real
   ingredient quantities and must stay anchored to the Citra IPA golden fixture.
6. Gravity arithmetic uses POINTS, not SG. Convert 1.056 to 56 before applying
   volume ratios; multiplying raw SG by a ratio is wrong.

## Local commands

```bash
npm test
npx tsc --noEmit
npm run lint
NEXT_DIST_DIR=.next-build npm run build
```

If a dev server is running, never let a production build write `.next`; use
`NEXT_DIST_DIR=.next-build`.

## Brew sheet

The sheet is at `/recipes/[id]/brewsheet`. Keep the calculation engine pure in
`src/lib/brewsheet/calculations.ts`, recipe mapping pure in
`src/lib/brewsheet/fromRecipe.ts`, and static procedure text in
`src/lib/brewsheet/procedure.ts`.

Use the BrewZilla defaults: 35 L kettle, 3.0 L/h estimated boil-off, 1.0 L/kg
grain absorption, 4.5 mL/g hop absorption, 1.0 L trub loss, 76% assumed
   efficiency, 3.5 L/kg mash thickness, and 20 °C grain temperature. Mark
   derived estimates with `(est.)` — on screen and in print. Estimate status is not
   provenance: keep the `(est.)` marks on the printed sheet, and keep derivations off it
   (assumption paragraphs, worked examples, formulas and caveat prose render with
   `d-print-none`).

Water calculations must retain hop loss:

```
grain absorption = grain kg × 1.0
boil-off         = 3.0 × boil minutes / 60
hop loss         = whirlpool hops g × 4.5 / 1000
pre-boil volume  = batch size + boil-off + hop loss + trub loss
total water      = pre-boil volume + grain absorption
```

Strike temperature must be recalculated whenever strike volume changes:
`(0.41 / (strike L / grain kg)) × (mash temp - grain temp) + mash temp`.

The golden fixture is Citra IPA: 19 L batch, 5.20 kg grain, 60 min boil, 200 g
whirlpool hops, 66.7 °C mash, 20 °C grain. Expected values include 5.20 L
absorption, 3.00 L boil-off, 0.90 L hop loss, 23.9 L pre-boil, 29.1 L total
   water, 18.2 L strike, 10.9 L sparge, 72.2 °C strike, and 4.0 mL strike acid.

⚠️ FLAGGED 2026-09-26: the fixture's 23.9 L pre-boil / 29.1 L total-water chain is not yet
reconciled with the 2026-09-24 correction (4% cooling shrinkage + 50 g Cascade absorption
→ 25.0 L hot pre-boil). Do not change the fixture until this is settled.

Hop containment is computed from the recipe's hops (`hopContainment()`), never hardcoded.
Do not add a second mechanism.

## RAPT profile export

The RAPT output is a paste-ready document only. It must not contain RAPT credentials,
API calls, profile uploads, device control, telemetry or webhooks. Manual intervention
points use an 80 °C live hold on this rig and carry the dry-fire/scorch warning. The
boil is split: manual heat to 105 °C, then a 60-minute timer with `timerStart:
onStepStart`; the whirlpool is an 80 °C, 20-minute `onStepStart` timer. Every timer
has an explicit start, every alert uses one of the three portal triggers, and every
temperature trigger is below the physical plateau. There is no six-stage cap; do not
emit a merged profile. Servomyces and Whirlfloc quantities carry visible manufacturer
reference flags when the recipe supplies a quantity. Portal decimal-target handling,
exact 105 °C behavior outside this rig, and import/export format remain unverified.

## Mash pH

The pH meter is calibrated as of 2026-09-26. **Do not recalibrate before brew day.**
The day-before step reads: "Meter calibrated 2026-09-26. Do not recalibrate before
brewing. Take readings through the meter display offset." (`PH.instrumentStatus`).
The old "calibrate the day before" instruction is retired.

The instrument carries a flat 0.05–0.10 pH LOW display offset, measured 2026-09-26
(4.00 read 3.97; 9.18 read 9.13/9.10; distilled 5.50 against the 5.6 air-equilibrium).
It is not a slope error and not the 0.3-high failure the 5.8 guard looks for. It is
configured once per instrument in `PH_INSTRUMENT` and applied by the pure function
`expectedMashPhDisplay(target, instrument)`.

The mash pH TARGET is a per-recipe value read from the recipe note. Do not
invent a global target. The Citra IPA golden fixture target is 5.5–5.6.
The sheet must show TARGET and EXPECTED as separately labelled numbers. EXPECTED is the
per-recipe TARGET shifted by the instrument's display offset (Citra IPA: TARGET 5.5–5.6
→ EXPECTED display 5.40–5.55) and must not be presented as the recipe TARGET.

Keep the guard: above 5.8, check the meter against a second reference before
adding acid. The meter currently carries an approximately 0.1 pH LOW bias,
unverified until it is retested after an electrode soak.

CLOSED 2026-09-26: in-mash thresholds are derived from the per-recipe TARGET, not from the
old global 5.2–5.4 target (5.5–5.6 → branches at 5.5, 5.6 and 5.8; cap 2 mL). Keep
exhaustive branch coverage in `procedure.test.ts` (sweeps 4.8–6.4).

## Procedure and print requirements

Copy required safety warnings verbatim from the hand-written constants. The
sheet must include the complete numbered reading list and repeat every reading
inline. Include the pH calibration, recipe TARGET, water EXPECTED value, and
the meter-check guard at the pH step.

The sheet is used beside boiling liquid: keep warnings visible, blanks writable,
steps together when printed, and navigation/buttons out of print. Use semantic
HTML, labels, keyboard access, visible focus, and ARIA only when needed.

Before changing code, inspect existing patterns and tests. Keep changes focused,
avoid dependencies and unrelated refactors, and run the smallest useful checks.
