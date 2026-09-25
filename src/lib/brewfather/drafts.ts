// Empty drafts: recipes started in Brewfather's app ("New recipe") and never
// touched. Pure; no I/O.
//
// Bulk cleanup deletes these without a typed confirmation, so the test is an
// allowlist: a recipe is an empty draft only if EVERY field is Brewfather
// bookkeeping, a value Brewfather calculates, an untouched new-recipe
// default, or blank. Any other content — including fields this code has
// never seen — means the recipe is kept.
import type { BrewfatherRecipe } from '@/types';
import { isSampleRecipeId } from './recipeInput';
import NEW_RECIPE_DEFAULTS from './brewfatherNewRecipeDefaults.json';

type Json = unknown;
type RecipeRecord = Record<string, Json>;

// Values Brewfather derives from the rest of the recipe, plus account-level
// preferences. They carry no user-authored content of their own.
const CALCULATED_OR_ACCOUNT = new Set([
  'abv', 'attenuation', 'avgWeightedHopstandTemp', 'boilSize', 'buGuRatio', 'color', 'data',
  'extraGravity', 'fermentableIbu', 'fermentablesTotalAmount', 'fg', 'fgEstimated',
  'firstWortGravity', 'hopStandMinutes', 'hopsTotalAmount', 'ibu', 'mashEfficiency', 'nutrition',
  'og', 'ogPlato', 'postBoilGravity', 'preBoilGravity', 'primaryTemp', 'rbRatio', 'styleAbv',
  'styleBuGu', 'styleColor', 'styleConformity', 'styleFg', 'styleIbu', 'styleOg',
  'sumAromaHopPerLiter', 'sumDryHopPerLiter', 'totalGravity', 'yeastToleranceExceededBy',
  'defaults', 'createdAt', 'updatedAt', 'updatedBy',
]);

// Blank means nothing a person wrote: missing, null, empty text, empty list,
// or an object whose values are all blank (e.g. style: { name: '' }).
export function isBlank(value: Json): boolean {
  if (value === undefined || value === null || value === false) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.values(value as RecipeRecord).every(isBlank);
  return false;
}

// Drops Brewfather metadata (keys starting with "_", except _id) and empty
// values so profiles compare on content only.
function normalize(value: Json): Json {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as RecipeRecord)
        .filter(([k, v]) => (k === '_id' || !k.startsWith('_')) && v !== null && v !== undefined)
        .map(([k, v]) => [k, normalize(v)])
    );
  }
  return value;
}

function sameContent(a: Json, b: Json): boolean {
  return JSON.stringify(sortKeys(normalize(a))) === JSON.stringify(sortKeys(normalize(b)));
}

function sortKeys(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as RecipeRecord)
        .sort()
        .map((k) => [k, sortKeys((value as RecipeRecord)[k])])
    );
  }
  return value;
}

// Water varies slightly between app versions in calculated fields, so check
// what a person would change: the source profile, any salt or acid amount,
// or dilution. Numbers inside *Adjustments must all be zero, except an acid's
// concentration, which is a default setting rather than an amount.
function isDefaultWater(water: Json): boolean {
  if (isBlank(water)) return true;
  if (typeof water !== 'object' || Array.isArray(water)) return false;
  const w = water as RecipeRecord;
  if (!isBlank(w.diluted) || !isBlank(w.dilutionPercentage) || (w.dilutionAmount ?? 0) !== 0) return false;

  for (const profile of ['source', 'mash', 'sparge', 'total']) {
    const p = w[profile] as RecipeRecord | undefined;
    if (p !== undefined && p !== null && p._id !== 'default') return false;
  }

  const allZero = (value: Json, key = ''): boolean => {
    if (typeof value === 'number') return key === 'concentration' || value === 0;
    if (Array.isArray(value)) return value.every((v) => allZero(v));
    if (value && typeof value === 'object') {
      return Object.entries(value as RecipeRecord).every(([k, v]) => allZero(v, k));
    }
    return true;
  };
  return Object.entries(w)
    .filter(([k]) => k.endsWith('Adjustments'))
    .every(([, v]) => allZero(v));
}

function isDefaultOrganisation(r: RecipeRecord): boolean {
  const folders = r.folderRefs;
  const inRootFolder =
    isBlank(folders) || (Array.isArray(folders) && folders.length === 1 && folders[0] === 'recipe_root_folder');
  return inRootFolder && (isBlank(r.path) || r.path === '/') && isBlank(r.hidden) && isBlank(r.public);
}

// Recipe-level settings Brewfather fills in for a new recipe.
function hasDefaultSettings(r: RecipeRecord): boolean {
  const equipment = NEW_RECIPE_DEFAULTS.equipment;
  return (
    (isBlank(r.type) || r.type === 'All Grain') &&
    (isBlank(r.fgFormula) || r.fgFormula === 'normal') &&
    (isBlank(r.ibuFormula) || r.ibuFormula === 'tinseth') &&
    (r.carbonation === undefined || r.carbonation === null || r.carbonation === 2.4) &&
    (r.batchSize === undefined || r.batchSize === equipment.batchSize) &&
    (r.boilTime === undefined || r.boilTime === equipment.boilTime) &&
    (r.efficiency === undefined || r.efficiency === equipment.efficiency)
  );
}

const PROFILE_FIELDS = ['equipment', 'mash', 'fermentation'] as const;
const CHECKED_ELSEWHERE = new Set([
  ...PROFILE_FIELDS, 'water', 'folderRefs', 'path', 'hidden', 'public',
  'type', 'fgFormula', 'ibuFormula', 'carbonation', 'batchSize', 'boilTime', 'efficiency',
]);

export function isEmptyDraft(recipe: Partial<BrewfatherRecipe>): boolean {
  const r = recipe as unknown as RecipeRecord;
  if (typeof r._id === 'string' && isSampleRecipeId(r._id)) return false;

  for (const field of PROFILE_FIELDS) {
    if (!isBlank(r[field]) && !sameContent(r[field], NEW_RECIPE_DEFAULTS[field])) return false;
  }
  if (!isDefaultWater(r.water) || !isDefaultOrganisation(r) || !hasDefaultSettings(r)) return false;

  // Everything else — name, notes, author, style, tags, ingredients, and any
  // field not listed above — must be blank.
  return Object.entries(r).every(
    ([key, value]) =>
      key.startsWith('_') || CALCULATED_OR_ACCOUNT.has(key) || CHECKED_ELSEWHERE.has(key) || isBlank(value)
  );
}

// Brewfather timestamps come as { _seconds } or epoch milliseconds (sometimes a string).
export function createdAt(recipe: Partial<BrewfatherRecipe> & { _created?: { _seconds?: number } }): Date | undefined {
  if (recipe._created?._seconds !== undefined) return new Date(recipe._created._seconds * 1000);
  const ms = Number(recipe._timestamp_ms);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms) : undefined;
}
