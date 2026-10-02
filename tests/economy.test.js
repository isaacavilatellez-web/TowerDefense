import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../src/config.js';
import { EconomyManager, distributeChestValue, randomChestValue } from '../src/economyManager.js';
import { GameManager } from '../src/gameManager.js';
import { LevelManager } from '../src/levelManager.js';
import { getTowerStats } from '../src/towerData.js';

const permanent = GAME_CONFIG.economy.permanent;

function economyGame(save = {}) {
  return {
    save: {
      supplies: 0,
      scrap: 0,
      crystals: 0,
      gears: { common: 0, rare: 0, epic: 0, legendary: 0 },
      ...save,
    },
    feedback() {},
  };
}

test('cada cofre genera un valor válido en saltos de diez', () => {
  for (const chest of permanent.chests) {
    const values = new Set(Array.from({ length: 101 }, (_, index) => randomChestValue(chest, () => index / 100)));
    for (const value of values) {
      assert.ok(value >= chest.valueRange[0] && value <= chest.valueRange[1]);
      assert.equal((value - chest.valueRange[0]) % 10, 0);
    }
  }
});

test('el reparto consume exactamente todo el valor y nunca excede el resto', () => {
  for (const chest of permanent.chests) {
    for (const total of [chest.valueRange[0], chest.valueRange[1], chest.valueRange[0] + 70]) {
      const rewards = distributeChestValue(total, chest.weights, () => Math.random());
      const spent = Object.entries(rewards).reduce((sum, [rarity, count]) => sum + permanent.gearValues[rarity] * count, 0);
      assert.equal(spent, total, `${chest.id} debe convertir ${total} PV sin pérdidas`);
    }
  }
});

test('abrir cofre descuenta suministros una sola vez y añade engranajes', () => {
  const game = economyGame({ supplies: 500 });
  const economy = new EconomyManager(game);
  const result = economy.openChest('wood', () => 0);
  assert.equal(result.ok, true);
  assert.equal(game.save.supplies, 0);
  assert.equal(game.save.scrap, 0);
  assert.equal(game.save.gears.common, 50);
  const denied = economy.openChest('wood', () => 0);
  assert.equal(denied.ok, false);
  assert.equal(game.save.supplies, 0);
});

test('las probabilidades se aplican como pesos y las rarezas se desbloquean sólo si caben', () => {
  const chest = permanent.chests[0];
  const commonOnly = distributeChestValue(73, chest.weights, () => 0.999);
  assert.equal(commonOnly.legendary, 0);
  assert.equal(Object.entries(commonOnly).reduce((sum, [rarity, count]) => sum + permanent.gearValues[rarity] * count, 0), 73);

  const samples = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (let index = 0; index < 4000; index += 1) {
    const random = (() => {
      let state = (index + 1) * 2654435761;
      return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
    })();
    const rewards = distributeChestValue(1000, chest.weights, random);
    for (const rarity of Object.keys(samples)) samples[rarity] += rewards[rarity];
  }
  assert.ok(samples.common > samples.rare);
  assert.ok(samples.rare > samples.epic);
  assert.ok(samples.epic > samples.legendary);
});

test('los costes permanentes de las cuatro rarezas usan la misma tabla de PV', () => {
  const game = Object.create(GameManager.prototype);
  game.save = { towerLevels: { gunner: 1, flame: 1, tesla: 1, sniper: 1 }, gears: { common: 100, rare: 20, epic: 5, legendary: 1 } };
  game.economy = new EconomyManager(game);
  assert.deepEqual(['gunner', 'flame', 'tesla', 'sniper'].map((type) => game.towerUpgradeCost(type)), [50, 10, 3, 1]);
  assert.equal(game.upgradePermanentTower('sniper'), true);
  assert.equal(game.save.gears.legendary, 0);
  assert.equal(game.towerLevel('sniper'), 2);
  assert.equal(game.upgradePermanentTower('sniper'), false);
  assert.ok(getTowerStats('sniper', 1, {}, 2).damage > getTowerStats('sniper', 1, {}, 1).damage);
});

test('la compra directa consume Cristales y entrega exactamente el engranaje elegido', () => {
  const game = economyGame({ crystals: 299 });
  const economy = new EconomyManager(game);
  assert.equal(economy.buyGear('legendary').ok, false);
  assert.equal(game.save.crystals, 299);
  game.save.crystals = 300;
  assert.equal(economy.buyGear('legendary').ok, true);
  assert.equal(game.save.crystals, 0);
  assert.equal(game.save.gears.legendary, 1);
});

test('la primera victoria y las repeticiones entregan recompensas distintas', () => {
  const game = economyGame({ completedLevels: [], firstVictoryLevels: [], stars: {}, currentLevel: 1, mapLevel: 1 });
  game.economy = new EconomyManager(game);
  game.levels = new LevelManager(game);
  assert.equal(game.levels.complete(1, 3).supplies, 150);
  assert.equal(game.save.supplies, 150);
  assert.equal(game.levels.complete(1, 2).supplies, 50);
  assert.equal(game.save.supplies, 200);
  assert.deepEqual(game.save.firstVictoryLevels, [1]);
});

test('el infinito entrega Suministros crecientes y bonus configurables por hito', () => {
  const game = Object.create(GameManager.prototype);
  assert.equal(game.infiniteRewardFor(1).supplies, 20);
  assert.equal(game.infiniteRewardFor(4).supplies, 35);
  assert.equal(game.infiniteRewardFor(5).supplies, 140);
  assert.equal(game.infiniteRewardFor(10).supplies, 265);
  assert.equal(game.infiniteRewardFor(20).supplies, 515);
});
