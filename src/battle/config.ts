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
    armorRatingConstant: 60, // B-stress-2: tank-health 41% — ещё ↓ броня в defenseScore
    /** Степень HP в defenseScore (<1 ослабляет чистые HP-танки). */
    healthDefenseExponent: 0.92,
    /**
     * База для armorScale = max(1, armor / baseline). Только стат героя, не tier локации.
     * ~средняя броня Stress @150; при 288 брони scale≈7 → refArmor и K растут вместе со статами.
     */
    armorScaleBaseline: 40,
    /** K_eff = armorRatingConstant × armorScale^exponent */
    armorContextScaleExponent: 0.65,
    /** Фикс. броня цели при armor = armorScaleBaseline (масштабируется через getPowerArmorContext). */
    referenceArmorForOffense: 29,
    averageExtraTargets: 1.5,
    critEfficiency: 0.59,
    attackSpeedEfficiency: 0.70, // B-stress-2: speed-heavy 45% — слегка ↓ (переоценка)
    areaEfficiency: 1,
    lifestealEfficiency: 0.38,
    thornsEfficiency: 0.66, // B-stress-2: thorns 59% после среза 0.58 — поднять
    sustainEffectiveHealthDivisor: 20,
    defensePowerWeight: 0.4,
    offensePowerWeight: 0.6,
  },
}
