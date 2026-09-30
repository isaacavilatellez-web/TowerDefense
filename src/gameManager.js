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
import { InfiniteDirector } from './infiniteMode.js';

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
    this.infinite = new InfiniteDirector(this);
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

  infiniteUnlocked() {
    return Boolean(this.save.settings?.developer || this.save.completedLevels.length > 0);
  }

  startInfinite() {
    if (!this.infiniteUnlocked()) return false;
    this.stopLoop();
    const savedRun = this.save.settings?.developer ? null : this.save.infinite?.currentRun;
    try {
      if (savedRun) {
        this.run = this.restoreInfiniteRun(savedRun);
        // Una fase completada y guardada deja el intento listo para empezar
        // la siguiente. No volvemos a mostrar el resultado ni repetimos la
        // recompensa al continuar desde el menú.
        if (this.run.infinite.phaseTransition) {
          this.run.result = 'infinite-phase-complete';
          this.nextInfinitePhase();
        }
      } else {
        const phase = Math.max(1, this.save.infinite?.currentPhase || 1);
        const attempt = Math.max(0, this.save.infinite?.attempt || 0) + 1;
        if (!this.save.settings?.developer) this.save.infinite.attempt = attempt;
        const map = MapGenerator.generate(1);
        this.run = this.createInfiniteRun(phase, attempt, map);
      }
      if (!this.ui.showBattle()) {
        this.run = null;
        return false;
      }
      this.ui.render();
      this.saveInfiniteRun();
      this.lastTime = performance.now();
      this.loopActive = true;
      this.frame = requestAnimationFrame((time) => this.loop(time));
      return true;
    } catch (error) {
      console.error('No se pudo iniciar el modo infinito', error);
      this.run = null;
      this.ui.showInfiniteHub();
      this.ui.showToast('No se pudo cargar el modo infinito.');
      return false;
    }
  }

  createInfiniteRun(phase, attempt, map, debugTowerLevels = {}) {
    const state = this.infinite.createAttemptState(phase, attempt);
    return {
      level: 1,
      meta: { level: 1, name: 'Modo infinito' },
      map,
      developerRun: Boolean(this.save.settings?.developer),
      baseHp: GAME_CONFIG.levels.startingBaseHp,
      baseMaxHp: GAME_CONFIG.levels.startingBaseHp,
      coins: state.difficulty.rebuildBudget,
      clickerLevel: 1,
      autoCoins: 0,
      autoCoinTimer: 0,
      clicks: 0,
      towers: [],
      enemies: [],
      projectiles: [],
      nextEnemyId: 1,
      difficulty: state.difficulty,
      wavePlan: [],
      phaseIndex: -1,
      phase: null,
      phaseSpawned: 0,
      phaseKills: 0,
      phaseLeaks: 0,
      phaseLabel: `FASE ${phase}`,
      phaseTimer: 0,
      phaseCountdown: 0,
      waveNumber: 0,
      totalEnemies: 0,
      totalWaves: 0,
      spawned: 0,
      ambientSpawned: 0,
      ambientSpawnedThisPhase: 0,
      ambientTimer: 0,
      kills: 0,
      leaks: 0,
      spawnTimer: 0,
      bossReadyTimer: 0,
      bossActive: false,
      miniBossActive: false,
      bossCurrencyEarned: 0,
      miniBosses: [],
      upgradeOptions: [],
      pausedForUpgrade: false,
      buffs: {},
      placingType: null,
      placingLevel: 1,
      selectedTowerId: null,
      mergeTargetId: null,
      mergeableTowerIds: new Set(),
      drag: null,
      mergeFx: null,
      placementPreview: null,
      ended: false,
      result: null,
      devTowerLevels: debugTowerLevels,
      infinite: state,
    };
  }

  startInfiniteForDeveloper(phase = 1, towerType = 'gunner', towerLevel = 1) {
    if (!this.save.settings?.developer) return false;
    this.stopLoop();
    const safePhase = Math.max(1, Math.min(999, Math.floor(Number(phase) || 1)));
    const safeLevel = Math.max(1, Math.min(20, Math.floor(Number(towerLevel) || 1)));
    const map = MapGenerator.generate(1);
    this.run = this.createInfiniteRun(safePhase, this.save.infinite?.attempt || 0, map, { [towerType]: safeLevel });
    if (!this.ui.showBattle()) { this.run = null; return false; }
    this.ui.render();
    this.lastTime = performance.now();
    this.loopActive = true;
    this.frame = requestAnimationFrame((time) => this.loop(time));
    return true;
  }

  restoreInfiniteRun(snapshot) {
    const phase = snapshot.infinite?.activePhase || this.save.infinite?.currentPhase || 1;
    const difficulty = snapshot.infinite?.difficulty || this.infinite.createAttemptState(phase, this.save.infinite?.attempt || 0).difficulty;
    const infiniteState = {
      ...snapshot.infinite,
      activePhase: phase,
      difficulty,
      targetDamage: Number.isFinite(Number(snapshot.infinite?.targetDamage)) ? Number(snapshot.infinite.targetDamage) : difficulty.targetDamage,
      damage: Math.max(0, Number(snapshot.infinite?.damage) || 0),
      activeThreat: Math.max(0, Number(snapshot.infinite?.activeThreat) || 0),
      rngState: Number(snapshot.infinite?.rngState) >>> 0,
      phaseTransition: Boolean(snapshot.infinite?.phaseTransition),
    };
    return {
      ...this.createInfiniteRun(phase, snapshot.infinite?.attempt || this.save.infinite?.attempt || 1, snapshot.map || MapGenerator.generate(1)),
      ...snapshot,
      map: snapshot.map || MapGenerator.generate(1),
      difficulty,
      infinite: infiniteState,
      mergeableTowerIds: new Set(),
      drag: null,
      ended: false,
      result: null,
    };
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
    if (this.run?.infinite) {
      this.updateInfinite(delta);
      return;
    }
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

  updateInfinite(delta) {
    const run = this.run;
    if (!run || run.ended || run.infinite.phaseTransition) {
      if (run?.infinite) this.saveInfiniteRun();
      return;
    }
    this.economy.tick(delta);
    this.infinite.tick(delta);
    this.enemies.tick(delta);
    if (run.ended) return;
    this.towers.tick(delta);
    for (const projectile of run.projectiles) {
      projectile.life -= delta;
      if (projectile.life <= 0) {
        this.enemies.hit(projectile.targetId, projectile.damage, projectile.splash, projectile.to, projectile);
        projectile.done = true;
      }
    }
    run.projectiles = run.projectiles.filter((projectile) => !projectile.done);
    // El refugio se comprueba primero. Así, un impacto letal y el último daño
    // del objetivo en el mismo paso siempre cuentan como derrota.
    if (run.baseHp <= 0) {
      this.endRun(false);
      return;
    }
    if (run.infinite.damage >= run.infinite.targetDamage && !run.infinite.phaseTransition) {
      this.completeInfinitePhase();
      return;
    }
    this.saveInfiniteRun();
  }

  endRun(victory) {
    if (!this.run || this.run.ended) return;
    if (this.run.infinite) {
      if (victory) this.completeInfinitePhase();
      else this.defeatInfinite();
      return;
    }
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

  towerLevel(type) {
    const debugLevel = this.run?.developerRun ? this.run.devTowerLevels?.[type] : null;
    return Math.max(1, Number(debugLevel || this.save.towerLevels?.[type]) || 1);
  }

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
    if (this.run?.infinite) this.saveInfiniteRun();
    return true;
  }

  saveInfiniteRun() {
    if (!this.run?.infinite || this.run.developerRun) return;
    this.save.infinite.currentRun = this.infinite.finiteRunSnapshot(this.run);
    SaveSystem.save(this.save);
  }

  claimInfiniteReward(phase) {
    const reward = this.infinite.firstReward(phase);
    const milestone = this.infinite.milestoneReward(phase);
    const total = {
      scrap: reward.scrap + (milestone?.scrap || 0),
      technology: reward.technology + (milestone?.technology || 0),
      crystals: milestone?.crystals || 0,
    };
    const key = `phase:${phase}`;
    if (this.run?.developerRun) return total;
    if (!this.save.infinite.claimedRewards.includes(key)) {
      this.save.infinite.claimedRewards.push(key);
      this.save.scrap += total.scrap;
      this.save.technology += total.technology;
      this.save.crystals += total.crystals;
      SaveSystem.save(this.save);
      return total;
    }
    return { scrap: 0, technology: 0, crystals: 0 };
  }

  completeInfinitePhase() {
    const run = this.run;
    if (!run?.infinite || run.ended || run.infinite.phaseTransition || run.baseHp <= 0) return false;
    const completed = run.infinite.activePhase;
    run.infinite.phaseTransition = true;
    run.infinite.completedPhase = completed;
    run.infinite.nextPhase = completed + 1;
    run.infinite.lastReward = this.claimInfiniteReward(completed);
    run.infinite.damage = 0;
    run.infinite.activeThreat = 0;
    run.drag = null;
    run.placingType = null;
    run.placementPreview = null;
    run.mergeTargetId = null;
    run.mergeableTowerIds = new Set();
    run.baseHp = run.baseMaxHp;
    run.enemies = [];
    run.projectiles = [];
    if (!run.developerRun) {
      this.save.infinite.highestCompletedPhase = Math.max(this.save.infinite.highestCompletedPhase || 0, completed);
      this.save.infinite.currentPhase = Math.max(this.save.infinite.currentPhase || 1, completed + 1);
      this.save.infinite.bestPhase = Math.max(this.save.infinite.bestPhase || 1, completed + 1);
    }
    run.result = 'infinite-phase-complete';
    this.saveInfiniteRun();
    this.audio.ping(720, 0.24);
    return true;
  }

  nextInfinitePhase() {
    const run = this.run;
    if (!run?.infinite?.phaseTransition || run.result !== 'infinite-phase-complete') return false;
    const phase = run.infinite.nextPhase || this.save.infinite.currentPhase || 1;
    this.infinite.beginPhase(run, phase);
    run.difficulty = run.infinite.difficulty;
    run.phaseLabel = `FASE ${phase}`;
    run.result = null;
    this.saveInfiniteRun();
    return true;
  }

  defeatInfinite() {
    const run = this.run;
    if (!run?.infinite || run.ended) return false;
    const previous = run.infinite.activePhase;
    const next = Math.max(1, previous - 1);
    run.ended = true;
    run.result = 'infinite-defeat';
    run.infinite.defeatPhase = previous;
    run.infinite.newPhase = next;
    run.infinite.damageAtDefeat = Math.max(0, run.infinite.damage);
    run.infinite.targetAtDefeat = run.infinite.targetDamage;
    run.enemies = [];
    run.projectiles = [];
    run.infinite.activeThreat = 0;
    if (!run.developerRun) {
      this.save.infinite.currentPhase = next;
      this.save.infinite.currentRun = null;
      SaveSystem.save(this.save);
    }
    this.audio.ping(150, 0.18);
    return true;
  }

  retryInfinite() {
    if (this.run?.result !== 'infinite-defeat') return false;
    this.run = null;
    return this.startInfinite();
  }

  abandonInfinite() {
    if (!this.run?.infinite || this.run.ended) return false;
    this.endRun(false);
    return true;
  }

  abandonSavedInfinite() {
    const saved = this.save.infinite?.currentRun;
    const active = saved?.infinite?.activePhase || this.save.infinite?.currentPhase || 1;
    this.save.infinite.currentPhase = Math.max(1, active - 1);
    this.save.infinite.currentRun = null;
    SaveSystem.save(this.save);
    this.ui.showInfiniteHub();
  }

  leaveInfiniteToMenu() {
    this.stopLoop();
    this.run = null;
    this.ui.showMap();
  }

  saveAndExitInfinite() {
    if (!this.run?.infinite) return false;
    this.saveInfiniteRun();
    this.stopLoop();
    this.run = null;
    this.ui.showInfiniteHub();
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
    if (this.run?.infinite) return this.saveAndExitInfinite();
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
