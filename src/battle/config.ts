/**
 * Боевой и power-конфиг симулятора.
 *
 * Видимая сила: модель D1 (вакуум) — только статы героя, без «мишени» в offense.
 * Бой: armorDamageConstant / minDamageMultiplier — отдельно, не меняются ради силы.
 */
export const BATTLE_CONFIG = {
  armorDamageConstant: 1, // K в calculateArmorReducedDamage (только бой)
  minDamageMultiplier: 0.05, // мин. доля урона после брони (только бой)
  power: {
    /** K в defense: min(cap, 1 + armor/K). */
    armorRatingConstant: 60,
    healthDefenseExponent: 0.99,
    averageExtraTargets: 1.5,
    critEfficiency: 0.59,
    attackSpeedEfficiency: 0.70,
    areaEfficiency: 1,
    lifestealEfficiency: 0.38,
    thornsEfficiency: 0.66,
    sustainEffectiveHealthDivisor: 20,
    defensePowerWeight: 0.5,
    offensePowerWeight: 0.5,
  },
}
