# Варианты формулы видимой силы (display power)

Документ фиксирует требования и варианты **силы, которую видит игрок**. Подбор оппонентов и баланс 1v1 могут использовать **отдельную** внутреннюю метрику.

## Требования

| Требование | Пояснение |
| --- | --- |
| Только статы героя | `displayPower(stats)` — константы из `config.ts`, без локации, тира, зеркального врага от билда |
| Стабильность | Смена уровня/арены **не** меняет видимую силу при тех же статах |
| Монотонность | Рост любого стата (в разумных клэмпах) → рост силы |
| Бой отдельно | Симулятор 1v1 может использовать другую логику; точность предсказания win rate может быть ниже |

## Два числа

| | Display power | Match / баланс (лаб, матчмейкинг) |
| --- | --- | --- |
| Вход | статы + фикс. коэффициенты | симуляции, targetPower, MMR и т.д. |
| Для игрока | да | нет (или скрыто) |

---

## Вариант A — облегчённый текущий

- EHP + pressure + sustain, **боевой** `calculateArmorReducedDamage`
- Эталон **всегда** `playerBase` (25 / 10), без tier и без `S(билд)`
- Hit impact от константы или убрать

**Плюсы:** мало изменений.  
**Минусы:** на экстремальной брони EHP раздувается (пол 5% боевой формулы); сила всё ещё завязана на «условного врага».

**Статус:** промежуточный шаг (tier-эталон) — **не** подходит для видимой силы в продукте.

---

## Вариант B — компонентная сила + мягкая броня (принят)

Отдельная модель брони **только для силы** (бой без изменений):

```text
mitigation(armor) = armor / (armor + K)

defenseScore  = health × (1 + armor / K)
offenseHit    = attack × (1 − mitigation(referenceArmor))
expectedHit   = offenseHit × (1 + critChance × (critDamage − 1) × critEfficiency)
mainDps       = expectedHit × effectiveAttackSpeed
areaDps       = attack × areaAttack × (1 − mitigation(referenceArmor)) × avgExtraTargets × areaEff × effectiveAttackSpeed
thornsScore   = armor × thorns% × (1 − mitigation(referenceArmor)) × thornsEfficiency × refAttackSpeed
sustainMult   = 1 + (mainDps × lifesteal × lsEff) / (mainDps + areaDps + defenseScore / sustainEhpDiv)

displayPower  = defenseScore^wDef × (mainDps + areaDps + thornsScore)^wOff × sustainMult
```

- **Нет** эталонного противника от статов героя и **нет** reference tier power в UI.
- `referenceArmor`, `K` — константы в `config.ts`.
- Hit impact **убран** (не про «статы в вакууме»).

**Плюсы:** монотонность, стабильная цифра для игрока, меньше парадоксов atk vs arm.  
**Минусы:** сила хуже совпадает с 1v1 → веса заново через Stress Lab.

**Реализация:** `src/battle/power.ts`, параметры `BATTLE_CONFIG.power` (см. `config.ts`).

---

## Вариант C — аддитивные компоненты

```text
displayPower = defenseScore + offenseScore + sustainScore + thornsScore
```

Каждый score — `stat / (stat + baseline)` с убывающей отдачей.

**Плюсы:** прозрачно для игрока.  
**Минусы:** слабее синергии; дольше подбор весов.

**Статус:** запасной, если B плохо разводит архетипы в лабе.

---

## Вариант D — менять боевую броню

Например `damage = attack × C / (C + armor)` в **симуляторе**.

**Плюсы:** бой и сила ближе.  
**Минусы:** перебаланс всего боя; не для первого шага.

**Статус:** только если после B останутся проблемы в самих боях.

---

## План после внедрения B

1. Property-тесты монотонности по всем статам (`power.test.ts`).
2. Stress Lab @150 / 500 / 1000 — подкрутка `K`, `referenceArmor`, весов `wDef`/`wOff`, efficiency.
3. Excel: `npm run export:power-sheet` (формулы под модель B).
4. GDD — краткая ссылка на этот документ и блок «Расчёт силы».

Связано: [power-formula-balance-plan.md](./power-formula-balance-plan.md), [battle-simulator-gdd.md](./battle-simulator-gdd.md).
