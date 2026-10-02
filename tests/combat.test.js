import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG, MAX_TOWERS_PER_TYPE_AND_LEVEL, getLevelDifficulty } from '../src/config.js';
import { createEnemy, enemyPosition } from '../src/enemyData.js';
import { getTowerStats } from '../src/towerData.js';
import { EnemyManager } from '../src/enemyManager.js';
import { TowerManager } from '../src/towerManager.js';
import { GameManager } from '../src/gameManager.js';
import { getWavePlan } from '../src/levelData.js';

const path = [{ x: 0, y: 0 }, { x: 540, y: 0 }];
function game(mode = 'test') {
  const run = {
    mode, testMode: mode === 'test', testInvulnerable: false, level: 1, map: { paths: [path] }, enemies: [], projectiles: [], groundFires: [],
    nextEnemyId: 1, spawned: 0, ambientSpawned: 0, buffs: {}, coins: 1000, kills: 0, leaks: 0, baseHp: 100, baseMaxHp: 100,
    phase: null, phaseIndex: 0, phaseKills: 0, phaseLeaks: 0, miniBosses: [], bossCurrencyEarned: 0, unlimitedCoins: false,
    towers: [], placingType: null, placingLevel: 1, mergeableTowerIds: new Set(),
  };
  return { run, save: { towerLevels: Object.fromEntries(Object.keys(GAME_CONFIG.towers).map((key) => [key, 1])) }, towerLevel: () => 1, feedback() {}, endRun() {} };
}

test('las estadísticas evo 1 siguen la referencia y el permanente sólo aumenta daño', () => {
  const expected = { gunner: [5, .2, 130], cannon: [30, 1.2, 143], flame: [4, .2, 91], mortar: [45, 2, 182], tesla: [20, 1, 130], sniper: [5, 1.5, 234] };
  for (const [type, [damage, cooldown, range]] of Object.entries(expected)) {
    const level1 = getTowerStats(type, 1, {}, 1);
    const level10 = getTowerStats(type, 1, {}, 10);
    assert.equal(level1.damage, damage);
    assert.equal(level1.cooldown, cooldown);
    assert.equal(level1.range, range);
    assert.equal(level10.range, range);
    assert.ok(level10.damage > level1.damage);
  }
  assert.equal(getTowerStats('gunner', 1, {}, 10).damage, 5 * Math.pow(1.1, 9));
});

test('los siete tipos conservan vida base, velocidad relativa y daño al refugio', () => {
  const expected = { normal: [100, 1, 5], runner: [60, 1.6, 5], tank: [350, .65, 15], armored: [180, .85, 10], regenerator: [150, 1, 10], mini: [1000, .75, 25], boss: [3000, .6, Infinity] };
  for (const [kind, [hp, speed, shelterDamage]] of Object.entries(expected)) {
    const enemy = createEnemy(kind, 1, path, kind);
    assert.equal(enemy.maxHp, hp);
    assert.equal(enemy.speedRelative, speed);
    assert.equal(enemy.shelterDamage, shelterDamage);
  }
  assert.equal(getLevelDifficulty(1).runnerChance, 0);
  assert.ok(getLevelDifficulty(2).runnerChance > 0);
  assert.ok(getLevelDifficulty(6).regeneratorChance > 0);
});

test('la campaña introduce tipos nuevos sin perder cantidades de oleada', () => {
  for (const level of [1, 3, 5, 8]) {
    const waves = getWavePlan(level).filter((phase) => phase.type === 'wave');
    assert.ok(waves.every((phase) => Number.isFinite(phase.enemies) && phase.enemies > 0));
  }
  assert.equal(getWavePlan(1)[1].kind, 'normal');
  assert.equal(getWavePlan(3)[1].kind, 'runner');
  assert.equal(getWavePlan(6)[5].kind, 'regenerator');
});

test('blindaje se aplica una vez, regeneración no revive y jefe destruye el refugio', () => {
  const g = game(); const enemies = new EnemyManager(g);
  enemies.spawn('armored'); const armored = g.run.enemies[0]; enemies.hit(armored.id, 100, 0, { x: 0, y: 0 }); assert.equal(armored.hp, 105);
  enemies.spawn('regenerator'); const regen = g.run.enemies[1]; regen.hp = 1; enemies.hit(regen.id, 10, 0, { x: 0, y: 0 }); enemies.tick(.1); assert.equal(regen.alive, false);
  enemies.spawn('boss'); const boss = g.run.enemies[2]; boss.progress = .99; enemies.tick(1); assert.equal(g.run.baseHp, 0);
});

