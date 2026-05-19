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
import { calculatePower } from '../src/battle/power.ts'
import type { CombatantStats } from '../src/battle/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '../docs/power-calculator-sheet.csv')
const FIELD_SEP = ';'

type CsvRow = [string, string, string?]

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

function addRow(label: string, value: string, check = '', key?: string): number {
  sheetRow += 1
  rows.push([label, value, check])
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

  addRow('Attack', '25', '', 'attack')
  addRow('Health', '100', '', 'health')
  addRow('Armor', '10', '', 'armor')
  addRow('Attack Speed, %', '100', '100 = базовая скорость', 'speed')
  addRow('Crit Chance, %', '0', '', 'critChance')
  addRow('Crit Damage, %', '150', '150 = ×1,5 урона на крите', 'critDamage')
  addRow('Lifesteal, %', '0', '', 'lifesteal')
  addRow('Mass Attack (area), %', '0', '', 'area')
  addRow('Thorns, %', '0', '', 'thorns')
  addRow('', '', '')

  addRow('—— КОНФИГ (из config.ts) ——', '', '')
  addRow('armorDamageConstant', n(BATTLE_CONFIG.armorDamageConstant), '', 'cfgArmorK')
  addRow('minDamageMultiplier', n(BATTLE_CONFIG.minDamageMultiplier), '', 'cfgMinDmg')
  addRow(
    'playerBaseDefence (база refEnemyArmor)',
    n(GEAR_CONFIG.playerBase.defence),
    'из gearConfig.playerBase.defence',
    'cfgPlayerBaseDef',
  )
  addRow(
    'playerBaseSpeed (база incoming atk speed)',
    n(GEAR_CONFIG.playerBase.speed / 100),
    'playerBase.speed/100 → множитель (100% = 1)',
    'cfgPlayerBaseSpd',
  )
  addRow('averageExtraTargets', n(p.averageExtraTargets), '', 'cfgAvgExtraTargets')
  addRow('referenceAttackWeight', n(p.referenceAttackWeight), '', 'cfgRefAtkW')
  addRow('referenceHealthWeight', n(p.referenceHealthWeight), '', 'cfgRefHpW')
  addRow('referenceArmorWeight', n(p.referenceArmorWeight), '', 'cfgRefArmW')
  addRow('referenceTargetTtk', n(p.referenceTargetTtk), '', 'cfgRefTtk')
  addRow('expectedArmorToAttackRatio', n(p.expectedArmorToAttackRatio), '', 'cfgExpArmRatio')
  addRow('critEfficiency', n(p.critEfficiency), '', 'cfgCritEff')
  addRow('attackSpeedEfficiency', n(p.attackSpeedEfficiency), '', 'cfgAtkSpdEff')
  addRow('hitImpactEfficiency', n(p.hitImpactEfficiency), '', 'cfgHitImpactEff')
  addRow('minHitImpactMultiplier', n(p.minHitImpactMultiplier), '', 'cfgMinHitImpact')
  addRow('maxHitImpactMultiplier', n(p.maxHitImpactMultiplier), '', 'cfgMaxHitImpact')
  addRow('areaEfficiency', n(p.areaEfficiency), '', 'cfgAreaEff')
  addRow('lifestealEfficiency', n(p.lifestealEfficiency), '', 'cfgLsEff')
  addRow('thornsEfficiency', n(p.thornsEfficiency), '', 'cfgThornsEff')
  addRow('defensePowerWeight', n(p.defensePowerWeight), '', 'cfgDefW')
  addRow('offensePowerWeight', n(p.offensePowerWeight), '', 'cfgOffW')
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

  addRow('—— РАСЧЁТ ——', '', 'check = Node calculatePower()')
  addRow(
    'refIncoming (удар по тебе)',
    `=MAX(1E-9;${b(R.normAtk)}*${$(R.cfgRefAtkW)}+${b(R.normHp)}/${$(R.cfgRefTtk)}*${$(R.cfgRefHpW)}+${b(R.normArm)}/${$(R.cfgExpArmRatio)}*${$(R.cfgRefArmW)})`,
    '',
    'refIncoming',
  )
  addRow('refEnemyArmor', `=${$(R.cfgPlayerBaseDef)}`, 'enemyArmorScale=1 в коде', 'refEnemyArmor')
  addRow(
    'incomingOnYou (после своей брони)',
    armorFormula(b(R.refIncoming), R.normArm),
    '',
    'incomingOnYou',
  )
  addRow('effectiveHealth (EHP)', `=${b(R.normHp)}*${b(R.refIncoming)}/${b(R.incomingOnYou)}`, '', 'ehp')
  addRow(
    'mainHitAfterArmor',
    armorFormula(b(R.normAtk), R.refEnemyArmor),
    '',
    'mainHit',
  )
  addRow(
    'expectedHitDamage',
    `=${b(R.mainHit)}*(1+${b(R.normCritC)}*(${b(R.normCritD)}-1)*${$(R.cfgCritEff)})`,
    '',
    'expectedHit',
  )
  addRow(
    'effectiveAttackSpeed',
    `=MAX(1E-9;1+(${b(R.normSpd)}-1)*${$(R.cfgAtkSpdEff)})`,
    '',
    'effSpd',
  )
  addRow('dps (main, без hitImpact)', `=${b(R.expectedHit)}*${b(R.effSpd)}`, '', 'dps')
  addRow('hitImpactRatio', `=${b(R.expectedHit)}/${b(R.refIncoming)}`, '', 'hitImpactRatio')
  addRow(
    'hitImpactMultiplier',
    `=MIN(${$(R.cfgMaxHitImpact)};MAX(${$(R.cfgMinHitImpact)};1+${$(R.cfgHitImpactEff)}*(${b(R.hitImpactRatio)}-1)))`,
    '',
    'hitImpactMult',
  )
  addRow('weightedDps', `=${b(R.dps)}*${b(R.hitImpactMult)}`, '', 'weightedDps')
  addRow(
    'areaHitAfterArmor',
    armorFormula(`${b(R.normAtk)}*${b(R.normArea)}`, R.refEnemyArmor),
    '',
    'areaHit',
  )
  addRow(
    'areaDps',
    `=${b(R.areaHit)}*${$(R.cfgAvgExtraTargets)}*${$(R.cfgAreaEff)}*${b(R.effSpd)}`,
    '',
    'areaDps',
  )
  addRow('effectiveDps', `=${b(R.weightedDps)}+${b(R.areaDps)}`, '', 'effectiveDps')
  addRow('sustain (только от main dps)', `=${b(R.dps)}*${b(R.normLs)}*${$(R.cfgLsEff)}`, '', 'sustain')
  addRow(
    'sustainMultiplier',
    `=1+${b(R.sustain)}/MAX(1;${b(R.effectiveDps)}+${b(R.ehp)}/20)`,
    '',
    'sustainMult',
  )
  addRow('thornsRaw', `=${b(R.normArm)}*${b(R.normTh)}`, '', 'thornsRaw')
  addRow('thornsAfterArmor', armorFormula(b(R.thornsRaw), R.refEnemyArmor), '', 'thornsHit')
  addRow(
    'thornsValue',
    `=${b(R.thornsHit)}*${$(R.cfgPlayerBaseSpd)}*${$(R.cfgThornsEff)}`,
    '',
    'thornsValue',
  )
  addRow('pressure', `=${b(R.effectiveDps)}+${b(R.thornsValue)}`, '', 'pressure')
  addRow(
    'СИЛА (power)',
    `=POWER(${b(R.ehp)};${$(R.cfgDefW)})*POWER(${b(R.pressure)};${$(R.cfgOffW)})*${b(R.sustainMult)}`,
    '',
    'power',
  )

  return rows
}

