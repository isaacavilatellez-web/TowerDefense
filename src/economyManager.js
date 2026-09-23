import { GAME_CONFIG } from './config.js';

export class EconomyManager {
  constructor(game) { this.game = game; }

  click() {
    const { run } = this.game;
    const amount = Math.max(1, Math.round(GAME_CONFIG.economy.clickBase * Math.pow(GAME_CONFIG.economy.clickGrowth, run.clickerLevel - 1)));
    const bonus = 1 + (run.buffs.coins || 0);
    run.coins += Math.round(amount * bonus);
    run.clicks += 1;
    run.combo = Math.min(10, run.combo + 1);
    run.comboTimer = 2.3;
    this.game.feedback(`+${Math.round(amount * bonus)} monedas`, 'coin');
  }

  upgradeClicker() {
    const { run } = this.game;
    const cost = this.clickerCost();
    if (run.coins < cost) return false;
    run.coins -= cost;
    run.clickerLevel += 1;
    run.autoCoins += run.clickerLevel > 2 ? 1 : 0;
    this.game.feedback('Clicker mejorado', 'success');
    return true;
  }

  clickerCost() { return Math.round(65 * Math.pow(1.9, this.game.run.clickerLevel - 1)); }

  tick(seconds) {
    const { run } = this.game;
    run.autoCoinTimer += seconds;
    if (run.autoCoinTimer >= 1) {
      const ticks = Math.floor(run.autoCoinTimer);
      run.coins += ticks * (run.autoCoins + Math.floor(run.clickerLevel / 3));
      run.autoCoinTimer %= 1;
    }
    if (run.comboTimer > 0) run.comboTimer -= seconds;
    else run.combo = 0;
  }
}
