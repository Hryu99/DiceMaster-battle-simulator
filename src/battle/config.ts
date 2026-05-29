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
    armorRatingConstant: 82, // B-stress-2: tank-health 41% — ещё ↓ броня в defenseScore
    /** Степень HP в defenseScore (<1 ослабляет чистые HP-танки). */
    healthDefenseExponent: 0.92,
    /** Фикс. броня цели для расчёта урона/шипов в силе (не от билда, не от локации) */
    referenceArmorForOffense: 29, // B-stress-2: attack-heavy 58% — ↑ offense
    averageExtraTargets: 1.5,
    critEfficiency: 0.59,
    attackSpeedEfficiency: 0.72, // B-stress-2: speed-heavy 45% — слегка ↓ (переоценка)
    areaEfficiency: 1,
    lifestealEfficiency: 0.38,
    thornsEfficiency: 0.66, // B-stress-2: thorns 59% после среза 0.58 — поднять
    sustainEffectiveHealthDivisor: 20,
    defensePowerWeight: 0.4,
    offensePowerWeight: 0.6,
  },
}
