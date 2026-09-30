import { GAME_CONFIG } from './config.js';
import { getTowerStats, towerCost } from './towerData.js';
import { enemyPosition } from './enemyData.js';

export class TowerManager {
  constructor(game) { this.game = game; }

  buy(type) {
    if (this.game.run?.placingType) return false;
    const level = this.game.towerLevel(type);
    const cost = towerCost(type, level);
    if (this.game.run.coins < cost) return false;
    this.game.run.placingType = type;
    this.game.run.placingLevel = level;
    this.game.run.selectedTowerId = null;
    this.game.run.mergeableTowerIds = new Set();
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
    run.mergeableTowerIds = new Set();
    return true;
  }

  place(point) {
    const run = this.game.run;
    if (!point || !run.placingType || !this.canPlaceAt(point)) return false;
    const cost = towerCost(run.placingType, run.placingLevel || 1);
    if (run.coins < cost) return false;
    run.coins -= cost;
    const tower = { id: `tower-${Date.now()}-${Math.random()}`, type: run.placingType, level: run.placingLevel || 1, x: point.x, y: point.y, cooldown: 0, priority: 'first' };
    run.towers.push(tower);
    run.placingType = null;
    run.placingLevel = 1;
    run.placementPreview = null;
    run.drag = null;
    run.mergeTargetId = null;
    run.mergeableTowerIds = new Set();
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

  closestPathPoint(point) {
    const paths = this.game.run?.map?.paths || [this.game.run?.map?.points || []];
    let closest = null;
    for (const path of paths) {
      for (let index = 0; index < path.length - 1; index += 1) {
        const start = path[index];
        const end = path[index + 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));
        const candidate = { x: start.x + dx * t, y: start.y + dy * t };
        const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
        if (!closest || distance < closest.distance) closest = { ...candidate, distance, start, end };
      }
    }
    return closest;
  }

  getPlacementCollision(point, type = this.game.run?.placingType, ignoreIds = []) {
    const run = this.game.run;
    if (!run || !point || !type) return { reason: 'missing', normal: { x: 0, y: -1 } };
    const { width, height } = GAME_CONFIG.map;
    const { pathClearance, towerSeparation, edgeMargin } = GAME_CONFIG.placement;
    const edgeHits = [
      { hit: point.x < edgeMargin, normal: { x: 1, y: 0 } },
      { hit: point.x > width - edgeMargin, normal: { x: -1, y: 0 } },
      { hit: point.y < edgeMargin, normal: { x: 0, y: 1 } },
      { hit: point.y > height - edgeMargin, normal: { x: 0, y: -1 } },
    ].filter((item) => item.hit);
    if (edgeHits.length) return { reason: 'edge', normal: edgeHits[0].normal };

    const closest = this.closestPathPoint(point);
    if (closest && closest.distance < pathClearance) {
      let nx = point.x - closest.x;
      let ny = point.y - closest.y;
      const length = Math.hypot(nx, ny);
      if (length < 0.001) {
        const dx = closest.end.x - closest.start.x;
        const dy = closest.end.y - closest.start.y;
        const segmentLength = Math.hypot(dx, dy) || 1;
        nx = -dy / segmentLength;
        ny = dx / segmentLength;
      } else {
        nx /= length;
        ny /= length;
      }
      return { reason: 'path', normal: { x: nx, y: ny }, closest };
    }

    const tower = run.towers.find((item) => !ignoreIds.includes(item.id) && Math.hypot(item.x - point.x, item.y - point.y) < towerSeparation);
    if (tower) {
      let nx = point.x - tower.x;
      let ny = point.y - tower.y;
      const length = Math.hypot(nx, ny) || 1;
      return { reason: 'tower', normal: { x: nx / length, y: ny / length }, tower };
    }
    return null;
  }

  getPlacementValidation(point, type = this.game.run?.placingType) {
    if (!this.game.run || !point || !type) return { valid: false, reason: 'missing' };
    const collision = this.getPlacementCollision(point, type);
    return collision ? { valid: false, reason: collision.reason } : { valid: true, reason: 'terrain' };
  }

  slidePlacement(start, desired, type = this.game.run?.placingType) {
    if (!start || !desired) return null;
    let current = { ...start };
    for (let iteration = 0; iteration < 220; iteration += 1) {
      const remaining = { x: desired.x - current.x, y: desired.y - current.y };
      const remainingDistance = Math.hypot(remaining.x, remaining.y);
      if (remainingDistance < 0.5) break;
      const travel = Math.min(5, remainingDistance);
      const unit = { x: remaining.x / remainingDistance, y: remaining.y / remainingDistance };
      const step = { x: unit.x * travel, y: unit.y * travel };
      const candidate = { x: current.x + step.x, y: current.y + step.y };
      if (this.getPlacementValidation(candidate, type).valid) {
        current = candidate;
        continue;
      }
      const collision = this.getPlacementCollision(candidate, type);
      if (!collision) continue;
      let low = 0;
      let high = 1;
      for (let iteration = 0; iteration < 6; iteration += 1) {
        const middle = (low + high) / 2;
        const probe = { x: current.x + step.x * middle, y: current.y + step.y * middle };
        if (this.getPlacementValidation(probe, type).valid) low = middle;
        else high = middle;
      }
      current = { x: current.x + step.x * low, y: current.y + step.y * low };
      const outward = { x: current.x + collision.normal.x * 0.8, y: current.y + collision.normal.y * 0.8 };
      if (this.getPlacementValidation(outward, type).valid) current = outward;
      let tangent = { x: -collision.normal.y, y: collision.normal.x };
      const tangentDistance = remaining.x * tangent.x + remaining.y * tangent.y;
      if (Math.abs(tangentDistance) < 0.01) break;
      if (tangentDistance < 0) tangent = { x: -tangent.x, y: -tangent.y };
      const tangentTravel = Math.min(travel, Math.abs(tangentDistance));
      const tangentPosition = { x: current.x + tangent.x * tangentTravel, y: current.y + tangent.y * tangentTravel };
      if (this.getPlacementValidation(tangentPosition, type).valid) {
        current = tangentPosition;
      } else if (this.getPlacementValidation({ x: current.x + tangent.x * tangentTravel * 0.5, y: current.y + tangent.y * tangentTravel * 0.5 }, type).valid) {
        current = { x: current.x + tangent.x * tangentTravel * 0.5, y: current.y + tangent.y * tangentTravel * 0.5 };
      }
    }
    return this.getPlacementValidation(current, type).valid ? current : null;
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
    this.game.run.mergeableTowerIds = new Set();
    this.game.run.mergeFx = { x: destinationPosition.x, y: destinationPosition.y, from: sourcePosition, type: b.type, level: sourceLevel, resultId: b.id, until: performance.now() + 620, started: performance.now() };
    this.game.feedback(`FUSIÓN · NIVEL ${b.level}`, 'merge');
    return true;
  }

  mergePurchased(type, targetId) {
    const run = this.game.run;
    const target = run.towers.find((item) => item.id === targetId);
    const level = run.placingLevel || 1;
    if (!run.placingType || run.placingType !== type || !target || target.type !== type || target.level !== level) return false;
    const cost = towerCost(type, level);
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
    run.mergeableTowerIds = new Set();
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
    this.game.run.projectiles.push({ from: { x: tower.x, y: tower.y }, to: position, targetId: target.id, towerType: tower.type, damage: stats.damage, splash: stats.splash, chain: stats.chain, chainRange: stats.chainRange, chainDamage: stats.chainDamage, slowFactor: stats.slowFactor, slowDuration: stats.slowDuration, life: 0.16, maxLife: 0.16 });
  }
}
