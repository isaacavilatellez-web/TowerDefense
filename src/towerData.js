import { GAME_CONFIG } from './config.js';

export function getTowerStats(type, level, buffs = {}) {
  const base = GAME_CONFIG.towers[type];
  const levelMultiplier = 1 + (level - 1) * 0.55;
  const damageBuff = type === 'gunner' ? (1 + (buffs.gunner_damage || 0)) : 1;
  const flameBuff = type === 'flame' ? (1 + (buffs.flame_damage || 0)) : 1;
  return {
    ...base,
    level,
    damage: Math.round(base.damage * levelMultiplier * damageBuff * flameBuff),
    cooldown: base.cooldown / (1 + (buffs.attack_speed || 0)),
    range: base.range * (1 + (buffs.range || 0)) * (1 + (level - 1) * 0.04),
    splash: base.splash * (1 + (buffs.cannon_splash || 0)),
  };
}

export function towerCost(type, level = 1) {
  return Math.round(GAME_CONFIG.towers[type].cost * Math.pow(1.55, level - 1));
}
