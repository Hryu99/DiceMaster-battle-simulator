# План балансировки формулы силы

Документ фиксирует порядок работ после изменений формулы `calculatePower` и параметров в `src/battle/config.ts` (эталонный противник, веса EHP/pressure, sustain, hit impact и т.д.).

Связанные материалы:

- [battle-simulator-gdd.md](./battle-simulator-gdd.md) — описание формулы и Power Lab
- [gear-realistic-power-lab-plan.md](./gear-realistic-power-lab-plan.md) — генерация через экипировку
- [power-sheet-import.md](./power-sheet-import.md) — Excel-калькулятор для ручной проверки

## Цель

Не выровнять абсолютное число силы у всех билдов, а добиться:

**при близкой расчётной силе win rate в 1v1 ≈ 50%** на большой выборке.

Абсолютный масштаб силы вторичен. Важна предсказуемость исхода боя по силе.

## Общий цикл

```text
1. Stress Lab @ targetPower 150 (фиксированный seed) → tag summaries, top winners/losers
2. Подкрутить 1–2 параметра config.ts → повторить с тем же seed
3. Stress Lab @ 500 и @ 1000 → проверка масштабирования тиров
4. Secondary balance → базовые значения secondary в gearConfig
5. Gear Realistic Lab (с/без фильтра по силе) → реалистичные перекосы
6. Ручные якоря + Excel-калькулятор → точечная проверка «почему сила такая»
```

---

## Этап 1: Formula Stress Lab (широкий, абстрактный)

**Где:** Power Lab → режим **Stress Lab** (`runPowerLab`).

**Зачем:** быстро найти системные перекосы **в самой формуле** (крит, скорость, танк, sustain, thorns) без шума от лута и правил экипировки.

### Параметры запуска (стартовые)

| Параметр | Значение | Комментарий |
| --- | ---: | --- |
| `targetPower` | 150 | База диапазонов генерации в `powerLab.ts` |
| `tolerancePercent` | 5 | Отбор билдов ±5% от целевой силы |
| `candidateCount` | 5000 | Можно увеличить для стабильнее статистики |
| `selectedBuildCount` | 40 | Размер матрицы 1v1 |
| `roundsPerPair` | 100 | Снижает шум крита и коротких боёв |
| `seed` | фиксировать | Один и тот же seed при сравнении до/после правок |

### Несколько тиров силы

Повторить этап 1 с `targetPower`:

- **150** — базовый тир
- **500**
- **1000**

При другом `targetPower` масштабируются атака/HP/броня кандидатов и `enemyArmorScale = targetPower / 150` в расчёте силы. Нужно убедиться, что перекосы не появляются только на высоких тирах.

### На что смотреть в отчёте

1. **Overall average win rate** по выборке — в среднем около 50% (разброс по отдельным билдам нормален).
2. **Tag summaries** — главный сигнал по архетипам:
   - средний win rate тега **> ~55%** → формула, скорее всего, **недооценивает** этот тип (или механика сильнее модели);
   - **< ~45%** → **переоценивает**.
3. **Top winners / top losers** — какие статы у билдов, которые «обманывают» формулу при равной силе.
4. **Baseline выборки:**
   - `Ref Arm` — броня условного врага в формуле;
   - `Arm/Ref Arm` — средняя броня билдов к эталону;
   - `A/Ref Arm` — атака к эталону.  
   Если `Arm/Ref Arm` системно >> 1 на всех тирах — возможно, занижена база эталона; если растёт только на 500/1000 — смотреть масштабирование.
5. **Диагностики по тегам** (`Hit/Ref`, `Hit x`, `EHP`, `DPS`, `EHP/DPS`) — понять, *что* крутить в конфиге, а не только «добавить 0.05 к весу».

### Что крутить в первую очередь (`src/battle/config.ts`)

