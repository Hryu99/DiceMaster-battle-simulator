/**
 * Боевой и power-конфиг симулятора.
 *
 * Видимая сила: модель B — docs/power-display-formula-options.md
 * Баланс весов: Stress Lab + журнал в docs/power-formula-balance-plan.md
 */
export const BATTLE_CONFIG = {
  armorDamageConstant: 1, // константа K в формуле снижения урона бронёй (только бой)
  minDamageMultiplier: 0.05, // минимальная доля входящего урона после брони (только бой)
  power: {
    /** Модель B: mit = armor / (armor + armorRatingConstant) */
    armorRatingConstant: 50,
    /** Фикс. броня цели для расчёта урона/шипов в силе (не от билда, не от локации) */
    referenceArmorForOffense: 35,
    averageExtraTargets: 1.5,
    critEfficiency: 0.55,
    attackSpeedEfficiency: 0.7,
    areaEfficiency: 1,
    lifestealEfficiency: 0.35,
    thornsEfficiency: 0.83,
    sustainEffectiveHealthDivisor: 20,
    defensePowerWeight: 0.5,
    offensePowerWeight: 0.5,
  },
}
