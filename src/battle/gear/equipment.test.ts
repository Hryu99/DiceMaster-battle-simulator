import { describe, expect, it } from 'vitest'
import { GEAR_CONFIG } from './gearConfig'
import {
  buildCombatantStatsFromGear,
  createNakedHeroStats,
  generateEquipmentPiece,
  generateGearLoadout,
  getPrimaryValueForPiece,
  roundGearStat,
  scaleStatByRarity,
} from './equipment'
import { SeededRandom } from '../rng'

describe('equipment', () => {
  it('rounds stats below 20 to one decimal and others to integers', () => {
    expect(roundGearStat(17.28)).toBe(17.3)
    expect(roundGearStat(20.736)).toBe(21)
    expect(roundGearStat(34.56)).toBe(35)
  })

  it('scales legendary primary attack to 4.3', () => {
    expect(getPrimaryValueForPiece('weapon', 4)).toBe(4.3)
  })

  it('does not duplicate secondary stats on one item', () => {
    const piece = generateEquipmentPiece('weapon', 'legendary', new SeededRandom(1))
    const statIds = piece.secondaries.map((secondary) => secondary.statId)

    expect(piece.secondaries).toHaveLength(3)
    expect(new Set(statIds).size).toBe(3)
  })

  it('builds combatant stats from naked hero and gear', () => {
    const loadout = generateGearLoadout(new SeededRandom(2), { fixedRarityId: 'rare' })
    const stats = buildCombatantStatsFromGear(loadout)
    const naked = createNakedHeroStats()

    expect(stats.health).toBeGreaterThan(naked.health)
    expect(stats.attack).toBeGreaterThan(naked.attack)
    expect(stats.armor).toBeGreaterThan(naked.armor)
  })

  it('uses configured player base stats for naked hero', () => {
    const stats = createNakedHeroStats()

    expect(stats).toMatchObject({
      health: GEAR_CONFIG.playerBase.health,
      attack: GEAR_CONFIG.playerBase.attack,
      armor: GEAR_CONFIG.playerBase.defence,
      attackSpeed: GEAR_CONFIG.playerBase.speed,
      critDamage: GEAR_CONFIG.playerBase.critDamage,
    })
  })

  it('applies secondary stat values with rarity scaling', () => {
    const value = scaleStatByRarity(GEAR_CONFIG.equipmentBaseStats.baseCritRate, 2)
    const loadout = {
      pieces: [
        {
          type: 'ring' as const,
          rarityId: 'rare' as const,
          rarityIndex: 2,
          primaryValue: null,
          secondaries: [{ statId: 'baseCritRate' as const, value }],
        },
      ],
    }

    expect(buildCombatantStatsFromGear(loadout).critChance).toBe(value)
  })
})
