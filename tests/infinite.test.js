import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularObjetivoDanio, getInfinitePhaseConfig, GAME_CONFIG } from '../src/config.js';
import { EnemyManager } from '../src/enemyManager.js';
import { InfiniteManager } from '../src/infiniteManager.js';
import { GameManager } from '../src/gameManager.js';

const path = [{ x: 0, y: 0 }, { x: 540, y: 640 }];

function combatGame() {
  return {
    run: {
      mode: 'infinite', level: 1, infiniteDirector: { config: getInfinitePhaseConfig(1) }, map: { paths: [path] },
      enemies: [], nextEnemyId: 1, spawned: 0, ambientSpawned: 0, damageDone: 0, damageTarget: 1000,
      buffs: {}, phase: null, kills: 0, coins: 0, leaks: 0, baseHp: 100, miniBosses: [], bossCurrencyEarned: 0,
    },
    endRun() {}, grantBossCurrency() {}, feedback() {},
  };
}

test('el daño efectivo no cuenta exceso ni escudo como vida quitada', () => {
  const game = combatGame();
  const enemies = new EnemyManager(game);
  enemies.spawn('normal');
  const target = game.run.enemies[0];
  enemies.hit(target.id, 1000, 0, { x: 0, y: 0 });
  assert.equal(game.run.damageDone, target.maxHp);
  assert.equal(target.hp, 0);
});

test('la configuración del infinito crece sin valores no finitos', () => {
  const early = getInfinitePhaseConfig(1);
  const late = getInfinitePhaseConfig(80);
  assert.ok(late.targetDamage > early.targetDamage);
  assert.ok(Number.isFinite(late.targetDamage));
  assert.ok(late.maxActive <= 24);
  assert.ok(late.enemySpeedMultiplier <= 3.5);
});

test('el objetivo de daño usa el crecimiento absoluto redondeado a decenas', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(calcularObjetivoDanio), [2400, 2760, 3170, 3650, 4200]);
  assert.equal(getInfinitePhaseConfig(3).targetDamage, calcularObjetivoDanio(3));
});

test('el director produce la misma secuencia con la misma semilla', () => {
  const manager = new InfiniteManager({ save: { infinite: { seed: 123 } } });
  const a = manager.createState(4, 123);
  const b = manager.createState(4, 123);
  const sequenceA = Array.from({ length: 8 }, () => manager.pickEvent(a).id);
  const sequenceB = Array.from({ length: 8 }, () => manager.pickEvent(b).id);
  assert.deepEqual(sequenceA, sequenceB);
  assert.equal(a.randomState, b.randomState);
});

test('una fase no entrega dos veces la recompensa al resolver dos veces', () => {
  const game = Object.create(GameManager.prototype);
  game.run = { mode: 'infinite', ended: false, result: null, infinitePhase: 1, developerRun: false };
  game.save = { scrap: 0, crystals: 0, technology: 0, infinite: { currentPhase: 1, record: 0, completedPhases: [], rewardsClaimed: [], activeRun: null } };
  game.audio = { ping() {} };
  game.ui = { render() {} };
  game.endRun(true);
  const firstReward = { scrap: game.save.scrap, crystals: game.save.crystals };
  game.endRun(true);
  assert.deepEqual({ scrap: game.save.scrap, crystals: game.save.crystals }, firstReward);
  assert.deepEqual(game.save.infinite.rewardsClaimed, [1]);
});

