import { GAME_CONFIG, getLevelDifficulty } from './config.js';

export function createEnemy(kind, level, path, id) {
  const base = GAME_CONFIG.enemies[kind];
  const difficulty = getLevelDifficulty(level);
  const hp = kind === 'boss' ? difficulty.bossHp : base.hp * difficulty.enemyHpMultiplier;
  return {
    id,
    kind,
    name: base.name,
    hp,
    maxHp: hp,
    speed: base.speed * difficulty.enemySpeedMultiplier,
    reward: Math.round(base.reward * (1 + level * 0.08)),
    color: base.color,
    radius: base.radius,
    progress: 0,
    path,
    alive: true,
    shield: kind === 'mini' ? hp * 0.18 : kind === 'boss' ? hp * 0.28 : 0,
    regen: kind === 'mini' ? hp * 0.008 : 0,
    pulse: 0,
  };
}

export function enemyPosition(enemy) {
  const points = enemy.path;
  const scaled = enemy.progress * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const t = scaled - index;
  const a = points[index];
  const b = points[index + 1];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
