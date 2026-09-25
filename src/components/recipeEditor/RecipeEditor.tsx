'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BrewfatherRecipe } from '@/types';
import { FALLBACK_POTENTIAL } from '@/lib/brewsheet/calculations';
import ItemTable, { type Column, type Item } from './ItemTable';

// Suggestions only: inputs accept any text so existing Brewfather values survive.
const RECIPE_TYPES = ['All Grain', 'BIAB', 'Partial Mash', 'Extract'];

const FERMENTABLE_COLUMNS: Column[] = [
  { key: 'name', label: 'Name', kind: 'text', width: '30%' },
  { key: 'type', label: 'Type', kind: 'text', suggestions: ['Grain', 'Adjunct', 'Sugar', 'Extract', 'Dry Extract', 'Liquid Extract'] },
  { key: 'amount', label: 'Amount', unit: 'kg', kind: 'number', step: 0.01 },
  { key: 'color', label: 'Colour', unit: 'SRM', kind: 'number', step: 0.1 },
  // Blank potential is calculated as FALLBACK_POTENTIAL; the placeholder says so.
  { key: 'potential', label: 'Potential', unit: 'SG', kind: 'number', step: 0.001, placeholder: String(FALLBACK_POTENTIAL) },
];

const HOP_COLUMNS: Column[] = [
  { key: 'name', label: 'Name', kind: 'text', width: '22%' },
  { key: 'use', label: 'Use', kind: 'text', suggestions: ['Boil', 'First Wort', 'Mash', 'Aroma', 'Dry Hop'] },
  { key: 'amount', label: 'Amount', unit: 'g', kind: 'number', step: 1 },
  { key: 'time', label: 'Time', unit: 'min', kind: 'number', step: 1 },
  { key: 'day', label: 'Dry hop day', kind: 'number', step: 1 },
  { key: 'alpha', label: 'Alpha', unit: '%', kind: 'number', step: 0.1 },
  { key: 'type', label: 'Form', kind: 'text', suggestions: ['Pellet', 'Leaf', 'Plug', 'Extract'] },
];

const YEAST_COLUMNS: Column[] = [
  { key: 'name', label: 'Name', kind: 'text', width: '20%' },
  { key: 'laboratory', label: 'Lab', kind: 'text' },
  { key: 'type', label: 'Type', kind: 'text', suggestions: ['Ale', 'Lager', 'Hybrid'] },
  { key: 'form', label: 'Form', kind: 'text', suggestions: ['Dry', 'Liquid'] },
  { key: 'amount', label: 'Amount', kind: 'number', step: 0.5 },
  { key: 'unit', label: 'Unit', kind: 'text', suggestions: ['pkg', 'ml', 'g'] },
  { key: 'attenuation', label: 'Attenuation', unit: '%', kind: 'number', step: 1 },
];

const MISC_COLUMNS: Column[] = [
  { key: 'name', label: 'Name', kind: 'text', width: '25%' },
  { key: 'type', label: 'Type', kind: 'text', suggestions: ['Water Agent', 'Fining', 'Spice', 'Herb', 'Flavor', 'Other'] },
  { key: 'use', label: 'Use', kind: 'text', suggestions: ['Mash', 'Sparge', 'Boil', 'Primary', 'Secondary', 'Bottling'] },
  { key: 'amount', label: 'Amount', kind: 'number', step: 0.01 },
  { key: 'unit', label: 'Unit', kind: 'text', suggestions: ['g', 'ml', 'items', 'tsp', 'tbsp'] },
  { key: 'time', label: 'Time', unit: 'min', kind: 'number', step: 1 },
];

const MASH_COLUMNS: Column[] = [
  { key: 'name', label: 'Name', kind: 'text', width: '30%' },
  { key: 'type', label: 'Type', kind: 'text', suggestions: ['Temperature', 'Infusion', 'Decoction'] },
  { key: 'stepTemp', label: 'Temp', unit: '°C', kind: 'number', step: 0.1 },
  { key: 'stepTime', label: 'Time', unit: 'min', kind: 'number', step: 1 },
];

