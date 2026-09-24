# CLAUDE.md — brewThis

## What this project is

A personal brewing web app for one user (Shawn), who brews all-grain beer on a **BrewZilla Gen 4.1 35 L** single-vessel system.

The app's purpose is **not** to replace Brewfather. Brewfather already stores recipes and calculates ABV/IBU well. The purpose is to produce the thing Brewfather does *not*: a **printable, equipment-specific, step-by-step brew day sheet** that merges recipe quantities with the brewer's own proven procedure, safety warnings and measurement checklist.

**The core architecture, and the reason this app exists:**

```
Brewfather API   →  supplies QUANTITIES   (grain, hops, yeast, mash steps)
Procedure module →  supplies JUDGEMENT    (safety, sequencing, decisions, readings)
Brew sheet       =  merge of the two, print-optimised
```

Neither source alone produces a usable sheet. That is the whole product.

## Current state (verified September 2026)

- Next.js 15 (App Router) + TypeScript + Bootstrap 5, Prisma 6, Vitest for unit tests
- Docker Compose with PostgreSQL. Prisma schema covers `User`, `Recipe`, `BrewingSession`, `FermentationLog`, `InventoryItem`, `TastingNote`; nothing reads or writes the DB yet
- Brewfather API integration working — `/api/recipes/search`, `/api/recipes/[id]`, `/api/batches`. The client (`src/lib/brewfather/api.ts`) is GET-only and caches responses for 10 minutes
- Recipe browsing UI with filters; the recipe modal links to the brew sheet
- **Phase 1 brew sheet implemented** at `/recipes/[id]/brewsheet`:
  - `src/lib/brewsheet/calculations.ts` — pure calculation engine (+ tests incl. golden fixture)
  - `src/lib/brewsheet/fromRecipe.ts` — maps a Brewfather recipe to calculation inputs (+ tests)
  - `src/lib/brewsheet/procedure.ts` — static safety text, rules, pH tree, numbered readings
  - `src/components/brewsheet/` — sheet rendering and print stylesheet

### Running locally

```bash
docker compose up -d db   # Postgres on 5432
npx prisma db push        # needs DATABASE_URL: set -a; source .env; set +a
npm run dev               # serves on BREW_PORT from .env (1689)
npm test                  # vitest
```

## Non-negotiable constraints

1. 🔐 **Never commit secrets.** `.env` is gitignored and has always been. Brewfather credentials live only in `.env` as `BREWFATHER_USERID` and `BREWFATHER_API`. Never hardcode them, never log them, never put them in error messages.
2. ⚠️ **Safety text is static, never generated.** Every warning in the output must come from a hardcoded template constant. Do **not** call an LLM to write safety content at runtime, and do not paraphrase the warnings in this spec — copy them verbatim. A hallucinated safety instruction around 25 kg of boiling liquid is a real-world injury risk.
3. **Brewfather API is read-only.** Scopes are `recipes.read`, `batches.read`, `inventory.read`. Never add write or delete scopes. Rate limit is **500 calls/hour** — cache responses.
4. **Metric throughout.** The Brewfather API returns metric (L, kg, g, °C, SG). Do not add unit conversion.
5. **Calculations must be pure functions with unit tests.** They decide real ingredient quantities; a silent regression wastes a $60 grain bill and six hours.

---

# Phase 1 — Brew Sheet Generator

**Goal:** given a Brewfather recipe ID, produce a printable brew day sheet at `/recipes/[id]/brewsheet`.

Ship this end to end before starting anything else. A working sheet for one recipe beats a half-built framework.

## 1.1 Calculation engine

Create `src/lib/brewsheet/calculations.ts`. Pure functions, no I/O, fully unit tested.

### Equipment profile

```ts
export interface EquipmentProfile {
  kettleVolumeL: number;        // 35
  boilOffRateLPerHour: number;  // 3.0  — ESTIMATED, never measured
  grainAbsorptionLPerKg: number;// 1.0
  hopAbsorptionMlPerG: number;  // 4.5
  trubLossL: number;            // 1.0
  efficiencyPct: number;        // 76   — ASSUMED, never measured
}
```

⚠️ `boilOffRateLPerHour` and `efficiencyPct` are **unverified assumptions**. Any figure derived from them must be rendered with an "(est.)" marker in the UI. Do not present them as measured.

### Water volumes

```
grainAbsorptionL = grainKg × grainAbsorptionLPerKg
boilOffL         = boilOffRateLPerHour × (boilMinutes / 60)
hopLossL         = whirlpoolHopG × hopAbsorptionMlPerG / 1000
preBoilVolumeL   = batchSizeL + boilOffL + hopLossL + trubLossL
totalWaterL      = preBoilVolumeL + grainAbsorptionL
spargeWaterL     = totalWaterL - strikeWaterL
```

