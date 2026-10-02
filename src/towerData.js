import { GAME_CONFIG } from './config.js';

const RANGE_UNIT = 130;
const EVO_DAMAGE = {
  gunner: [1, 1.04, 1.08, 1.12, 1.18], cannon: [1, 1.05, 1.1, 1.14, 1.2],
  flame: [1, 1.04, 1.08, 1.12, 1.17], mortar: [1, 1.03, 1.07, 1.1, 1.15],
  tesla: [1, 1.04, 1.08, 1.12, 1.18], sniper: [1, 1.03, 1.06, 1.09, 1.13],
};

const evolutionData = {
  gunner: [{ barrels: 1 }, { barrels: 2 }, { barrels: 4, smartAssignment: true }, { barrels: 4, rotating: true, maxCooldown: .1 }, { barrels: 4, rotating: true, maxCooldown: .1, multiTarget: true }],
  cannon: [{ splash: 0 }, { splash: 38 }, { splash: 38, salvo: 2, smartAssignment: true }, { splash: 52, salvo: 2, edgeFalloff: .8, smartAssignment: true }, { splash: 52, salvo: 4, edgeFalloff: .9, smartAssignment: true, bossPriority: true }],
  flame: [{ coneAngle: .42 }, { coneAngle: .62, burnDuration: 2 }, { coneAngle: .82, burnDuration: 3, regenReduction: .5 }, { coneAngle: .82, burnDuration: 3, groundFire: 2, regenReduction: .5 }, { coneAngle: .95, burnDuration: 3, groundFire: 3, regenReduction: 1 }],
  mortar: [{ salvo: 1, splash: 22 }, { salvo: 2, splash: 22 }, { salvo: 4, splash: 26, smartAssignment: true }, { salvo: 8, splash: 30, smartAssignment: true, reassign: true }, { salvo: 16, splash: 34, smartAssignment: true, reassign: true, bossPriority: true }],
  tesla: [{ chain: 3, chainDamages: [20, 10, 5] }, { chain: 4, chainDamages: [20, 14, 8, 5], cooldown: .82 }, { chain: 5, chainDamages: [20, 15, 10, 8, 6], cooldown: .82, chainFalloff: .85 }, { chain: 6, chainDamages: [20, 16, 12, 9, 7, 5], cooldown: .82, chainRange: 112, chainFalloff: .9 }, { chain: 8, chainDamages: [20, 20, 20, 20, 20, 20, 20, 20], cooldown: .82, chainRange: 125, chainFalloff: 1, electricSlow: .85, electricSlowDuration: .35 }],
  sniper: [{ slowFactor: .7, slowDuration: 1 }, { slowFactor: .6, slowDuration: 1, freezeDuration: .3 }, { slowFactor: .5, slowDuration: 1.2, freezeDuration: .5 }, { slowFactor: .5, slowDuration: 1.2, freezeDuration: .5, vulnerability: .1 }, { slowFactor: .4, slowDuration: 1.5, freezeDuration: .7, vulnerability: .1, rangeBonus: 1.05 }],
};

export function getTowerStats(type, level = 1, buffs = {}, permanentLevel = 1) {
  const base = GAME_CONFIG.towers[type];
  if (!base) return null;
  const evolution = Math.max(1, Math.min(5, Number(level) || 1));
  const permanent = Math.max(1, Math.min(GAME_CONFIG.economy.permanent.maxTowerLevel, Number(permanentLevel) || 1));
  const evo = evolutionData[type]?.[evolution - 1] || {};
  const damageBuff = type === 'gunner' ? (1 + (buffs.gunner_damage || 0)) : 1;
  const flameBuff = type === 'flame' ? (1 + (buffs.flame_damage || 0)) : 1;
  const damage = base.damage * (EVO_DAMAGE[type]?.[evolution - 1] || 1) * Math.pow(1.1, permanent - 1) * damageBuff * flameBuff;
  const cooldown = (evo.cooldown || base.cooldown) / (1 + (buffs.attack_speed || 0));
  return {
    ...base, level: evolution, evolution, permanentLevel: permanent, damage, displayDamage: Math.round(damage), cooldown,
    range: RANGE_UNIT * (base.rangeRelative || 1) * (evo.rangeBonus || 1) * (1 + (buffs.range || 0)),
    splash: (evo.splash || 0) * (1 + (buffs.cannon_splash || 0)), barrels: evo.barrels || 1, salvo: evo.salvo || 1,
    smartAssignment: Boolean(evo.smartAssignment), reassign: Boolean(evo.reassign), bossPriority: Boolean(evo.bossPriority),
    rotating: Boolean(evo.rotating), maxCooldown: evo.maxCooldown || cooldown, edgeFalloff: evo.edgeFalloff || .45,
    coneAngle: evo.coneAngle || 0, burnDuration: evo.burnDuration || 0, groundFire: evo.groundFire || 0, regenReduction: evo.regenReduction || 0,
    chain: evo.chain || 0, chainRange: evo.chainRange || base.chainRange || 0, chainDamages: (evo.chainDamages || []).map((value) => value * damage / base.damage), chainFalloff: evo.chainFalloff ?? .65,
    electricSlow: evo.electricSlow || 1, electricSlowDuration: evo.electricSlowDuration || 0,
    slowFactor: evo.slowFactor || 1, slowDuration: evo.slowDuration || 0, freezeDuration: evo.freezeDuration || 0, vulnerability: evo.vulnerability || 0,
  };
}

export function towerCost(type) { return GAME_CONFIG.towers[type]?.cost || 0; }
export { RANGE_UNIT, evolutionData };
