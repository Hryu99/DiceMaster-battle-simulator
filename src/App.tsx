import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'
import { calculateCombatantPower, calculatePower, calculateTeamPower } from './battle/power'
import { createCombatant, initialTeamA, initialTeamB } from './battle/presets'
import { runSimulations } from './battle/simulator'
import type { Combatant, CombatantStats, SimulationSummary, Team } from './battle/types'
import gddMarkdown from '../docs/battle-simulator-gdd.md?raw'

const statFields: Array<{
  key: keyof CombatantStats
  label: string
  step: number
  min: number
  max?: number
}> = [
  { key: 'attack', label: 'Атака', step: 1, min: 0 },
  { key: 'health', label: 'Здоровье', step: 10, min: 1 },
  { key: 'armor', label: 'Броня', step: 1, min: 0 },
  { key: 'attackSpeed', label: 'Скорость атаки, %', step: 5, min: 5 },
  { key: 'critChance', label: 'Шанс крита, %', step: 1, min: 0, max: 100 },
  { key: 'critDamage', label: 'Урон крита, %', step: 5, min: 100 },
  { key: 'lifesteal', label: 'Lifesteal, %', step: 1, min: 0, max: 100 },
  { key: 'areaAttack', label: 'Массовая атака, %', step: 1, min: 0, max: 100 },
  { key: 'thorns', label: 'Шипы', step: 1, min: 0 },
]

const cloneTeam = (team: Team): Team => JSON.parse(JSON.stringify(team)) as Team
const formatNumber = (value: number, digits = 0) => value.toLocaleString('ru-RU', { maximumFractionDigits: digits })
const formatPercent = (value: number) => `${formatNumber(value * 100, 1)}%`
const createMemberName = (teamName: string, memberNumber: number) => `${teamName}_${memberNumber}`

function App() {
  const [hash, setHash] = useState(() => window.location.hash)
  const [teamA, setTeamA] = useState<Team>(() => cloneTeam(initialTeamA))
  const [teamB, setTeamB] = useState<Team>(() => cloneTeam(initialTeamB))
  const [rounds, setRounds] = useState(100)
  const [seed, setSeed] = useState(1)
  const [summary, setSummary] = useState<SimulationSummary | null>(null)

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash)

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const powerA = useMemo(() => calculateTeamPower(teamA), [teamA])
  const powerB = useMemo(() => calculateTeamPower(teamB), [teamB])

  const updateTeam = (side: 'A' | 'B', updater: (team: Team) => Team) => {
    const setter = side === 'A' ? setTeamA : setTeamB
    setter((team) => updater(cloneTeam(team)))
    setSummary(null)
  }

  const runBattleSeries = () => {
    setSummary(runSimulations(teamA, teamB, rounds, { seed, logLimit: 100 }))
  }

  if (hash === '#/gdd') {
    return <GddPage markdown={gddMarkdown} />
  }

  return (
    <main className="app-shell">
      <header className="hero-panel">
        <div className="hero-copy">
          <h1>
            Dice Master симулятор боя <span className="app-version">v{__APP_VERSION__}</span>
          </h1>
          <p className="lead">
            Настраивай характеристики команд 1-4 на 1-4, сравнивай расчетную силу и проверяй ее
            серией событийных симуляций.
          </p>
          <a className="gdd-link" href={`${import.meta.env.BASE_URL}#/gdd`} target="_blank" rel="noreferrer">
            ГДД
          </a>
        </div>
        <section className="run-controls" aria-label="Параметры запуска симуляции">
          <label>
            Симуляций
            <input
              type="number"
              min="1"
              max="10000"
              step="100"
              value={rounds}
              onChange={(event) => setRounds(Number(event.target.value))}
            />
          </label>
          <label>
            Seed
            <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value))} />
          </label>
          <button type="button" onClick={runBattleSeries}>
            Запустить серию
          </button>
        </section>
      </header>

      <section className="teams-grid">
        <TeamEditor
          side="A"
          team={teamA}
          onUpdate={(updater) => updateTeam('A', updater)}
        />
        <TeamEditor
          side="B"
          team={teamB}
          powerDiff={formatPercent((powerB - powerA) / Math.max(powerA, powerB, 1))}
          onUpdate={(updater) => updateTeam('B', updater)}
        />
      </section>

      {summary && <ResultsPanel summary={summary} />}
    </main>
  )
}

interface TeamEditorProps {
  side: 'A' | 'B'
  team: Team
  powerDiff?: string
  onUpdate: (updater: (team: Team) => Team) => void
}

