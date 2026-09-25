import { describe, expect, it } from 'vitest';
import { createdAt, isEmptyDraft } from './drafts';

// Shape of the two blank recipes Brewfather's app created in Shawn's account.
const brewfatherBlank = {
  _id: 'YbDL6Th8hXGB2bR3zi5vQothX8wb4K',
  name: '',
  author: '',
  type: 'All Grain',
  batchSize: 23,
  boilTime: 60,
  efficiency: 72,
  notes: undefined,
  fermentables: [],
  hops: [],
  yeasts: [],
  miscs: [],
  mash: { name: 'High fermentability', steps: [{ stepTemp: 65, stepTime: 60 }] },
  equipment: { name: 'Default' },
};

describe('isEmptyDraft', () => {
  it('matches a blank recipe from Brewfather, defaults and all', () => {
    expect(isEmptyDraft(brewfatherBlank)).toBe(true);
    expect(isEmptyDraft({ _id: 'x' })).toBe(true);
    expect(isEmptyDraft({ _id: 'x', name: '   ' })).toBe(true);
  });

  it('never matches a recipe with a name, notes or any ingredient', () => {
    expect(isEmptyDraft({ ...brewfatherBlank, name: 'Citra IPA' })).toBe(false);
    expect(isEmptyDraft({ ...brewfatherBlank, notes: 'idea: add oats' })).toBe(false);
    expect(isEmptyDraft({ ...brewfatherBlank, fermentables: [{ name: 'Pale', amount: 5 }] })).toBe(false);
    expect(isEmptyDraft({ ...brewfatherBlank, hops: [{ name: 'Citra' }] })).toBe(false);
    expect(isEmptyDraft({ ...brewfatherBlank, yeasts: [{ name: 'US-05' }] })).toBe(false);
    expect(isEmptyDraft({ ...brewfatherBlank, miscs: [{ name: 'Gypsum' }] })).toBe(false);
  });

  it('never matches the built-in sample recipes', () => {
    expect(isEmptyDraft({ _id: 'sample-empty' })).toBe(false);
  });
});

describe('createdAt', () => {
  it('reads Brewfather timestamps', () => {
    expect(createdAt({ _created: { _seconds: 1774108980 } })?.getTime()).toBe(1774108980 * 1000);
    expect(createdAt({ _timestamp_ms: '1790343306705' as unknown as number })?.getTime()).toBe(1790343306705);
    expect(createdAt({})).toBeUndefined();
  });
});
