'use client';

import React, { useContext, useEffect, useId, useState } from 'react';
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
  brewSheetPlanFromRecipe,
  brewfatherEfficiency,
  efficiencyFor,
  hopContainment,
  hopsByUse,
  mashPhTargetFromRecipe,
  mashedFermentables,
  toBrewSheetInput,
  type BrewSheetOverrides,
} from '@/lib/brewsheet/fromRecipe';
import {
  COURSE_CORRECTION,
  EFFICIENCY_CHECK_NOTE,
  PH,
  PH_INSTRUMENT,
  PH_BRANCHES,
  expectedMashPhDisplay,
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

type ChecklistValues = Record<string, boolean>;
type ChecklistContextValue = {
  values: ChecklistValues;
  toggle: (id: string) => void;
};

const ChecklistContext = React.createContext<ChecklistContextValue | null>(null);

function Check({ children }: { children: React.ReactNode }) {
  const checklist = useContext(ChecklistContext);
  const generatedId = useId();
  const checked = checklist?.values[generatedId] ?? false;

  return (
    <li className={styles.check}>
      <label className={styles.checkLabel}>
        <input
          className={styles.checkInput}
          type="checkbox"
          checked={checked}
          onChange={() => checklist?.toggle(generatedId)}
        />
        <span>{children}</span>
      </label>
    </li>
  );
}

type ReadingValues = Partial<Record<ReadingId, string>>;

function ReadingField({
  id,
  hint,
  value,
  onChange,
}: {
  id: ReadingId;
  hint?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
}) {
  const r = reading(id);
  return (
    <div className={styles.reading}>
      <span className={styles.readingNo}>R{r.number}</span>
      <label className={styles.readingLabel} htmlFor={`reading-${id}`}>{r.label}</label>
      <input
        className={styles.blankInput}
        id={`reading-${id}`}
        name={`reading-${id}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`R${r.number} ${r.label}`}
      />
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

function miscLine(m: { name?: string; amount?: number; unit?: string; time?: number }) {
  const amount = fmt(m.amount, /Whirlfloc/i.test(m.name ?? '') ? 0 : 1);
  const unit = /Whirlfloc/i.test(m.name ?? '') ? 'tablet' : m.unit ?? '';
  return `${m.time ?? '—'} min: ${amount} ${unit} ${m.name ?? 'Unnamed addition'}`;
}

function offsetLabel() {
  return `${PH_INSTRUMENT.displayOffsetLow.toFixed(2)} to ${PH_INSTRUMENT.displayOffsetHigh.toFixed(2)} pH`;
}

function containmentLine(
  label: string,
  containment: ReturnType<typeof hopContainment> | undefined,
  bagDescription: string,
  suffix = ''
) {
  if (!containment) return undefined;
  const name = containment.names.length > 0 ? containment.names.join(', ') : 'unnamed hops';
  return `${label} ${fmt(containment.totalG, 0)} g ${name} in ${containment.bagCount} ${bagDescription}, ~${fmt(containment.gramsPerBag, 0)} g each${suffix}.`;
}

export default function BrewSheet({
  recipe,
  overrides,
}: {
  recipe: BrewfatherRecipe;
  overrides: BrewSheetOverrides;
}) {
  const input = toBrewSheetInput(recipe, overrides);
  const readingsKey = `brewThis:brewsheet:readings:${recipe._id}`;
  const [readingValues, setReadingValues] = useState<ReadingValues>({});
  const checklistKey = `brewThis:brewsheet:checklist:${recipe._id}`;
  const [checklistValues, setChecklistValues] = useState<ChecklistValues>({});

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(readingsKey);
      if (stored) setReadingValues(JSON.parse(stored) as ReadingValues);
    } catch {
      // A private browsing context or malformed local data should leave fields blank.
    }
  }, [readingsKey]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(checklistKey);
      if (stored) setChecklistValues(JSON.parse(stored) as ChecklistValues);
    } catch {
      // A private browsing context or malformed local data leaves boxes unchecked.
    }
  }, [checklistKey]);

  const updateReading = (id: ReadingId, value: string) => {
    setReadingValues((current) => {
      const next = { ...current };
      if (value === '') delete next[id];
      else next[id] = value;
      try {
        window.localStorage.setItem(readingsKey, JSON.stringify(next));
      } catch {
        // Printing still uses the in-memory value if browser storage is unavailable.
      }
      return next;
    });
  };

  const toggleChecklist = (id: string) => {
    setChecklistValues((current) => {
      const next = { ...current, [id]: !current[id] };
      try {
        window.localStorage.setItem(checklistKey, JSON.stringify(next));
      } catch {
        // The checkbox still works in memory if browser storage is unavailable.
      }
      return next;
    });
  };

  const field = (id: ReadingId, hint?: React.ReactNode) => (
    <ReadingField
      id={id}
      hint={hint}
      value={readingValues[id] ?? ''}
      onChange={(value) => updateReading(id, value)}
    />
  );

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
  const mashSalts = miscs.filter((m) => /mash/i.test(m.use ?? '') && !/lactic/i.test(m.name ?? ''));
  const spargeSalts = miscs.filter((m) => /sparge/i.test(m.use ?? '') && !/lactic/i.test(m.name ?? ''));
  const boilMiscs = miscs.filter((m) => /boil/i.test(m.use ?? ''));
  const mashSteps = recipe.mash?.steps ?? [];
  const fermSteps = recipe.fermentation?.steps ?? [];
  const yeasts = recipe.yeasts ?? [];
  const spargeTempC = recipe.equipment?.spargeTemperature;
  const efficiency = efficiencyFor(recipe, overrides);
  const plan = brewSheetPlanFromRecipe(recipe);
  const mashPhTarget = mashPhTargetFromRecipe(recipe);
  const expectedMashPh = mashPhTarget ? expectedMashPhDisplay(mashPhTarget) : undefined;
  const gravity = c.gravity;
  const preBoilTarget = gravity?.predictedPreBoilGravity;
  const preBoilDisplay = plan.preBoilGravity ?? sg(preBoilTarget);
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
    !plan.fgUnknown && recipe.og !== undefined && recipe.fg != null ? abv(recipe.og, recipe.fg) : undefined;
  const spargeAcidMl = plan.spargeAcidMl ?? c.spargeAcidMl;
  const spargePrepareL = plan.spargePrepareL ?? c.spargeWaterL;
  const packagingSteps = plan.packaging
    ? plan.packaging
        .split(';')
        .map((step) => step.trim())
        .filter(Boolean)
        .map((step) => `${step.charAt(0).toUpperCase()}${step.slice(1)}`)
    : [RULES.purgeKeg, 'Carbonate 2.4 volumes (= 10 PSI at 3 °C)'];
  const whirlpoolContainment = containmentLine(
    'Whirlpool',
    hopContainment(hops.whirlpool),
    'fine-mesh drawstring bags'
  );
  const dryHopContainment = containmentLine(
    'Dry hop',
    hopContainment(hops.dryHop),
    'bags',
    hops.dryHop[0]?.time !== undefined ? `; ${hops.dryHop[0].time}-day contact, open briefly and do not stir` : ''
  );

  let n = 0;
  const next = () => ++n;

  return (
    <ChecklistContext.Provider value={{ values: checklistValues, toggle: toggleChecklist }}>
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
          Brew date {plan.brewDate ? <strong>{plan.brewDate}</strong> : <span className={styles.blank} />}
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
              <tr><th>Target OG</th><td>{plan.targetOg ?? sg(recipe.og)} <Est /></td></tr>
              <tr><th>FG</th><td>{plan.fgUnknown || recipe.fg == null ? 'Unknown' : sg(recipe.fg)}</td></tr>
              {plan.packagedVolume && <tr><th>Expected packaged volume</th><td>{plan.packagedVolume}</td></tr>}
              <tr><th>Target ABV</th><td>{plan.targetAbv ?? (targetAbv === undefined ? 'Unknown' : `${fmt(targetAbv)} %`)} <Est /></td></tr>
              <tr><th>IBU</th><td>{fmt(recipe.ibu, 0)}</td></tr>
              <tr><th>Mash pH TARGET</th><td>{mashPhTarget?.label ?? 'Not recorded in recipe note'}</td></tr>
              <tr><th>Mash pH EXPECTED (meter display)</th><td>{expectedMashPh?.label ?? 'Not recorded in recipe note'}</td></tr>
              <tr className="d-print-none"><th>Predicted OG</th><td>{sg(gravity?.predictedOG)} <Est /> at {fmt(efficiency.efficiencyPct)}%</td></tr>
              <tr><th>Pre-boil gravity</th><td>{preBoilDisplay}</td></tr>
            </tbody>
          </table>
          <p className={styles.small}>pH instrument: {PH_INSTRUMENT.label}; display offset {offsetLabel()} measured {PH_INSTRUMENT.measuredDate}.</p>
          <p className={`${styles.small} d-print-none`}>
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
              <tr><th>Lactic acid 88%</th><td>strike <strong>{fmt(c.strikeAcidMl)} mL</strong> · sparge <strong>{fmt(spargeAcidMl)} mL</strong> {!plan.spargeAcidMl && <Est />}</td></tr>
            </tbody>
          </table>
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
              {field(r.id)}
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.timeline}>
        <h2>Timeline</h2>
        <ol>
          <li>Pitch at {fermSteps[0]?.stepTemp ?? '19–20'} °C; hold days 0–4.</li>
          <li>Dry hop day {hops.dryHop[0]?.day ?? 4}; contact for {hops.dryHop[0]?.time ?? 3} days.</li>
          <li>From ~day 5, allow the fermentation temperature to rise by 2 °C.</li>
          <li>Hold 2–3 days at terminal gravity before crashing or packaging.</li>
        </ol>
      </section>

      <div className={styles.phaseGroup}>
        <div className={styles.phase}><h2>Day before</h2></div>
        <Step n={next()} title="Day before — water and acid">
        <ul className={styles.checklist}>
          <Check>{PH.instrumentStatus}</Check>
          <Check>Collect strike water {fmt(c.strikeWaterL)} L and prepare sparge water {fmt(spargePrepareL)} L{plan.spargeMarkL !== undefined && <>; stop at the {fmt(plan.spargeMarkL)} L mark</>}.</Check>
        </ul>
        {field('untreatedWaterPh')}
        <Warning>{SAFETY.coldTap}</Warning>
        <Warning>{SAFETY.probeStorage}</Warning>
        <Warning>{SAFETY.lacticAcid}</Warning>
        <ul className={styles.checklist}>
          {mashSalts.length > 0 && <Check>Add strike water-treatment additions: {mashSalts.map((m) => `${fmt(m.amount, 2)} ${m.unit} ${m.name}`).join(', ')}.</Check>}
          {spargeSalts.length > 0 && <Check>Add sparge water-treatment additions: {spargeSalts.map((m) => `${fmt(m.amount, 2)} ${m.unit} ${m.name}`).join(', ')}.</Check>}
          <Check>Strike water: <strong>{fmt(c.strikeAcidMl)} mL</strong> lactic acid 88% ({input.hasCrystalOrRoast ? 'grist has crystal/roast' : 'pale grist, no crystal/roast'}).</Check>
          <Check>Sparge water: <strong>{fmt(spargeAcidMl)} mL</strong> lactic acid 88% {!plan.spargeAcidMl && <Est />}.</Check>
        </ul>
        {field('strikeWaterPh')}
        {field('spargeWaterPh')}
        </Step>
      </div>

      <div className={styles.phaseGroup}>
        <div className={styles.phase}><h2>Mash</h2></div>
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
        {field('mashInTemp', <>target {fmt(mashInTempC)} °C</>)}
        </Step>
      </div>

      <Step n={next()} title="Mash pH at 15 minutes">
        <p><strong>TARGET:</strong> {mashPhTarget?.label ?? 'Not recorded in recipe note — record the recipe-specific target before brew day.'}</p>
        <p><strong>EXPECTED (meter display):</strong> {expectedMashPh?.label ?? 'Unknown'}; display offset {offsetLabel()}. {PH.expected}</p>
        {field('mashPh15')}
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
        {field('mashPhCorrected')}
        <ul className={styles.checklist}>
          <Check>{SANITISE_DURING_MASH}</Check>
        </ul>
      </Step>

      <div className={styles.phaseGroup}>
        <div className={styles.phase}><h2>Mash-out, lauter &amp; sparge</h2></div>
        <Step n={next()} title="Sparge water, mash out, lift malt pipe, sparge">
        <ul className={styles.checklist}>
          <Check>
            Prepare {fmt(spargePrepareL)} L
            {plan.spargeMarkL !== undefined && <>; pour to the {fmt(plan.spargeMarkL)} L mark — the mark governs, not the litre count</>}
            {spargeTempC !== undefined && <> to {fmt(spargeTempC)} °C</>}.
          </Check>
        </ul>
        {field('spargePhBeforeUse')}
        <Warning>{SAFETY.maltPipeLift}</Warning>
        <ul className={styles.checklist}>
          <Check>Lift and seat the malt pipe on its supports.</Check>
          <Check>Sparge slowly with the prepared water{plan.spargeMarkL !== undefined && <>; stop at the {fmt(plan.spargeMarkL)} L mark</>}; let it drain fully.</Check>
          {hops.firstWort.map((h, i) => <Check key={i}>First wort hop: {hopLine(h)}</Check>)}
        </ul>
        </Step>
      </div>

      <div className={styles.phaseGroup}>
        <div className={styles.phase}><h2>Boil</h2></div>
        <Step n={next()} title="Pre-boil check — the last point a bad number can be fixed">
        {field('preBoilVolume', <>target {fmt(c.preBoilVolumeL)} L <Est /></>)}
        {field('preBoilGravity', <>target {preBoilDisplay}</>)}
        {field('preBoilDeadspace')}
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
          <p className="d-print-none">{COURSE_CORRECTION.formula}</p>
          <p className={`${styles.small} d-print-none`}>{COURSE_CORRECTION.example}</p>
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
      </div>

      <Step n={next()} title={`Boil — ${input.boilMinutes} min`}>
        {c.boilOverRisk && <>
          <Warning>{SAFETY.boilOver}</Warning>
          <Warning>{SAFETY.boilOverRatio}</Warning>
          <Warning>{SAFETY.vesselLimit}</Warning>
        </>}
        <ul className={styles.checklist}>
            {hops.boil.map((h, i) => (
              <Check key={`h${i}`}>
                {h.time} min: {hopLine(h)}
                {/Cascade/i.test(h.name ?? '') && <> in 2 coarse socks, ~25 g each.</>}
              </Check>
            ))}
            {boilMiscs.map((m, i) => <Check key={`m${i}`}>{miscLine(m)}</Check>)}
          </ul>
      </Step>

      <div className={styles.phaseGroup}>
        <div className={styles.phase}><h2>Whirlpool</h2></div>
        <Step n={next()} title={`Whirlpool — ${WHIRLPOOL_TEMP_C} °C, ${WHIRLPOOL_MINUTES} min`}>
        <Rule>{RULES.whirlpool}</Rule>
        {whirlpoolContainment && <Rule>{whirlpoolContainment}</Rule>}
        <ul className={styles.checklist}>
          <Check>Element off. Chill to {WHIRLPOOL_TEMP_C} °C.</Check>
          {hops.whirlpool.length === 0 && <li className={styles.small}>No whirlpool hops in this recipe.</li>}
          {hops.whirlpool.map((h, i) => <Check key={i}>{hopLine(h)}</Check>)}
        </ul>
        {field('whirlpoolTemp', <>target {WHIRLPOOL_TEMP_C} °C</>)}
        {field('whirlpoolDuration', <>target {WHIRLPOOL_MINUTES} min</>)}
        </Step>
      </div>

      <div className={styles.phaseGroup}>
        <div className={styles.phase}><h2>Chill, transfer, aerate &amp; pitch</h2></div>
        <Step n={next()} title="Chill and transfer">
        <Warning>{SAFETY.transfer}</Warning>
        <Warning>{SAFETY.hotWortSplash}</Warning>
        <ul className={styles.checklist}>
          <Check>Chill to pitch temperature{fermSteps[0]?.stepTemp !== undefined && <> ({fmt(fermSteps[0].stepTemp)} °C)</>}.</Check>
          <Check>Transfer to the sanitised fermenter (sanitised during the mash), sitting below the tap.</Check>
        </ul>
        {field('transferTemp')}
        {field('fermenterVolume', <>target {fmt(input.batchSizeL)} L</>)}
        {field('og', <>target {sg(recipe.og)}</>)}
        </Step>
      </div>

      <Step n={next()} title="Aerate">
        <Rule>{RULES.aeration}</Rule>
        <Warning>{SAFETY.aerationLift}</Warning>
        {field('aeration')}
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
        {field('fermentationTemp')}
        {hops.dryHop.length > 0 && (
          <>
            <h4 className={styles.subhead}>Dry hops</h4>
            <ul className={styles.checklist}>
              {hops.dryHop.map((h, i) => <Check key={i}>Day {h.day ?? '—'}: {hopLine(h)}</Check>)}
            </ul>
          </>
        )}
        {dryHopContainment && <Rule>{dryHopContainment}</Rule>}
      </Step>

      <Step n={next()} title="Finish and package">
        <Rule><strong>⚠ {RULES.terminalHold}</strong></Rule>
        {field('gravityStableDate')}
        {field('fg')}
        <p className={styles.fgWarn}>⚠ {SAFETY.fgInstrument}</p>
        <div className={styles.reading}>
          <span className={styles.readingLabel}>ABV = (R{reading('og').number} − R{reading('fg').number}) × 131.25</span>
          <span className={styles.blank} />
          <span className={styles.unit}>%</span>
        </div>
        <ul className={styles.checklist}>
          <Check>{plan.packaging ?? RULES.purgeKeg}</Check>
        </ul>
      </Step>

      <div className={styles.phaseGroup}>
        <div className={styles.phase}><h2>Cleanup</h2></div>
        <Step n={next()} title="Cleanup">
        <p>{RULES.cleanup}</p>
        </Step>
      </div>

      <div className={styles.phaseGroup}>
        <div className={styles.phase}><h2>After brew day</h2></div>
        <Step n={next()} title="After brew day">
        <ul className={styles.checklist}>
          <Check>Hold {fermSteps[0]?.stepTemp ?? '19–20'} °C days 0–4.</Check>
          <Check>Dry hop day {hops.dryHop[0]?.day ?? 4}: {fmt(sumAmount(hops.dryHop), 0)} g {hops.dryHop[0]?.name ?? 'Citra'}; 3-day contact.</Check>
          <Check>From ~day 5, allow +2 °C to 21–22 °C.</Check>
          <Check>Hold 2–3 days at terminal gravity before crashing or packaging.</Check>
          <Check>Confirm gravity is stable over 48 h.</Check>
          <Check>Cold crash 0–3 °C for 2–5 days if there is space.</Check>
          <Check>Take FG on the Tilt.</Check>
          {packagingSteps.map((step) => <Check key={step}>{step.endsWith('.') ? step : `${step}.`}</Check>)}
        </ul>
        </Step>
      </div>

      <section className={`${styles.step} ${styles.notes}`}>
        <h3>Notes</h3>
        <div className={styles.notesLines} />
      </section>
      </main>
    </ChecklistContext.Provider>
  );
}
