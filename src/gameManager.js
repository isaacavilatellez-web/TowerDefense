import { GAME_CONFIG, getLevelDifficulty } from './config.js';
import { SaveSystem } from './saveSystem.js';
import { MapGenerator } from './mapGenerator.js';
import { EconomyManager } from './economyManager.js';
import { ClickerManager } from './clickerManager.js';
import { TowerManager } from './towerManager.js';
import { EnemyManager } from './enemyManager.js';
import { WaveManager } from './waveManager.js';
import { RoguelikeManager } from './roguelikeManager.js';
import { LevelManager } from './levelManager.js';
import { AudioManager } from './audioManager.js';

export class GameManager {
  constructor(ui) {
    this.ui = ui;
    this.save = SaveSystem.load();
    this.levels = new LevelManager(this);
    this.audio = new AudioManager(this.save);
    this.economy = new EconomyManager(this);
    this.clicker = new ClickerManager(this);
    this.towers = new TowerManager(this);
    this.enemies = new EnemyManager(this);
    this.waves = new WaveManager(this);
    this.roguelike = new RoguelikeManager(this);
    this.feedbackMessage = null;
    this.lastTime = 0;
    this.frame = null;
    this.loopActive = false;
  }

  startLevel(level) {
    if (!this.levels.isUnlocked(level)) return;
    console.log('startGame', { level });
    this.stopLoop();
    try {
      const meta = this.levels.getLevel(level);
      const map = MapGenerator.generate(level, Date.now() % 100000);
      const difficulty = getLevelDifficulty(level);
      console.log('map generated', { points: map.points.length, buildSpots: map.buildSpots.length, obstacles: map.obstacles.length });
      this.run = {
        level, meta, map,
        baseHp: GAME_CONFIG.levels.startingBaseHp, baseMaxHp: GAME_CONFIG.levels.startingBaseHp,
        coins: GAME_CONFIG.economy.startingCoins, clickerLevel: 1, autoCoins: 0, autoCoinTimer: 0,
        clicks: 0, combo: 0, comboTimer: 0,
        towers: [], enemies: [], projectiles: [], nextEnemyId: 1,
        difficulty,
        totalEnemies: difficulty.totalEnemies,
        spawned: 0, kills: 0, leaks: 0, spawnTimer: difficulty.initialDelay, bossReadyTimer: 0, bossActive: false,
        miniBosses: [], upgradeOptions: [], pausedForUpgrade: false, buffs: {},
        placingType: null, selectedTowerId: null, mergeTargetId: null, drag: null, placementPreview: null, ended: false, result: null,
      };
      if (!this.ui.showBattle()) {
        this.run = null;
        return;
      }
      // Pintar un frame válido antes de arrancar la animación evita un canvas vacío
      // durante la transición y hace visibles los errores de inicialización.
      this.ui.render();
      this.lastTime = performance.now();
      this.loopActive = true;
      this.frame = requestAnimationFrame((time) => this.loop(time));
      console.log('game loop started');
    } catch (error) {
      console.error('No se pudo iniciar la partida', error);
      this.run = null;
      this.ui.showMap();
      this.ui.showToast('No se pudo iniciar el nivel. Inténtalo de nuevo.');
    }
  }

  loop(time) {
    if (!this.loopActive || !this.run) return;
    const delta = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;
    try {
      if (!this.run.ended && !this.run.pausedForUpgrade) this.update(delta);
      this.ui.render();
      if (this.run && !this.run.ended) this.frame = requestAnimationFrame((next) => this.loop(next));
      else this.loopActive = false;
    } catch (error) {
      console.error('No se pudo actualizar la partida', error);
      this.loopActive = false;
      this.ui.showBattleError('La partida se detuvo', 'Recarga el nivel para volver a intentarlo.');
    }
  }

  update(delta) {
    this.economy.tick(delta);
    this.waves.tick(delta);
    this.enemies.tick(delta);
    this.towers.tick(delta);
    for (const projectile of this.run.projectiles) {
      projectile.life -= delta;
      if (projectile.life <= 0) {
        this.enemies.hit(projectile.targetId, projectile.damage, projectile.splash, projectile.to);
        projectile.done = true;
      }
    }
    this.run.projectiles = this.run.projectiles.filter((projectile) => !projectile.done);
    const nextThreshold = [10, 20, 30, 40, 50, 60, 70, 80, 90].find((item) => !this.run.miniBosses.includes(item));
    if (nextThreshold && this.run.kills / this.run.totalEnemies * 100 >= nextThreshold && !this.run.pausedForUpgrade) {
      // The wave manager owns the spawn; the offer appears after the mini boss is killed.
    }
    for (const mini of this.run.enemies.filter((enemy) => !enemy.alive && enemy.kind === 'mini' && !enemy.upgradeGiven)) {
      mini.upgradeGiven = true;
      this.roguelike.offer();
    }
    if (this.run.baseHp <= 0) this.endRun(false);
    SaveSystem.save(this.save);
  }

  endRun(victory) {
    if (!this.run || this.run.ended) return;
    this.run.ended = true;
    this.run.result = victory ? 'victory' : 'defeat';
    if (victory) {
      const stars = this.run.baseHp > 50 ? 3 : this.run.baseHp > 20 ? 2 : 1;
      this.levels.complete(this.run.level, stars);
      this.save.scrap += GAME_CONFIG.economy.bossReward;
      this.audio.ping(720, 0.24);
    } else {
      this.save.scrap += Math.max(5, Math.floor(this.run.kills * 0.7));
      this.audio.ping(150, 0.18);
    }
    SaveSystem.save(this.save);
    this.ui.render();
  }

  feedback(message, kind = 'info') {
    this.feedbackMessage = { message, kind, expires: performance.now() + 1300 };
    this.audio.ping(kind === 'merge' ? 760 : kind === 'boss' ? 180 : 460, kind === 'boss' ? 0.22 : 0.06);
    if (this.ui) this.ui.renderFeedback();
  }

  stopLoop() {
    this.loopActive = false;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  returnToMap() { this.stopLoop(); this.run = null; this.ui.showMap(); }
}
