import { describe, expect, it } from 'vitest';
import { expectedMashPhDisplay, PH, PH_BRANCHES, PH_INSTRUMENT, phBranch, readingNumber, SAFETY } from './procedure';

describe('mash pH instructions', () => {
  it('uses the NIST buffer calibration instruction', () => {
    expect(PH.instrumentStatus).toBe('Meter calibrated 2026-09-26. Do not recalibrate before brewing. Take readings through the meter display offset.');
  });

  it('keeps the water expectation separate from the recipe target', () => {
    expect(expectedMashPhDisplay({ low: 5.5, high: 5.6 }, PH_INSTRUMENT).label).toBe('5.40–5.55');
    expect(PH.expected).toContain('sample cooled to 20–25 °C');
    expect(PH.provisionalThresholds).toContain('CLOSED 2026-09-26');
  });

  it('keeps every safety string non-empty', () => {
    expect(Object.values(SAFETY).every((text) => text.length > 0)).toBe(true);
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
