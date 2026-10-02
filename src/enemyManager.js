import { createEnemy, enemyPosition, canonicalEnemyKind } from './enemyData.js';

export class EnemyManager {
  constructor(game) { this.game = game; }

  spawn(kind = 'normal', options = {}) {
    const run = this.game.run;
    kind = canonicalEnemyKind(kind);
    const paths = run.map.paths || [run.map.points];
    const pathIndex = kind === 'boss' ? 0 : kind === 'mini' ? Math.max(0, run.phaseIndex % paths.length) : (options.pathIndex ?? (run.spawned + run.ambientSpawned) % paths.length);
    const infiniteConfig = run.mode === 'infinite' ? run.infiniteDirector?.config : null;
    const testHpScale = run.testMode ? ({ easy: .75, normal: 1, hard: 1.5, extreme: 2.5 }[run.testDifficulty] || 1) : 1;
    const enemy = createEnemy(kind, run.level, paths[pathIndex], `enemy-${run.nextEnemyId++}`, infiniteConfig ? {
      hpMultiplier: infiniteConfig.enemyHpMultiplier,
      speedMultiplier: infiniteConfig.enemySpeedMultiplier,
    } : run.testMode ? { hpMultiplier: testHpScale, speedMultiplier: 1 } : {});
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
      if (enemy.freezeImmunity > 0) enemy.freezeImmunity = Math.max(0, enemy.freezeImmunity - seconds);
      if (enemy.regenSuppressed > 0) enemy.regenSuppressed = Math.max(0, enemy.regenSuppressed - seconds);
      if (enemy.vulnerabilityTimer > 0) { enemy.vulnerabilityTimer = Math.max(0, enemy.vulnerabilityTimer - seconds); if (enemy.vulnerabilityTimer <= 0) enemy.vulnerability = 0; }
      if (enemy.burn?.duration > 0) {
        this.damageEnemy(enemy, enemy.burn.damagePerSecond * seconds, { source: 'burn' });
        enemy.burn.duration -= seconds;
        if (enemy.burn.duration <= 0) enemy.burn = null;
      }
      if (!enemy.alive) continue;
      if (enemy.alive && enemy.regenRate && enemy.hp > 0) {
        const regenFactor = enemy.regenSuppressed > 0 ? Math.max(0, 1 - (enemy.regenReduction || 1)) : 1;
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * enemy.regenRate * regenFactor * seconds);
      }
      if (enemy.slowTimer > 0) {
        enemy.slowTimer -= seconds;
        if (enemy.slowTimer <= 0) enemy.slowFactor = 1;
      }
      if (enemy.freezeTimer > 0) {
        enemy.freezeTimer -= seconds;
        enemy.pulse += seconds;
        continue;
      }
      enemy.pulse += seconds;
      enemy.progress += enemy.speed * (enemy.slowFactor || 1) * seconds;
      if (enemy.progress >= 1) {
        enemy.alive = false;
        run.leaks += 1;
        if (run.phase) run.phaseLeaks += 1;
        if (enemy.kind === 'mini') run.miniBossActive = false;
        if (enemy.kind === 'boss') run.baseHp = 0;
        else run.baseHp = Math.max(0, run.baseHp - enemy.shelterDamage);
        if (enemy.kind === 'boss' && run.mode === 'test') run.baseHp = run.testInvulnerable ? run.baseMaxHp : 0;
        if (enemy.kind === 'boss' && run.mode !== 'test') this.game.endRun(false);
        if (run.baseHp <= 0) this.game.endRun(false);
      }
    }
    this.updateGroundFires(seconds);
    run.enemies = run.mode === 'infinite'
      ? run.enemies.filter((enemy) => enemy.alive)
      : run.enemies.filter((enemy) => enemy.alive || enemy.hp <= 0);
  }

  hit(enemyId, damage, splash, origin, effect = {}) {
    const run = this.game.run;
    const target = run.enemies.find((enemy) => enemy.id === enemyId && enemy.alive);
    if (!target) return;
    const incoming = Math.max(0, Number(damage) || 0);
    if (!origin) origin = enemyPosition(target);
    const actual = this.damageEnemy(target, incoming);
    this.applySlow(target, effect.slowFactor, effect.slowDuration);
    this.applyFreeze(target, effect.freezeDuration);
    this.applyBurn(target, effect.burnDuration, incoming * .18, effect.regenReduction);
    if (effect.vulnerability) { target.vulnerability = Math.max(target.vulnerability || 0, Math.min(.1, effect.vulnerability)); target.vulnerabilityTimer = Math.max(target.vulnerabilityTimer || 0, effect.vulnerabilityDuration || effect.freezeDuration || effect.slowDuration || 0); }
    if (splash > 0) {
      for (const enemy of run.enemies) {
        if (!enemy.alive || enemy.id === target.id) continue;
        const position = enemyPosition(enemy);
        if (Math.hypot(position.x - origin.x, position.y - origin.y) <= splash) {
          this.damageEnemy(enemy, actual * (effect.edgeFalloff || .45));
          this.applyFreeze(enemy, effect.freezeDuration);
          this.applyBurn(enemy, effect.burnDuration, incoming * .12, effect.regenReduction);
          if (enemy.hp <= 0) this.kill(enemy);
        }
      }
    }
    if (effect.coneAngle > 0 && effect.coneOrigin) {
      const direction = { x: origin.x - effect.coneOrigin.x, y: origin.y - effect.coneOrigin.y };
      const directionLength = Math.hypot(direction.x, direction.y) || 1;
      for (const enemy of run.enemies) {
        if (!enemy.alive || enemy.id === target.id) continue;
        const offset = { x: enemyPosition(enemy).x - effect.coneOrigin.x, y: enemyPosition(enemy).y - effect.coneOrigin.y };
        const length = Math.hypot(offset.x, offset.y) || 1;
        const dot = (direction.x * offset.x + direction.y * offset.y) / (directionLength * length);
        if (length <= (effect.range || splash || 100) && Math.acos(Math.max(-1, Math.min(1, dot))) <= effect.coneAngle / 2) {
          this.damageEnemy(enemy, incoming * .72, effect);
          this.applyBurn(enemy, effect.burnDuration, incoming * .18, effect.regenReduction);
          if (enemy.hp <= 0) this.kill(enemy);
        }
      }
    }
    if (effect.chain > 1) this.chainHit(target, effect, effect.chain - 1, effect.chainRange || splash);
    if (effect.groundFire > 0) {
      this.addGroundFire({ x: origin.x, y: origin.y, radius: splash || 30, duration: effect.groundFire, damagePerSecond: incoming * .12, regenReduction: effect.regenReduction || 0 });
    }
    if (target.hp <= 0) this.kill(target);
  }

  applySlow(enemy, slowFactor, slowDuration) {
    if (!enemy || !slowDuration || !slowFactor || slowFactor >= 1) return;
    const factor = enemy.controlResistance ? 1 - (1 - slowFactor) * (1 - enemy.controlResistance) : slowFactor;
    enemy.slowFactor = Math.min(enemy.slowFactor || 1, factor);
    enemy.slowTimer = Math.max(enemy.slowTimer || 0, slowDuration);
  }

  applyFreeze(enemy, freezeDuration) {
    if (!enemy || !freezeDuration || enemy.freezeImmunity > 0) return;
    const duration = enemy.controlResistance ? freezeDuration * (1 - enemy.controlResistance) : freezeDuration;
    enemy.freezeTimer = Math.max(enemy.freezeTimer || 0, duration);
    if (enemy.slowTimer > 0) enemy.slowTimer += duration;
    enemy.freezeImmunity = duration + (enemy.controlResistance ? 2 : 1);
  }

  applyBurn(enemy, duration, damagePerSecond, regenReduction = 0) {
    if (!enemy || !duration || !damagePerSecond) return;
    const current = enemy.burn;
    if (!current || damagePerSecond >= current.damagePerSecond) enemy.burn = { damagePerSecond, duration };
    else current.duration = Math.max(current.duration, duration);
    if (regenReduction) { enemy.regenSuppressed = Math.max(enemy.regenSuppressed, duration); enemy.regenReduction = Math.max(enemy.regenReduction || 0, Math.min(1, regenReduction)); }
  }

  updateGroundFires(seconds) {
    const run = this.game.run;
    if (!run.groundFires?.length) return;
    for (const fire of run.groundFires) {
      fire.duration -= seconds;
      for (const enemy of run.enemies) {
        if (!enemy.alive || Math.hypot(enemyPosition(enemy).x - fire.x, enemyPosition(enemy).y - fire.y) > fire.radius) continue;
        this.damageEnemy(enemy, fire.damagePerSecond * seconds, { source: 'ground-fire' });
        if (fire.regenReduction) { enemy.regenSuppressed = Math.max(enemy.regenSuppressed, Math.min(fire.duration, 1)); enemy.regenReduction = Math.max(enemy.regenReduction || 0, fire.regenReduction); }
      }
    }
    run.groundFires = run.groundFires.filter((fire) => fire.duration > 0);
  }

  addGroundFire(fire) {
    const fires = this.game.run.groundFires || (this.game.run.groundFires = []);
    const existing = fires.find((item) => Math.hypot(item.x - fire.x, item.y - fire.y) < Math.max(item.radius, fire.radius) * .65);
    if (existing) {
      existing.duration = Math.max(existing.duration, fire.duration);
      existing.damagePerSecond = Math.max(existing.damagePerSecond, fire.damagePerSecond);
      existing.regenReduction = Math.max(existing.regenReduction || 0, fire.regenReduction || 0);
      return existing;
    }
    fires.push(fire);
    return fire;
  }

  chainHit(source, effect, jumps, range) {
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
      const jumpIndex = hitIds.size - 1;
      const chainDamage = effect.chainDamages?.[jumpIndex] ?? effect.damage * Math.pow(effect.chainFalloff || .65, jumpIndex);
      this.damageEnemy(next, chainDamage, effect);
      this.applySlow(next, effect.electricSlow || effect.slowFactor, effect.electricSlowDuration || effect.slowDuration);
      this.applyFreeze(next, effect.freezeDuration);
      if (next.hp <= 0) this.kill(next);
      current = next;
    }
  }

  damageEnemy(enemy, damage, effect = {}) {
    if (!enemy?.alive) return 0;
    const incoming = Math.max(0, Number(damage) || 0);
    const mitigated = enemy.armorReduction ? incoming * (1 - enemy.armorReduction) : incoming;
    const amplified = enemy.vulnerabilityTimer > 0 && enemy.vulnerability > 0 ? mitigated * (1 + Math.min(.1, enemy.vulnerability)) : mitigated;
    const healthDamage = Math.min(Math.max(0, enemy.hp), amplified);
    enemy.hp = Math.max(0, enemy.hp - healthDamage);
    if (healthDamage > 0 && this.game.run.mode === 'infinite') {
      this.game.run.damageDone = Math.min(this.game.run.damageTarget, this.game.run.damageDone + healthDamage);
    }
    return healthDamage;
  }

  kill(enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.game.run.kills += 1;
    if (this.game.run.phase) this.game.run.phaseKills += 1;
    if (!this.game.run.testMode) this.game.run.coins += Math.round(enemy.reward * (1 + (this.game.run.buffs.coins || 0)));
    if (enemy.kind === 'mini') {
      this.game.run.miniBossActive = false;
      if (!this.game.run.miniBosses.includes(this.game.run.phaseIndex)) this.game.run.miniBosses.push(this.game.run.phaseIndex);
      if (this.game.run.mode !== 'infinite' && !this.game.run.testMode) this.game.grantBossCurrency('mini');
    }
    if (enemy.kind === 'boss') {
      if (this.game.run.mode !== 'infinite' && !this.game.run.testMode) this.game.grantBossCurrency('boss');
      if (this.game.run.mode !== 'infinite' && !this.game.run.testMode) this.game.endRun(true);
    }
  }
}
