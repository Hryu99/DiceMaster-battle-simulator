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

## Вариант B — компонентная сила + мягкая броня (снят)

Offense через `mitigation(referenceArmor)` и масштаб ref от брони героя. Заменён на **D1**.

---

## Вариант D1 — вакуум (принят)

Offense **без** mit цели; defense только от своих HP/брони (бой не меняется):

```text
defenseScore       = (health/H₀)^α × (armor/A₀)^(1−α)   // α+(1−α)=1 → линейный рост при ×t на все статы

offenseHit         = attack
expectedHit        = offenseHit × (1 + critChance × (critDamage − 1) × critEfficiency)
mainDps            = expectedHit × effectiveAttackSpeed
areaDps            = attack × areaAttack × avgExtraTargets × areaEff × effectiveAttackSpeed
thornsScore        = armor × thorns% × refAttackSpeed × thornsEfficiency
sustainMult        = 1 + (mainDps × lifesteal × lsEff) / (mainDps + areaDps + defenseScore / sustainEhpDiv)

displayPower       = defenseScore^wDef × (mainDps + areaDps + thornsScore)^wOff × sustainMult
```

**Плюсы:** нет скрытой «мишени»; +броня не режет offense в силе.  
**Минусы:** сила слабее коррелирует с 1v1 → Stress Lab / матчмейкинг отдельно.

**Реализация:** `src/battle/power.ts`, `BATTLE_CONFIG.power` в `config.ts`.

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

## План после D1

1. Монотонность — `power.test.ts`.
2. Stress Lab @150 / 500 / 1000 — подкрутка `K`, cap, efficiency (без `referenceArmor`).
3. Excel: `npm run export:power-sheet`.

Связано: [power-formula-balance-plan.md](./power-formula-balance-plan.md), [battle-simulator-gdd.md](./battle-simulator-gdd.md).
