/**
 * Generates docs/power-calculator-sheet.csv for RU/EU Excel locale:
 * - field separator: semicolon (;)
 * - decimal separator: comma (,)
 * - formula argument separator: semicolon (;)
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
} from '../src/battle/power.ts'
import type { CombatantStats } from '../src/battle/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '../docs/power-calculator-sheet.csv')
const FIELD_SEP = ';'

type CsvRow = [string, string, string, string]

/** Стартовые статы листа и сверка в колонке D (меняй под себя). */
const DEFAULT_SHEET_HERO_STATS: CombatantStats = {
  attack: 60,
  health: 200,
  armor: 30,
  attackSpeed: 110,
  critChance: 10,
  critDamage: 160,
  lifesteal: 10,
  areaAttack: 10,
  thorns: 10,
}

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
  'cfgRefHp',
  'cfgRefArm',
  'cfgHealthDefExp',
  'cfgAvgExtraTargets',
  'cfgCritEff',
  'cfgAtkSpdEff',
  'cfgAreaEff',
  'cfgLsEff',
  'cfgThornsEff',
  'cfgPlayerBaseSpd',
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
  'defenseAnchor',
  'defenseHeroFactor',
  'defenseScore',
  'mainHit',
  'expectedHit',
  'effSpd',
  'dps',
  'areaDps',
  'offensePressure',
  'sustain',
  'sustainMult',
  'thornsRaw',
  'thornsValue',
  'offenseScore',
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

