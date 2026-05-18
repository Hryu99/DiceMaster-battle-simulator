import { useState } from 'react'
import { runSecondaryBalanceReport, type SecondaryBalanceReport } from './battle/gear/secondaryBalance'
import type { EquipmentRarityId } from './battle/gear/gearConfig'
import { describeGearLoadout } from './battle/gear/equipment'
import {
  DEFAULT_GEAR_REALISTIC_POWER_LAB_CONFIG,
  runGearRealisticPowerLab,
  type GearRealisticBuildResult,
  type GearRealisticPowerLabReport,
} from './battle/gearRealisticPowerLab'
import {
  DEFAULT_POWER_LAB_CONFIG,
  runPowerLab,
  type PowerLabBuildResult,
  type PowerLabReport,
} from './battle/powerLab'
import type { CombatantStats } from './battle/types'
import { formatNumber, formatPercent } from './formatters'

type PowerLabMode = 'stress' | 'gear' | 'secondary-balance'

export function PowerLabPage() {
  const [mode, setMode] = useState<PowerLabMode>('gear')
  const [targetPower, setTargetPower] = useState(DEFAULT_POWER_LAB_CONFIG.targetPower)
  const [tolerancePercent, setTolerancePercent] = useState(DEFAULT_POWER_LAB_CONFIG.tolerancePercent)
  const [candidateCount, setCandidateCount] = useState(DEFAULT_GEAR_REALISTIC_POWER_LAB_CONFIG.candidateCount)
  const [selectedBuildCount, setSelectedBuildCount] = useState(DEFAULT_GEAR_REALISTIC_POWER_LAB_CONFIG.selectedBuildCount)
  const [roundsPerPair, setRoundsPerPair] = useState(DEFAULT_GEAR_REALISTIC_POWER_LAB_CONFIG.roundsPerPair)
  const [seed, setSeed] = useState(DEFAULT_GEAR_REALISTIC_POWER_LAB_CONFIG.seed)
  const [filterByTargetPower, setFilterByTargetPower] = useState(false)
  const [fixedRarityId, setFixedRarityId] = useState<EquipmentRarityId | 'mixed'>('mixed')
  const [balanceRarityId, setBalanceRarityId] = useState<EquipmentRarityId>('rare')
  const [stressReport, setStressReport] = useState<PowerLabReport | null>(null)
  const [gearReport, setGearReport] = useState<GearRealisticPowerLabReport | null>(null)
  const [secondaryBalanceReport, setSecondaryBalanceReport] = useState<SecondaryBalanceReport | null>(null)

  const modeDescription =
    mode === 'stress'
      ? 'Formula Stress Lab: случайные абстрактные билды около заданной силы.'
      : mode === 'gear'
        ? 'Gear Realistic Lab: билды через базового героя и экипировку по правилам игры.'
        : 'Сравнение прироста силы от каждого secondary-стата на одной редкости.'

  const run = () => {
    if (mode === 'stress') {
      setStressReport(
        runPowerLab({
          targetPower,
          tolerancePercent,
          candidateCount,
          selectedBuildCount,
          roundsPerPair,
          seed,
        }),
      )
      return
    }

    if (mode === 'gear') {
      setGearReport(
        runGearRealisticPowerLab({
          candidateCount,
          selectedBuildCount,
          roundsPerPair,
          seed,
          targetPower: filterByTargetPower ? targetPower : null,
          tolerancePercent,
          fixedRarityId: fixedRarityId === 'mixed' ? null : fixedRarityId,
        }),
      )
      return
    }

    setSecondaryBalanceReport(runSecondaryBalanceReport(balanceRarityId))
  }

  return (
    <main className="gdd-shell power-lab-shell">
      <header className="gdd-header">
        <div>
          <h1>Power Lab</h1>
          <p className="lead">{modeDescription}</p>
        </div>
        <a className="gdd-link" href={import.meta.env.BASE_URL}>
          К симулятору
        </a>
      </header>

      <div className="power-lab-mode-tabs" role="tablist" aria-label="Режим Power Lab">
        <button type="button" className={mode === 'gear' ? 'is-active' : ''} onClick={() => setMode('gear')}>
          Gear Lab
        </button>
        <button type="button" className={mode === 'stress' ? 'is-active' : ''} onClick={() => setMode('stress')}>
          Stress Lab
        </button>
        <button
          type="button"
          className={mode === 'secondary-balance' ? 'is-active' : ''}
          onClick={() => setMode('secondary-balance')}
        >
          Secondary balance
        </button>
      </div>

      <section className="results-panel">
        {mode !== 'secondary-balance' ? (
          <div className="power-lab-controls">
            {mode === 'stress' && (
              <>
                <label>
                  Целевая сила
                  <input type="number" min="1" step="10" value={targetPower} onChange={(event) => setTargetPower(Number(event.target.value))} />
                </label>
                <label>
                  Допуск, %
                  <input type="number" min="1" max="50" step="1" value={tolerancePercent} onChange={(event) => setTolerancePercent(Number(event.target.value))} />
                </label>
              </>
            )}
            {mode === 'gear' && (
              <>
                <label className="power-lab-checkbox">
                  <span>Фильтр по силе</span>
                  <input type="checkbox" checked={filterByTargetPower} onChange={(event) => setFilterByTargetPower(event.target.checked)} />
                </label>
                {filterByTargetPower && (
                  <>
                    <label>
                      Целевая сила
                      <input type="number" min="1" step="10" value={targetPower} onChange={(event) => setTargetPower(Number(event.target.value))} />
                    </label>
                    <label>
                      Допуск, %
                      <input type="number" min="1" max="50" step="1" value={tolerancePercent} onChange={(event) => setTolerancePercent(Number(event.target.value))} />
                    </label>
                  </>
                )}
                <label>
                  Редкость
                  <select value={fixedRarityId} onChange={(event) => setFixedRarityId(event.target.value as EquipmentRarityId | 'mixed')}>
                    <option value="mixed">Смешанная</option>
                    <option value="common">Common</option>
                    <option value="rare">Rare</option>
                    <option value="epic">Epic</option>
                    <option value="legendary">Legendary</option>
                  </select>
                </label>
              </>
            )}
            <label>
              Кандидатов
              <input type="number" min="100" step="100" value={candidateCount} onChange={(event) => setCandidateCount(Number(event.target.value))} />
            </label>
            <label>
              Билдов
              <input type="number" min="2" max="100" step="1" value={selectedBuildCount} onChange={(event) => setSelectedBuildCount(Number(event.target.value))} />
            </label>
            <label>
              Боев на пару
              <input type="number" min="1" step="10" value={roundsPerPair} onChange={(event) => setRoundsPerPair(Number(event.target.value))} />
            </label>
            <label>
              Seed
              <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value))} />
            </label>
          </div>
        ) : (
          <div className="power-lab-controls">
            <label>
              Редкость предмета
              <select value={balanceRarityId} onChange={(event) => setBalanceRarityId(event.target.value as EquipmentRarityId)}>
                <option value="common">Common</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
            </label>
          </div>
        )}

        <button type="button" onClick={run}>
          {mode === 'secondary-balance' ? 'Запустить баланс secondary' : 'Запустить'}
        </button>
      </section>

      {mode === 'stress' && stressReport && <PowerLabReportPanel report={stressReport} />}
      {mode === 'gear' && gearReport && <GearRealisticReportPanel report={gearReport} />}
      {mode === 'secondary-balance' && secondaryBalanceReport && (
        <SecondaryBalanceReportPanel report={secondaryBalanceReport} />
      )}
    </main>
  )
}

function LabMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PowerLabReportPanel({ report }: { report: PowerLabReport }) {
  return (
    <section className="results-panel">
      <div className="results-grid">
        <LabMetric label="Кандидатов" value={String(report.candidatesGenerated)} />
        <LabMetric label="Отобрано билдов" value={String(report.builds.length)} />
        <LabMetric label="Боев всего" value={String(report.builds.reduce((total, build) => total + build.battles, 0) / 2)} />
        <LabMetric label="Avg power" value={formatNumber(report.overallSummary.averagePower, 1)} />
        <LabMetric label="Avg armor / ref armor" value={formatNumber(report.overallSummary.armorToReferenceEnemyArmorRatio, 2)} />
        <LabMetric label="Avg attack / ref armor" value={formatNumber(report.overallSummary.attackToReferenceEnemyArmorRatio, 2)} />
      </div>

      <h2>Baseline выборки</h2>
      <DiagnosticsTable diagnostics={report.overallSummary.diagnostics} ratios={report.overallSummary} />

      <h2>Архетипы</h2>
      <TagSummaryTable summaries={report.tagSummaries} />

      <h2>Сильнее формулы</h2>
      <PowerLabBuildTable builds={report.topWinners} />

      <h2>Слабее формулы</h2>
      <PowerLabBuildTable builds={report.topLosers} />
    </section>
  )
}

