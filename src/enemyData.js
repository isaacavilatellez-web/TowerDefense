import { GAME_CONFIG, getLevelDifficulty } from './config.js';

export const ENEMY_ALIASES = { basic: 'normal', normal: 'normal', runner: 'runner', tank: 'tank', armored: 'armored', regenerator: 'regenerator', miniBoss: 'mini', mini: 'mini', finalBoss: 'boss', boss: 'boss' };
export function canonicalEnemyKind(kind) { return ENEMY_ALIASES[kind] || 'normal'; }

const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Las partidas infinitas se serializan entre frames. Un guardado antiguo o
// parcial no debe convertir el combate en NaN (un enemigo con hp NaN nunca
// puede morir y su barra tampoco puede dibujarse).
export function normalizeEnemyCombatState(enemy) {
  if (!enemy || typeof enemy !== 'object') return null;
  const kind = canonicalEnemyKind(enemy.kind);
  const base = GAME_CONFIG.enemies[kind] || GAME_CONFIG.enemies.normal;
  const savedHp = Number(enemy.hp);
  const savedMaxHp = Number(enemy.maxHp);
  const maxHp = Math.max(1, Number.isFinite(savedMaxHp) && savedMaxHp > 0
    ? savedMaxHp
    : Number.isFinite(savedHp) && savedHp > 0 ? savedHp : base.hp);
  enemy.kind = kind;
  enemy.name = enemy.name || base.name;
  enemy.maxHp = maxHp;
  enemy.hp = clamp(Number.isFinite(savedHp) ? savedHp : maxHp, 0, maxHp);
  enemy.alive = enemy.alive !== false && enemy.hp > 0;
  enemy.id = enemy.id ?? `enemy-${Math.random().toString(36).slice(2)}`;
  enemy.radius = Math.max(1, finiteOr(enemy.radius, base.radius || 8));
  enemy.progress = clamp(finiteOr(enemy.progress, 0), 0, 1);
  enemy.path = Array.isArray(enemy.path) && enemy.path.length ? enemy.path : [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  enemy.path = enemy.path.map((point) => ({ x: finiteOr(point?.x, 0), y: finiteOr(point?.y, 0) }));
  enemy.segmentLengths = Array.isArray(enemy.segmentLengths) && enemy.segmentLengths.length === Math.max(0, enemy.path.length - 1)
    ? enemy.segmentLengths.map((length, index) => Math.max(0, finiteOr(length, Math.hypot(enemy.path[index + 1].x - enemy.path[index].x, enemy.path[index + 1].y - enemy.path[index].y))))
    : enemy.path.slice(0, -1).map((point, index) => Math.hypot(enemy.path[index + 1].x - point.x, enemy.path[index + 1].y - point.y));
  const computedPathLength = enemy.segmentLengths.reduce((sum, length) => sum + length, 0);
  enemy.pathLength = Math.max(0, finiteOr(enemy.pathLength, computedPathLength) || computedPathLength);
  enemy.speedRelative = finiteOr(enemy.speedRelative, base.speedRelative || 1);
  enemy.speed = Math.max(0, finiteOr(enemy.speed, .026 * enemy.speedRelative));
  enemy.shelterDamage = enemy.shelterDamage ?? base.shelterDamage;
  enemy.reward = finiteOr(enemy.reward, base.reward || 0);
  enemy.slowFactor = clamp(finiteOr(enemy.slowFactor, 1), .01, 1);
  enemy.slowTimer = Math.max(0, finiteOr(enemy.slowTimer, 0));
  enemy.freezeTimer = Math.max(0, finiteOr(enemy.freezeTimer, 0));
  enemy.freezeImmunity = Math.max(0, finiteOr(enemy.freezeImmunity, 0));
  enemy.pulse = Math.max(0, finiteOr(enemy.pulse, 0));
  enemy.regenRate = Math.max(0, finiteOr(enemy.regenRate, base.regen || 0));
  enemy.regenSuppressed = Math.max(0, finiteOr(enemy.regenSuppressed, 0));
  enemy.regenReduction = clamp(finiteOr(enemy.regenReduction, 0), 0, 1);
  enemy.vulnerability = clamp(finiteOr(enemy.vulnerability, 0), 0, 1);
  enemy.vulnerabilityTimer = Math.max(0, finiteOr(enemy.vulnerabilityTimer, 0));
  const savedBurn = enemy.burn;
  enemy.burn = savedBurn && typeof savedBurn === 'object' && finiteOr(savedBurn.duration, 0) > 0 && finiteOr(savedBurn.damagePerSecond, 0) > 0
    ? { duration: finiteOr(savedBurn.duration, 0), damagePerSecond: finiteOr(savedBurn.damagePerSecond, 0) } : null;
  enemy.previousPosition = enemy.previousPosition && Number.isFinite(enemy.previousPosition.x) && Number.isFinite(enemy.previousPosition.y)
    ? enemy.previousPosition
    : { x: enemy.path[0].x, y: enemy.path[0].y };
  enemy.armorReduction = clamp(finiteOr(enemy.armorReduction, base.armorReduction || 0), 0, .999999);
  enemy.damageResistance = clamp(finiteOr(enemy.damageResistance ?? enemy.resistance, base.damageResistance || 0), 0, .999999);
  enemy.controlResistance = clamp(finiteOr(enemy.controlResistance, base.controlResistance || 0), 0, .999999);
  const savedShield = finiteOr(enemy.shield ?? enemy.shieldHp, 0);
  const savedMaxShield = finiteOr(enemy.maxShield, savedShield);
  enemy.maxShield = Math.max(0, savedMaxShield);
  enemy.shield = clamp(savedShield, 0, enemy.maxShield || savedShield);
  enemy.lastImpact = enemy.lastImpact && typeof enemy.lastImpact === 'object' ? enemy.lastImpact : null;
  return enemy;
}

export function createEnemy(kind, level, path, id, overrides = {}) {
  const canonical = canonicalEnemyKind(kind);
  const base = GAME_CONFIG.enemies[canonical];
  const difficulty = getLevelDifficulty(level);
  const hpMultiplier = Number.isFinite(overrides.hpMultiplier) ? overrides.hpMultiplier : difficulty.enemyHpMultiplier;
  const speedMultiplier = Number.isFinite(overrides.speedMultiplier) ? overrides.speedMultiplier : difficulty.enemySpeedMultiplier;
  const hp = base.hp * hpMultiplier;
  const segmentLengths = path.slice(0, -1).map((point, index) => Math.hypot(path[index + 1].x - point.x, path[index + 1].y - point.y));
  return normalizeEnemyCombatState({
    id,
    kind: canonical,
    name: base.name,
    hp,
    maxHp: hp,
    speed: .026 * base.speedRelative * speedMultiplier,
    speedRelative: base.speedRelative,
    shelterDamage: base.shelterDamage,
    reward: Math.round(base.reward * (1 + Math.min(
      GAME_CONFIG.economy.rewardLevelBonusCap,
      Math.max(0, level - 1) * GAME_CONFIG.economy.rewardLevelStep,
    ))),
    segmentLengths,
    pathLength: segmentLengths.reduce((sum, length) => sum + length, 0),
    color: base.color,
    radius: base.radius,
    indicator: base.indicator,
    progress: 0,
    path,
    alive: true,
    armorReduction: base.armorReduction || 0,
    damageResistance: base.damageResistance || 0,
    shield: base.shield || 0,
    maxShield: base.shield || 0,
    regenRate: base.regen || 0,
    controlResistance: base.controlResistance || 0,
    slowFactor: 1,
    slowTimer: 0,
    freezeTimer: 0,
    freezeImmunity: 0,
    burn: null,
    regenSuppressed: 0,
    regenReduction: 0,
    vulnerability: 0,
    vulnerabilityTimer: 0,
    electricTimer: 0,
    pulse: 0,
    damageCounted: 0,
    selected: false,
    previousPosition: { x: path[0]?.x || 0, y: path[0]?.y || 0 },
  });
}

export function enemyPosition(enemy) {
  const points = enemy.path;
  if (!points?.length) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const lengths = enemy.segmentLengths || points.slice(0, -1).map((point, index) => Math.hypot(points[index + 1].x - point.x, points[index + 1].y - point.y));
  const total = enemy.pathLength || lengths.reduce((sum, length) => sum + length, 0);
  let distance = Math.max(0, Math.min(1, enemy.progress)) * total;
  let index = 0;
  while (index < lengths.length - 1 && distance > lengths[index]) {
    distance -= lengths[index];
    index += 1;
  }
  const t = lengths[index] ? distance / lengths[index] : 0;
  const a = points[index];
  const b = points[index + 1];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
