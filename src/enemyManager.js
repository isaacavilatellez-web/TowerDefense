import { createEnemy, enemyPosition } from './enemyData.js';

export class EnemyManager {
  constructor(game) { this.game = game; }

  spawn(kind = 'normal', options = {}) {
    const run = this.game.run;
    const paths = run.map.paths || [run.map.points];
    const pathIndex = kind === 'boss' ? 0 : kind === 'mini' ? Math.max(0, run.phaseIndex % paths.length) : (options.pathIndex ?? (run.spawned + run.ambientSpawned) % paths.length);
    const enemy = createEnemy(kind, run.level, paths[pathIndex], `enemy-${run.nextEnemyId++}`);
    run.enemies.push(enemy);
    if (kind === 'mini') this.game.feedback('MINI JEFE ENTRANTE', 'boss');
    if (kind === 'boss') { run.bossActive = true; this.game.feedback('BOSS INCOMING · THE TITAN', 'boss'); }
  }

  tick(seconds) {
    const run = this.game.run;
    for (const enemy of run.enemies) {
      if (!enemy.alive) continue;
      if (enemy.hp <= 0) {
        this.kill(enemy);
        continue;
      }
      if (enemy.regen) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * enemy.regen * seconds);
      if (enemy.slowTimer > 0) {
        enemy.slowTimer -= seconds;
        if (enemy.slowTimer <= 0) enemy.slowFactor = 1;
      }
      enemy.pulse += seconds;
      enemy.progress += enemy.speed * (enemy.slowFactor || 1) * seconds;
      if (enemy.progress >= 1) {
        enemy.alive = false;
        run.leaks += 1;
        if (run.phase) run.phaseLeaks += 1;
        if (enemy.kind === 'mini') run.miniBossActive = false;
        run.baseHp = Math.max(0, run.baseHp - (enemy.kind === 'boss' ? 30 : enemy.kind === 'mini' ? 12 : 4));
        if (enemy.kind === 'boss') this.game.endRun(false);
        if (run.baseHp <= 0) this.game.endRun(false);
      }
    }
    run.enemies = run.enemies.filter((enemy) => enemy.alive || enemy.hp <= 0);
  }

  hit(enemyId, damage, splash, origin, effect = {}) {
    const run = this.game.run;
    const target = run.enemies.find((enemy) => enemy.id === enemyId && enemy.alive);
    if (!target) return;
    const incoming = Math.max(0, Number(damage) || 0);
    const shield = Math.max(0, Number(target.shield) || 0);
    const absorbed = Math.min(shield, incoming * 0.7);
    target.shield = Math.max(0, shield - absorbed);
    const actual = Math.max(0, incoming - absorbed);
    // La vida del enemigo rosa debe disminuir de forma monotónica: el escudo
    // absorbe daño, pero nunca restaura ni puede llevar la vida por debajo de 0.
    target.hp = Math.max(0, target.hp - actual);
    this.applySlow(target, effect.slowFactor, effect.slowDuration);
    if (splash > 0) {
      for (const enemy of run.enemies) {
        if (!enemy.alive || enemy.id === target.id) continue;
        const position = enemyPosition(enemy);
        if (Math.hypot(position.x - origin.x, position.y - origin.y) <= splash) {
          enemy.hp = Math.max(0, enemy.hp - actual * 0.45);
          if (enemy.hp <= 0) this.kill(enemy);
        }
      }
    }
    if (effect.chain > 0) this.chainHit(target, actual * (effect.chainDamage || 1), effect.chain, effect.chainRange || splash, effect);
    if (target.hp <= 0) this.kill(target);
  }

  applySlow(enemy, slowFactor, slowDuration) {
    if (!enemy || !slowDuration || !slowFactor || slowFactor >= 1) return;
    enemy.slowFactor = Math.min(enemy.slowFactor || 1, slowFactor);
    enemy.slowTimer = Math.max(enemy.slowTimer || 0, slowDuration);
  }

  chainHit(source, damage, jumps, range, effect) {
    let current = source;
    const hitIds = new Set([source.id]);
    for (let jump = 0; jump < jumps; jump += 1) {
      const currentPosition = enemyPosition(current);
      const next = this.game.run.enemies
        .filter((enemy) => enemy.alive && !hitIds.has(enemy.id))
        .map((enemy) => ({ enemy, distance: Math.hypot(enemyPosition(enemy).x - currentPosition.x, enemyPosition(enemy).y - currentPosition.y) }))
        .filter((item) => item.distance <= range)
        .sort((a, b) => a.distance - b.distance)[0]?.enemy;
      if (!next) break;
      hitIds.add(next.id);
      next.hp = Math.max(0, next.hp - damage);
      this.applySlow(next, effect.slowFactor, effect.slowDuration);
      if (next.hp <= 0) this.kill(next);
      current = next;
    }
  }

  kill(enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.game.run.kills += 1;
    if (this.game.run.phase) this.game.run.phaseKills += 1;
    this.game.run.coins += Math.round(enemy.reward * (1 + (this.game.run.buffs.coins || 0)));
    if (enemy.kind === 'mini') {
      this.game.run.miniBossActive = false;
      if (!this.game.run.miniBosses.includes(this.game.run.phaseIndex)) this.game.run.miniBosses.push(this.game.run.phaseIndex);
      this.game.grantBossCurrency('mini');
    }
    if (enemy.kind === 'boss') {
      this.game.grantBossCurrency('boss');
      this.game.endRun(true);
    }
  }
}
