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
    /**
     * Доля HP в defenseScore: (HP/H₀)^α × (armor/A₀)^(1−α).
     * α+(1−α)=1 → при пропорциональном росте статов defense растёт линейно, как offense.
     */
    healthDefenseExponent: 0.54,
    averageExtraTargets: 1.5,
    critEfficiency: 0.8,
    attackSpeedEfficiency: 0.70,
    areaEfficiency: 1,
    lifestealEfficiency: 0.4,
    thornsEfficiency: 0.75,
    sustainEffectiveHealthDivisor: 20,
    defensePowerWeight: 0.48,
    offensePowerWeight: 0.52,
  },
}