⚠️ **`hopLossL` is the field generic calculators omit**, and it matters enormously on hop-forward beers. A 200 g whirlpool charge retains roughly 0.9 L. Never drop this term.

**Strike water** defaults to a mash thickness of **3.5 L/kg**, which matches the BrewZilla and this brewer's proven batches. Do not use the 1.33 qt/lb (2.78 L/kg) convention from generic calculators — it is a three-vessel mash-tun figure and under-fills the BrewZilla malt pipe.

### Strike temperature

```
R          = strikeWaterL / grainKg
strikeTempC = (0.41 / R) × (mashTempC - grainTempC) + mashTempC
```

`grainTempC` defaults to 20 (room temperature).

⚠️ **Strike volume and strike temperature are coupled.** If a user overrides strike volume, strike temperature MUST be recalculated. Showing one with the other stale causes a missed mash temperature.

### Acid dose

```
hasCrystalOrRoast = any fermentable whose name/type matches
                    /crystal|caramel|roast|chocolate|black|carafa|special ?b/i

strikeAcidMl = hasCrystalOrRoast ? 3.0 : 4.0
spargeAcidMl = round(spargeWaterL × 0.135, 1)   // ~1.5 mL per 11 L
```

Both are **88% lactic acid**. Pale grists with no crystal or roast need more acid, because those malts acidify the mash themselves.

⚠️ These are scaled from this brewer's own batches, **not calculated from a water report** (none exists). Always render them with the caveat that mash pH must be measured, and never present them as computed from water chemistry.

### ABV

```
abv = (og - fg) × 131.25
```

### Golden test fixture — use this exact case in the unit tests

The **Citra IPA (September 2026)** batch. These outputs are hand-verified and cross-checked against an independent calculator; treat them as the regression baseline.

**Input:** `batchSizeL: 19`, `grainKg: 5.20`, `boilMinutes: 60`, `whirlpoolHopG: 200`, `mashTempC: 66.7`, `grainTempC: 20`, default equipment profile, grist has no crystal or roast.

**Expected output:**

| Field | Value | Tolerance |
|---|---|---|
| `grainAbsorptionL` | 5.20 | exact |
| `boilOffL` | 3.00 | exact |
| `hopLossL` | 0.90 | exact |
| `preBoilVolumeL` | 23.9 | ±0.05 |
| `totalWaterL` | 29.1 | ±0.05 |
| `strikeWaterL` | 18.2 | ±0.1 |
| `spargeWaterL` | 10.9 | ±0.1 |
| `strikeTempC` | 72.2 | ±0.3 |
| `strikeAcidMl` | 4.0 | exact |

> The hand-written sheet used 18.0 / 11.1 L (round numbers). The 3.5 L/kg rule gives 18.2 / 10.9 L. Both are correct; the small difference is rounding, not an error.

Also test: a grist **with** crystal malt returns `strikeAcidMl: 3.0`; zero whirlpool hops gives `hopLossL: 0`; a 90-minute boil gives `boilOffL: 4.5`.

## 1.2 Procedure module — the judgement layer

Create `src/lib/brewsheet/procedure.ts`. This holds the static, hand-written content that makes the sheet trustworthy. **Copy the text verbatim; do not paraphrase.**

### Required safety warnings, at the step each belongs to

- **Malt pipe lift (mash-out):** "Heaviest, most dangerous moment of the day. Roughly 2× the dry grain weight, soaked at 75 °C. Use both handles, lift with your legs, seat it square on its supports before letting go. Keep your face out of the steam — it will scald."
- **Boil start:** "BOIL-OVER WATCH. The danger window is the first few minutes as the hot break forms. Stay at the kettle. Cut the element the instant it climbs. Keep a spray bottle of water in reach. Boiling wort scalds badly and goes over in seconds." Render this whenever `preBoilVolumeL / kettleVolumeL > 0.65`.
- **Lactic acid, day before:** "Corrosive. Eye protection. Always acid into water, never water into acid. Syringe or graduated dropper only — 'about a capful' is not a dose at 88%."
- **Transfer:** "Only splash wort that is already chilled (below ~27 °C). Splashing hot wort is hot-side aeration and gives stale cardboard flavours. Never raise the BrewZilla to gain drop height — it holds ~25 kg of hot liquid and is a scald hazard if it shifts. Lower the receiver instead."
- **Aeration lift:** "A 32 L bucket holding 19 L weighs ~20 kg. Lift with your legs and get it onto a solid waist-height surface before shaking it."
- **Fermenter:** "Keep out of direct light — it is clear plastic and hop-forward beer lightstrikes fast."

### pH decision tree (render as a branch, not prose)

