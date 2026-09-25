import React from 'react';
import type { BrewfatherHop, BrewfatherRecipe } from '@/types';
import {
  abv,
  calculateBrewSheet,
  DEFAULT_EQUIPMENT,
  DEFAULT_MASH_THICKNESS_L_PER_KG,
  FALLBACK_POTENTIAL,
  predictGravity,
} from '@/lib/brewsheet/calculations';
import {
  brewfatherEfficiency,
  efficiencyFor,
  hopsByUse,
  mashedFermentables,
  toBrewSheetInput,
  type BrewSheetOverrides,
} from '@/lib/brewsheet/fromRecipe';
import {
  ACID_CAVEAT,
  COURSE_CORRECTION,
  EFFICIENCY_CHECK_NOTE,
  HOP_SOCK_THRESHOLD_G,
  PH,
  PH_BRANCHES,
  reading,
  READINGS,
  RULES,
  SAFETY,
  SANITISE_DURING_MASH,
  WHIRLPOOL_MINUTES,
  WHIRLPOOL_TEMP_C,
  type ReadingId,
} from '@/lib/brewsheet/procedure';
import PrintButton from './PrintButton';
import styles from './BrewSheet.module.scss';

const fmt = (n: number | undefined, decimals = 1) =>
  n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(decimals);
const sg = (n: number | undefined) => fmt(n, 3);

function Est() {
  return <span className={styles.est}>(est.)</span>;
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.warning} role="note">
      <strong>⚠ SAFETY</strong> {children}
    </div>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return <p className={styles.rule}>{children}</p>;
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className={styles.check}>
      <span className={styles.box} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

function ReadingField({ id, hint }: { id: ReadingId; hint?: React.ReactNode }) {
  const r = reading(id);
  return (
    <div className={styles.reading}>
      <span className={styles.readingNo}>R{r.number}</span>
      <span className={styles.readingLabel}>{r.label}</span>
      <span className={styles.blank} />
      {r.unit && <span className={styles.unit}>{r.unit}</span>}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.step}>
      <h3>
        <span className={styles.stepNo}>{n}</span> {title}
      </h3>
      {children}
    </section>
  );
}

const sumAmount = (items: { amount?: number }[]) =>
  items.reduce((total, x) => total + (x.amount ?? 0), 0);

function hopLine(h: BrewfatherHop) {
  return `${fmt(h.amount, 0)} g ${h.name?.trim() || 'Unnamed hop'}${h.alpha ? ` (${fmt(h.alpha)}% AA)` : ''}`;
}

