import type { Combatant, Team } from './types'

export const createCombatant = (id: string, name: string, overrides: Partial<Combatant['stats']> = {}): Combatant => ({
  id,
  name,
  stats: {
    attack: 30,
    health: 300,
    armor: 20,
    attackSpeed: 100,
    critChance: 10,
    critDamage: 150,
    lifesteal: 0,
    areaAttack: 0,
    thorns: 0,
    ...overrides,
  },
})

export const initialTeamA: Team = {
  name: 'Команда A',
  members: [
    createCombatant('a-1', 'Рыцарь', {
      attack: 34,
      health: 360,
      armor: 38,
      attackSpeed: 85,
      thorns: 8,
    }),
    createCombatant('a-2', 'Дуэлянт', {
      attack: 28,
      health: 250,
      armor: 14,
      attackSpeed: 135,
      critChance: 22,
      critDamage: 180,
      lifesteal: 8,
    }),
  ],
}

export const initialTeamB: Team = {
  name: 'Команда B',
  members: [
    createCombatant('b-1', 'Берсерк', {
      attack: 42,
      health: 330,
      armor: 18,
      attackSpeed: 95,
      critChance: 18,
      critDamage: 170,
      lifesteal: 5,
    }),
    createCombatant('b-2', 'Маг бури', {
      attack: 24,
      health: 220,
      armor: 8,
      attackSpeed: 110,
      critChance: 12,
      critDamage: 160,
      areaAttack: 45,
    }),
  ],
}