- Target mash pH **5.2–5.4**, measured on a sample cooled to 20–25 °C, at 15 minutes into the mash.
- **Above 5.4:** add 1 mL lactic 88%, stir fully through the bed, recirculate, re-measure after 10 min.
- ⚠️ **Hard cap: 3 mL of in-mash corrections total.** Past that, record the reading and continue — a mash at 5.6 still makes good beer. Chasing further usually means the meter is wrong, not the mash.
- **Below 5.2:** add nothing, record, continue. Never correct upward on brew day.
- Always prefix the pH section with: "Calibrate the pH meter the day before with fresh 4.0 and 7.0 buffer."

### Fixed process rules

- **Whirlpool at 80 °C**, 20 minutes. Above it you volatilise aroma and keep isomerising alpha acids; below ~70 °C spoilage organisms survive.
- **Split whirlpool hop charges over 100 g across 2–3 loosely-filled hop socks.** Pellets swell; one packed sock is a brick that neither releases aroma nor lets the pump circulate.
- **Aeration:** splash on transfer (free, ~2–4 ppm O₂) **plus** a sealed hard shake of 3–5 minutes (~8 ppm, the ceiling for any air method). Log method and duration every batch.
- **Fermentation ramp:** hold pitch temperature days 0–4, then allow +2 °C from ~day 5. Acetaldehyde (green apple) is an intermediate the yeast reabsorbs, and it cleans up faster warm.
- ⚠️ **Hold 2–3 days at terminal gravity before crashing or packaging.** Never crash on the first flat gravity reading.
- ⚠️ **FG must be taken on a hydrometer or Tilt, never a refractometer.** Refractometers read falsely high once alcohol is present, which invents an ABV shortfall that is not real. Render this warning at every FG field.
- **Purge or pressurise the receiving keg before transfer.**

## 1.3 Numbered reading checklist

The sheet must emit a **master list of every measurement to take**, numbered, each with a blank to write in — and then repeat each numbered reading inline at the step where it is taken. A reading left blank at the end is data lost permanently.

Minimum set, in order: untreated water pH · strike water pH · sparge water pH · actual mash-in temp · mash pH at 15 min · mash pH after correction · sparge pH before use · pre-boil volume · pre-boil gravity · whirlpool temp · whirlpool duration · temp at transfer · volume into fermenter · OG · aeration method and duration · fermentation holding temp · date gravity stops moving · FG.

### Course-correction rule (include on the sheet)

```
expectedOG ≈ preBoilGravity × preBoilVolumeL / postBoilVolumeL
```

Rendered as: on target → proceed; significantly low → extend the boil 15–20 min to concentrate, or accept lower ABV, but do **not** add sugar; high → top up with hot water.

This is the one point in the day where a bad number can still be fixed, so it must appear at the pre-boil reading, not in a footer.

## 1.4 Route and print CSS

- Route: `src/app/recipes/[id]/brewsheet/page.tsx`
- Fetch the recipe through the existing API layer; do not duplicate the Brewfather client
- Allow overriding batch size, mash temp and grain temp via query params, recalculating everything downstream
- **Print stylesheet is a first-class requirement, not polish.** This sheet is used on a wet bench next to boiling liquid, not on a phone.
  - `@media print`: hide nav, footer, buttons
  - Black on white, no background colours
  - `page-break-inside: avoid` on each step block
  - Blanks render as visible underscored rules with room to write
  - Checkboxes render as empty squares
  - Target 3–4 pages

## 1.5 Acceptance criteria

Phase 1 is done when all of these hold:

1. `npm run build` succeeds with no TypeScript errors
2. Unit tests pass, including the golden fixture above
3. `/recipes/[id]/brewsheet` renders a full sheet for a real Brewfather recipe
4. Printing it produces a clean 3–4 page black-on-white document with no nav or buttons
5. Every safety warning above appears at its correct step
6. Every numbered reading appears both in the master list and inline
7. Estimated figures are visibly marked "(est.)"
8. No credential appears in source, logs or client bundle

## What NOT to build in Phase 1

Resist these. They are why the project stalled last time — the browsing layer got polished while the actual product went unbuilt.

- ❌ Authentication / multi-user
- ❌ Writing back to Brewfather
- ❌ RAPT / Tilt live integration
- ❌ Inventory management
- ❌ More recipe browsing or filter work
- ❌ PDF generation libraries — the browser's own print dialog is sufficient and free

---

# Phase 2 — later, not now

- Persist a generated sheet as a `BrewingSession` row (the schema already supports it)
- Enter actual readings post-brew and compute **real** brewhouse efficiency and boil-off rate, replacing the two estimated constants with measured ones
- Feed `FermentationLog` from Tilt data (`source` field already exists)

The measured-efficiency loop is the highest-value future work: it is what turns every estimate in this spec into a real number.