test('cada tipo de enemigo recibe daño y ningún estado inválido lo vuelve inmortal', () => {
  const kinds = ['normal', 'runner', 'tank', 'armored', 'regenerator', 'mini', 'boss'];
  for (const mode of ['normal', 'infinite', 'test']) {
    const g = game(mode); g.run.damageDone = 0; g.run.damageTarget = 100000;
    const enemies = new EnemyManager(g);
    for (const kind of kinds) {
      enemies.spawn(kind);
      const enemy = g.run.enemies.at(-1);
      const before = enemy.hp;
      enemies.hit(enemy.id, 10, 0, { x: 0, y: 0 });
      assert.ok(Number.isFinite(enemy.hp));
      assert.ok(enemy.hp < before, `${mode}/${kind} no perdió vida`);
    }
    const restored = { id: 'restored', kind: 'normal', alive: true, path };
    g.run.enemies.push(restored);
    enemies.hit('restored', 10, 0, { x: 0, y: 0 });
    assert.equal(restored.hp, 90);
    assert.ok(Number.isFinite(restored.maxHp));
  }
});

test('el escudo absorbe primero, el daño restante llega a vida y ambos son visibles en el impacto', () => {
  const g = game(); const enemies = new EnemyManager(g);
  enemies.spawn('normal');
  const enemy = g.run.enemies[0];
  enemy.hp = 100; enemy.maxHp = 100; enemy.shield = 20; enemy.maxShield = 20;
  enemies.hit(enemy.id, 10, 0, { x: 0, y: 0 });
  assert.equal(enemy.shield, 10); assert.equal(enemy.hp, 100); assert.equal(enemy.lastImpact.shieldDamage, 10); assert.equal(enemy.lastImpact.healthDamage, 0);
  enemies.hit(enemy.id, 20, 0, { x: 0, y: 0 });
  assert.equal(enemy.shield, 0); assert.equal(enemy.hp, 90); assert.equal(enemy.lastImpact.healthDamage, 10);
});

test('explosión, fuego, electricidad y congelación no cortan el daño', () => {
  const g = game(); const enemies = new EnemyManager(g);
  enemies.spawn('normal'); enemies.spawn('normal'); enemies.spawn('normal');
  const [primary, splash, chain] = g.run.enemies;
  enemies.hit(primary.id, 20, 50, { x: 0, y: 0 }, { edgeFalloff: .45 });
  assert.ok(primary.hp < primary.maxHp); assert.ok(splash.hp < splash.maxHp);
  enemies.applyFreeze(chain, 1); const beforeFreezeDamage = chain.hp;
  enemies.hit(chain.id, 20, 0, { x: 0, y: 0 }, { freezeDuration: .5 });
  assert.ok(chain.hp < beforeFreezeDamage);
  const fire = enemies.addGroundFire({ x: 0, y: 0, radius: 30, duration: 1, damagePerSecond: 10 });
  enemies.tick(.5); assert.ok(chain.hp < beforeFreezeDamage);
  assert.ok(fire.duration < 1);
  enemies.hit(primary.id, 20, 0, { x: 0, y: 0 }, { chain: 2, chainRange: 100, chainDamages: [20, 10] });
  assert.ok(chain.hp < chain.maxHp);
});

test('la adquisición y el impacto funcionan para las seis defensas', () => {
  const g = game(); g.towers = new TowerManager(g);
  for (const type of Object.keys(GAME_CONFIG.towers)) {
    g.run.enemies = []; g.run.projectiles = [];
    g.run.towers = [{ id: `tower-${type}`, type, level: 1, x: 0, y: 0, cooldown: 0, priority: 'first' }];
    g.enemies = new EnemyManager(g);
    g.enemies.spawn('normal');
    const target = g.run.enemies[0];
    g.towers.tick(.01);
    assert.ok(g.run.projectiles.length > 0, `${type} no adquirió objetivo`);
    for (const projectile of g.run.projectiles) g.enemies.hit(projectile.targetId, projectile.damage, projectile.splash, projectile.to, projectile);
    assert.ok(target.hp < target.maxHp, `${type} no aplicó daño`);
  }
});

