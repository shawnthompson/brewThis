'use client';

import { useState } from 'react';
import type { BrewfatherRecipe } from '@/types';
import { toBrewSheetInput, hopsByUse } from '@/lib/brewsheet/fromRecipe';
import { buildRaptProfile, type RaptProfile as RaptProfileData } from '@/lib/rapt/profile';
import { RAPT_SAFETY } from '@/lib/brewsheet/procedure';

const copyText = (profile: RaptProfileData, merged: boolean) => {
  const steps = merged ? profile.mergedSteps : profile.steps;
  return [profile.name, profile.description, '', ...steps.map((s, i) => `${i + 1}. ${s.name} | ${s.type} | ${s.targetC} °C | ${s.endCondition}${s.durationMinutes ? ` | ${s.durationMinutes} min` : ''}${s.alert ? ` | ${s.alert}` : ''}`)].join('\n');
};

export default function RaptProfile({ recipe }: { recipe: BrewfatherRecipe }) {
  const [merged, setMerged] = useState(false);
  const [copied, setCopied] = useState(false);
  const input = toBrewSheetInput(recipe);
  const hops = hopsByUse(recipe);
  const profile = buildRaptProfile(input, {
    recipeName: recipe.name,
    mashSteps: recipe.mash?.steps,
    boilHops: hops.boil,
    whirlpoolHops: hops.whirlpool,
    miscAdditions: (recipe.miscs ?? []).map((m) => ({ name: m.name, time: m.time, use: m.use })),
  });
  const steps = merged ? profile.mergedSteps : profile.steps;

  async function copyProfile() {
    await navigator.clipboard.writeText(copyText(profile, merged));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="container py-4">
      <div className="d-print-none d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
        <a href={`/recipes/${recipe._id}/brewsheet`} className="btn btn-outline-secondary">Back to brew sheet</a>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-primary" onClick={() => setMerged(!merged)}>{merged ? 'Show full profile' : 'Show ≤6-stage profile'}</button>
          <button type="button" className="btn btn-primary" onClick={copyProfile}>{copied ? 'Copied' : 'Copy profile'}</button>
          <button type="button" className="btn btn-outline-primary" onClick={() => window.print()}>Print</button>
        </div>
      </div>
      <h1>{profile.name}</h1>
      <p>{profile.description}</p>
      <div className="alert alert-warning" role="note"><strong>Safety:</strong> {RAPT_SAFETY.energisesDevice} {RAPT_SAFETY.boilOverWatch} {RAPT_SAFETY.noHeating}</div>
      <h2 className="h4">{merged ? 'Merged profile (≤6 stages)' : 'Full profile'} — {steps.length} steps</h2>
      <ol>
        {steps.map((step) => <li key={`${step.name}-${step.targetC}`} className="mb-3"><strong>{step.name}</strong><br />{step.type === 'heat' ? 'Heat/Cool to target temperature' : 'Gradual ramp to target over length of step'} — {step.targetC} °C — {step.endCondition}{step.durationMinutes ? ` — ${step.durationMinutes} min` : ''}{step.alert && <><br /><span>{step.alert}</span></>}</li>)}
      </ol>
      <section className="d-print-none mt-4">
        <h2 className="h4">Unverified portal assumptions</h2>
        <ul><li>The advertised six programmable stages and any stored-profile cap are unverified.</li><li>Whether a timer starts on target reached, on pressing the device button, or under another portal rule is unverified.</li><li>The minimum accepted target temperature and whether an ambient target reliably disables heating are unverified.</li></ul>
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
