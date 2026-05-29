/**
 * Generates docs/power-calculator-sheet.csv for RU/EU Excel locale:
 * - field separator: semicolon (;)
 * - decimal separator: comma (,)
 * - formula argument separator: semicolon (;)
 *
 * Row numbers in formulas are assigned automatically (see R.* at end of export log).
 *
 * Run: npm run export:power-sheet
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BATTLE_CONFIG } from '../src/battle/config.ts'
import { GEAR_CONFIG } from '../src/battle/gear/gearConfig.ts'
import {
  calculatePower,
  calculatePowerDefenseScore,
  calculatePowerEffectiveDamage,
  getPowerArmorContext,
  getPowerReferenceProfile,
} from '../src/battle/power.ts'
import type { CombatantStats } from '../src/battle/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '../docs/power-calculator-sheet.csv')
const FIELD_SEP = ';'

type CsvRow = [string, string, string, string]

/** Стартовые статы в блоке «ВВОД СТАТОВ» и для сверки в колонке D. */
const DEFAULT_SHEET_HERO_STATS: CombatantStats = {
  attack: 60,
  health: 200,
  armor: 30,
  attackSpeed: 100,
  critChance: 0,
  critDamage: 150,
  lifesteal: 0,
  areaAttack: 0,
  thorns: 0,
}

/** Номера строк на листе (строка 1 = заголовок CSV). */
const R: Record<string, number> = {}

let sheetRow = 1
let rows: CsvRow[] = []

function n(value: number): string {
  return String(value).replace('.', ',')
}

function b(row: number): string {
  return `B${row}`
}

function $(row: number): string {
  return `$B$${row}`
}