test('los corredores tienen estado completo y reciben daño con movimiento rápido', () => {
  const g = game(); const enemies = new EnemyManager(g);
  for (let index = 0; index < 4; index += 1) enemies.spawn('runner', { pathIndex: 0 });
  assert.equal(g.run.enemies.length, 4);
  for (const runner of g.run.enemies) {
    assert.ok(runner.id); assert.ok(runner.radius > 0); assert.equal(runner.alive, true);
    assert.equal(runner.freezeImmunity, 0); assert.equal(runner.hp, runner.maxHp);
  }
  const target = g.run.enemies[0];
  const orchestrator = Object.create(GameManager.prototype);
  orchestrator.run = g.run; orchestrator.enemies = enemies;
  g.run.projectiles.push({
    from: { x: 0, y: 0 }, to: { x: 420, y: 0 }, position: { x: 0, y: 0 }, targetPosition: { x: 100, y: 0 },
    targetId: target.id, damage: 17, radius: 4, life: .1, maxLife: .1,
  });
  target.progress = 200 / 540;
  orchestrator.updateProjectiles(.1);
  assert.ok(target.hp < target.maxHp, 'el proyectil debe registrar la intersección barrida');
  assert.equal(g.run.projectiles.length, 0);
});

test('los proyectiles guiados actualizan el objetivo y reasignan si el anterior muere', () => {
  const g = game(); const enemies = new EnemyManager(g);
  enemies.spawn('runner'); enemies.spawn('runner');
  const [oldTarget, replacement] = g.run.enemies;
  oldTarget.progress = .3; replacement.progress = .6;
  const orchestrator = Object.create(GameManager.prototype);
  orchestrator.run = g.run; orchestrator.enemies = enemies;
  g.run.projectiles.push({
    from: { x: 0, y: 0 }, to: { x: 160, y: 0 }, position: { x: 0, y: 0 }, targetPosition: enemyPosition(oldTarget),
    targetId: oldTarget.id, damage: 13, radius: 6, guided: true, reassign: true, range: 540, life: .2, maxLife: .2,
  });
  oldTarget.alive = false;
  orchestrator.updateProjectiles(.1);
  assert.equal(g.run.projectiles.length, 1);
  assert.equal(g.run.projectiles[0].targetId, replacement.id);
  orchestrator.updateProjectiles(.1);
  assert.ok(replacement.hp < replacement.maxHp);
  assert.equal(g.run.projectiles.length, 0);
});

test('las seis defensas y sus cinco evoluciones dañan a corredores', () => {
  for (const type of Object.keys(GAME_CONFIG.towers)) {
    for (let level = 1; level <= 5; level += 1) {
      const g = game('test'); g.towers = new TowerManager(g); g.enemies = new EnemyManager(g);
      g.run.towers = [{ id: `${type}-${level}`, type, level, x: 0, y: 0, cooldown: 0, priority: 'first' }];
      g.enemies.spawn('runner');
      const target = g.run.enemies[0];
      g.towers.tick(.01);
      const orchestrator = Object.create(GameManager.prototype);
      orchestrator.run = g.run; orchestrator.enemies = g.enemies;
      orchestrator.updateProjectiles(.2);
      assert.ok(target.hp < target.maxHp, `${type} evo ${level} no dañó al corredor`);
    }
  }
});

test('los estados periódicos conservan precisión, bloquean regeneración y respetan inmunidad', () => {
  const g = game(); const enemies = new EnemyManager(g); enemies.spawn('regenerator'); const enemy = g.run.enemies[0];
  enemy.hp = 100; enemies.applyBurn(enemy, 2, 10, 1); enemies.tick(.5); assert.equal(enemy.hp, 95); enemies.tick(.5); assert.equal(enemy.hp, 90);
  enemies.applyFreeze(enemy, .5); assert.ok(enemy.freezeTimer > 0); enemies.applyFreeze(enemy, .5); assert.equal(enemy.freezeTimer, .5);
  enemies.tick(1.01); assert.ok(enemy.freezeImmunity > 0); const before = enemy.freezeTimer; enemies.applyFreeze(enemy, .5); assert.equal(enemy.freezeTimer, before);
  const beforeDamage = enemy.hp; enemies.damageEnemy(enemy, 10, { source: 'during-freeze-immunity' }); assert.ok(enemy.hp < beforeDamage);
});

