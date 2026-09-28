import { WORLDS, getLevelDifficulty } from './config.js';

export class LevelManager {
  constructor(game) { this.game = game; }
  maxLevel() { return WORLDS.reduce((total, world) => total + world.levels, 0); }
  isNormallyUnlocked(level) { return level === 1 || this.game.save.completedLevels.includes(level - 1); }
  isUnlocked(level) { return this.isNormallyUnlocked(level) || Boolean(this.game.save.settings?.developer); }
  getLevel(level) {
    const world = WORLDS[Math.floor((level - 1) / 10)] || WORLDS[WORLDS.length - 1];
    const tuning = getLevelDifficulty(level);
    return { level, world, name: level % 10 === 0 ? 'Asedio del Titan' : `Sector ${String(level).padStart(2, '0')}`, difficulty: Math.min(5, 1 + Math.floor((level - 1) / 3)), zombies: tuning.totalEnemies, boss: 'THE TITAN', reward: 50 + level * 12 };
  }
  complete(level, stars) {
    if (!this.game.save.completedLevels.includes(level)) this.game.save.completedLevels.push(level);
    this.game.save.currentLevel = Math.min(this.maxLevel(), Math.max(this.game.save.currentLevel, level + 1));
    this.game.save.mapLevel = this.game.save.currentLevel;
    this.game.save.stars[level] = Math.max(this.game.save.stars[level] || 0, stars);
    this.game.save.scrap += 22 + level * 4;
    this.game.save.technology += level % 3 === 0 ? 1 : 0;
  }
}