function GearRealisticReportPanel({ report }: { report: GearRealisticPowerLabReport }) {
  return (
    <section className="results-panel">
      <div className="results-grid">
        <LabMetric label="Кандидатов" value={String(report.candidatesGenerated)} />
        <LabMetric label="Отобрано билдов" value={String(report.builds.length)} />
        <LabMetric label="Сила голого героя" value={formatNumber(report.nakedHeroPower, 1)} />
        <LabMetric
          label="Сила 4x legendary"
          value={report.legendaryReferencePower === null ? '—' : formatNumber(report.legendaryReferencePower, 1)}
        />
        <LabMetric label="Avg power" value={formatNumber(report.overallSummary.averagePower, 1)} />
        <LabMetric label="Боев всего" value={String(report.builds.reduce((total, build) => total + build.battles, 0) / 2)} />
      </div>

      <h2>Редкость сета</h2>
      <div className="power-lab-table-wrap">
        <table className="power-lab-table">
          <thead>
            <tr>
              <th>Тег</th>
              <th>Билдов</th>
              <th>Средний win rate</th>
              <th>Avg power</th>
            </tr>
          </thead>
          <tbody>
            {report.gearTagSummaries.map((summary) => (
              <tr key={summary.tag}>
                <td>{summary.tag}</td>
                <td>{summary.buildCount}</td>
                <td>{formatPercent(summary.averageWinRate)}</td>
                <td>{formatNumber(summary.averagePower, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Baseline выборки</h2>
      <DiagnosticsTable diagnostics={report.overallSummary.diagnostics} ratios={report.overallSummary} />

      <h2>Архетипы (статы)</h2>
      <TagSummaryTable summaries={report.tagSummaries} />

      <h2>Сильнее формулы</h2>
      <GearBuildTable builds={report.topWinners} />

      <h2>Слабее формулы</h2>
      <GearBuildTable builds={report.topLosers} />
    </section>
  )
}

function SecondaryBalanceReportPanel({ report }: { report: SecondaryBalanceReport }) {
  return (
    <section className="results-panel">
      <p className="lead">
        Сравнение secondary-статов на одной rare-броне. «Δ только secondary» — прирост относительно героя с бронёй (только +HP),
        без повторного учёта здоровья с брони.
      </p>

      <div className="results-grid">
        <LabMetric label="Редкость" value={report.rarityId} />
        <LabMetric label="Сила голого героя" value={formatNumber(report.baselinePower, 1)} />
        <LabMetric label="Сила с бронёй (только HP)" value={formatNumber(report.chestOnlyPower, 1)} />
        <LabMetric label="Прирост от брони" value={`${formatNumber(report.chestOnlyDeltaPercent, 1)}%`} />
        <LabMetric label="Разброс secondary" value={`${formatNumber(report.secondarySpreadPercent, 1)}%`} />
        <LabMetric label="Цель разброса" value={`≤ ${report.targetSpreadPercent}%`} />
        <LabMetric label="В пределах цели" value={report.withinTargetSpread ? 'да' : 'нет'} />
      </div>

      <div className="power-lab-table-wrap">
        <table className="power-lab-table">
          <thead>
            <tr>
              <th>Secondary</th>
              <th>Значение</th>
              <th>Сила</th>
              <th>Δ от голого</th>
              <th>Δ от голого, %</th>
              <th>Δ только secondary</th>
              <th>Δ только secondary, %</th>
            </tr>
          </thead>
          <tbody>
            {report.entries.map((entry) => (
              <tr key={entry.statId}>
                <td>{entry.statId}</td>
                <td>{formatNumber(entry.statValue, 1)}</td>
                <td>{formatNumber(entry.power, 1)}</td>
                <td>{formatNumber(entry.powerDelta, 1)}</td>
                <td>{formatNumber(entry.powerDeltaPercent, 1)}%</td>
                <td>{formatNumber(entry.secondaryOnlyDelta, 1)}</td>
                <td>{formatNumber(entry.secondaryOnlyDeltaPercent, 1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DiagnosticsTable({
  diagnostics,
  ratios,
}: {
  diagnostics: PowerLabReport['overallSummary']['diagnostics']
  ratios: { armorToReferenceEnemyArmorRatio: number; attackToReferenceEnemyArmorRatio: number }
}) {
  return (
    <div className="power-lab-table-wrap">
      <table className="power-lab-table">
        <thead>
          <tr>
            <th>Avg A</th>
            <th>Avg HP</th>
            <th>Avg Arm</th>
            <th>Ref Arm</th>
            <th>Arm/Ref Arm</th>
            <th>A/Ref Arm</th>
            <th>Hit/Ref</th>
            <th>Hit x</th>
            <th>EHP</th>
            <th>DPS</th>
            <th>EHP/DPS</th>
            <th>DPS/EHP</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{formatNumber(diagnostics.attack, 1)}</td>
            <td>{formatNumber(diagnostics.health, 1)}</td>
            <td>{formatNumber(diagnostics.armor, 1)}</td>
            <td>{formatNumber(diagnostics.referenceEnemyArmor, 1)}</td>
            <td>{formatNumber(ratios.armorToReferenceEnemyArmorRatio, 2)}</td>
            <td>{formatNumber(ratios.attackToReferenceEnemyArmorRatio, 2)}</td>
            <td>{formatNumber(diagnostics.hitToReferenceRatio, 2)}</td>
            <td>{formatNumber(diagnostics.hitImpactMultiplier, 2)}</td>
            <td>{formatNumber(diagnostics.effectiveHealth, 1)}</td>
            <td>{formatNumber(diagnostics.dps, 1)}</td>
            <td>{formatNumber(diagnostics.effectiveHealthToDpsRatio, 2)}</td>
            <td>{formatNumber(diagnostics.dpsToEffectiveHealthRatio, 3)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function TagSummaryTable({ summaries }: { summaries: PowerLabReport['tagSummaries'] }) {
  return (
    <div className="power-lab-table-wrap">
      <table className="power-lab-table">
        <thead>
          <tr>
            <th>Тег</th>
            <th>Билдов</th>
            <th>Средний win rate</th>
            <th>Avg A</th>
            <th>Avg HP</th>
            <th>Avg Arm</th>
            <th>Hit/Ref</th>
            <th>Hit x</th>
            <th>EHP</th>
            <th>DPS</th>
            <th>EHP/DPS</th>
            <th>DPS/EHP</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => (
            <tr key={summary.tag}>
              <td>{summary.tag}</td>
              <td>{summary.buildCount}</td>
              <td>{formatPercent(summary.averageWinRate)}</td>
              <td>{formatNumber(summary.diagnostics.attack, 1)}</td>
              <td>{formatNumber(summary.diagnostics.health, 1)}</td>
              <td>{formatNumber(summary.diagnostics.armor, 1)}</td>
              <td>{formatNumber(summary.diagnostics.hitToReferenceRatio, 2)}</td>
              <td>{formatNumber(summary.diagnostics.hitImpactMultiplier, 2)}</td>
              <td>{formatNumber(summary.diagnostics.effectiveHealth, 1)}</td>
              <td>{formatNumber(summary.diagnostics.dps, 1)}</td>
              <td>{formatNumber(summary.diagnostics.effectiveHealthToDpsRatio, 2)}</td>
              <td>{formatNumber(summary.diagnostics.dpsToEffectiveHealthRatio, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PowerLabBuildTable({ builds }: { builds: PowerLabBuildResult[] }) {
  return (
    <div className="power-lab-table-wrap">
      <table className="power-lab-table">
        <thead>
          <tr>
            <th>Билд</th>
            <th>Сила</th>
            <th>Win rate</th>
            <th>Теги</th>
            <th>Hit/Ref</th>
            <th>Hit x</th>
            <th>EHP</th>
            <th>DPS</th>
            <th>EHP/DPS</th>
            <th>DPS/EHP</th>
            <th>Статы</th>
          </tr>
        </thead>
        <tbody>
          {builds.map((build) => (
            <tr key={build.combatant.id}>
              <td>{build.combatant.name}</td>
              <td>{formatNumber(build.power)}</td>
              <td>{formatPercent(build.winRate)}</td>
              <td>{build.tags.join(', ')}</td>
              <td>{formatNumber(build.diagnostics.hitToReferenceRatio, 2)}</td>
              <td>{formatNumber(build.diagnostics.hitImpactMultiplier, 2)}</td>
              <td>{formatNumber(build.diagnostics.effectiveHealth, 1)}</td>
              <td>{formatNumber(build.diagnostics.dps, 1)}</td>
              <td>{formatNumber(build.diagnostics.effectiveHealthToDpsRatio, 2)}</td>
              <td>{formatNumber(build.diagnostics.dpsToEffectiveHealthRatio, 3)}</td>
              <td>{formatStats(build.combatant.stats)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GearBuildTable({ builds }: { builds: GearRealisticBuildResult[] }) {
  return (
    <div className="power-lab-table-wrap">
      <table className="power-lab-table">
        <thead>
          <tr>
            <th>Билд</th>
            <th>Сила</th>
            <th>Win rate</th>
            <th>Gear теги</th>
            <th>Статы</th>
            <th>Экипировка</th>
          </tr>
        </thead>
        <tbody>
          {builds.map((build) => (
            <tr key={build.combatant.id}>
              <td>{build.combatant.name}</td>
              <td>{formatNumber(build.power)}</td>
              <td>{formatPercent(build.winRate)}</td>
              <td>{build.gearTags.join(', ')}</td>
              <td>{formatStats(build.combatant.stats)}</td>
              <td>{describeGearLoadout(build.loadout)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatStats(stats: CombatantStats): string {
  return `A ${stats.attack}, HP ${stats.health}, Arm ${stats.armor}, Spd ${stats.attackSpeed}%, Crit ${stats.critChance}/${stats.critDamage}%, LS ${stats.lifesteal}%, Th ${stats.thorns}%`
}
