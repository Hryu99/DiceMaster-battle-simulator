import type { Combatant, Team } from './types'

export const createCombatant = (id: string, name: string, overrides: Partial<Combatant['stats']> = {}): Combatant => ({
  id,
  name,
  stats: {
    attack: 25,
    health: 100,
    armor: 10,
    attackSpeed: 100,
    critChance: 0,
    critDamage: 150,
    lifesteal: 0,
    areaAttack: 0,
    thorns: 0,
    ...overrides,
  },
})

export const initialTeamA: Team = {
  name: 'Герой',
  members: [
    createCombatant('a-1', 'Герой_1'),
  ],
}

export const initialTeamB: Team = {
  name: 'Монстр',
  members: [
    createCombatant('b-1', 'Монстр_1'),
  ],
}
