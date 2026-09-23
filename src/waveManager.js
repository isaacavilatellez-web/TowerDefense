export class WaveManager {
  constructor(game) { this.game = game; }

  tick(seconds) {
    const run = this.game.run;
    if (run.bossActive || run.ended) return;
    run.spawnTimer -= seconds;
    if (run.spawned < run.totalEnemies && run.spawnTimer <= 0) {
      const roll = Math.random();
      const kind = roll < run.difficulty.tankChance ? 'tank' : roll < run.difficulty.tankChance + run.difficulty.runnerChance ? 'runner' : 'normal';
      this.game.enemies.spawn(kind);
      run.spawned += 1;
      run.spawnTimer = run.difficulty.spawnInterval * (0.86 + Math.random() * 0.28);
    }
    const progress = run.totalEnemies ? Math.floor((run.kills / run.totalEnemies) * 100) : 0;
    for (const threshold of run.difficulty.miniBossThresholds) {
      if (progress >= threshold && !run.miniBosses.includes(threshold)) {
        run.miniBosses.push(threshold);
        this.game.enemies.spawn('mini');
        break;
      }
    }
    if (run.spawned >= run.totalEnemies && run.enemies.filter((enemy) => enemy.alive && enemy.kind !== 'boss').length === 0 && run.kills + run.leaks >= run.totalEnemies) {
      run.bossReadyTimer += seconds;
      if (run.bossReadyTimer >= run.difficulty.bossUnlockDelay) {
        run.bossReadyTimer = -999;
        this.game.enemies.spawn('boss');
      }
    }
  }
}