export default function BrewSheet({
  recipe,
  overrides,
}: {
  recipe: BrewfatherRecipe;
  overrides: BrewSheetOverrides;
}) {
  const input = toBrewSheetInput(recipe, overrides);

  if (!(input.grainKg > 0) || !(input.batchSizeL > 0)) {
    return (
      <main className={`container py-4 ${styles.sheet}`}>
        <h1>{recipe.name || 'Untitled recipe'}</h1>
        <p>This recipe has no mashed grain or no batch size, so a brew sheet cannot be generated.</p>
      </main>
    );
  }

  const c = calculateBrewSheet(input);
  const eq = DEFAULT_EQUIPMENT;
  const grist = mashedFermentables(recipe);
  const hops = hopsByUse(recipe);
  const miscs = recipe.miscs ?? [];
  const mashSalts = miscs.filter((m) => /mash/i.test(m.use ?? ''));
  const spargeSalts = miscs.filter((m) => /sparge/i.test(m.use ?? ''));
  const boilMiscs = miscs.filter((m) => /boil/i.test(m.use ?? ''));
  const mashSteps = recipe.mash?.steps ?? [];
  const fermSteps = recipe.fermentation?.steps ?? [];
  const yeasts = recipe.yeasts ?? [];
  const spargeTempC = recipe.equipment?.spargeTemperature;
  const efficiency = efficiencyFor(recipe, overrides);
  const gravity = c.gravity;
  const preBoilTarget = gravity?.predictedPreBoilGravity;
  const mashInTempC = input.mashInTempC ?? input.mashTempC;

  // Efficiency diagnostic at R9: the spec's assumed 76%, Brewfather's figure,
  // and any override, each as a predicted pre-boil gravity and OG.
  const efficiencyCases = [
    { efficiencyPct: DEFAULT_EQUIPMENT.efficiencyPct, label: 'spec assumption' },
    { efficiencyPct: brewfatherEfficiency(recipe), label: 'Brewfather profile' },
    { efficiencyPct: overrides.efficiencyPct, label: 'override' },
  ]
    .filter((e): e is { efficiencyPct: number; label: string } => e.efficiencyPct !== undefined)
    .filter((e, i, all) => all.findIndex((x) => x.efficiencyPct === e.efficiencyPct) === i)
    .map((e) => ({
      ...e,
      ...predictGravity(input.fermentables ?? [], e.efficiencyPct, {
        batchSizeL: input.batchSizeL,
        preBoilVolumeL: c.preBoilVolumeL,
        postBoilVolumeL: c.postBoilVolumeL,
      }),
    }));
  const holdsTargetOG = (og: number) =>
    recipe.og !== undefined && Math.abs(og - recipe.og) <= 0.002;

  const targetAbv =
    recipe.og !== undefined && recipe.fg !== undefined ? abv(recipe.og, recipe.fg) : undefined;

  let n = 0;
  const next = () => ++n;

  return (
    <main className={`container py-4 ${styles.sheet}`}>
      <header className={styles.header}>
        <div>
          <h1>{recipe.name}</h1>
          <p className={styles.sub}>
            {recipe.style?.name && <>{recipe.style.name} · </>}
            BrewZilla Gen 4.1 35 L · {fmt(input.batchSizeL)} L into fermenter · {input.boilMinutes} min boil
          </p>
        </div>
        <div className={styles.brewDate}>
          Brew date <span className={styles.blank} />
        </div>
      </header>

      <div className={`d-print-none ${styles.controls}`}>
        <form method="get" className="row g-2 align-items-end">
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="batch">Batch size (L)</label>
            <input className="form-control form-control-sm" id="batch" name="batch" type="number" step="0.1" min="1" max="30" defaultValue={overrides.batchSizeL} placeholder={fmt(recipe.batchSize)} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="mash">Mash temp (°C)</label>
            <input className="form-control form-control-sm" id="mash" name="mash" type="number" step="0.1" min="60" max="75" defaultValue={overrides.mashTempC} placeholder={fmt(input.mashTempC)} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="grain">Grain temp (°C)</label>
            <input className="form-control form-control-sm" id="grain" name="grain" type="number" step="0.5" min="0" max="40" defaultValue={overrides.grainTempC} placeholder={fmt(input.grainTempC)} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="strike">Strike volume (L)</label>
            <input className="form-control form-control-sm" id="strike" name="strike" type="number" step="0.1" min="5" max="30" defaultValue={overrides.strikeWaterL} placeholder={fmt(input.grainKg * DEFAULT_MASH_THICKNESS_L_PER_KG)} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small" htmlFor="efficiency">Efficiency (%)</label>
            <input className="form-control form-control-sm" id="efficiency" name="efficiency" type="number" step="0.1" min="40" max="95" defaultValue={overrides.efficiencyPct} placeholder={fmt(efficiency.efficiencyPct)} />
          </div>
          <div className="col-12 d-flex gap-2">
            <button type="submit" className="btn btn-outline-secondary btn-sm">Recalculate</button>
            <a href="?" className="btn btn-link btn-sm">Reset</a>
            <span className="ms-auto"><PrintButton /></span>
          </div>
        </form>
        <p className="small text-muted mb-0 mt-2">
          Changing strike volume always recalculates strike temperature and sparge volume.
        </p>
      </div>

      {/* Targets and water plan */}
      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>Targets (Brewfather)</h2>
          <table className={styles.table}>
            <tbody>
              <tr><th>OG</th><td>{sg(recipe.og)}</td></tr>
              <tr><th>FG</th><td>{sg(recipe.fg)}</td></tr>
              <tr><th>ABV</th><td>{fmt(targetAbv)} %</td></tr>
              <tr><th>IBU</th><td>{fmt(recipe.ibu, 0)}</td></tr>
              <tr><th>Predicted OG</th><td>{sg(gravity?.predictedOG)} <Est /> at {fmt(efficiency.efficiencyPct)}%</td></tr>
              <tr><th>Pre-boil gravity</th><td>{sg(preBoilTarget)} <Est /> at {fmt(efficiency.efficiencyPct)}%</td></tr>
            </tbody>
          </table>
          <p className={styles.small}>
            Assumptions: boil-off {fmt(eq.boilOffRateLPerHour)} L/h <Est />,
            efficiency {fmt(efficiency.efficiencyPct)}% ({{ override: 'override', brewfather: 'Brewfather profile', default: 'spec default' }[efficiency.source]}) <Est />,
            grain absorption {fmt(eq.grainAbsorptionLPerKg)} L/kg, hop absorption {fmt(eq.hopAbsorptionMlPerG)} mL/g,
            trub loss {fmt(eq.trubLossL)} L.
          </p>
        </section>

        <section className={styles.panel}>
          <h2>Water plan</h2>
          <table className={styles.table}>
            <tbody>
              <tr><th>Strike water</th><td><strong>{fmt(c.strikeWaterL)} L at {fmt(c.strikeTempC)} °C</strong></td></tr>
              <tr><th>Sparge water</th><td><strong>{fmt(c.spargeWaterL)} L</strong> <Est /></td></tr>
              <tr><th>Total water</th><td>{fmt(c.totalWaterL)} L <Est /></td></tr>
              <tr><th>Pre-boil volume</th><td>{fmt(c.preBoilVolumeL)} L <Est /> ({fmt(c.preBoilFillRatio * 100, 0)}% of kettle)</td></tr>
              <tr><th>Post-boil volume</th><td>{fmt(c.postBoilVolumeL)} L <Est /></td></tr>
              <tr><th>Losses</th><td>grain {fmt(c.grainAbsorptionL)} · boil-off {fmt(c.boilOffL)} <Est /> · hops {fmt(c.hopLossL)} · trub {fmt(eq.trubLossL)} L</td></tr>
              <tr><th>Lactic acid 88%</th><td>strike <strong>{fmt(c.strikeAcidMl)} mL</strong> · sparge <strong>{fmt(c.spargeAcidMl)} mL</strong> <Est /></td></tr>
            </tbody>
          </table>
          <p className={styles.small}>{ACID_CAVEAT}</p>
        </section>
      </div>

      {/* Ingredients */}
      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>Grain bill — {fmt(input.grainKg, 2)} kg</h2>
          <ul className={styles.checklist}>
            {grist.map((f, i) => (
              <Check key={i}>{fmt(f.amount, 2)} kg {f.name}</Check>
            ))}
          </ul>
        </section>
        <section className={styles.panel}>
          <h2>Yeast</h2>
          <ul className={styles.checklist}>
            {yeasts.map((y, i) => (
              <Check key={i}>
                {y.amount ?? ''} {y.unit ?? ''} {y.laboratory ? `${y.laboratory} ` : ''}{y.name}
                {y.minTemp !== undefined && y.maxTemp !== undefined && <> ({y.minTemp}–{y.maxTemp} °C)</>}
              </Check>
            ))}
          </ul>
          <h2>Hops to weigh out</h2>
          <p>
            Boil {fmt(sumAmount([...hops.firstWort, ...hops.boil]), 0)} g · whirlpool {fmt(input.whirlpoolHopG, 0)} g ·
            dry {fmt(sumAmount(hops.dryHop), 0)} g
          </p>
        </section>
      </div>

      {/* Master reading list */}
      <section className={`${styles.panel} ${styles.master}`}>
        <h2>Readings — fill every blank. A blank at the end is data lost.</h2>
        <ol className={styles.masterList}>
          {READINGS.map((r) => (
            <li key={r.id}>
              <ReadingField id={r.id} />
              {r.id === 'fg' && <p className={styles.fgWarn}>⚠ {SAFETY.fgInstrument}</p>}
            </li>
          ))}
        </ol>
      </section>

      <h2 className={styles.procedureTitle}>Procedure</h2>

      <Step n={next()} title="Day before — water and acid">
        <ul className={styles.checklist}>
          <Check>{PH.calibrate}</Check>
          <Check>Collect strike water {fmt(c.strikeWaterL)} L and sparge water {fmt(c.spargeWaterL)} L <Est />.</Check>
        </ul>
        <ReadingField id="untreatedWaterPh" />
        <Warning>{SAFETY.lacticAcid}</Warning>
        <ul className={styles.checklist}>
          {mashSalts.length > 0 && <Check>Add strike salts: {mashSalts.map((m) => `${fmt(m.amount, 2)} ${m.unit} ${m.name}`).join(', ')}.</Check>}
          {spargeSalts.length > 0 && <Check>Add sparge salts: {spargeSalts.map((m) => `${fmt(m.amount, 2)} ${m.unit} ${m.name}`).join(', ')}.</Check>}
          <Check>Strike water: <strong>{fmt(c.strikeAcidMl)} mL</strong> lactic acid 88% ({input.hasCrystalOrRoast ? 'grist has crystal/roast' : 'pale grist, no crystal/roast'}).</Check>
          <Check>Sparge water: <strong>{fmt(c.spargeAcidMl)} mL</strong> lactic acid 88% <Est />.</Check>
        </ul>
        <p className={styles.small}>{ACID_CAVEAT}</p>
        <ReadingField id="strikeWaterPh" />
        <ReadingField id="spargeWaterPh" />
      </Step>

      <Step n={next()} title="Heat strike water and mash in">
        <ul className={styles.checklist}>
          <Check>
            Heat <strong>{fmt(c.strikeWaterL)} L</strong> to <strong>{fmt(c.strikeTempC)} °C</strong> (mash {fmt(mashInTempC)} °C,
            grain at {fmt(input.grainTempC)} °C, {fmt(c.strikeWaterL / input.grainKg, 2)} L/kg).
          </Check>
          <Check>Dough in {fmt(input.grainKg, 2)} kg slowly, stirring out every dough ball.</Check>
          {hops.mash.map((h, i) => <Check key={i}>Mash hop: {hopLine(h)}</Check>)}
          {mashSteps.map((s, i) => (
            <Check key={i}>
              {s.name ? `${s.name}: ` : `Step ${i + 1}: `}
              {fmt(s.stepTemp ?? s.temp)} °C for {s.stepTime ?? s.time ?? '—'} min
            </Check>
          ))}
        </ul>
        <ReadingField id="mashInTemp" hint={<>target {fmt(mashInTempC)} °C</>} />
      </Step>

      <Step n={next()} title="Mash pH at 15 minutes">
        <p className={styles.small}><strong>{PH.calibrate}</strong></p>
        <p>{PH.target}</p>
        <ReadingField id="mashPh15" />
        <div className={styles.tree}>
          {PH_BRANCHES.map((b) => (
            <div key={b.id} className={styles.branch}>
              <span className={styles.box} aria-hidden="true" />
              <span>
                {b.text}
                {b.note && <span className={styles.branchNote}> {b.note}</span>}
              </span>
            </div>
          ))}
          <p className={styles.cap}>⚠ {PH.cap}</p>
        </div>
        <div className={styles.reading}>
          <span className={styles.readingLabel}>Lactic added in mash</span>
          <span className={styles.blank} />
          <span className={styles.unit}>mL (max 2)</span>
        </div>
        <ReadingField id="mashPhCorrected" />
        <ul className={styles.checklist}>
          <Check>{SANITISE_DURING_MASH}</Check>
        </ul>
      </Step>

      <Step n={next()} title="Sparge water, mash out, lift malt pipe, sparge">
        <ul className={styles.checklist}>
          <Check>
            Heat sparge water {fmt(c.spargeWaterL)} L <Est />
            {spargeTempC !== undefined && <> to {fmt(spargeTempC)} °C</>}.
          </Check>
        </ul>
        <ReadingField id="spargePhBeforeUse" />
        <Warning>{SAFETY.maltPipeLift}</Warning>
        <ul className={styles.checklist}>
          <Check>Lift and seat the malt pipe on its supports.</Check>
          <Check>Sparge slowly with {fmt(c.spargeWaterL)} L <Est />; let it drain fully.</Check>
          {hops.firstWort.map((h, i) => <Check key={i}>First wort hop: {hopLine(h)}</Check>)}
        </ul>
      </Step>

      <Step n={next()} title="Pre-boil check — the last point a bad number can be fixed">
        <ReadingField id="preBoilVolume" hint={<>target {fmt(c.preBoilVolumeL)} L <Est /></>} />
        <ReadingField id="preBoilGravity" hint={<>target {sg(preBoilTarget)} <Est /> at {fmt(efficiency.efficiencyPct)}%</>} />
        {efficiencyCases.length > 0 && (
          <div className={styles.effCheck}>
            <p><strong>Efficiency check</strong> — compare R{reading('preBoilGravity').number}:</p>
            <table className={styles.effTable}>
              <tbody>
                {efficiencyCases.map((e) => (
                  <tr key={e.efficiencyPct}>
                    <td>If ~<strong>{sg(e.predictedPreBoilGravity)}</strong> <Est /></td>
                    <td>→ {fmt(e.efficiencyPct)}% efficiency ({e.label})</td>
                    <td>
                      OG will land near <strong>{sg(e.predictedOG)}</strong> <Est />
                      {holdsTargetOG(e.predictedOG) && <>, target OG holds</>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {gravity?.potentialEstimated && (
              <p className={styles.small}>
                <Est /> Some fermentables have no potential in Brewfather; {FALLBACK_POTENTIAL} assumed.
              </p>
            )}
            <p><strong>{EFFICIENCY_CHECK_NOTE}</strong></p>
          </div>
        )}
        <div className={styles.correction}>
          <p><strong>{COURSE_CORRECTION.intro}</strong></p>
          <p>{COURSE_CORRECTION.formula}</p>
          <p className={styles.small}>{COURSE_CORRECTION.example}</p>
          <p>
            = R{reading('preBoilGravity').number} points × R{reading('preBoilVolume').number} ÷ {fmt(c.postBoilVolumeL)} L <Est /> =
            <span className={styles.blankShort} /> points vs target OG {sg(recipe.og)}
          </p>
          <ul className={styles.checklist}>
            <Check>{COURSE_CORRECTION.onTarget}</Check>
            <Check>{COURSE_CORRECTION.low}</Check>
            <Check>{COURSE_CORRECTION.high}</Check>
          </ul>
        </div>
      </Step>

      <Step n={next()} title={`Boil — ${input.boilMinutes} min`}>
        {c.boilOverRisk && <Warning>{SAFETY.boilOver}</Warning>}
        <ul className={styles.checklist}>
          {hops.boil.map((h, i) => (
            <Check key={`h${i}`}>{h.time} min: {hopLine(h)}</Check>
          ))}
          {boilMiscs.map((m, i) => (
            <Check key={`m${i}`}>{m.time ?? '—'} min: {fmt(m.amount, 1)} {m.unit} {m.name}</Check>
          ))}
        </ul>
      </Step>

      <Step n={next()} title={`Whirlpool — ${WHIRLPOOL_TEMP_C} °C, ${WHIRLPOOL_MINUTES} min`}>
        <Rule>{RULES.whirlpool}</Rule>
        {input.whirlpoolHopG > HOP_SOCK_THRESHOLD_G && <Rule>{RULES.hopSocks}</Rule>}
        <ul className={styles.checklist}>
          <Check>Element off. Chill to {WHIRLPOOL_TEMP_C} °C.</Check>
          {hops.whirlpool.length === 0 && <li className={styles.small}>No whirlpool hops in this recipe.</li>}
          {hops.whirlpool.map((h, i) => <Check key={i}>{hopLine(h)}</Check>)}
        </ul>
        <ReadingField id="whirlpoolTemp" hint={<>target {WHIRLPOOL_TEMP_C} °C</>} />
        <ReadingField id="whirlpoolDuration" hint={<>target {WHIRLPOOL_MINUTES} min</>} />
      </Step>

      <Step n={next()} title="Chill and transfer">
        <Warning>{SAFETY.transfer}</Warning>
        <ul className={styles.checklist}>
          <Check>Chill to pitch temperature{fermSteps[0]?.stepTemp !== undefined && <> ({fmt(fermSteps[0].stepTemp)} °C)</>}.</Check>
          <Check>Transfer to the sanitised fermenter (sanitised during the mash), sitting below the tap.</Check>
        </ul>
        <ReadingField id="transferTemp" />
        <ReadingField id="fermenterVolume" hint={<>target {fmt(input.batchSizeL)} L</>} />
        <ReadingField id="og" hint={<>target {sg(recipe.og)}</>} />
      </Step>

      <Step n={next()} title="Aerate">
        <Rule>{RULES.aeration}</Rule>
        <Warning>{SAFETY.aerationLift}</Warning>
        <ReadingField id="aeration" />
      </Step>

      <Step n={next()} title="Pitch and ferment">
        <Warning>{SAFETY.fermenterLight}</Warning>
        <ul className={styles.checklist}>
          {yeasts.map((y, i) => <Check key={i}>Pitch {y.amount ?? ''} {y.unit ?? ''} {y.name}.</Check>)}
          {fermSteps.map((s, i) => (
            <Check key={`f${i}`}>{s.type ?? 'Step'}: {fmt(s.stepTemp ?? s.temp)} °C for {s.stepTime ?? s.time ?? '—'} days</Check>
          ))}
        </ul>
        <Rule>{RULES.fermentationRamp}</Rule>
        <ReadingField id="fermentationTemp" />
        {hops.dryHop.length > 0 && (
          <>
            <h4 className={styles.subhead}>Dry hops</h4>
            <ul className={styles.checklist}>
              {hops.dryHop.map((h, i) => <Check key={i}>Day {h.day ?? '—'}: {hopLine(h)}</Check>)}
            </ul>
          </>
        )}
      </Step>

      <Step n={next()} title="Finish and package">
        <Rule><strong>⚠ {RULES.terminalHold}</strong></Rule>
        <ReadingField id="gravityStableDate" />
        <ReadingField id="fg" hint={<>target {sg(recipe.fg)}</>} />
        <p className={styles.fgWarn}>⚠ {SAFETY.fgInstrument}</p>
        <div className={styles.reading}>
          <span className={styles.readingLabel}>ABV = (R{reading('og').number} − R{reading('fg').number}) × 131.25</span>
          <span className={styles.blank} />
          <span className={styles.unit}>%</span>
        </div>
        <ul className={styles.checklist}>
          <Check>{RULES.purgeKeg}</Check>
        </ul>
      </Step>

      <section className={`${styles.step} ${styles.notes}`}>
        <h3>Notes</h3>
        <div className={styles.notesLines} />
      </section>
    </main>
  );
}
