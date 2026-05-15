import { calculatePower } from '../power'
import {
  GEAR_CONFIG,
  SECONDARY_BALANCE_TARGET_SPREAD_PERCENT,
  type EquipmentRarityId,
  type SecondaryStatId,
} from './gearConfig'
import {
  buildCombatantStatsFromGear,
  createNakedHeroStats,
  getRarityById,
  scaleStatByRarity,
  type GearLoadout,
} from './equipment'

export interface SecondaryBalanceEntry {
  statId: SecondaryStatId
  statValue: number
  power: number
  powerDelta: number
  powerDeltaPercent: number
}

export interface SecondaryBalanceReport {
  rarityId: EquipmentRarityId
  rarityIndex: number
  baselinePower: number
  entries: SecondaryBalanceEntry[]
  minPowerDeltaPercent: number
  maxPowerDeltaPercent: number
  spreadPercent: number
  withinTargetSpread: boolean
  targetSpreadPercent: number
}

export function runSecondaryBalanceReport(rarityId: EquipmentRarityId = 'rare'): SecondaryBalanceReport {
  const rarity = getRarityById(rarityId)
  const baselinePower = calculatePower(createNakedHeroStats()).power
  const entries = GEAR_CONFIG.secondaryStatIds.map((statId) => {
    const loadout = createSingleSecondaryLoadout(statId, rarityId)
    const stats = buildCombatantStatsFromGear(loadout)
    const power = calculatePower(stats).power
    const powerDelta = power - baselinePower

    return {
      statId,
      statValue: scaleStatByRarity(GEAR_CONFIG.equipmentBaseStats[statId], rarity.rarityIndex),
      power,
      powerDelta,
      powerDeltaPercent: baselinePower > 0 ? (powerDelta / baselinePower) * 100 : 0,
    }
  })

  const deltaPercents = entries.map((entry) => entry.powerDeltaPercent)
  const minPowerDeltaPercent = Math.min(...deltaPercents)
  const maxPowerDeltaPercent = Math.max(...deltaPercents)
  const spreadPercent = maxPowerDeltaPercent - minPowerDeltaPercent

  return {
    rarityId,
    rarityIndex: rarity.rarityIndex,
    baselinePower,
    entries,
    minPowerDeltaPercent,
    maxPowerDeltaPercent,
    spreadPercent,
    withinTargetSpread: spreadPercent <= SECONDARY_BALANCE_TARGET_SPREAD_PERCENT,
    targetSpreadPercent: SECONDARY_BALANCE_TARGET_SPREAD_PERCENT,
  }
}

function createSingleSecondaryLoadout(statId: SecondaryStatId, rarityId: EquipmentRarityId): GearLoadout {
  const rarity = getRarityById(rarityId)
  const value = scaleStatByRarity(GEAR_CONFIG.equipmentBaseStats[statId], rarity.rarityIndex)

  return {
    pieces: [
      {
        type: 'chestarmor',
        rarityId,
        rarityIndex: rarity.rarityIndex,
        primaryValue: scaleStatByRarity(GEAR_CONFIG.equipmentBaseStats.baseHealth, rarity.rarityIndex),
        secondaries: [{ statId, value }],
      },
    ],
  }
}
