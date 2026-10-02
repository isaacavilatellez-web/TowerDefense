import { GAME_CONFIG, getLevelDifficulty } from './config.js';

export const ENEMY_ALIASES = { basic: 'normal', normal: 'normal', runner: 'runner', tank: 'tank', armored: 'armored', regenerator: 'regenerator', miniBoss: 'mini', mini: 'mini', finalBoss: 'boss', boss: 'boss' };
export function canonicalEnemyKind(kind) { return ENEMY_ALIASES[kind] || 'normal'; }

export function createEnemy(kind, level, path, id, overrides = {}) {
  const canonical = canonicalEnemyKind(kind);
  const base = GAME_CONFIG.enemies[canonical];
  const difficulty = getLevelDifficulty(level);
  const hpMultiplier = Number.isFinite(overrides.hpMultiplier) ? overrides.hpMultiplier : difficulty.enemyHpMultiplier;
  const speedMultiplier = Number.isFinite(overrides.speedMultiplier) ? overrides.speedMultiplier : difficulty.enemySpeedMultiplier;
  const hp = base.hp * hpMultiplier;
  const segmentLengths = path.slice(0, -1).map((point, index) => Math.hypot(path[index + 1].x - point.x, path[index + 1].y - point.y));
  return {
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
  };
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
