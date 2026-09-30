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
    chain: base.chain || 0,
    chainRange: base.chainRange || 0,
    chainDamage: base.chainDamage || 0,
    slowFactor: base.slowFactor || 1,
    slowDuration: base.slowDuration || 0,
  };
}

export function towerCost(type, level = 1) {
  // El nivel permanente mejora las estadísticas iniciales, pero no encarece
  // la carta ni ninguna de las formas de comprarla durante la partida.
  return GAME_CONFIG.towers[type]?.cost || 0;
}
