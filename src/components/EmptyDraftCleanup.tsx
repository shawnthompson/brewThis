'use client';

import React, { useMemo, useState } from 'react';
import type { BrewfatherRecipe } from '@/types';
import { createdAt, isEmptyDraft } from '@/lib/brewfather/drafts';

type Outcome = { id: string; ok: boolean; message?: string };

// Lists recipes with no name, notes or ingredients (abandoned "New recipe"
// drafts from Brewfather's app) and deletes the selected ones. Each delete is
// re-checked on the server, so a draft filled in meanwhile is kept.
export default function EmptyDraftCleanup({
  recipes,
  onDeleted,
}: {
  recipes: BrewfatherRecipe[];
  onDeleted: (ids: string[]) => void;
}) {
  const drafts = useMemo(() => recipes.filter(isEmptyDraft), [recipes]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);

  if (drafts.length === 0 && outcomes.length === 0) return null;

  const failures = outcomes.filter((o) => !o.ok);

  function review() {
    setSelected(new Set(drafts.map((d) => d._id)));
    setOutcomes([]);
    setOpen(true);
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    setDeleting(true);
    const results: Outcome[] = [];
    // One at a time: Brewfather allows 500 calls/hour, and each delete costs two.
    for (const id of selected) {
      try {
        const response = await fetch(`/api/recipes/${encodeURIComponent(id)}?onlyIfEmptyDraft=1`, { method: 'DELETE' });
        const result = await response.json();
        results.push({ id, ok: !!result.success, message: result.success ? undefined : result.message ?? result.error });
      } catch {
        results.push({ id, ok: false, message: 'Could not reach the server.' });
      }
    }
    setDeleting(false);
    setOutcomes(results);
    setOpen(false);
    const deleted = results.filter((r) => r.ok).map((r) => r.id);
    if (deleted.length > 0) onDeleted(deleted);
  }

  const formatDate = (r: BrewfatherRecipe) =>
    createdAt(r)?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) ?? 'unknown date';

  return (
    <div className="alert alert-warning mb-4" role="region" aria-label="Empty drafts">
      {!open && drafts.length > 0 && (
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span>
            <i className="fas fa-file-circle-exclamation me-2"></i>
            {drafts.length === 1 ? '1 empty draft' : `${drafts.length} empty drafts`} (no name, notes or
            ingredients) in your Brewfather account.
          </span>
          <button type="button" className="btn btn-sm btn-outline-dark ms-auto" onClick={review}>
            Review
          </button>
        </div>
      )}

      {open && (
        <>
          <p className="mb-2">
            These recipes have no name, notes or ingredients. Deleting removes them from Brewfather permanently.
          </p>
          <ul className="list-unstyled mb-3">
            {drafts.map((d) => (
              <li key={d._id} className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`draft-${d._id}`}
                  checked={selected.has(d._id)}
                  onChange={() => toggle(d._id)}
                  disabled={deleting}
                />
                <label className="form-check-label" htmlFor={`draft-${d._id}`}>
                  Untitled draft created {formatDate(d)} <span className="text-muted small">({d._id})</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-sm btn-danger" disabled={selected.size === 0 || deleting} onClick={deleteSelected}>
              {deleting ? 'Deleting…' : `Delete ${selected.size === 1 ? '1 draft' : `${selected.size} drafts`}`}
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={deleting} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      )}

      {!open && outcomes.length > 0 && (
        <p className="mb-0 mt-2 small">
          Deleted {outcomes.length - failures.length} of {outcomes.length}.
          {failures.map((f) => (
            <span key={f.id} className="d-block text-danger">
              {f.id}: {f.message}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
