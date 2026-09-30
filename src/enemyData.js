import { GAME_CONFIG, getLevelDifficulty } from './config.js';

export function createEnemy(kind, level, path, id, options = {}) {
  const base = GAME_CONFIG.enemies[kind];
  const difficulty = getLevelDifficulty(level);
  const hpMultiplier = Number.isFinite(options.hpMultiplier) ? options.hpMultiplier : difficulty.enemyHpMultiplier;
  const speedMultiplier = Number.isFinite(options.speedMultiplier) ? options.speedMultiplier : difficulty.enemySpeedMultiplier;
  const hp = kind === 'boss' ? (options.bossHp || difficulty.bossHp) : base.hp * hpMultiplier;
  const segmentLengths = path.slice(0, -1).map((point, index) => Math.hypot(path[index + 1].x - point.x, path[index + 1].y - point.y));
  return {
    id,
    kind,
    name: base.name,
    hp,
    maxHp: hp,
    speed: base.speed * speedMultiplier,
    reward: Math.round(base.reward * (1 + Math.min(
      GAME_CONFIG.economy.rewardLevelBonusCap,
      Math.max(0, level - 1) * GAME_CONFIG.economy.rewardLevelStep,
    ))),
    segmentLengths,
    pathLength: segmentLengths.reduce((sum, length) => sum + length, 0),
    color: base.color,
    radius: base.radius,
    progress: 0,
    path,
    alive: true,
    shield: kind === 'mini' ? hp * 0.18 : kind === 'boss' ? hp * 0.28 : 0,
    // La regeneración se declara en los datos del enemigo. No se aplica por
    // tipo automáticamente para evitar que el enemigo rosa recupere vida sin
    // que exista una regla de diseño explícita.
    regen: base.regen || 0,
    slowFactor: 1,
    slowTimer: 0,
    pulse: 0,
    threat: Number.isFinite(options.threat) ? options.threat : ({ normal: 1, runner: 1.15, tank: 2.8, mini: 6, boss: 10 }[kind] || 1),
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