function escapeCsvField(value: string): string {
  if (/[";\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function rowToCsvLine(cells: string[]): string {
  return cells.map(escapeCsvField).join(FIELD_SEP)
}

/** Текстовые колонки C/D: не начинать с «=», иначе Excel воспримет как формулу. */
function safeTextColumn(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('=')) {
    return `примечание: ${trimmed.slice(1).trim()}`
  }

  return trimmed
}

const ROW_KEYS = new Set([
  'attack',
  'health',
  'armor',
  'speed',
  'critChance',
  'critDamage',
  'lifesteal',
  'area',
  'thorns',
  'cfgArmorK',
  'cfgMinDmg',
  'cfgPlayerBaseAtk',
  'cfgPlayerBaseHp',
  'cfgPlayerBaseDef',
  'cfgPlayerBaseSpd',
  'cfgAvgExtraTargets',
  'cfgPowerArmorK',
  'cfgArmScaleBase',
  'cfgArmCtxExp',
  'cfgHealthDefExp',
  'cfgRefArmor',
  'armorScale',
  'armorRatingEff',
  'refArmorEff',
  'cfgCritEff',
  'cfgAtkSpdEff',
  'cfgAreaEff',
  'cfgLsEff',
  'cfgThornsEff',
  'cfgSustainEhpDiv',
  'cfgDefW',
  'cfgOffW',
  'normAtk',
  'normHp',
  'normArm',
  'normSpd',
  'normCritC',
  'normCritD',
  'normLs',
  'normArea',
  'normTh',
  'mitRef',
  'defenseScore',
  'mainHit',
  'expectedHit',
  'effSpd',
  'dps',
  'areaHit',
  'areaDps',
  'offensePressure',
  'sustain',
  'sustainMult',
  'thornsRaw',
  'thornsHit',
  'thornsValue',
  'power',
])

function addRow(label: string, value: string, note = '', fourth = '', fifth?: string): number {
  let check = ''
  let key: string | undefined

  if (fifth !== undefined) {
    check = fourth
    key = fifth
  } else if (ROW_KEYS.has(fourth)) {
    key = fourth
  } else {
    check = fourth
  }

  sheetRow += 1
  rows.push([label, value, safeTextColumn(note), safeTextColumn(check)])
  if (key) {
    R[key] = sheetRow
  }

  return sheetRow
}

/** Модель B: mit = armor / (armor + K_eff) */
function powerMitigationFormula(armorExpr: string, ratingRow: number): string {
  const wrapped = armorExpr.startsWith('(') ? armorExpr : `(${armorExpr})`
  return `=${wrapped}/(${wrapped}+${b(ratingRow)})`
}

/** attack × (1 − mit(refArmorEff)) с K_eff */
function powerDamageFormula(attackExpr: string): string {
  const atk = attackExpr.startsWith('(') ? attackExpr : `(${attackExpr})`
  const mit = powerMitigationFormula(b(R.refArmorEff), R.armorRatingEff)
  return `=IF(${atk}<=0;0;${atk}*(1-${mit.slice(1)}))`
}

function buildRows(): CsvRow[] {
  rows = []
  sheetRow = 1
  const p = BATTLE_CONFIG.power

  addRow('DiceMaster — калькулятор силы', '', '')
  addRow(
    'Импорт: Excel/Таблицы, локаль RU. Разделитель полей «;», в формулах «;» и дробная «,».',
    '',
    '',
  )
  addRow('', '', '')
  addRow('—— ВВОД СТАТОВ (меняй значения) ——', '', '')

  addRow('Attack', String(DEFAULT_SHEET_HERO_STATS.attack), '', 'attack')
  addRow('Health', String(DEFAULT_SHEET_HERO_STATS.health), '', 'health')
  addRow('Armor', String(DEFAULT_SHEET_HERO_STATS.armor), '', 'armor')
  addRow('Attack Speed, %', '100', '100 = базовая скорость', 'speed')
  addRow('Crit Chance, %', '0', '', 'critChance')
  addRow('Crit Damage, %', '150', '150 = ×1,5 урона на крите', 'critDamage')
  addRow('Lifesteal, %', '0', '', 'lifesteal')
  addRow('Mass Attack (area), %', '0', '', 'area')
  addRow('Thorns, %', '0', '', 'thorns')
  addRow('', '', '')

  addRow('—— БОЙ (только симулятор, не сила) ——', '', '')
  addRow(
    'armorDamageConstant (бой)',
    n(BATTLE_CONFIG.armorDamageConstant),
    'K в calculateArmorReducedDamage',
    'cfgArmorK',
  )
  addRow(
    'minDamageMultiplier (бой)',
    n(BATTLE_CONFIG.minDamageMultiplier),
    'мин. доля урона после брони в бою',
    'cfgMinDmg',
  )
  addRow('', '', '')
  addRow('—— КОНФИГ СИЛЫ, модель B ——', '', 'docs/power-display-formula-options.md')
  addRow(
    'armorRatingConstant (K)',
    n(p.armorRatingConstant),
    'mit = armor / (armor + K)',
    'cfgPowerArmorK',
  )
  addRow(
    'healthDefenseExponent',
    n(p.healthDefenseExponent),
    'степень HP в defenseScore (1 = линейно)',
    'cfgHealthDefExp',
  )
  addRow(
    'armorScaleBaseline',
    n(p.armorScaleBaseline),
    'armorScale = max(1; armor/baseline); только стат героя',
    'cfgArmScaleBase',
  )
  addRow(
    'armorContextScaleExponent',
    n(p.armorContextScaleExponent),
    'K_eff = K × armorScale^exp',
    'cfgArmCtxExp',
  )
  addRow(
    'referenceArmorForOffense (при scale=1)',
    n(p.referenceArmorForOffense),
    'refArmorEff = это × armorScale',
    'cfgRefArmor',
  )
  addRow(
    'averageExtraTargets',
    n(p.averageExtraTargets),
    'среднее число доп. целей для массовой атаки в силе',
    'cfgAvgExtraTargets',
  )
  addRow('critEfficiency', n(p.critEfficiency), 'доля крит-урона, учитываемая в expected hit', 'cfgCritEff')
  addRow(
    'attackSpeedEfficiency',
    n(p.attackSpeedEfficiency),
    'эффективность скорости атаки выше 100%',
    'cfgAtkSpdEff',
  )
  addRow('areaEfficiency', n(p.areaEfficiency), 'эффективность урона по области в effective DPS', 'cfgAreaEff')
  addRow(
    'lifestealEfficiency',
    n(p.lifestealEfficiency),
    'доля main DPS × lifesteal, идущая в sustain',
    'cfgLsEff',
  )
  addRow('thornsEfficiency', n(p.thornsEfficiency), 'множитель ценности шипов', 'cfgThornsEff')
  addRow(
    'playerBaseSpeed (шипы)',
    n(GEAR_CONFIG.playerBase.speed / 100),
    'множитель скорости для thorns в силе',
    'cfgPlayerBaseSpd',
  )
  addRow(
    'sustainEffectiveHealthDivisor',
    n(p.sustainEffectiveHealthDivisor),
    'defenseScore в знаменателе sustain',
    'cfgSustainEhpDiv',
  )
  addRow('defensePowerWeight', n(p.defensePowerWeight), 'степень defenseScore в силе', 'cfgDefW')
  addRow('offensePowerWeight', n(p.offensePowerWeight), 'степень offense в силе', 'cfgOffW')
  addRow('', '', '')

  addRow('—— НОРМАЛИЗАЦИЯ (как normalizeStats) ——', '', '')
  addRow('atk', `=MAX(0;${b(R.attack)})`, '', 'normAtk')
  addRow('hp', `=MAX(1;${b(R.health)})`, '', 'normHp')
  addRow('arm', `=MAX(0;${b(R.armor)})`, '', 'normArm')
  addRow('spd', `=MAX(${n(0.05)};${b(R.speed)}/100)`, '', 'normSpd')
  addRow('critC', `=MIN(1;MAX(0;${b(R.critChance)}/100))`, '', 'normCritC')
  addRow('critD', `=MAX(1;${b(R.critDamage)}/100)`, '', 'normCritD')
  addRow('ls', `=MIN(1;MAX(0;${b(R.lifesteal)}/100))`, '', 'normLs')
  addRow('area', `=MIN(1;MAX(0;${b(R.area)}/100))`, '', 'normArea')
  addRow('th', `=MAX(0;${b(R.thorns)}/100)`, '', 'normTh')
  addRow('', '', '')

  addRow('—— РАСЧЁТ (модель B) ——', '', 'колонка D — сверка с Node')
  addRow(
    'armorScale',
    `=MAX(1;${b(R.normArm)}/${$(R.cfgArmScaleBase)})`,
    'масштаб от брони героя (не tier локации)',
    '',
    'armorScale',
  )
  addRow(
    'armorRatingEff (K_eff)',
    `=${$(R.cfgPowerArmorK)}*POWER(${b(R.armorScale)};${$(R.cfgArmCtxExp)})`,
    'K для mit и defense',
    '',
    'armorRatingEff',
  )
  addRow(
    'refArmorEff',
    `=${$(R.cfgRefArmor)}*${b(R.armorScale)}`,
    'броня цели в offense/thorns',
    '',
    'refArmorEff',
  )
  addRow(
    'mitigation(refArmorEff)',
    powerMitigationFormula(b(R.refArmorEff), R.armorRatingEff),
    'доля поглощения при расчёте урона',
    '',
    'mitRef',
  )
  addRow(
    'defenseScore',
    `=POWER(${b(R.normHp)};${$(R.cfgHealthDefExp)})*(1+${b(R.normArm)}/${b(R.armorRatingEff)})`,
    'выживаемость: HP^exp × (1 + armor/K_eff)',
    '',
    'defenseScore',
  )
  addRow(
    'mainHit (power armor)',
    powerDamageFormula(b(R.normAtk)),
    'атака × (1 − mit(refArmor))',
    '',
    'mainHit',
  )
  addRow(
    'expectedHitDamage',
    `=${b(R.mainHit)}*(1+${b(R.normCritC)}*(${b(R.normCritD)}-1)*${$(R.cfgCritEff)})`,
    'средний удар с критом (expected)',
    '',
    'expectedHit',
  )
  addRow(
    'effectiveAttackSpeed',
    `=MAX(1E-9;1+(${b(R.normSpd)}-1)*${$(R.cfgAtkSpdEff)})`,
    'скорость атаки >100% с коэфф.',
    '',
    'effSpd',
  )
  addRow('dps (main)', `=${b(R.expectedHit)}*${b(R.effSpd)}`, 'main DPS', '', 'dps')
  addRow(
    'areaHit (power armor)',
    powerDamageFormula(`${b(R.normAtk)}*${b(R.normArea)}`),
    'area через mit(refArmor)',
    '',
    'areaHit',
  )
  addRow(
    'areaDps',
    `=${b(R.areaHit)}*${$(R.cfgAvgExtraTargets)}*${$(R.cfgAreaEff)}*${b(R.effSpd)}`,
    'вклад area в давление',
    '',
    'areaDps',
  )
  addRow('offensePressure', `=${b(R.dps)}+${b(R.areaDps)}`, 'main + area DPS', '', 'offensePressure')
  addRow('sustain (только от main dps)', `=${b(R.dps)}*${b(R.normLs)}*${$(R.cfgLsEff)}`, 'хил только от обычной атаки', '', 'sustain')
  addRow(
    'sustainMultiplier',
    `=1+${b(R.sustain)}/MAX(1;${b(R.offensePressure)}+${b(R.defenseScore)}/${$(R.cfgSustainEhpDiv)})`,
    'множитель силы от lifesteal',
    '',
    'sustainMult',
  )
  addRow('thornsRaw', `=${b(R.normArm)}*${b(R.normTh)}`, 'сырой урон шипов', '', 'thornsRaw')
  addRow('thornsHit (power armor)', powerDamageFormula(b(R.thornsRaw)), 'шипы vs refArmor', '', 'thornsHit')
  addRow(
    'thornsValue',
    `=${b(R.thornsHit)}*${$(R.cfgPlayerBaseSpd)}*${$(R.cfgThornsEff)}`,
    'шипы в pressure',
    '',
    'thornsValue',
  )
  addRow(
    'offenseScore',
    `=${b(R.offensePressure)}+${b(R.thornsValue)}`,
    'DPS + area + thorns',
    '',
    'offenseScore',
  )
  addRow(
    'СИЛА (power)',
    `=POWER(${b(R.defenseScore)};${$(R.cfgDefW)})*POWER(${b(R.offenseScore)};${$(R.cfgOffW)})*${b(R.sustainMult)}`,
    'defense^wDef × offense^wOff × sustain',
    '',
    'power',
  )

  return rows
}

function statsFromSheetDefaults(): CombatantStats {
  return { ...DEFAULT_SHEET_HERO_STATS }
}

function attachValidationChecks(): void {
  const stats = statsFromSheetDefaults()
  const breakdown = calculatePower(stats)
  const reference = getPowerReferenceProfile()
  const mitRef =
    reference.armor / (reference.armor + BATTLE_CONFIG.power.armorRatingConstant)

  for (const row of rows) {
    if (row[0] === 'mitigation(referenceArmor)') {
      row[3] = n(Number(mitRef.toFixed(4)))
    }
    if (row[0] === 'defenseScore') {
      row[3] = n(Number(breakdown.effectiveHealth.toFixed(4)))
    }
    const ctx = getPowerArmorContext(stats.armor)
    if (row[0] === 'armorRatingEff (K_eff)') {
      row[3] = n(Number(ctx.armorRating.toFixed(4)))
    }
    if (row[0] === 'refArmorEff') {
      row[3] = n(Number(ctx.referenceArmor.toFixed(4)))
    }
    if (row[0] === 'mainHit (power armor)') {
      row[3] = n(
        Number(
          calculatePowerEffectiveDamage(stats.attack, ctx.referenceArmor, ctx.armorRating).toFixed(4),
        ),
      )
    }
    if (row[0] === 'СИЛА (power)') {
      row[3] = n(Number(breakdown.power.toFixed(4)))
    }
    if (row[0] === 'dps (main)') {
      row[3] = n(Number(breakdown.dps.toFixed(4)))
    }
  }
}

function main(): void {
  buildRows()
  attachValidationChecks()

  const header = rowToCsvLine(['Параметр', 'Значение / формула', 'Пояснение', 'Сверка (код)'])
  const body = rows.map((r) => rowToCsvLine(r))

  const csv = [header, ...body].join('\n') + '\n'
  writeFileSync(OUT_PATH, csv, 'utf8')

  const examplePower = calculatePower(statsFromSheetDefaults()).power
  console.log(`Wrote ${OUT_PATH}`)
  console.log(
    `Пример (${DEFAULT_SHEET_HERO_STATS.attack}/${DEFAULT_SHEET_HERO_STATS.health}/${DEFAULT_SHEET_HERO_STATS.armor}): power ≈ ${n(Number(examplePower.toFixed(2)))}`,
  )
  console.log(
    `Ключевые строки: defenseScore B${R.defenseScore}, mainHit B${R.mainHit}, СИЛА B${R.power}`,
  )
}

main()
