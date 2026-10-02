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
import { enemyPosition, canonicalEnemyKind, normalizeEnemyCombatState } from './enemyData.js';

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
        towers: [], enemies: [], projectiles: [], groundFires: [], nextEnemyId: 1,
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
    const rewards = GAME_CONFIG.economy.permanent.infiniteRewards;
    const base = rewards.base.start + Math.max(0, safePhase - 1) * rewards.base.step;
    const milestone = Number(rewards.milestones[safePhase]) || 0;
    return { supplies: base + milestone, milestone };
  }

  createInfiniteRun(phase, options = {}) {
    const config = getInfinitePhaseConfig(phase);
    const currentPhase = config.phase;
    const map = options.map || options.previous?.map || MapGenerator.generate(1, this.save.infinite.seed);
    const director = options.director || this.infinite.createState(currentPhase, this.save.infinite.seed);
    return {
      mode: 'infinite', level: currentPhase, infinitePhase: currentPhase,
      meta: { level: currentPhase, name: `Fase ${currentPhase}` }, map,
      developerRun: Boolean(this.save.settings?.developer),
      baseHp: config ? GAME_CONFIG.infinite.baseHp : GAME_CONFIG.levels.startingBaseHp,
      baseMaxHp: GAME_CONFIG.infinite.baseHp,
      coins: options.coins ?? config.reconstructionCoins,
      clickerLevel: options.clickerLevel ?? 1,
      autoCoins: 0, autoCoinTimer: 0, clicks: options.clicks ?? 0,
      towers: options.towers ?? [], enemies: options.enemies ?? [], projectiles: options.projectiles ?? [], groundFires: options.groundFires ?? [],
      nextEnemyId: options.nextEnemyId ?? 1,
      difficulty: config, wavePlan: [], phaseIndex: 0, phase: null, phaseSpawned: 0, phaseKills: 0, phaseLeaks: 0,
      phaseLabel: 'FASE EN CURSO', phaseTimer: 0, phaseCountdown: 0, waveNumber: 0, totalEnemies: 0, totalWaves: 0,
      spawned: options.spawned ?? 0, ambientSpawned: 0, ambientSpawnedThisPhase: 0, ambientTimer: 0, spawnTimer: 0,
      kills: options.kills ?? 0, leaks: options.leaks ?? 0,
      bossReadyTimer: 0, bossActive: false, miniBossActive: false, bossCurrencyEarned: 0, miniBosses: [],
      upgradeOptions: [], pausedForUpgrade: false, buffs: options.buffs ?? {},
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
        this.run = this.createInfiniteRun(phase, { coins: config.reconstructionCoins });
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

  createTestRun(options = {}) {
    const level = Math.max(1, Math.min(10, Math.floor(Number(options.level) || 1)));
    const difficulty = getLevelDifficulty(level);
    return {
      mode: 'test', testMode: true, level, meta: { level, name: 'Modo de prueba' }, map: options.map || MapGenerator.generate(level),
      developerRun: true, baseHp: GAME_CONFIG.levels.startingBaseHp, baseMaxHp: GAME_CONFIG.levels.startingBaseHp,
      testInvulnerable: Boolean(options.testInvulnerable), testPermanentLevel: Math.max(1, Math.min(10, Number(options.testPermanentLevel) || 1)),
      testDifficulty: options.testDifficulty || 'normal', unlimitedCoins: true, coins: 999999999, clickerLevel: 1, clicks: 0,
      autoCoins: 0, autoCoinTimer: 0, towers: [], enemies: [], projectiles: [], groundFires: [], nextEnemyId: 1,
      difficulty, wavePlan: [], phaseIndex: 0, phase: null, phaseSpawned: 0, phaseKills: 0, phaseLeaks: 0, phaseLabel: 'PRUEBA MANUAL', phaseTimer: 0, phaseCountdown: 0, waveNumber: 0,
      totalEnemies: 0, totalWaves: 0, spawned: 0, ambientSpawned: 0, ambientSpawnedThisPhase: 0, ambientTimer: 0, spawnTimer: 0,
      kills: 0, leaks: 0, bossReadyTimer: 0, bossActive: false, miniBossActive: false, bossCurrencyEarned: 0, miniBosses: [], upgradeOptions: [], pausedForUpgrade: false, paused: false, buffs: {},
      placingType: null, placingLevel: 1, selectedTowerId: null, selectedEnemyId: null, mergeTargetId: null, mergeableTowerIds: new Set(), drag: null, mergeFx: null, placementPreview: null, ended: false, result: null,
    };
  }

  startTest(options = {}) {
    this.stopLoop();
    try {
      this.run = this.createTestRun(options);
      if (!this.ui.showBattle()) { this.run = null; return; }
      this.ui.render();
      this.lastTime = performance.now(); this.loopActive = true;
      this.frame = requestAnimationFrame((time) => this.loop(time));
    } catch (error) {
      console.error('No se pudo iniciar el modo de prueba', error);
      this.run = null; this.ui.showMap(); this.ui.showToast('No se pudo iniciar el modo de prueba.');
    }
  }

  resetTest() {
    if (!this.run?.testMode) return false;
    const options = { level: this.run.level, testPermanentLevel: this.run.testPermanentLevel, testDifficulty: this.run.testDifficulty, testInvulnerable: this.run.testInvulnerable, map: this.run.map };
    this.run = this.createTestRun(options); this.ui.showBattle(); this.ui.render();
    this.lastTime = performance.now(); this.loopActive = true; this.frame = requestAnimationFrame((time) => this.loop(time));
    return true;
  }

  clearTestEntities() {
    if (!this.run?.testMode) return false;
    this.run.enemies = []; this.run.projectiles = []; this.run.groundFires = []; this.run.selectedEnemyId = null; this.run.bossActive = false; this.run.miniBossActive = false; this.run.mergeFx = null; return true;
  }

  setTestPaused(paused) { if (!this.run?.testMode) return false; this.run.paused = Boolean(paused); return true; }

  restoreInfiniteRun(saved) {
    const phase = Math.max(1, Math.floor(Number(saved.infinitePhase) || this.save.infinite.currentPhase || 1));
    const run = this.createInfiniteRun(phase, {
      ...saved,
      director: this.infinite.restore(saved.infiniteDirector, phase),
      coins: Number(saved.coins) || 0,
      towers: Array.isArray(saved.towers) ? saved.towers : [],
      enemies: Array.isArray(saved.enemies) ? saved.enemies.map((enemy) => {
        const kind = canonicalEnemyKind(enemy.kind);
        const base = GAME_CONFIG.enemies[kind] || GAME_CONFIG.enemies.normal;
        return normalizeEnemyCombatState({ ...enemy, kind, shelterDamage: Number.isFinite(enemy.shelterDamage) || enemy.shelterDamage === Infinity ? enemy.shelterDamage : base.shelterDamage, speedRelative: enemy.speedRelative ?? base.speedRelative, armorReduction: enemy.armorReduction ?? base.armorReduction ?? 0, regenRate: enemy.regenRate ?? base.regen ?? 0, controlResistance: enemy.controlResistance ?? base.controlResistance ?? 0, freezeImmunity: enemy.freezeImmunity || 0, regenSuppressed: enemy.regenSuppressed || 0, regenReduction: enemy.regenReduction || 0, vulnerabilityTimer: enemy.vulnerabilityTimer || 0 });
      }) : [],
      projectiles: Array.isArray(saved.projectiles) ? saved.projectiles : [],
      groundFires: Array.isArray(saved.groundFires) ? saved.groundFires : [],
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
      towers: run.towers, enemies: run.enemies, projectiles: run.projectiles, groundFires: run.groundFires, nextEnemyId: run.nextEnemyId,
      spawned: run.spawned, buffs: run.buffs, damageDone: run.damageDone,
      infiniteDirector: this.infinite.serialize(run.infiniteDirector),
    };
    SaveSystem.save(this.save);
  }

  advanceInfinitePhase() {
    if (!this.run || this.run.mode !== 'infinite' || this.run.result !== 'victory' || this.run.phaseTransitioned) return false;
    const nextPhase = this.run.infinitePhase + 1;
    const previous = this.run;
    previous.phaseTransitioned = true;
    this.run = this.createInfiniteRun(nextPhase, { map: previous.map });
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
      if (!this.run.ended && !this.run.pausedForUpgrade && !this.run.paused) this.update(delta);
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
    else if (!this.run.testMode) this.waves.tick(delta);
    this.enemies.tick(delta);
    this.towers.tick(delta);
    this.updateProjectiles(delta);
    if (this.run.mode === 'infinite' && !this.run.ended && this.run.baseHp > 0 && this.run.damageDone >= this.run.damageTarget) this.endRun(true);
    const nextThreshold = [10, 20, 30, 40, 50, 60, 70, 80, 90].find((item) => !this.run.miniBosses.includes(item));
    if (nextThreshold && this.run.kills / this.run.totalEnemies * 100 >= nextThreshold && !this.run.pausedForUpgrade) {
      // The wave manager owns the spawn; the offer appears after the mini boss is killed.
    }
    for (const mini of this.run.enemies.filter((enemy) => !enemy.alive && enemy.kind === 'mini' && !enemy.upgradeGiven)) {
      mini.upgradeGiven = true;
      if (!this.run.testMode) this.roguelike.offer();
    }
    if (this.run.baseHp <= 0) this.endRun(false);
    if (this.run.mode === 'infinite') {
      this.run.saveTimer -= delta;
      if (this.run.saveTimer <= 0) { this.run.saveTimer = .45; this.persistInfiniteRun(); }
    } else SaveSystem.save(this.save);
  }

  updateProjectiles(delta) {
    const run = this.run;
    for (const projectile of run.projectiles) {
      if (projectile.done) continue;
      if (!projectile.from || !Number.isFinite(projectile.from.x) || !Number.isFinite(projectile.from.y)) { projectile.done = true; continue; }
      const target = run.enemies.find((enemy) => enemy.alive && (enemy.id === projectile.targetId || String(enemy.id) === String(projectile.targetId)));
      const activeTarget = target || (projectile.reassign ? this.findProjectileReplacement(projectile) : null);
      if (activeTarget && activeTarget.id !== projectile.targetId) {
        projectile.targetId = activeTarget.id;
        projectile.to = enemyPosition(activeTarget);
        projectile.targetPosition = projectile.to;
      }
      const currentTarget = activeTarget || target;
      const previousPosition = projectile.position || projectile.from || { x: 0, y: 0 };
      const previousTargetPosition = projectile.targetPosition || projectile.to || previousPosition;
      if (currentTarget && projectile.guided) projectile.to = enemyPosition(currentTarget);
      const maxLife = Math.max(0.001, Number(projectile.maxLife) || Number(projectile.life) || 0.001);
      const previousLife = Math.max(0, Number(projectile.life) || 0);
      projectile.life = previousLife - Math.max(0, delta);
      const progress = Math.max(0, Math.min(1, 1 - Math.max(0, projectile.life) / maxLife));
      const destination = projectile.to || previousPosition;
      const currentPosition = {
        x: projectile.from.x + (destination.x - projectile.from.x) * progress,
        y: projectile.from.y + (destination.y - projectile.from.y) * progress,
      };
      const currentTargetPosition = currentTarget ? enemyPosition(currentTarget) : previousTargetPosition;
      projectile.previousPosition = previousPosition;
      projectile.position = currentPosition;
      projectile.targetPosition = currentTargetPosition;

      if (currentTarget && this.sweptProjectileHit(previousPosition, currentPosition, previousTargetPosition, currentTargetPosition, currentTarget.radius, projectile.radius)) {
        this.impactProjectile(projectile, currentTarget, currentTargetPosition);
        continue;
      }

      if (projectile.life > 0) continue;
      let impactTarget = currentTarget;
      if (!impactTarget && projectile.reassign) impactTarget = this.findProjectileReplacement(projectile);
      if (impactTarget) {
        projectile.targetId = impactTarget.id;
        projectile.to = enemyPosition(impactTarget);
        this.impactProjectile(projectile, impactTarget, projectile.to);
      }
      projectile.done = true;
    }
    run.projectiles = run.projectiles.filter((projectile) => !projectile.done);
  }

  findProjectileReplacement(projectile) {
    return this.run.enemies
      .filter((enemy) => enemy.alive && Math.hypot(enemyPosition(enemy).x - projectile.from.x, enemyPosition(enemy).y - projectile.from.y) <= (projectile.range || Infinity))
      .sort((a, b) => b.progress - a.progress)[0] || null;
  }

  impactProjectile(projectile, target, position) {
    projectile.targetId = target.id;
    projectile.to = { ...position };
    this.enemies.hit(target.id, projectile.damage, projectile.splash, projectile.to, projectile);
    projectile.done = true;
  }

  sweptProjectileHit(projectileStart, projectileEnd, targetStart, targetEnd, targetRadius = 8, projectileRadius = 3) {
    const start = { x: projectileStart.x - targetStart.x, y: projectileStart.y - targetStart.y };
    const end = { x: projectileEnd.x - targetEnd.x, y: projectileEnd.y - targetEnd.y };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared ? Math.max(0, Math.min(1, -(start.x * dx + start.y * dy) / lengthSquared)) : 0;
    const closest = { x: start.x + dx * projection, y: start.y + dy * projection };
    return Math.hypot(closest.x, closest.y) <= Math.max(1, Number(targetRadius) || 8) + Math.max(0, Number(projectileRadius) || 0);
  }

  endRun(victory) {
    if (!this.run || this.run.ended) return;
    this.run.ended = true;
    this.run.result = victory ? 'victory' : 'defeat';
    if (this.run.testMode) { this.ui.render(); return; }
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
            this.grantSupplies(reward.supplies || 0, false);
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
      const reward = this.levels.complete(this.run.level, stars);
      this.run.suppliesReward = reward.supplies;
      this.audio.ping(720, 0.24);
    } else if (!this.run.developerRun) {
      this.audio.ping(150, 0.18);
    } else {
      this.feedback('MODO DEV · progreso no guardado', 'info');
    }
    SaveSystem.save(this.save);
    this.ui.render();
  }

  towerLevel(type) {
    if (this.run?.testMode) return this.run.testPermanentLevel;
    return Math.max(1, Math.min(GAME_CONFIG.economy.permanent.maxTowerLevel, Number(this.save.towerLevels?.[type]) || 1));
  }

  towerUpgradeCost(type) {
    const tower = GAME_CONFIG.towers[type];
    const level = this.towerLevel(type);
    if (!tower || level >= GAME_CONFIG.economy.permanent.maxTowerLevel) return null;
    const pv = GAME_CONFIG.economy.permanent.levelCostsPv[level - 1];
    return Math.ceil(pv / GAME_CONFIG.economy.permanent.gearValues[tower.rarityId]);
  }

  upgradePermanentTower(type) {
    if (!GAME_CONFIG.towers[type] || this.towerLevel(type) >= GAME_CONFIG.economy.permanent.maxTowerLevel) return false;
    const cost = this.towerUpgradeCost(type);
    const rarity = GAME_CONFIG.towers[type].rarityId;
    this.economy.ensurePermanentState();
    if (this.save.gears[rarity] < cost) return false;
    this.save.gears[rarity] -= cost;
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
    this.feedback(`+${amount} CRISTAL${amount === 1 ? '' : 'ES'}`, 'special');
  }

  grantSupplies(amount, persist = true) {
    if (this.economy?.addSupplies) return this.economy.addSupplies(amount, { persist });
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    this.save.supplies = Math.max(0, Math.floor(Number(this.save.supplies ?? this.save.scrap) || 0)) + value;
    this.save.scrap = this.save.supplies;
    if (persist) SaveSystem.save(this.save);
    return value;
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
    if (this.run?.testMode) { this.stopLoop(); this.run = null; this.ui.showMap(); return; }
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
