import { GAME_CONFIG } from './config.js';

export class WaveManager {
  constructor(game) { this.game = game; }

  tick(seconds) {
    const run = this.game.run;
    if (!run || run.ended) return;
    if (!run.phase) {
      this.advancePhase(run);
      return;
    }
    if (run.phase.type === 'rest') {
      run.phaseTimer -= seconds;
      run.phaseCountdown = Math.max(0, Math.ceil(run.phaseTimer));
      if (run.phaseTimer <= 0) this.advancePhase(run);
      return;
    }

    run.spawnTimer -= seconds;
    if (run.phase.type === 'wave' && run.phaseSpawned < run.phase.enemies && run.spawnTimer <= 0) {
      const kind = this.pickWaveKind(run.phase.kind, run.level, run.phaseSpawned);
      this.game.enemies.spawn(kind);
      run.phaseSpawned += 1;
      run.spawned += 1;
      run.spawnTimer = run.phase.interval * (0.9 + ((run.phaseSpawned * 17) % 5) * .05);
    }
    if (run.phase.type === 'miniboss' && run.phaseSpawned === 0) {
      this.game.enemies.spawn(run.phase.enemy);
      run.phaseSpawned = 1;
    }
    if (run.phase.type === 'boss' && run.phaseSpawned === 0) {
      this.game.enemies.spawn(run.phase.enemy);
      run.phaseSpawned = 1;
    }

    this.tickAmbient(run, seconds);

    if (run.phaseSpawned > 0 && !run.enemies.some((enemy) => enemy.alive)) this.advancePhase(run);
  }

  tickAmbient(run, seconds) {
    const settings = run.wavePlan.ambientSpawn || GAME_CONFIG.waves.ambientSpawn;
    if (!settings?.enabled || !run.phase || run.phase.type === 'rest') return;
    const maxPerPhase = settings.maxPerPhaseStart + Math.max(0, run.level - 1) * settings.maxPerPhaseStep;
    if (run.ambientSpawnedThisPhase >= maxPerPhase) return;
    run.ambientTimer -= seconds;
    if (run.ambientTimer > 0) return;
    const pool = run.phase.type === 'boss'
      ? ['normal', 'runner', 'armored', 'regenerator']
      : run.level >= 6 ? ['normal', 'runner', 'armored', 'regenerator']
        : run.level >= 4 ? ['normal', 'runner', 'tank'] : ['normal', 'normal', 'runner'];
    const kind = pool[(run.ambientSpawned + run.phaseIndex) % pool.length];
    this.game.enemies.spawn(kind, { ambient: true });
    run.ambientSpawned += 1;
    run.ambientSpawnedThisPhase += 1;
    const pressure = Math.max(0, run.level - 1);
    const interval = Math.max(settings.intervalMin, settings.intervalStart - pressure * settings.intervalStep);
    const bossMultiplier = run.phase.type === 'miniboss' || run.phase.type === 'boss' ? settings.bossMultiplier : 1;
    run.ambientTimer = interval * bossMultiplier;
  }

  pickWaveKind(kind, level, index) {
    if (kind !== 'mixed') return kind;
    if (level >= 6 && index % 4 === 0) return 'tank';
    if (level >= 4 && index % 3 === 0) return 'runner';
    return 'normal';
  }

  advancePhase(run) {
    const previous = run.phase;
    if (previous?.type === 'rest') {
      run.phase = null;
    } else {
      run.phaseIndex += 1;
    }

    if (previous?.type === 'miniboss' && previous.rest) {
      run.phase = { type: 'rest', duration: previous.rest };
      run.phaseTimer = previous.rest;
      run.phaseCountdown = previous.rest;
      run.phaseLabel = 'DESCANSO';
      run.miniBossActive = false;
      return;
    }

    const next = run.wavePlan[run.phaseIndex];
    if (!next) {
      run.phase = null;
      if (previous?.type === 'boss' && !run.ended) this.game.endRun(true);
      return;
    }
    if (previous?.type === 'wave' && next.type === 'wave') {
      run.phase = { type: 'rest', duration: 1.4 };
      run.phaseTimer = 1.4;
      run.phaseCountdown = 1.4;
      run.phaseLabel = 'PREPARACIÓN';
      return;
    }
    run.phase = next;
    run.phaseSpawned = 0;
    run.phaseKills = 0;
    run.phaseLeaks = 0;
    run.phaseTimer = 0;
    run.phaseCountdown = 0;
    run.spawnTimer = next.type === 'wave' ? (run.phaseIndex === 0 ? run.difficulty.initialDelay : 1.1) : 0;
    run.ambientSpawnedThisPhase = 0;
    run.ambientTimer = next.type === 'wave' ? Math.max(4.5, run.difficulty.initialDelay) : 2.8;
    run.phaseLabel = next.type === 'wave' ? `OLEADA ${next.number}` : next.label || next.type.toUpperCase();
    run.waveNumber = next.type === 'wave' ? next.number : run.waveNumber;
    if (next.type === 'miniboss') {
      run.miniBossActive = true;
      this.game.feedback('MINIBOSS ENTRANTE', 'boss');
    }
    if (next.type === 'boss') {
      run.bossActive = true;
      this.game.feedback('BOSS FINAL · THE TITAN', 'boss');
    }
  }
}