test('el modo de prueba es temporal, gratuito y no genera recompensas', () => {
  const prototypeGame = Object.create(GameManager.prototype);
  prototypeGame.save = { towerLevels: { gunner: 7 } };
  const run = prototypeGame.createTestRun({ level: 3, testPermanentLevel: 9, testDifficulty: 'hard' });
  assert.equal(run.mode, 'test'); assert.equal(run.unlimitedCoins, true); assert.equal(run.testPermanentLevel, 9); assert.equal(run.towers.length, 0);
  const g = game('test'); const enemies = new EnemyManager(g); enemies.spawn('boss'); const boss = g.run.enemies[0]; enemies.damageEnemy(boss, boss.maxHp); enemies.kill(boss);
  assert.equal(g.run.coins, 1000); assert.equal(g.run.bossCurrencyEarned, 0);
});

test('el límite permite tres defensas por grado y rechaza una cuarta', () => {
  const g = game(); g.towers = new TowerManager(g);
  g.run.towers = [
    { id: 'a', type: 'gunner', level: 1, x: 100, y: 100 }, { id: 'b', type: 'gunner', level: 1, x: 200, y: 100 }, { id: 'e', type: 'gunner', level: 1, x: 300, y: 100 },
    { id: 'c', type: 'gunner', level: 2, x: 100, y: 250 }, { id: 'd', type: 'gunner', level: 2, x: 200, y: 250 },
  ];
  g.run.placingType = 'gunner'; g.run.placingLevel = 1;
  assert.equal(MAX_TOWERS_PER_TYPE_AND_LEVEL, 3);
  assert.equal(g.towers.gradeLabel('gunner', 1), '3/3 · Fusiona');
  assert.equal(g.towers.getPlacementValidation({ x: 100, y: 350 }, 'gunner').valid, false);
  const coins = g.run.coins;
  assert.equal(g.towers.merge('a', 'b'), true);
  assert.equal(g.run.coins, coins);
  assert.equal(g.run.towers.filter((t) => t.level === 2).length, 3);
  assert.equal(g.run.towers.filter((t) => t.level === 1).length, 1);
});

test('el límite de colocación es el mismo en normal, infinito y prueba', () => {
  for (const mode of ['normal', 'infinite', 'test']) {
    const g = game(mode); g.towers = new TowerManager(g);
    g.run.placingType = 'cannon'; g.run.placingLevel = 5;
    g.run.towers = [1, 2, 3].map((id) => ({ id: `${mode}-${id}`, type: 'cannon', level: 5, x: id * 80, y: 200 }));
    assert.equal(g.towers.gradeLabel('cannon', 5), '3/3 · Máximo');
    assert.equal(g.towers.getPlacementValidation({ x: 100, y: 400 }, 'cannon').reason, 'limit');
  }
});

test('la fusión directa no se bloquea con tres fuentes y no consume si el destino está lleno', () => {
  const g = game(); g.towers = new TowerManager(g);
  g.run.towers = [
    { id: 'source-1', type: 'cannon', level: 1, x: 80, y: 100 }, { id: 'source-2', type: 'cannon', level: 1, x: 160, y: 100 }, { id: 'source-3', type: 'cannon', level: 1, x: 240, y: 100 },
    { id: 'target', type: 'cannon', level: 1, x: 320, y: 100 },
    { id: 'next-1', type: 'cannon', level: 2, x: 80, y: 250 }, { id: 'next-2', type: 'cannon', level: 2, x: 160, y: 250 },
  ];
  g.run.placingType = 'cannon'; g.run.placingLevel = 1;
  const coins = g.run.coins;
  assert.equal(g.towers.mergePurchased('cannon', 'target'), true);
  assert.equal(g.run.towers.find((tower) => tower.id === 'target').level, 2);
  assert.equal(g.run.towers.filter((tower) => tower.type === 'cannon' && tower.level === 2).length, 3);
  assert.ok(g.run.coins < coins);

  g.run.placingType = 'cannon'; g.run.placingLevel = 1;
  const coinsAtFull = g.run.coins;
  const before = g.run.towers.map((tower) => ({ id: tower.id, level: tower.level }));
  assert.equal(g.towers.mergePurchased('cannon', 'source-1'), false);
  assert.equal(g.run.coins, coinsAtFull);
  assert.deepEqual(g.run.towers.map((tower) => ({ id: tower.id, level: tower.level })), before);
  assert.equal(g.towers.gradeLabel('cannon', 5), '0/3');
  g.run.towers.push({ id: 'max-1', type: 'cannon', level: 5 }, { id: 'max-2', type: 'cannon', level: 5 }, { id: 'max-3', type: 'cannon', level: 5 });
  assert.equal(g.towers.gradeLabel('cannon', 5), '3/3 · Máximo');
});
