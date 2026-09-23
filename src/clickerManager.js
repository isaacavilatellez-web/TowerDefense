export class ClickerManager {
  constructor(game) { this.game = game; }
  press() { this.game.economy.click(); }
  upgrade() { return this.game.economy.upgradeClicker(); }
}
