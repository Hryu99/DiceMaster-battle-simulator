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
import { calculateArmorReducedDamage } from '../src/battle/damage.ts'
import {
  calculatePower,
  getReferenceOpponentScale,
  getScaledReferenceOpponent,
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
  'cfgOppScaleAtkW',
  'cfgOppScaleHpW',
  'cfgOppScaleArmW',
  'cfgCritEff',
  'cfgAtkSpdEff',
  'cfgHitImpactEff',
  'cfgMinHitImpact',
  'cfgMaxHitImpact',
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
  'scaleAtk',
  'scaleHp',
  'scaleArm',
  'oppScale',
  'oppAtk',
  'oppHp',
  'oppArm',
  'incomingOnYou',
  'ehp',
  'mainHit',
  'expectedHit',
  'effSpd',
  'dps',
  'hitImpactRatio',
  'hitImpactMult',
  'weightedDps',
  'areaHit',
  'areaDps',
  'effectiveDps',
  'sustain',
  'sustainMult',
  'thornsRaw',
  'thornsHit',
  'thornsValue',
  'pressure',
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

function armorFormula(incExpr: string, armorRow: number): string {
  const incWrapped = incExpr.startsWith('(') ? incExpr : `(${incExpr})`
  return `=IF(${incWrapped}<=0;0;MAX(${incWrapped}*${$(R.cfgMinDmg)};${incWrapped}*${$(R.cfgArmorK)}/(${$(R.cfgArmorK)}+MAX(0;${b(armorRow)})/${incWrapped})))`
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

  addRow(
    'armorDamageConstant',
    n(BATTLE_CONFIG.armorDamageConstant),
    'константа K в формуле снижения урона бронёй',
    'cfgArmorK',
  )
  addRow(
    'minDamageMultiplier',
    n(BATTLE_CONFIG.minDamageMultiplier),
    'минимальная доля входящего урона после брони',
    'cfgMinDmg',
  )
  addRow('—— ЭТАЛОН ПРОТИВНИКА (gearConfig.playerBase) ——', '', '')
  addRow(
    'playerBaseAttack',
    n(GEAR_CONFIG.playerBase.attack),
    'базовая атака эталона; знаменатель scaleAttack',
    'cfgPlayerBaseAtk',
  )
  addRow(
    'playerBaseHealth',
    n(GEAR_CONFIG.playerBase.health),
    'базовое HP эталона; знаменатель scaleHealth',
    'cfgPlayerBaseHp',
  )
  addRow(
    'playerBaseDefence',
    n(GEAR_CONFIG.playerBase.defence),
    'базовая броня эталона; знаменатель scaleArmor, = oppArmor при S=1',
    'cfgPlayerBaseDef',
  )
  addRow(
    'playerBaseSpeed (база incoming atk speed)',
    n(GEAR_CONFIG.playerBase.speed / 100),
    'playerBase.speed/100 — множитель скорости входящих ударов',
    'cfgPlayerBaseSpd',
  )
  addRow('', '', '')
  addRow('—— КОНФИГ СИЛЫ (config.ts) ——', '', 'подсказки = комментарии в config.ts')
  addRow(
    'averageExtraTargets',
    n(p.averageExtraTargets),
    'среднее число доп. целей для массовой атаки в силе',
    'cfgAvgExtraTargets',
  )
  addRow(
    'opponentScaleAttackWeight',
    n(p.opponentScaleAttackWeight),
    'вес атаки в S (масштаб эталонного противника)',
    'cfgOppScaleAtkW',
  )
  addRow(
    'opponentScaleHealthWeight',
    n(p.opponentScaleHealthWeight),
    'вес здоровья в S',
    'cfgOppScaleHpW',
  )
  addRow(
    'opponentScaleArmorWeight',
    n(p.opponentScaleArmorWeight),
    'вес брони в S',
    'cfgOppScaleArmW',
  )
  addRow('critEfficiency', n(p.critEfficiency), 'доля крит-урона, учитываемая в expected hit', 'cfgCritEff')
  addRow(
    'attackSpeedEfficiency',
    n(p.attackSpeedEfficiency),
    'эффективность скорости атаки выше 100%',
    'cfgAtkSpdEff',
  )
  addRow(
    'hitImpactEfficiency',
    n(p.hitImpactEfficiency),
    'чувствительность hit impact к размеру удара',
    'cfgHitImpactEff',
  )
  addRow(
    'minHitImpactMultiplier',
    n(p.minHitImpactMultiplier),
    'нижняя граница множителя удара',
    'cfgMinHitImpact',
  )
  addRow(
    'maxHitImpactMultiplier',
    n(p.maxHitImpactMultiplier),
    'верхняя граница множителя удара',
    'cfgMaxHitImpact',
  )
  addRow('areaEfficiency', n(p.areaEfficiency), 'эффективность урона по области в effective DPS', 'cfgAreaEff')
  addRow(
    'lifestealEfficiency',
    n(p.lifestealEfficiency),
    'доля main DPS × lifesteal, идущая в sustain',
    'cfgLsEff',
  )
  addRow('thornsEfficiency', n(p.thornsEfficiency), 'множитель ценности шипов в pressure', 'cfgThornsEff')
  addRow(
    'sustainEffectiveHealthDivisor',
    n(p.sustainEffectiveHealthDivisor),
    'EHP в знаменателе sustain: слабее, чем DPS',
    'cfgSustainEhpDiv',
  )
  addRow('defensePowerWeight', n(p.defensePowerWeight), 'степень EHP в итоговой силе', 'cfgDefW')
  addRow('offensePowerWeight', n(p.offensePowerWeight), 'степень pressure в итоговой силе', 'cfgOffW')
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

  addRow('—— РАСЧЁТ ——', '', 'кратко: что считает строка; колонка D — сверка с Node')
  addRow('scaleAttack (герой / эталон)', `=${b(R.normAtk)}/${$(R.cfgPlayerBaseAtk)}`, 'атака героя / эталон', '', 'scaleAtk')
  addRow('scaleHealth (герой / эталон)', `=${b(R.normHp)}/${$(R.cfgPlayerBaseHp)}`, 'HP героя / эталон', '', 'scaleHp')
  addRow('scaleArmor (герой / эталон)', `=${b(R.normArm)}/${$(R.cfgPlayerBaseDef)}`, 'броня героя / эталон', '', 'scaleArm')
  addRow(
    'opponentScale S (взвеш. геом. среднее)',
    `=POWER(${b(R.scaleAtk)};${$(R.cfgOppScaleAtkW)})*POWER(${b(R.scaleHp)};${$(R.cfgOppScaleHpW)})*POWER(${b(R.scaleArm)};${$(R.cfgOppScaleArmW)})`,
    'общий масштаб зеркального врага',
    '',
    'oppScale',
  )
  addRow(
    'oppAttack (эталон × S)',
    `=${$(R.cfgPlayerBaseAtk)}*${b(R.oppScale)}`,
    'условный входящий удар по тебе',
    '',
    'oppAtk',
  )
  addRow('oppHealth (эталон × S)', `=${$(R.cfgPlayerBaseHp)}*${b(R.oppScale)}`, 'HP эталона (справочно)', '', 'oppHp')
  addRow('oppArmor (эталон × S)', `=${$(R.cfgPlayerBaseDef)}*${b(R.oppScale)}`, 'броня врага для твоего урона', '', 'oppArm')
  addRow(
    'incomingOnYou (после своей брони)',
    armorFormula(b(R.oppAtk), R.normArm),
    'фактический урон oppAttack по тебе',
    '',
    'incomingOnYou',
  )
  addRow(
    'effectiveHealth (EHP)',
    `=${b(R.normHp)}*${b(R.oppAtk)}/${b(R.incomingOnYou)}`,
    'эффективное HP vs эталонный удар',
    '',
    'ehp',
  )
  addRow(
    'mainHitAfterArmor',
    armorFormula(b(R.normAtk), R.oppArm),
    'твой удар после брони oppArmor',
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
  addRow('dps (main, без hitImpact)', `=${b(R.expectedHit)}*${b(R.effSpd)}`, 'main DPS до hit impact', '', 'dps')
  addRow('hitImpactRatio', `=${b(R.expectedHit)}/${b(R.oppAtk)}`, 'твой удар / удар по тебе', '', 'hitImpactRatio')
  addRow(
    'hitImpactMultiplier',
    `=MIN(${$(R.cfgMaxHitImpact)};MAX(${$(R.cfgMinHitImpact)};1+${$(R.cfgHitImpactEff)}*(${b(R.hitImpactRatio)}-1)))`,
    'бонус крупного, штраф мелкого удара',
    '',
    'hitImpactMult',
  )
  addRow('weightedDps', `=${b(R.dps)}*${b(R.hitImpactMult)}`, 'DPS с hit impact', '', 'weightedDps')
  addRow(
    'areaHitAfterArmor',
    armorFormula(`${b(R.normAtk)}*${b(R.normArea)}`, R.oppArm),
    'урон area через броню врага',
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
  addRow('effectiveDps', `=${b(R.weightedDps)}+${b(R.areaDps)}`, 'итоговое давление урона', '', 'effectiveDps')
  addRow('sustain (только от main dps)', `=${b(R.dps)}*${b(R.normLs)}*${$(R.cfgLsEff)}`, 'хил только от обычной атаки', '', 'sustain')
  addRow(
    'sustainMultiplier',
    `=1+${b(R.sustain)}/MAX(1;${b(R.effectiveDps)}+${b(R.ehp)}/${$(R.cfgSustainEhpDiv)})`,
    'множитель силы от lifesteal',
    '',
    'sustainMult',
  )
  addRow('thornsRaw', `=${b(R.normArm)}*${b(R.normTh)}`, 'сырой урон шипов', '', 'thornsRaw')
  addRow('thornsAfterArmor', armorFormula(b(R.thornsRaw), R.oppArm), 'шипы после брони врага', '', 'thornsHit')
  addRow(
    'thornsValue',
    `=${b(R.thornsHit)}*${$(R.cfgPlayerBaseSpd)}*${$(R.cfgThornsEff)}`,
    'шипы в pressure',
    '',
    'thornsValue',
  )
  addRow('pressure', `=${b(R.effectiveDps)}+${b(R.thornsValue)}`, 'урон + шипы', '', 'pressure')
  addRow(
    'СИЛА (power)',
    `=POWER(${b(R.ehp)};${$(R.cfgDefW)})*POWER(${b(R.pressure)};${$(R.cfgOffW)})*${b(R.sustainMult)}`,
    'EHP^def × pressure^off × sustain',
    '',
    'power',
  )

  return rows
}

function statsFromSheetDefaults(): CombatantStats {
  return { ...DEFAULT_SHEET_HERO_STATS }
}

function expectedIncomingOnYou(): number {
  const stats = statsFromSheetDefaults()
  const opponent = getScaledReferenceOpponent(stats)

  return calculateArmorReducedDamage(opponent.attack, stats.armor)
}

function attachValidationChecks(): void {
  const stats = statsFromSheetDefaults()
  const breakdown = calculatePower(stats)
  const incoming = expectedIncomingOnYou()
  const opponent = getScaledReferenceOpponent(stats)
  const defaultScale = getReferenceOpponentScale(stats)

  for (const row of rows) {
    if (row[0] === 'opponentScale S (взвеш. геом. среднее)') {
      row[3] = n(Number(defaultScale.toFixed(4)))
    }
    if (row[0] === 'oppAttack (эталон × S)') {
      row[3] = n(opponent.attack)
    }
    if (row[0] === 'oppHealth (эталон × S)') {
      row[3] = n(opponent.health)
    }
    if (row[0] === 'oppArmor (эталон × S)') {
      row[3] = n(opponent.armor)
    }
    if (row[0] === 'СИЛА (power)') {
      row[3] = n(Number(breakdown.power.toFixed(4)))
    }
    if (row[0] === 'effectiveHealth (EHP)') {
      row[3] = n(Number(breakdown.effectiveHealth.toFixed(4)))
    }
    if (row[0] === 'dps (main, без hitImpact)') {
      row[3] = n(Number(breakdown.dps.toFixed(4)))
    }
    if (row[0] === 'incomingOnYou (после своей брони)') {
      row[3] = n(Number(incoming.toFixed(4)))
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
    `Ключевые строки: oppAttack B${R.oppAtk}, incomingOnYou B${R.incomingOnYou}, EHP B${R.ehp}, СИЛА B${R.power}`,
  )
  console.log(`incomingOnYou (код) ≈ ${n(Number(expectedIncomingOnYou().toFixed(2)))} — должно совпасть с B${R.incomingOnYou}`)
}

main()
