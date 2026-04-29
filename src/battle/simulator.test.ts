import { describe, expect, it } from 'vitest'
import { createCombatant } from './presets'
import { runSimulations, simulateBattle } from './simulator'
import type { Team } from './types'

const team = (name: string, members = [createCombatant(`${name}-1`, `${name} hero`)]): Team => ({
  name,
  members,
})

describe('battle simulator', () => {
  it('finishes a battle between teams with up to four combatants', () => {
    const result = simulateBattle(
      team('A', [
        createCombatant('a-1', 'A1'),
        createCombatant('a-2', 'A2', { areaAttack: 35 }),
        createCombatant('a-3', 'A3', { lifesteal: 10 }),
        createCombatant('a-4', 'A4', { thorns: 10 }),
      ]),
      team('B', [
        createCombatant('b-1', 'B1'),
        createCombatant('b-2', 'B2'),
        createCombatant('b-3', 'B3'),
        createCombatant('b-4', 'B4'),
      ]),
      { seed: 42 },
    )

    expect(result.events).toBeGreaterThan(0)
    expect(result.duration).toBeGreaterThan(0)
    expect(result.log[0].targetHealthAfter).toBeGreaterThanOrEqual(0)
    expect(['A', 'B', 'draw']).toContain(result.winner)
  })

  it('keeps identical teams close to an even win rate', () => {
    const mirrorA = team('A', [createCombatant('a-1', 'Mirror A')])
    const mirrorB = team('B', [createCombatant('b-1', 'Mirror B')])
    const summary = runSimulations(mirrorA, mirrorB, 500, { seed: 100 })

    expect(summary.winRateA).toBeGreaterThan(0.4)
    expect(summary.winRateA).toBeLessThan(0.6)
  })

  it('waits a full attack cooldown before the first attack', () => {
    const result = simulateBattle(
      team('A', [createCombatant('hero', 'Hero', { attack: 1, health: 1000, attackSpeed: 100, critChance: 0 })]),
      team('B', [createCombatant('monster', 'Monster', { attack: 1, health: 1000, attackSpeed: 200, critChance: 0 })]),
      { seed: 7, logLimit: 3 },
    )

    expect(result.log[0].actor).toBe('Monster')
    expect(result.log[0].time).toBeCloseTo(0.5)
    expect(result.log[1].time).toBeCloseTo(1)
    expect(result.log[2].time).toBeCloseTo(1)
  })

  it('reduces incoming damage with armor relative to hit size', () => {
    const result = simulateBattle(
      team('A', [createCombatant('hero', 'Hero', { attack: 25, health: 1000, attackSpeed: 100, critChance: 0 })]),
      team('B', [createCombatant('target', 'Target', { attack: 1, health: 1000, armor: 10, attackSpeed: 10, critChance: 0 })]),
      { seed: 7, logLimit: 1 },
    )

    expect(result.log[0].damage).toBeCloseTo(25 / (1 + 10 / 25))
  })

  it('does not reduce damage below the configured minimum multiplier', () => {
    const result = simulateBattle(
      team('A', [createCombatant('hero', 'Hero', { attack: 25, health: 1000, attackSpeed: 100, critChance: 0 })]),
      team('B', [
        createCombatant('target', 'Target', { attack: 1, health: 1000, armor: 10000, attackSpeed: 10, critChance: 0 }),
      ]),
      { seed: 7, logLimit: 1 },
    )

    expect(result.log[0].damage).toBeCloseTo(25 * 0.05)
  })

  it('applies critical damage after armor reduction', () => {
    const result = simulateBattle(
      team('A', [
        createCombatant('hero', 'Hero', {
          attack: 100,
          health: 1000,
          attackSpeed: 100,
          critChance: 100,
          critDamage: 200,
        }),
      ]),
      team('B', [
        createCombatant('target', 'Target', { attack: 1, health: 1000, armor: 25, attackSpeed: 10, critChance: 0 }),
      ]),
      { seed: 7, logLimit: 1 },
    )

    expect(result.log[0]).toMatchObject({ type: 'attack', isCrit: true })
    expect(result.log[0].damage).toBeCloseTo(160)
  })

  it('keeps attacking the same target until it dies', () => {
    const result = simulateBattle(
      team('A', [createCombatant('hero', 'Hero', { attack: 10, health: 1000, attackSpeed: 300, critChance: 0 })]),
      team('B', [
        createCombatant('enemy-1', 'Enemy 1', { attack: 1, health: 100, armor: 0, attackSpeed: 10, critChance: 0 }),
        createCombatant('enemy-2', 'Enemy 2', { attack: 1, health: 100, armor: 0, attackSpeed: 10, critChance: 0 }),
      ]),
      { seed: 11, logLimit: 6 },
    )

    const heroAttacks = result.log.filter((entry) => entry.actor === 'Hero' && entry.type === 'attack')

    expect(heroAttacks[0].target).toBe(heroAttacks[1].target)
    expect(heroAttacks[1].targetHealthAfter).toBe(80)
  })

  it('logs area attack as separate damage events for every alive enemy', () => {
    const result = simulateBattle(
      team('A', [
        createCombatant('hero', 'Hero', {
          attack: 25,
          health: 1000,
          armor: 0,
          attackSpeed: 200,
          critChance: 0,
          areaAttack: 40,
        }),
      ]),
      team('B', [
        createCombatant('enemy-1', 'Enemy 1', { attack: 1, health: 100, armor: 0, attackSpeed: 10, critChance: 0 }),
        createCombatant('enemy-2', 'Enemy 2', { attack: 1, health: 100, armor: 0, attackSpeed: 10, critChance: 0 }),
      ]),
      { seed: 17, logLimit: 3 },
    )

    expect(result.log[0]).toMatchObject({ actor: 'Hero', type: 'attack', damage: 25, targetHealthAfter: 75 })
    expect(result.log.slice(1)).toHaveLength(2)
    expect(result.log.slice(1).every((entry) => entry.actor === 'Hero' && entry.type === 'area')).toBe(true)
    expect(result.log.slice(1).map((entry) => entry.damage)).toEqual([10, 10])
    expect(result.log.slice(1).map((entry) => entry.target).sort()).toEqual(['Enemy 1', 'Enemy 2'])
  })

  it('does not trigger thorns from area attack hits', () => {
    const result = simulateBattle(
      team('A', [
        createCombatant('hero', 'Hero', {
          attack: 20,
          health: 100,
          armor: 0,
          attackSpeed: 200,
          critChance: 0,
          areaAttack: 50,
        }),
      ]),
      team('B', [
        createCombatant('thorny', 'Thorny', { attack: 1, health: 100, armor: 0, attackSpeed: 10, critChance: 0, thorns: 10 }),
        createCombatant('other', 'Other', { attack: 1, health: 100, armor: 0, attackSpeed: 10, critChance: 0, thorns: 10 }),
      ]),
      { seed: 17, logLimit: 5 },
    )

    const thornsEntries = result.log.filter((entry) => entry.type === 'thorns')

    expect(thornsEntries).toHaveLength(1)
    expect(thornsEntries[0].actor).toBe(result.log[0].target)
  })

  it('logs thorns as separate armor-reduced return damage', () => {
    const result = simulateBattle(
      team('A', [
        createCombatant('attacker', 'Attacker', {
          attack: 1,
          health: 100,
          armor: 100,
          attackSpeed: 200,
          critChance: 0,
        }),
      ]),
      team('B', [
        createCombatant('thorny', 'Thorny', {
          attack: 1,
          health: 100,
          armor: 0,
          attackSpeed: 10,
          critChance: 0,
          thorns: 10,
        }),
      ]),
      { seed: 21, logLimit: 2 },
    )

    expect(result.log[0]).toMatchObject({ actor: 'Attacker', target: 'Thorny', type: 'attack', damage: 1 })
    expect(result.log[1]).toMatchObject({
      actor: 'Thorny',
      target: 'Attacker',
      type: 'thorns',
    })
    expect(result.log[1].damage).toBeCloseTo(10 / 11)
    expect(result.log[1].targetHealthAfter).toBeCloseTo(100 - 10 / 11)
  })

  it('does not heal from area attack damage', () => {
    const result = simulateBattle(
      team('A', [
        createCombatant('hero', 'Hero', {
          attack: 20,
          health: 100,
          armor: 0,
          attackSpeed: 200,
          critChance: 0,
          lifesteal: 50,
          areaAttack: 100,
        }),
      ]),
      team('B', [
        createCombatant('enemy-1', 'Enemy 1', { attack: 80, health: 100, armor: 0, attackSpeed: 300, critChance: 0 }),
        createCombatant('enemy-2', 'Enemy 2', { attack: 1, health: 100, armor: 0, attackSpeed: 10, critChance: 0 }),
      ]),
      { seed: 17, logLimit: 6 },
    )

    const heroAttack = result.log.find((entry) => entry.actor === 'Hero' && entry.type === 'attack')

    expect(heroAttack?.damage).toBe(20)
    expect(heroAttack?.lifesteal).toBe(10)
  })

  it('makes lifesteal, area attack, and thorns affect outcomes', () => {
    const plain = team('plain', [createCombatant('plain-1', 'Plain')])
    const plainVsSwarm = team('plain-vs-swarm', [
      createCombatant('plain-vs-swarm-1', 'Plain vs swarm', { attack: 35, health: 180, armor: 10 }),
    ])
    const sustain = team('sustain', [createCombatant('sustain-1', 'Sustain', { lifesteal: 30 })])
    const aoe = team('aoe', [createCombatant('aoe-1', 'Aoe', { attack: 35, health: 180, armor: 10, areaAttack: 70 })])
    const thorns = team('thorns', [createCombatant('thorns-1', 'Thorns', { thorns: 25 })])
    const swarm = team('swarm', [
      createCombatant('swarm-1', 'Swarm 1', { attack: 18, health: 210, armor: 0 }),
      createCombatant('swarm-2', 'Swarm 2', { attack: 18, health: 210, armor: 0 }),
    ])

    expect(runSimulations(sustain, plain, 120, { seed: 1 }).winRateA).toBeGreaterThan(0.65)
    expect(runSimulations(aoe, swarm, 120, { seed: 2 }).winRateA).toBeGreaterThan(
      runSimulations(plainVsSwarm, swarm, 120, { seed: 2 }).winRateA,
    )
    expect(runSimulations(thorns, plain, 120, { seed: 3 }).winRateA).toBeGreaterThan(0.55)
  })
})
