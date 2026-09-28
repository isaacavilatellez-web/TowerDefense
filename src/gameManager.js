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
import { getWavePlan } from './levelData.js';

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
      const map = MapGenerator.generate(level);
      const difficulty = getLevelDifficulty(level);
      const wavePlan = getWavePlan(level);
      const developerRun = Boolean(this.save.settings?.developer);
      console.log('map generated', { points: map.points.length, buildSpots: map.buildSpots.length, obstacles: map.obstacles.length });
      this.run = {
        level, meta, map, developerRun,
        baseHp: GAME_CONFIG.levels.startingBaseHp, baseMaxHp: GAME_CONFIG.levels.startingBaseHp,
        coins: GAME_CONFIG.economy.startingCoins, clickerLevel: 1, autoCoins: 0, autoCoinTimer: 0,
        clicks: 0,
        towers: [], enemies: [], projectiles: [], nextEnemyId: 1,
        difficulty,
        wavePlan, phaseIndex: -1, phase: null, phaseSpawned: 0, phaseKills: 0, phaseLeaks: 0, phaseLabel: 'PREPARACIÓN', phaseTimer: 0, phaseCountdown: 0, waveNumber: 0,
        totalEnemies: wavePlan.filter((phase) => phase.type === 'wave').reduce((sum, phase) => sum + phase.enemies, 0), totalWaves: wavePlan.filter((phase) => phase.type === 'wave').length,
        spawned: 0, ambientSpawned: 0, ambientSpawnedThisPhase: 0, ambientTimer: difficulty.initialDelay, kills: 0, leaks: 0, spawnTimer: difficulty.initialDelay, bossReadyTimer: 0, bossActive: false, miniBossActive: false,
        bossCurrencyEarned: 0,
        miniBosses: [], upgradeOptions: [], pausedForUpgrade: false, buffs: {},
        placingType: null, placingLevel: 1, selectedTowerId: null, mergeTargetId: null, drag: null, mergeFx: null, placementPreview: null, ended: false, result: null,
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
        this.enemies.hit(projectile.targetId, projectile.damage, projectile.splash, projectile.to, projectile);
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
    if (victory && !this.run.developerRun) {
      const stars = this.run.baseHp > 50 ? 3 : this.run.baseHp > 20 ? 2 : 1;
      this.levels.complete(this.run.level, stars);
      this.save.scrap += GAME_CONFIG.economy.bossReward;
      this.audio.ping(720, 0.24);
    } else if (!this.run.developerRun) {
      this.save.scrap += Math.max(5, Math.floor(this.run.kills * 0.7));
      this.audio.ping(150, 0.18);
    } else {
      this.feedback('MODO DEV · progreso no guardado', 'info');
    }
    SaveSystem.save(this.save);
    this.ui.render();
  }

  towerLevel(type) { return Math.max(1, Number(this.save.towerLevels?.[type]) || 1); }

  towerUpgradeCost(type) {
    return 2 + this.towerLevel(type) * 3;
  }

  upgradePermanentTower(type) {
    if (!GAME_CONFIG.towers[type]) return false;
    const cost = this.towerUpgradeCost(type);
    if (this.save.crystals < cost) return false;
    this.save.crystals -= cost;
    this.save.towerLevels[type] = this.towerLevel(type) + 1;
    SaveSystem.save(this.save);
    return true;
  }

  spendCrystals(amount) {
    const cost = Math.max(0, Math.floor(amount));
    if (this.save.crystals < cost) return false;
    this.save.crystals -= cost;
    SaveSystem.save(this.save);
    return true;
  }

  grantBossCurrency(kind) {
    const amount = GAME_CONFIG.economy.bossCurrency[kind] || 0;
    if (!amount || !this.run) return;
    this.run.bossCurrencyEarned += amount;
    if (!this.run.developerRun) {
      this.save.crystals += amount;
      SaveSystem.save(this.save);
    }
    this.feedback(`+${amount} NÚCLEO${amount === 1 ? '' : 'S'} DE JEFE`, 'special');
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

  returnToMap() {
    const completedLevel = this.run?.result === 'victory' && !this.run.developerRun ? this.run.level : null;
    this.stopLoop();
    this.run = null;
    if (completedLevel) {
      this.ui.selectedLevel = completedLevel + 1;
      this.ui.mapFocusLevel = completedLevel + 1;
    }
    this.ui.showMap();
  }
}
