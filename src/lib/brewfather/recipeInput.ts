// Validates recipe writes before they reach Brewfather. Pure; no I/O.
import type { BrewfatherRecipe } from '@/types';

// The only top-level fields the app may write. Everything else (style,
// water, equipment, Brewfather's calculated values and `_` fields) is left
// as Brewfather stores it: PATCH preserves fields it is not sent.
export const EDITABLE_FIELDS = [
  'name',
  'type',
  'author',
  'notes',
  'batchSize',
  'boilTime',
  'efficiency',
  'fermentables',
  'hops',
  'yeasts',
  'miscs',
  'mash',
  'fermentation',
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];
export type RecipeWrite = Partial<Pick<BrewfatherRecipe, EditableField>>;

const NUMBER_LIMITS: Record<string, [number, number]> = {
  batchSize: [1, 100],
  boilTime: [0, 240],
  efficiency: [1, 100],
};

const ARRAY_FIELDS = ['fermentables', 'hops', 'yeasts', 'miscs'] as const;
const STEP_FIELDS = ['mash', 'fermentation'] as const;

export class RecipeInputError extends Error {}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Ingredient and step fields the editor sets. Other fields on an existing
// item are Brewfather's own and pass through untouched.
const EDITED_NUMBER_FIELDS = [
  'amount', 'time', 'day', 'alpha', 'color', 'potential', 'attenuation',
  'minTemp', 'maxTemp', 'stepTemp', 'stepTime',
];

function checkNumbers(item: Record<string, unknown>, where: string) {
  for (const key of EDITED_NUMBER_FIELDS) {
    const value = item[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new RecipeInputError(`${where}: ${key} must be a number of zero or more`);
    }
  }
}

function checkItems(items: unknown, where: string) {
  if (!Array.isArray(items)) throw new RecipeInputError(`${where} must be a list`);
  items.forEach((item, i) => {
    if (!isPlainObject(item)) throw new RecipeInputError(`${where} ${i + 1} must be an object`);
    if (typeof item.name === 'string' && item.name.length > 200) {
      throw new RecipeInputError(`${where} ${i + 1}: name is too long`);
    }
    checkNumbers(item, `${where} ${i + 1}`);
  });
}

/**
 * Checks a create or update body and returns only the editable fields.
 * `requireName` is set for create: Brewfather needs at least a name.
 */
export function parseRecipeWrite(body: unknown, { requireName }: { requireName: boolean }): RecipeWrite {
  if (!isPlainObject(body)) throw new RecipeInputError('Recipe must be a JSON object');

  const unknown = Object.keys(body).filter((k) => !(EDITABLE_FIELDS as readonly string[]).includes(k));
  if (unknown.length > 0) {
    throw new RecipeInputError(`Fields not editable here: ${unknown.join(', ')}`);
  }

  if (body.name !== undefined || requireName) {
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      throw new RecipeInputError('Recipe name is required');
    }
    if (body.name.length > 200) throw new RecipeInputError('Recipe name is too long');
  }

  for (const key of ['type', 'author', 'notes'] as const) {
    if (body[key] !== undefined && typeof body[key] !== 'string') {
      throw new RecipeInputError(`${key} must be text`);
    }
  }

  for (const [key, [min, max]] of Object.entries(NUMBER_LIMITS)) {
    const value = body[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new RecipeInputError(`${key} must be a number from ${min} to ${max}`);
    }
  }

  for (const key of ARRAY_FIELDS) {
    if (body[key] !== undefined) checkItems(body[key], key);
  }

  for (const key of STEP_FIELDS) {
    const value = body[key];
    if (value === undefined) continue;
    if (!isPlainObject(value)) throw new RecipeInputError(`${key} must be an object`);
    if (value.steps !== undefined) checkItems(value.steps, `${key} step`);
  }

  const result: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) result[key] = key === 'name' ? (body.name as string).trim() : body[key];
  }
  return result as RecipeWrite;
}

// Sample recipes shown when the account is empty are not in Brewfather.
export function isSampleRecipeId(id: string): boolean {
  return id.startsWith('sample-');
}