function buildRows(): CsvRow[] {
  rows = []
  sheetRow = 1
  const p = BATTLE_CONFIG.power
  const hRef = GEAR_CONFIG.playerBase.health
  const aRef = GEAR_CONFIG.playerBase.defence

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
  addRow('Attack Speed, %', String(DEFAULT_SHEET_HERO_STATS.attackSpeed), '100 = базовая скорость', 'speed')
  addRow('Crit Chance, %', String(DEFAULT_SHEET_HERO_STATS.critChance), '', 'critChance')
  addRow('Crit Damage, %', String(DEFAULT_SHEET_HERO_STATS.critDamage), '150 = ×1,5 урона на крите', 'critDamage')
  addRow('Lifesteal, %', String(DEFAULT_SHEET_HERO_STATS.lifesteal), '', 'lifesteal')
  addRow('Mass Attack (area), %', String(DEFAULT_SHEET_HERO_STATS.areaAttack), '', 'area')
  addRow('Thorns, %', String(DEFAULT_SHEET_HERO_STATS.thorns), '', 'thorns')
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
  addRow('—— КОНФИГ СИЛЫ, модель D1 (вакуум) ——', '', 'docs/power-display-formula-options.md')
  addRow('playerBase HP (H₀)', String(hRef), 'эталон для defenseScore', 'cfgRefHp')
  addRow('playerBase Armor (A₀)', String(aRef), 'эталон для defenseScore', 'cfgRefArm')
  addRow(
    'healthDefenseExponent (α)',
    n(p.healthDefenseExponent),
    'defenseScore = якорь × множитель статов',
    'cfgHealthDefExp',
  )
  addRow(
    'averageExtraTargets',
    n(p.averageExtraTargets),
    'среднее число доп. целей для area',
    'cfgAvgExtraTargets',
  )
  addRow('critEfficiency', n(p.critEfficiency), 'доля крит-урона в expected hit', 'cfgCritEff')
  addRow(
    'attackSpeedEfficiency',
    n(p.attackSpeedEfficiency),
    'эффективность скорости атаки выше 100%',
    'cfgAtkSpdEff',
  )
  addRow('areaEfficiency', n(p.areaEfficiency), 'множитель area DPS', 'cfgAreaEff')
  addRow('lifestealEfficiency', n(p.lifestealEfficiency), 'доля main DPS в sustain', 'cfgLsEff')
  addRow('thornsEfficiency', n(p.thornsEfficiency), 'множитель шипов', 'cfgThornsEff')
  addRow(
    'playerBaseSpeed (шипы)',
    n(GEAR_CONFIG.playerBase.speed / 100),
    'скорость «входящих ударов» для thorns',
    'cfgPlayerBaseSpd',
  )
  addRow(
    'sustainEffectiveHealthDivisor',
    n(p.sustainEffectiveHealthDivisor),
    'defenseScore в знаменателе sustain',
    'cfgSustainEhpDiv',
  )
  addRow('defensePowerWeight', n(p.defensePowerWeight), 'степень defenseScore', 'cfgDefW')
  addRow('offensePowerWeight', n(p.offensePowerWeight), 'степень offenseScore', 'cfgOffW')
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

  addRow('—— РАСЧЁТ (модель D1) ——', '', 'колонка D — сверка с Node')
  addRow(
    'defenseAnchor (якорь)',
    `=POWER(${$(R.cfgRefHp)};${$(R.cfgHealthDefExp)})*POWER(${$(R.cfgRefArm)};1-${$(R.cfgHealthDefExp)})`,
    'масштаб defense при HP=H₀ и armor=A₀; только конфиг и база, не статы героя',
    '',
    'defenseAnchor',
  )
  addRow(
    'defenseHeroFactor (множитель статов)',
    `=POWER(${b(R.normHp)}/${$(R.cfgRefHp)};${$(R.cfgHealthDefExp)})*POWER(MAX(${b(R.normArm)};${$(R.cfgRefArm)}*0,01)/${$(R.cfgRefArm)};1-${$(R.cfgHealthDefExp)})`,
    'отношение героя к базе: (HP/H₀)^α × (armor/A₀)^(1−α); при базовых статах = 1',
    '',
    'defenseHeroFactor',
  )
  addRow(
    'defenseScore',
    `=${b(R.defenseAnchor)}*${b(R.defenseHeroFactor)}`,
    'выживаемость в силе = якорь × множитель статов',
    '',
    'defenseScore',
  )
  addRow('mainHit (raw attack)', `=${b(R.normAtk)}`, 'без mit цели', '', 'mainHit')
  addRow(
    'expectedHitDamage',
    `=${b(R.mainHit)}*(1+${b(R.normCritC)}*(${b(R.normCritD)}-1)*${$(R.cfgCritEff)})`,
    'средний удар с критом',
    '',
    'expectedHit',
  )
  addRow(
    'effectiveAttackSpeed',
    `=MAX(1E-9;1+(${b(R.normSpd)}-1)*${$(R.cfgAtkSpdEff)})`,
    'скорость >100% с коэфф.',
    '',
    'effSpd',
  )
  addRow('dps (main)', `=${b(R.expectedHit)}*${b(R.effSpd)}`, 'main DPS', '', 'dps')
  addRow(
    'areaDps',
    `=${b(R.normAtk)}*${b(R.normArea)}*${$(R.cfgAvgExtraTargets)}*${$(R.cfgAreaEff)}*${b(R.effSpd)}`,
    'area без mit цели',
    '',
    'areaDps',
  )
  addRow('offensePressure', `=${b(R.dps)}+${b(R.areaDps)}`, 'main + area DPS', '', 'offensePressure')
  addRow('sustain (только от main dps)', `=${b(R.dps)}*${b(R.normLs)}*${$(R.cfgLsEff)}`, '', '', 'sustain')
  addRow(
    'sustainMultiplier',
    `=1+${b(R.sustain)}/MAX(1;${b(R.offensePressure)}+${b(R.defenseScore)}/${$(R.cfgSustainEhpDiv)})`,
    'множитель от lifesteal',
    '',
    'sustainMult',
  )
  addRow('thornsRaw', `=${b(R.normArm)}*${b(R.normTh)}`, 'armor × thorns%', '', 'thornsRaw')
  addRow(
    'thornsValue',
    `=${b(R.thornsRaw)}*${$(R.cfgPlayerBaseSpd)}*${$(R.cfgThornsEff)}`,
    'без mit цели',
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

function defenseComponentsForStats(stats: CombatantStats): {
  anchor: number
  heroFactor: number
  score: number
} {
  const alpha = BATTLE_CONFIG.power.healthDefenseExponent
  const hRef = GEAR_CONFIG.playerBase.health
  const aRef = GEAR_CONFIG.playerBase.defence
  const armorForScore = Math.max(stats.armor, aRef * 0.01)
  const anchor = Math.pow(hRef, alpha) * Math.pow(aRef, 1 - alpha)
  const heroFactor =
    Math.pow(Math.max(1, stats.health) / hRef, alpha) *
    Math.pow(armorForScore / aRef, 1 - alpha)
  const score = calculatePowerDefenseScore(stats.health, stats.armor)

  return { anchor, heroFactor, score }
}

function attachValidationChecks(): void {
  const stats = statsFromSheetDefaults()
  const breakdown = calculatePower(stats)
  const defense = defenseComponentsForStats(stats)

  for (const row of rows) {
    if (row[0] === 'defenseAnchor (якорь)') {
      row[3] = n(Number(defense.anchor.toFixed(4)))
    }
    if (row[0] === 'defenseHeroFactor (множитель статов)') {
      row[3] = n(Number(defense.heroFactor.toFixed(4)))
    }
    if (row[0] === 'defenseScore') {
      row[3] = n(Number(defense.score.toFixed(4)))
    }
    if (row[0] === 'mainHit (raw attack)') {
      row[3] = n(stats.attack)
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

  const stats = statsFromSheetDefaults()
  const examplePower = calculatePower(stats).power
  const baseHeroDefense = defenseComponentsForStats({
    ...stats,
    health: GEAR_CONFIG.playerBase.health,
    armor: GEAR_CONFIG.playerBase.defence,
  })

  console.log(`Wrote ${OUT_PATH}`)
  console.log(
    `Пример (${stats.attack}/${stats.health}/${stats.armor}): power ≈ ${n(Number(examplePower.toFixed(2)))}`,
  )
  console.log(
    `Ключевые строки: якорь B${R.defenseAnchor}, множитель B${R.defenseHeroFactor}, defense B${R.defenseScore}, СИЛА B${R.power}`,
  )
  console.log(
    `При базе H₀/A₀: heroFactor≈${n(Number(baseHeroDefense.heroFactor.toFixed(4)))}, defenseScore=якорь≈${n(Number(baseHeroDefense.anchor.toFixed(2)))}`,
  )
}

main()
