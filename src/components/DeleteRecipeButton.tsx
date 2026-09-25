'use client';

import React, { useState } from 'react';
import type { BrewfatherRecipe } from '@/types';

// Deleting in Brewfather cannot be undone from this app, so the name must be
// typed to confirm.
export default function DeleteRecipeButton({
  recipe,
  onDeleted,
}: {
  recipe: BrewfatherRecipe;
  onDeleted: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = recipe.name?.trim() || 'Untitled';
  const matches = typed.trim() === name;

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/recipes/${encodeURIComponent(recipe._id)}`, { method: 'DELETE' });
      const result = await response.json();
      if (!result.success) {
        setError([result.error, result.message].filter(Boolean).join(': '));
        setDeleting(false);
        return;
      }
      onDeleted(recipe._id);
    } catch {
      setError('Could not reach the server.');
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="btn btn-outline-danger" onClick={() => setConfirming(true)}>
        <i className="fas fa-trash me-2"></i>
        Delete
      </button>
    );
  }

  return (
    <div className="w-100 border border-danger rounded p-2 mb-2">
      <p className="mb-2 small">
        This permanently deletes <strong>{name}</strong> from Brewfather. Type the recipe name to confirm.
      </p>
      <div className="d-flex flex-wrap gap-2">
        <input
          className="form-control form-control-sm"
          style={{ maxWidth: '20rem' }}
          aria-label="Type the recipe name to confirm deletion"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
        />
        <button type="button" className="btn btn-sm btn-danger" disabled={!matches || deleting} onClick={remove}>
          {deleting ? 'Deleting…' : 'Delete permanently'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={deleting}
          onClick={() => {
            setConfirming(false);
            setTyped('');
            setError(null);
          }}
        >
          Keep recipe
        </button>
      </div>
      {error && <p className="text-danger small mb-0 mt-2">{error}</p>}
    </div>
  );
}
