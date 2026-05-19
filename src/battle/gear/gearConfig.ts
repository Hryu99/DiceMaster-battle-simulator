export type EquipmentType = 'weapon' | 'chestarmor' | 'shield' | 'ring'

export type EquipmentRarityId = 'common' | 'rare' | 'epic' | 'legendary'

export type SecondaryStatId =
  | 'baseCritRate'
  | 'baseLifeSteal'
  | 'baseMassAttack'
  | 'baseThorns'
  | 'baseAttackSpeed'
  | 'baseCritDamage'

export const GEAR_CONFIG = {
  playerBase: {
    health: 100,
    attack: 25,
    defence: 10,
    speed: 100,
    critDamage: 150,
  },
  equipmentPrimaryStat: {
    weapon: 'baseAttack',
    chestarmor: 'baseHealth',
    shield: 'baseDefence',
    ring: 'baseGoldMulti',
  } as const satisfies Record<EquipmentType, string>,
  equipmentBaseStats: {
    baseHealth: 40,
    baseAttack: 10,
    baseDefence: 4,
    baseCritRate: 9,
    baseLifeSteal: 8,
    baseMassAttack: 6.5,
    baseThorns: 17,
    baseAttackSpeed: 5,
    baseCritDamage: 20,
  },
  rarityStatsIncreaseCoeff: 1.2,
  rarities: [
    { id: 'common' as const, rarityIndex: 1, secondaryStatCount: 0, weight: 55 },
    { id: 'rare' as const, rarityIndex: 2, secondaryStatCount: 1, weight: 25 },
    { id: 'epic' as const, rarityIndex: 3, secondaryStatCount: 2, weight: 15 },
    { id: 'legendary' as const, rarityIndex: 4, secondaryStatCount: 3, weight: 5 },
  ],
  secondaryStatIds: [
    'baseCritRate',
    'baseLifeSteal',
    'baseMassAttack',
    'baseThorns',
    'baseAttackSpeed',
    'baseCritDamage',
  ] as const satisfies readonly SecondaryStatId[],
  equipmentSlots: ['weapon', 'chestarmor', 'shield', 'ring'] as const satisfies readonly EquipmentType[],
}

export const SECONDARY_BALANCE_TARGET_SPREAD_PERCENT = 5
