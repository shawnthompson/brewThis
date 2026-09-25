import { describe, expect, it } from 'vitest';
import type { BrewfatherRecipe } from '@/types';
import { createdAt, isBlank, isEmptyDraft } from './drafts';
import draftV3 from './__fixtures__/emptyDraft.json';
import draftV2 from './__fixtures__/emptyDraftV2.json';
import calibration from './__fixtures__/calibrationRecipes.json';

// The two untouched "New recipe" drafts Brewfather's app created in Shawn's
// account (app versions 3.1.0 and 2.20.2), exactly as the API returned them.
const draft = draftV3 as unknown as BrewfatherRecipe;
const clone = (): Record<string, any> => JSON.parse(JSON.stringify(draft)); // eslint-disable-line @typescript-eslint/no-explicit-any

describe('isEmptyDraft — real Brewfather drafts', () => {
  it('matches both untouched drafts, from two app versions', () => {
    expect(isEmptyDraft(draft)).toBe(true);
    expect(isEmptyDraft(draftV2 as unknown as BrewfatherRecipe)).toBe(true);
  });

  it('never matches a real recipe', () => {
    for (const { recipe } of Object.values(calibration as Record<string, { recipe: object }>)) {
      expect(isEmptyDraft({ _id: 'r', name: '', ...recipe } as BrewfatherRecipe)).toBe(false);
    }
  });

  it('never matches the built-in sample recipes', () => {
    expect(isEmptyDraft({ _id: 'sample-empty' })).toBe(false);
  });
});

// PR #5 review: any user-authored content must keep the recipe.
describe('isEmptyDraft — any user content keeps the recipe', () => {
  const cases: [string, (r: Record<string, any>) => void][] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
    ['name', (r) => (r.name = 'Citra IPA')],
    ['notes', (r) => (r.notes = 'idea: add oats')],
    ['author', (r) => (r.author = 'Shawn')],
    ['description / teaser', (r) => (r.teaser = 'A crisp pale ale')],
    ['a field this code has never seen', (r) => (r.description = 'Hazy, juicy')],
    ['tags', (r) => (r.tags = ['summer'])],
    ['style', (r) => (r.style = { name: 'American IPA' })],
    ['a fermentable', (r) => (r.fermentables = [{ name: 'Pale', amount: 5 }])],
    ['a hop', (r) => (r.hops = [{ name: 'Citra' }])],
    ['a yeast', (r) => (r.yeasts = [{ name: 'US-05' }])],
    ['a misc', (r) => (r.miscs = [{ name: 'Gypsum' }])],
    ['a changed mash step', (r) => (r.mash.steps[0].stepTemp = 67)],
    ['an added mash step', (r) => r.mash.steps.push({ stepTemp: 78, stepTime: 10, type: 'Temperature' })],
    ['a changed fermentation step', (r) => (r.fermentation.steps[0].stepTemp = 19)],
    ['a customised equipment value', (r) => (r.equipment.trubChillerLoss = 2)],
    ['a different equipment profile', (r) => (r.equipment._id = 'YG7JfXFk9Var8Vpfm4LTgqxeJsSrlu')],
    ['a water salt addition', (r) => (r.water.mashAdjustments.calciumSulfate = 3.8)],
    ['a water acid addition', (r) => (r.water.mashAdjustments.acids[0].amount = 2)],
    ['a chosen water source', (r) => (r.water.source._id = 'montreal')],
    ['water dilution', (r) => (r.water.dilutionAmount = 5)],
    ['a folder', (r) => (r.folderRefs = ['my-ipas'])],
    ['hidden', (r) => (r.hidden = true)],
    ['a changed batch size', (r) => (r.batchSize = 19)],
    ['a changed boil time', (r) => (r.boilTime = 90)],
    ['a changed efficiency', (r) => (r.efficiency = 76)],
    ['a changed recipe type', (r) => (r.type = 'BIAB')],
  ];

  for (const [what, change] of cases) {
    it(`keeps a draft with ${what}`, () => {
      const r = clone();
      change(r);
      expect(isEmptyDraft(r as BrewfatherRecipe)).toBe(false);
    });
  }
});

describe('isBlank', () => {
  it('treats missing, empty and all-blank objects as blank', () => {
    for (const v of [undefined, null, false, '', '  ', [], {}, { name: '' }]) expect(isBlank(v)).toBe(true);
    for (const v of ['x', 0, 1, true, ['a'], { name: 'IPA' }]) expect(isBlank(v)).toBe(false);
  });
});

describe('createdAt', () => {
  it('reads Brewfather timestamps', () => {
    expect(createdAt({ _created: { _seconds: 1774108980 } })?.getTime()).toBe(1774108980 * 1000);
    expect(createdAt({ _timestamp_ms: '1790343306705' as unknown as number })?.getTime()).toBe(1790343306705);
    expect(createdAt({})).toBeUndefined();
  });
});