test('cada fase nueva empieza limpia y conserva las mejoras permanentes', () => {
  const game = Object.create(GameManager.prototype);
  game.save = {
    scrap: 0,
    crystals: 8,
    technology: 0,
    towerLevels: { gunner: 4 },
    settings: { developer: false },
    infinite: { seed: 123, currentPhase: 1, record: 0, completedPhases: [], rewardsClaimed: [], activeRun: null },
  };
  game.infinite = new InfiniteManager(game);
  game.ui = { render() {} };
  game.audio = { ping() {} };
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  try {
    game.run = game.createInfiniteRun(1);
    game.run.towers = [{ id: 'tower-old', type: 'gunner', level: 3 }];
    game.run.enemies = [{ id: 'enemy-old' }];
    game.run.projectiles = [{ id: 'projectile-old' }];
    game.run.coins = 3;
    game.run.clickerLevel = 4;
    game.run.clicks = 17;
    game.run.buffs = { attack_speed: 0.15 };
    game.run.damageDone = 123;
    game.run.result = 'victory';

    assert.equal(game.advanceInfinitePhase(), true);
    assert.equal(game.run.infinitePhase, 2);
    assert.equal(game.run.damageTarget, 2760);
    assert.equal(game.run.coins, getInfinitePhaseConfig(2).reconstructionCoins);
    assert.equal(game.run.clickerLevel, 1);
    assert.equal(game.run.clicks, 0);
    assert.deepEqual(game.run.towers, []);
    assert.deepEqual(game.run.enemies, []);
    assert.deepEqual(game.run.projectiles, []);
    assert.deepEqual(game.run.buffs, {});
    assert.equal(game.run.damageDone, 0);
    assert.equal(game.run.baseHp, GAME_CONFIG.infinite.baseHp);
    assert.equal(game.run.difficulty.phase, 2);
    assert.equal(game.save.towerLevels.gunner, 4);
    assert.equal(game.save.infinite.currentPhase, 2);
    assert.equal(game.advanceInfinitePhase(), false);

    game.run.result = 'victory';
    assert.equal(game.advanceInfinitePhase(), true);
    assert.equal(game.run.infinitePhase, 3);
    assert.equal(game.run.damageTarget, 3170);
    assert.equal(game.run.clickerLevel, 1);
    assert.equal(game.run.coins, getInfinitePhaseConfig(3).reconstructionCoins);
  } finally {
    if (previousRequestAnimationFrame) globalThis.requestAnimationFrame = previousRequestAnimationFrame;
    else delete globalThis.requestAnimationFrame;
  }
});

test('un intento guardado conserva el estado de la fase al restaurarse', () => {
  const game = Object.create(GameManager.prototype);
  game.save = {
    settings: { developer: false },
    infinite: { seed: 321, currentPhase: 2, activeRun: null },
  };
  game.infinite = new InfiniteManager(game);
  const savedRun = game.createInfiniteRun(2, {
    coins: 47,
    clickerLevel: 2,
    clicks: 9,
    towers: [{ id: 'tower-saved', type: 'gunner', level: 2 }],
    enemies: [{ id: 'enemy-saved', alive: true }],
    projectiles: [{ id: 'projectile-saved' }],
    damageDone: 800,
    buffs: { range: 0.1 },
  });
  game.run = savedRun;
  game.persistInfiniteRun();

  const restored = game.restoreInfiniteRun(game.save.infinite.activeRun);
  assert.equal(restored.infinitePhase, 2);
  assert.equal(restored.coins, 47);
  assert.equal(restored.clickerLevel, 2);
  assert.equal(restored.clicks, 9);
  assert.equal(restored.damageDone, 800);
  assert.equal(restored.towers.length, 1);
  assert.equal(restored.enemies.length, 1);
  assert.equal(restored.projectiles.length, 1);
  assert.deepEqual(restored.buffs, { range: 0.1 });
});

test('guardar una victoria deja la siguiente fase pendiente y perder retrocede una sola fase', () => {
  const game = Object.create(GameManager.prototype);
  game.save = {
    scrap: 0,
    crystals: 0,
    technology: 0,
    infinite: { currentPhase: 1, record: 0, completedPhases: [], rewardsClaimed: [], activeRun: null },
  };
  game.audio = { ping() {} };
  game.ui = { render() {} };

  game.run = { mode: 'infinite', ended: false, result: null, infinitePhase: 1, developerRun: false };
  game.endRun(true);
  assert.equal(game.save.infinite.currentPhase, 2);
  assert.equal(game.save.infinite.activeRun, null);

  game.run = { mode: 'infinite', ended: false, result: null, infinitePhase: 3, developerRun: false };
  game.save.infinite.currentPhase = 3;
  game.endRun(false);
  assert.equal(game.save.infinite.currentPhase, 2);
  assert.equal(game.save.infinite.activeRun, null);
});
