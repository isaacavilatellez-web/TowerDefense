import { GAME_CONFIG } from './config.js';
import { SaveSystem } from './saveSystem.js';

const permanentConfig = () => GAME_CONFIG.economy.permanent;
const finiteInteger = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;

export function getChest(chestId) {
  return permanentConfig().chests.find((chest) => chest.id === chestId) || null;
}

export function randomChestValue(chest, random = Math.random) {
  const [minimum, maximum] = chest.valueRange;
  const steps = Math.floor((maximum - minimum) / 10);
  return minimum + Math.floor(Math.max(0, Math.min(.999999999, random())) * (steps + 1)) * 10;
}

/** Reparte exactamente todo el valor del cofre sin mostrar la unidad interna. */
export function distributeChestValue(totalValue, weights, random = Math.random) {
  const values = permanentConfig().gearValues;
  const rewards = { common: 0, rare: 0, epic: 0, legendary: 0 };
  let remaining = Math.max(0, Math.floor(totalValue));
  while (remaining > 0) {
    const eligible = Object.entries(values).filter(([, value]) => value <= remaining);
    const totalWeight = eligible.reduce((sum, [rarity]) => sum + Math.max(0, Number(weights?.[rarity]) || 0), 0);
    let selected;
    if (totalWeight <= 0) {
      selected = eligible[0]?.[0] || 'common';
    } else {
      let cursor = Math.max(0, Math.min(.999999999, random())) * totalWeight;
      selected = eligible[eligible.length - 1][0];
      for (const [rarity] of eligible) {
        cursor -= Math.max(0, Number(weights?.[rarity]) || 0);
        if (cursor <= 0) { selected = rarity; break; }
      }
    }
    rewards[selected] += 1;
    remaining -= values[selected];
  }
  return rewards;
}

export class EconomyManager {
  constructor(game) { this.game = game; }

  ensurePermanentState() {
    const save = this.game.save;
    if (!Number.isFinite(Number(save.supplies))) save.supplies = Math.max(0, finiteInteger(save.scrap));
    save.supplies = Math.max(0, finiteInteger(save.supplies));
    save.crystals = Math.max(0, finiteInteger(save.crystals));
    // Alias de migración para saves v1 y pruebas antiguas.
    save.scrap = save.supplies;
    save.gears ||= {};
    for (const rarity of Object.keys(permanentConfig().gearValues)) save.gears[rarity] = Math.max(0, finiteInteger(save.gears[rarity]));
    return save;
  }

  getSupplies() { return this.ensurePermanentState().supplies; }

  addSupplies(amount, { persist = true } = {}) {
    const value = Math.max(0, finiteInteger(amount));
    if (!value) return 0;
    const save = this.ensurePermanentState();
    save.supplies += value;
    save.scrap = save.supplies;
    if (persist) SaveSystem.save(save);
    return value;
  }

  spendSupplies(amount) {
    const value = Math.max(0, finiteInteger(amount));
    const save = this.ensurePermanentState();
    if (!value || save.supplies < value) return false;
    save.supplies -= value;
    save.scrap = save.supplies;
    SaveSystem.save(save);
    return true;
  }

  addGear(rarity, amount, { persist = true } = {}) {
    if (!permanentConfig().gearValues[rarity]) return false;
    const count = Math.max(0, finiteInteger(amount));
    if (!count) return false;
    const save = this.ensurePermanentState();
    save.gears[rarity] += count;
    if (persist) SaveSystem.save(save);
    return true;
  }

  gearCount(rarity) { return this.ensurePermanentState().gears[rarity] || 0; }

  openChest(chestId, random = Math.random) {
    const chest = getChest(chestId);
    if (!chest) return { ok: false, reason: 'unknown-chest' };
    const save = this.ensurePermanentState();
    if (save.supplies < chest.price) return { ok: false, reason: 'insufficient-supplies', chest };
    const totalValue = randomChestValue(chest, random);
    const rewards = distributeChestValue(totalValue, chest.weights, random);
    save.supplies -= chest.price;
    save.scrap = save.supplies;
    for (const [rarity, amount] of Object.entries(rewards)) save.gears[rarity] += amount;
    SaveSystem.save(save);
    return { ok: true, chest, totalValue, rewards, remainingValue: 0 };
  }

  buyGear(rarity, quantity = 1) {
    const price = permanentConfig().directGearCrystalPrices[rarity];
    const count = Math.max(0, finiteInteger(quantity));
    if (!price || !count) return { ok: false, reason: 'invalid-purchase' };
    const total = price * count;
    const save = this.ensurePermanentState();
    if (save.crystals < total) return { ok: false, reason: 'insufficient-crystals', price, total, rarity, quantity: count };
    save.crystals -= total;
    save.gears[rarity] += count;
    SaveSystem.save(save);
    return { ok: true, price, total, rarity, quantity: count };
  }

  click() {
    const { run } = this.game;
    const values = GAME_CONFIG.economy.clickValues;
    const amount = values[Math.min(values.length - 1, Math.max(0, run.clickerLevel - 1))] || 1;
    if (!run.unlimitedCoins) run.coins += amount;
    run.clicks += 1;
    this.game.feedback(`+${amount} monedas`, 'coin');
  }

  upgradeClicker() {
    const { run } = this.game;
    const cost = this.clickerCost();
    if (!cost || (!run.unlimitedCoins && run.coins < cost)) return false;
    if (!run.unlimitedCoins) run.coins -= cost;
    run.clickerLevel += 1;
    this.game.feedback('Clicker mejorado', 'success');
    return true;
  }

  clickerCost() {
    return GAME_CONFIG.economy.clickerUpgradeCosts[this.game.run.clickerLevel - 1] || null;
  }

  tick(seconds) {
    // Las monedas de combate son temporales y nunca se mezclan con Suministros.
  }
}
