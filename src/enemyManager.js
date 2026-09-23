import { createEnemy, enemyPosition } from './enemyData.js';

export class EnemyManager {
  constructor(game) { this.game = game; }

  spawn(kind = 'normal') {
    const run = this.game.run;
    const enemy = createEnemy(kind, run.level, run.map.points, `enemy-${run.nextEnemyId++}`);
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
      enemy.pulse += seconds;
      enemy.progress += enemy.speed * seconds;
      if (enemy.progress >= 1) {
        enemy.alive = false;
        run.leaks += 1;
        run.baseHp = Math.max(0, run.baseHp - (enemy.kind === 'boss' ? 30 : enemy.kind === 'mini' ? 12 : 4));
        if (run.baseHp <= 0) this.game.endRun(false);
      }
    }
    run.enemies = run.enemies.filter((enemy) => enemy.alive || enemy.hp <= 0);
  }

  hit(enemyId, damage, splash, origin) {
    const run = this.game.run;
    const target = run.enemies.find((enemy) => enemy.id === enemyId && enemy.alive);
    if (!target) return;
    const absorbed = Math.min(target.shield, damage * 0.7);
    target.shield -= absorbed;
    const actual = damage - absorbed;
    target.hp -= actual;
    if (splash > 0) {
      for (const enemy of run.enemies) {
        if (!enemy.alive || enemy.id === target.id) continue;
        const position = enemyPosition(enemy);
        if (Math.hypot(position.x - origin.x, position.y - origin.y) <= splash) {
          enemy.hp -= actual * 0.45;
          if (enemy.hp <= 0) this.kill(enemy);
        }
      }
    }
    if (target.hp <= 0) this.kill(target);
  }

  kill(enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.game.run.kills += 1;
    this.game.run.coins += Math.round(enemy.reward * (1 + (this.game.run.buffs.coins || 0)));
    if (enemy.kind === 'boss') this.game.endRun(true);
  }
}
