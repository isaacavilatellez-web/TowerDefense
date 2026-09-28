import { GAME_CONFIG } from './config.js';
import { getTowerStats, towerCost } from './towerData.js';
import { enemyPosition } from './enemyData.js';

export class TowerManager {
  constructor(game) { this.game = game; }

  buy(type) {
    if (this.game.run?.placingType) return false;
    const cost = towerCost(type);
    if (this.game.run.coins < cost) return false;
    const level = this.game.towerLevel(type);
    this.game.run.placingType = type;
    this.game.run.placingLevel = level;
    this.game.run.placementPreview = null;
    this.game.run.mergeTargetId = null;
    this.game.run.drag = { mode: 'place', type, level, pointerId: null, moved: false, fromShop: true };
    this.game.feedback('Arrastra la defensa hasta una zona verde', 'info');
    return true;
  }

  cancelPlacement() {
    const run = this.game.run;
    if (!run?.placingType) return false;
    run.placingType = null;
    run.placingLevel = 1;
    run.placementPreview = null;
    run.drag = null;
    run.mergeTargetId = null;
    return true;
  }

  place(point) {
    const run = this.game.run;
    if (!point || !run.placingType || !this.canPlaceAt(point)) return false;
    const cost = towerCost(run.placingType);
    if (run.coins < cost) return false;
    run.coins -= cost;
    const tower = { id: `tower-${Date.now()}-${Math.random()}`, type: run.placingType, level: run.placingLevel || 1, x: point.x, y: point.y, cooldown: 0, priority: 'first' };
    run.towers.push(tower);
    run.placingType = null;
    run.placingLevel = 1;
    run.placementPreview = null;
    run.drag = null;
    run.mergeTargetId = null;
    run.selectedTowerId = tower.id;
    this.game.feedback('Defensa colocada', 'success');
    return true;
  }

  canPlaceAt(point) {
    const run = this.game.run;
    if (!point || !run.placingType) return false;
    return this.getPlacementValidation(point, run.placingType).valid;
  }

  distanceToPath(point) {
    const paths = this.game.run?.map?.paths || [this.game.run?.map?.points || []];
    return paths.reduce((closestPath, path) => Math.min(closestPath, path.slice(0, -1).reduce((closest, start, index) => {
      const end = path[index + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));
      return Math.min(closest, Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t)));
    }, Infinity)), Infinity);
  }

  getPlacementValidation(point, type = this.game.run?.placingType) {
    const run = this.game.run;
    if (!run || !point || !type) return { valid: false, reason: 'missing' };
    const { width, height } = GAME_CONFIG.map;
    const { pathClearance, towerSeparation, edgeMargin } = GAME_CONFIG.placement;
    if (point.x < edgeMargin || point.x > width - edgeMargin || point.y < edgeMargin || point.y > height - edgeMargin) return { valid: false, reason: 'edge' };
    if (this.distanceToPath(point) < pathClearance) return { valid: false, reason: 'path' };
    if (run.towers.some((tower) => Math.hypot(tower.x - point.x, tower.y - point.y) < towerSeparation)) return { valid: false, reason: 'tower' };
    return { valid: true, reason: 'terrain' };
  }

  findNearestValidPosition(point, type = this.game.run?.placingType) {
    if (this.getPlacementValidation(point, type).valid) return point;
    for (let radius = 14; radius <= 96; radius += 10) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const candidate = { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius };
        if (this.getPlacementValidation(candidate, type).valid) return candidate;
      }
    }
    return null;
  }

  select(tower) { this.game.run.selectedTowerId = tower?.id || null; }

  merge(aId, bId) {
    const towers = this.game.run.towers;
    const a = towers.find((item) => item.id === aId);
    const b = towers.find((item) => item.id === bId);
    if (!a || !b || a.id === b.id || a.type !== b.type || a.level !== b.level) return false;
    const sourcePosition = { x: a.x, y: a.y };
    const destinationPosition = { x: b.x, y: b.y };
    const sourceLevel = a.level;
    b.level += 1;
    b.cooldown = 0;
    this.game.run.towers = towers.filter((item) => item.id !== a.id);
    this.game.run.selectedTowerId = b.id;
    this.game.run.mergeFx = { x: destinationPosition.x, y: destinationPosition.y, from: sourcePosition, type: b.type, level: sourceLevel, resultId: b.id, until: performance.now() + 620, started: performance.now() };
    this.game.feedback(`FUSIÓN · NIVEL ${b.level}`, 'merge');
    return true;
  }

  mergePurchased(type, targetId) {
    const run = this.game.run;
    const target = run.towers.find((item) => item.id === targetId);
    const level = run.placingLevel || 1;
    if (!run.placingType || run.placingType !== type || !target || target.type !== type || target.level !== level) return false;
    const cost = towerCost(type);
    if (run.coins < cost) return false;
    run.coins -= cost;
    const sourceLevel = target.level;
    target.level += 1;
    target.cooldown = 0;
    run.placingType = null;
    run.placingLevel = 1;
    run.placementPreview = null;
    run.drag = null;
    run.mergeTargetId = null;
    run.selectedTowerId = target.id;
    run.mergeFx = { x: target.x, y: target.y, from: { x: target.x, y: target.y }, type: target.type, level: sourceLevel, resultId: target.id, until: performance.now() + 620, started: performance.now() };
    this.game.feedback(`FUSIÓN DIRECTA · NIVEL ${target.level}`, 'merge');
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
