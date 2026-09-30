import { GAME_CONFIG } from './config.js';

export class RoguelikeManager {
  constructor(game) { this.game = game; }

  offer(random = Math.random) {
    const pool = [...GAME_CONFIG.roguelike];
    const options = [];
    while (options.length < 3 && pool.length) options.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    this.game.run.upgradeOptions = options;
    this.game.run.pausedForUpgrade = true;
  }

  choose(id) {
    if (!this.game.run?.pausedForUpgrade) return false;
    const choice = this.game.run.upgradeOptions.find((item) => item.id === id);
    if (!choice) return false;
    const buffs = this.game.run.buffs;
    const values = { gunner_damage: ['gunner_damage', 0.22], attack_speed: ['attack_speed', 0.15], coins: ['coins', 0.3], range: ['range', 0.1], flame_damage: ['flame_damage', 0.35], cannon_splash: ['cannon_splash', 0.25] };
    const [key, value] = values[id];
    buffs[key] = (buffs[key] || 0) + value;
    this.game.run.upgradeOptions = [];
    this.game.run.pausedForUpgrade = false;
    this.game.feedback(`${choice.title} activada`, 'success');
    return true;
  }
}
