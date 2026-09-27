'use client';

import React from 'react';
import type { BrewfatherRecipe } from '@/types';
import { brewSheetPlanFromRecipe, hopsByUse, toBrewSheetInput } from '@/lib/brewsheet/fromRecipe';
import { buildRaptProfile, RAPT_END_LABELS, RAPT_TYPE_LABELS, renderRaptProfile, raptAlertTriggerLabel } from '@/lib/rapt/profile';
import { RAPT_SAFETY } from '@/lib/brewsheet/procedure';

export default function RaptProfile({ recipe }: { recipe: BrewfatherRecipe }) {
  const input = toBrewSheetInput(recipe);
  const hops = hopsByUse(recipe);
  const plan = brewSheetPlanFromRecipe(recipe);
  const profile = buildRaptProfile(input, {
    recipeName: recipe.name,
    mashSteps: recipe.mash?.steps,
    boilHops: hops.boil,
    whirlpoolHops: hops.whirlpool,
    miscAdditions: (recipe.miscs ?? []).map((m) => ({ name: m.name, amount: m.amount, unit: m.unit, time: m.time, use: m.use })),
    preBoilGravityTarget: plan.preBoilGravity,
  });

  async function copyProfile() {
    await navigator.clipboard.writeText(renderRaptProfile(profile));
  }

  return (
    <main className="container py-4">
      <div className="d-print-none d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
        <a href={`/recipes/${recipe._id}/brewsheet`} className="btn btn-outline-secondary">Back to brew sheet</a>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-primary" onClick={copyProfile}>Copy profile</button>
          <button type="button" className="btn btn-outline-primary" onClick={() => window.print()}>Print</button>
        </div>
      </div>
      <h1>{profile.name}</h1>
      <p>{profile.description}</p>
      <div className="alert alert-warning" role="note"><strong>Safety:</strong> {RAPT_SAFETY.energisesDevice} {RAPT_SAFETY.boilOverWatch} {RAPT_SAFETY.noHeating}</div>
      <h2 className="h4">Full profile — {profile.steps.length} steps</h2>
      <ol>
        {profile.steps.map((step) => <li key={`${step.name}-${step.targetC}`} className="mb-3"><strong>{step.name}</strong><br />{RAPT_TYPE_LABELS[step.type]} — {step.targetC} °C — {RAPT_END_LABELS[step.endCondition]}{step.durationMinutes ? ` — ${step.durationMinutes} min; timer starts ${step.timerStart}` : ''}{step.alerts.map((alert, index) => <React.Fragment key={`${alert.when}-${index}`}><br /><span>{raptAlertTriggerLabel(alert)} — {alert.message}</span></React.Fragment>)}</li>)}
      </ol>
      <section className="d-print-none mt-4">
        <h2 className="h4">Unverified portal assumptions</h2>
        <ul><li>Whether the portal accepts decimal target temperatures such as 72.2 °C is unverified; do not silently truncate.</li><li>The exact portal handling of a 105 °C unreachable boil setpoint is observed on this rig but remains unverified as a general portal rule.</li><li>Boil-off and grain absorption are unmeasured assumptions. Current notes disagree between 0.80 L/kg and approximately 1.0 L/kg absorption; the app does not resolve that disagreement.</li><li>The recipe&apos;s 52 °C mash rest conflicts with the vault entry sheet and the existing portal profile; this output preserves configured recipe steps but the source discrepancy remains unresolved.</li></ul>
        <h2 className="h4 mt-4">Alternatives report</h2>
        <p><strong>1. Manual authoring handoff — this round.</strong> Lowest risk and exactly what this generator supports: paste the generated profile into the portal once per beer. It needs no credentials or spec change beyond this generator.</p>
        <p><strong>2. Round-trip verification — recommended next.</strong> Read <code>GetProfiles</code>/<code>GetProfile</code>, store a profile id, model the live <code>ProfileModel</code>, and diff only normalized portal fields. Useful, but requires RAPT credentials and a portal export/shape decision. The live Swagger exposes reads but no profile create/save operation.</p>
        <p><strong>3. Webhooks.</strong> A better telemetry read path than polling if the remote receiver and authentication model are acceptable. It would need a public HTTPS endpoint, verification, retention rules, and a new integration boundary; it does not solve profile authoring.</p>
        <p><strong>4. Direct API control — do not build yet.</strong> A dropped network leaves the last setpoint active; <code>SetHeatingUtilisation</code> can command 100% power, with no safety interlock between a bug and a 1500 W element. It would only be acceptable after a fail-safe controller, bounded setpoints, local human confirmation at every heating transition, watchdog shutdown semantics, and disposable-device testing are specified and proven.</p>
        <p><strong>5. Portal import/export or shared global profiles.</strong> Worth checking manually in the portal/app because the Swagger does not describe it. If present, it is preferable to direct control, but its format and sharing semantics are currently unverified.</p>
      </section>
    </main>
  );
}
