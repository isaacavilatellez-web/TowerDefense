import { createEnemy, enemyPosition } from './enemyData.js';

export class EnemyManager {
  constructor(game) { this.game = game; }

  spawn(kind = 'normal', options = {}) {
    const run = this.game.run;
    const paths = run.map.paths || [run.map.points];
    const pathIndex = kind === 'boss' ? 0 : kind === 'mini' ? Math.max(0, run.phaseIndex % paths.length) : (options.pathIndex ?? (run.spawned + run.ambientSpawned) % paths.length);
    const infiniteDifficulty = run.infinite?.difficulty;
    const enemy = createEnemy(kind, run.level, paths[pathIndex], `enemy-${run.nextEnemyId++}`, infiniteDifficulty ? {
      hpMultiplier: infiniteDifficulty.enemyHpMultiplier,
      speedMultiplier: infiniteDifficulty.enemySpeedMultiplier,
      bossHp: infiniteDifficulty.targetDamage * 0.8,
      threat: { normal: 1, runner: 1.15, tank: 2.8, mini: 6, boss: 10 }[kind] || 1,
    } : options);
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
        this.releaseThreat(enemy);
        run.leaks += 1;
        if (run.phase) run.phaseLeaks += 1;
        if (enemy.kind === 'mini') run.miniBossActive = false;
        run.baseHp = Math.max(0, run.baseHp - (enemy.kind === 'boss' ? 30 : enemy.kind === 'mini' ? 12 : 4));
        if (enemy.kind === 'boss') this.game.endRun(false);
        if (run.baseHp <= 0) this.game.endRun(false);
      }
    }
    run.enemies = run.enemies.filter((enemy) => enemy.alive || (!run.infinite && enemy.hp <= 0));
  }

  hit(enemyId, damage, splash, origin, effect = {}) {
    const run = this.game.run;
    const target = run.enemies.find((enemy) => enemy.id === enemyId && enemy.alive);
    if (!target) return;
    const incoming = Math.max(0, Number(damage) || 0);
    const actual = this.damageEnemy(target, incoming, effect);
    this.applySlow(target, effect.slowFactor, effect.slowDuration);
    if (splash > 0 && origin) {
      for (const enemy of run.enemies) {
        if (!enemy.alive || enemy.id === target.id) continue;
        const position = enemyPosition(enemy);
        if (Math.hypot(position.x - origin.x, position.y - origin.y) <= splash) {
          this.damageEnemy(enemy, actual * 0.45);
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
      this.damageEnemy(next, damage, effect);
      this.applySlow(next, effect.slowFactor, effect.slowDuration);
      if (next.hp <= 0) this.kill(next);
      current = next;
    }
  }

  kill(enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.releaseThreat(enemy);
    this.game.run.kills += 1;
    if (this.game.run.phase) this.game.run.phaseKills += 1;
    this.game.run.coins += Math.round(enemy.reward * (1 + (this.game.run.buffs.coins || 0)));
    if (enemy.kind === 'mini') {
      this.game.run.miniBossActive = false;
      if (!this.game.run.miniBosses.includes(this.game.run.phaseIndex)) this.game.run.miniBosses.push(this.game.run.phaseIndex);
      if (!this.game.run.infinite) this.game.grantBossCurrency('mini');
      if (this.game.run.infinite && !this.game.run.pausedForUpgrade) {
        this.game.roguelike.offer(() => this.game.infinite.random(this.game.run));
      }
    }
    if (enemy.kind === 'boss') {
      if (!this.game.run.infinite) this.game.grantBossCurrency('boss');
      this.game.endRun(true);
    }
  }

  damageEnemy(enemy, incoming, effect = {}) {
    const run = this.game.run;
    if (!run || !enemy?.alive) return 0;
    if (run.infinite && run.infinite.damage >= run.infinite.targetDamage) return 0;
    const amount = Math.max(0, Number(incoming) || 0);
    if (!amount || !Number.isFinite(amount)) return 0;
    const before = Math.max(0, Number(enemy.hp) || 0);
    const shield = Math.max(0, Number(enemy.shield) || 0);
    const absorbed = Math.min(shield, amount * 0.7);
    enemy.shield = Math.max(0, shield - absorbed);
    const actual = Math.min(before, Math.max(0, amount - absorbed));
    enemy.hp = Math.max(0, before - actual);
    if (run.infinite && actual > 0) {
      run.infinite.damage = Math.min(run.infinite.targetDamage, run.infinite.damage + actual);
    }
    this.applySlow(enemy, effect.slowFactor, effect.slowDuration);
    return actual;
  }

  releaseThreat(enemy) {
    const run = this.game.run;
    if (!run?.infinite || !enemy || enemy.threatReleased) return;
    enemy.threatReleased = true;
    run.infinite.activeThreat = Math.max(0, (run.infinite.activeThreat || 0) - (enemy.threat || 1));
  }
}