function TeamEditor({ side, team, powerDiff, onUpdate }: TeamEditorProps) {
  const teamPower = calculateTeamPower(team)

  const updateMember = (memberId: string, updater: (member: Combatant) => Combatant) => {
    onUpdate((draft) => ({
      ...draft,
      members: draft.members.map((member) => (member.id === memberId ? updater(member) : member)),
    }))
  }

  const addMember = () => {
    onUpdate((draft) => ({
      ...draft,
      members: [
        ...draft.members,
        createCombatant(
          `${side.toLowerCase()}-${Date.now()}`,
          createMemberName(draft.name, draft.members.length + 1),
        ),
      ],
    }))
  }

  const removeMember = (memberId: string) => {
    onUpdate((draft) => ({
      ...draft,
      members: draft.members.filter((member) => member.id !== memberId),
    }))
  }

  return (
    <article className="team-card">
      <div className="team-header">
        <div>
          <h2>{team.name}</h2>
        </div>
        <div className="team-power">
          <strong>Сила {formatNumber(teamPower)}</strong>
          {powerDiff && <span>Разница {powerDiff}</span>}
        </div>
      </div>

      <div className="combatants">
        {team.members.map((member) => (
          <CombatantEditor
            key={member.id}
            member={member}
            canRemove={team.members.length > 1}
            onRemove={() => removeMember(member.id)}
            onUpdate={(updater) => updateMember(member.id, updater)}
          />
        ))}
      </div>

      <button type="button" className="secondary full-width" disabled={team.members.length >= 4} onClick={addMember}>
        Добавить бойца
      </button>
    </article>
  )
}

interface CombatantEditorProps {
  member: Combatant
  canRemove: boolean
  onRemove: () => void
  onUpdate: (updater: (member: Combatant) => Combatant) => void
}

function CombatantEditor({ member, canRemove, onRemove, onUpdate }: CombatantEditorProps) {
  const breakdown = calculatePower(member.stats)

  const updateName = (event: ChangeEvent<HTMLInputElement>) => {
    onUpdate((draft) => ({ ...draft, name: event.target.value }))
  }

  const updateStat = (key: keyof CombatantStats, value: number) => {
    onUpdate((draft) => ({ ...draft, stats: { ...draft.stats, [key]: value } }))
  }

  return (
    <section className="combatant-card">
      <div className="combatant-header">
        <input className="name-input" value={member.name} onChange={updateName} aria-label="Имя бойца" />
        <div>
          <span>Сила</span>
          <strong>{formatNumber(calculateCombatantPower(member))}</strong>
        </div>
      </div>

      <div className="stats-grid">
        {statFields.map((field) => (
          <label key={field.key}>
            {field.label}
            <input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={member.stats[field.key]}
              onChange={(event) => updateStat(field.key, Number(event.target.value))}
            />
          </label>
        ))}
      </div>

      <div className="breakdown">
        <span>EHP {formatNumber(breakdown.effectiveHealth)}</span>
        <span>DPS {formatNumber(breakdown.dps, 1)}</span>
        <span>AOE x{formatNumber(breakdown.areaMultiplier, 2)}</span>
        <span>Sustain {formatNumber(breakdown.sustain, 1)}</span>
      </div>

      <button type="button" className="danger" disabled={!canRemove} onClick={onRemove}>
        Удалить
      </button>
    </section>
  )
}

function ResultsPanel({ summary }: { summary: SimulationSummary }) {
  return (
    <section className="results-panel">
      <div className="results-grid">
        <Metric label="Победы A" value={`${summary.winsA} (${formatPercent(summary.winRateA)})`} />
        <Metric label="Победы B" value={`${summary.winsB} (${formatPercent(summary.winRateB)})`} />
        <Metric label="Ничьи" value={String(summary.draws)} />
        <Metric label="Средняя длительность" value={`${formatNumber(summary.averageDuration, 1)} c`} />
        <Metric label="Среднее HP A" value={formatNumber(summary.averageRemainingHealthA, 1)} />
        <Metric label="Среднее HP B" value={formatNumber(summary.averageRemainingHealthB, 1)} />
      </div>

      <h2>Лог примерного боя</h2>
      <ol className="battle-log">
        {summary.sampleBattle.log.map((entry, index) => (
          <li key={`${entry.time}-${index}`}>
            <span>{formatNumber(entry.time, 2)} c</span>
            {' '}
            {entry.actor} {formatLogAction(entry.type)} {entry.target}:{' '}
            {formatNumber(entry.damage, 1)} урона, HP цели{' '}
            {formatNumber(entry.targetHealthAfter, 1)}
            {entry.isCrit ? ' (крит)' : ''}
            {entry.lifesteal > 0 ? `, лечение ${formatNumber(entry.lifesteal, 1)}` : ''}
            {entry.defeated.length > 0 ? `, выбыл: ${entry.defeated.join(', ')}` : ''}
          </li>
        ))}
      </ol>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function GddPage({ markdown }: { markdown: string }) {
  return (
    <main className="gdd-shell">
      <header className="gdd-header">
        <div>
          <h1>ГДД симулятора боя</h1>
        </div>
        <a className="gdd-link" href={import.meta.env.BASE_URL}>
          К симулятору
        </a>
      </header>
      <article className="gdd-document">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </article>
    </main>
  )
}

function formatLogAction(type: SimulationSummary['sampleBattle']['log'][number]['type']): string {
  if (type === 'area') return 'массово атакует'
  if (type === 'thorns') return 'бьет шипами'
  return 'атакует'
}

export default App