function statsFromSheetDefaults(): CombatantStats {
  return {
    attack: 25,
    health: 100,
    armor: 10,
    attackSpeed: 100,
    critChance: 0,
    critDamage: 150,
    lifesteal: 0,
    areaAttack: 0,
    thorns: 0,
  }
}

function expectedIncomingOnYou(): number {
  const stats = statsFromSheetDefaults()
  const p = BATTLE_CONFIG.power
  const refIncoming = Math.max(
    1e-9,
    stats.attack * p.referenceAttackWeight +
      (stats.health / p.referenceTargetTtk) * p.referenceHealthWeight +
      (stats.armor / p.expectedArmorToAttackRatio) * p.referenceArmorWeight,
  )

  return calculateArmorReducedDamage(refIncoming, stats.armor)
}

function attachValidationChecks(): void {
  const breakdown = calculatePower(statsFromSheetDefaults())
  const incoming = expectedIncomingOnYou()

  for (const row of rows) {
    if (row[0] === 'СИЛА (power)') {
      row[2] = n(Number(breakdown.power.toFixed(4)))
    }
    if (row[0] === 'effectiveHealth (EHP)') {
      row[2] = n(Number(breakdown.effectiveHealth.toFixed(4)))
    }
    if (row[0] === 'dps (main, без hitImpact)') {
      row[2] = n(Number(breakdown.dps.toFixed(4)))
    }
    if (row[0] === 'incomingOnYou (после своей брони)') {
      row[2] = n(Number(incoming.toFixed(4)))
    }
  }
}

function main(): void {
  buildRows()
  attachValidationChecks()

  const header = rowToCsvLine(['Параметр', 'Значение / формула', 'Сверка (код)'])
  const body = rows.map((r) => rowToCsvLine([r[0], r[1], r[2] ?? '']))

  const csv = [header, ...body].join('\n') + '\n'
  writeFileSync(OUT_PATH, csv, 'utf8')

  const nakedPower = calculatePower(statsFromSheetDefaults()).power
  console.log(`Wrote ${OUT_PATH}`)
  console.log(`Голый герой: power ≈ ${n(Number(nakedPower.toFixed(2)))}`)
  console.log(
    `Ключевые строки: refIncoming B${R.refIncoming}, incomingOnYou B${R.incomingOnYou}, EHP B${R.ehp}, СИЛА B${R.power}`,
  )
  console.log(`incomingOnYou (код) ≈ ${n(Number(expectedIncomingOnYou().toFixed(2)))} — должно совпасть с B${R.incomingOnYou}`)
}

main()