| Группа | Параметры |
| --- | --- |
| Итоговая геометрия | `defensePowerWeight`, `offensePowerWeight` |
| Урон / темп | `critEfficiency`, `attackSpeedEfficiency`, `hitImpactEfficiency`, `minHitImpactMultiplier`, `maxHitImpactMultiplier` |
| Sustain | `lifestealEfficiency`, `sustainEffectiveHealthDivisor` |
| Ответный урон | `thornsEfficiency` |
| Area (только в формуле) | `areaEfficiency`, `averageExtraTargets` |
| Эталонный противник | `opponentScaleAttackWeight`, `opponentScaleHealthWeight`, `opponentScaleArmorWeight` |

Правило итерации: **1–2 параметра за проход** → тот же `seed` → сравнить tag summaries.

### Ограничения Stress Lab

- В генерации **`areaAttack = 0`** — массовая атака в формуле **не проверяется** этим режимом.
- Бои только **1v1**; в бою area может бить ту же цель — расхождение формулы и симулятора для MA учитывать отдельно.
- Команды и фокус целей (thorns) в 1v1 упрощены.

---

## Этап 2: Gear Realistic Lab (узкий, игровой)

**Где:** Power Lab → режим **Gear Realistic Lab** (`runGearRealisticPowerLab`).

**Зачем:** Stress даёт комбинации статов, которых в игре не бывает. После выравнивания формулы — проверка на **достижимых** билдах (голый герой + 4 слота по `gearConfig`).

### Порядок прогонов

1. **Без фильтра по силе** (`targetPower = null`) — общий разброс, перекосы редкостей и удачных роллов secondary.
2. **С фильтром по `targetPower`** — аналог Stress, но только реалистичные билды в коридоре силы.

### На что смотреть

- Те же **архетипы** (`attack-heavy`, `sustain`, …), что в Stress.
- **Gear-теги** (`epic-set`, `mixed-rarity`, …) — перекос внутри правил лута.

### Интерпретация

| Stress | Gear | Вероятная причина |
| --- | --- | --- |
| ровно | криво | `equipmentBaseStats`, веса редкости, secondary — не формула |
| криво | криво | сначала `config.ts`, потом gear |
| ровно | ровно | формула и базовые secondary в порядке на текущих вводных |

---

## Этап 3: Secondary balance

**Где:** Power Lab → режим **Secondary balance**.

**Зачем:** разные `baseCritRate`, `baseLifeSteal`, `baseMassAttack` и т.д. должны давать **сопоставимый прирост силы** на одном предмете одной редкости (ориентир из GDD: разброс **5–10%** между secondary одной редкости).

**Когда:** после грубой настройки формулы на Stress, **до** финальных выводов из Gear Lab по «какой стат сильнее». Иначе смешиваются ошибки формулы и ошибки базовых значений в `gearConfig.equipmentBaseStats`.

---

## Этап 4: Ручные якоря

Помимо лабораторий — несколько **фиксированных** пар в основном симуляторе или через Excel (`npm run export:power-sheet`):

| Якорь | Назначение |
| --- | --- |
| Зеркало `playerBase` (25 / 100 / 10) | Базовая линия эталона |
| Рабочий пример (например 60 / 200 / 30) | Типичный прогресс героя |
| Чистый DPS (высокая атака, мало EHP) | Не завышает ли формула offense |
| Чистый танк (HP + броня) | Не завышает ли defense |
| Heavy lifesteal / heavy thorns | Sustain и thorns в бою vs в формуле |

Ожидание: **сила близка → win rate ~50% ± шум**. Если якоря хорошие, а Stress кривой — смотреть диапазоны генерации; если якоря кривые — формула.

---

## Критерии «достаточно сбалансировано» (рабочие ориентиры)

Не жёсткие правила, а ориентиры для итераций:

| Метрика | Ориентир |
| --- | --- |
| Средний win rate всей выборки Stress | 48–52% |
| Средний win rate тега (если билдов с тегом ≥ 5) | 45–55% |
| Отдельный билд в top winners при силе в коридоре | разобрать вручную; не обязательно чинить один outlier |
| Secondary balance (одна редкость) | разброс прироста силы ≤ 10% между статами |

При сомнении увеличить `roundsPerPair` или `candidateCount`, а не сразу менять много коэффициентов.

---

