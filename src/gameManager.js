import { GAME_CONFIG, getInfinitePhaseConfig, getLevelDifficulty } from './config.js';
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
import { InfiniteManager } from './infiniteManager.js';

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
    this.infinite = new InfiniteManager(this);
    this.roguelike = new RoguelikeManager(this);
    this.feedbackMessage = null;
    this.lastTime = 0;
    this.frame = null;
    this.loopActive = false;
  }

  startLevel(level) {
    if (!this.levels.isUnlocked(level)) return;
    console.log('startGame', { level });
    this.save.mapLevel = level;
    SaveSystem.save(this.save);
    this.stopLoop();
    try {
      const meta = this.levels.getLevel(level);
      const map = MapGenerator.generate(level);
      const difficulty = getLevelDifficulty(level);
      const wavePlan = getWavePlan(level);
      const developerRun = Boolean(this.save.settings?.developer);
      console.log('map generated', { points: map.points.length, buildSpots: map.buildSpots.length, obstacles: map.obstacles.length });
      this.run = {
        mode: 'normal', level, meta, map, developerRun,
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
        placingType: null, placingLevel: 1, selectedTowerId: null, mergeTargetId: null, mergeableTowerIds: new Set(), drag: null, mergeFx: null, placementPreview: null, ended: false, result: null,
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

  getInfiniteStatus() {
    const progress = this.save.infinite || { currentPhase: 1, record: 0, activeRun: null, rewardsClaimed: [] };
    return {
      phase: Math.max(1, Number(progress.currentPhase) || 1),
      record: Math.max(0, Number(progress.record) || 0),
      activeRun: Boolean(progress.activeRun),
      rewardPending: this.infiniteRewardFor(progress.currentPhase || 1) !== null && !progress.rewardsClaimed?.includes(progress.currentPhase || 1),
    };
  }

  infiniteRewardFor(phase) {
    const safePhase = Math.max(1, Math.floor(Number(phase) || 1));
    const rewards = GAME_CONFIG.infinite.rewardPhases;
    if (safePhase === 1) return { ...rewards.first };
    if (safePhase % rewards.milestoneEvery === 0) return { ...rewards.milestone };
    return null;
  }

  createInfiniteRun(phase, options = {}) {
    const config = getInfinitePhaseConfig(phase);
    const previous = options.previous;
    const map = options.map || previous?.map || MapGenerator.generate(1, this.save.infinite.seed);
    const director = options.director || this.infinite.createState(phase, this.save.infinite.seed);
    return {
      mode: 'infinite', level: phase, infinitePhase: phase,
      meta: { level: phase, name: `Fase ${phase}` }, map,
      developerRun: Boolean(this.save.settings?.developer),
      baseHp: config ? GAME_CONFIG.infinite.baseHp : GAME_CONFIG.levels.startingBaseHp,
      baseMaxHp: GAME_CONFIG.infinite.baseHp,
      coins: options.coins ?? previous?.coins ?? GAME_CONFIG.infinite.startingCoins,
      clickerLevel: options.clickerLevel ?? previous?.clickerLevel ?? 1,
      autoCoins: 0, autoCoinTimer: 0, clicks: options.clicks ?? previous?.clicks ?? 0,
      towers: options.towers ?? previous?.towers ?? [], enemies: options.enemies ?? [], projectiles: options.projectiles ?? [],
      nextEnemyId: options.nextEnemyId ?? previous?.nextEnemyId ?? 1,
      difficulty: null, wavePlan: [], phaseIndex: 0, phase: null, phaseSpawned: 0, phaseKills: 0, phaseLeaks: 0,
      phaseLabel: 'FASE EN CURSO', phaseTimer: 0, phaseCountdown: 0, waveNumber: 0, totalEnemies: 0, totalWaves: 0,
      spawned: options.spawned ?? previous?.spawned ?? 0, ambientSpawned: 0, ambientSpawnedThisPhase: 0, ambientTimer: 0, spawnTimer: 0,
      kills: options.kills ?? previous?.kills ?? 0, leaks: options.leaks ?? previous?.leaks ?? 0,
      bossReadyTimer: 0, bossActive: false, miniBossActive: false, bossCurrencyEarned: 0, miniBosses: [],
      upgradeOptions: [], pausedForUpgrade: false, buffs: options.buffs ?? previous?.buffs ?? {},
      placingType: null, placingLevel: 1, selectedTowerId: null, mergeTargetId: null, mergeableTowerIds: new Set(), drag: null,
      mergeFx: null, placementPreview: null, ended: false, result: null,
      damageDone: options.damageDone ?? 0, damageTarget: config.targetDamage, infiniteDirector: director,
      saveTimer: 0,
    };
  }

  startInfinite({ continueSaved = true, retry = false } = {}) {
    const saved = this.save.infinite?.activeRun;
    const phase = retry ? Math.max(1, this.save.infinite.currentPhase || 1) : saved && continueSaved ? saved.infinitePhase : (this.save.infinite?.currentPhase || 1);
    this.stopLoop();
    try {
      if (saved && continueSaved && !retry) {
        this.run = this.restoreInfiniteRun(saved);
      } else {
        const config = getInfinitePhaseConfig(phase);
        this.run = this.createInfiniteRun(phase, { coins: retry ? config.reconstructionCoins : GAME_CONFIG.infinite.startingCoins });
      }
      this.run.ended = false;
      this.run.result = null;
      if (!this.ui.showBattle()) { this.run = null; return; }
      this.ui.render();
      this.lastTime = performance.now();
      this.loopActive = true;
      this.frame = requestAnimationFrame((time) => this.loop(time));
      this.persistInfiniteRun();
    } catch (error) {
      console.error('No se pudo iniciar el infinito', error);
      this.run = null;
      this.ui.showMap();
      this.ui.showToast('No se pudo iniciar el infinito. Inténtalo de nuevo.');
    }
  }

  restoreInfiniteRun(saved) {
    const phase = Math.max(1, Math.floor(Number(saved.infinitePhase) || this.save.infinite.currentPhase || 1));
    const run = this.createInfiniteRun(phase, {
      ...saved,
      director: this.infinite.restore(saved.infiniteDirector, phase),
      coins: Number(saved.coins) || 0,
      towers: Array.isArray(saved.towers) ? saved.towers : [],
      enemies: Array.isArray(saved.enemies) ? saved.enemies : [],
      projectiles: Array.isArray(saved.projectiles) ? saved.projectiles : [],
      buffs: saved.buffs && typeof saved.buffs === 'object' ? saved.buffs : {},
    });
    run.baseHp = Math.max(0, Math.min(run.baseMaxHp, Number(saved.baseHp) || run.baseMaxHp));
    run.damageDone = Math.max(0, Math.min(run.damageTarget, Number(saved.damageDone) || 0));
    run.selectedTowerId = null;
    return run;
  }

  persistInfiniteRun() {
    if (!this.run || this.run.mode !== 'infinite' || this.run.ended) return;
    const run = this.run;
    this.save.infinite.activeRun = {
      infinitePhase: run.infinitePhase, level: run.level, map: run.map,
      baseHp: run.baseHp, baseMaxHp: run.baseMaxHp, coins: run.coins, clickerLevel: run.clickerLevel, clicks: run.clicks,
      towers: run.towers, enemies: run.enemies, projectiles: run.projectiles, nextEnemyId: run.nextEnemyId,
      spawned: run.spawned, buffs: run.buffs, damageDone: run.damageDone,
      infiniteDirector: this.infinite.serialize(run.infiniteDirector),
    };
    SaveSystem.save(this.save);
  }

  advanceInfinitePhase() {
    if (!this.run || this.run.mode !== 'infinite' || this.run.result !== 'victory') return false;
    const nextPhase = this.run.infinitePhase + 1;
    const previous = this.run;
    this.run = this.createInfiniteRun(nextPhase, { previous, enemies: [], projectiles: [], damageDone: 0, spawned: 0 });
    this.save.infinite.currentPhase = nextPhase;
    this.save.infinite.activeRun = null;
    this.persistInfiniteRun();
    this.lastTime = performance.now();
    this.loopActive = true;
    this.frame = requestAnimationFrame((time) => this.loop(time));
    this.ui.render();
    return true;
  }

  saveAndExitInfinite() {
    if (!this.run || this.run.mode !== 'infinite') return;
    if (!this.run.result) this.persistInfiniteRun();
    else this.save.infinite.activeRun = null;
    SaveSystem.save(this.save);
    this.stopLoop();
    this.run = null;
    this.ui.showMap();
  }

  retryInfinite() {
    this.save.infinite.activeRun = null;
    SaveSystem.save(this.save);
    this.startInfinite({ continueSaved: false, retry: true });
  }

  openInfiniteUpgrades({ discardRun = false } = {}) {
    if (discardRun) this.save.infinite.activeRun = null;
    SaveSystem.save(this.save);
    this.stopLoop();
    this.run = null;
    this.ui.showDefenses();
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
    if (this.run.mode === 'infinite') this.infinite.tick(delta);
    else this.waves.tick(delta);
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
    if (this.run.mode === 'infinite' && !this.run.ended && this.run.baseHp > 0 && this.run.damageDone >= this.run.damageTarget) this.endRun(true);
    const nextThreshold = [10, 20, 30, 40, 50, 60, 70, 80, 90].find((item) => !this.run.miniBosses.includes(item));
    if (nextThreshold && this.run.kills / this.run.totalEnemies * 100 >= nextThreshold && !this.run.pausedForUpgrade) {
      // The wave manager owns the spawn; the offer appears after the mini boss is killed.
    }
    for (const mini of this.run.enemies.filter((enemy) => !enemy.alive && enemy.kind === 'mini' && !enemy.upgradeGiven)) {
      mini.upgradeGiven = true;
      this.roguelike.offer();
    }
    if (this.run.baseHp <= 0) this.endRun(false);
    if (this.run.mode === 'infinite') {
      this.run.saveTimer -= delta;
      if (this.run.saveTimer <= 0) { this.run.saveTimer = .45; this.persistInfiniteRun(); }
    } else SaveSystem.save(this.save);
  }

  endRun(victory) {
    if (!this.run || this.run.ended) return;
    this.run.ended = true;
    this.run.result = victory ? 'victory' : 'defeat';
    if (this.run.mode === 'infinite') {
      const phase = this.run.infinitePhase;
      if (victory) {
        const progress = this.save.infinite;
        progress.completedPhases = [...new Set([...(progress.completedPhases || []), phase])];
        progress.currentPhase = phase + 1;
        progress.record = Math.max(progress.record || 0, phase);
        if (!this.run.developerRun && !progress.rewardsClaimed.includes(phase)) {
          const reward = this.infiniteRewardFor(phase);
          if (reward) {
            progress.rewardsClaimed.push(phase);
            this.save.scrap += reward.scrap || 0;
            this.save.crystals += reward.crystals || 0;
            this.save.technology += reward.technology || 0;
          }
        }
      } else {
        this.save.infinite.currentPhase = Math.max(1, phase - 1);
      }
      this.save.infinite.activeRun = null;
      SaveSystem.save(this.save);
      this.audio.ping(victory ? 720 : 150, victory ? 0.24 : 0.18);
      this.ui.render();
      return;
    }
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
    if (!amount || !this.run || this.run.mode === 'infinite') return;
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
    if (this.run?.mode === 'infinite') {
      this.saveAndExitInfinite();
      return;
    }
    const runLevel = this.run?.level;
    const completedLevel = this.run?.result === 'victory' && !this.run.developerRun ? runLevel : null;
    this.stopLoop();
    this.run = null;
    if (completedLevel) {
      const nextLevel = Math.min(this.levels.maxLevel(), completedLevel + 1);
      this.save.mapLevel = nextLevel;
      this.ui.selectedLevel = nextLevel;
      this.ui.mapFocusLevel = nextLevel;
    } else if (runLevel) {
      this.save.mapLevel = runLevel;
      this.ui.selectedLevel = runLevel;
    }
    SaveSystem.save(this.save);
    this.ui.showMap();
  }
}