const FERMENTATION_COLUMNS: Column[] = [
  { key: 'type', label: 'Stage', kind: 'text', width: '30%', suggestions: ['Primary', 'Secondary', 'Conditioning', 'Cold Crash'] },
  { key: 'stepTemp', label: 'Temp', unit: '°C', kind: 'number', step: 0.5 },
  { key: 'stepTime', label: 'Time', unit: 'days', kind: 'number', step: 1 },
];

interface Draft {
  name: string;
  type: string;
  author: string;
  notes: string;
  batchSize?: number;
  boilTime?: number;
  efficiency?: number;
  fermentables: Item[];
  hops: Item[];
  yeasts: Item[];
  miscs: Item[];
  mashSteps: Item[];
  fermentationSteps: Item[];
}

const asItems = (list: unknown): Item[] => (Array.isArray(list) ? list.map((x) => ({ ...x })) : []);

function toDraft(recipe?: BrewfatherRecipe): Draft {
  return {
    name: recipe?.name ?? '',
    type: recipe?.type ?? 'All Grain',
    author: recipe?.author ?? '',
    notes: recipe?.notes ?? '',
    batchSize: recipe?.batchSize,
    boilTime: recipe ? recipe.boilTime : 60,
    efficiency: recipe?.efficiency,
    fermentables: asItems(recipe?.fermentables),
    hops: asItems(recipe?.hops),
    yeasts: asItems(recipe?.yeasts),
    miscs: asItems(recipe?.miscs),
    mashSteps: asItems(recipe?.mash?.steps),
    fermentationSteps: asItems(recipe?.fermentation?.steps),
  };
}

// Rows the user added but never filled in are dropped; blank values are removed
// so Brewfather keeps no empty strings.
function cleanItems(items: Item[], columns: Column[]): Item[] {
  return items
    .filter((item) => columns.some((c) => item[c.key] !== undefined && item[c.key] !== ''))
    .map((item) =>
      Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined && v !== ''))
    );
}

function toPayload(draft: Draft, original?: BrewfatherRecipe) {
  const payload: Record<string, unknown> = {
    name: draft.name.trim(),
    type: draft.type,
    author: draft.author,
    notes: draft.notes,
    fermentables: cleanItems(draft.fermentables, FERMENTABLE_COLUMNS),
    hops: cleanItems(draft.hops, HOP_COLUMNS),
    yeasts: cleanItems(draft.yeasts, YEAST_COLUMNS),
    miscs: cleanItems(draft.miscs, MISC_COLUMNS),
    // Keep the rest of Brewfather's mash/fermentation profile; replace the steps.
    mash: { ...(original?.mash ?? {}), steps: cleanItems(draft.mashSteps, MASH_COLUMNS) },
    fermentation: {
      ...(original?.fermentation ?? {}),
      steps: cleanItems(draft.fermentationSteps, FERMENTATION_COLUMNS),
    },
  };
  if (draft.batchSize !== undefined) payload.batchSize = draft.batchSize;
  if (draft.boilTime !== undefined) payload.boilTime = draft.boilTime;
  if (draft.efficiency !== undefined) payload.efficiency = draft.efficiency;
  return payload;
}

const numberOrUndefined = (value: string) => (value === '' ? undefined : Number(value));

