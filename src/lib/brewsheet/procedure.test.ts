import { describe, expect, it } from 'vitest';
import { PH, PH_BRANCHES, phBranch, readingNumber } from './procedure';

describe('mash pH instructions', () => {
  it('uses the NIST buffer calibration instruction', () => {
    expect(PH.calibrate).toBe('Calibrate the pH meter the day before with fresh buffer - two points, NIST set, 6.86 first then 4.00.');
  });

  it('keeps the water expectation separate from the recipe target', () => {
    expect(PH.expectedRange).toBe('5.5–5.6');
    expect(PH.expected).toContain('Expected mash pH 5.5–5.6 on this water');
    expect(PH.provisionalThresholds).toContain('OPEN DECISION');
  });
});

describe('mash pH decision tree', () => {
  // A wording test would not have caught a gap in the old target branches; sweep the values.
  it('matches exactly one branch for every reading from 4.8 to 6.4', () => {
    for (let i = 0; i <= 32; i++) {
      const ph = Math.round((4.8 + i * 0.05) * 100) / 100;
      const matching = PH_BRANCHES.filter((b) => b.matches(ph)).map((b) => b.id);
      expect(matching, `pH ${ph}`).toHaveLength(1);
    }
  });

  it('routes boundary readings to the intended branch', () => {
    expect(phBranch(5.45)?.id).toBe('low');
    expect(phBranch(5.5)?.id).toBe('expected');
    expect(phBranch(5.6)?.id).toBe('expected');
    expect(phBranch(5.65)?.id).toBe('nudge');
    expect(phBranch(5.8)?.id).toBe('nudge');
    expect(phBranch(5.85)?.id).toBe('meterCheck');
    expect(phBranch(6.4)?.id).toBe('meterCheck');
  });

  it('evaluates the 5.8 branch before the 5.6 branch', () => {
    const ids = PH_BRANCHES.map((b) => b.id);
    expect(ids.indexOf('meterCheck')).toBeLessThan(ids.indexOf('nudge'));
  });

  it('points the nudge branch at the right re-measure reading', () => {
    expect(readingNumber('mashPhCorrected')).toBe(6);
    expect(PH_BRANCHES.find((b) => b.id === 'nudge')?.text).toContain('(R6)');
  });
});
