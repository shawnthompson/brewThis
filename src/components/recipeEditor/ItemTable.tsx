'use client';

import React, { useId } from 'react';

// An ingredient or step as Brewfather stores it. Fields the table does not
// show are kept as-is, so editing never strips Brewfather's own data.
export type Item = Record<string, unknown>;

export interface Column {
  key: string;
  label: string;
  kind: 'text' | 'number';
  unit?: string;
  step?: number;
  width?: string;
  suggestions?: string[];
  placeholder?: string; // shown when empty, e.g. the value the calculations assume
}

export default function ItemTable({
  title,
  columns,
  items,
  onChange,
  newItem = {},
}: {
  title: string;
  columns: Column[];
  items: Item[];
  onChange: (items: Item[]) => void;
  newItem?: Item;
}) {
  const listId = useId();

  const update = (index: number, key: string, value: unknown) =>
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <section className="card mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h5 mb-0">{title}</h2>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onChange([...items, { ...newItem }])}>
            <i className="fas fa-plus me-1"></i> Add
          </button>
        </div>

        {columns.map(
          (c) =>
            c.suggestions && (
              <datalist key={c.key} id={`${listId}-${c.key}`}>
                {c.suggestions.map((s) => <option key={s} value={s} />)}
              </datalist>
            )
        )}

        {items.length === 0 ? (
          <p className="text-muted small mb-0">None yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} style={{ width: c.width, minWidth: c.kind === 'number' ? '6.5rem' : '8rem' }} className="small">
                      {c.label}
                      {c.unit && <span className="text-muted fw-normal"> ({c.unit})</span>}
                    </th>
                  ))}
                  <th style={{ width: '7.5rem' }}>
                    <span className="visually-hidden">Row actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    {columns.map((c) => {
                      const value = item[c.key];
                      return (
                        <td key={c.key}>
                          {c.kind === 'number' ? (
                            <input
                              className="form-control form-control-sm"
                              type="number"
                              step="any"
                              min="0"
                              placeholder={c.placeholder}
                              aria-label={`${title} ${index + 1} ${c.label}`}
                              value={typeof value === 'number' ? value : ''}
                              onChange={(e) => update(index, c.key, e.target.value === '' ? undefined : Number(e.target.value))}
                            />
                          ) : (
                            <input
                              className="form-control form-control-sm"
                              list={c.suggestions ? `${listId}-${c.key}` : undefined}
                              aria-label={`${title} ${index + 1} ${c.label}`}
                              value={typeof value === 'string' ? value : ''}
                              onChange={(e) => update(index, c.key, e.target.value)}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="text-end text-nowrap">
                      <button type="button" className="btn btn-sm btn-link px-1" aria-label="Move up" onClick={() => move(index, -1)} disabled={index === 0}>
                        <i className="fas fa-arrow-up"></i>
                      </button>
                      <button type="button" className="btn btn-sm btn-link px-1" aria-label="Move down" onClick={() => move(index, 1)} disabled={index === items.length - 1}>
                        <i className="fas fa-arrow-down"></i>
                      </button>
                      <button type="button" className="btn btn-sm btn-link text-danger px-1" aria-label="Remove" onClick={() => remove(index)}>
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
