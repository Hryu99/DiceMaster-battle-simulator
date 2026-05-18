import { describe, expect, it } from 'vitest'
import { runSecondaryBalanceReport } from './secondaryBalance'

describe('secondaryBalance', () => {
  it('reports secondary-only deltas relative to chest with primary hp only', () => {
    const report = runSecondaryBalanceReport('rare')

    expect(report.entries).toHaveLength(6)
    expect(report.chestOnlyPower).toBeGreaterThan(report.baselinePower)

    for (const entry of report.entries) {
      expect(entry.power).toBeGreaterThanOrEqual(entry.powerDelta + report.baselinePower - 0.01)
      expect(entry.secondaryOnlyDelta).toBeCloseTo(entry.power - report.chestOnlyPower, 5)
    }

    const critDamage = report.entries.find((entry) => entry.statId === 'baseCritDamage')
    expect(critDamage?.secondaryOnlyDeltaPercent).toBeCloseTo(0, 1)
  })
})
