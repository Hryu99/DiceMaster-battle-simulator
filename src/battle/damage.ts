import { BATTLE_CONFIG } from './config'

export function calculateArmorReducedDamage(incomingRawDamage: number, targetArmor: number): number {
  if (incomingRawDamage <= 0) return 0

  const rawDamage =
    (incomingRawDamage * BATTLE_CONFIG.armorDamageConstant) /
    (BATTLE_CONFIG.armorDamageConstant + Math.max(0, targetArmor) / incomingRawDamage)
  const minDamage = incomingRawDamage * BATTLE_CONFIG.minDamageMultiplier

  return Math.max(minDamage, rawDamage)
}
