/**
 * Боевой и power-конфиг симулятора.
 *
 * Baseline формулы силы (Stress Lab @150, прогон 3 — принят):
 * см. docs/power-formula-balance-plan.md → «Зафиксированный конфиг».
 * Не менять без нового прогона Stress и записи в журнал того же документа.
 */
export const BATTLE_CONFIG = {
  armorDamageConstant: 1, // константа K в формуле снижения урона бронёй
  minDamageMultiplier: 0.05, // минимальная доля входящего урона после брони
  power: {
    averageExtraTargets: 1.5, // среднее число доп. целей для массовой атаки в силе
    opponentScaleAttackWeight: 0.55, // вес атаки в S (масштаб эталонного противника)
    opponentScaleHealthWeight: 0.37, // вес здоровья в S
    opponentScaleArmorWeight: 0.08, // вес брони в S
    minHitImpactMultiplier: 0.75, // нижняя граница множителя удара
    hitImpactEfficiency: 0.5, // чувствительность hit impact к размеру удара
    maxHitImpactMultiplier: 1.6, // верхняя граница множителя удара
    critEfficiency: 0.46, // доля крит-урона, учитываемая в expected hit
    attackSpeedEfficiency: 0.63, // эффективность скорости атаки выше 100%
    areaEfficiency: 1, // эффективность урона по области в effective DPS
    lifestealEfficiency: 0.35, // доля main DPS × lifesteal, идущая в sustain
    thornsEfficiency: 0.83, // множитель ценности шипов в pressure
    sustainEffectiveHealthDivisor: 20, // EHP в знаменателе sustain: слабее, чем DPS
    defensePowerWeight: 0.50, // степень EHP в итоговой силе
    offensePowerWeight: 0.50, // степень pressure в итоговой силе
  },
}
