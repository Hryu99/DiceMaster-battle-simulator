import {
  GEAR_CONFIG,
  type EquipmentRarityId,
  type EquipmentType,
  type SecondaryStatId,
} from './gearConfig'
import { pickRandom, type RandomSource } from '../rng'
import type { CombatantStats } from '../types'

export interface EquipmentSecondary {
  statId: SecondaryStatId
  value: number
}

export interface EquipmentPiece {
  type: EquipmentType
  rarityId: EquipmentRarityId
  rarityIndex: number
  primaryValue: number | null
  secondaries: EquipmentSecondary[]
}

export interface GearLoadout {
  pieces: EquipmentPiece[]
}

export function roundGearStat(value: number): number {
  if (value < 20) {
    return Math.round(value * 10) / 10
  }

  return Math.round(value)
}

export function scaleStatByRarity(baseStat: number, rarityIndex: number): number {
  const multiplier = Math.pow(GEAR_CONFIG.rarityStatsIncreaseCoeff, rarityIndex - 1)
  return roundGearStat(baseStat * multiplier)
}

export function pickWeightedRarity(rng: RandomSource): (typeof GEAR_CONFIG.rarities)[number] {
  const totalWeight = GEAR_CONFIG.rarities.reduce((sum, rarity) => sum + rarity.weight, 0)
  let roll = rng.next() * totalWeight

  for (const rarity of GEAR_CONFIG.rarities) {
    roll -= rarity.weight
    if (roll <= 0) {
      return rarity
    }
  }

  return GEAR_CONFIG.rarities[GEAR_CONFIG.rarities.length - 1]
}

export function getRarityById(rarityId: EquipmentRarityId) {
  const rarity = GEAR_CONFIG.rarities.find((entry) => entry.id === rarityId)
  if (!rarity) {
    throw new Error(`Unknown rarity: ${rarityId}`)
  }

  return rarity
}

export function pickUniqueSecondaries(count: number, rng: RandomSource): SecondaryStatId[] {
  const pool = [...GEAR_CONFIG.secondaryStatIds]
  const selected: SecondaryStatId[] = []

  for (let index = 0; index < count; index += 1) {
    if (pool.length === 0) {
      break
    }

    const statId = pickRandom(pool, rng)
    selected.push(statId)
    pool.splice(pool.indexOf(statId), 1)
  }

  return selected
}

export function generateEquipmentPiece(
  type: EquipmentType,
  rarityId: EquipmentRarityId,
  rng: RandomSource,
): EquipmentPiece {
  const rarity = getRarityById(rarityId)
  const secondaries = pickUniqueSecondaries(rarity.secondaryStatCount, rng).map((statId) => ({
    statId,
    value: scaleStatByRarity(GEAR_CONFIG.equipmentBaseStats[statId], rarity.rarityIndex),
  }))

  return {
    type,
    rarityId,
    rarityIndex: rarity.rarityIndex,
    primaryValue: getPrimaryValueForPiece(type, rarity.rarityIndex),
    secondaries,
  }
}

export function generateGearLoadout(
  rng: RandomSource,
  options: { fixedRarityId?: EquipmentRarityId } = {},
): GearLoadout {
  const pieces = GEAR_CONFIG.equipmentSlots.map((type) => {
    const rarityId = options.fixedRarityId ?? pickWeightedRarity(rng).id
    return generateEquipmentPiece(type, rarityId, rng)
  })

  return { pieces }
}

export function getPrimaryValueForPiece(type: EquipmentType, rarityIndex: number): number | null {
  if (type === 'weapon') {
    return scaleStatByRarity(GEAR_CONFIG.equipmentBaseStats.baseAttack, rarityIndex)
  }

  if (type === 'chestarmor') {
    return scaleStatByRarity(GEAR_CONFIG.equipmentBaseStats.baseHealth, rarityIndex)
  }

  if (type === 'shield') {
    return scaleStatByRarity(GEAR_CONFIG.equipmentBaseStats.baseDefence, rarityIndex)
  }

  return null
}

export function createNakedHeroStats(): CombatantStats {
  const base = GEAR_CONFIG.playerBase

  return {
    attack: base.attack,
    health: base.health,
    armor: base.defence,
    attackSpeed: base.speed,
    critChance: 0,
    critDamage: base.critDamage,
    lifesteal: 0,
    areaAttack: 0,
    thorns: 0,
  }
}

export function buildCombatantStatsFromGear(loadout: GearLoadout): CombatantStats {
  const stats = createNakedHeroStats()

  for (const piece of loadout.pieces) {
    if (piece.primaryValue !== null) {
      if (piece.type === 'weapon') {
        stats.attack += piece.primaryValue
      } else if (piece.type === 'chestarmor') {
        stats.health += piece.primaryValue
      } else if (piece.type === 'shield') {
        stats.armor += piece.primaryValue
      }
    }

    for (const secondary of piece.secondaries) {
      applySecondaryStat(stats, secondary.statId, secondary.value)
    }
  }

  return stats
}

function applySecondaryStat(stats: CombatantStats, statId: SecondaryStatId, value: number): void {
  switch (statId) {
    case 'baseCritRate':
      stats.critChance += value
      break
    case 'baseLifeSteal':
      stats.lifesteal += value
      break
    case 'baseMassAttack':
      stats.areaAttack += value
      break
    case 'baseThorns':
      stats.thorns += value
      break
    case 'baseAttackSpeed':
      stats.attackSpeed += value
      break
    case 'baseCritDamage':
      stats.critDamage += value
      break
    default:
      break
  }
}

export function describeGearLoadout(loadout: GearLoadout): string {
  return loadout.pieces
    .map((piece) => {
      const primary =
        piece.primaryValue === null ? '—' : `${piece.primaryValue}`
      const secondaryText =
        piece.secondaries.length > 0
          ? piece.secondaries.map((secondary) => `${secondary.statId} ${secondary.value}`).join(', ')
          : '—'

      return `${piece.type} ${piece.rarityId} (p ${primary}; s ${secondaryText})`
    })
    .join(' | ')
}
