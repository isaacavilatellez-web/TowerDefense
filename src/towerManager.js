import { getTowerStats, towerCost } from './towerData.js';
import { enemyPosition } from './enemyData.js';

export class TowerManager {
  constructor(game) { this.game = game; }

  buy(type) {
    const cost = towerCost(type);
    if (this.game.run.coins < cost) return false;
    this.game.run.coins -= cost;
    this.game.run.placingType = type;
    this.game.run.placementPreview = null;
    this.game.run.drag = { mode: 'place', type, moved: false };
    this.game.feedback('Arrastra la defensa hasta una zona verde', 'info');
    return true;
  }

  place(spot) {
    if (!spot || spot.occupied || !this.game.run.placingType) return false;
    const tower = { id: `tower-${Date.now()}-${Math.random()}`, type: this.game.run.placingType, level: 1, x: spot.x, y: spot.y, cooldown: 0, priority: 'first' };
    spot.occupied = true;
    this.game.run.towers.push(tower);
    this.game.run.placingType = null;
    this.game.run.placementPreview = null;
    this.game.run.drag = null;
    this.game.run.selectedTowerId = tower.id;
    this.game.feedback('Defensa colocada', 'success');
    return true;
  }

  canPlaceAt(point) {
    const run = this.game.run;
    if (!point || !run.placingType) return false;
    const spot = run.map.buildSpots.find((item) => !item.occupied && Math.hypot(item.x - point.x, item.y - point.y) < 36);
    return Boolean(spot);
  }

  select(tower) { this.game.run.selectedTowerId = tower?.id || null; }

  merge(aId, bId) {
    const towers = this.game.run.towers;
    const a = towers.find((item) => item.id === aId);
    const b = towers.find((item) => item.id === bId);
    if (!a || !b || a.id === b.id || a.type !== b.type || a.level !== b.level) return false;
    a.level += 1;
    const spot = this.game.run.map.buildSpots.find((item) => Math.abs(item.x - b.x) < 2 && Math.abs(item.y - b.y) < 2);
    if (spot) spot.occupied = false;
    this.game.run.towers = towers.filter((item) => item.id !== b.id);
    this.game.run.selectedTowerId = a.id;
    this.game.run.mergeFx = { x: a.x, y: a.y, until: performance.now() + 520 };
    this.game.feedback(`FUSIÓN · NIVEL ${a.level}`, 'merge');
    return true;
  }

  tick(seconds) {
    for (const tower of this.game.run.towers) {
      tower.cooldown -= seconds;
      if (tower.cooldown > 0) continue;
      const stats = getTowerStats(tower.type, tower.level, this.game.run.buffs);
      const targets = this.game.run.enemies.filter((enemy) => enemy.alive && this.inRange(tower, enemy, stats.range));
      if (!targets.length) continue;
      const target = this.pickTarget(targets, tower.priority);
      this.fire(tower, target, stats);
      tower.cooldown = stats.cooldown;
    }
  }

  inRange(tower, enemy, range) {
    const position = enemyPosition(enemy);
    return Math.hypot(position.x - tower.x, position.y - tower.y) <= range;
  }

  pickTarget(targets, priority) {
    if (priority === 'strong') return [...targets].sort((a, b) => b.hp - a.hp)[0];
    if (priority === 'weak') return [...targets].sort((a, b) => a.hp - b.hp)[0];
    if (priority === 'boss') return targets.find((item) => item.kind === 'boss' || item.kind === 'mini') || targets[0];
    if (priority === 'last') return [...targets].sort((a, b) => a.progress - b.progress)[0];
    return [...targets].sort((a, b) => b.progress - a.progress)[0];
  }

  fire(tower, target, stats) {
    const position = enemyPosition(target);
    this.game.run.projectiles.push({ from: { x: tower.x, y: tower.y }, to: position, targetId: target.id, towerType: tower.type, damage: stats.damage, splash: stats.splash, life: 0.16, maxLife: 0.16 });
  }
}
