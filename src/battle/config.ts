export const BATTLE_CONFIG = {
  armorDamageConstant: 1, // константа K в формуле снижения урона бронёй
  minDamageMultiplier: 0.05, // минимальная доля входящего урона после брони
  power: {
    averageExtraTargets: 1.5, // среднее число доп. целей для массовой атаки в силе
    opponentScaleAttackWeight: 0.45, // вес атаки в S (масштаб эталонного противника)
    opponentScaleHealthWeight: 0.35, // вес здоровья в S
    opponentScaleArmorWeight: 0.2, // вес брони в S
    minHitImpactMultiplier: 0.85, // нижняя граница множителя удара
    hitImpactEfficiency: 0.45, // чувствительность hit impact к размеру удара
    maxHitImpactMultiplier: 1.6, // верхняя граница множителя удара
    critEfficiency: 0.65, // доля крит-урона, учитываемая в expected hit
    attackSpeedEfficiency: 0.85, // эффективность скорости атаки выше 100%
    areaEfficiency: 1, // эффективность урона по области в effective DPS
    lifestealEfficiency: 0.35, // доля main DPS × lifesteal, идущая в sustain
    thornsEfficiency: 1.3, // множитель ценности шипов в pressure
    sustainEffectiveHealthDivisor: 20, // EHP в знаменателе sustain: слабее, чем DPS
    defensePowerWeight: 0.45, // степень EHP в итоговой силе
    offensePowerWeight: 0.55, // степень pressure в итоговой силе
  },
}
