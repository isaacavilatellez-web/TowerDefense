import test from 'node:test';
import assert from 'node:assert/strict';
import { getInfinitePhaseConfig } from '../src/config.js';
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