## Известные расхождения (не путать с «плохой формулой»)

| Факт | Следствие |
| --- | --- |
| Stress: `areaAttack = 0` | MA в формуле не калибруется Stress |
| 1v1: area бьёт ту же цель | В Gear с MA реальный бой может быть сильнее, чем даёт формула |
| Крит, короткие серии | Нужен достаточный `roundsPerPair` |
| Сумма сил команд ≠ баланс 2v2 / 3v3 | Отдельная проверка, если понадобится |

Для MA: отдельный прогон (расширить Stress с `areaAttack > 0`) или осознанно балансировать по Gear Lab и зафиксировать ограничение в GDD.

---

## Чеклист перед закрытием итерации

- [x] Stress @ 150, tag summaries в коридоре 45–55% (прогон 3, см. журнал ниже)
- [ ] Stress @ 500 и @ 1000 без новых системных перекосов
- [ ] Secondary balance: разброс в целевом диапазоне
- [ ] Gear Lab без фильтра и с фильтром по силе — нет доминирующих архетипов
- [ ] Ручные якоря: win rate ~50% при близкой силе
- [ ] Зафиксировать в GDD или комментариях config итоговые коэффициенты и известные ограничения (MA, 1v1)

---

## История изменений формулы (кратко)

При старте плана уже сделано:

- Эталонный противник через масштаб `S` от статов героя (`opponentScale*` веса), `refIncoming` / `refEnemyArmor` от scaled opponent
- Параметры вынесены в `config.ts` (в т.ч. `sustainEffectiveHealthDivisor`)
- Excel-калькулятор с подсказками в колонке C

---

## Журнал Stress Lab @150

Общие настройки UI для всех прогонов ниже (если не указано иное):

| Параметр | Значение |
| --- | ---: |
| `targetPower` | 150 |
| `tolerancePercent` | 5 |
| `candidateCount` | 5000 |
| `selectedBuildCount` | 80 |
| `roundsPerPair` | 100 |
| Режим | Formula Stress Lab |

**Следующий шаг:** тот же `seed`, что в прогоне 3, для @500 и @1000.

### Прогон 1 (исходный после смены формулы)

Конфиг силы: `defense/offense` 0,45/0,55; `critEfficiency` 0,65; `attackSpeedEfficiency` 0,85; `opponentScale*` 0,45 / 0,35 / 0,2; `thornsEfficiency` 1,3; `minHitImpact` 0,85. (`armorDamageConstant` ещё мог быть 3.)

| Тег | Win rate | N |
| --- | ---: | ---: |
| tank-armor | **70,2%** | 31 |
| tank-health | **61,7%** | 27 |
| thorns | **60,9%** | 27 |
| attack-heavy | 51,0% | 29 |
| sustain | 50,8% | 36 |
| crit-heavy | 44,8% | 41 |
| speed-heavy | 42,5% | 45 |

Baseline: Arm/Ref Arm **1,84**, A/Ref Arm **2,18**, EHP/DPS **8,2**.

**Вывод:** системное недооценение танков/шипов, переоценение speed/crit.

### Прогон 2

Изменения: `defense/offense` **0,50 / 0,50**; `critEfficiency` **0,55**; `attackSpeedEfficiency` **0,70**; `armorDamageConstant` **1** (бой + формула урона).

| Тег | Win rate | N |
| --- | ---: | ---: |
| tank-armor | **62,1%** | 25 |
| sustain | 52,0% | 35 |
| crit-heavy | 49,4% | 33 |
| speed-heavy | 48,9% | 32 |
| attack-heavy | 47,0% | 24 |
| thorns | 46,8% | 21 |
| tank-health | **41,6%** | 29 |

Baseline: Arm/Ref Arm **1,69**, EHP/DPS **10,25**.

**Вывод:** DPS-архетипы выровнялись; tank-armor ещё высокий; tank-health перекос в другую сторону; остаются аутлаеры «подушек» (низкий Hit/Ref, гигантский EHP).

### Прогон 3 — **принят как baseline @150**

