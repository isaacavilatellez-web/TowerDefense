import { GAME_CONFIG } from './config.js';

export class EconomyManager {
  constructor(game) { this.game = game; }

  click() {
    const { run } = this.game;
    if (!run || run.ended) return;
    const values = GAME_CONFIG.economy.clickValues;
    const amount = values[Math.min(values.length - 1, Math.max(0, run.clickerLevel - 1))] || 1;
    run.coins += amount;
    run.clicks += 1;
    this.game.feedback(`+${amount} monedas`, 'coin');
  }

  upgradeClicker() {
    const { run } = this.game;
    if (!run || run.ended) return false;
    if (run.infinite && run.clickerLevel >= GAME_CONFIG.infinite.clicker.maxLevel) return false;
    const cost = this.clickerCost();
    if (!cost || run.coins < cost) return false;
    run.coins -= cost;
    run.clickerLevel += 1;
    this.game.feedback('Clicker mejorado', 'success');
    return true;
  }

  clickerCost() {
    const run = this.game.run;
    if (!run || (run.infinite && run.clickerLevel >= GAME_CONFIG.infinite.clicker.maxLevel)) return null;
    return GAME_CONFIG.economy.clickerUpgradeCosts[run.clickerLevel - 1] || null;
  }

  tick(seconds) {
    const { run } = this.game;
    // El clicker es exclusivamente manual. Se conserva autoCoinTimer en las
    // partidas en memoria para no romper saves/estado antiguos, pero ya no se usa.
  }
}