export default function RecipeEditor({ recipe }: { recipe?: BrewfatherRecipe }) {
  const router = useRouter();
  const isNew = !recipe;
  const initial = useMemo(() => toDraft(recipe), [recipe]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ title: string; message?: string; conflict?: boolean } | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (draft.name.trim() === '') {
      setError({ title: 'Recipe name is required' });
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const payload = toPayload(draft, recipe);
      const response = isNew
        ? await fetch('/api/recipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/recipes/${encodeURIComponent(recipe._id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipe: payload,
              baseVersion: recipe._rev ?? (recipe._timestamp_ms !== undefined ? String(recipe._timestamp_ms) : ''),
            }),
          });
      const result = await response.json();

      if (!result.success) {
        setError({ title: result.error ?? 'Save failed', message: result.message, conflict: response.status === 409 });
        setSaving(false);
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError({ title: 'Save failed', message: 'Could not reach the server.' });
      setSaving(false);
    }
  }

  return (
    <main className="container py-4" style={{ maxWidth: 1100 }}>
      <form onSubmit={save}>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h1 className="h3 mb-0">{isNew ? 'New recipe' : `Edit: ${recipe.name}`}</h1>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => router.push('/')}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || (!isNew && !dirty)}>
              {saving ? 'Saving…' : isNew ? 'Create in Brewfather' : 'Save to Brewfather'}
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            <strong>{error.title}</strong>
            {error.message && <div>{error.message}</div>}
            {error.conflict && (
              <button type="button" className="btn btn-sm btn-outline-danger mt-2" onClick={() => window.location.reload()}>
                Reload latest version (discards your changes)
              </button>
            )}
          </div>
        )}

        <section className="card mb-3">
          <div className="card-body">
            <h2 className="h5">Basics</h2>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="name">Name *</label>
                <input id="name" className="form-control" required maxLength={200} value={draft.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="type">Type</label>
                <input id="type" className="form-control" list="recipe-types" value={draft.type} onChange={(e) => set('type', e.target.value)} />
                <datalist id="recipe-types">{RECIPE_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="author">Author</label>
                <input id="author" className="form-control" value={draft.author} onChange={(e) => set('author', e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label" htmlFor="batchSize">Batch size (L, into fermenter)</label>
                <input id="batchSize" className="form-control" type="number" step="any" min="1" max="100" value={draft.batchSize ?? ''} onChange={(e) => set('batchSize', numberOrUndefined(e.target.value))} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label" htmlFor="boilTime">Boil time (min)</label>
                <input id="boilTime" className="form-control" type="number" step="1" min="0" max="240" value={draft.boilTime ?? ''} onChange={(e) => set('boilTime', numberOrUndefined(e.target.value))} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label" htmlFor="efficiency">Efficiency (%)</label>
                <input id="efficiency" className="form-control" type="number" step="any" min="1" max="100" value={draft.efficiency ?? ''} onChange={(e) => set('efficiency', numberOrUndefined(e.target.value))} />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="notes">Notes</label>
                <textarea id="notes" className="form-control" rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
              </div>
            </div>
          </div>
        </section>

        <ItemTable title="Fermentables" columns={FERMENTABLE_COLUMNS} items={draft.fermentables} onChange={(v) => set('fermentables', v)} newItem={{ type: 'Grain' }} />
        <ItemTable title="Hops" columns={HOP_COLUMNS} items={draft.hops} onChange={(v) => set('hops', v)} newItem={{ use: 'Boil', type: 'Pellet' }} />
        <ItemTable title="Yeast" columns={YEAST_COLUMNS} items={draft.yeasts} onChange={(v) => set('yeasts', v)} newItem={{ type: 'Ale', form: 'Dry', unit: 'pkg' }} />
        <ItemTable title="Water agents & other additions" columns={MISC_COLUMNS} items={draft.miscs} onChange={(v) => set('miscs', v)} newItem={{ unit: 'g' }} />
        <ItemTable title="Mash steps" columns={MASH_COLUMNS} items={draft.mashSteps} onChange={(v) => set('mashSteps', v)} newItem={{ type: 'Temperature' }} />
        <ItemTable title="Fermentation steps" columns={FERMENTATION_COLUMNS} items={draft.fermentationSteps} onChange={(v) => set('fermentationSteps', v)} newItem={{ type: 'Primary' }} />
      </form>
    </main>
  );
}