Изменения относительно прогона 2: `opponentScale*` **0,55 / 0,37 / 0,08**; `minHitImpactMultiplier` **0,75**; `hitImpactEfficiency` **0,5**; `critEfficiency` **0,46**; `attackSpeedEfficiency` **0,63**; `thornsEfficiency` **0,83**.

| Тег | Win rate | N |
| --- | ---: | ---: |
| sustain | **50,8%** | 33 |
| crit-heavy | **49,9%** | 37 |
| thorns | **48,2%** | 24 |
| tank-health | **48,1%** | 30 |
| speed-heavy | **47,5%** | 31 |
| tank-armor | **46,7%** | 28 |
| attack-heavy | **45,2%** | 28 |
| balanced | 69,3% | 1 (не учитывать) |

Размах по тегам (без `balanced`): **5,6 п.п.** (45,2% → 50,8%).

Отчёт: Avg power **149,9**; Arm/Ref Arm **2,04**; A/Ref Arm **2,38**; Ref Arm **22,2**; baseline EHP/DPS **11,47**; DPS/EHP **0,194**.

**Известные аутлаеры (не блокируют этап 1):**

- Завышение силы: «подушки» (A ≈ 16–29, EHP/DPS > 20, WR &lt; 30%), напр. билд 1377 — WR **5,6%** при силе 150.
- Занижение силы: отдельные glass / low-HP crit (DPS/EHP &gt; 0,3), напр. билды 1902, 2518.
- Топ winners: HP + crit + sustain (burst в бою при умеренном DPS в формуле).

**Этап 1 (@150) закрыт.** Идти на Stress @500 и @1000 с конфигом из следующей секции.

---

## Зафиксированный конфиг (прогон 3)

Источник истины в коде: `src/battle/config.ts`. При расхождении с таблицей верить файлу.

### `BATTLE_CONFIG` (боевой урон)

| Параметр | Значение |
| --- | ---: |
| `armorDamageConstant` | **1** |
| `minDamageMultiplier` | 0,05 |

### `BATTLE_CONFIG.power` (формула силы)

| Параметр | Значение |
| --- | ---: |
| `averageExtraTargets` | 1,5 |
| `opponentScaleAttackWeight` | **0,55** |
| `opponentScaleHealthWeight` | **0,37** |
| `opponentScaleArmorWeight` | **0,08** |
| `minHitImpactMultiplier` | **0,75** |
| `hitImpactEfficiency` | **0,5** |
| `maxHitImpactMultiplier` | 1,6 |
| `critEfficiency` | **0,46** |
| `attackSpeedEfficiency` | **0,63** |
| `areaEfficiency` | 1 |
| `lifestealEfficiency` | 0,35 |
| `thornsEfficiency` | **0,83** |
| `sustainEffectiveHealthDivisor` | 20 |
| `defensePowerWeight` | **0,50** |
| `offensePowerWeight` | **0,50** |

### Снимок для копирования (как в `config.ts`)

```ts
export const BATTLE_CONFIG = {
  armorDamageConstant: 1,
  minDamageMultiplier: 0.05,
  power: {
    averageExtraTargets: 1.5,
    opponentScaleAttackWeight: 0.55,
    opponentScaleHealthWeight: 0.37,
    opponentScaleArmorWeight: 0.08,
    minHitImpactMultiplier: 0.75,
    hitImpactEfficiency: 0.5,
    maxHitImpactMultiplier: 1.6,
    critEfficiency: 0.46,
    attackSpeedEfficiency: 0.63,
    areaEfficiency: 1,
    lifestealEfficiency: 0.35,
    thornsEfficiency: 0.83,
    sustainEffectiveHealthDivisor: 20,
    defensePowerWeight: 0.50,
    offensePowerWeight: 0.50,
  },
}
```

`gearConfig.ts` / `playerBase` в этих прогонах не менялись (attack 25, health 100, defence 10, speed 100).

После правок конфига: `npm run export:power-sheet` — обновить Excel, если сверяешь формулы вручную.

Дальнейшие правки баланса — новая строка в журнале + при необходимости обновление этой секции и комментария в `config.ts`.
